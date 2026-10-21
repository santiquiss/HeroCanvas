// Inspector for the selected component, as a developer's handoff: the work it asks for (reuse, change, build), its
// Figma mapping, the components it's built from, props, layout / fill / typography with their tokens, and a code
// snippet.
import { fitArgs } from '../design/storyArgs';
import { isValidElement, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { CATALOG, figmaUrl, catalogUrl } from '../design/catalog';
import { componentTier, FIGMA_LINKED } from '../design/figma';
import { apiContrast, APP_WIDGETS, builtFrom, figmaFor, radius, spacing, WORK, workFor, type Measure } from '../design/handoff';
import { findProposal, proposalLabel } from '../proposals';
import { useProposalParam } from './ProposalPanel';
import { paramReview, widgetReview, type ReviewNote } from '../design/apiReview';
import { useLibrary, type ApiWidget } from '../design/library';
import { elementById, useDesign } from '../design/DesignContext';
import { elementSize, anchors, flexAlignment, codeSizing, textOverflowOf, kindLabel, layerKind, mixesText, shapeCorners, textOf } from '../design/element';
import { AlignDiagram, PaddingDiagram, RadiusGlyph, SizingGlyph, SpacingGlyph } from './InspectGlyphs';
import { closestComponent, componentInstance, parentComponent, type ComponentProps } from '../design/component';
import type { Args, StoryModule } from '../design/stories';
import { colorTokens, isVisibleColor, type ColorRole } from '../design/tokens';
import { colorSource, type ColorProp } from '../design/colorSource';
import { declaredTextStyle, textStylesOf } from '../design/textStyles';
import { findToken, TOKENS_CODE_LINKED } from '../design/tokenCatalog';
import { useGalleryNav, useStories } from '../gallery/route';
import { useSim } from '../sim/SimContext';
import { useMode } from '../sim/modes';
import { SectionTitle, sectionClosed } from './PanelSection';
import { Notes, Status } from '../gallery/ComponentInfo';
import styles from './Panel.module.css';
import { propDecl } from '../design/simulatorProps';

export function InspectPanel() {
  // The gallery is all components: no Components / All to choose (DesignProvider's allOnly).
  const mode = useMode();
  return (
    <>
      {mode !== 'components' && <ScopeBar />}
      <Selection />
    </>
  );
}

/** What a click on the canvas picks: the component under the pointer, or the element itself. */
/** Flex alignment in words (flexAlignment's values). */
const ALIGN_WORDS: Record<string, string> = { start: 'Start', center: 'Center', end: 'End', stretch: 'Stretch', baseline: 'Baseline', spaceBetween: 'Space between', spaceAround: 'Space around', spaceEvenly: 'Space evenly' };

function ScopeBar() {
  const { scope, setScope } = useDesign();
  const options = [
    { id: 'all', label: 'All', icon: 'select_all', title: 'Select any element: a text, a shape, a container' },
    { id: 'components', label: 'Components', icon: 'widgets', title: 'Select components' },
  ] as const;
  return (
    <div className={styles.section}>
      <div className={styles.segment} title="What a click selects. ⌘-click picks the element itself in either.">
        {options.map((o) => (
          <button key={o.id} className={`${styles.btn} ${scope === o.id ? styles.btnActive : ''}`} title={o.title} onClick={() => setScope(o.id)}>
            <Icon name={o.icon} size={14} />
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Selection() {
  const { selected, setSelected, selectedEl, rootRef, setInspect } = useDesign();
  const { theme } = useSim();
  const { stories, proposalId } = useStories();
  const { openComponent } = useGalleryNav();
  const lib = useLibrary();
  const [, refresh] = useState(0);
  // Re-measure while open: layout changes with scroll, animations and device switches.
  useEffect(() => {
    const t = window.setInterval(() => refresh((n) => n + 1), 400);
    return () => window.clearInterval(t);
  }, []);

  // An element picked on its own (the `all` scope, a ⌘-click): its layer, not a component's handoff.
  if (selectedEl && rootRef.current?.contains(selectedEl)) return <ElementInspector el={selectedEl} theme={theme} />;
  const el = elementById(rootRef.current, selected);
  const inst = componentInstance(selected ?? undefined);
  if (el && inst && !lib) return <div className={styles.section}><span className={styles.muted}>Loading the code's components…</span></div>;
  if (!el || !inst || !lib) {
    return (
      <div className={styles.section}>
        <p style={{ margin: '0 0 10px', color: 'var(--ui-text-2)' }}>
          Click a component on the device, or pick one in Layers. ⌘-click (or All, above) picks the element itself: a text, a shape, a container. With one picked, hover another to
          measure between them.
        </p>
        <button className={styles.btn} onClick={() => setInspect(false)}>
          <Icon name="close" size={14} />
          Leave Inspect
        </button>
      </div>
    );
  }

  const entry = CATALOG.get(inst.name);
  const parent = parentComponent(el, rootRef.current);
  // Typography comes from the first element that holds text itself, not from a container.
  const textEl = firstTextElement(el);
  const props = Object.entries(inst.props).filter(([, v]) => v != null);
  const mod = stories.get(inst.name);
  const work = WORK[workFor(inst.name, proposalId, lib, inst.props)];
  const widget = lib.widget(inst.name);
  // With a code connector, the call as the app's code writes it: the constructor and its parameters (no simulator
  // props), then the ones a proposal adds, each marked with its code. Without one, the component as the mirror
  // writes it (JSX): the only code known, in no other stack's syntax.
  const api = widget && apiContrast(widget, inst.props, inst.name);
  const snippet =
    widget && api
      ? codeCall(
          api.constructor ?? widget.name,
          Object.fromEntries(Object.entries(inst.props).filter(([k]) => api.params.some((p) => p.name === k) || api.proposed.some((p) => p.name === k))),
          api.params.filter((p) => p.positional).map((p) => p.name),
          Object.fromEntries(api.proposed.map((p) => [p.name, p.proposal])),
        )
      : jsxCall(inst.name, inst.props);
  const snippetFrom = widget && api ? 'The app’s code' : 'The mirror’s code (React)';
  const figma = figmaFor(inst.name);
  // Its tier (atom, molecule…) only when the code or Figma gives one: never a guess.
  const tier = widget?.tier ?? entry?.tier ?? (inst.name in APP_WIDGETS ? componentTier(inst.name) : undefined);
  const parts = builtFrom(el);
  const figmaLink = figma.find((m) => m.url)?.url ?? (entry && figmaUrl(entry));

  return (
    <>
      <div className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: '20px', overflowWrap: 'anywhere' }}>{inst.name}</span>
          {tier && <span className={styles.badge}>{tier}</span>}
          {/* Against the code: in the library, differs (a proposal changes it), new, in the app only, or not in code. */}
          <span className={styles.badge} style={{ background: work.color, color: '#ffffff' }} title={work.label}>
            {work.badge}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {parent && (
            <button className={styles.btn} title="Select parent" onClick={() => setSelected(parent.dataset.hc!)}>
              <Icon name="arrow_upward" size={14} />
              {componentInstance(parent.dataset.hc)?.name}
            </button>
          )}
          {mod && (
            <button className={styles.btn} title="Open in Components with these props" onClick={() => openComponent(inst.name, onStory(mod, inst.props))}>
              <Icon name="widgets" size={14} />
              Components
            </button>
          )}
          {entry && (
            <a className={styles.btn} href={catalogUrl(entry)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <Icon name="menu_book" size={14} />
              Catalog
            </a>
          )}
          {figmaLink && (
            <a className={styles.btn} href={figmaLink} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <Icon name="design_services" size={14} />
              Figma
            </a>
          )}
        </div>
      </div>

      {/* As the gallery's Info: where it stands against the code (Status), then how it relates to Figma (Notes). */}
      <Status name={inst.name} />
      {/* This instance's own: what a proposal does to it, or the parameters a proposal adds that it sets. */}
      {(work === WORK.change || work === WORK.new || work === WORK.extend || (api && api.proposed.length > 0)) && (
        <div className={styles.section}>
          <p style={{ margin: 0 }}>
            <b style={{ fontWeight: 600 }}>{work.label}.</b> <span className={styles.muted}>{work.hint}</span>
          </p>
          {api && api.proposed.length > 0 && <ProposedBy proposed={api.proposed} active={proposalId} />}
        </div>
      )}
      <Notes name={inst.name} />

      {parts.length > 0 && (
        <div className={styles.section}>
          <SectionTitle id="nested" title="Nested components" />
          <div className={styles.parts}>
            {parts.map((p) => {
              // Differs when any of its instances sets a parameter a proposal adds.
              const w = WORK[workFor(p.name, proposalId, lib, Object.assign({}, ...p.ids.map((id) => componentInstance(id)?.props)))];
              return (
                <button key={p.name} className={styles.part} title={`${w.label}. Select it`} onClick={() => setSelected(p.ids[0])}>
                  <span className={styles.dot} style={{ background: w.color }} />
                  <span className={styles.mono} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </span>
                  {p.ids.length > 1 && <span className={styles.muted}>×{p.ids.length}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {widget ? (
        <CodeApi widget={widget} name={inst.name} props={inst.props} version={lib.version} />
      ) : (
        <div className={styles.section}>
          <SectionTitle id="props" title="Props">
            <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
              drawn here
            </span>
          </SectionTitle>
          <p className={styles.muted} style={{ margin: '0 0 8px' }}>
            No component in the code{lib.version ? ` (${lib.version})` : ''}: these are the simulator's props, a starting point for its API.
          </p>
          {props.length ? (
            <div className={styles.kv}>
              {props.map(([key, v]) => (
                <Row key={key} k={key} v={fmt(v)} mono />
              ))}
            </div>
          ) : (
            <span className={styles.muted}>None</span>
          )}
        </div>
      )}

      <StyleSections el={el} textEl={textEl} theme={theme} />

      <div className={styles.section}>
        <SectionTitle id="code" title="Code">
          <CopyButton text={snippet} />
        </SectionTitle>
        <div className={styles.muted} style={{ marginBottom: 6 }}>
          {snippetFrom}
        </div>
        <pre className={styles.mono} style={{ margin: 0, padding: 8, borderRadius: 6, background: 'var(--ui-bg-subtle)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {snippet}
        </pre>
      </div>
    </>
  );
}

/**
 * An element picked on its own: what kind of layer it is, the component it's part of (a click selects it), and its
 * layout, fill and type with their tokens.
 */
function ElementInspector({ el, theme }: { el: Element; theme: 'light' | 'dark' }) {
  const { rootRef, setSelected, setSelectedEl } = useDesign();
  const [, refresh] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => refresh((n) => n + 1), 400);
    return () => window.clearInterval(t);
  }, []);
  const kind = layerKind(el);
  // A box with text beside other elements (a button's icon and label) is that box, and its text's type shows too.
  const mixed = mixesText(el);
  const owner = closestComponent(el, rootRef.current);
  const parent = el.parentElement && el.parentElement !== rootRef.current ? el.parentElement : null;
  const text = mixed || kind === 'text' ? textOf(el) : '';
  return (
    <>
      <div className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: '20px', overflowWrap: 'anywhere' }}>{text ? `“${text.slice(0, 40)}”` : kindLabel(el, kind)}</span>
          <span className={styles.badge}>{kindLabel(el, kind)}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {parent && (
            <button className={styles.btn} title="Select the element it's in" onClick={() => setSelectedEl(parent)}>
              <Icon name="arrow_upward" size={14} />
              Parent
            </button>
          )}
          {owner && (
            <button className={styles.btn} title="Select the component it's part of" onClick={() => setSelected(owner.dataset.hc!)}>
              <Icon name="widgets" size={14} />
              {componentInstance(owner.dataset.hc)?.name}
            </button>
          )}
        </div>
      </div>
      <StyleSections el={el} textEl={(kind === 'text' || mixed) && el instanceof HTMLElement ? el : null} theme={theme} />
    </>
  );
}

/** Layout, fill and stroke, and typography of an element, each value with its token. */
function StyleSections({ el, textEl, theme }: { el: Element; textEl: HTMLElement | null; theme: 'light' | 'dark' }) {
  const { scale, rootRef } = useDesign();
  const cs = getComputedStyle(el);
  // From its page's corner; what's outside the pages (the nav), from the screen's.
  const page = (el.closest('[data-hc-page]') as HTMLElement | null) ?? rootRef.current;
  const r = el.getBoundingClientRect();
  const pr = page?.getBoundingClientRect();
  const size = elementSize(el, scale);
  // Screen px per device point.
  const k = el instanceof HTMLElement && el.offsetWidth ? r.width / el.offsetWidth : scale || 1;
  const ts = textEl ? getComputedStyle(textEl) : null;
  const overflow = textEl ? textOverflowOf(textEl) : null;
  const shape = el instanceof SVGElement;
  const flex = cs.display.includes('flex');
  const column = flex && cs.flexDirection.startsWith('column');
  const align = flex ? flexAlignment(cs) : null;
  // Space between (Figma's Auto gap): the spacing is the least there is between them.
  const autoGap = align?.main === 'spaceBetween';
  const [w, h] = [codeSizing(el, 'w'), codeSizing(el, 'h')];
  // Placed by itself (absolute, fixed: a positioned child), by the sides it's anchored to; not by its parent's layout.
  const pinned = anchors(el);
  return (
    <>
      <div className={styles.section}>
        <SectionTitle id="layout" title="Layout" />
        <div className={styles.kv}>
          <Key k="Size" icon="aspect_ratio" />
          <span className={`${styles.v} ${styles.mono}`}>
            <Measured set={!w || w.sizing === 'fixed'} why={w?.code}>{size.w}</Measured>
            {' × '}
            <Measured set={!h || h.sizing === 'fixed'} why={h?.code}>{size.h}</Measured>
          </span>
          {w && (
            <>
              <Key k="Width" icon={<SizingGlyph sizing={w.sizing} axis="w" />} />
              <span className={`${styles.v} ${styles.mono}`}>
                {w.code}
              </span>
            </>
          )}
          {h && (
            <>
              <Key k="Height" icon={<SizingGlyph sizing={h.sizing} axis="h" />} />
              <span className={`${styles.v} ${styles.mono}`}>
                {h.code}
              </span>
            </>
          )}
          {pr && (
            <>
              <Key k="Position" icon="open_with" />
              <span className={`${styles.v} ${styles.mono}`}>
                {pinned && (
                  <span style={{ display: 'block' }} title={`Placed by these sides in its ${cs.position === 'fixed' ? 'screen' : 'parent'}, not by its parent's layout`}>
                    Pinned: {(['left', 'top', 'right', 'bottom'] as const).filter((sd) => pinned[sd] != null).map((sd) => `${sd} ${pinned[sd]}`).join(', ') || 'none'}
                  </span>
                )}
                <Measured set={false} why={pinned ? 'where those sides put it, from the page' : "where its parent's layout puts it"}>
                  {`x ${Math.round((r.left - pr.left) / k)} · y ${Math.round((r.top - pr.top) / k)}`}
                </Measured>
              </span>
            </>
          )}
          {flex && <Row k="Flex" icon={column ? 'table_rows' : 'view_column'} v={column ? 'Column' : 'Row'} mono />}
          {align && (
            <>
              <Key k="Alignment" icon="align_horizontal_left" />
              <span className={`${styles.v} ${styles.alignRow}`}>
                <AlignDiagram cs={cs} />
                <span className={styles.mono}>
                  <span style={{ display: 'block' }} title={`Along its ${column ? 'column' : 'row'}`}>Along: {ALIGN_WORDS[align.main] ?? align.main}</span>
                  <span style={{ display: 'block' }} title={`Across its ${column ? 'column' : 'row'}`}>Across: {ALIGN_WORDS[align.cross] ?? align.cross}</span>
                </span>
              </span>
            </>
          )}
          {cs.display === 'grid' && <Row k="Grid" icon="grid_view" v={`${cs.gridTemplateColumns.split(' ').length} cols`} mono />}
          {(flex || cs.display === 'grid') && gap(cs) && <TokenRow k={autoGap ? 'Spacing (min)' : 'Spacing'} icon={<SpacingGlyph column={column} />} values={gap(cs)!.map(spacing)} />}
          {box(cs, 'padding') && (
            <>
              <Key k="Padding" icon="padding" />
              <span className={styles.v}>
                <PaddingDiagram sides={(['Top', 'Right', 'Bottom', 'Left'] as const).map((sd) => <SideValue key={sd} m={spacing(cs[`padding${sd}`])} />) as [ReactNode, ReactNode, ReactNode, ReactNode]} />
              </span>
            </>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <SectionTitle id="fill" title="Fill & stroke" />
        {!shape && !cs.fontFamily.includes('Material Symbols') && !isVisibleColor(cs.backgroundColor) && cs.backgroundImage === 'none' && cs.borderRadius === '0px' && cs.boxShadow === 'none' && (cs.borderStyle === 'none' || cs.borderWidth === '0px') && (
          <span className={styles.muted}>None</span>
        )}
        <div className={styles.kv}>
          {isVisibleColor(cs.backgroundColor) && <ColorRow k="Fill" icon="format_color_fill" el={el} prop="background-color" color={cs.backgroundColor} theme={theme} role="fill" />}
          {shape && isVisibleColor(cs.fill) && cs.fill !== 'none' && <ColorRow k="Fill" icon="format_color_fill" el={el} prop="fill" color={cs.fill} theme={theme} role="fill" />}
          {shape && isVisibleColor(cs.stroke) && cs.stroke !== 'none' && <ColorRow k={`Stroke ${cs.strokeWidth}`} icon="border_color" el={el} prop="stroke" color={cs.stroke} theme={theme} role="border" />}
          {cs.backgroundImage !== 'none' && <Row k="Gradient" icon="gradient" v={cs.backgroundImage} mono />}
          {cs.borderRadius !== '0px' && <TokenRow k="Radius" icon={<RadiusGlyph corners={shapeCorners(el)} />} values={cs.borderRadius.split(' ').map((v) => radius(v, size.h))} />}
          {cs.borderStyle !== 'none' && cs.borderWidth !== '0px' && <ColorRow k={`Border ${cs.borderWidth}`} icon="border_style" el={el} prop="border-color" color={cs.borderColor} theme={theme} role="border" />}
          {cs.boxShadow !== 'none' && <Row k="Shadow" icon="blur_on" v={cs.boxShadow} mono />}
          {cs.opacity !== '1' && <Row k="Opacity" icon="opacity" v={cs.opacity} mono />}
          {/* An icon's glyph is drawn in its color (the icon's `color`), not a fill. */}
          {cs.fontFamily.includes('Material Symbols') && <ColorRow k="Icon" icon="palette" el={el} prop="color" color={cs.color} theme={theme} role="icon" />}
        </div>
      </div>

      {ts && textEl && (
        <div className={styles.section}>
          <SectionTitle id="typography" title="Typography">
            {textEl !== el && <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>first text</span>}
          </SectionTitle>
          <div className={styles.kv}>
            <Row k="Text" icon="title" v={`“${textOf(textEl).slice(0, 40)}”`} />
            <TextStyleRow el={textEl} cs={ts} />
            {overflow && (
              <>
                <Key k="Overflow" icon="more_horiz" />
                <span className={`${styles.v} ${styles.mono}`}>
                  <span style={{ display: 'block' }}>
                    {overflow.maxLines === 1 ? '1 line' : `${overflow.maxLines} lines`}, then {overflow.overflow === 'ellipsis' ? '“…”' : 'cut'}
                  </span>
                  <span className={styles.muted} style={{ display: 'block' }}>
                    {overflow.cut ? (overflow.overflow === 'ellipsis' ? 'Cut now, with “…”' : 'Cut now') : 'Fits now'}
                  </span>
                </span>
              </>
            )}
            {ts.letterSpacing !== 'normal' && <Row k="Tracking" icon="space_bar" v={ts.letterSpacing} mono />}
            <ColorRow k="Color" icon="format_color_text" el={textEl} prop="color" color={ts.color} theme={theme} role="text" />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The proposals that add the parameters this screen sets to the widget, with what each adds: a click opens one (its
 * stories, its handoff). The active one isn't offered again.
 */
function ProposedBy({ proposed, active }: { proposed: { name: string; proposal: string }[]; active: string | null }) {
  const [, setProposal] = useProposalParam();
  const by = new Map<string, string[]>();
  for (const p of proposed) by.set(p.proposal, [...(by.get(p.proposal) ?? []), p.name]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '-4px 0 10px' }}>
      {[...by].map(([id, names]) => {
        const p = findProposal(id);
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{p ? proposalLabel(p) : id}</span>
              <span className={`${styles.mono} ${styles.muted}`} style={{ display: 'block', overflowWrap: 'anywhere' }}>
                {names.join(', ')}
              </span>
            </span>
            {id !== active && (
              <button className={styles.btn} title="Open the proposal: its stories and handoff" onClick={() => setProposal(id)}>
                Open
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Where the gallery opens for the instance: on the first story with the instance's props as its args, when the
 * stories take the component's props (Button's label, variant…); stories with args of their own (a `task` object)
 * open on the component, all its stories.
 */
function onStory(mod: StoryModule<Args>, props: ComponentProps): { story: string; args: Args } | undefined {
  const plain = (v: unknown): boolean =>
    v == null || ['string', 'number', 'boolean'].includes(typeof v) || (Array.isArray(v) ? v.every(plain) : typeof v === 'object' && !isValidElement(v) && Object.values(v as object).every(plain));
  // Enum props as the code writes them (`ButtonVariant.primary`) become the story's options (fitArgs).
  const args = Object.fromEntries(Object.entries(fitArgs(mod, props)).filter(([k, v]) => k in mod.args && v != null && plain(v) && JSON.stringify(v) !== JSON.stringify(mod.args[k])));
  const story = mod.stories[0]?.name;
  return story && Object.keys(args).length ? { story, args } : undefined;
}

/**
 * The component's API in the code (from the code connector): where it lives, its constructors and parameters, each marked when this
 * screen sets it, then the props drawn here that the widget has no parameter for.
 */
function CodeApi({ widget, name, props, version }: { widget: ApiWidget; name: string; props: ComponentProps; version: string | null }) {
  const { params, constructor, proposed, extra, simulator, accepted } = apiContrast(widget, props, name);
  const why = propDecl(name);
  const look = (why.look ?? []).filter((l) => !why.accepted?.[l]);
  const acceptedLook = (why.look ?? []).filter((l) => why.accepted?.[l]);
  return (
    <div className={styles.section}>
      <SectionTitle id="code-api" title="Code API">
        <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }} title={version ? `Read from the code at ${version}` : undefined}>
          code
        </span>
      </SectionTitle>
      {!sectionClosed('code-api') && (
      <>
      <div className={styles.apiHead}>
        {constructor ? (
          <span className={styles.mono}>
            <b>{constructor}</b>
            {widget.constructors.length > 1 && <span className={styles.muted}> · of {widget.constructors.length} constructors</span>}
          </span>
        ) : (
          <span className={styles.mono}>{widget.constructors.join(' · ')}</span>
        )}
        <span className={`${styles.mono} ${styles.muted}`} style={{ overflowWrap: 'anywhere' }}>
          {widget.file}
        </span>
        {widget.summary && <span className={styles.muted}>{widget.summary}</span>}
        <Review note={widgetReview(widget)} />
      </div>
      {/* What this screen sets: a small blue mark (the selection's blue: the panels' dots are statuses) and its name in
          bold, with its value; the rest muted, at their default, with the mark in a light gray. */}
      <div className={styles.params}>
        {params.map((p) => (
          <div key={p.name}>
            <div className={styles.param} title={p.set ? 'Set on this screen' : 'Not set on this screen: its default'}>
              <span className={`${styles.setMark} ${p.set ? '' : styles.defaultMark}`} />
              <span className={`${styles.mono} ${p.set ? '' : styles.muted}`} style={{ fontWeight: p.set ? 700 : 400 }}>
                {p.name}
              </span>
              <span className={styles.mono} style={{ flex: 1, minWidth: 0, textAlign: 'right', overflowWrap: 'anywhere' }}>
                {p.set ? (
                  // The value and its type on one line (the type muted), so the list stays short.
                  <>
                    {codeValue(props[p.name])}
                    <span className={styles.muted}> {p.type}</span>
                  </>
                ) : (
                  <span className={styles.muted}>
                    {p.type}
                    {p.required ? ' · required' : p.default ? ` = ${p.default}` : ''}
                  </span>
                )}
              </span>
            </div>
            <Review note={paramReview(widget, p)} indent />
          </div>
        ))}
      </div>
      {proposed.length > 0 && (
        <>
          <span className={styles.controlLabel} style={{ display: 'block', margin: '10px 0 4px' }}>
            To add to the widget
          </span>
          <div className={styles.kv}>
            {proposed.map((p) => (
              <Row key={p.name} k={`+ ${p.name}`} v={`${fmt(props[p.name])} · ${p.proposal}`} mono />
            ))}
          </div>
          <span className={styles.muted} style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: '15px' }}>
            Set on this screen, not in the widget yet: the proposal named beside each specifies it (its handoff.md).
          </span>
        </>
      )}
      {extra.length > 0 && (
        <>
          <span className={styles.controlLabel} style={{ display: 'block', margin: '10px 0 4px', color: WORK.differs.color }}>
            Differs from the widget
          </span>
          <div className={styles.kv}>
            {extra.map((k) => (
              <div key={k}>
                <Row k={`⚠ ${k}`} v={fmt(props[k])} mono />
                <span className={styles.muted} style={{ display: 'block', margin: '0 0 4px', fontSize: 11, lineHeight: '15px' }}>
                  {why.differs?.[k] ?? 'Not declared beside the component: say whether it’s the simulator’s alone or a difference.'}
                </span>
              </div>
            ))}
          </div>
          <span className={styles.muted} style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: '15px' }}>
            Something the widget doesn't have (a Figma variant, a size, a state): to agree on with design and the app.
          </span>
        </>
      )}
      {look.length > 0 && (
        <>
          <span className={styles.controlLabel} style={{ display: 'block', margin: '10px 0 4px', color: WORK.differs.color }}>
            Looks different from the code
          </span>
          {look.map((l) => (
            <span key={l} className={styles.muted} style={{ display: 'block', margin: '0 0 4px', fontSize: 11, lineHeight: '15px' }}>
              {l}
            </span>
          ))}
        </>
      )}
      {accepted.length + acceptedLook.length > 0 && (
        <>
          <span className={styles.controlLabel} style={{ display: 'block', margin: '10px 0 4px', color: WORK.reuse.color }}>
            Accepted as it is
          </span>
          {[...accepted, ...acceptedLook].map((k) => (
            <span key={k} className={styles.muted} style={{ display: 'block', margin: '0 0 4px', fontSize: 11, lineHeight: '15px' }}>
              <b style={{ color: 'var(--ui-text-2)', fontWeight: 600 }}>{k}</b>
              {' — '}
              {why.accepted?.[k]?.reason} ({why.accepted?.[k]?.by}, {why.accepted?.[k]?.on})
            </span>
          ))}
        </>
      )}
      {simulator.length > 0 && (
        <>
          <span className={styles.controlLabel} style={{ display: 'block', margin: '10px 0 4px' }}>
            Simulator only
          </span>
          <div className={styles.kv}>
            {simulator.map((k) => (
              <div key={k}>
                <Row k={k} v={fmt(props[k])} mono />
                <span className={styles.muted} style={{ display: 'block', margin: '0 0 4px', fontSize: 11, lineHeight: '15px' }}>
                  {why.simulator?.[k]}
                </span>
              </div>
            ))}
          </div>
          <span className={styles.muted} style={{ display: 'block', marginTop: 4, fontSize: 11, lineHeight: '15px' }}>
            What the simulator needs to draw it: not the widget's, left out of the handoff and the code call.
          </span>
        </>
      )}
      </>
      )}
    </div>
  );
}

/** A naming note on the API (apiReview): what's off and the name to use. */
function Review({ note, indent }: { note?: ReviewNote; indent?: boolean }) {
  if (!note) return null;
  return (
    <span className={styles.review} style={indent ? { marginLeft: 12 } : undefined}>
      ⚑ {note.issue}
      {note.suggest && (
        <>
          {' → '}
          <span className={styles.mono}>{note.suggest}</span>
        </>
      )}
    </span>
  );
}

/**
 * Measurements with their tokens: each value by its token first and its number after ("Spacing/2x (16)"), the token a
 * link to it in Components › Tokens; a value off the scale is flagged (a hardcoded value, or a token to add). With
 * `label`, a token name alone (a text style).
 */
function TokenRow({ k, icon, values, label, missing = 'Off the scale: no token', children }: { k: string; icon?: Pic; values: Measure[]; label?: string | null; missing?: string; children?: ReactNode }) {
  const warn = (text: string) => (
    <span className={styles.mono} style={{ color: 'var(--ui-amber-text)' }} title={missing}>
      ⚠ {text}
    </span>
  );
  return (
    <>
      <Key k={k} icon={icon} />
      <span className={styles.v}>
        {children}
        {label === undefined ? (
          <span style={{ display: 'flex', flexWrap: 'wrap', columnGap: 8 }}>
            {values.map((m, i) =>
              m.token ? (
                <TokenLink key={i} name={m.token} suffix={` (${m.px})`} />
              ) : m.px === 0 ? (
                // None: nothing to put a token on.
                <span key={i} className={styles.mono}>
                  0
                </span>
              ) : (
                <span key={i}>{warn(String(m.px))}</span>
              ),
            )}
          </span>
        ) : label ? (
          <TokenLink name={label} />
        ) : (
          warn(missing)
        )}
      </span>
    </>
  );
}

/**
 * A token's name, a link to its row in Components › Tokens when the catalog has it (plain otherwise). `label`: what
 * it shows instead of the name, where there's little room (a padding side's `2x`).
 */
function TokenLink({ name, suffix = '', label }: { name: string; suffix?: string; label?: string }) {
  const { openTokens } = useGalleryNav();
  const place = findToken(name);
  if (!place) return <span className={styles.mono} title={name}>{label ?? name}{suffix}</span>;
  return (
    <button className={styles.tokenLink} title={`${name}: open ${place.name} in Tokens${place.value ? ` (${place.value})` : ''}`} onClick={() => openTokens(place.group, place.name)}>
      {label ?? name}
      <span className={styles.muted}>{suffix}</span>
    </button>
  );
}

/** One side's padding in the diagram: its space token by its step (`l` of `app-space-l`), a 0 muted, a value off the scale flagged. */
function SideValue({ m }: { m: Measure }) {
  if (m.token) return <TokenLink name={m.token} label={m.token.replace(/^app-space-/, '')} suffix="" />;
  if (m.px === 0) return <span className={styles.muted}>0</span>;
  return (
    <span style={{ color: 'var(--ui-amber-text)' }} title="Off the scale: no token">
      ⚠ {m.px}
    </span>
  );
}

/**
 * A number as it came about: set in the code (a width, a position) in the text's color, worked out by the layout
 * (filling, hugging, placed by the parent) lighter. The tooltip says which. Only numbers: how a box is sized (Width,
 * Height: MainAxisSize.min, stretch) is declared, and reads as any value.
 */
function Measured({ set, why, children }: { set: boolean; why?: string; children: ReactNode }) {
  return (
    <span className={set ? undefined : styles.computed} title={`${set ? 'Set' : 'Worked out by the layout'}${why ? `: ${why}` : ''}`}>
      {children}
    </span>
  );
}

/** A row's picture: a Material Symbol by name, or a glyph (InspectGlyphs). */
type Pic = string | ReactNode;

function Key({ k, icon }: { k: string; icon?: Pic }) {
  if (icon == null) return <span className={styles.k}>{k}</span>;
  return (
    <span className={`${styles.k} ${styles.kIcon}`}>
      <span>{typeof icon === 'string' ? <Icon name={icon} size={14} /> : icon}</span>
      {k}
    </span>
  );
}

function Row({ k, v, mono, icon }: { k: string; v: string; mono?: boolean; icon?: Pic }) {
  return (
    <>
      <Key k={k} icon={icon} />
      <span className={`${styles.v} ${mono ? styles.mono : ''}`}>{v}</span>
    </>
  );
}

/** rgb()/rgba() → #RRGGBB, with the alpha as a share when it isn't opaque (#000000 · 12%). */
function hex(color: string): string {
  // color-mix() computes to color(srgb r g b / a), channels 0–1.
  const c = color.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  const m = c ? [c[0], ...[c[1], c[2], c[3]].map((v) => String(Math.round(Number(v) * 255))), c[4]] : color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return color;
  const h = '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return m[4] != null && Number(m[4]) < 1 ? `${h} · ${Math.round(Number(m[4]) * 100)}%` : h;
}

/**
 * A color by where the code takes it from (colorSource): the token by its name in the code (a link to it in Tokens) with
 * its value, and its Figma variable under it; ⚠ when only Figma has the token, or when the code writes the value itself. When no rule names it (a default,
 * a value set from script), the tokens with the same value, as a guess.
 */
function ColorRow({ k, icon, el, prop, color, theme, role }: { k: string; icon?: Pic; el: Element; prop: ColorProp; color: string; theme: 'light' | 'dark'; role: ColorRole }) {
  const src = colorSource(el, prop, theme);
  const value = hex(color);
  const warn = (text: string, title: string) => (
    <span style={{ display: 'block', color: 'var(--ui-amber-text)' }} title={title}>
      ⚠ {text}
    </span>
  );
  return (
    <>
      <Key k={k} icon={icon} />
      <span className={styles.v}>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ width: 14, height: 14, marginTop: 1, flex: 'none', borderRadius: 3, background: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }} />
          <span style={{ minWidth: 0 }}>
            {src.kind === 'code' || src.kind === 'figma' ? (
              <>
                {/* The name the code writes first, Figma's as the reference under it. */}
                {/* At an opacity: the token at that share, in any stack. */}
                <TokenLink
                  name={src.token.name}
                  label={`${src.token.code ?? src.token.figma}${src.alpha == null ? '' : ` · ${Math.round(src.alpha * 100)}%`}`}
                  suffix={` (${value})`}
                />
                {/* Only when a code connector says how the code names its tokens: without one, nothing is missing. */}
                {src.kind === 'figma' && TOKENS_CODE_LINKED && warn('Not in the code', 'The code has no token for this one yet: one to add')}
                {src.token.code && FIGMA_LINKED && (
                  <span className={`${styles.mono} ${styles.muted}`} style={{ display: 'block' }}>
                    <span className={styles.nameTag}>Figma</span>
                    {src.token.figma}
                    {src.alpha != null && ` · ${Math.round(src.alpha * 100)}%`}
                  </span>
                )}
              </>
            ) : src.kind === 'raw' ? (
              <>
                <span className={styles.mono}>{value}</span>
                {warn('No token', src.via ? `${src.via} is a value of its own in theme.css, not a token` : src.value.startsWith('var(') ? `${src.value} isn't a token` : `Written as a value in the stylesheet (${src.value}), not a token`)}
              </>
            ) : (
              <>
                <span className={styles.mono}>{value}</span>
                {colorTokens(color, theme, role)
                  .filter((t) => findToken(t))
                  .slice(0, 2)
                  .map((t) => (
                    <span key={t} style={{ display: 'block' }} title="Same value: no rule names this color">
                      <span className={styles.muted}>≈ </span>
                      <TokenLink name={t} />
                    </span>
                  ))}
              </>
            )}
          </span>
        </span>
      </span>
    </>
  );
}

/**
 * A text's style as the app has it: the code's text style by the widget the app writes it with
 * (`Text.bodyM`, over the theme's TextStyle; a text style in Figma), a link to it in Tokens, its Figma name and its values under it. The style the code
 * names (`font: var(--app-font-body)`), with a weight set over it as a copyWith; with none named, the styles its values
 * are (all of those that share them, labelXs and captionXs), marked ≈. A size of its own, flagged.
 */
function TextStyleRow({ el, cs }: { el: Element; cs: CSSStyleDeclaration }) {
  const src = declaredTextStyle(el);
  const found = src.style ? [src.style] : src.declared ? [] : textStylesOf(cs);
  const font = cs.fontFamily.split(',')[0].replace(/["']/g, '');
  const values = `${font} ${cs.fontWeight} · ${parseFloat(cs.fontSize)} / ${Math.round(parseFloat(cs.lineHeight) * 100) / 100}`;
  if (!found.length) {
    return (
      <>
        <Key k="Style" icon="text_format" />
        <span className={styles.v}>
          <span style={{ display: 'block', color: 'var(--ui-amber-text)' }} title={src.declared ? 'Its rule sets a size of its own, not a text style (a size listed as an exception)' : "Its size, line height and weight aren't one of the code's text styles"}>
            ⚠ Not a text style
          </span>
          <span className={styles.mono}>{values}</span>
        </span>
      </>
    );
  }
  const [s, ...same] = found;
  return (
    <>
      <Key k="Style" icon="text_format" />
      <span className={styles.v}>
        {!src.style && <span className={styles.muted} title="No rule names its style: told by its values">≈ </span>}
        {/* What the app writes it with (a code connector's name for it), its style's name in the code in the tooltip. */}
        <span title={s.widget === s.name ? s.name : `Written with ${s.widget}; its style in the code is ${s.code}`}>
          <TokenLink name={s.name} label={s.widget} />
        </span>
        {src.weight != null && (
          <span className={styles.mono} style={{ display: 'block' }} title="A weight set over the style">
            weight {src.weight}, over the style
          </span>
        )}
        {same.length > 0 && (
          <span className={`${styles.mono} ${styles.muted}`} style={{ display: 'block' }} title="Same size, line height and weight: either one">
            = {same.map((x) => x.widget).join(', ')}
          </span>
        )}
        {/* Figma's name for it, a note: only with a Figma file connected. */}
        {FIGMA_LINKED && (
          <span className={`${styles.mono} ${styles.muted}`} style={{ display: 'block' }}>
            <span className={styles.nameTag}>Figma</span>
            {[s, ...same].map((x) => x.figma).join(', ')}
          </span>
        )}
        <span className={`${styles.mono} ${styles.muted}`} style={{ display: 'block' }}>
          {values}
        </span>
      </span>
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={styles.btn}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      <Icon name={done ? 'check' : 'content_copy'} size={14} />
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/** First element (self included) with a non-empty text node of its own, skipping icon glyphs. */
function firstTextElement(el: HTMLElement): HTMLElement | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!n.textContent?.trim() || !parent) continue;
    if (getComputedStyle(parent).fontFamily.includes('Material Symbols')) continue;
    return parent;
  }
  return null;
}

/** Padding as CSS shorthand values (["16px"], ["8px", "16px"]…); null when all zero. */
function box(cs: CSSStyleDeclaration, prop: 'padding'): string[] | null {
  const [t, r, b, l] = (['Top', 'Right', 'Bottom', 'Left'] as const).map((s) => cs[`${prop}${s}`]);
  if ([t, r, b, l].every((v) => v === '0px')) return null;
  if (t === b && r === l) return t === r ? [t] : [t, r];
  return [t, r, b, l];
}

/** The flex / grid gap (row and column when they differ); null when none. */
function gap(cs: CSSStyleDeclaration): string[] | null {
  if (cs.rowGap === 'normal' && cs.columnGap === 'normal') return null;
  const [row, col] = [cs.rowGap, cs.columnGap].map((v) => (v === 'normal' ? '0px' : v));
  if (row === '0px' && col === '0px') return null;
  return row === col ? [row] : [row, col];
}

function fmt(v: unknown): string {
  if (typeof v === 'string') return `'${v}'`;
  if (typeof v === 'function') return 'ƒ()';
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (v && typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v);
}

/** A prop's value in braces: an element as `<…/>`, data as JSON (what can't be written, as …). */
function jsxValue(v: unknown): string {
  if (v && typeof v === 'object' && '$$typeof' in v) return '<…/>';
  try {
    return JSON.stringify(v) ?? '…';
  } catch {
    return '…';
  }
}

/** A component as JSX writes it (the mirror's): strings as attributes, anything else in braces, functions elided. */
function jsxCall(name: string, props: ComponentProps): string {
  const attr = ([k, v]: [string, unknown]) =>
    typeof v === 'string' ? `${k}="${v.replace(/"/g, '&quot;')}"` : v === true ? k : typeof v === 'function' ? `${k}={() => {}}` : `${k}={${jsxValue(v)}}`;
  const attrs = Object.entries(props).filter(([, v]) => v != null && v !== false && typeof v !== 'symbol').map(attr);
  if (!attrs.length) return `<${name} />`;
  const line = `<${name} ${attrs.join(' ')} />`;
  return line.length <= 60 ? line : `<${name}\n${attrs.map((a) => `  ${a}`).join('\n')}\n/>`;
}

/** rgb()/rgba() → Color(0xAARRGGBB). */
function codeColor(s: string): string | null {
  const m = s.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return null;
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const a = Math.round((m[4] == null ? 1 : Number(m[4])) * 255);
  return `Color(0x${hex(a)}${hex(+m[1])}${hex(+m[2])}${hex(+m[3])})`;
}

/** A value that is already code: an icon (`Symbols.sort`) or an enum value (`IconSize.small`). */
const CODE_CONSTANT = /^(Symbols|Icons|IconSize|FontWeight|TextOverflow)\.\w+$/;

function codeValue(v: unknown): string {
  if (typeof v === 'string' && CODE_CONSTANT.test(v)) return v;
  if (typeof v === 'string' && codeColor(v)) return codeColor(v)!;
  if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
  if (typeof v === 'function') return '() {}';
  if (Array.isArray(v)) return `[${v.map(codeValue).join(', ')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `'${k}': ${codeValue(x)}`).join(', ')}}`;
  return String(v);
}

/** The constructor call as the code writes it: `positional` parameters first, by position. */
export function codeCall(name: string, props: ComponentProps, positional: string[] = [], /** Parameters a proposal adds, by its code: last, marked. */ proposed: Record<string, string> = {}): string {
  const entries = Object.entries(props).filter(([, v]) => v != null);
  if (!entries.length) return `${name}()`;
  const byPosition = positional.filter((k) => props[k] != null).map((k) => `  ${codeValue(props[k])},`);
  const named = entries
    .filter(([k]) => !positional.includes(k))
    .sort(([a], [b]) => Number(a in proposed) - Number(b in proposed))
    .map(([k, v]) => `  ${k}: ${codeValue(v)},${k in proposed ? ` // ${proposed[k]} adds it` : ''}`);
  return `${name}(\n${[...byPosition, ...named].join('\n')}\n)`;
}
