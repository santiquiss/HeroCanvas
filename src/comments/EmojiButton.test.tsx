// EmojiButton on ui-sdk's Menu: an emoji picked goes where the field's cursor was, and the menu closes.
import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { EMOJI, EmojiButton } from './EmojiButton';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let text = '';
function Harness() {
  const field = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('Hi there');
  text = value;
  return (
    <>
      <textarea ref={field} value={value} onChange={(e) => setValue(e.target.value)} />
      <EmojiButton text={field} value={value} onChange={setValue} />
    </>
  );
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('EmojiButton', () => {
  it('puts the emoji at the cursor and closes', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(<Harness />));
    cleanup = () => {
      act(() => root.unmount());
      el.remove();
    };
    // The cursor after "Hi".
    el.querySelector('textarea')!.setSelectionRange(2, 2);
    await act(async () => el.querySelector<HTMLElement>('[data-slot="menu-trigger"]')!.click());
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.length).toBe(EMOJI.length);
    await act(async () => items[0].click());
    expect(text).toBe(`Hi${EMOJI[0]} there`);
    expect(document.querySelector('[data-slot="menu-content"][data-open]')).toBe(null);
  });
});
