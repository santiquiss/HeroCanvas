// The Comments panel, as Figma's: a search, the filters (this screen, or component in the gallery; or all of them, Live's
// and every proposal's, by proposal; resolved) and the threads, newest first. A thread opens beside its pin on the
// canvas and here, where it unfolds with its replies; opening one takes the canvas to its pin: scrolled into view, or
// the view it was left on when it isn't on the canvas.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { findDevice } from '../devices/devices';
import { useGalleryRoute } from '../gallery/route';
import { useNavRoot } from '../nav/context';
import { composePages } from '../nav/manifest';
import { pageName, type Manifest } from '../nav/stack';
import { SIDE_PANEL_PAGE, sidePanelOnIn } from '../nav/sidePanel';
import { findProposal, proposalLabel } from '../proposals';
import { useMode } from '../sim/modes';
import { CheckDropdown } from '../tools/CheckDropdown';
import { SearchField } from '../tools/SearchField';
import { openSheetOf } from './anchor';
import { useCanvasDesigns, useCommentScope, useCommentsUi } from './CommentsContext';
import { CommentText } from './MentionField';
import { Avatar, EditField, Message, OwnActions, ReplyField, ResolveButton, useMine, When } from './parts';
import { ALL_DESIGNS, commentsShared, refresh, useAllComments, useComments, useCommentsOf } from './store';
import { commentLink, filterThreads, resolverName, threadMatches, threadNumbers, threadsOf, timeAgo, type Thread } from './threads';
import { componentOfPage, componentPage, LIVE } from './types';
import panel from '../tools/Panel.module.css';
import styles from './Comments.module.css';
import { plural, t } from '../i18n/ui';

export default function CommentsPanel() {
  const { design, variant } = useCommentScope();
  // Loading and errors are the toolbar version's; the threads, every version's on the canvas (a set's devices).
  const canvasDesigns = useCanvasDesigns();
  const state = useComments(design, { fresh: true });
  const canvas = useCommentsOf(canvasDesigns, { fresh: true });
  const { selected, setSelected, commenting, setCommenting, showResolved: resolved, setShowResolved: setResolvedShown, setReveal } = useCommentsUi();
  const nav = useNavRoot();
  const mode = useMode();
  const gallery = useGalleryRoute().name;
  const navigate = useNavigate();
  const location = useLocation();
  const [scope, setScope] = useState<'page' | 'all'>('page');
  const [query, setQuery] = useState('');
  // All: which designs (Live, proposals); none picked is every one.
  const [picked, setPicked] = useState<string[]>([]);
  // What's on the canvas: the screen's pages in the prototype (and the side panel, when it's on), a component's page in
  // the gallery; in Flow (and the gallery's overview) no one page: all of them.
  const onScreen = new Set(
    mode === 'prototype'
      ? [...nav.stack.map((r) => r.id), ...(SIDE_PANEL_PAGE && sidePanelOnIn(new URLSearchParams(location.search)) ? [SIDE_PANEL_PAGE] : [])]
      : mode === 'components' && gallery
        ? [componentPage(gallery)]
        : [],
  );
  const hasScope = onScreen.size > 0;
  const everything = !hasScope || scope === 'all';
  // All of them: every design's, in one request, loaded only once asked for.
  const allState = useAllComments(everything, { fresh: true });
  const comments = everything ? allState.comments : canvas;
  const shown = everything ? allState : state;
  const threadsAll = useMemo(() => threadsOf(comments), [comments]);
  const numbers = useMemo(() => threadNumbers(threadsAll), [threadsAll]);
  // The designs with comments, for the filter: Live first, then the proposals by code.
  const designs = useMemo(() => {
    const ds = [...new Set(threadsAll.map((t) => t.root.design))];
    return ds.sort((a, b) => (a === LIVE ? -1 : b === LIVE ? 1 : a.localeCompare(b, undefined, { numeric: true })));
  }, [threadsAll]);
  const label = (t: Thread) => componentOfPage(t.root.page) ?? pageName(pagesOf(t.root.design, nav.proposal?.id, nav.pages), t.root.page);
  const threads = (everything ? filterThreads(threadsAll, { resolved }) : filterThreads(threadsAll, { resolved, variant })).filter(
    (t) =>
      (everything ? !picked.length || picked.includes(t.root.design) : onScreen.has(t.root.page) || t.root.id === selected) &&
      threadMatches(t, query, label(t)),
  );
  const here = commentLink(location.pathname, location.search);
  const open = (t: Thread) => {
    if (t.root.id === selected) return setSelected(null);
    setSelected(t.root.id);
    // Left on another page or design: the canvas goes to the view it was left on, and the sheet it's on (over its
    // page: not under another one pushed over it). Then (or here already) its pin is scrolled into view; when it can't
    // show as the canvas is (another version or device, a page over it), the canvas goes to its view too.
    const sheetElsewhere = !!t.root.anchor?.sheet && location.pathname !== t.root.link.split('?')[0];
    const elsewhere = !onScreen.has(t.root.page) || !canvasDesigns.includes(t.root.design) || sheetElsewhere;
    if (elsewhere) navigate(t.root.link);
    openSheetOf(t.root);
    setReveal({ root: t.root, go: !elsewhere });
  };

  return (
    <>
      <SearchField value={query} placeholder={t('Search comments')} onChange={setQuery} />
      {!commentsShared() && <SharingNote />}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          {hasScope ? (
            <div className={styles.segmented} role="radiogroup" aria-label={t('Pages')}>
              {(['page', 'all'] as const).map((s) => (
                <button key={s} role="radio" aria-checked={scope === s} className={scope === s ? styles.segOn : ''} onClick={() => setScope(s)}>
                  {s === 'page' ? (mode === 'components' ? t('This component') : t('This screen')) : t('All comments')}
                </button>
              ))}
            </div>
          ) : (
            <span className={panel.muted}>{t('All comments')}</span>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={resolved} onChange={(e) => setResolvedShown(e.target.checked)} />
            {t('Resolved')}
          </label>
        </div>
        {everything && designs.length > 1 && (
          <CheckDropdown
            label={t('Proposal')}
            options={designs.map((d) => ({ value: d, label: designName(d, true), count: threadsAll.filter((x) => x.root.design === d && (resolved || !x.root.resolvedAt)).length }))}
            selected={picked.filter((d) => designs.includes(d))}
            onChange={setPicked}
          />
        )}
      </div>
      {shown.status === 'error' && (
        <div className={`${panel.section} ${styles.error}`}>
          {t("Couldn't load the comments.")}{' '}
          <button className={panel.link} onClick={() => void refresh(everything ? ALL_DESIGNS : design)}>
            {t('Try again')}
          </button>
          <div className={panel.muted}>{shown.error}</div>
        </div>
      )}
      {shown.status === 'loading' && !comments.length ? (
        <div className={panel.section}>
          <span className={panel.muted}>{t('Loading…')}</span>
        </div>
      ) : threads.length ? (
        <div className={styles.cards}>
          {threads.map((t) => (
            <ThreadCard
              key={t.root.id}
              thread={t}
              number={numbers.get(t.root.id) ?? 0}
              pageLabel={everything ? `${designName(t.root.design)} · ${label(t)}` : label(t)}
              open={t.root.id === selected}
              elsewhere={t.root.link !== here}
              onToggle={() => open(t)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Icon name="chat_bubble" size={20} />
          <span>{threadsAll.length ? t('Nothing with these filters.') : t('No comments yet.')}</span>
          {hasScope && !commenting && (
            <button className={panel.btn} onClick={() => setCommenting(true)}>
              <Icon name="add_comment" size={14} />
              {t('Comment (C)')}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** A thread in the list: who started it, where, the text, the replies' count; open, it unfolds with its replies. */
function ThreadCard({ thread, number, pageLabel, open, elsewhere, onToggle }: { thread: Thread; number: number; pageLabel: string; open: boolean; elsewhere: boolean; onToggle: () => void }) {
  const { root, replies } = thread;
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const mine = useMine(root);
  const [editing, setEditing] = useState(false);
  // Opened from its pin: brought into view in the list.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);
  return (
    <div ref={ref} className={`${styles.card} ${open ? styles.cardOn : ''} ${root.resolvedAt ? styles.cardResolved : ''}`}>
      <div className={styles.cardHit} role="button" tabIndex={0} onClick={onToggle} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}>
        <div className={styles.cardHead}>
          <Avatar name={root.author} size={28} />
          <span style={{ flex: 1 }} />
          {mine && !editing && <OwnActions c={root} onEdit={() => setEditing(true)} />}
          <ResolveButton thread={thread} />
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.number}>#{number}</span>
          <span className={styles.where}>
            {pageLabel}
            {root.anchor?.story ? ` · ${root.anchor.story}` : ''}
            {root.variant ? ` · ${root.variant.toUpperCase()}` : ''}
            {root.anchor?.device ? ` · ${deviceLabel(root.anchor.device, root.anchor.display)}` : ''}
          </span>
        </div>
        <div className={styles.who}>
          <span className={styles.author}>{root.author}</span>
          <When c={root} />
        </div>
        {editing ? <EditField c={root} onDone={() => setEditing(false)} /> : <CommentText className={`${styles.text} ${open ? '' : styles.clamp}`} text={root.body} />}
        {!open && replies.length > 0 && (
          <span className={styles.replies}>
            {plural(replies.length, '{n} reply', '{n} replies')}
          </span>
        )}
      </div>
      {open && (
        <div className={styles.cardThread}>
          {root.resolvedAt && (
            <div className={styles.resolvedNote}>
              <Icon name="check_circle" size={14} fill />
              {t('Resolved by {name} · {when}', { name: resolverName(root.resolvedBy), when: timeAgo(root.resolvedAt) })}
            </div>
          )}
          {replies.map((r) => (
            <Message key={r.id} c={r} />
          ))}
          <ReplyField thread={thread} />
          {/* The view it was left on (page, state, device), when the canvas shows another. */}
          {elsewhere && (
            <button
              className={panel.link}
              onClick={() => {
                navigate(root.link);
                openSheetOf(root);
              }}
            >
              {t('Show where it was left')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A design as the panel names it: Live, or a proposal's code (`long`: with its title, in the filter). */
function designName(design: string, long = false): string {
  if (design === LIVE) return t('Live');
  const p = findProposal(design);
  return p && long ? proposalLabel(p) : design;
}

const manifests = new Map<string, Manifest>();
/** A design's pages, to name a thread's page: the canvas's own when it's that design's, else composed once. */
function pagesOf(design: string, current: string | undefined, here: Manifest): Manifest {
  if (design === (current ?? LIVE)) return here;
  let m = manifests.get(design);
  if (!m) manifests.set(design, (m = composePages(design === LIVE ? null : findProposal(design))));
  return m;
}

/** The device a comment was left on: its name, and the display when it has several (Galaxy Z Fold7 · Inner). */
function deviceLabel(id: string, display?: string | null): string {
  const d = findDevice(id);
  const x = d.displays.length > 1 ? d.displays.find((v) => v.key === display) : undefined;
  return x ? `${d.name} · ${x.label.split(' ')[0]}` : d.name;
}

/**
 * Before a shared store is connected: where comments are kept for now, and the two ways to share them, as a note (not a
 * warning: everything works, just in this browser).
 */
function SharingNote() {
  return (
    <div className={styles.note}>
      <span className={styles.noteIcon}>
        <Icon name="forum" size={18} />
      </span>
      <div className={styles.noteText}>
        <strong>{t('Comments stay in this browser for now')}</strong>
        <span>{t('To see the team’s and share yours, connect a shared database. Ask your agent for either:')}</span>
        <ul>
          <li>
            {fill(t('{supabase}, ready to go: a free project, the table from {sql} and its address and key in {json}.'), {
              supabase: <b>Supabase</b>,
              sql: <code>src/comments/supabase.sql</code>,
              json: <code>herocanvas.config.ts</code>,
            })}
          </li>
          <li>
            {fill(t('{other} your team already has: the agent writes its adapter in {adapter}.'), {
              other: <b>{t('Another database')}</b>,
              adapter: <code>src/comments/backend.ts</code>,
            })}
          </li>
        </ul>
      </div>
    </div>
  );
}

/** A translated sentence with parts set in it (bold, code): each `{name}` in `text` becomes `parts[name]`. */
function fill(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/\{(\w+)\}/).map((piece, i) => <Fragment key={i}>{i % 2 ? parts[piece] : piece}</Fragment>);
}
