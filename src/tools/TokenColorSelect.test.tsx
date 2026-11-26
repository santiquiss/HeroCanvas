// TokenColorSelect on ui-sdk's Select: a token picked is written as its var(), and None as ''.
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenColorSelect } from './TokenColorSelect';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = ['', 'var(--app-surface)', 'var(--app-text)'];
let last: string | null = null;

function Harness({ start }: { start: string }) {
  const [value, setValue] = useState(start);
  return (
    <TokenColorSelect
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        last = v;
        setValue(v);
      }}
    />
  );
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  last = null;
});

async function open(start: string) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Harness start={start} />));
  cleanup = () => {
    act(() => root.unmount());
    el.remove();
  };
  await act(async () => el.querySelector<HTMLElement>('[data-slot="select-trigger"]')!.click());
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')];
}

describe('TokenColorSelect', () => {
  it('lists None and every token, the current one selected', async () => {
    const rows = await open('var(--app-text)');
    expect(rows.length).toBe(3);
    expect(rows[2].hasAttribute('data-selected')).toBe(true);
  });

  it('writes a token as its var(), and None as an empty value', async () => {
    let rows = await open('');
    await act(async () => rows[1].click());
    expect(last).toBe('var(--app-surface)');
    cleanup?.();
    rows = await open('var(--app-surface)');
    await act(async () => rows[0].click());
    expect(last).toBe('');
  });
});
