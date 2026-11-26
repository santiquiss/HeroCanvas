// The emoji button of a comment's field, as Figma's: it opens a grid of the emoji a review uses most (no picker library:
// a short list) and puts the one picked where the cursor is. ui-sdk's Menu (try-ui-library): it floats in the top
// layer, above the button or below it when there's no room (so a card that clips what's in it doesn't cut it), with
// the arrows, Enter, Esc and a click outside; focus goes back to the field.
import { useState, type RefObject } from 'react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@ui-sdk/react/menu';
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

/** `text`: the field the emoji goes into; `value` / `onChange`: its text. */
export function EmojiButton({ text, value, onChange, size = 28 }: { text: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void; size?: number }) {
  const [open, setOpen] = useState(false);

  // Where the field's cursor was (it keeps it while the menu has focus).
  const pick = (emoji: string) => {
    const el = text.current;
    const from = el?.selectionStart ?? value.length;
    const to = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, from) + emoji + value.slice(to));
    // The cursor after it, once the field has the new text.
    requestAnimationFrame(() => el?.setSelectionRange(from + emoji.length, from + emoji.length));
  };

  return (
    // Its clicks and Esc stay its own: not the thread's, which would close too.
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => open && e.key === 'Escape' && e.stopPropagation()}>
      <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger
          type="button"
          className={`${styles.emojiBtn} ${open ? styles.emojiBtnOn : ''}`}
          style={{ width: size, height: size }}
          title={t('Add emoji')}
          aria-label={t('Add emoji')}
        >
          <Icon name="sentiment_satisfied" size={20} />
        </MenuTrigger>
        <MenuContent
          className={styles.emojiGrid}
          side="top"
          align="start"
          sideOffset={6}
          finalFocus={() => text.current}
          aria-label={t('Emoji')}
          style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, padding: PAD }}
        >
          {EMOJI.map((e) => (
            <MenuItem key={e} className={styles.emoji} onSelect={() => pick(e)}>
              {e}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </span>
  );
}
