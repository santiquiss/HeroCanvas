// Smoke test: every page (each variant, in Live and in each proposal) and every component's gallery page render
// without errors, and with every text in an element of its own (looseText.ts). Discovered from the manifest and the
// stories, so a new page or story is covered without touching this file. It renders, it doesn't look: the look is
// checked in the simulator.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../design/stories';
import { HOME } from '../nav/home';
import { composePages } from '../nav/manifest';
import { chainFor, stackUrl, type Manifest } from '../nav/stack';
import type { PageRef } from '../nav/types';
import { PROPOSALS } from '../proposals';
import { looseTexts } from './looseText';
import { undeclaredProps } from './undeclaredProps';
import { renderAt } from './render';

/** The errors rendering `url`, and its loose texts. */
async function problemsAt(url: string, changed: Set<string> = new Set()): Promise<string[]> {
  const loose: string[] = [];
  const errors = await renderAt(url, (root) => {
    loose.push(...looseTexts(root).map((t) => `Loose text: ${t}`));
    // A component a proposal changes may take what the widget doesn't have: that's the proposal's change.
    loose.push(...undeclaredProps(root).filter((p) => !changed.has(p.split('.')[0])).map((p) => `Undeclared prop (declare it beside the component: design/simulatorProps): ${p}`));
  });
  return [...errors, ...loose];
}

/** A page's URL as the app builds it (its chain of parents, the stack param). */
function urlOf(pages: Manifest, ref: PageRef, extra = ''): string {
  const { path, stack } = stackUrl(pages, chainFor(pages, ref, HOME));
  const q = new URLSearchParams(extra);
  if (stack) q.set('stack', stack);
  const qs = q.toString();
  return path + (qs ? `?${qs}` : '');
}

/** Every page of a manifest, in each of its variants. */
function placesOf(pages: Manifest): { name: string; ref: PageRef }[] {
  return Object.entries(pages).flatMap(([id, def]) => {
    const variants = def.variants?.() ?? [];
    return variants.length ? variants.map((v) => ({ name: `${id} · ${v.label}`, ref: { id, params: v.params } })) : [{ name: id, ref: { id, params: {} } }];
  });
}

const live = composePages(null);

describe('Live pages render', () => {
  it.each(placesOf(live).map((p) => [p.name, urlOf(live, p.ref)]))('%s', async (_, url) => {
    expect(await problemsAt(url)).toEqual([]);
  });
});

for (const proposal of PROPOSALS) {
  const pages = composePages(proposal);
  // The pages it adds or changes (the rest are Live's, covered above).
  const own = placesOf(pages).filter((p) => p.ref.id in proposal.pages && proposal.pages[p.ref.id]);
  if (!own.length) continue;
  describe(`Proposal ${proposal.id} renders`, () => {
    const changed = new Set([...Object.keys(proposal.components), ...Object.values(proposal.variants ?? {}).flatMap((v) => Object.keys(v.components ?? {}))]);
    it.each(own.map((p) => [p.name, urlOf(pages, p.ref, `proposal=${proposal.id}`)]))('%s', async (_, url) => {
      expect(await problemsAt(url, changed)).toEqual([]);
    });
  });
}

// An app without stories has no component pages (an empty `each` is no test, which vitest fails).
if (STORIES.size)
  describe('Component pages render (all their stories)', () => {
    it.each([...STORIES.keys()].map((n) => [n]))('%s', async (name) => {
      expect(await problemsAt(`/components/${encodeURIComponent(name)}`)).toEqual([]);
    });
  });
