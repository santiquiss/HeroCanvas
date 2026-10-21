// Designer state shared by the device (event capture), the overlay and the panels.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { closestComponent } from './component';

interface Design {
  /** Inspect mode: hovering highlights components, clicking selects instead of interacting. */
  inspect: boolean;
  setInspect: (on: boolean) => void;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  /** What a click picks: the component under it, or the element itself (a text, a shape, a container). */
  scope: InspectScope;
  setScope: (scope: InspectScope) => void;
  /**
   * An element picked on its own (scope `all`, or a ⌘-click in `components`): not a component instance, so it's
   * the element itself, kept while it's on screen. With one, `hovered` / `selected` (a component) are null.
   */
  hoveredEl: Element | null;
  setHoveredEl: (el: Element | null) => void;
  selectedEl: Element | null;
  setSelectedEl: (el: Element | null) => void;
  /** The inspectable root: the device screen, or the gallery canvas. */
  rootRef: RefObject<HTMLElement | null>;
  /** Callback ref for whichever element is the inspectable root. */
  setRoot: (el: HTMLElement | null) => void;
  /** Hover / click capture for the root while Inspect is on. */
  captureProps: {
    onPointerMoveCapture?: (e: React.PointerEvent) => void;
    onPointerLeave?: () => void;
    onClickCapture?: (e: React.MouseEvent) => void;
  };
  /** Bumps when instrumented elements are added or removed (Layers rebuilds on it). */
  version: number;
  /** Device px per screen px (the frame is scaled to fit the stage). */
  scale: number;
}

/** `components`: the component under the pointer. `all`: the deepest element under it. */
export type InspectScope = 'components' | 'all';

const DesignCtx = createContext<Design | null>(null);

/** The slice the inspectable root needs. Separate so hovering and Layers updates don't re-render the device. */
type DesignRoot = Pick<Design, 'inspect' | 'setRoot' | 'captureProps'>;
const DesignRootCtx = createContext<DesignRoot | null>(null);

export function useDesignRoot(): DesignRoot {
  const d = useContext(DesignRootCtx);
  if (!d) throw new Error('useDesignRoot outside <DesignProvider>');
  return d;
}

export function useDesign(): Design {
  const d = useContext(DesignCtx);
  if (!d) throw new Error('useDesign outside <DesignProvider>');
  return d;
}

export const elementById = (root: Element | null, id: string | null) =>
  id && root ? (root.querySelector(`[data-hc="${id}"]`) as HTMLElement | null) : null;

export function DesignProvider({
  scale,
  allOnly = false,
  children,
}: {
  scale: number;
  /** Every element selectable, no Components / All choice (the gallery: it's all components there). */
  allOnly?: boolean;
  children: ReactNode;
}) {
  const [inspect, setInspectRaw] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelectedId] = useState<string | null>(null);
  // Any element by default (a text, a shape, a container); Components picks whole components.
  const [chosenScope, setScope] = useState<InspectScope>('all');
  const scope: InspectScope = allOnly ? 'all' : chosenScope;
  const [hoveredEl, setHoveredElRaw] = useState<Element | null>(null);
  const [selectedEl, setSelectedElRaw] = useState<Element | null>(null);
  // One selection at a time: a component, or an element on its own.
  const setSelected = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedElRaw(null);
  }, []);
  // An element that is a component's own root is that component, never a layer of it (SectionHeader, not "Row").
  const componentOf = (el: Element | null) => (el instanceof HTMLElement && el.dataset.hc) || null;
  const setSelectedEl = useCallback(
    (el: Element | null) => {
      const id = componentOf(el);
      if (id) return setSelected(id);
      setSelectedElRaw(el);
      if (el) setSelectedId(null);
    },
    [setSelected],
  );
  const setHoveredEl = useCallback((el: Element | null) => {
    const id = componentOf(el);
    setHoveredElRaw(id ? null : el);
    if (id) setHovered(id);
  }, []);
  const [version, setVersion] = useState(0);
  const rootRef = useRef<HTMLElement | null>(null);
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  const setRoot = useCallback((el: HTMLElement | null) => {
    rootRef.current = el;
    setRootEl(el);
  }, []);

  // Leaving Inspect drops the hover and the selection.
  const setInspect = useCallback((on: boolean) => {
    setInspectRaw(on);
    if (!on) {
      setHovered(null);
      setHoveredEl(null);
      setSelected(null);
    }
  }, [setSelected]);

  // A press on the empty canvas (`data-canvas`: around the device, the gallery's margins, at any zoom) clears the
  // selection. Presses inside the root select; the canvas's controls (the view and zoom bars), the panels and the
  // toolbar keep it.
  useEffect(() => {
    if (!inspect) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest('[data-canvas]') || rootRef.current?.contains(t)) return;
      if (t.closest('button, a, input, select, label, textarea, [data-canvas-ui]')) return;
      setSelected(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [inspect, setSelected]);

  // Watch the device DOM so Layers stays in sync with navigation and re-renders.
  useEffect(() => {
    const root = rootEl;
    setVersion((v) => v + 1);
    if (!root) return;
    let t = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setVersion((v) => v + 1), 80);
    });
    mo.observe(root, { childList: true, subtree: true });
    // A page sliding over another (or away) changes what shows without changing the DOM: once it has settled.
    const settled = (e: TransitionEvent) => {
      if (e.target instanceof HTMLElement && e.target.dataset.hcPage !== undefined && e.propertyName === 'transform') setVersion((v) => v + 1);
    };
    root.addEventListener('transitionend', settled);
    return () => {
      mo.disconnect();
      root.removeEventListener('transitionend', settled);
      window.clearTimeout(t);
    };
  }, [rootEl]);

  // Drop a selection whose element is gone (navigated away).
  useEffect(() => {
    if (selected && !elementById(rootRef.current, selected)) setSelected(null);
    if (selectedEl && !rootRef.current?.contains(selectedEl)) setSelectedEl(null);
    if (hoveredEl && !rootRef.current?.contains(hoveredEl)) setHoveredEl(null);
  }, [version, selected, selectedEl, hoveredEl, setSelected, setSelectedEl]);

  // Keyboard: I toggles Inspect, Esc clears the selection (or leaves Inspect).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey) setInspect(!inspect);
      if (e.key === 'Escape') {
        if (selected || selectedEl) setSelected(null);
        else if (inspect) setInspect(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect, selected, selectedEl, setInspect, setSelected]);

  const captureProps = useMemo(() => {
    if (!inspect) return {};
    const idAt = (t: EventTarget) => closestComponent(t as Element, rootRef.current)?.dataset.hc ?? null;
    // The element itself: in the `all` scope, or with ⌘ / Ctrl held in `components` (Figma's deep select).
    const deep = (e: { metaKey: boolean; ctrlKey: boolean }) => scope === 'all' || e.metaKey || e.ctrlKey;
    // Only what the app draws: in a page (a screen, a gallery example) or a component (the nav). Around them — the
    // gallery's docs and its grid — is the tool's, so a click there picks nothing (and clears the selection).
    const elAt = (t: EventTarget) => (t instanceof Element && t !== rootRef.current && rootRef.current?.contains(t) && t.closest('[data-hc-page], [data-hc]') ? t : null);
    return {
      onPointerMoveCapture: (e: React.PointerEvent) => {
        // The element first: one that is a component's root sets the component as hovered.
        if (deep(e)) {
          setHovered(null);
          setHoveredEl(elAt(e.target));
        } else {
          setHoveredEl(null);
          setHovered(idAt(e.target));
        }
      },
      onPointerLeave: () => {
        setHovered(null);
        setHoveredEl(null);
      },
      // The app never sees the click: it selects instead.
      onClickCapture: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (deep(e)) setSelectedEl(elAt(e.target));
        else setSelected(idAt(e.target));
      },
    };
  }, [inspect, scope, setSelected, setSelectedEl, setHoveredEl]);

  const value = useMemo(
    () => ({ inspect, setInspect, hovered, setHovered, selected, setSelected, scope, setScope, hoveredEl, setHoveredEl, selectedEl, setSelectedEl, rootRef, setRoot, captureProps, version, scale }),
    [inspect, setInspect, hovered, selected, setSelected, scope, hoveredEl, setHoveredEl, selectedEl, setSelectedEl, setRoot, captureProps, version, scale],
  );
  const root = useMemo(() => ({ inspect, setRoot, captureProps }), [inspect, setRoot, captureProps]);
  return (
    <DesignCtx.Provider value={value}>
      <DesignRootCtx.Provider value={root}>{children}</DesignRootCtx.Provider>
    </DesignCtx.Provider>
  );
}
