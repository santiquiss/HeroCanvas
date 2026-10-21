// Dev-server endpoint that lets the designer save its data to files in the project (dev only).
//
//   GET  /__hc/status            → { writable: true }
//   POST /__hc/write { path, data } → writes `data` as pretty JSON to `path` (relative to the project root)
//   POST /__hc/manifest { page, split, sideColumn, landscape } → rewrites those fields of one page in app/pages.tsx
//                                    (`null` removes the field; omitted fields are left alone)
//
// Guard rails: only JSON, only under ALLOWED paths, and only same-origin requests that carry the
// `x-hc: 1` header (a cross-site page can't send it without a CORS preflight, which is never approved).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Files and folders the app may write. */
const ALLOWED = ['app/screen-config.json', 'proposals/'];

function allowed(root: string, path: string): string | null {
  const abs = resolve(root, path);
  const rel = relative(root, abs).split(sep).join('/');
  if (rel.startsWith('..') || !rel.endsWith('.json')) return null;
  return ALLOWED.some((a) => (a.endsWith('/') ? rel.startsWith(a) : rel === a)) ? abs : null;
}

const MANIFEST = 'app/pages.tsx';

/** A JS value as a TS literal in the manifest's style: `{ a: 1, b: 'x' }`. */
function literal(v: unknown): string {
  if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : literal(k)}: ${literal(x)}`).join(', ')} }`;
  return String(v);
}

/**
 * Set / remove a top-level field (one line, 4-space indent) inside a page entry (`  id: {` … `  },`).
 * Throws when the page or the field's line can't be found safely.
 */
function patchField(src: string, page: string, field: string, value: unknown): string {
  const start = src.indexOf(`\n  ${page}: {\n`);
  if (start < 0) throw new Error(`page "${page}" not found in ${MANIFEST}`);
  const end = src.indexOf('\n  },\n', start);
  if (end < 0) throw new Error(`end of "${page}" not found`);
  let block = src.slice(start, end);
  // The field's line may be the last one of the block (no newline after it inside the slice).
  const re = new RegExp(`\\n    ${field}: .*,(?=\\n|$)`);
  const line = value == null ? '' : `\n    ${field}: ${literal(value)},`;
  if (re.test(block)) block = block.replace(re, line);
  else if (line) block += line;
  return src.slice(0, start) + block + src.slice(end);
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      if (s.length > 2_000_000) fail(new Error('too large'));
    });
    req.on('end', () => ok(s));
    req.on('error', fail);
  });
}

export function hcWriter(): Plugin {
  let root = process.cwd();
  return {
    name: 'hc-writer',
    apply: 'serve',
    configResolved(c) {
      root = c.root;
    },
    configureServer(server) {
      server.middlewares.use('/__hc', async (req, res) => {
        const host = req.headers.host ?? '';
        const origin = req.headers.origin;
        if (req.headers['x-hc'] !== '1' || (origin && new URL(origin).host !== host)) return send(res, 403, { error: 'forbidden' });
        if (req.method === 'GET' && req.url === '/status') return send(res, 200, { writable: true });
        if (req.method === 'POST' && req.url === '/manifest') {
          try {
            const { page, ...fields } = JSON.parse(await readBody(req));
            if (typeof page !== 'string' || !/^[a-zA-Z]\w*$/.test(page)) return send(res, 400, { error: 'bad page id' });
            const abs = resolve(root, MANIFEST);
            let src = readFileSync(abs, 'utf8');
            for (const f of ['split', 'sideColumn', 'landscape'] as const) if (f in fields) src = patchField(src, page, f, fields[f]);
            writeFileSync(abs, src);
            server.config.logger.info(`[hc] updated ${MANIFEST} (${page})`, { timestamp: true });
            return send(res, 200, { ok: true });
          } catch (e) {
            return send(res, 500, { error: String(e) });
          }
        }
        if (req.method !== 'POST' || req.url !== '/write') return send(res, 404, { error: 'not found' });
        try {
          const { path, data } = JSON.parse(await readBody(req));
          const abs = typeof path === 'string' ? allowed(root, path) : null;
          if (!abs) return send(res, 400, { error: `not allowed: ${path}` });
          mkdirSync(dirname(abs), { recursive: true });
          writeFileSync(abs, JSON.stringify(data, null, 2) + '\n');
          server.config.logger.info(`[hc] saved ${path}`, { timestamp: true });
          return send(res, 200, { ok: true });
        } catch (e) {
          return send(res, 500, { error: String(e) });
        }
      });
    },
  };
}
