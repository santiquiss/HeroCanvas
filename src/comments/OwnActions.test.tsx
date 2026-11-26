// Your comment's ⋯ on ui-sdk's Menu: Edit, and Delete asked once more in the same menu; the delete keeps its item
// pending, closes the menu once done, and on a failure leaves it open with the reason.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Comment } from './types';

const deleteComment = vi.fn<(c: Comment) => Promise<void>>();
vi.mock('./store', async (orig) => ({ ...(await orig<typeof import('./store')>()), deleteComment: (c: Comment) => deleteComment(c) }));

const { OwnActions } = await import('./parts');

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const COMMENT = { id: 'c1', parentId: null, body: 'Hi', author: 'Me' } as unknown as Comment;

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  deleteComment.mockReset();
});

async function mount(onEdit = () => {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<OwnActions c={COMMENT} onEdit={onEdit} />));
  cleanup = () => {
    act(() => root.unmount());
    el.remove();
  };
  const trigger = el.querySelector<HTMLElement>('[data-slot="menu-trigger"]')!;
  await act(async () => trigger.click());
  return trigger;
}

const menu = () => document.querySelector<HTMLElement>('[data-slot="menu-content"][data-open]');
const item = (label: string) => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent?.includes(label))!;

describe('OwnActions', () => {
  it('runs Edit and closes', async () => {
    const onEdit = vi.fn();
    await mount(onEdit);
    expect(menu()).not.toBe(null);
    // Opened, it starts on its first item, not on the one a confirmation last gave focus to.
    expect(document.activeElement).not.toBe(item('Delete'));
    await act(async () => item('Edit').click());
    expect(onEdit).toHaveBeenCalledOnce();
    expect(menu()).toBe(null);
  });

  it('asks before deleting, and Cancel goes back to the menu', async () => {
    await mount();
    await act(async () => item('Delete').click());
    expect(menu()?.textContent).toContain('Delete this thread and its replies?');
    // The confirmation keeps the keyboard in the menu: its item that had focus is gone.
    expect(menu()!.contains(document.activeElement)).toBe(true);
    await act(async () => item('Cancel').click());
    expect(menu()).not.toBe(null);
    expect(item('Edit')).toBeTruthy();
    expect(document.activeElement).toBe(item('Delete'));
    expect(deleteComment).not.toHaveBeenCalled();
  });

  it('deletes, then closes', async () => {
    deleteComment.mockResolvedValue();
    await mount();
    await act(async () => item('Delete').click());
    await act(async () => item('Delete').click());
    expect(deleteComment).toHaveBeenCalledWith(COMMENT);
    expect(menu()).toBe(null);
  });

  it('stays open with the reason when the delete fails', async () => {
    deleteComment.mockRejectedValue(new Error('Not yours'));
    await mount();
    await act(async () => item('Delete').click());
    await act(async () => item('Delete').click());
    expect(menu()?.textContent).toContain('Not yours');
  });
});
