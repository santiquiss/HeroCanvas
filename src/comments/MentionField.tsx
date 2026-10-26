// @mentions in a comment's field: typing @ lists the team (comments/mentions), the arrows move through it, ↵ or Tab
// (or a click) puts the name in, Esc closes the list and leaves the field as it was. The list floats over everything
// (a portal), as the emoji grid does. And a comment's text, its mentions shown as such.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { floatBy } from './EmojiButton';
import { splitMentions, suggestions, TEAM, typingMention, type Person } from './mentions';
import { Avatar } from './parts';
import styles from './Comments.module.css';
import { t } from '../i18n/ui';

const ROW = 32;
const W = 240;

/**
 * A field's mentions: `track` on its change and select (where its cursor is), `onKeyDown` first in its own (true: the
 * key was the list's), and `list` rendered beside it.
 */
export function useMentions(field: RefObject<HTMLTextAreaElement | null>, value: string, onChange: (v: string) => void) {
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  // The @ whose list Esc closed: it stays closed until another one.
  const [dismissed, setDismissed] = useState<number | null>(null);
  const typing = caret != null && TEAM.length ? typingMention(value, caret) : null;
  const people = typing && typing.at !== dismissed ? suggestions(TEAM, typing.query) : [];
  const open = people.length > 0;
  const query = typing?.query;
  useEffect(() => setActive(0), [query]);

  const track = () => setCaret(field.current?.selectionStart ?? null);
  const pick = (p: Person) => {
    if (!typing || caret == null) return;
    const name = `@${p.name} `;
    onChange(value.slice(0, typing.at) + name + value.slice(caret));
    const pos = typing.at + name.length;
    setCaret(pos);
    // The cursor after the name, once the field has it.
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(pos, pos);
    });
  };
  const onKeyDown = (e: KeyboardEvent): boolean => {
    if (!open) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : people.length - 1)) % people.length);
    else if (e.key === 'Enter' || e.key === 'Tab') pick(people[Math.min(active, people.length - 1)]);
    else if (e.key === 'Escape') setDismissed(typing!.at);
    else return false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  };
  const list = open ? <MentionList field={field} people={people} active={Math.min(active, people.length - 1)} onPick={pick} onHover={setActive} /> : null;
  return { track, onKeyDown, list };
}

function MentionList({ field, people, active, onPick, onHover }: { field: RefObject<HTMLTextAreaElement | null>; people: Person[]; active: number; onPick: (p: Person) => void; onHover: (i: number) => void }) {
  const [at, setAt] = useState({ left: 0, top: 0 });
  const box = useRef<HTMLDivElement>(null);
  const h = people.length * ROW + 8;
  useLayoutEffect(() => {
    if (field.current) setAt(floatBy(field.current.getBoundingClientRect(), W, h));
  }, [field, h]);
  return createPortal(
    <div ref={box} className={styles.mentionList} style={{ left: at.left, top: at.top, width: W }} role="listbox" aria-label={t('People')} onClick={(e) => e.stopPropagation()}>
      {people.map((p, i) => (
        <button
          key={p.slack}
          type="button"
          role="option"
          aria-selected={i === active}
          className={`${styles.mentionOption} ${i === active ? styles.mentionOn : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(p)}
        >
          <Avatar name={p.name} size={20} />
          <span>{p.name}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** A comment's text, its mentions of the team shown as such. */
export function CommentText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {splitMentions(text).map((piece, i) =>
        piece.mention ? (
          <span key={i} className={styles.mention}>
            {piece.text}
          </span>
        ) : (
          piece.text
        ),
      )}
    </p>
  );
}
