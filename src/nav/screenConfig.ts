// Per-screen configuration, in layers (later wins):
//   1. the manifest (app/pages.tsx, + the active proposal's pages) — code defaults
//   2. nav/screen-config.json                                      — saved project defaults (Page panel → Save)
//   3. src/proposals/<id>/config.json                               — the active proposal's config (Save while active)
//   4. the URL (`cfg={"projects":{"split":false}}`)                — unsaved changes, shareable
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { patchManifest, writeJson } from '../persist/devApi';
import { findProposal, proposalPath } from '../proposals';
import savedJson from './screen-config.json';
import { displayId, sizeClass, type Device, type Display } from '../devices/devices';
import { isFullScreen, type Landscape, type PageDef, type SideColumn, type SplitConfig } from './types';

export interface ScreenOverride {
  split?: boolean;
  ratio?: SplitConfig['ratio'];
  sideColumn?: SideColumn;
  /** Landscape support (per size class, with display exceptions); unset = the manifest's value, else the display's default. */
  landscape?: Landscape;
  minWidth?: number;
  masterWidth?: number;
  /** Params of the default child, e.g. {"id":"work"}. */
  defaultParams?: Record<string, string>;
}

export type ScreenConfig = Record<string, ScreenOverride>;

export function parseConfig(raw: string | null): ScreenConfig {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Effective split config of a page (manifest default + override), or null when off. */
export function splitFor(id: string, def: PageDef, cfg: ScreenConfig): SplitConfig | null {
  if (!def.split) return null;
  const o = cfg[id] ?? {};
  if (o.split === false) return null;
  return {
    minWidth: o.minWidth ?? def.split.minWidth,
    ratio: o.ratio ?? def.split.ratio,
    masterWidth: o.masterWidth ?? def.split.masterWidth,
    defaultChild: o.defaultParams ? { id: def.split.defaultChild.id, params: o.defaultParams } : def.split.defaultChild,
  };
}

/** Effective iPhone Duo right column of a page. */
export function sideColumnFor(id: string, def: PageDef, cfg: ScreenConfig): SideColumn {
  return cfg[id]?.sideColumn ?? def.sideColumn ?? (isFullScreen(def.level) ? 'empty' : 'nav');
}

/** A page's landscape setting, or undefined to follow every display's default. */
export function landscapeFor(id: string, def: PageDef, cfg: ScreenConfig): Landscape | undefined {
  return cfg[id]?.landscape ?? def.landscape;
}

/** Where a display's landscape support comes from: its exception, its size class's rule, or the display default. */
export type LandscapeSource = 'display' | 'class' | 'all' | 'default';

/** Whether a display rotates the page, and which rule decided it. */
export function resolveLandscape(setting: Landscape | undefined, device: Device, display: Display): { on: boolean; from: LandscapeSource } {
  if (typeof setting === 'boolean') return { on: setting, from: 'all' };
  const exception = setting?.displays?.[displayId(device, display)];
  if (exception !== undefined) return { on: exception, from: 'display' };
  const rule = setting?.[sizeClass(display)];
  if (rule !== undefined) return { on: rule, from: 'class' };
  return { on: !!display.rot, from: 'default' };
}

export const supportsLandscape = (setting: Landscape | undefined, device: Device, display: Display) => resolveLandscape(setting, device, display).on;

export const SAVED_CONFIG_PATH = 'src/nav/screen-config.json';
const SAVED: ScreenConfig = savedJson as ScreenConfig;

/** Saved project defaults merged under the URL overrides, per page. */
function merge(saved: ScreenConfig, url: ScreenConfig): ScreenConfig {
  const out: ScreenConfig = { ...saved };
  for (const [id, o] of Object.entries(url)) out[id] = { ...saved[id], ...o };
  return out;
}

const clean = (o: ScreenOverride) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as ScreenOverride;

/** Effective config (saved + URL) and a setter for the URL layer. */
export function useScreenConfig(): [ScreenConfig, (id: string, patch: ScreenOverride | null) => void] {
  const { effective, setUrl } = useScreenConfigLayers();
  return [effective, setUrl];
}

/** All layers, for the Page panel: what is saved, what is only in the URL, and the actions to move between them. */
export function useScreenConfigLayers() {
  const [search, setSearch] = useSearchParams();
  const url = parseConfig(search.get('cfg'));
  const cfg = url;
  const proposal = findProposal(search.get('proposal'));
  /** The layer that Save writes to: the active proposal's config, else the project's saved defaults. */
  const target = proposal ? proposal.config : SAVED;
  const targetPath = proposal ? proposalPath(proposal.folder, 'config.json') : SAVED_CONFIG_PATH;
  const below = proposal ? merge(SAVED, proposal.config) : SAVED;
  const set = useCallback(
    (id: string, patch: ScreenOverride | null) =>
      setSearch(
        (prev) => {
          const q = new URLSearchParams(prev);
          const all = parseConfig(q.get('cfg'));
          // Values set back to undefined (= the manifest default) are dropped.
          const next = patch == null ? undefined : Object.fromEntries(Object.entries({ ...all[id], ...patch }).filter(([, v]) => v !== undefined));
          if (next && Object.keys(next).length) all[id] = next;
          else delete all[id];
          if (Object.keys(all).length) q.set('cfg', JSON.stringify(all));
          else q.delete('cfg');
          return q;
        },
        { replace: true },
      ),
    [setSearch],
  );

  /** Make the page's effective config the project default (writes screen-config.json) and clear its URL layer. */
  const save = async (id: string) => {
    const next: ScreenConfig = { ...target, [id]: clean({ ...target[id], ...url[id] }) };
    if (!Object.keys(next[id]).length) delete next[id];
    set(id, null);
    await writeJson(targetPath, next);
  };
  /** Drop the saved overrides of a page in the Save layer: back to the code (or, in a proposal, to the base). */
  const resetSaved = async (id: string) => {
    const next = { ...target };
    delete next[id];
    set(id, null);
    await writeJson(targetPath, next);
  };

  /**
   * Write the page's effective config into the manifest (src/app/pages.tsx) — it becomes the code default —
   * then drop its saved and URL layers, which now match the code.
   */
  const makeCodeDefault = async (id: string, def: PageDef) => {
    const eff = merge(SAVED, cfg);
    const fields: { split?: SplitConfig | null; sideColumn?: SideColumn | null; landscape?: Landscape | null } = {};
    if (def.split) fields.split = splitFor(id, def, eff);
    const side = sideColumnFor(id, def, eff);
    fields.sideColumn = side === (isFullScreen(def.level) ? 'empty' : 'nav') ? null : side;
    fields.landscape = landscapeFor(id, def, eff) ?? null;
    await patchManifest(id, fields);
    const next = { ...SAVED };
    delete next[id];
    set(id, null);
    await writeJson(SAVED_CONFIG_PATH, next);
  };

  return { effective: merge(below, cfg), saved: target, proposal, url, setUrl: set, discard: (id: string) => set(id, null), save, resetSaved, makeCodeDefault };
}
