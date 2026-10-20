// The Inspect selection in the URL (`?sel=ListTile.2`), so a link opens the simulator on a component, inspected: the
// handoff link for a developer. The address is the component's name and which one it is on the screen (1-based, in
// document order), stable across reloads; instance ids (`data-hc`) aren't. Not a sim param: it isn't carried across
// pages, the element belongs to this one.
import { useEffect, useRef } from 'react';
import { useUrlState } from '../sim/SimContext';
import { elementById, useDesign } from './DesignContext';
import { componentInstance } from './component';

const PARAM = 'sel';

/** The instances named `name` in `root`, in document order. */
const named = (root: Element, name: string) => [...root.querySelectorAll<HTMLElement>('[data-hc]')].filter((e) => componentInstance(e.dataset.hc)?.name === name);

function addressOf(root: Element, id: string): string | null {
  const name = componentInstance(id)?.name;
  const el = elementById(root, id);
  if (!name || !el) return null;
  return `${name}.${named(root, name).indexOf(el) + 1}`;
}

function idAt(root: Element, address: string): string | null {
  const dot = address.lastIndexOf('.');
  const name = dot > 0 ? address.slice(0, dot) : address;
  const n = dot > 0 ? Number(address.slice(dot + 1)) || 1 : 1;
  return named(root, name)[n - 1]?.dataset.hc ?? null;
}

export function SelectionInUrl() {
  const { selected, setSelected, setInspect, rootRef, version } = useDesign();
  const [sel, setSel] = useUrlState<string>(PARAM, '');
  // The address the selection and the URL last agreed on: tells a link to follow from our own write.
  const synced = useRef<string | null>(null);
  // The selection before this change: still in the DOM means the user cleared it, gone means it re-mounted.
  const last = useRef<string | null>(null);

  // URL → selection: a link selects its component once the page has rendered it (retried as the DOM changes).
  useEffect(() => {
    const root = rootRef.current;
    if (!sel || sel === synced.current || !root) return;
    const id = idAt(root, sel);
    if (!id) return;
    synced.current = sel;
    setInspect(true);
    setSelected(id);
  }, [sel, version, rootRef, setInspect, setSelected]);

  // Selection → URL, written when it changes (a click), not while hovering; restored if a navigation drops it.
  useEffect(() => {
    const root = rootRef.current;
    const prev = last.current;
    last.current = selected;
    if (!selected) {
      if (!sel || sel !== synced.current) return;
      // Cleared with its element still on screen (Esc, a click around): drop the address. Its element gone (the
      // page re-mounted with new ids): select the component at the same address again.
      if (root && prev && elementById(root, prev)) {
        synced.current = null;
        setSel(null);
      } else if (root && idAt(root, sel)) setSelected(idAt(root, sel));
      else synced.current = null;
      return;
    }
    const address = root ? addressOf(root, selected) : null;
    // Unchanged, or another link waiting for its component to render.
    if (!address || address === sel || (sel && sel !== synced.current)) return;
    synced.current = address;
    setSel(address);
  }, [selected, sel, rootRef, setSel, setSelected]);

  return null;
}
