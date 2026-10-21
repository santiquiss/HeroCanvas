// Component stories for the gallery: every story file, the app's (app/), the kit's (src/kit) and the proposals'
// (proposals/<slug>/components). Add stories = create `<Name>.stories.tsx` beside the component (the format:
// storyFormat.ts).
import { NO_APP } from '../nav/noApp';
import type { Args, Control, StoryModule } from './storyFormat';

export * from './storyFormat';

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

// The kit's stories and the app's (its components, and widgets that live with their screen); with no app connected,
// the tour's (src/tour), the app on screen then.
const tourModules = import.meta.glob('../tour/*.stories.tsx', { eager: true });
const modules = {
  ...import.meta.glob('../kit/*.stories.tsx', { eager: true }),
  ...import.meta.glob('@app/**/*.stories.tsx', { eager: true }),
  ...(NO_APP ? tourModules : {}),
} as Record<string, { default: StoryModule<Args> }>;
const proposalModules = import.meta.glob('/proposals/*/components/*.stories.tsx', { eager: true }) as Record<string, { default: StoryModule<Args> }>;

const proposalCodes = import.meta.glob('/proposals/*/proposal.json', { eager: true, import: 'default' }) as Record<string, { code?: string }>;

/** Stories added by each proposal (proposals/<folder>/components/*.stories.tsx), by proposal id (its code). */
export const PROPOSAL_STORIES: Map<string, StoryModule<Args>[]> = new Map();
for (const [path, m] of Object.entries(proposalModules)) {
  const folder = path.split('/')[2];
  const id = proposalCodes[`/proposals/${folder}/proposal.json`]?.code || folder;
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
