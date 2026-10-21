// Pages tree built from the manifest: boot pages and tabs at the root (two groups when there are boot pages), children by `parent`, variants for pages with params, steps
// for flows. A step's states (something picked on it) aren't pages: they're in the page inspector and in Flow. Click opens the page with its default chain underneath (a step: held, to look at);
// rows in the current stack are highlighted.
import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useNavRoot } from '../nav/context';
import { stepOf, stepState } from '../nav/flow';
import { ChangeBadge } from '../flow/FlowView';
import type { Manifest } from '../nav/stack';
import { pageIcon, pageName, ROLE_ICONS, sameRef } from '../nav/stack';
import type { FlowStep, PageDef, PageRef, PageStatus } from '../nav/types';
import styles from './Panel.module.css';
import { SearchAction, SearchField } from './SearchField';
import { treeOpen } from './treeOpen';
import { HOME, LAUNCH } from '../nav/pages';
import { replayLaunch } from '../sim/launch';

export const STATUS_COLOR: Record<PageStatus, string> = { done: '#16a34a', pending: '#f59e0b', placeholder: '#c4c8ce' };

const childrenOf = (pages: Manifest, id: string) => Object.keys(pages).filter((k) => pages[k].parent === id && pages[k].level !== 'tab' && !pages[k].modeOf);
/** Other modes of a page's screen (`modeOf`): listed with it, as its states. */
const modesOf = (pages: Manifest, id: string) => Object.keys(pages).filter((k) => pages[k].modeOf === id);
/** Pages with no parent besides tabs and boot pages (a settings page opened from the avatar): roots after the tabs. */
const loose = (pages: Manifest) => Object.keys(pages).filter((k) => !pages[k].parent && !pages[k].modeOf && pages[k].level !== 'tab' && pages[k].level !== 'boot');

/** The open rows, by page id: as you left them when you come back to the tab, and Collapse / Expand all after a reload. */
const TREE = treeOpen<string>('pages');

export function PagesPanel() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const { tabs, boots, pages } = useNavRoot();
  TREE.useVersion();
  // Collapsed, the button expands all; otherwise it collapses all (and again, closing what was opened since).
  const collapsed = TREE.mode() === 'collapsed';
  const app = [...tabs, ...loose(pages)];
  // Boot pages (a welcome flow) start before the app: their own group, above the tabs (and under the launch).
  const groups = boots.length || LAUNCH
    ? [
        ...(boots.length ? [{ label: 'Before the app', roots: boots }] : []),
        { label: 'App', roots: app },
      ]
    : [{ label: null, roots: app }];
  return (
    <>
      {/* A search shows every match's branch open, whatever is collapsed: nothing to collapse then. */}
      <SearchField placeholder="Search pages" value={q} onChange={setQ} action={<SearchAction icon={collapsed ? 'expand_all' : 'collapse_all'} title={collapsed ? 'Expand all' : 'Collapse all'} disabled={!!query} onClick={() => TREE.setMode(collapsed ? 'expanded' : 'collapsed')} />} />
      <div style={{ paddingBottom: 12 }}>
        {LAUNCH && 'launch screen'.includes(query) && <LaunchRow />}
        {groups.map((g) => (
          <Fragment key={g.label ?? 'app'}>
            {/* A group's title only while something in it matches the search. */}
            {g.label && g.roots.some((id) => matches(pages, id, query)) && <div className={styles.treeGroup}>{g.label}</div>}
            {g.roots.map((id) => (
              <PageNode key={id} id={id} depth={0} query={query} />
            ))}
          </Fragment>
        ))}
      </div>
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
          <Row key={JSON.stringify(v.params)} depth={depth + 1} def={def} label={v.label} refOf={{ id, params: v.params }} caret={null} variant onClick={() => nav.open(id, v.params)} />
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
    </div>
  );
}

interface RowProps {
  depth: number;
  def: PageDef;
  label: string;
  /** Concrete page this row opens (null for a page with variants: the row only expands). */
  refOf: PageRef | null;
  caret?: string | null;
  onCaret?: () => void;
  onClick: () => void;
  variant?: boolean;
  count?: number;
}

function Row({ depth, def, label, refOf, caret, onCaret, onClick, variant, count }: RowProps) {
  const nav = useNavRoot();
  const top = nav.stack[nav.stack.length - 1];
  // A flow's current row is its step's, below it.
  const isCurrent = !!refOf && sameRef(refOf, top) && !def.flow;
  const inStack = !!refOf && nav.stack.some((r) => sameRef(r, refOf));
  const cls = [styles.row, isCurrent ? styles.current : inStack ? styles.inStack : ''].join(' ');
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
        <span className={styles.variantIcon} title="A variant of this screen">
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
      {!variant && nav.change(refOf?.id ?? pageIdOf(def, nav.pages)) && <ChangeBadge change={nav.change(refOf?.id ?? pageIdOf(def, nav.pages))!} />}
      {!variant && def.level !== 'tab' && <span className={styles.badge}>{def.level}</span>}
      {!variant && <span className={styles.dot} style={{ background: STATUS_COLOR[def.status ?? 'placeholder'] }} title={def.status} />}
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
      <div className={styles.treeGroup}>Launch</div>
      <div className={styles.row} style={{ paddingLeft: 8 }} onClick={play} title="Play the launch on every device (again each time)">
        <span className={styles.caret} />
        <span className={styles.roleIcon}>
          <Icon name="rocket_launch" size={16} />
        </span>
        <span className={styles.name}>Launch screen</span>
        <span className={styles.launchPlay}>
          <Icon name="replay" size={15} />
        </span>
      </div>
    </>
  );
}

/** Manifest id of a page definition. */
function pageIdOf(def: PageDef, pages: Manifest): string {
  return Object.keys(pages).find((k) => pages[k] === def) ?? '';
}
