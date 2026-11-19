// The designer a script draws with: the one that's running (`npm run dev`), or one started for the time it takes.
/** The dev server of this project on a usual port (Vite's 5173 on: another project's may hold 5173), by its root. */
async function ownServer() {
  const root = process.cwd();
  for (let port = 5173; port <= 5199; port++) {
    const base = `http://localhost:${port}`;
    const status = await fetch(`${base}/__hc/status`, { headers: { 'x-hc': '1' }, signal: AbortSignal.timeout(400) }).then((r) => (r.ok ? r.json().catch(() => null) : null), () => null);
    if (status?.root === root) return base;
  }
  return null;
}

/** The designer at `base` (given, else this project's own dev server), or one started here (closed at the end). */
export async function designer(given) {
  const base = given ?? (await ownServer());
  const up = base && (await fetch(base, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false));
  if (up) return { base, close: async () => {} };
  const { createServer } = await import('vite');
  const server = await createServer({ logLevel: 'error', server: { port: 5190, strictPort: false, open: false } });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Couldn't start the designer");
  console.error(`(${base ? `no designer at ${base}` : 'no dev server of this project running'}: started one at ${url})`);
  return { base: url, close: () => server.close() };
}
