// @mentions in a comment's field: typing @ lists the team (comments/mentions), the arrows move through it, ↵ or Tab
// (or a click) puts the name in, Esc closes the list and leaves the field as it was. Focus stays in the field (you keep
// typing while you choose): the field names the highlighted person (aria-activedescendant). The list is in the top
// layer, so no card clips it, placed by ui-sdk's `position` (try-ui-library): above the field, below it when there's
// no room. And a comment's text, its mentions shown as such.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { position } from '@ui-sdk/core';
import { splitMentions, suggestions, TEAM, typingMention, type Person } from './mentions';
import { Avatar } from './parts';
import styles from './Comments.module.css';
import { t } from '../i18n/ui';

const W = 240;

/**
 * A field's mentions: `track` on its change and select (where its cursor is), `onKeyDown` first in its own (true: the
 * key was the list's), `fieldProps` on the field (what the list's open on), and `list` rendered beside it.
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
  const id = useId();
  const current = Math.min(active, people.length - 1);
  const fieldProps = open ? { 'aria-autocomplete': 'list' as const, 'aria-controls': id, 'aria-activedescendant': `${id}-${current}` } : { 'aria-autocomplete': 'list' as const };
  const list = open ? <MentionList id={id} field={field} people={people} active={current} onPick={pick} onHover={setActive} /> : null;
  return { track, onKeyDown, fieldProps, list };
}

function MentionList({ id, field, people, active, onPick, onHover }: { id: string; field: RefObject<HTMLTextAreaElement | null>; people: Person[]; active: number; onPick: (p: Person) => void; onHover: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  // In the top layer while it's shown, placed against the field.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !field.current) return;
    el.showPopover();
    const stop = position(field.current, el, { side: 'top', align: 'start', sideOffset: 6, collisionPadding: 8 });
    return () => {
      stop();
      if (el.isConnected) el.hidePopover();
    };
  }, [field]);
  return (
    <div ref={box} id={id} popover="manual" className={styles.mentionList} style={{ width: W }} role="listbox" aria-label={t('People')} onClick={(e) => e.stopPropagation()}>
      {people.map((p, i) => (
        <button
          key={p.slack}
          id={`${id}-${i}`}
          type="button"
          role="option"
          tabIndex={-1}
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
    </div>
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
