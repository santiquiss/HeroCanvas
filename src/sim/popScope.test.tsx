// usePopScope: the content's guard reaches its sheet (SheetBody reads it when the shim, a swipe or Escape asks to close).
import { act, type MutableRefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { PopScopeCtx, usePopScope, type PopScope } from './popScope';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function Content({ canPop, blocked }: { canPop: boolean; blocked: () => void }) {
  usePopScope({ canPop, onPopBlocked: blocked });
  return null;
}

describe('usePopScope', () => {
  it('tells the sheet whether it may close, as it changes, and is gone with the content', async () => {
    const guard: MutableRefObject<PopScope | null> = { current: null };
    const read = () => guard.current as PopScope | null;
    let blocked = 0;
    const el = document.createElement('div');
    const root = createRoot(el);
    const render = (canPop: boolean) => root.render(<PopScopeCtx.Provider value={guard}><Content canPop={canPop} blocked={() => blocked++} /></PopScopeCtx.Provider>);
    await act(async () => render(true));
    expect(read()?.canPop).toBe(true);
    await act(async () => render(false));
    expect(read()?.canPop).toBe(false);
    read()?.onPopBlocked?.();
    expect(blocked).toBe(1);
    await act(async () => root.unmount());
    expect(read()).toBe(null);
  });
});
