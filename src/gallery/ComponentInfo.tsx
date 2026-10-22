// A component's page in the gallery, in the right panel beside its examples: what a designer or a developer needs to
// work with it, in cards — where it's used in the app (each place opens the page and points at it), the implementation
// notes (Figma mapping, differences, to-dos, notes) and the links (Info tab); its props, the code's parameters with
// the selected example's values (Props tab, under the controls).
import { useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { ProgressLine, Spinner } from '../components/Loading';
import { paramReview, widgetReview, type ReviewNote } from '../design/apiReview';
import { CATALOG, figmaUrl, catalogUrl } from '../design/catalog';
import { figmaComponent, FIGMA, mappingsFor } from '../design/figma';
import { apiContrast } from '../design/handoff';
import { componentState } from '../design/componentState';
import { componentIcon } from '../design/element';
import { acceptanceOf, propDecl } from '../design/simulatorProps';
import { useProposalParam } from '../tools/ProposalPanel';
import { useLibrary, type ApiParam } from '../design/library';
import { controlFor, type Args, type StoryModule } from '../design/stories';
import { useReceivedProps } from './receivedProps';
import { useNavRoot } from '../nav/context';
import { pageIcon, pageName } from '../nav/stack';
import { locate } from '../sim/locate';
import { nesting, usePageIndex, useScanProgress, type PagePlace } from '../sim/pageIndex';
import { openSheetLink, sheetLabel } from '../sim/sheetLinks';
import { useUrlParams } from '../sim/SimContext';
import { compress } from './FigmaInfo';
import { useGalleryNav } from './route';
import { PanelSection } from '../tools/PanelSection';
import styles from './ComponentInfo.module.css';
import { plural, t } from '../i18n/ui';

/** The Info tab (Components, right panel): where it's used, the implementation notes, the links. */
export function ComponentInfo({ mod }: { mod: StoryModule<Args> }) {
  return (
    <>
      <Status name={mod.component} />
      <UsedIn name={mod.component} />
      <Notes name={mod.component} />
      <Links name={mod.component} />
    </>
  );
}

/**
 * A part of the page: a section of the right panel, opened and closed from its title (as Inspect's). `id`: the English
 * name it's remembered by (open or closed), whatever the interface's language.
 */
function Card({ id, title, icon, aside, children }: { id: string; title: string; icon: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <PanelSection id={`component-${id}`} title={title} icon={icon} aside={aside}>
      {children}
    </PanelSection>
  );
}

// ---------------------------------------------------------------- Status

/**
 * Where it stands against the code, in its dot's color (on Info's tab and beside it in Components), and why: each open
 * difference, then the ones accepted as they are (declared beside the component, `declareProps` `accepted`).
 */
export function Status({ name }: { name: string }) {
  const lib = useLibrary();
  const [, setProposal] = useProposalParam();
  const state = lib && componentState(name, true, lib);
  return (
    <Card id="status" title={t('Status')} icon="flag">
      {state ? (
        <>
          <div className={styles.state} style={{ '--state': state.color } as React.CSSProperties}>
            <span className={styles.stateLabel}>{state.label}</span>
            {state.summary && <span>{state.summary}</span>}
            {state.reasons.length > 0 && (
              <ul className={styles.reasons}>
                {state.reasons.map((r) => (
                  <li key={r.key}>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {state.where && (
              <div className={styles.where}>
                <span className={styles.whereHead}>{t('Where in the app')}</span>
                <span>{state.where.widget}</span>
                {state.where.files.map((f) => (
                  <span key={f} className={styles.mono}>
                    {f}
                  </span>
                ))}
              </div>
            )}
            {state.proposals && state.proposals.length > 0 && (
              <div className={styles.where}>
                <span className={styles.whereHead}>{t('Specified in')}</span>
                {state.proposals.map((p) => (
                  <button key={p.code} className={styles.proposalLink} title={t('Open the proposal')} onClick={() => setProposal(p.code)}>
                    {p.code} · {p.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          {state.accepted.length > 0 && (
            <div className={styles.acceptedList}>
              <span className={styles.usedHead}>{t('Accepted · {n}', { n: state.accepted.length })}</span>
              {state.accepted.map((d) => (
                <div key={d.key} className={styles.acceptedItem}>
                  <Icon name="check_circle" size={14} />
                  <span>
                    <span className={styles.acceptedText}>{d.text}</span>
                    <span className={styles.acceptedWhy}>
                      {d.acceptance.reason} · {d.acceptance.by}, {d.acceptance.on}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <Spinner size={12} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Props

/** The control that edits one of the example's props (the Props tab's), or nothing for one it can't edit; `param`, its
 * parameter in the code (whether it can be null). */
export type FieldFor = (key: string, param?: ApiParam) => ReactNode | null;

/** A default as the app writes it, without its enum's name: `small` for `AvatarSize.small`. */
// A default that's a constant of the package's (`LogoConstraints.defaultWidth`) names no value: left out.
export const defaultLabel = (p: ApiParam) =>
  p.default != null && !/^[A-Z]\w*(Constraints|Styles|Sizes|Constants|Dimensions)\./.test(p.default) ? t('default {value}', { value: p.default.replace(/^[A-Z]\w*\./, '') }) : '';

/** A parameter's type (a nullable `?` dropped: nullable reads from its control) and its default, for a row with no control. */
export function typeLabel(p: ApiParam): string {
  const type = (p.type ?? 'dynamic').replace(/\?$/, '');
  const d = defaultLabel(p);
  return d ? `${type} · ${d}` : type;
}

/** A parameter the app passes a function to (onPressed, onChanged): the screen's, nothing to set here. */
const isCallback = (type: string | null) => !!type && /Function\(|Callback\b|^ValueChanged|^ValueSetter|^Gesture\w*Callback/.test(type);

/**
 * The props of the selected example, each with its control to change it (`field`) or its value: the code's
 * parameters (the names the app uses), then the props the simulator has that the widget doesn't — those a proposal
 * adds (tagged with its code), those it differs by (to agree on), the simulator's alone. The callbacks go last, in a
 * section of their own: the screen sets them, the examples only log them. A component not in the code shows the
 * simulator's props.
 */
export function Props({ mod, story, args, field, reset }: { mod: StoryModule<Args>; story: string; args: Args; field?: FieldFor; reset?: ReactNode }) {
  const lib = useLibrary();
  const widget = lib?.widget(mod.component);
  // What the component got in the examples (null until drawn): an arg it didn't get only sets the example up.
  const received = useReceivedProps(mod.component, [story, JSON.stringify(args)]);
  const value = (k: string, set = args[k] != null, param?: ApiParam) => field?.(k, param) ?? (set ? <span className={styles.mono}>{fmt(args[k])}</span> : <span className={styles.muted}>—</span>);
  const typeOf = (k: string) => controlFor(mod, k)?.type ?? typeof mod.args[k];
  if (!lib) return <Card id="props" title="Props" icon="tune">{<Spinner size={12} />}</Card>;
  if (!widget) {
    return (
      <Card id="props" title="Props" icon="tune" aside={<>{t('simulator · not in the code')}{reset}</>}>
        {field && <span className={styles.editing}>{t('“{story}” · click another example to edit it', { story })}</span>}
        <div className={styles.params}>
          {Object.keys(mod.args).map((k) => (
            <Param key={k} name={k} type={field ? '' : typeOf(k)} value={value(k)} />
          ))}
        </div>
      </Card>
    );
  }
  const paramNames = new Set(widget.params.map((p) => p.name));
  // The example's own controls: args the component doesn't receive (a switch that adds a callback, a child's text), not
  // its parameters, not a value that names a constructor. Listed apart, never as a difference.
  const exampleOnly = received
    ? Object.keys(mod.args).filter((k) => !paramNames.has(k) && !received.has(k) && !widget.constructors.includes(`${widget.name}.${String(args[k])}`))
    : [];
  const { params, constructor, proposed, simulator, extra, accepted } = apiContrast(
    widget,
    Object.fromEntries(Object.entries(args).filter(([k]) => !exampleOnly.includes(k))),
    mod.component,
  );
  const inputs = params.filter((p) => !isCallback(p.type));
  // The simulator's component takes only some of them (its story's args): the rest are listed last, to build.
  const taken = inputs.filter((p) => p.name in mod.args);
  const notTaken = inputs.filter((p) => !(p.name in mod.args));
  const callbacks = params.filter((p) => isCallback(p.type));
  // Props that are none of these choose the constructor (a variant naming one): edited here too.
  const listed = new Set([...params.map((p) => p.name), ...proposed.map((p) => p.name), ...simulator, ...extra, ...accepted]);
  const choosers = Object.keys(mod.args).filter((k) => !listed.has(k) && !exampleOnly.includes(k) && controlFor(mod, k));
  const why = propDecl(mod.component);
  return (
    <>
      <Card id="props" title="Props" icon="tune" aside={<>{plural(inputs.length, 'code · {n} parameter', 'code · {n} parameters')}{reset}</>}>
        <div className={styles.ctors}>
          {widget.constructors.map((c) => (
            <span key={c} className={`${styles.chip} ${c === (constructor ?? widget.name) ? styles.chipOn : ''}`} title={c === (constructor ?? widget.name) ? t('“{story}” uses this constructor', { story }) : undefined}>
              {c.replace(widget.name, '') || widget.name}
            </span>
          ))}
        </div>
        <Review note={widgetReview(widget)} />
        {field && <span className={styles.editing}>{t('“{story}” · click another example to edit it', { story })}</span>}
        <div className={styles.params}>
          {choosers.map((k) => (
            <Param key={k} name={k} type={t('the constructor')} value={value(k)} />
          ))}
          {taken.map((p) => (
            <Param key={p.name} name={p.name} strong={p.required} badge={<ParamBadges p={p} />} type={field ? defaultLabel(p) : typeLabel(p)} mono note={<Review note={paramReview(widget, p)} />} value={value(p.name, p.set, p)} />
          ))}
          {proposed.map((p) => (
            <Param key={p.name} name={p.name} extra badge={<span className={styles.proposed} title={t('Not in the widget yet: {proposal} adds it (its handoff.md)', { proposal: p.proposal })}>{p.proposal}</span>} type={field ? '' : typeOf(p.name)} value={value(p.name)} />
          ))}
          {extra.map((k) => (
            <Param key={k} name={k} extra badge={<span className={styles.differs} title={why.differs?.[k] ?? t('The widget has no parameter for it: to agree on with design and the app')}>{t('differs')}</span>} type={field ? '' : typeOf(k)} value={value(k)} />
          ))}
          {accepted.map((k) => (
            <Param key={k} name={k} badge={<span className={styles.acceptedBadge} title={t('Accepted as it is: {reason}', { reason: acceptanceOf(mod.component, k)?.reason ?? '' })}>{t('accepted')}</span>} type={field ? '' : typeOf(k)} value={value(k)} />
          ))}
          {simulator.map((k) => (
            <Param key={k} name={k} badge={<span className={styles.simOnly} title={t('Only the simulator needs it: not a difference, not in the handoff')}>{t('simulator')}</span>} type={field ? '' : typeOf(k)} value={value(k)} note={why.simulator?.[k] && <span className={styles.paramNote}>{why.simulator[k]}</span>} />
          ))}
        </div>
        {exampleOnly.length > 0 && (
          <>
            <span className={styles.paramsGroup} title={t("The simulator's controls for the examples, not props of {component}: they set the example up (which callbacks it gets, a child's text, whether it's open)", { component: mod.component })}>
              {t('Simulator controls · {n}', { n: exampleOnly.length })}
            </span>
            <div className={styles.params}>
              {exampleOnly.map((k) => (
                <Param key={k} name={k} badge={<span className={styles.simOnly} title={t("Only the simulator's: it sets the example up, the component doesn't receive it")}>{t('simulator')}</span>} type={field ? '' : typeOf(k)} value={value(k)} />
              ))}
            </div>
          </>
        )}
        {notTaken.length > 0 && (
          <>
            <span className={styles.paramsGroup} title={t("The simulator's {component} doesn't take these yet: they can't be set here", { component: mod.component })}>
              {t('Not in the simulator yet · {n}', { n: notTaken.length })}
            </span>
            <div className={styles.params}>
              {notTaken.map((p) => (
                <Param key={p.name} name={p.name} strong={p.required} badge={<ParamBadges p={p} />} type={typeLabel(p)} mono muted note={<Review note={paramReview(widget, p)} />} />
              ))}
            </div>
          </>
        )}
      </Card>
      {callbacks.length > 0 && (
        <Card id="callbacks" title="Callbacks" icon="bolt" aside={t('set by the screen')}>
          <div className={styles.params}>
            {callbacks.map((p) => (
              <Param key={p.name} name={p.name} strong={p.required} badge={<ParamBadges p={p} />} type={typeLabel(p)} mono note={<Review note={paramReview(widget, p)} />} />
            ))}
          </div>
          <span className={styles.muted} style={{ display: 'block', marginTop: 8, fontSize: 11, lineHeight: '15px' }}>
            {t('The examples show each call beside their name when it fires.')}
          </span>
        </Card>
      )}
    </>
  );
}

/** A parameter's badges: required, and deprecated (`@Deprecated` in the code). */
function ParamBadges({ p }: { p: ApiParam }) {
  return (
    <>
      {p.required && <span className={styles.req}>{t('required')}</span>}
      {p.deprecated && (
        <span className={styles.req} title={t('Deprecated in the code: still there, not for new code')}>
          {t('deprecated')}
        </span>
      )}
    </>
  );
}

/** One prop: its name (and badge), its type under it, and on the right its control or value. */
function Param({ name, type, value, badge, note, strong, mono, extra, muted }: { name: string; type: string; value?: ReactNode; badge?: ReactNode; note?: ReactNode; strong?: boolean; mono?: boolean; extra?: boolean; muted?: boolean }) {
  return (
    <div className={`${styles.param} ${extra ? styles.paramExtra : ''} ${value === undefined ? styles.paramWide : ''} ${muted ? styles.paramMuted : ''}`}>
      <div className={styles.paramName}>
        <span>
          <span className={styles.mono} style={{ fontWeight: strong ? 600 : 400 }}>
            {name}
          </span>
          {badge}
        </span>
        {type && <span className={`${styles.type} ${mono ? styles.mono : ''}`}>{type}</span>}
        {note}
      </div>
      {value !== undefined && <div className={styles.paramValue}>{value}</div>}
    </div>
  );
}

/** A naming note on the API: what's off and the name to use. */
function Review({ note }: { note?: ReviewNote }) {
  if (!note) return null;
  return (
    <span className={styles.review}>
      ⚑ {note.issue}
      {note.suggest && <span className={styles.mono}> → {note.suggest}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- Used in

/**
 * The pages (and variants) it's on as they load, and the sheets those pages open, from the page index; a place opens
 * the page (and the sheet) and points at it.
 */
function UsedIn({ name }: { name: string }) {
  const get = useUrlParams();
  const design = get('proposal') ?? 'live';
  const index = usePageIndex(design, true);
  const scanning = useScanProgress(design);
  const nav = useNavRoot();
  const { openComponent } = useGalleryNav();
  const places = index?.[name] ?? [];
  const all = nesting(places);
  // On the pages themselves (each place counting only what isn't inside another component), one row per page with
  // its variants as chips; what's inside a component is that component's row.
  const pages = new Map<string, PagePlace[]>();
  // In a page's sheet: one row per page and sheet (its first variant's).
  const sheets = new Map<string, PagePlace>();
  for (const p of places) {
    if (p.sheet) {
      const own = (p.count ?? 1) - Object.values(p.inside ?? {}).reduce((a, b) => a + b, 0);
      const key = `${p.id} ${p.sheet}`;
      if (own > 0 && !sheets.has(key)) sheets.set(key, { ...p, count: own });
      continue;
    }
    const own = (p.count ?? 1) - Object.values(p.inside ?? {}).reduce((a, b) => a + b, 0);
    if (own > 0) pages.set(p.id, [...(pages.get(p.id) ?? []), { ...p, count: own, inside: undefined }]);
  }
  const pageCount = new Set(places.map((p) => p.id)).size;
  const open = (p: PagePlace) => {
    locate(name);
    nav.open(p.id, p.params);
    if (p.sheet) openSheetLink(p.sheet);
  };
  return (
    <Card id="used-in" title={t('Used in')} icon="account_tree" aside={index ? plural(pageCount, '{n} page', '{n} pages') : undefined}>
      {!index ? (
        <div className={styles.loading}>
          <span>
            <Spinner size={12} /> {scanning != null ? t("Finding the pages it's on · {pct}%", { pct: Math.round(scanning * 100) }) : t("Finding the pages it's on…")}
          </span>
          <ProgressLine value={scanning ?? 0} />
        </div>
      ) : !places.length ? (
        <p className={styles.muted}>{t('Not on a page as it loads, nor in a sheet a page declares (it may be in a dialog, a state or a sheet not declared).')}</p>
      ) : (
        <>
          {all.inside.length > 0 && (
            <>
              <span className={styles.usedHead}>{t('In components · {n}', { n: all.inside.length })}</span>
              <div className={styles.places}>
                {all.inside.map(([parent, n]) => (
                  <button key={parent} className={styles.place} onClick={() => openComponent(parent)} title={t('{times} inside {parent} across the pages: open {parent}', { times: times(n), parent })}>
                    <Icon name={componentIcon(parent)} size={14} className={styles.placeIcon} />
                    <span>{parent}</span>
                    <Times n={n} />
                    <Icon name="arrow_forward" size={14} />
                  </button>
                ))}
              </div>
            </>
          )}
          {sheets.size > 0 && (
            <>
              <span className={styles.usedHead}>{t('In sheets · {n}', { n: sheets.size })}</span>
              <div className={styles.places}>
                {[...sheets.values()].map((p) => (
                  <button key={`${p.id} ${p.sheet}`} className={styles.place} onClick={() => open(p)} title={t('Open {page} with its {sheet} sheet', { page: pageName(nav.pages, p.id), sheet: sheetLabel(p.sheet!) })}>
                    <Icon name={pageIcon(nav.pages[p.id])} size={14} className={styles.placeIcon} />
                    <span>
                      {pageName(nav.pages, p.id)}
                      <span className={styles.muted}> · {sheetLabel(p.sheet!)}</span>
                    </span>
                    <Times n={p.count} />
                    <Icon name="arrow_forward" size={14} />
                  </button>
                ))}
              </div>
            </>
          )}
          <span className={styles.usedHead}>{t('On pages · {n}', { n: pages.size })}</span>
          {pages.size ? (
            <div className={styles.places}>
              {[...pages].map(([id, list]) =>
                list.length === 1 && !list[0].label ? (
                  <button key={id} className={styles.place} onClick={() => open(list[0])} title={t('Open {page} and point at {name}', { page: pageName(nav.pages, id), name })}>
                    <Icon name={pageIcon(nav.pages[id])} size={14} className={styles.placeIcon} />
                    <span>{pageName(nav.pages, id)}</span>
                    <Times n={list[0].count} />
                    <Icon name="arrow_forward" size={14} />
                  </button>
                ) : (
                  <Variants key={id} icon={pageIcon(nav.pages[id])} title={pageName(nav.pages, id)} list={list} onOpen={open} />
                ),
              )}
            </div>
          ) : (
            <p className={styles.muted}>{sheets.size ? t('Not on a page itself: only in its sheets.') : t('Never on its own: always inside a component.')}</p>
          )}
        </>
      )}
    </Card>
  );
}

/** A page with the component in several of its variants: the first opens it, the rest show on demand. */
function Variants({ icon, title, list, onOpen }: { icon: string; title: string; list: PagePlace[]; onOpen: (p: PagePlace) => void }) {
  const [all, setAll] = useState(false);
  const SHOWN = 6;
  return (
    <div className={styles.placeGroup}>
      <button className={styles.place} onClick={() => onOpen(list[0])}>
        <Icon name={icon} size={14} className={styles.placeIcon} />
        <span>
          {title}
          <span className={styles.muted}> · {plural(list.length, '{n} variant', '{n} variants')}</span>
        </span>
        <span className={styles.times}>{eachTimes(list)}</span>
        <Icon name="arrow_forward" size={14} />
      </button>
      <div className={styles.variants}>
        {(all ? list : list.slice(0, SHOWN)).map((p) => (
          <button key={p.label} className={styles.chip} onClick={() => onOpen(p)} title={times(p.count)}>
            {p.label}
            {(p.count ?? 1) > 1 && <span className={styles.chipCount}>×{p.count}</span>}
          </button>
        ))}
        {!all && list.length > SHOWN && (
          <button className={`${styles.chip} ${styles.more}`} onClick={() => setAll(true)}>
            +{list.length - SHOWN}
          </button>
        )}
      </div>
    </div>
  );
}

const times = (n = 1) => plural(n, 'once', '{n} times');

/** Across a page's variants: "once each" when they all have the same, else the total. */
function eachTimes(list: PagePlace[]): string {
  const counts = list.map((p) => p.count ?? 1);
  return counts.every((c) => c === counts[0]) ? t('{times} each', { times: times(counts[0]) }) : t('{n} times in all', { n: counts.reduce((a, b) => a + b, 0) });
}

/** How many times it's on a page. */
function Times({ n }: { n?: number }) {
  return <span className={styles.times}>{times(n)}</span>;
}

// ---------------------------------------------------------------- Notes

/** How the code relates to Figma: its component, options, differences, to-dos (the gallery's Info and Inspect). */
export function Notes({ name }: { name: string }) {
  const maps = mappingsFor(name);
  const figma = maps.length ? figmaComponent(maps[0].figma) : FIGMA.get(name);
  // A mapping to a Figma component: its text is how the code differs from it. Without one (code only), it's what the
  // component is: one paragraph, About. The story's own note is the developers' (its API is in Props): not repeated.
  const inFigma = (m: { figma: string | null }) => !!m.figma && m.figma !== '—';
  const diffs = maps.filter(inFigma).flatMap((m) => sentences(m.diff));
  const about = maps.filter((m) => !inFigma(m) && m.diff).map((m) => m.diff);
  const todo = maps.flatMap((m) => m.todo);
  if (!maps.length && !figma) return null;
  return (
    <Card id="notes" title={t('Notes')} icon="sticky_note_2">
      {maps.filter(inFigma).map((m) => (
        <div key={m.code} className={styles.mapping}>
          <span className={styles.label}>Figma</span>
          <span className={styles.mono}>{m.figma}</span>
        </div>
      ))}
      {about.length > 0 && (
        <div className={styles.mapping}>
          <span className={styles.label}>{t('About')}</span>
          {about.map((t) => (
            <p key={t} className={styles.about}>
              {t}
            </p>
          ))}
        </div>
      )}
      {figma && (figma.props.length > 0 || !!figma.variants?.length) && (
        <div className={styles.mapping}>
          <span className={styles.label}>{t('Options')}</span>
          <div className={styles.options}>
            {compress(figma.props).map((p) => (
              <div key={p.name} className={styles.option}>
                <span className={styles.optionName}>{p.name}</span>
                {p.type === 'variant' ? (
                  <span className={styles.chips}>
                    {p.options!.map((o) => (
                      <span key={o} className={styles.chip}>
                        {o}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={styles.muted}>{p.type === 'bool' ? t('on / off') : p.type}</span>
                )}
              </div>
            ))}
            {figma.variants && <span className={styles.muted}>{plural(figma.variants.length, '{n} variant in Figma', '{n} variants in Figma')}</span>}
          </div>
        </div>
      )}
      {diffs.length > 0 && (
        <div className={styles.mapping}>
          <span className={styles.label}>{t('Differences')}</span>
          <ul className={styles.bullets}>
            {diffs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      {todo.length > 0 && (
        <div className={styles.mapping}>
          <span className={styles.label}>{t('To do')}</span>
          <ul className={styles.todo}>
            {todo.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** A paragraph as its sentences (the notes are written as runs of short facts). */
const sentences = (text?: string) =>
  // Not after an abbreviation ("incl.", "e.g.", "vs."), nor inside parentheses: a sentence ends at the top level.
  text ? text.split(/(?<!\b(?:incl|e\.g|i\.e|etc|vs|approx))(?<=[.;])(?![^(]*\))\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean) : [];

// ---------------------------------------------------------------- Links

/** Where else the component lives: the component catalog (each use case), Figma, the code's file. */
function Links({ name }: { name: string }) {
  const entry = CATALOG.get(name);
  const lib = useLibrary();
  const widget = lib?.widget(name);
  const fig = figmaComponent(mappingsFor(name)[0]?.figma ?? null) ?? FIGMA.get(name);
  const figUrl = fig?.figmaUrl ?? (entry && figmaUrl(entry));
  if (!entry && !figUrl && !widget) return null;
  return (
    <Card id="links" title={t('Links')} icon="link">
      <div className={styles.links}>
        {figUrl && (
          <a className={styles.link} href={figUrl} target="_blank" rel="noreferrer">
            <Icon name="design_services" size={16} />
            <span>
              Figma
              <span className={styles.muted}> · {fig?.name ?? name}</span>
            </span>
            <Icon name="open_in_new" size={14} />
          </a>
        )}
        {entry && (
          <>
            <a className={styles.link} href={catalogUrl(entry)} target="_blank" rel="noreferrer">
              <Icon name="menu_book" size={16} />
              <span>{t('Catalog')}</span>
              <Icon name="open_in_new" size={14} />
            </a>
            {entry.useCases.length > 1 && (
              <div className={styles.variants} style={{ paddingLeft: 30 }}>
                {entry.useCases.map((u) => (
                  <a key={u.name} className={styles.chip} href={catalogUrl(entry, u.name)} target="_blank" rel="noreferrer">
                    {u.name}
                  </a>
                ))}
              </div>
            )}
          </>
        )}
        {widget && <CopyPath path={widget.file} />}
      </div>
    </Card>
  );
}

function CopyPath({ path }: { path: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={styles.link}
      title={t("Copy the file's path in the code")}
      onClick={() => {
        void navigator.clipboard?.writeText(path);
        setDone(true);
        window.setTimeout(() => setDone(false), 1200);
      }}
    >
      <Icon name="code" size={16} />
      <span className={styles.path}>
        {t('Code')}
        <span className={`${styles.muted} ${styles.mono}`}> · {path}</span>
      </span>
      <Icon name={done ? 'check' : 'content_copy'} size={14} />
    </button>
  );
}

/** A value as short text. */
function fmt(v: unknown): string {
  if (v === undefined) return '—';
  if (typeof v === 'function') return 'ƒ';
  if (typeof v === 'string') return `'${v}'`;
  try {
    const s = JSON.stringify(v);
    return s.length > 40 ? s.slice(0, 37) + '…' : s;
  } catch {
    return String(v);
  }
}
