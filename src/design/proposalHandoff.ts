// A proposal as a file of instructions for whoever implements it in the app (its code and its component
// library): a coding agent first, a person too. It is a specification, not code: the simulator's React and CSS
// stay here. What the designer knows goes in by itself — the proposal's meta and versions, what it changes
// (proposals/index), the code's component behind each changed one (design/library), the states to check —
// and the specification proper is the proposal's `handoff.md`, written (and kept up to date) by whoever builds the
// proposal.
// Pure: the Proposal panel gathers the inputs and offers the text to copy or download.
import type { ApiWidget } from './library';
import type { PageDef } from '../nav/types';
import type { ProposalChanges } from '../proposals';
import type { Proposal } from '../proposals/types';

/**
 * The file a proposal keeps its specification in, in English: what changes in each component or screen (in the
 * app's terms: widgets, constructor parameters, the theme's token names), the logic, the data it needs, the new
 * texts, what stays as it is. Its sections are `###` headings (the file goes under the handoff's own
 * "## Specification"); a part that belongs to one version goes under `### Version A` (see `notesFor`).
 */
export const HANDOFF_NOTES_FILE = 'handoff.md';

export interface HandoffInput {
  proposal: Pick<Proposal, 'id' | 'folder' | 'meta' | 'variants' | 'pages' | 'config'>;
  /** The version the file is for (a proposal with versions hands off one of them). */
  variantId: string | null;
  changes: ProposalChanges;
  basePages: Record<string, PageDef>;
  /** The code's component of a name (design/library). */
  library: { widget: (name: string) => ApiWidget | undefined };
  /** The code's commit the designer mirrors ("e0c7f947 2026-10-08"). */
  libraryCommit: string | null;
  /** The proposal's `handoff.md`, or null when it has none. */
  notes: string | null;
  /** The stories of the proposal's components: the states to check. */
  stories: { component: string; names: string[]; note?: string }[];
  /** A link that opens the designer on this proposal and version. */
  link: string;
  /** ISO date of the export. */
  date: string;
}

const fence = (source: string, language: string) => `\`\`\`${language}\n${source.trimEnd()}\n\`\`\``;

/** The component's constructor, from the parameters the code connector read (app/connectors). */
export function codeSignature(w: Pick<ApiWidget, 'name' | 'params'>): string {
  const params = w.params.map((p) => `  ${p.required ? 'required ' : ''}${p.type ?? 'dynamic'} ${p.name}${p.default != null ? ` = ${p.default}` : ''},`);
  return `${w.name}(${params.length ? `{\n${params.join('\n')}\n}` : ''})`;
}

/**
 * The notes for one version: a section headed `## Version B` (any heading level) belongs to that version alone and
 * is left out for the others, down to the next heading of its level or above. Everything else is shared.
 */
export function notesFor(notes: string, versionId: string | null): string {
  const out: string[] = [];
  let skipping: number | null = null;
  for (const line of notes.split('\n')) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (skipping !== null && level <= skipping) skipping = null;
      const own = /^version\s+([a-z0-9]+)\b/i.exec(heading[2]);
      if (skipping === null && own && own[1].toLowerCase() !== (versionId ?? '').toLowerCase()) skipping = level;
    }
    if (skipping === null) out.push(line);
  }
  return out.join('\n').trim();
}

/**
 * A component's states for one version: a story named after another version (`B · Icon + label`, as the versions
 * are labelled) is left out. Everything else is shared.
 */
export function statesFor(names: string[], otherVersionIds: string[]): string[] {
  const others = new Set(otherVersionIds.map((id) => id.toLowerCase()));
  return names.filter((name) => !others.has(/^([a-z0-9]+)\s+·/i.exec(name)?.[1].toLowerCase() ?? ''));
}

const pageName = (id: string, def: PageDef | undefined) => def?.name ?? (typeof def?.title === 'string' ? def.title : id);

/** What a page entry changes against the base one, in the file's language (the panel's own wording is the tool's). */
function pageDifferences(def: PageDef | undefined, base: PageDef | undefined, config: object | undefined): string[] {
  const out: string[] = [];
  if (def && base) {
    const a = def as unknown as Record<string, unknown>;
    const b = base as unknown as Record<string, unknown>;
    if (a.component !== b.component) out.push('- The screen itself changes: see the specification.');
    const fields = Object.keys({ ...b, ...a }).filter((k) => k !== 'component' && a[k] !== b[k]);
    if (fields.length) out.push(`- Its page settings change: ${fields.map((f) => `\`${f}\``).join(', ')}`);
  }
  const rules = Object.keys(config ?? {});
  if (rules.length) out.push(`- Its layout rules change: ${rules.map((f) => `\`${f}\``).join(', ')}`);
  return out;
}

function pageLines(id: string, def: PageDef): string[] {
  const out = [`- Route: \`${def.path}\` · level \`${def.level}\`${def.parent ? ` · over \`${def.parent}\`` : ''}`];
  if (def.note) out.push(`- ${def.note}`);
  if (def.flow) out.push(`- It is a flow (\`${def.flow.param}\`): ${def.flow.steps.map((s) => `${s.label} (\`${s.id}\`)`).join(' → ')}`);
  if (def.links?.length) out.push(`- Navigates to: ${def.links.map((l) => `\`${l.to}\`${l.label ? ` (${l.label})` : ''}`).join(', ')}`);
  if (def.controls?.length) out.push(`- States to cover: ${def.controls.map((c) => `${c.label} (${c.options.map((o) => o.label).join(' / ')})`).join('; ')}`);
  const variants = def.variants?.() ?? [];
  if (variants.length > 1) out.push(`- Variants: ${variants.map((v) => v.label).join(', ')}`);
  return out.length ? out : [`- \`${id}\``];
}

/**
 * The proposal as Markdown: what it is, what changes and where in the code, its specification and how to check
 * it. Of a proposal with versions, only the one it is for: the others are not named, described or listed (their
 * sections of the specification and their states are left out), so nobody implements the wrong one. What the designer wrote (the proposal's description, its versions, the pages' labels, the stories' names) goes
 * in as written.
 */
export function proposalHandoff(input: HandoffInput): string {
  const { proposal: p, changes, library } = input;
  const version = p.variants.find((v) => v.id === input.variantId) ?? p.variants[0] ?? null;
  const others = p.variants.filter((v) => v !== version);
  const notes = input.notes ? notesFor(input.notes, version?.id ?? null) : '';
  const out: string[] = [];
  const add = (...lines: string[]) => out.push(...lines);

  add(`# Handoff ${p.id}: ${p.meta.title}`, '');
  add(`- **Proposal**: \`${p.id}\` (its permanent reference; in \`proposals/${p.folder}/\`) · status \`${p.meta.status}\`${p.meta.author ? ` · by ${p.meta.author}` : ''} · created ${p.meta.created}`);
  if (version) add(`- **Version to implement**: ${version.id.toUpperCase()} · ${version.label}`);
  add("- **Where it is implemented**: the app's code; reusable components in its component library");
  add(`- **Designed against the code at**: ${input.libraryCommit ? `commit \`${input.libraryCommit}\`` : 'an unknown commit'}. If the files named below changed since, say so before going on.`);
  add(`- **See it working**: ${input.link}`, `- Exported from HeroCanvas on ${input.date}.`, '');

  add('## What it is', '', p.meta.description?.trim() || '_The proposal has no description._', '');
  if (version?.description) add(`**Version ${version.id.toUpperCase()} · ${version.label}.** ${version.description}`, '');
  if (others.length) add(`This file is about version ${version!.id.toUpperCase()} alone: anything above about another version is out of scope.`, '');

  add('## How to work', '');
  add(
    '1. This file is the specification: the "Specification" section says what to build, "What changes" where it is in the code today. The design was built in a simulator that mirrors the app (the link above); its code is not part of the handoff.',
    '2. Change only what this file lists. If something else has to change for it to work (a model, an endpoint, another widget), say so before doing it.',
    '3. Keep the names: a component is its component in the code, and a parameter the specification adds is a parameter of it with that name.',
    "4. Values come from the theme (the app's spacing, colors, radii and text styles): the specification names the tokens. Do not write loose values.",
    '5. Keep the visible texts as the specification writes them, and put them where the screen keeps its texts.',
    '6. If the specification needs data the app does not have, do not make it up: list it as pending on the backend.',
    '7. If the specification leaves something open, ask instead of guessing.',
    '',
  );

  add('## What changes', '');
  if (!changes.components.length && !changes.pages.length) add('_The proposal does not change anything yet._', '');
  for (const change of changes.components) {
    const widget = library.widget(change.name);
    add(`### ${widget ? 'Changed component' : 'New component'}: \`${change.name}\``, '');
    if (change.note) add(change.note, '');
    if (widget) {
      add(`- In the code: \`${widget.file}\` (${widget.tier}${widget.part ? ', a part of a larger widget' : ''})`);
      if (widget.name !== change.name) add(`- Its widget is \`${widget.name}\``);
      if (widget.constructors.length) add(`- Named constructors: ${widget.constructors.map((n) => `\`${n}\``).join(', ')}`);
      if (change.params?.length) add(`- Parameters it adds (the specification says how): ${change.params.map((n) => `\`${n}\``).join(', ')}`);
      add('', 'Its constructor today:', '', fence(codeSignature(widget), ''), '');
    } else {
      add('- The code has no component of this name: it is new. Create it with this name: in the component library (the folder of its tier) when it is reusable, else beside the screen that uses it.', '');
    }
  }
  for (const change of changes.pages) {
    const def = (p.pages[change.id] ?? undefined) as PageDef | undefined;
    const base = input.basePages[change.id];
    const title = { new: 'New screen', changed: 'Changed screen', removed: 'Removed screen' }[change.kind];
    add(`### ${title}: ${pageName(change.id, def ?? base)} (\`${change.id}\`)`, '');
    if (change.kind === 'removed') add('- The proposal drops this screen: remove its route and what only it uses.');
    else add(...pageDifferences(def, base, p.config[change.id]));
    if (change.kind !== 'removed' && (def ?? base)) add(...pageLines(change.id, (def ?? base)!));
    if (change.kind === 'new') add("- It is a new route: add it to the app's routes.");
    add('');
  }

  add('## Specification', '');
  add(notes || `_The proposal has no specification yet (\`proposals/${p.folder}/${HANDOFF_NOTES_FILE}\`). Ask for it before implementing: this file alone only says what changes, not how._`, '');

  const otherIds = others.map((v) => v.id);
  const states = input.stories.map((s) => ({ ...s, names: statesFor(s.names, otherIds) })).filter((s) => s.names.length);
  add('## How to check it', '');
  add('- [ ] It looks and behaves as in the link above, in light and in dark, on a phone and on a tablet.');
  for (const s of states) add(`- [ ] \`${s.component}\` in each state: ${s.names.join(' · ')}`);
  add("- [ ] The component's use cases in the component catalog cover those states.", '- [ ] Nothing this file does not list changed its look.', '');
  for (const s of states) if (s.note) add(`> \`${s.component}\`: ${s.note}`, '');

  return `${out.join('\n').trimEnd()}\n`;
}
