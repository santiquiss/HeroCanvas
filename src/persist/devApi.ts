// Saving to project files through the dev server (scripts/vite/hcWriter.ts). On a static deploy there is no
// endpoint: everything stays readable, saving is disabled.
import { useEffect, useState } from 'react';

const HEADERS = { 'x-hc': '1', 'content-type': 'application/json' };
let status: Promise<boolean> | null = null;

/** Whether this session can write project files (dev server running). Checked once. */
export function canWrite(): Promise<boolean> {
  // The dev server's own answer, not any 200: a static host that serves the page for every path answers too.
  status ??= fetch(import.meta.env.BASE_URL + '__hc/status', { headers: HEADERS })
    .then((r) => (r.ok ? r.json() : null))
    .then((b: { writable?: boolean } | null) => b?.writable === true)
    .catch(() => false);
  return status;
}

export function useCanWrite(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    canWrite().then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

/**
 * Where each component shows in a design, as the dev server has it (scripts/vite/pageIndexCache.ts): `stale` while a
 * new one is being made there (`progress`, 0–1), with the one before if any. `again`: made anew. `failed`: it can't make it. Null: no answer.
 */
export async function serverPageIndex<T>(design: string, again = false): Promise<{ index?: T; at?: number; stale?: boolean; progress?: number; failed?: boolean } | null> {
  const r = await fetch(import.meta.env.BASE_URL + '__hc/index', { method: 'POST', headers: HEADERS, body: JSON.stringify({ design, again }) }).catch(() => null);
  return r?.ok ? r.json() : null;
}

/** Rewrite fields of one page in the manifest (app/pages.tsx). `null` removes a field. */
export async function patchManifest(page: string, fields: { split?: unknown; sideColumn?: unknown; landscape?: unknown }): Promise<void> {
  const r = await fetch(import.meta.env.BASE_URL + '__hc/manifest', { method: 'POST', headers: HEADERS, body: JSON.stringify({ page, ...fields }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
}

/** Write a JSON file (path relative to the project root, must be allowed by the dev server). */
export async function writeJson(path: string, data: unknown): Promise<void> {
  const r = await fetch(import.meta.env.BASE_URL + '__hc/write', { method: 'POST', headers: HEADERS, body: JSON.stringify({ path, data }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
}

/** Save an image in the project (public/assets/store/); its path from the site's root (`assets/store/…`). */
export async function uploadImage(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const r = await fetch(import.meta.env.BASE_URL + '__hc/upload', { method: 'POST', headers: HEADERS, body: JSON.stringify({ name: file.name, base64: btoa(bin) }) });
  const body = (await r.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!r.ok || !body.path) throw new Error(body.error ?? `HTTP ${r.status}`);
  await servedImage(body.path);
  return body.path;
}

/**
 * Waits until the dev server serves a file just written to public/ (it does once its watcher has seen it, a moment
 * later): an image asked for before that fails, and the browser doesn't ask again, so the layer would draw nothing.
 */
async function servedImage(path: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`${import.meta.env.BASE_URL}${path}`, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    if (r?.ok && r.headers.get('content-type')?.startsWith('image/')) return;
    await new Promise((done) => setTimeout(done, 100));
  }
}
