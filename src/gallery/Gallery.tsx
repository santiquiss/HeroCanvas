// Component gallery: every component isolated, all its stories side by side, in the current theme and at
// widths taken from the current device. Inspect, Layers and Controls work on the stories.
import { useLanguage } from '../sim/language';
import { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { CATALOG, catalogUrl } from '../design/catalog';
import { useDesignRoot } from '../design/DesignContext';
import { unreplicated, UNREPLICATED_KIND } from '../design/unreplicated';
import { componentGroups, componentTier, FIGMA, UNUSED_FIGMA, FIGMA_FILE, GROUP_TITLES, MAPPED_FIGMA, type GroupKey } from '../design/figma';
import { type Args, type FrameWidth, type StoryModule } from '../design/stories';
import { ChangeBadge } from '../flow/FlowView';
import { useSim, useUrlParams, useUrlState } from '../sim/SimContext';
import { BASE_PAGES } from '../nav/pages';
import { findProposal, proposalChanges, VARIANT_PARAM } from '../proposals';
import { InspectOverlay } from '../tools/InspectOverlay';
import { FigmaInfo } from './FigmaInfo';
import { useLibrary } from '../design/library';
import { componentKind, isBaseComponent, useGalleryNav, useGalleryRoute, useStories } from './route';
import { UsageStats } from './UsageStats';
import { useStoryArgs } from './useStoryArgs';
import { ErrorBoundary } from '../components/ErrorBoundary';
import styles from './Gallery.module.css';
import { TokensView } from './TokensView';

export function Gallery() {
  const { name, tokens } = useGalleryRoute();
  const { theme } = useSim();
  const language = useLanguage();
  const { setRoot, captureProps, inspect } = useDesignRoot();
  const wrap = useRef<HTMLDivElement>(null);
  const { stories } = useStories();
  const mod = name ? stories.get(name) : undefined;

  return (
    <div ref={wrap} className={styles.wrap}>
      {tokens != null ? (
        // The tokens: the designer's own page, not a screen (no device theme, no Inspect).
        <div className={styles.scroll}>
          <TokensView group={tokens} />
        </div>
      ) : (
        <div className={styles.scroll}>
          <div ref={setRoot} data-theme={theme} lang={language} {...captureProps} className={styles.root} style={{ cursor: inspect ? 'crosshair' : undefined }}>
            {name ? mod ? <ComponentPage key={name} mod={mod} /> : <Missing name={name} /> : <Overview />}
          </div>
        </div>
      )}
      <InspectOverlay stage={wrap} />
    </div>
  );
}

function useFrameWidth() {
  const { layout } = useSim();
  return (w: FrameWidth | undefined): { width?: number; label: string } => {
    if (w === 'auto') return { label: 'auto' };
    if (typeof w === 'number') return { width: w + 32, label: `${w}px` };
    if (w === 'cell') {
      const cell = Math.floor((layout.contentW - 10 * (layout.cols - 1)) / layout.cols);
      return { width: cell + 32, label: `${cell}px · 1 of ${layout.cols} cols` };
    }
    return { width: layout.contentW + 32, label: `${layout.contentW}px · content` };
  };
}

function ComponentPage({ mod }: { mod: StoryModule<Args> }) {
  const changeOf = useChangeOf();
  const { proposalNames } = useStories();
  const entry = CATALOG.get(mod.component);
  const [storyName, setStory] = useUrlState<string>('story', mod.stories[0]?.name ?? '');
  const { argsFor, update } = useStoryArgs(mod);
  const frame = useFrameWidth();
  const [log, setLog] = useState<{ story: string; text: string; n: number } | null>(null);
  const lib = useLibrary();

  return (
    <>
      {/* The name, its tier and change (the examples' theme floats at the canvas's top right, ThemeSwitch): the rest is in the right panel (Info, Props). */}
      <div className={styles.head}>
        <span className={styles.title}>{mod.component}</span>
        <span className={styles.badge}>{componentTier(mod.component, (n) => lib?.widget(n)?.tier) ?? entry?.tier ?? 'local'}</span>
        {proposalNames.has(mod.component) && <ChangeBadge change={changeOf(mod.component)} />}
      </div>
      <div className={styles.stories}>
        {mod.stories.map((s) => {
          const active = s.name === storyName;
          const args = argsFor(s.name);
          const { width, label } = frame(s.width ?? mod.width);
          const ctx = {
            action: (name: string) => (...values: unknown[]) => {
              const text = `${name}(${values.map(formatValue).join(', ')})`;
              setLog((l) => ({ story: s.name, text, n: (l?.n ?? 0) + 1 }));
            },
            update: (patch: Args) => {
              setStory(s.name);
              update(s.name, patch);
            },
          };
          return (
            <section key={s.name} className={`${styles.story} ${active ? styles.storyActive : ''}`} onPointerDown={() => !active && setStory(s.name)}>
              <div className={styles.storyHead}>
                {s.name}
                <span className={styles.dim}>{label}</span>
                {log?.story === s.name && (
                  <span key={log.n} className={styles.action}>
                    {log.text}
                  </span>
                )}
              </div>
              <div className={styles.frame} data-hc-page={s.name} style={{ width }}>
                <ErrorBoundary label={`Story “${s.name}”`} resetKey={JSON.stringify(args)}>
                  <StoryRender render={() => mod.render(args, ctx)} />
                </ErrorBoundary>
              </div>
              {s.note && <span className={styles.storyNote}>{s.note}</span>}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Coverage, Figma first: which components have a web version with stories. */
function Overview() {
  const changeOf = useChangeOf();
  const { openComponent } = useGalleryNav();
  const { stories: STORIES, proposalNames } = useStories();
  const lib = useLibrary();
  const groups = componentGroups(CATALOG.keys(), [...STORIES.keys()].filter((n) => !proposalNames.has(n) || isBaseComponent(n)), (n) => lib?.widget(n)?.tier ?? CATALOG.get(n)?.tier);
  // The Figma components the code uses (not the code map's `unused`: a Tooltip the code never draws).
  const figmaNames = [...FIGMA.keys()].filter((n) => !UNUSED_FIGMA.has(n));
  const built = figmaNames.filter((n) => STORIES.has(n)).length;
  // The components built here (with stories), for the usage stats.
  const builtNames = useMemo(() => [...STORIES.keys()], [STORIES]);
  return (
    <>
      <div className={styles.head}>
        <span className={styles.title}>Components</span>
      </div>
      {/* Coverage against Figma only with its inventory connected (app/connectors). */}
      {figmaNames.length > 0 && (
        <>
          <p className={styles.note} style={{ marginBottom: 0 }}>
            {built} of {figmaNames.length} Figma components built with stories · {FIGMA_FILE.name}, {FIGMA_FILE.exportedAt.slice(0, 10)}. Names and tiers follow Figma.
          </p>
          <div className={styles.meter}>
            <div style={{ width: `${(built / figmaNames.length) * 100}%` }} />
          </div>
        </>
      )}
      <UsageStats built={builtNames} />
      {proposalNames.size > 0 && (
        <div>
          <div className={styles.tier}>In this proposal</div>
          <div className={styles.cards}>
            {[...proposalNames].map((n) => (
              <button key={n} className={styles.card} onClick={() => openComponent(n)}>
                <span className={styles.cardName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {n}
                  <ChangeBadge change={changeOf(n)} />
                </span>
                <span className={styles.dim}>{plural(STORIES.get(n)!.stories.length, 'story', 'stories')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {(Object.keys(groups) as GroupKey[]).map((g) =>
        groups[g].length ? (
          <div key={g}>
            <div className={styles.tier}>{GROUP_TITLES[g]}</div>
            <div className={styles.cards}>
              {[...groups[g]]
                .sort((a, b) => Number(STORIES.has(b)) - Number(STORIES.has(a)) || a.localeCompare(b))
                .map((n) => {
                  const mod = STORIES.get(n);
                  const fig = FIGMA.get(n);
                  return (
                    <button key={n} className={`${styles.card} ${mod ? '' : styles.cardOff}`} onClick={() => openComponent(n)}>
                      <span className={styles.cardName}>{n}</span>
                      <span className={styles.dim}>
                        {mod ? plural(mod.stories.length, 'story', 'stories') : g === 'unreplicated' ? 'not replicated' : 'not built'}
                        {fig?.variants ? ` · ${plural(fig.variants.length, 'Figma variant', 'Figma variants')}` : ''}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null,
      )}
    </>
  );
}

/**
 * What a proposal does to a component: changes one that's live (in the base stories, or in the app's component library),
 * or adds a new one — one the simulator had no component for, even if the library has it (the proposal's `added`:
 * the Proposal panel and the changes chip say the same).
 */
function useChangeOf() {
  const lib = useLibrary();
  const get = useUrlParams();
  const p = findProposal(get('proposal'));
  const added = new Set(p ? proposalChanges(p, get(VARIANT_PARAM), BASE_PAGES).components.filter((c) => c.scope === 'added').map((c) => c.name) : []);
  return (name: string) => (added.has(name) ? 'new' : componentKind(name, lib));
}

function Missing({ name }: { name: string }) {
  const entry = CATALOG.get(name);
  const fig = FIGMA.get(name);
  const skip = unreplicated(name);
  return (
    <>
      <div className={styles.head}>
        <span className={styles.title}>{name}</span>
        {entry && <span className={styles.badge}>{entry.tier}</span>}
      </div>
      <p className={styles.note}>
        {skip ? `Not replicated: ${UNREPLICATED_KIND[skip.kind].toLowerCase()}. ${skip.reason}` : 'Not built yet.'}
        {entry ? ` Catalog use cases: ${entry.useCases.map((u) => u.name).join(', ')}.` : ''}
      </p>
      {fig && !MAPPED_FIGMA.has(name) && (
        <FigmaInfo entries={[]} figmaOnly={fig} />
      )}
      {entry && (
        <a className={styles.link} href={catalogUrl(entry)} target="_blank" rel="noreferrer">
          <Icon name="menu_book" size={14} />
          Open in the catalog
        </a>
      )}
    </>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Renders a story inside its error boundary (the render function runs as a component, so errors are caught). */
function StoryRender({ render }: { render: () => React.ReactNode }) {
  return <>{render()}</>;
}

/** A callback argument as short text for the action log; never throws (events and DOM nodes aren't serializable). */
function formatValue(v: unknown): string {
  if (v && typeof v === 'object') {
    if ('nativeEvent' in v || v instanceof Event) return `‹${(v as { type?: string }).type ?? 'event'}›`;
    if (typeof Node !== 'undefined' && v instanceof Node) return `‹${v.nodeName.toLowerCase()}›`;
  }
  if (typeof v === 'function') return 'ƒ';
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s.length > 60 ? s.slice(0, 57) + '…' : s;
  } catch {
    return String(v);
  }
}
