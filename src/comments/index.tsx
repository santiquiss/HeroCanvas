// The comments plugin, as the designer plugs it in: the toolbar's Comment button, the pins over the device, the
// Comments panel, and the open counts (the panel's tab, the Flow cards). The pins and the panel are loaded the first
// time they're needed (their own chunk); what's here is small and reads the shared store (store.ts).
import { lazy, Suspense, useEffect, useState, type RefObject } from 'react';
import { Icon } from '../components/Icon';
import { useCommentScope, useCommentsUi } from './CommentsContext';
import { useComments } from './store';
import { openByPage } from './threads';
import styles from './CommentsEager.module.css';

export { CommentsProvider, useCommentsUi } from './CommentsContext';

const Layer = lazy(() => import('./CommentLayer'));
const Panel = lazy(() => import('./CommentsPanel'));

/** The pins over the device (the stage's coordinates, like the Inspect outlines). Loaded on the first use. */
export function CommentPins({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  const { commenting, selected, panelOpen } = useCommentsUi();
  const [used, setUsed] = useState(false);
  if ((commenting || selected || panelOpen) && !used) setUsed(true);
  return used ? (
    <Suspense fallback={null}>
      <Layer stage={stage} />
    </Suspense>
  ) : null;
}

/** The Comments tool (tools/registry). While it shows, so do the pins. */
export function CommentsTool() {
  const { setPanelOpen } = useCommentsUi();
  useEffect(() => {
    setPanelOpen(true);
    return () => setPanelOpen(false);
  }, [setPanelOpen]);
  return (
    <Suspense fallback={null}>
      <Panel />
    </Suspense>
  );
}

function useOpenCounts() {
  const { design } = useCommentScope();
  return openByPage(useComments(design).comments);
}

/** The tab's count: the open threads of what's on screen (Live or the proposal). */
export function CommentsBadge() {
  let n = 0;
  for (const c of useOpenCounts().values()) n += c;
  return n ? <span className={styles.count}>{n}</span> : null;
}

/** A page's open threads, on its Flow card. */
export function PageCommentCount({ page }: { page: string }) {
  const n = useOpenCounts().get(page) ?? 0;
  return n ? (
    <span className={styles.flowCount} title={`${n} open ${n === 1 ? 'comment' : 'comments'}`}>
      <Icon name="chat_bubble" size={11} fill />
      {n}
    </span>
  ) : null;
}
