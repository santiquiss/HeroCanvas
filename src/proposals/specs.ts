// A proposal's spec (`npm run spec`, scripts/spec.mjs): the proposal as files anyone reads from a link, served at
// /spec/<CODE>-<key>/. What the designer knows of it is the proposal's `spec.json` (the screens it lists and the key in
// its address); what was generated (when, from which version) is the spec's own `meta.json`, fetched when asked.
import { byFolder } from './folders';

interface SpecFile {
  /** The key in the spec's address: made the first time `npm run spec` runs, then kept. */
  key?: string;
  screens?: unknown[];
}

const files = byFolder(import.meta.glob('@proposals/*/spec.json', { eager: true, import: 'default' }) as Record<string, SpecFile>, 'spec.json');

export interface ProposalSpec {
  /** `<CODE>-<key>`: the spec's folder under public/spec/ and its path on the site. */
  path: string | null;
  /** How many screens and states it lists. */
  screens: number;
}

/** The spec a proposal declares (its spec.json), or null when it has none yet. `path` is null until it's generated. */
export function specOf(folder: string, code: string): ProposalSpec | null {
  const f = files[folder];
  if (!f) return null;
  return { path: f.key ? `${code}-${f.key}` : null, screens: f.screens?.length ?? 0 };
}

/** A file of a spec, as an address on this site: `index.html` for a person, `index.md` for an agent. */
export const specUrl = (path: string, file: 'index.html' | 'index.md' | 'meta.json'): string =>
  new URL(`${import.meta.env.BASE_URL}spec/${path}/${file}`, window.location.href).href;

/** What the spec says of itself: when and from which version it was generated. */
export interface SpecMeta {
  generated: string;
  version: string;
  commit: string | null;
  screens: unknown[];
}

/** The spec's meta.json, or null when it isn't there (not generated, or not published yet). */
export async function loadSpecMeta(path: string): Promise<SpecMeta | null> {
  try {
    const r = await fetch(specUrl(path, 'meta.json'), { cache: 'no-store' });
    return r.ok ? ((await r.json()) as SpecMeta) : null;
  } catch {
    return null;
  }
}
