// A screen's structure as an indented outline, one line per node: what a reader skims before opening the full JSON.
//
//   + **MFCard** · 16,126 370×206 · padding 16 (mf-space-x2) · fill …normalBackgroundSurface · props { padding: true }
//       Column · gap 16 (mf-space-x2) · cross center
//         Text "Notifications are off" · …headingS · …normalPrimary
//
// Shorter than the tree in two ways (the JSON has all of it): a component built only from its props is one line (its
// insides are the component's own, not the screen's to build), and on a screen that exists in Live what the proposal
// leaves as it is is folded.

const NAME = { row: 'Row', column: 'Column', grid: 'Grid', box: 'Box', container: 'Container', text: 'Text', icon: 'Icon', image: 'Image', graphic: 'Graphic', shape: 'Shape' };

/** Every string a component's props hold (a title, an icon's name, the items of a list). */
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v.replace(/^(Symbols|Icons)\./, ''));
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

/**
 * Whether what's inside a component is its own: every text in it and every component in it comes from its props (a
 * tile's title, a button's label, the icon it was given). Content put in it from outside (a card's children) isn't,
 * and shows. When in doubt it shows.
 */
function ownInsides(n) {
  const mine = strings(n.props ?? {});
  const has = (s) => mine.some((m) => m === s || (s.length > 2 && m.includes(s)));
  const check = (kids) =>
    (kids ?? []).every((k) => {
      if (k.type === 'page') return false;
      if (k.type === 'text') return has(k.text ?? '');
      if (k.type === 'icon') return !k.text || has(k.text);
      if (k.type === 'component') {
        const theirs = strings(k.props ?? {}).filter((s) => !s.startsWith('('));
        // Told what to show (an icon, a label) by something its parent doesn't have: given from outside.
        if (theirs.length && !theirs.some(has)) return false;
        return check(k.children);
      }
      return check(k.children);
    });
  return check(n.children);
}

const anyDisabled = (n) => n.style?.disabled === 'true' || (n.children ?? []).some(anyDisabled);
const count = (nodes) => nodes.reduce((sum, n) => sum + 1 + count(n.children ?? []), 0);

/** A component's props on one line, callbacks and long values kept short. */
function props(p) {
  if (!p) return '';
  const parts = Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'string' ? (v.startsWith('(') ? v : JSON.stringify(v)) : JSON.stringify(v)}`);
  const line = parts.join(', ');
  return line.length > 260 ? `${line.slice(0, 260)}…` : line;
}

function line(n, folded) {
  const head = n.type === 'page' ? `Page \`${n.name}\`` : n.type === 'component' ? `**${n.name}**` : NAME[n.type];
  const text = n.text ? ` "${n.text.length > 90 ? `${n.text.slice(0, 90)}…` : n.text}"` : '';
  const box = `${n.box[0]},${n.box[1]} ${n.box[2]}×${n.box[3]}`;
  const style = Object.entries(n.style ?? {})
    .filter(([k]) => k !== 'disabled')
    .map(([k, v]) => (v === 'true' ? k : k === 'textStyle' || k === 'color' ? v : `${k} ${v}`));
  if (folded ? anyDisabled(n) : n.style?.disabled === 'true') style.push('disabled');
  const p = n.type === 'component' ? props(n.props) : '';
  return [`${head}${text}`, box, ...style, ...(p ? [`props { ${p} }`] : [])].join(' · ');
}

/**
 * `marked`: the screen exists in Live, so each node says whether it's the proposal's (`+`, not in Live) and what's
 * unchanged is folded.
 */
export function outline(nodes, { marked = false } = {}, depth = 0) {
  let out = '';
  let same = [];
  const flush = () => {
    if (same.length) out += `${'  '.repeat(depth)}- … ${count(same)} unchanged (${[...new Set(same.map((n) => (n.type === 'component' ? n.name : n.type === 'page' ? `Page ${n.name}` : NAME[n.type])))].slice(0, 6).join(', ')})\n`;
    same = [];
  };
  for (const n of nodes) {
    if (marked && !n.new && !n.changed) {
      same.push(n);
      continue;
    }
    flush();
    const folded = n.type === 'component' && !!n.children && ownInsides(n);
    out += `${'  '.repeat(depth)}- ${marked && n.new ? '+ ' : ''}${line(n, folded)}\n`;
    if (n.children && !folded) out += outline(n.children, { marked: marked && !n.new }, depth + 1);
  }
  flush();
  return out;
}

/** What a node is, apart from where it is: the same in Live means the proposal left it. */
const signature = (n) => JSON.stringify([n.type, n.name ?? null, n.text ?? null, n.props ?? null]);

/**
 * Marks what the proposal adds against Live's tree of the same screen: `new` on a node Live doesn't have (a new
 * component, a text that reads differently), `changed` on what holds one. Returns how many are new.
 */
export function markAgainst(nodes, live) {
  const pool = new Map();
  const collect = (list) => list.forEach((n) => (pool.set(signature(n), (pool.get(signature(n)) ?? 0) + 1), collect(n.children ?? [])));
  collect(live);
  let fresh = 0;
  const walk = (list) => {
    let any = false;
    for (const n of list) {
      const sig = signature(n);
      const left = pool.get(sig) ?? 0;
      if (left > 0) pool.set(sig, left - 1);
      else if (n.type === 'component' || n.type === 'text' || n.type === 'icon' || n.type === 'page') {
        n.new = true;
        fresh++;
      }
      // What's inside something new came with it: not looked for in Live (it would take another's place there).
      const inside = n.new ? false : walk(n.children ?? []);
      // A node whose every child is new came with them.
      if (!n.new && inside) n.changed = true;
      any = any || !!n.new || inside;
    }
    return any;
  };
  walk(nodes);
  return fresh;
}
