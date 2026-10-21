// An acceptance names a difference that's declared beside the component (a `differs` prop or a `look` line): one left
// behind after the difference went, or misspelled, would accept nothing and hide nothing.
import { describe, expect, it } from 'vitest';
import { loadLibrary, type ApiWidget, type Library } from './library';
import { componentState } from './componentState';
import { allDeclarations, declareProps } from './simulatorProps';
import './stories';

const FAKE = 'TestOnlyComponent';

/** A component of the code, made up (the repository may have no code API connector). */
const WIDGET: ApiWidget = { name: 'TestOnlyWidget', tier: 'atom', part: false, file: 'test.ts', summary: null, constructors: [], params: [{ name: 'size', type: 'double', required: false, default: null }] };

describe('accepted differences', () => {
  it('each names a declared difference, with why, who and a date', () => {
    const wrong: string[] = [];
    for (const [name, d] of allDeclarations())
      for (const [key, a] of Object.entries(d.accepted ?? {})) {
        if (!d.differs?.[key] && !d.look?.includes(key)) wrong.push(`${name}: ${key} isn't a declared difference`);
        if (!a.reason.trim() || !a.by.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(a.on)) wrong.push(`${name}: ${key} needs a reason, who and yyyy-mm-dd`);
      }
    expect(wrong).toEqual([]);
  });

  it('takes an accepted difference out of what the component differs by', async () => {
    // A component of the test's own (a made-up widget stands for its code), so no real declaration is touched.
    const real = await loadLibrary();
    const lib: Library = { version: real.version, widget: (n) => (n === FAKE ? WIDGET : real.widget(n)) };
    declareProps(FAKE, { differs: { fill: 'A test difference', size: 'Another' }, accepted: { fill: { reason: 'A test', by: 'Test', on: '2026-10-16' } } });
    try {
      const state = componentState(FAKE, true, lib);
      expect(state.reasons.map((r) => r.key)).not.toContain('fill');
      expect(state.reasons.map((r) => r.key)).toContain('size');
      expect(state.accepted.map((a) => a.key)).toContain('fill');
    } finally {
      declareProps(FAKE, {});
    }
  });
});

describe('a class of named constructors (kinds)', () => {
  it('names widgets of the library', async () => {
    const lib = await loadLibrary();
    const wrong = allDeclarations().flatMap(([name, d]) => (d.kinds ?? []).filter((k) => !lib.widget(k)).map((k) => `${name}: ${k}`));
    expect(wrong).toEqual([]);
  });

  it('differs where its kinds do, each difference under its widget', async () => {
    const real = await loadLibrary();
    const KIND = 'TestOnlyKind';
    const lib: Library = { version: real.version, widget: (n) => (n === KIND ? WIDGET : n === FAKE ? undefined : real.widget(n)) };
    declareProps(KIND, { look: ['A test look'] });
    declareProps(FAKE, { kinds: [KIND] });
    try {
      const state = componentState(FAKE, true, lib);
      expect(state.label).toBe('Differs from code');
      expect(state.reasons.map((r) => r.text)).toEqual([`${KIND} · A test look`]);
    } finally {
      declareProps(FAKE, {});
      declareProps(KIND, {});
    }
  });
});
