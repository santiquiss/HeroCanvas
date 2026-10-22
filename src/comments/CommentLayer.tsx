// The comments on the canvas: a pin per open thread on each device it was left on (one device, or a set side by side),
// the thread beside its pin, and the box to write a new one. In comment mode a click on any device places a pin instead
// of reaching the app (Inspect does the same). Pins are measured each frame only while they're shown, and re-render only
// when one moved — like the Inspect outlines.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useDesign } from '../design/DesignContext';
import { Icon } from '../components/Icon';
import { rememberAuthor } from '../persist/author';
import { anchorAt, anchorElement, coveredAt, pageLayer, pagesAbove, pointIn, screenOf, screensIn, showsOn } from './anchor';
import { screenScope, useCanvasDesigns, useCommentScope, useCommentsUi } from './CommentsContext';
import { addComment, newCommentId, useCommentsOf } from './store';
import { Avatar, ReplyField, ResolveButton, sendOnEnter, SendButton, ThreadMessages, useAuthorName } from './parts';
import { commentLink, resolverName, threadNumbers, threadsOf, timeAgo } from './threads';
import { MAX_AUTHOR, MAX_BODY, type CommentAnchor, type CommentKind } from './types';
import styles from './Comments.module.css';
import { t } from '../i18n/ui';

interface Draft {
  page: string;
  anchor: CommentAnchor;
  design: string;
  variant: string | null;
  /** The device frame it's on. */
  frame: HTMLElement;
}

interface Placed {
  /** The thread's id (or `draft`), and which frame: a thread can show on two of the same device. */
  id: string;
  key: string;
  x: number;
  y: number;
}

export default function CommentLayer({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  const { commenting, selected, setSelected, panelOpen, showResolved } = useCommentsUi();
  const { version } = useDesign();
  const global = useCommentScope();
  const [search] = useSearchParams();
  const devicesParam = search.get('devices');
  const comments = useCommentsOf(useCanvasDesigns(), { fresh: commenting || panelOpen });
  const [draft, setDraft] = useState<Draft | null>(null);
  // The pin the open thread was opened from (a thread can have one on each of two devices).
  const [openKey, setOpenKey] = useState<string | null>(null);
  const location = useLocation();

  // Leaving comment mode drops an unsent pin; so does another design.
  useEffect(() => {
    if (!commenting) setDraft(null);
  }, [commenting]);
  useEffect(() => setDraft(null), [global.design]);

  // In comment mode a click on a device places the new pin there; the app doesn't see it.
  useEffect(() => {
    if (!commenting) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      const on = screenOf(t);
      if (!on || !stage.current?.contains(on.el)) return;
      e.preventDefault();
      e.stopPropagation();
      const at = anchorAt(on.el, t, e.clientX, e.clientY);
      const scope = screenScope(on.screen, global);
      // On a bare canvas (the gallery) the pin isn't any device's.
      const device = on.screen.bare ? {} : { device: on.screen.device, display: on.screen.display };
      if (at) setDraft({ page: at.page, anchor: { ...at.anchor, ...device }, design: scope.design, variant: scope.variant, frame: on.el });
      setSelected(null);
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [commenting, stage, global, setSelected]);

  const threads = useMemo(() => threadsOf(comments), [comments]);
  // The pins shown: every open thread in comment mode or while the Comments panel shows (the resolved ones too while it
  // lists them: its Resolved filter); otherwise only the open one.
  const all = commenting || panelOpen;
  const resolvedToo = panelOpen && showResolved;
  const shown = useMemo(
    () => threads.filter((t) => t.root.anchor && (t.root.id === selected || (all && (!t.root.resolvedAt || resolvedToo)))),
    [threads, selected, all, resolvedToo],
  );

  const [placed, setPlaced] = useState<Placed[]>([]);
  const raf = useRef(0);
  useEffect(() => {
    const st = stage.current;
    if ((!shown.length && !draft) || !st) {
      setPlaced([]);
      return;
    }
    // Each pin's frame and the element it follows, found once per change of the screens' DOM (`version`), not every
    // frame: a thread shows on the frames of its device that show its version.
    const frames = screensIn(st).map((f) => ({ ...f, scope: screenScope(f.screen, global), shown: (!f.screen.bare && f.el.querySelector<HTMLElement>('[data-theme]')) || f.el }));
    const targets = frames.flatMap((f, i) => [
      ...shown
        .filter(({ root }) => root.design === f.scope.design && (!root.variant || !f.scope.variant || root.variant === f.scope.variant) && showsOn(root.anchor!, f.screen))
        .map(({ root }) => ({ id: root.id, key: `${root.id}@${i}`, page: root.page, anchor: root.anchor!, frame: f })),
      ...(draft && draft.frame === f.el ? [{ id: 'draft', key: 'draft', page: draft.page, anchor: draft.anchor, frame: f }] : []),
    ]);
    const els = targets.map((t) => {
      const pageEl = pageLayer(t.frame.el, t.page, t.anchor.story);
      const at = pageEl && anchorElement(t.frame.el, pageEl, t.anchor);
      // A sheet's component is over every page; a page's can be under one pushed over it (not on a bare canvas's).
      return at ? { t, pageEl, above: t.anchor.overlay || t.frame.screen.bare ? [] : pagesAbove(t.frame.el, pageEl), ...at } : null;
    });
    let last = '';
    const loop = () => {
      const origin = st.getBoundingClientRect();
      const next: Placed[] = [];
      for (const e of els) {
        // A page under another (covered) is hidden by its layer's inline style; a closed sheet's component is gone.
        if (!e || !e.pageEl.isConnected || !e.el.isConnected || e.pageEl.style.visibility === 'hidden') continue;
        const sr = e.t.frame.shown.getBoundingClientRect();
        const r = e.el.getBoundingClientRect();
        const p = e.onComponent ? pointIn(r, e.t.anchor.ox, e.t.anchor.oy) : pointIn(e.pageEl.getBoundingClientRect(), e.t.anchor.x, e.t.anchor.y);
        // Scrolled out of its screen, or under a page pushed over its own: no pin.
        if (p.x < sr.left || p.x > sr.right || p.y < sr.top || p.y > sr.bottom || coveredAt(e.above, p.x, p.y)) continue;
        next.push({ id: e.t.id, key: e.t.key, x: Math.round(p.x - origin.left), y: Math.round(p.y - origin.top) });
      }
      const key = next.map((n) => `${n.key}:${n.x},${n.y}`).join('|');
      if (key !== last) {
        last = key;
        setPlaced(next);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [shown, draft, version, devicesParam, location.pathname, stage, global]);

  const byId = new Map(shown.map((t) => [t.root.id, t]));
  const numbers = useMemo(() => threadNumbers(threads), [threads]);
  const draftAt = placed.find((p) => p.id === 'draft');
  const openAt = placed.find((p) => p.key === openKey && p.id === selected) ?? placed.find((p) => p.id === selected);
  const open = selected ? byId.get(selected) : undefined;
  const box = { w: stage.current?.clientWidth ?? 0, h: stage.current?.clientHeight ?? 0 };

  return (
    <div className={styles.layer}>
      {placed.map((p) => {
        if (p.id === 'draft') return <span key="draft" className={`${styles.pin} ${styles.pinDraft}`} style={{ left: p.x, top: p.y }} />;
        const t = byId.get(p.id);
        if (!t) return null;
        const { root } = t;
        return (
          <button
            key={p.key}
            className={`${styles.pin} ${p.id === selected ? styles.pinOn : ''} ${root.resolvedAt ? styles.pinResolved : ''}`}
            style={{ left: p.x, top: p.y }}
            title={`${root.author}: ${root.body}`}
            onClick={() => {
              setOpenKey(p.key);
              setSelected(p.id === selected ? null : p.id);
            }}
          >
            <Avatar name={root.author} size={26} />
          </button>
        );
      })}
      {open && openAt && (
        <Popover key={open.root.id} at={openAt} box={box} width={THREAD_W} onEscape={() => setSelected(null)}>
          <div className={styles.popHead}>
            {/* "Comment" the noun, not the toolbar's action (also "Comment" in English): its own key, the number after it. */}
            <span className={styles.popTitle}>{t('Comment {number}').replace(/\s*\{number\}\s*/, '')}</span>
            <span className={styles.number}>#{numbers.get(open.root.id)}</span>
            <span style={{ flex: 1 }} />
            <ResolveButton thread={open} />
            <button className={styles.iconBtn} onClick={() => setSelected(null)} title={t('Close (Esc)')} aria-label={t('Close')}>
              <Icon name="close" size={20} />
            </button>
          </div>
          {open.root.resolvedAt && (
            <div className={styles.resolvedNote}>
              <Icon name="check_circle" size={14} fill />
              {t('Resolved by {name} · {when}', { name: resolverName(open.root.resolvedBy), when: timeAgo(open.root.resolvedAt) })}
            </div>
          )}
          <div className={styles.popBody}>
            <ThreadMessages thread={open} />
          </div>
          <div className={styles.popFoot}>
            <ReplyField thread={open} autoFocus />
          </div>
        </Popover>
      )}
      {draft && draftAt && (
        <Popover at={draftAt} box={box} width={COMPOSER_W} bare onEscape={() => setDraft(null)}>
          <Composer
            onPost={async (kind, author, body) => {
              await addComment({
                id: newCommentId(),
                createdAt: new Date().toISOString(),
                design: draft.design,
                variant: draft.variant,
                page: draft.page,
                link: commentLink(location.pathname, location.search),
                anchor: draft.anchor,
                parentId: null,
                kind,
                author,
                body,
                resolvedAt: null,
                resolvedBy: null,
              });
              setDraft(null);
            }}
          />
        </Popover>
      )}
    </div>
  );
}

const COMPOSER_W = 320;
const THREAD_W = 340;
/** The pin's size: what's beside it starts past it. */
const PIN = 30;

/**
 * A card beside a pin (on the side with room), its top level with the pin's, kept inside the canvas; what doesn't fit
 * scrolls in it.
 */
function Popover({ at, box, width, bare = false, onEscape, children }: { at: Placed; box: { w: number; h: number }; width: number; bare?: boolean; onEscape: () => void; children: React.ReactNode }) {
  const left = at.x + PIN + 8 + width > box.w ? Math.max(8, at.x - 8 - width) : at.x + PIN + 8;
  const top = Math.max(8, Math.min(at.y - PIN, box.h - 160));
  return (
    <div className={bare ? styles.popBare : styles.popover} style={{ left, top, width, maxHeight: Math.max(160, box.h - top - 8) }} onKeyDown={(e) => e.key === 'Escape' && onEscape()}>
      {children}
    </div>
  );
}

/** A new comment, as in Figma: the text and the round send button. Your name the first time. */
function Composer({ onPost }: { onPost: (kind: CommentKind, author: string, body: string) => Promise<void> }) {
  // What a comment is about isn't asked for now (no tags): every one is filed as design, which the store still keeps.
  const kind: CommentKind = 'design';
  const { name, setName, ask } = useAuthorName();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!body.trim() && !!name.trim() && !sending;
  const post = async () => {
    if (!ready) return;
    setSending(true);
    setError(null);
    rememberAuthor({ name: name.trim() });
    try {
      await onPost(kind, name.trim(), body.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  };
  return (
    <div className={styles.composer}>
      {ask && <input className={styles.composerName} placeholder={t('Your name')} maxLength={MAX_AUTHOR} value={name} autoFocus onChange={(e) => setName(e.target.value)} />}
      <textarea
        className={styles.composerText}
        autoFocus={!ask}
        placeholder={t('Add a comment')}
        maxLength={MAX_BODY}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={sendOnEnter(() => void post())}
      />
      {error && <span className={styles.error} style={{ padding: '0 12px 8px' }}>{error}</span>}
      <div className={styles.composerBar}>
        <span />
        <SendButton ready={ready} label={t('Post')} onClick={() => void post()} />
      </div>
    </div>
  );
}
