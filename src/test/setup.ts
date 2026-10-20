// The app's load order (main.tsx → NavProvider → the proposals first): the proposals registry loads the Live pages and
// their screens, some of which (a device preview, the screen config) use the registry again — a cycle that only
// resolves in that order. A test that starts from a page or a helper would otherwise load them the other way round.
import '../proposals';

// What the browser has and happy-dom doesn't, for the tests: just enough for the screens to mount (they observe
// sizes, visibility and media queries, and wait for idle time). No behavior is faked beyond "nothing happens".
class Noop {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const g = globalThis as Record<string, unknown>;
g.ResizeObserver ??= Noop;
g.IntersectionObserver ??= Noop;
g.requestIdleCallback ??= (cb: () => void) => setTimeout(cb, 1) as unknown as number;
g.cancelIdleCallback ??= (id: number) => clearTimeout(id);
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollTo ??= function () {};
Element.prototype.scrollBy ??= function () {};
Element.prototype.scrollIntoView ??= function () {};

// No server in the tests: what the app asks for (comments, saved files) answers "not found", as with no API.
globalThis.fetch = async () => new Response('null', { status: 404, headers: { 'Content-Type': 'application/json' } });

// happy-dom has no canvas: a 2D context that draws nothing (the charts and rings that paint on one still mount).
const noop2d: unknown = new Proxy(function () {}, {
  get: (_, k) => (k === 'canvas' ? undefined : k === 'measureText' ? () => ({ width: 0 }) : noop2d),
  set: () => true,
  apply: () => noop2d,
});
HTMLCanvasElement.prototype.getContext = (() => noop2d) as unknown as HTMLCanvasElement['getContext'];
