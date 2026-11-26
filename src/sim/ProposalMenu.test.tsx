// ProposalMenu on ui-sdk's Select: Live and the proposals are its options, Live's tickets links beside them, a pick
// writes ?proposal=, and Escape closes it back on its button.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { PROPOSALS } from '../proposals';
import { LIVE_TICKETS } from '../proposals/tickets';
import { ProposalMenu } from './ProposalMenu';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let search = '';
function Where() {
  search = useLocation().search;
  return null;
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProposalMenu />
        <Where />
      </MemoryRouter>,
    ),
  );
  cleanup = () => {
    act(() => root.unmount());
    el.remove();
  };
  const trigger = el.querySelector<HTMLElement>('[data-slot="select-trigger"]')!;
  return { trigger };
}

const open = async (trigger: HTMLElement) => {
  await act(async () => trigger.click());
  return document.querySelector<HTMLElement>('[data-slot="select-content"]')!;
};

/** A proposal to pick: none in a copy that has none yet (HeroCanvas's tour). */
const FIRST = [...PROPOSALS].reverse().find((p) => !p.meta.archived);

describe('ProposalMenu', () => {
  it('lists Live and the proposals as options, and the tickets as links', async () => {
    const { trigger } = await mount();
    expect(trigger.getAttribute('aria-label')).toBe('Design');
    const list = await open(trigger);
    const options = list.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1 + PROPOSALS.filter((p) => !p.meta.archived).length);
    expect(list.querySelectorAll('a[href]').length).toBe(LIVE_TICKETS.filter((tk) => tk.url).length);
  });

  it.skipIf(!FIRST)('writes the picked proposal to the address', async () => {
    const { trigger } = await mount();
    const list = await open(trigger);
    const first = FIRST!;
    const row = [...list.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.includes(first.meta.title))!;
    await act(async () => row.click());
    expect(new URLSearchParams(search).get('proposal')).toBe(first.id);
  });

  it('closes on Escape, its button focused again', async () => {
    const { trigger } = await mount();
    const list = await open(trigger);
    await act(async () => list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[data-slot="select-content"][data-open]')).toBe(null);
    expect(document.activeElement).toBe(trigger);
  });
});
