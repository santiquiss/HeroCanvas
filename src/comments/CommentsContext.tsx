// Comment mode and the open thread, shared by the toolbar, the pins on the device and the panel. Small and loaded with
// the designer; the pins and the panel (CommentLayer, CommentsPanel) load the first time they're needed.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useNavRoot } from '../nav/context';
import { activeVariant, findProposal, VARIANT_PARAM } from '../proposals';
import { designChoice, parseDevices } from '../sim/deviceSet';
import { useUrlState } from '../sim/SimContext';
import { COMMENT_PARAM, LIVE, type Comment } from './types';

/**
 * A pin to bring into view on the canvas (CommentLayer): scrolled to in its screen. `go`: when its pin can't show on
 * the canvas as it is (another page, version or device), the view it was left on is opened. A new one each time, so
 * asking again for the same pin works.
 */
export interface Reveal {
  root: Comment;
  go: boolean;
}

interface CommentsUi {
  /** Comment mode: a click on the screen places a pin instead of reaching the app. */
  commenting: boolean;
  setCommenting: (on: boolean) => void;
  /** The thread open in the panel (and highlighted on the device). */
  selected: string | null;
  setSelected: (id: string | null) => void;
  /** The Comments panel is showing: the pins show too, as in comment mode. */
  panelOpen: boolean;
  setPanelOpen: (on: boolean) => void;
  /** The panel's Resolved filter: resolved threads are listed, and their pins show while the panel does. */
  showResolved: boolean;
  setShowResolved: (on: boolean) => void;
  reveal: Reveal | null;
  setReveal: (r: Reveal | null) => void;
  /** The comment the URL links to (`?comment=`), until the pins open it (CommentLayer). */
  linked: string | null;
  setLinked: (id: string | null) => void;
}

const Ctx = createContext<CommentsUi | null>(null);

export function useCommentsUi(): CommentsUi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCommentsUi outside <CommentsProvider>');
  return c;
}

/** Whether comment mode is on, anywhere (false outside the comments' provider: a frame in Flow or the gallery). */
export function useCommenting(): boolean {
  return useContext(Ctx)?.commenting ?? false;
}

/** What's being commented on: Live or the proposal, and the proposal's version on screen. */
export function useCommentScope(): { design: string; variant: string | null } {
  const { proposal } = useNavRoot();
  const [param] = useUrlState<string>(VARIANT_PARAM, '');
  const design = proposal?.id ?? LIVE;
  const variant = proposal ? (activeVariant(proposal, param || null)?.id ?? null) : null;
  return useMemo(() => ({ design, variant }), [design, variant]);
}

/** Every version on the canvas, as comments' designs: the toolbar's, and those a set's devices show of their own. */
export function useCanvasDesigns(): string[] {
  const global = useCommentScope();
  const [search] = useSearchParams();
  const devices = search.get('devices');
  return useMemo(() => [global.design, ...parseDevices(devices).map((it) => screenScope(it, global).design)], [devices, global]);
}

/**
 * What a device on the canvas shows, as a comment's design and version: its own (a set's device can show Live, another
 * proposal or another version: `design`, as in sim/deviceSet), else the toolbar's.
 */
export function screenScope(screen: { design?: string }, global: { design: string; variant: string | null }): { design: string; variant: string | null } {
  const c = designChoice(screen.design);
  if (!c) return global;
  if (!c.proposal) return { design: LIVE, variant: null };
  const p = findProposal(c.proposal);
  return p ? { design: p.id, variant: activeVariant(p, c.variant)?.id ?? null } : { design: c.proposal, variant: c.variant };
}

/** `exclusive`: what turns off while commenting (Inspect), and turns commenting off when it comes on. */
export function CommentsProvider({ exclusive, onExclusive, children }: { exclusive: boolean; onExclusive: (on: boolean) => void; children: ReactNode }) {
  const [commenting, setCommentingRaw] = useState(false);
  const [search] = useSearchParams();
  // Opened from a link to a comment: it's the open one (its pins load for it), and they open it once it's in.
  const [linked, setLinked] = useState<string | null>(() => search.get(COMMENT_PARAM));
  const [selected, setSelected] = useState<string | null>(linked);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const setCommenting = useCallback(
    (on: boolean) => {
      setCommentingRaw(on);
      if (on) onExclusive(false);
    },
    [onExclusive],
  );
  // The comment cursor over the devices (CommentsEager.module.css): one attribute, wherever the frames are.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-hc-commenting', commenting);
    return () => document.documentElement.removeAttribute('data-hc-commenting');
  }, [commenting]);
  // Inspect coming on ends comment mode.
  useEffect(() => {
    if (exclusive) setCommentingRaw(false);
  }, [exclusive]);
  // C toggles comment mode (as in Figma); Esc closes the open thread, then leaves it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) setCommenting(!commenting);
      else if (e.key === 'Escape' && selected) setSelected(null);
      else if (e.key === 'Escape' && commenting) setCommentingRaw(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commenting, setCommenting, selected]);
  const value = useMemo(
    () => ({ commenting, setCommenting, selected, setSelected, panelOpen, setPanelOpen, showResolved, setShowResolved, reveal, setReveal, linked, setLinked }),
    [commenting, setCommenting, selected, panelOpen, showResolved, reveal, linked],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
