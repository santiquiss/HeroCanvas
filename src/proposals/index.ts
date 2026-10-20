// Proposal registry: every folder in src/proposals/ with a proposal.json. Picked up automatically.
// A proposal is known by its code (proposals/code.ts), not by its folder: `id` is the code.
import { PROPOSAL_LOOKUP } from '../design/overridableRegistry';
import type { ScreenConfig } from '../nav/screenConfig';
import { parseProposalCode } from './code';
import type { Proposal, ProposalCode, ProposalMeta } from './types';

const metas = import.meta.glob('./*/proposal.json', { eager: true, import: 'default' }) as Record<string, ProposalMeta>;
const configs = import.meta.glob('./*/config.json', { eager: true, import: 'default' }) as Record<string, ScreenConfig>;
const codes = import.meta.glob('./*/pages.tsx', { eager: true, import: 'default' }) as Record<string, ProposalCode>;
/** The components each proposal has stories for, by its folder: a story file is named after its component. Not loaded. */
const storyFiles = Object.keys(import.meta.glob('./*/components/*.stories.tsx'));
const storiesIn = (folder: string) => storyFiles.filter((f) => f.split('/')[1] === folder).map((f) => f.split('/').pop()!.replace(/\.stories\.tsx$/, ''));

const slugOf = (path: string) => path.split('/')[1];

export const PROPOSALS: Proposal[] = Object.entries(metas)
  .map(([path, meta]) => {
    const folder = slugOf(path);
    const code = codes[`./${folder}/pages.tsx`];
    return {
      // Without a code (a proposal.json written by hand: `npm test` fails on it) the folder stands in.
      id: meta.code || folder,
      folder,
      meta,
      pages: code?.pages ?? {},
      start: code?.start,
      components: code?.components ?? {},
      notes: code?.notes ?? {},
      params: code?.params ?? {},
      widgets: code?.widgets ?? [],
      variants: Object.entries(code?.variants ?? {}).map(([vid, v]) => ({ id: vid, ...v })),
      config: configs[`./${folder}/config.json`] ?? {},
      layout: code?.layout ?? {},
    };
  })
  // By age, the oldest first: the date it was created, then its number (two of the same day, in the order they were made).
  .sort((a, b) => a.meta.created.localeCompare(b.meta.created) || (parseProposalCode(a.id)?.number ?? 0) - (parseProposalCode(b.id)?.number ?? 0) || a.id.localeCompare(b.id));

/** A proposal as the pickers name it: its code, then its title (`PJ-12 · Settings sections`). */
/**
 * The proposals the pickers list: all but the archived, which stay in the repository and open from a link
 * (`?proposal=PJ-5`). `keep`: the one picked now, listed even when archived, so a picker can show what's on.
 */
export const listedProposals = (keep?: string | null): Proposal[] => PROPOSALS.filter((p) => p.meta.status !== 'archived' || p.id === keep);

export const proposalLabel = (p: Proposal): string => `${p.id} · ${p.meta.title}`;

/** The URL param of the proposal's version (`?variant=b`); none: the first. */
export { VARIANT_PARAM } from '../design/overridableRegistry';

/** The proposal's active version: the one named, else the first; null when it has none. */
export function activeVariant(p: Proposal, id: string | null): Proposal['variants'][number] | null {
  return p.variants.find((v) => v.id === id) ?? p.variants[0] ?? null;
}

/** The proposal's layout under a version: the shared one, then the version's. */
export function proposalLayout(p: Proposal, variantId: string | null): Proposal['layout'] {
  return { ...p.layout, ...activeVariant(p, variantId)?.layout };
}

/** The components the proposal replaces under a version: the shared ones, then the version's. */
export function proposalComponents(p: Proposal, variantId: string | null): Proposal['components'] {
  return { ...p.components, ...activeVariant(p, variantId)?.components };
}

/**
 * URL param: outline what the proposal changes on the screens. `1`: everything; a component's name: only that one
 * (the where-used rail, its thumbnails and what they open).
 */
export const CHANGES_PARAM = 'changes';
export const CHANGES_ALL = '1';

/** URL param: a changed component whose places show in a rail beside the canvas (sim/WhereRail). */
export const WHERE_PARAM = 'where';

/** The one component a `changes` value highlights, or null for everything. */
export const highlightOnly = (value: string | null): string | null => (value && value !== CHANGES_ALL ? value : null);

export interface PageChangeItem {
  id: string;
  kind: 'new' | 'changed' | 'removed';
  /** What changed, in a few words each: "Content changed", "Settings changed: links, title", "Layout rules changed: split". */
  details: string[];
}

export interface ComponentChangeItem {
  name: string;
  /**
   * Changed by every version (`shared`) or this version's own; `added`: a component the proposal adds with a story
   * alone, replacing nothing on the screens (a component proposed for the code, as it's drawn): new; `params`: a
   * component of the code the proposal adds parameters to (`params`), drawn as the screens already use it: changed.
   */
  scope: 'shared' | 'version' | 'added' | 'params';
  /** What it changes: the proposal's note on it, or (a version's own) the version's description. */
  note?: string;
  /** The parameters it adds to the widget (`params`). */
  params?: string[];
}

/** How the panels name a change's scope. */
export const SCOPE_LABEL: Record<ComponentChangeItem['scope'], string> = { shared: 'every version', version: 'this version', added: 'added', params: 'adds parameters' };

export interface ProposalChanges {
  components: ComponentChangeItem[];
  pages: PageChangeItem[];
}

/** What a page entry changes against the base one: its content (the screen), its settings, its layout rules (config). */
function pageDetails(p: Proposal, id: string, base: Record<string, unknown> | undefined): string[] {
  const out: string[] = [];
  const def = p.pages[id] as Record<string, unknown> | null | undefined;
  if (def && base) {
    if (def.component !== base.component) out.push('Content changed');
    const fields = Object.keys({ ...base, ...def }).filter((k) => k !== 'component' && def[k] !== base[k]);
    if (fields.length) out.push(`Settings changed: ${fields.join(', ')}`);
  }
  const cfg = Object.keys(p.config[id] ?? {});
  if (cfg.length) out.push(`Layout rules changed: ${cfg.join(', ')}`);
  return out;
}

/** What a proposal changes, under one of its versions: pages (new, changed, removed) and the components it replaces. */
export function proposalChanges(p: Proposal, variantId: string | null, basePages: Record<string, unknown>): ProposalChanges {
  const version = activeVariant(p, variantId);
  const own = version?.components ?? {};
  const components: ComponentChangeItem[] = [
    ...Object.keys(p.components).filter((n) => !(n in own)).map((name) => ({ name, scope: 'shared' as const, note: p.notes[name] })),
    ...Object.keys(own).map((name) => ({ name, scope: 'version' as const, note: p.notes[name] ?? version?.description })),
  ];
  for (const [name, params] of Object.entries(p.params)) {
    const replaced = components.find((c) => c.name === name);
    if (replaced) replaced.params = params;
    else components.push({ name, scope: 'params', note: p.notes[name], params });
  }
  for (const name of storiesIn(p.folder)) if (!components.some((c) => c.name === name)) components.push({ name, scope: 'added', note: p.notes[name] });
  // A component it adds to the code's library and draws on the screens as proposed: new, though it replaces Live's drawing.
  for (const c of components) if (p.widgets.includes(c.name)) c.scope = 'added';
  const ids = new Set([...Object.keys(p.pages), ...Object.keys(p.config).filter((id) => Object.keys(p.config[id] ?? {}).length)]);
  const pages: PageChangeItem[] = [...ids].map((id) => {
    const base = basePages[id] as Record<string, unknown> | undefined;
    if (p.pages[id] === null) return { id, kind: 'removed', details: ['Not in this proposal'] };
    if (!base) return { id, kind: 'new', details: [] };
    return { id, kind: 'changed', details: pageDetails(p, id, base) };
  });
  return { components, pages };
}

/** A proposal by its code — or by its folder's name, which is what links carried before proposals had codes. */
/** The open proposals (not archived or merged) that add a component to the code's library (e.g. a PageIndicator). */
export function proposalsAdding(name: string): Proposal[] {
  return PROPOSALS.filter((p) => p.meta.status !== 'archived' && p.meta.status !== 'merged' && proposalChanges(p, null, {}).components.some((c) => c.name === name && c.scope === 'added'));
}

export function findProposal(id: string | null | undefined): Proposal | null {
  return (id && (PROPOSALS.find((p) => p.id === id) ?? PROPOSALS.find((p) => p.folder === id))) || null;
}

/** Project paths a proposal writes from the app, by its folder. */
export const proposalPath = (folder: string, file: 'proposal.json' | 'config.json') => `src/proposals/${folder}/${file}`;

/** URL-safe folder name from a title, prefixed with the year-month: "2026-10-settings-sections". */
export function slugify(title: string, date = new Date()): string {
  const ym = date.toISOString().slice(0, 7);
  const s = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${ym}-${s || 'proposal'}`;
}

// Overridable components find the proposals through the registry (a direct import would be a cycle: see there).
PROPOSAL_LOOKUP.find = findProposal;
PROPOSAL_LOOKUP.components = proposalComponents;
PROPOSAL_LOOKUP.layout = proposalLayout;
