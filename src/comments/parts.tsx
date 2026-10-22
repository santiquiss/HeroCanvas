// The pieces a thread is drawn with, the same on the canvas (beside its pin) and in the panel: avatars, a comment, the
// thread's comments, the reply field, resolve, and your own comment's ⋯ (edit, delete). Figma's comments are the model.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { recalledAuthor, rememberAuthor } from '../persist/author';
import { useMyOwner } from './owner';
import { addComment, deleteComment, editComment, newCommentId, setResolved } from './store';
import { initials, personColor, resolverName, timeAgo, UNKNOWN_RESOLVER, type Thread } from './threads';
import { MAX_AUTHOR, MAX_BODY, type Comment } from './types';
import styles from './Comments.module.css';
import { t } from '../i18n/ui';

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: name ? personColor(name) : '#c4c8ce' }} aria-hidden>
      {name ? initials(name) : <Icon name="person" size={Math.round(size * 0.6)} />}
    </span>
  );
}

/** One comment: who, when, what; yours has a ⋯ to edit or delete it. */
export function Message({ c }: { c: Comment }) {
  const [editing, setEditing] = useState(false);
  const mine = useMine(c);
  return (
    <div className={styles.message}>
      <Avatar name={c.author} />
      <div className={styles.messageMain}>
        <div className={styles.who}>
          <span className={styles.author}>{c.author}</span>
          <When c={c} />
          {mine && !editing && <OwnActions c={c} onEdit={() => setEditing(true)} hover />}
        </div>
        {editing ? <EditField c={c} onDone={() => setEditing(false)} /> : <p className={styles.text}>{c.body}</p>}
      </div>
    </div>
  );
}

/** When it was left, and whether it was edited since. */
export function When({ c }: { c: Comment }) {
  return (
    <>
      <span className={styles.when} title={new Date(c.createdAt).toLocaleString()}>
        {timeAgo(c.createdAt)}
      </span>
      {c.editedAt && (
        <span className={styles.when} title={t('Edited {date}', { date: new Date(c.editedAt).toLocaleString() })}>
          {t('(edited)')}
        </span>
      )}
    </>
  );
}

/** Whether it was left from this browser: you may edit or delete it. */
export function useMine(c: Comment): boolean {
  const me = useMyOwner();
  return !!me && c.owner === me;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Your comment's ⋯: Edit, Delete (asked once more; a thread's first comment takes its replies). `hover`: shown when the
 * pointer is over its comment, as in Figma.
 */
export function OwnActions({ c, onEdit, hover = false }: { c: Comment; onEdit: () => void; hover?: boolean }) {
  const [open, setOpen] = useState<'menu' | 'confirm' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // A press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [open]);
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteComment(c);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };
  return (
    <div
      ref={ref}
      className={`${styles.own} ${hover && !open ? styles.ownHover : ''}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(null);
        }
      }}
    >
      <button className={`${styles.iconBtn} ${styles.more}`} title={t('More')} aria-label={t('More')} aria-haspopup="menu" aria-expanded={!!open} onClick={() => setOpen(open ? null : 'menu')}>
        <Icon name="more_horiz" size={18} />
      </button>
      {open === 'menu' && (
        <div className={styles.menu} role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setOpen(null);
              onEdit();
            }}
          >
            <Icon name="edit" size={16} />
            <span>{t('Edit')}</span>
          </button>
          <button role="menuitem" className={styles.danger} onClick={() => setOpen('confirm')}>
            <Icon name="delete" size={16} />
            <span>{t('Delete')}</span>
          </button>
        </div>
      )}
      {open === 'confirm' && (
        <div className={styles.menu} role="alertdialog" aria-label={t('Delete')}>
          <span className={styles.menuNote}>{c.parentId ? t('Delete this comment?') : t('Delete this thread and its replies?')}</span>
          {error && <span className={styles.error}>{error}</span>}
          <div className={styles.menuBar}>
            <button className={styles.plainBtn} onClick={() => setOpen(null)}>
              {t('Cancel')}
            </button>
            <button className={styles.dangerBtn} disabled={busy} autoFocus onClick={() => void remove()}>
              {t('Delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Your comment's text in a field: ↵ saves, Esc leaves it as it was. */
export function EditField({ c, onDone }: { c: Comment; onDone: () => void }) {
  const [text, setText] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!text.trim() && text.trim() !== c.body && !busy;
  const save = async () => {
    if (!text.trim() || busy) return;
    if (text.trim() === c.body) return onDone();
    setBusy(true);
    setError(null);
    try {
      await editComment(c, text.trim());
      onDone();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };
  return (
    <div
      className={styles.editBox}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onDone();
      }}
    >
      <div className={styles.field}>
        <textarea
          className={styles.fieldText}
          rows={1}
          maxLength={MAX_BODY}
          autoFocus
          value={text}
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={sendOnEnter(() => void save())}
        />
        <SendButton ready={ready} label={t('Save')} onClick={() => void save()} />
      </div>
      {error && <span className={styles.error}>{error}</span>}
      <span className={styles.editHint}>{t('↵ to save · Esc to cancel')}</span>
    </div>
  );
}

export function ThreadMessages({ thread }: { thread: Thread }) {
  return (
    <>
      <Message c={thread.root} />
      {thread.replies.map((r) => (
        <Message key={r.id} c={r} />
      ))}
    </>
  );
}

/** Who's writing: remembered in this browser; asked the first time. */
export function useAuthorName(): { name: string; setName: (n: string) => void; ask: boolean } {
  const [name, setName] = useState(() => recalledAuthor().name);
  const [ask] = useState(() => !recalledAuthor().name);
  return { name, setName, ask };
}

/** The round send button inside a field, as in Figma: blue when there's something to send. */
export function SendButton({ ready, label, onClick }: { ready: boolean; label: string; onClick: () => void }) {
  return (
    <button className={styles.send} disabled={!ready} onClick={onClick} title={`${label} (↵)`} aria-label={label}>
      <Icon name="arrow_upward" size={18} weight={600} />
    </button>
  );
}

/** Enter sends; Shift+Enter is a new line. */
export const sendOnEnter = (send: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    send();
  }
};

/** The reply field under a thread: your avatar and a field with its send button. */
export function ReplyField({ thread, autoFocus = false }: { thread: Thread; autoFocus?: boolean }) {
  const { name, setName, ask } = useAuthorName();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!text.trim() && !!name.trim() && !busy;
  const send = async () => {
    if (!ready) return;
    const { root } = thread;
    setBusy(true);
    setError(null);
    rememberAuthor({ name: name.trim() });
    try {
      await addComment({ ...root, id: newCommentId(), createdAt: new Date().toISOString(), anchor: null, parentId: root.id, author: name.trim(), body: text.trim(), resolvedAt: null, resolvedBy: null });
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <div className={styles.replyRow}>
      <Avatar name={name.trim()} />
      <div className={styles.replyMain}>
        {ask && <input className={styles.nameField} placeholder={t('Your name')} maxLength={MAX_AUTHOR} value={name} onChange={(e) => setName(e.target.value)} />}
        <div className={styles.field}>
          <textarea
            className={styles.fieldText}
            rows={1}
            placeholder={t('Reply')}
            maxLength={MAX_BODY}
            autoFocus={autoFocus && !ask}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={sendOnEnter(() => void send())}
          />
          <SendButton ready={ready} label={t('Reply')} onClick={() => void send()} />
        </div>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    </div>
  );
}

/** Resolve or reopen a thread: a check in a circle, green once resolved. */
export function ResolveButton({ thread }: { thread: Thread }) {
  const { root } = thread;
  const [busy, setBusy] = useState(false);
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await setResolved(root.design, root.id, root.resolvedAt ? null : recalledAuthor().name || UNKNOWN_RESOLVER);
    } catch {
      /* undone by the store */
    }
    setBusy(false);
  };
  const label = root.resolvedAt ? t('Resolved by {name} · reopen', { name: resolverName(root.resolvedBy) }) : t('Resolve');
  return (
    <button className={`${styles.iconBtn} ${root.resolvedAt ? styles.resolved : ''}`} disabled={busy} onClick={(e) => void toggle(e)} title={label} aria-label={label} aria-pressed={!!root.resolvedAt}>
      <Icon name="check_circle" size={20} fill={!!root.resolvedAt} />
    </button>
  );
}
