// What is on screen, as a tree: one root per page layer that shows (not one covered by a page over it), and what the
// app draws outside them (the nav). A page and a component open into the layers they're made of, nested as they're
// built — the rows, columns and grids that arrange them, its containers, texts, icons, images, graphics and shapes,
// and the components inside — read from the DOM when the row is opened. The search reads the whole tree, components'
// layers too, and shows what matches with the rows above it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { CATALOG } from '../design/catalog';
import { useDesign } from '../design/DesignContext';
import { COMPONENT_COLOR, componentIcon, componentKind, elementKind, KIND_ICON, TIER_ICON, kindLabel, layerKind, mixesText, shapeCorners, textOf, type Corners } from '../design/element';
import { APP_WIDGETS } from '../design/handoff';
import { useLibrary } from '../design/library';
import { componentHint, componentInstance } from '../design/component';
import styles from './Panel.module.css';
import { SearchAction, SearchField } from './SearchField';
import { treeOpen } from './treeOpen';

type LNode =
  | { type: 'page'; key: string; label: string; el: HTMLElement }
  | { type: 'component'; key: string; id: string; label: string; el: HTMLElement }
  | { type: 'layer'; key: string; label: string; el: Element; kind: ReturnType<typeof elementKind>; corners?: Corners }
  /** A text with no element of its own, beside the box's other children: it's picked with its box. */
  | { type: 'text'; key: string; label: string; el: Element };

/** A key for an element that has none of its own (a page, a layer): the same for as long as the element lives. */
const KEYS = new WeakMap<Element, string>();
let nextKey = 0;
const keyOf = (el: Element) => (el instanceof HTMLElement && el.dataset.hc) || KEYS.get(el) || (KEYS.set(el, `l${nextKey++}`), KEYS.get(el)!);

/** Not drawn: no box (display none), or hidden. */
const unseen = (el: Element) => el.getClientRects().length === 0 || getComputedStyle(el).visibility === 'hidden';

/**
 * A page layer that shows: not hidden, and not covered whole by a page layer drawn over it (a push or a cover that
 * spans it on a phone; beside it, in a split, both show). Within the screen it's clipped to.
 */
function showing(page: HTMLElement): boolean {
  if (unseen(page)) return false;
  const screen = page.closest('[data-theme]') ?? page.parentElement!;
  const s = screen.getBoundingClientRect();
  const clip = (r: DOMRect) => ({ l: Math.max(r.left, s.left), t: Math.max(r.top, s.top), r: Math.min(r.right, s.right), b: Math.min(r.bottom, s.bottom) });
  const own = clip(page.getBoundingClientRect());
  if (own.r - own.l < 1 || own.b - own.t < 1) return false;
  return ![...screen.querySelectorAll<HTMLElement>('[data-hc-page]')].some((q) => {
    // Pages later in the document are drawn over this one (their z-index only grows).
    if (q === page || q.contains(page) || page.contains(q) || !(page.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING) || unseen(q)) return false;
    const o = clip(q.getBoundingClientRect());
    return o.l <= own.l + 1 && o.t <= own.t + 1 && o.r >= own.r - 1 && o.b >= own.b - 1;
  });
}

/**
 * The rows under an element. Pages and components always; other elements in a page or a component (`layers`), as
 * they're nested: a box that lays out several children is a row of its own (Row, Column, Grid, Box), one around a
 * single child is passed through to it, and a graphic is one layer (not its every path). What isn't drawn is left out.
 */
function childrenOf(el: Element, layers: boolean): LNode[] {
  const out: LNode[] = [];
  const mixed = layers && mixesText(el);
  let n = 0;
  for (const node of mixed ? el.childNodes : el.children) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) out.push({ type: 'text', key: `${keyOf(el)}:t${n++}`, label: text, el });
      continue;
    }
    if (!(node instanceof Element)) continue;
    const c = node;
    const h = c as HTMLElement;
    if (h.dataset?.hcPage) {
      if (showing(h)) out.push({ type: 'page', key: keyOf(h), label: h.dataset.hcPage, el: h });
    } else if (h.dataset?.hc) out.push({ type: 'component', key: h.dataset.hc, id: h.dataset.hc, label: componentInstance(h.dataset.hc)?.name ?? '?', el: h });
    else if (!layers) out.push(...childrenOf(c, false));
    else if (unseen(c)) continue;
    else {
      const kind = layerKind(c);
      // A box around a single thing adds nothing to read; one that arranges several is the component's structure.
      if (kind === 'group' && c.childElementCount <= 1 && !mixesText(c)) out.push(...childrenOf(c, true));
      else out.push({ type: 'layer', key: keyOf(c), label: (kind === 'text' && textOf(c)) || kindLabel(c, kind), el: c, kind, ...(kind === 'shape' || kind === 'container' ? { corners: shapeCorners(c) } : {}) });
    }
  }
  return out;
}

/** Whether a row opens into rows of its own (a text, a graphic and an empty box don't). */
function opens(node: LNode): boolean {
  if (node.type === 'text') return false;
  if (node.type === 'layer' && (node.kind === 'graphic' || node.kind === 'text')) return false;
  return node.el.childElementCount > 0;
}

/** What the search reads in a row: its name, and a component's hint ("Breakfast"). */
const searchText = (node: LNode) => (node.type === 'component' ? `${node.label} ${componentHint(componentInstance(node.id)?.props ?? {}) ?? ''}` : node.label).toLowerCase();

/** A row the search found, or one above a row it found, with its rows that match (or lead to one). */
type Found = { node: LNode; kids: Found[] };

/** The rows under `el` that match `query` or hold one that does, over the whole tree (closed rows too). */
function find(el: Element, layers: boolean, query: string): Found[] {
  return childrenOf(el, layers).flatMap((node) => {
    const kids = opens(node) ? find(node.el, true, query) : [];
    return kids.length || searchText(node).includes(query) ? [{ node, kids }] : [];
  });
}

/**
 * Open rows, by element: kept while the tab is switched and the element lives; Collapse / Expand all is remembered.
 * Expand all opens the pages and their structure; a component stays closed until opened (its layers are read then).
 */
const TREE = treeOpen<Element>('layers', { weak: true });

/** A box that arranges its children, by how (element.ts kindLabel). */
const GROUP_ICON: Record<string, string> = { Row: 'view_column', Column: 'table_rows', Grid: 'grid_view', Box: 'check_box_outline_blank' };

export function LayersPanel() {
  const { rootRef, version, selected, selectedEl } = useDesign();
  const root = rootRef.current;
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  TREE.useVersion();
  const collapsed = TREE.mode() === 'collapsed';
  const tree = useMemo(() => (root ? childrenOf(root, false) : []), [root, version]);
  // The whole tree is read for a search (a few thousand elements on a busy screen): only while there's one.
  const found = useMemo(() => (root && query ? find(root, false, query) : null), [root, query, version]);

  // The rows above the selection open by themselves.
  const path = useMemo(() => {
    const keys = new Set<string>();
    const at = selectedEl ?? (selected && root ? root.querySelector(`[data-hc="${selected}"]`) : null);
    for (let p = at?.parentElement; p && p !== root; p = p.parentElement) keys.add(keyOf(p));
    return keys;
  }, [root, selected, selectedEl, version]);

  if (!tree.length) return <div className={styles.section}>Nothing on screen yet.</div>;
  return (
    <>
      {/* A search shows every match with the rows above it open: nothing to collapse then. */}
      <SearchField
        placeholder="Search layers"
        value={q}
        onChange={setQ}
        action={<SearchAction icon={collapsed ? 'expand_all' : 'collapse_all'} title={collapsed ? 'Expand all' : 'Collapse all'} disabled={!!query} onClick={() => TREE.setMode(collapsed ? 'expanded' : 'collapsed')} />}
      />
      <div style={{ padding: '6px 0 12px' }}>
        <div className={styles.layersLegend}>
          <span>
            <span className={styles.dot} style={{ background: COMPONENT_COLOR.library }} />
            Library
          </span>
          <span>
            <span className={styles.dot} style={{ background: COMPONENT_COLOR.app }} />
            In app
          </span>
          <span>
            <span className={styles.dot} style={{ background: COMPONENT_COLOR.local }} />
            Local
          </span>
        </div>
        {found
          ? found.map((f) => <LayerRow key={f.node.key} node={f.node} depth={0} path={path} found={f.kids} />)
          : tree.map((n) => <LayerRow key={n.key} node={n} depth={0} path={path} />)}
        {found && !found.length && (
          <div className={styles.section}>
            <span className={styles.muted}>No layer matches “{q.trim()}”.</span>
          </div>
        )}
      </div>
    </>
  );
}

/** `found`: in a search, the rows under it that match (it shows them, open). */
function LayerRow({ node, depth, path, found }: { node: LNode; depth: number; path: Set<string>; found?: Found[] }) {
  const { selected, setSelected, selectedEl, setSelectedEl, setHovered, setHoveredEl, version } = useDesign();
  const lib = useLibrary();
  TREE.useVersion();
  // Open by themselves: what's above the selection, and (unless collapsed all) a page and, in an open page or
  // component, the boxes that hold its layers, so its structure shows at once. Components stay closed until opened.
  const structure = node.type === 'page' || (node.type === 'layer' && (node.kind === 'group' || node.kind === 'container'));
  const open = found ? found.length > 0 : TREE.row(node.el) ?? (path.has(node.key) || (node.type === 'component' ? false : TREE.byMode(structure)));
  const setToggled = (o: boolean) => TREE.setRow(node.el, o);
  const isSel = node.type === 'component' ? node.id === selected : node.type === 'layer' && node.el === selectedEl;
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isSel) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isSel]);
  // Read when the row is open: a component's layers aren't worked out for the whole screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const children = useMemo(() => (open && !found ? childrenOf(node.el, true) : []), [open, found, node.el, version]);
  const canOpen = !found && opens(node);

  const hint = node.type === 'component' ? componentHint(componentInstance(node.id)?.props ?? {}) : undefined;
  const entry = node.type === 'component' ? CATALOG.get(node.label) : undefined;
  // In the component library (the code's API, or its catalog), or only here.
  const inLibrary = !!entry || !!lib?.widget(node.label);
  const icon = node.type === 'page' ? 'web_asset' : node.type === 'text' ? KIND_ICON.text : node.type === 'layer' ? (node.kind === 'group' ? GROUP_ICON[node.label] : undefined) ?? KIND_ICON[node.kind] : entry ? TIER_ICON[entry.tier] : componentIcon(node.label);
  // On the icon only: the name reads as every other row's.
  const color = node.type === 'component' && !isSel ? COMPONENT_COLOR[componentKind(node.label, inLibrary)] : undefined;

  return (
    <>
      <div
        ref={rowRef}
        className={`${styles.row} ${isSel ? styles.current : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onMouseEnter={() => (node.type === 'component' ? setHovered(node.id) : node.type !== 'page' && setHoveredEl(node.el))}
        onMouseLeave={() => {
          setHovered(null);
          setHoveredEl(null);
        }}
        onClick={() => {
          if (node.type === 'page') return setToggled(!open);
          if (node.type === 'component') setSelected(node.id);
          else setSelectedEl(node.el);
          node.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }}
      >
        <button
          className={styles.caret}
          onClick={(e) => {
            e.stopPropagation();
            setToggled(!open);
          }}
        >
          {canOpen && <Icon name={open ? 'expand_more' : 'chevron_right'} size={16} />}
        </button>
        {node.type === 'layer' && node.corners ? (
          <ShapeGlyph corners={node.corners} dim={!isSel} filled={node.kind === 'container'} />
        ) : (
          <Icon name={icon} size={14} color={color} style={{ opacity: (node.type === 'layer' || node.type === 'text') && !isSel ? 0.6 : 1 }} />
        )}
        <span className={styles.name} style={{ fontWeight: node.type === 'page' ? 600 : 400 }}>
          {node.label}
          {hint && <span className={styles.muted}> · {hint}</span>}
        </span>
        {node.type === 'component' && !inLibrary && <span className={styles.muted}>{node.label in APP_WIDGETS ? 'in app' : 'local'}</span>}
      </div>
      {found
        ? found.map((f) => <LayerRow key={f.node.key} node={f.node} depth={depth + 1} path={path} found={f.kids} />)
        : open && children.map((c) => <LayerRow key={c.key} node={c} depth={depth + 1} path={path} />)}
    </>
  );
}

/**
 * A shape's or a container's icon: an outline with its own corners — a circle (full), a rounded square or a square. A
 * container (a box with content) has its content in it, so the two read apart.
 */
function ShapeGlyph({ corners, dim, filled }: { corners: Corners; dim: boolean; filled?: boolean }) {
  const radius = { full: '50%', rounded: 3, square: 0 }[corners];
  return (
    <span style={{ width: 14, height: 14, flex: 'none', display: 'grid', placeItems: 'center', opacity: dim ? 0.6 : 1 }}>
      <span style={{ width: 12, height: 12, boxSizing: 'border-box', border: '1.5px solid currentColor', borderRadius: radius, display: 'grid', placeItems: 'center' }}>
        {filled && <span style={{ width: 4, height: 4, background: 'currentColor', borderRadius: corners === 'square' ? 0 : corners === 'full' ? '50%' : 1 }} />}
      </span>
    </span>
  );
}
