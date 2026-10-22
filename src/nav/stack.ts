// URL <-> navigation stack. Pure functions over a page manifest.
//
// The path is the top page; `stack` lists the pages underneath only when they differ from the
// default chain (the top page's `parent` links). So most links stay short:
//   #/projects/work                              → [projects, project]
//   #/tasks/t1?stack=/projects,/projects/work    → [projects, project, task]
//   #/tasks/t1                                   → [today, task] (its `parentOf`)
import { SHOT_PARAMS } from '../capture/shot/params';
import type { Level, PageDef, PageRef, Params, StateParams } from './types';
import { t } from '../i18n/ui';

export type Manifest = Record<string, PageDef>;

/**
 * Simulator params, screen config overrides and the active proposal survive every navigation. So does a
 * sidebar the user folded (`rail`), and
 * PostHog flags read by more than one page (a user's flag doesn't change from one screen to the next: `lsv2`,
 * screens/Scan/flag).
 */
export const SIM_PARAMS = ['device', 'devices', 'display', 'arrange', 'sort', 'compare', 'zoom', 'land', 'theme', 'video', 'cfg', 'proposal', 'variant', 'rail', 'changes', 'where', 'persona', 'apptheme', 'textsize', 'bold', 'lang', 'lsv2', 'real', 'capture', ...SHOT_PARAMS] as const;

/**
 * Whether the split's right part is in use (the layout's `detailOpen`): a push page over the tab.
 * One rule for the live screens and the Flow thumbnails.
 */
export function detailOpenFor(pages: Manifest, stack: PageRef[]): boolean {
  // A root that's a list–detail of its own (a sidebar app) keeps what's pushed in its detail pane, not in the panel.
  return stack.length > 1 && pages[stack[1].id].level === 'push' && !pages[stack[0].id]?.split;
}

function match(pattern: string, path: string): Params | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function parsePath(pages: Manifest, path: string): PageRef | null {
  for (const [id, def] of Object.entries(pages)) {
    const params = match(def.path, path);
    if (params) return { id, params };
  }
  return null;
}

export function buildPath(pages: Manifest, ref: PageRef): string {
  const def = pages[ref.id];
  return def.path.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(ref.params[k] ?? def.defaults?.[k] ?? ''));
}

export function sameRef(a: PageRef | undefined, b: PageRef | undefined): boolean {
  if (!a || !b || a.id !== b.id) return false;
  const ka = Object.keys(a.params);
  return ka.length === Object.keys(b.params).length && ka.every((k) => a.params[k] === b.params[k]);
}

/** Pages underneath `ref` when opened from a deep link: its parent chain, bottom first. */
export function defaultChain(pages: Manifest, ref: PageRef): PageRef[] {
  const chain: PageRef[] = [];
  let child = pages[ref.id];
  // The first page under it can depend on its params (`parentOf`: where it was opened from).
  let parent = child.parentOf?.(ref.params) ?? child.parent;
  while (parent && pages[parent] && chain.length < 10) {
    chain.unshift({ id: parent, params: child.parentParams ?? {} });
    child = pages[parent];
    parent = child.parent;
  }
  return chain;
}

/** A stack starts with a tab, or with a boot page (before the app's tabs, nothing under it). */
const isRoot = (pages: Manifest, ref: PageRef | undefined) => !!ref && (pages[ref.id].level === 'tab' || pages[ref.id].level === 'boot');

function rooted(pages: Manifest, stack: PageRef[], fallbackTab: string): PageRef[] {
  if (isRoot(pages, stack[0])) return stack;
  const chain = stack.length ? defaultChain(pages, stack[0]) : [];
  const fixed = [...chain, ...stack];
  return isRoot(pages, fixed[0]) ? fixed : [{ id: fallbackTab, params: {} }, ...fixed];
}

/** Stack for opening `ref` from scratch: its default chain underneath. */
export function chainFor(pages: Manifest, ref: PageRef, fallbackTab: string): PageRef[] {
  return rooted(pages, [...defaultChain(pages, ref), ref], fallbackTab);
}

export function parseStack(pages: Manifest, pathname: string, search: URLSearchParams, fallbackTab: string): PageRef[] {
  const top = parsePath(pages, pathname);
  if (!top) return [{ id: fallbackTab, params: {} }];
  const raw = search.get('stack');
  const below = raw
    ? raw
        .split(',')
        .map((p) => parsePath(pages, p))
        .filter((r): r is PageRef => r != null)
    : defaultChain(pages, top);
  return rooted(pages, [...below, top], fallbackTab);
}

/** Path + `stack` param for a stack. */
export function stackUrl(pages: Manifest, stack: PageRef[]): { path: string; stack: string | null } {
  const top = stack[stack.length - 1];
  const below = stack.slice(0, -1);
  const def = defaultChain(pages, top);
  const isDefault = def.length === below.length && def.every((r, i) => sameRef(r, below[i]));
  return { path: buildPath(pages, top), stack: isDefault ? null : below.map((r) => buildPath(pages, r)).join(',') };
}

/** Set while a flow step is opened to look at (designer tools): its loaders don't move on (nav/flow). */
export const HOLD_PARAM = 'hold';

/** A page's state params: its `state`, its controls' params, and its flow's step param and the hold flag. */
export function stateKeys(def: PageDef): string[] {
  const keys = [...(def.state ?? []), ...(def.controls ?? []).map((c) => c.param)];
  if (def.flow) keys.push(def.flow.param, HOLD_PARAM);
  return [...new Set(keys)];
}

/**
 * Query for a new stack: keeps simulator params and the state params of pages that stay in the
 * stack (same position, same page), drops everything else (closed pages' state, overlays).
 */
export function nextQuery(pages: Manifest, prev: URLSearchParams, oldStack: PageRef[], newStack: PageRef[], extra: StateParams = {}): URLSearchParams {
  const q = new URLSearchParams();
  for (const k of SIM_PARAMS) {
    const v = prev.get(k);
    if (v != null) q.set(k, v);
  }
  newStack.forEach((ref, i) => {
    if (!sameRef(ref, oldStack[i])) return;
    for (const k of stateKeys(pages[ref.id])) {
      const v = prev.get(k);
      if (v != null) q.set(k, v);
    }
  });
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) q.delete(k);
    else q.set(k, v);
  }
  const { stack } = stackUrl(pages, newStack);
  if (stack) q.set('stack', stack);
  return q;
}

/** Generic page name (manifest `name`, else a static title, else the id). */
/** A page's name: its `name`, its title when it's fixed, else its id made readable ("addTask" → "Add task"). */
export function pageName(pages: Manifest, id: string): string {
  const d = pages[id];
  if (d?.name) return d.name;
  if (typeof d?.title === 'string') return d.title;
  const words = id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A page's icon wherever the designer lists pages (Pages, Flow, the changes menu, a component's places): a phone, a
 * screen of the app, the same for every page and any app; its role in the navigation is the icon's tooltip (and the
 * row's badge, its indent). Never the app's own icons: an app may have none for a page, or ones a Material Symbol
 * can't draw, and a page's name already tells pages apart. A flow's steps and a page's variants have their own
 * (PagesPanel).
 */
export const ROLE_ICONS: Record<Level, { icon: string; label: string }> = {
  tab: { icon: 'smartphone', label: t('Tab: a root of the app’s navigation') },
  push: { icon: 'smartphone', label: t('Pushed: opens over the page it comes from') },
  cover: { icon: 'smartphone', label: t('Cover: over the whole screen') },
  boot: { icon: 'smartphone', label: t('Before the app: welcome, sign-in, onboarding') },
};

/** A page's role as its badge names it (Flow, Pages), in the interface's language: lowercase, as the badge styles it. */
export const ROLE_NAMES: Record<Level, string> = { tab: t('tab'), push: t('push'), cover: t('cover'), boot: t('boot') };

export function pageIcon(def: PageDef | undefined): string {
  return ROLE_ICONS[def?.level ?? 'push'].icon;
}

export function pageTitle(pages: Manifest, ref: PageRef): string {
  const title = pages[ref.id].title;
  return typeof title === 'function' ? title(ref.params) : title;
}
