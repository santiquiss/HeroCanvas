// Component stories for the gallery. Add stories = create `<Name>.stories.tsx` beside the component (the app's in
// src/app, the kit's in src/kit) exporting `stories({...})`.
import type { ReactNode } from 'react';

export type Control =
  | { type: 'text' }
  | { type: 'number'; min?: number; max?: number; step?: number }
  | { type: 'boolean' }
  | { type: 'select'; options: string[] }
  | { type: 'color' };

export type Args = Record<string, unknown>;

/** Frame width: px, the device content width, one grid cell of the device, or the component's own width. */
export type FrameWidth = number | 'content' | 'cell' | 'auto';

export interface StoryContext<A extends Args> {
  /** Callback that reports an action in the gallery, e.g. `onPressed={ctx.action('onPressed')}`. */
  action: (name: string) => (...values: unknown[]) => void;
  /** Change this story's args (interactive stories: a switch that switches). */
  update: (patch: Partial<A>) => void;
}

export interface Story<A extends Args> {
  name: string;
  args?: Partial<A>;
  width?: FrameWidth;
  note?: string;
}

export interface StoryModule<A extends Args> {
  /** The code's component name (or a local name). */
  component: string;
  /** Default args, merged under every story's args. */
  args: A;
  /** Controls per arg. Strings, numbers and booleans get one automatically. */
  controls?: Partial<Record<keyof A & string, Control>>;
  render: (args: A, ctx: StoryContext<A>) => ReactNode;
  stories: Story<A>[];
  width?: FrameWidth;
  note?: string;
}

export function stories<A extends Args>(m: StoryModule<A>): StoryModule<A> {
  return m;
}

/** Control for an arg: declared, else inferred from the default value. */
export function controlFor(m: StoryModule<Args>, key: string): Control | null {
  const c = m.controls?.[key];
  if (c) return c;
  const v = m.args[key];
  if (typeof v === 'string') return { type: 'text' };
  if (typeof v === 'number') return { type: 'number' };
  if (typeof v === 'boolean') return { type: 'boolean' };
  return null;
}

// The kit's stories and the app's (its components, and widgets that live with their screen).
const modules = {
  ...import.meta.glob('../kit/*.stories.tsx', { eager: true }),
  ...import.meta.glob('../app/**/*.stories.tsx', { eager: true }),
} as Record<string, { default: StoryModule<Args> }>;
const proposalModules = import.meta.glob('../proposals/*/components/*.stories.tsx', { eager: true }) as Record<string, { default: StoryModule<Args> }>;

const proposalCodes = import.meta.glob('../proposals/*/proposal.json', { eager: true, import: 'default' }) as Record<string, { code?: string }>;

/** Stories added by each proposal (src/proposals/<folder>/components/*.stories.tsx), by proposal id (its code). */
export const PROPOSAL_STORIES: Map<string, StoryModule<Args>[]> = new Map();
for (const [path, m] of Object.entries(proposalModules)) {
  const folder = path.split('/')[2];
  const id = proposalCodes[`../proposals/${folder}/proposal.json`]?.code || folder;
  PROPOSAL_STORIES.set(id, [...(PROPOSAL_STORIES.get(id) ?? []), m.default]);
}

/** Base stories plus the active proposal's (a proposal's version of a component replaces the base one). */
export function storiesFor(proposalId: string | null): Map<string, StoryModule<Args>> {
  const extra = proposalId ? PROPOSAL_STORIES.get(proposalId) : undefined;
  if (!extra?.length) return STORIES;
  const m = new Map(STORIES);
  for (const s of extra) m.set(s.component, s);
  return m;
}

/** Stories by component name. */
export const STORIES: Map<string, StoryModule<Args>> = new Map(
  Object.values(modules)
    .map((m) => m.default)
    .sort((a, b) => a.component.localeCompare(b.component))
    .map((m) => [m.component, m]),
);
