// Mounts the whole designer at a URL, as the browser does (main.tsx), and reports what went wrong: console errors
// (an error boundary's catch, React's warnings about a crash) and uncaught errors. For the smoke test.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router';
import { NavProvider } from '../nav/NavProvider';
import { SimulatorShell } from '../sim/SimulatorShell';

// React: this is a test environment (act() is expected).
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** How long a page gets to settle after mounting (its effects, the timers that open a sheet). */
const SETTLE_MS = 30;

/**
 * Renders the app at `url` (a hash route: "/today?theme=dark"), unmounts it, and returns the errors seen. `look`
 * reads the rendered DOM before it unmounts.
 */
export async function renderAt(url: string, look?: (root: HTMLElement) => void): Promise<string[]> {
  const errors: string[] = [];
  const onError = (e: ErrorEvent) => errors.push(String(e.error?.stack ?? e.message));
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' '));
  window.addEventListener('error', onError);
  window.location.hash = `#${url}`;
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  try {
    await act(async () => {
      root.render(
        <HashRouter>
          <Routes>
            <Route
              path="*"
              element={
                <NavProvider>
                  <SimulatorShell />
                </NavProvider>
              }
            />
          </Routes>
        </HashRouter>,
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, SETTLE_MS));
    });
    look?.(el);
  } catch (e) {
    errors.push(String((e as Error)?.stack ?? e));
  } finally {
    act(() => root.unmount());
    el.remove();
    console.error = original;
    window.removeEventListener('error', onError);
  }
  return errors;
}
