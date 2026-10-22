// What a developer needs about an inspected component, from data the project already keeps: whether it's in
// the code's component library or new in the active proposal (the work to do), its code API against the props drawn
// here, its Figma mapping, the components it's built from, and the design tokens behind its measurements.
import { PROPOSALS } from '../proposals';
import { findTokenGroup } from './tokenCatalog';
import { APP_WIDGETS } from './appWidgets';
import { CHANGE } from './changes';
import { mappingsFor, figmaComponent, type MapEntry } from './figma';
import type { ApiParam, ApiWidget, Library } from './library';
import { componentInstance, type ComponentProps } from './component';
import { PROPOSAL_STORIES } from './stories';
import { acceptanceOf, declaredDifferences, isSimulatorProp, kindsOf, lookDifferences, propDecl } from './simulatorProps';
import { t } from '../i18n/ui';

// ---------------------------------------------------------------- The work: reuse, change, build

export type Work = 'reuse' | 'differs' | 'extend' | 'change' | 'new' | 'app' | 'build';

/** `badge`: Inspect's badge beside the name, the component against the code. */
export const WORK: Record<Work, { label: string; badge: string; hint: string; color: string }> = {
  reuse: { label: t('In the library'), badge: t('Matches code'), hint: t('Use it as it is.'), color: '#16a34a' },
  differs: {
    label: t('In the library, drawn with something it doesn’t have'),
    badge: t('Differs'),
    hint: t('The simulator draws it with props the widget has no parameter for (Code API, below: a Figma option, a size, a state): to agree on with design and the app.'),
    color: '#d97706',
  },
  extend: {
    label: t('In the library, with parameters a proposal adds'),
    badge: t('Differs'),
    hint: t('Use the widget; this screen also sets parameters it doesn’t have yet, which a proposal specifies (Code API, below): add them to the widget first.'),
    color: CHANGE.changed.color,
  },
  change: { label: t('Changed in this proposal'), badge: t('Differs'), hint: t('It exists in the library; this proposal changes it.'), color: CHANGE.changed.color },
  new: { label: t('New in this proposal'), badge: t('New'), hint: t('Not in the library yet: build it.'), color: CHANGE.new.color },
  app: { label: t('In the app, not in the library'), badge: t('In app'), hint: t('The app builds it itself, not with a component of its library: until it moves into the library, the app’s is the reference.'), color: '#2563eb' },
  // Only here: not in the app's code (yet). Where it came from (a design file, a proposal) is a note, not a state.
  build: { label: t('Local'), badge: t('Local'), hint: t('Only in HeroCanvas, not in the app’s code: drawn here, from a design or for a proposal.'), color: '#9aa0a8' },
};

export { APP_WIDGETS };

/**
 * The work a component asks for: from the active proposal (it adds or changes it), the code's library and, given an
 * instance's props, whether the screen sets parameters a proposal adds to the widget (`params`): then it differs from
 * the code even in Live.
 */
export function workFor(name: string, proposalId: string | null, lib: Library, props?: ComponentProps): Work {
  const inLibrary = !!lib.widget(name);
  const inProposal = !!proposalId && ((PROPOSAL_STORIES.get(proposalId) ?? []).some((s) => s.component === name) || !!PROPOSALS.find((p) => p.id === proposalId)?.params[name]);
  if (inProposal) return inLibrary ? 'change' : 'new';
  if (inLibrary) {
    if (props && Object.keys(proposedParams(name)).some((k) => props[k] != null)) return 'extend';
    // Drawn with something the widget doesn't have (not the simulator's alone): it differs from the code.
    const widget = lib.widget(name)!;
    return lookDifferences(name).length || (props && apiContrast(widget, props, name).extra.length) ? 'differs' : 'reuse';
  }
  // A class of named constructors (Message): in the library through its kinds, differing where they do.
  const kinds = kindsOf(name).filter((k) => lib.widget(k));
  if (kinds.length) return kinds.some((k) => lookDifferences(k).length || Object.keys(declaredDifferences(k)).length) ? 'differs' : 'reuse';
  return name in APP_WIDGETS ? 'app' : 'build';
}

/**
 * The parameters proposals add to a widget (their `params`), each with the proposal's code: `{ centerTitle: 'PJ-1' }`.
 * Archived proposals are dropped, and merged ones are in the code already.
 */
export function proposedParams(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of PROPOSALS) {
    if (p.meta.status === 'archived' || p.meta.status === 'merged') continue;
    for (const k of p.params[name] ?? []) out[k] ??= p.id;
  }
  return out;
}

// ---------------------------------------------------------------- Code API

/**
 * The widget's parameters, each marked when the simulator sets a prop of that name; the constructor a prop picks
 * (Button's variant 'primary' → Button.primary, Avatar's size 'small' → Avatar.small); the props
 * it sets that a proposal adds to the widget (`proposed`, with the proposal's code); and the rest of the simulator's
 * props the widget has no parameter for (`extra`: from Figma or the simulator, to agree on). Callbacks count.
 */
export function apiContrast(
  widget: ApiWidget,
  props: ComponentProps,
  /** The simulator component's name, when not the widget's (the name map): whose proposed parameters to read. */
  name = widget.name,
): { params: (ApiParam & { set: boolean })[]; constructor: string | null; proposed: { name: string; proposal: string }[]; extra: string[]; simulator: string[]; accepted: string[] } {
  const set = new Set(Object.keys(props).filter((k) => props[k] != null));
  const names = new Set(widget.params.map((p) => p.name));
  // A prop whose value names a constructor (or the `constructor` the instrumentation reports).
  const by = propDecl(name).constructorBy;
  const declared = by && set.has(by.prop) && by.values[String(props[by.prop])] ? { k: by.prop, ctor: by.values[String(props[by.prop])] } : null;
  const named = declared ?? [...set].map((k) => ({ k, ctor: `${widget.name}.${String(props[k])}` })).find(({ k, ctor }) => !names.has(k) && widget.constructors.includes(ctor));
  const reported = typeof props.constructor === 'string' ? `${widget.name}.${props.constructor}` : null;
  const constructor = named?.ctor ?? (reported && widget.constructors.includes(reported) ? reported : null);
  const added = proposedParams(name);
  const missing = [...set].filter((k) => !names.has(k) && k !== named?.k && k !== 'constructor');
  return {
    params: widget.params.map((p) => ({ ...p, set: set.has(p.name) })),
    constructor,
    proposed: missing.filter((k) => k in added).map((k) => ({ name: k, proposal: added[k] })),
    // The simulator's alone (declared beside the component): never in the handoff, and the code doesn't differ by them.
    simulator: missing.filter((k) => !(k in added) && isSimulatorProp(name, k)),
    extra: missing.filter((k) => !(k in added) && !isSimulatorProp(name, k) && !acceptanceOf(name, k)),
    // Differences accepted as they are (declared beside the component): the code doesn't differ by them any more.
    accepted: missing.filter((k) => !(k in added) && !isSimulatorProp(name, k) && !!acceptanceOf(name, k)),
  };
}

// ---------------------------------------------------------------- Figma

/** The component's Figma mappings (code-map.json) with their Figma component, when the inventory has it. */
export function figmaFor(name: string): (MapEntry & { url: string | null })[] {
  return mappingsFor(name).map((m) => ({ ...m, url: figmaComponent(m.figma)?.figmaUrl ?? null }));
}

// ---------------------------------------------------------------- Nested components

/** The component instances directly inside `el` (the nearest ones down each branch), grouped by name in order of appearance. */
export function builtFrom(el: HTMLElement): { name: string; ids: string[] }[] {
  const groups = new Map<string, string[]>();
  const walk = (node: Element) => {
    for (const child of node.children) {
      const id = (child as HTMLElement).dataset?.hc;
      const name = id && componentInstance(id)?.name;
      if (id && name) groups.set(name, [...(groups.get(name) ?? []), id]);
      else walk(child);
    }
  };
  walk(el);
  return [...groups].map(([name, ids]) => ({ name, ids }));
}

// ---------------------------------------------------------------- Tokens for measurements

// The design file's spacing and radius scale, in px: 8-based ("2x" = 16), named as its variables are.
/** The app's own scale, from its tokens (`--app-space-*`, `--app-radius-*`): each one's name and its size in px. */
const scale = (group: string): [string, number][] => (findTokenGroup(group)?.tokens ?? []).map((t) => [t.name, parseFloat(t.base)] as [string, number]).filter(([, n]) => Number.isFinite(n));
const SPACING = scale('spacing');
const RADIUS = scale('radius');

/** A measurement and its token; `token` null = not on the scale (a value to check: hardcoded, or a token missing). */
export interface Measure {
  px: number;
  token: string | null;
}

const px = (v: string) => Math.round(parseFloat(v) * 100) / 100;

/** "16px" → the app's space token of that size (`app-space-l`); 0 has no token to show. */
export function spacing(v: string): Measure {
  const n = px(v);
  const hit = n ? SPACING.find(([, x]) => x === n) : undefined;
  return { px: n, token: hit ? hit[0] : null };
}

/** "12px" → the app's radius token of that size; a pill (radius ≥ half the height) is its full radius, when it has one. */
export function radius(v: string, height: number): Measure {
  const n = px(v);
  const full = RADIUS.find(([name]) => /full|pill|round/.test(name));
  if (n >= height / 2) return { px: n, token: full?.[0] ?? null };
  const hit = RADIUS.find(([, x]) => x === n);
  return { px: n, token: hit ? hit[0] : null };
}

