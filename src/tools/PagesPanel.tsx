// Pages tree built from the manifest: its sections (pageGroups: boot pages, the app's own, App), children by `parent`, variants for pages with params, steps
// for flows. A step's states (something picked on it) aren't pages: they're in the page inspector and in Flow. Click opens the page with its default chain underneath (a step: held, to look at);
// rows in the current stack are highlighted.
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useNavRoot } from '../nav/context';
import { stepOf, stepState } from '../nav/flow';
import { newSteps } from '../nav/manifest';
import { ChangeBadge } from '../flow/FlowView';
import type { Manifest } from '../nav/stack';
import { isVariantState, pageIcon, pageName, ROLE_ICONS, ROLE_NAMES, sameRef, variantState } from '../nav/stack';
import type { FlowStep, PageDef, PageRef, PageStatus, Params } from '../nav/types';
import styles from './Panel.module.css';
import { SearchAction, SearchField } from './SearchField';
import { treeOpen } from './treeOpen';
import { HOME, LAUNCH } from '../nav/pages';
import { pageInFront } from '../nav/sidePanel';
import { pageGroups } from '../nav/pageGroups';
import { replayLaunch } from '../sim/launch';
import { t } from '../i18n/ui';
import { BASE_PAGES } from '../nav/pages';
import { CHANGES_PARAM, proposalChanges, VARIANT_PARAM } from '../proposals';
import { usePageIndex } from '../sim/pageIndex';
import { useUrlState } from '../sim/SimContext';

/** One screen a proposal changes, as the filtered list shows it: a page, a flow's step, a variant, a component's place. */
interface ChangedScreen {
  key: string;
  page: string;
  /** What screen of the page: a step, a variant, the state that shows a component. */
  sub?: string;
  kind: 'new' | 'changed';
  /** What changes on it, in a few words (the components it shows). */
  note?: string;
  /** Opens it, with these URL params kept too (the list's own filter). */
  open: (keep: Record<string, string>) => void;
}

/**
 * The screens a proposal changes, one by one: its new and changed pages (a declared component place opens in its
 * state), each new step of a flow, and every screen where a component it changes shows (the changes' scan). Null
 * without a proposal.
 */
function useChangedScreens(): ChangedScreen[] | null {
  const nav = useNavRoot();
  const p = nav.proposal;
  const [variant] = useUrlState<string>(VARIANT_PARAM, '');
  const index = usePageIndex(p?.id ?? 'live', p ? 'idle' : false);
  return useMemo(() => {
    if (!p) return null;
    const out: ChangedScreen[] = [];
    const seen = new Set<string>();
    const add = (sc: ChangedScreen) => {
      if (seen.has(sc.key)) return;
      seen.add(sc.key);
      out.push(sc);
    };
    const c = proposalChanges(p, variant || null, BASE_PAGES);
    // A flow with new steps: those screens, not the whole flow (which would open on its first step).
    const withNewSteps = new Set(c.pages.filter((pg) => pg.step).map((pg) => pg.id));
    for (const pg of c.pages) {
      if (pg.kind === 'removed') continue;
      const def = nav.pages[pg.id];
      if (!def) continue;
      if (pg.step) {
        const step = def.flow?.steps.find((st) => st.id === pg.step!.id);
        add({ key: `${pg.id}:${pg.step.id}`, page: pg.id, sub: pg.step.label, kind: pg.kind, open: (keep) => nav.open(pg.id, {}, { ...(step ? stepState(def, step) : {}), ...keep }) });
      } else if (pg.show) {
        const place = pg.show;
        add({ key: `${pg.id}|${place.label ?? ''}`, page: pg.id, sub: place.label, kind: pg.kind, note: pg.details.filter((d) => d !== place.label).join(' · '), open: (keep) => nav.open(place.page, place.params ?? {}, { ...place.state, ...keep }) });
      } else if (def.flow && withNewSteps.has(pg.id)) {
        continue;
      } else {
        const v = def.variants?.()[0];
        add({ key: pg.id, page: pg.id, kind: pg.kind, note: pg.details.join(' · '), open: (keep) => nav.open(pg.id, v?.params ?? {}, { ...(v ? variantState(def, v) : {}), ...keep }) });
      }
    }
    // Where a component it changes shows: each screen once, with the components it shows.
    const notes = new Map<string, string[]>();
    for (const cm of c.components)
      for (const pl of index?.[cm.name] ?? []) {
        if (pl.sheet) continue;
        const key = pl.label ? `${pl.id}|${pl.label}` : pl.id;
        notes.set(key, [...(notes.get(key) ?? []), cm.name]);
        add({ key, page: pl.id, sub: pl.label, kind: 'changed', open: (keep) => nav.open(pl.id, pl.params, { ...pl.state, [CHANGES_PARAM]: cm.name, ...keep }) });
      }
    for (const sc of out) if (notes.has(sc.key)) sc.note = [sc.note, ...notes.get(sc.key)!].filter(Boolean).join(' · ');
    return out;
  }, [p, variant, index, nav]);
}

/** The pages a proposal changes (its screens' pages), for the tree's badges. */
const Changes = createContext<Set<string> | null>(null);


export const STATUS_COLOR: Record<PageStatus, string> = { done: '#16a34a', pending: '#f59e0b', placeholder: '#c4c8ce' };
/** A page's status as its row shows it (the manifest's words are its ids). */
export const STATUS_WORD: Record<PageStatus, string> = { done: t('done'), pending: t('pending'), placeholder: t('placeholder') };

const childrenOf = (pages: Manifest, id: string) => Object.keys(pages).filter((k) => pages[k].parent === id && pages[k].level !== 'tab' && !pages[k].modeOf);
/** Other modes of a page's screen (`modeOf`): listed with it, as its states. */
const modesOf = (pages: Manifest, id: string) => Object.keys(pages).filter((k) => pages[k].modeOf === id);

/** The open rows, by page id: as you left them when you come back to the tab, and Collapse / Expand all after a reload. */
const TREE = treeOpen<string>('pages');

/**
 * Pages' Only changes: on or off, changed only by its checkbox (not by opening a screen, nor by a navigation that
 * rewrites the URL), remembered per viewer (localStorage) across tabs and reloads.
 */
const ONLY_KEY = 'hc.pages.onlyChanges';
const onlyListeners = new Set<() => void>();
const readOnly = () => {
  try {
    return localStorage.getItem(ONLY_KEY) === '1';
  } catch {
    return false;
  }
};
let onlyNow = readOnly();
function setOnlyChanges(on: boolean) {
  onlyNow = on;
  try {
    if (on) localStorage.setItem(ONLY_KEY, '1');
    else localStorage.removeItem(ONLY_KEY);
  } catch {
    // Not kept (private mode): it still holds until the page reloads.
  }
  onlyListeners.forEach((l) => l());
}
const useOnlyChanges = () =>
  useSyncExternalStore(
    (l) => {
      onlyListeners.add(l);
      return () => onlyListeners.delete(l);
    },
    () => onlyNow,
  );

export function PagesPanel() {
  const [q, setQ] = useState('');
  const screens = useChangedScreens();
  const changedIds = useMemo(() => (screens ? new Set(screens.map((sc) => sc.page)) : null), [screens]);
  // The hook first, always: a proposal coming or going doesn't change the hooks' order.
  const onlyOn = useOnlyChanges();
  const only = !!screens && onlyOn;
  const shown = (id: string) => matches(pages, id, query);
  const query = q.trim().toLowerCase();
  const { pages } = useNavRoot();
  TREE.useVersion();
  // Collapsed, the button expands all; otherwise it collapses all (and again, closing what was opened since).
  const collapsed = TREE.mode() === 'collapsed';
  // Titled when there's more than one section, or the launch row above them.
  const sections = pageGroups(pages);
  const titled = sections.length > 1 || !!LAUNCH;
  const groups = sections.map((g) => ({ key: g.key, label: !titled ? null : g.key === 'boot' ? t('Before the app') : g.key === 'app' ? t('App') : g.key, roots: g.roots }));
  return (
    <>
      {/* A search shows every match's branch open, whatever is collapsed: nothing to collapse then. */}
      <SearchField placeholder={t('Search pages')} value={q} onChange={setQ} action={<SearchAction icon={collapsed ? 'expand_all' : 'collapse_all'} title={collapsed ? t('Expand all') : t('Collapse all')} disabled={!!query} onClick={() => TREE.setMode(collapsed ? 'expanded' : 'collapsed')} />} />
      {/* Looking at a proposal: only the pages it changes (new, changed, or showing a component it changes). */}
      {changedIds && (
        <label className={styles.onlyChanges} title={t('Only the screens this proposal adds or changes, or where a component it changes shows')}>
          <input type="checkbox" checked={only} onChange={(e) => setOnlyChanges(e.target.checked)} />
          <span>{t('Only changes')}</span>
          <span className={styles.muted}>{screens!.length}</span>
        </label>
      )}
      <Changes.Provider value={changedIds}>
      {/* Filtered: the screens it changes, one level, each opening that screen. */}
      {only ? (
        <ScreenList screens={screens!.filter((sc) => !query || `${pageName(pages, sc.page)} ${sc.sub ?? ''}`.toLowerCase().includes(query))} />
      ) : (
      <div style={{ paddingBottom: 12 }}>
        {LAUNCH && !only && t('Launch screen').toLowerCase().includes(query) && <LaunchRow />}
        {groups.map((g) => (
          <Fragment key={g.key}>
            {/* A group's title only while something in it matches the search. */}
            {g.label && g.roots.some(shown) && <div className={styles.treeGroup}>{g.label}</div>}
            {g.roots.map((id) => (
              <PageNode key={id} id={id} depth={0} query={query} />
            ))}
          </Fragment>
        ))}
      </div>
      )}
      </Changes.Provider>
    </>
  );
}

function matches(pages: Manifest, id: string, query: string): boolean {
  if (!query) return true;
  const def = pages[id];
  const own = [id, pageName(pages, id), def.path].some((s) => s.toLowerCase().includes(query));
  const vars = def.variants?.().some((v) => v.label.toLowerCase().includes(query)) ?? false;
  const steps = def.flow?.steps.some((st) => st.label.toLowerCase().includes(query)) ?? false;
  return own || vars || steps || childrenOf(pages, id).some((c) => matches(pages, c, query));
}

function PageNode({ id, depth, query }: { id: string; depth: number; query: string }) {
  const nav = useNavRoot();
  const PAGES = nav.pages;
  const def = PAGES[id];
  const kids = childrenOf(PAGES, id);
  const modes = modesOf(PAGES, id);
  const variants = def.variants?.() ?? [];
  const inStack = nav.stack.some((r) => r.id === id);
  TREE.useVersion();
  const open = TREE.row(id) ?? TREE.byMode(depth === 0 || inStack);
  const setOpen = (o: boolean) => TREE.setRow(id, o);
  // Reveal the branch of a page opened since (not on mount: coming back to the tab keeps it as you left it).
  const wasInStack = useRef(inStack);
  useEffect(() => {
    if (inStack && !wasInStack.current) TREE.setRow(id, true);
    wasInStack.current = inStack;
  }, [id, inStack]);
  if (!matches(PAGES, id, query)) return null;
  const expanded = open || !!query;
  const steps = def.flow?.steps ?? [];
  const hasKids = kids.length > 0 || variants.length > 0 || steps.length > 0 || modes.length > 0;
  const shownVariants = query && !pageName(PAGES, id).toLowerCase().includes(query) ? variants.filter((v) => v.label.toLowerCase().includes(query)) : variants;

  return (
    <>
      <Row
        depth={depth}
        def={def}
        label={pageName(PAGES, id)}
        refOf={variants.length ? null : { id, params: {} }}
        caret={hasKids ? (expanded ? 'expand_more' : 'chevron_right') : null}
        onCaret={() => setOpen(!open)}
        onClick={() => (variants.length ? setOpen(!open) : nav.open(id))}
        count={variants.length || steps.length || undefined}
      />
      {expanded && steps.map((st, i) => <StepRows key={st.id} id={id} step={st} n={i + 1} depth={depth + 1} query={query} />)}
      {expanded &&
        shownVariants.map((v) => (
          <Row key={v.label} depth={depth + 1} def={def} label={v.label} refOf={{ id, params: v.params ?? {} }} state={v.state} caret={null} variant onClick={() => nav.open(id, v.params ?? {}, variantState(def, v))} />
        ))}
      {expanded &&
        modes.map((m) => (
          <Row key={m} depth={depth + 1} def={PAGES[m]} label={PAGES[m].name ?? pageName(PAGES, m)} refOf={{ id: m, params: {} }} caret={null} variant onClick={() => nav.open(m)} />
        ))}
      {expanded && kids.map((k) => <PageNode key={k} id={k} depth={depth + 1} query={query} />)}
    </>
  );
}

/** A flow's step (numbered, a loader marked). Current on any of its states. */
function StepRows({ id, step, n, depth, query }: { id: string; step: FlowStep; n: number; depth: number; query: string }) {
  const nav = useNavRoot();
  const [search] = useSearchParams();
  const def = nav.pages[id];
  const top = nav.stack[nav.stack.length - 1];
  const here = top.id === id && stepOf(def.flow!, search).id === step.id;
  if (query && !step.label.toLowerCase().includes(query) && !nav.pages[id].name?.toLowerCase().includes(query) && !pageName(nav.pages, id).toLowerCase().includes(query)) return null;
  const open = () => nav.open(id, top.id === id ? top.params : {}, stepState(def, step));
  return (
    <div className={[styles.row, here ? styles.current : ''].join(' ')} style={{ paddingLeft: 8 + depth * 14 }} title={step.note} onClick={open}>
      <span className={styles.stepNum}>{n}</span>
      <Icon name={step.kind === 'loading' ? 'hourglass_empty' : 'crop_portrait'} size={16} />
      <span className={styles.name}>{step.label}</span>
      {/* A step the proposal adds to the flow: a new screen, as a new page is. */}
      {newSteps(id, nav.proposal).includes(step.id) && <ChangeBadge change="new" />}
    </div>
  );
}

interface RowProps {
  depth: number;
  def: PageDef;
  label: string;
  /** Concrete page this row opens (null for a page with variants: the row only expands). */
  refOf: PageRef | null;
  /** A variant's state params: current only while the URL holds them. */
  state?: Params;
  caret?: string | null;
  onCaret?: () => void;
  onClick: () => void;
  variant?: boolean;
  count?: number;
}

function Row({ depth, def, label, refOf, state, caret, onCaret, onClick, variant, count }: RowProps) {
  const nav = useNavRoot();
  const [search] = useSearchParams();
  // The side panel, when it's on, is the page in front (the tab under it stays marked as in the stack).
  const top = pageInFront(nav.stack, search);
  // A flow's current row is its step's, below it; a variant by state is the one shown only while the URL holds its state.
  const holds = isVariantState(def, (k) => search.get(k), { state });
  const isCurrent = !!refOf && sameRef(refOf, top) && !def.flow && holds;
  const inStack = !!refOf && nav.stack.some((r) => sameRef(r, refOf));
  const cls = [styles.row, isCurrent ? styles.current : inStack ? styles.inStack : ''].join(' ');
  // Its change: the proposal's on the page, or a component it changes shown on it.
  const changedPages = useContext(Changes);
  const pid = refOf?.id ?? pageIdOf(def, nav.pages);
  const change = nav.change(pid) ?? (changedPages?.has(pid) ? 'changed' : null);
  return (
    <div className={cls} style={{ paddingLeft: 8 + depth * 14 }} onClick={onClick} title={refOf ? nav.href([refOf]) : def.path}>
      {caret !== undefined && (
        <button
          className={styles.caret}
          onClick={(e) => {
            e.stopPropagation();
            onCaret?.();
          }}
        >
          {caret && <Icon name={caret} size={16} />}
        </button>
      )}
      {/* A variant (the same screen with other data) or a mode of it: stacked screens, softer than a page's icon. */}
      {variant ? (
        <span className={styles.variantIcon} title={t('A variant of this screen')}>
          <Icon name="auto_awesome_motion" size={16} />
        </span>
      ) : (
        // Its role in the navigation (ROLE_ICONS: one vocabulary for every app), named on hover.
        <span className={styles.roleIcon} title={ROLE_ICONS[def.level].label}>
          <Icon name={pageIcon(def)} size={16} />
        </span>
      )}
      <span className={styles.name}>{label}</span>
      {count != null && <span className={styles.muted}>{count}</span>}
      {!variant && change && <ChangeBadge change={change} />}
      {!variant && def.level !== 'tab' && <span className={styles.badge}>{ROLE_NAMES[def.level]}</span>}
      {!variant && <span className={styles.dot} style={{ background: STATUS_COLOR[def.status ?? 'placeholder'] }} title={def.status && STATUS_WORD[def.status]} />}
    </div>
  );
}

/**
 * The app's launch (AppConfig.launch), first: it opens the app's first screen and plays the launch on every device,
 * again each time it's picked, to watch it while building it.
 */
function LaunchRow() {
  const nav = useNavRoot();
  const play = () => {
    nav.open(HOME);
    replayLaunch();
  };
  return (
    <>
      <div className={styles.treeGroup}>{t('Launch')}</div>
      <div className={styles.row} style={{ paddingLeft: 8 }} onClick={play} title={t('Play the launch on every device (again each time)')}>
        <span className={styles.caret} />
        <span className={styles.roleIcon}>
          <Icon name="rocket_launch" size={16} />
        </span>
        <span className={styles.name}>{t('Launch screen')}</span>
        <span className={styles.launchPlay}>
          <Icon name="replay" size={15} />
        </span>
      </div>
    </>
  );
}

/** A proposal's screens, one level: each its page's icon, its name (and which screen of it), its change; opens it. */
function ScreenList({ screens }: { screens: ChangedScreen[] }) {
  const nav = useNavRoot();
  if (!screens.length) return <p className={styles.muted} style={{ padding: '4px 12px' }}>{t('Nothing changes on a screen yet.')}</p>;
  return (
    <div style={{ paddingBottom: 12 }}>
      {screens.map((sc) => (
        <div key={sc.key} className={`${styles.row} ${styles.screenRow}`} style={{ paddingLeft: 12 }} onClick={() => sc.open({})} title={sc.note}>
          <span className={styles.roleIcon}>
            <Icon name={pageIcon(nav.pages[sc.page])} size={16} />
          </span>
          <span className={styles.screenName}>
            <span className={styles.name}>{sc.sub ? `${pageName(nav.pages, sc.page)} › ${sc.sub}` : pageName(nav.pages, sc.page)}</span>
            {sc.note && <span className={styles.screenNote}>{sc.note}</span>}
          </span>
          <ChangeBadge change={sc.kind} />
        </div>
      ))}
    </div>
  );
}

/** Manifest id of a page definition. */
function pageIdOf(def: PageDef, pages: Manifest): string {
  return Object.keys(pages).find((k) => pages[k] === def) ?? '';
}
