// The Comments panel, as Figma's: a search, the filters (this screen or every page, kinds, resolved) and the threads of
// what's on screen (Live or the proposal), newest first. A thread opens beside its pin on the canvas and here, where it
// unfolds with its replies; opening one left on another view takes the canvas there.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { findDevice } from '../devices/devices';
import { useNavRoot } from '../nav/context';
import { pageName } from '../nav/stack';
import { useMode } from '../sim/modes';
import { SearchField } from '../tools/SearchField';
import { useCanvasDesigns, useCommentScope, useCommentsUi } from './CommentsContext';
import { Avatar, EditField, Message, OwnActions, ReplyField, ResolveButton, useMine, When } from './parts';
import { commentsShared, refresh, useComments, useCommentsOf } from './store';
import { commentLink, filterThreads, resolverName, threadMatches, threadNumbers, threadsOf, timeAgo, type Thread } from './threads';
import type { Comment } from './types';
import { openSheetLink } from '../sim/sheetLinks';
import panel from '../tools/Panel.module.css';
import styles from './Comments.module.css';
import { plural, t } from '../i18n/ui';

export default function CommentsPanel() {
  const { design, variant } = useCommentScope();
  // Loading and errors are the toolbar version's; the threads, every version's on the canvas (a set's devices).
  const state = useComments(design, { fresh: true });
  const comments = useCommentsOf(useCanvasDesigns(), { fresh: true });
  const { selected, setSelected, commenting, setCommenting, showResolved: resolved, setShowResolved: setResolvedShown } = useCommentsUi();
  const nav = useNavRoot();
  const mode = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [scope, setScope] = useState<'page' | 'all'>('page');
  const [query, setQuery] = useState('');
  // In Flow there's no page on screen: every page's.
  const pageScope = mode === 'prototype' && scope === 'page';
  const all = useMemo(() => threadsOf(comments), [comments]);
  const numbers = useMemo(() => threadNumbers(all), [all]);
  const onScreen = new Set(nav.stack.map((r) => r.id));
  const label = (t: Thread) => pageName(nav.pages, t.root.page);
  const threads = filterThreads(all, { resolved, variant }).filter((t) => (!pageScope || onScreen.has(t.root.page) || t.root.id === selected) && threadMatches(t, query, label(t)));
  const here = commentLink(location.pathname, location.search);
  const open = (t: Thread) => {
    if (t.root.id === selected) return setSelected(null);
    setSelected(t.root.id);
    // The canvas shows the view it was left on, where its pin is, and the sheet it's on (over its page: not under
    // another one pushed over it).
    const sheetElsewhere = !!t.root.anchor?.sheet && location.pathname !== t.root.link.split('?')[0];
    if (mode !== 'prototype' || !onScreen.has(t.root.page) || sheetElsewhere) navigate(t.root.link);
    openItsSheet(t.root);
  };

  return (
    <>
      <SearchField value={query} placeholder={t('Search comments')} onChange={setQuery} />
      {!commentsShared() && <SharingNote />}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          {mode === 'prototype' ? (
            <div className={styles.segmented} role="radiogroup" aria-label={t('Pages')}>
              {(['page', 'all'] as const).map((s) => (
                <button key={s} role="radio" aria-checked={scope === s} className={scope === s ? styles.segOn : ''} onClick={() => setScope(s)}>
                  {s === 'page' ? t('This screen') : t('All pages')}
                </button>
              ))}
            </div>
          ) : (
            <span className={panel.muted}>{t('All pages')}</span>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={resolved} onChange={(e) => setResolvedShown(e.target.checked)} />
            {t('Resolved')}
          </label>
        </div>
      </div>
      {state.status === 'error' && (
        <div className={`${panel.section} ${styles.error}`}>
          {t("Couldn't load the comments.")}{' '}
          <button className={panel.link} onClick={() => void refresh(design)}>
            {t('Try again')}
          </button>
          <div className={panel.muted}>{state.error}</div>
        </div>
      )}
      {state.status === 'loading' && !comments.length ? (
        <div className={panel.section}>
          <span className={panel.muted}>{t('Loading…')}</span>
        </div>
      ) : threads.length ? (
        <div className={styles.cards}>
          {threads.map((t) => (
            <ThreadCard key={t.root.id} thread={t} number={numbers.get(t.root.id) ?? 0} pageLabel={label(t)} open={t.root.id === selected} elsewhere={t.root.link !== here} onToggle={() => open(t)} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Icon name="chat_bubble" size={20} />
          <span>{all.length ? t('Nothing with these filters.') : t('No comments yet.')}</span>
          {mode === 'prototype' && !commenting && (
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
            {root.variant ? ` · ${root.variant.toUpperCase()}` : ''}
            {root.anchor?.device ? ` · ${deviceLabel(root.anchor.device, root.anchor.display)}` : ''}
          </span>
        </div>
        <div className={styles.who}>
          <span className={styles.author}>{root.author}</span>
          <When c={root} />
        </div>
        {editing ? <EditField c={root} onDone={() => setEditing(false)} /> : <p className={`${styles.text} ${open ? '' : styles.clamp}`}>{root.body}</p>}
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
                openItsSheet(root);
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

/** A comment left on a sheet opens it (once its page is on screen: sim/sheetLinks). */
function openItsSheet(c: Comment) {
  if (c.anchor?.sheet) openSheetLink(c.anchor.sheet, c.link.split('?')[0]);
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
              json: <code>src/comments/supabase.json</code>,
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
