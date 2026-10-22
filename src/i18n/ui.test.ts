// Every text the interface translates has its Spanish, and the catalog keeps nothing the code no longer says: the
// keys are read from the source (t('…') and plural(n, '…', '…') with plain strings).
import { describe, expect, it } from 'vitest';
import { ES as es } from './ui';

// Each area's file: a text in two of them must say the same in both.
const FILES = import.meta.glob<Record<string, string>>('./es/*.json', { eager: true, import: 'default' });

// The tool's sources as text (its stories and tests aside).
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/**/*.stories.tsx'], { eager: true, query: '?raw', import: 'default' });

const STR = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`;
const unescape = (s: string) => s.replace(/\\(['"\\])/g, '$1');

function keys() {
  const out = new Set<string>();
  const dynamic: string[] = [];
  for (const [f, text] of Object.entries(SOURCES)) {
    // Comments aside: an example in one isn't a text on screen.
    const src = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
    for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*(?:${STR})`, 'g'))) out.add(unescape(m[1] ?? m[2]));
    for (const m of src.matchAll(new RegExp(String.raw`\bplural\(\s*[^,]+,\s*(?:${STR})\s*,\s*(?:${STR})`, 'g'))) {
      out.add(unescape(m[1] ?? m[2]));
      out.add(unescape(m[3] ?? m[4]));
    }
    for (const m of src.matchAll(/\bt\(\s*`/g)) dynamic.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
  }
  return { keys: out, dynamic };
}

describe('the interface in Spanish', () => {
  const { keys: used, dynamic } = keys();
  const catalog = es as Record<string, string>;

  it('translates every text the code passes to t()', () => {
    expect([...used].filter((k) => !(k in catalog))).toEqual([]);
  });

  it('keeps no translation the code no longer uses', () => {
    expect(Object.keys(catalog).filter((k) => !used.has(k))).toEqual([]);
  });

  it('passes plain strings to t(), never a template: the key has to be found in the source', () => {
    expect(dynamic).toEqual([]);
  });

  it('translates a text the same in every area’s file', () => {
    const seen = new Map<string, [string, string]>();
    const differ: string[] = [];
    for (const [file, entries] of Object.entries(FILES))
      for (const [k, v] of Object.entries(entries)) {
        const before = seen.get(k);
        if (before && before[1] !== v) differ.push(`${k}: "${before[1]}" (${before[0]}) vs "${v}" (${file})`);
        else seen.set(k, [file, v]);
      }
    expect(differ).toEqual([]);
  });

  it('keeps every {variable} in the translation', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    expect(Object.entries(catalog).filter(([en, tr]) => vars(en) !== vars(tr)).map(([en]) => en)).toEqual([]);
  });
});
