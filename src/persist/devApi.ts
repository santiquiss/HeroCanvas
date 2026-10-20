// Saving to project files through the dev server (scripts/vite/hcWriter.ts). On a static deploy there is no
// endpoint: everything stays readable, saving is disabled.
import { useEffect, useState } from 'react';

const HEADERS = { 'x-hc': '1', 'content-type': 'application/json' };
let status: Promise<boolean> | null = null;

/** Whether this session can write project files (dev server running). Checked once. */
export function canWrite(): Promise<boolean> {
  status ??= fetch('/__hc/status', { headers: HEADERS })
    .then((r) => r.ok)
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

/** Rewrite fields of one page in the manifest (src/app/pages.tsx). `null` removes a field. */
export async function patchManifest(page: string, fields: { split?: unknown; sideColumn?: unknown; landscape?: unknown }): Promise<void> {
  const r = await fetch('/__hc/manifest', { method: 'POST', headers: HEADERS, body: JSON.stringify({ page, ...fields }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
}

/** Write a JSON file (path relative to the project root, must be allowed by the dev server). */
export async function writeJson(path: string, data: unknown): Promise<void> {
  const r = await fetch('/__hc/write', { method: 'POST', headers: HEADERS, body: JSON.stringify({ path, data }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
}
