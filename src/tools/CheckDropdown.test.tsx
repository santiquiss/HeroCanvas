// CheckDropdown on ui-sdk's Select (multiple): checking toggles a value and keeps the list open, the button sums the
// choice up, and Show all clears it.
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CheckDropdown } from './CheckDropdown';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS = [
  { value: 'a', label: 'Apples', count: 3 },
  { value: 'b', label: 'Bananas', count: 1 },
  { value: 'c', label: 'Cherries', count: 0 },
];

let changes: string[][] = [];
function Harness() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <CheckDropdown
      label="Fruit"
      options={OPTIONS}
      selected={selected}
      onChange={(s) => {
        changes.push(s);
        setSelected(s);
      }}
    />
  );
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  changes = [];
});

async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Harness />));
  cleanup = () => {
    act(() => root.unmount());
    el.remove();
  };
  return el.querySelector<HTMLElement>('[data-slot="select-trigger"]')!;
}

const content = () => document.querySelector<HTMLElement>('[data-slot="select-content"][data-open]');
const option = (label: string) => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.includes(label))!;

describe('CheckDropdown', () => {
  it('toggles values with the list kept open, and sums them up on its button', async () => {
    const trigger = await mount();
    expect(trigger.getAttribute('aria-label')).toBe('Fruit: All');
    await act(async () => trigger.click());
    await act(async () => option('Apples').click());
    expect(content()).not.toBe(null);
    await act(async () => option('Cherries').click());
    expect(changes.at(-1)).toEqual(['a', 'c']);
    expect(trigger.getAttribute('aria-label')).toBe('Fruit: 2 selected');
    await act(async () => option('Apples').click());
    expect(changes.at(-1)).toEqual(['c']);
    expect(trigger.getAttribute('aria-label')).toBe('Fruit: Cherries');
  });

  it('clears the choice with Show all', async () => {
    const trigger = await mount();
    await act(async () => trigger.click());
    await act(async () => option('Bananas').click());
    const all = [...content()!.querySelectorAll('button')].find((b) => b.textContent === 'Show all')!;
    await act(async () => all.click());
    expect(changes.at(-1)).toEqual([]);
    expect(trigger.getAttribute('aria-label')).toBe('Fruit: All');
  });
});
