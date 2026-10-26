// The emoji button of a comment's field, as Figma's: it opens a grid of the emoji a review uses most (no picker library:
// a short list) and puts the one picked where the cursor is. The grid floats over everything (a portal), so a card that
// clips what's in it (the new comment's, the panel's) doesn't cut it; Esc and a click outside close it.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import styles from './Comments.module.css';
import { t } from '../i18n/ui';

/** Reactions first, then what a design review says: questions, warnings, ideas, done. */
export const EMOJI = [
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🤝',
  '😀', '😂', '😅', '🥲', '😍', '😎', '🤔', '🙃',
  '🤯', '😬', '😢', '😡', '🙈', '🤷', '😉', '👌',
  '❤️', '💜', '🔥', '✨', '🎉', '💯', '🚀', '⭐',
  '✅', '❌', '⚠️', '❓', '❗', '💡', '📌', '📝',
  '🎨', '✏️', '🔍', '🐛', '⏳', '🔁', '➡️', '👉',
];

const COLS = 8;
const CELL = 32;
const PAD = 8;
const W = COLS * CELL + PAD * 2;
const H = Math.ceil(EMOJI.length / COLS) * CELL + PAD * 2;

/** Where a box of `w` × `h` floats by another (`r`): above it when there's room, else below; inside the window. */
export function floatBy(r: DOMRect, w: number, h: number): { left: number; top: number } {
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const top = r.top - h - 6 >= 8 ? r.top - h - 6 : Math.min(r.bottom + 6, window.innerHeight - h - 8);
  return { left, top };
}

/** `text`: the field the emoji goes into; `value` / `onChange`: its text. */
export function EmojiButton({ text, value, onChange, size = 28 }: { text: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void; size?: number }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (open && button.current) setAt(floatBy(button.current.getBoundingClientRect(), W, H));
  }, [open]);

  // While open: a click outside closes it, and Esc closes it (not the thread it's in: it's stopped first).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !grid.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      text.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open, text]);

  const pick = (emoji: string) => {
    const el = text.current;
    const from = el?.selectionStart ?? value.length;
    const to = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, from) + emoji + value.slice(to));
    setOpen(false);
    // The cursor after it, once the field has the new text.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(from + emoji.length, from + emoji.length);
    });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`${styles.emojiBtn} ${open ? styles.emojiBtnOn : ''}`}
        style={{ width: size, height: size }}
        title={t('Add emoji')}
        aria-label={t('Add emoji')}
        aria-expanded={open}
        // The field keeps its focus (and where its cursor is).
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name="sentiment_satisfied" size={20} />
      </button>
      {open &&
        createPortal(
          <div ref={grid} className={styles.emojiGrid} style={{ left: at.left, top: at.top, width: W, gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, padding: PAD }} role="listbox" aria-label={t('Emoji')} onClick={(e) => e.stopPropagation()}>
            {EMOJI.map((e) => (
              <button key={e} type="button" className={styles.emoji} role="option" aria-selected={false} onMouseDown={(ev) => ev.preventDefault()} onClick={() => pick(e)}>
                {e}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
