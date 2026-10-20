// Work that can wait for the browser to be idle (the where-used scan, Flow's thumbnails), so it never blocks a click,
// a scroll or a frame.

/** Soon, when the browser has nothing else to do (or after a short wait at most). Returns a cancel. */
export function whenIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 300 });
    return () => cancelIdleCallback(id);
  }
  const t = window.setTimeout(fn, 16);
  return () => window.clearTimeout(t);
}
