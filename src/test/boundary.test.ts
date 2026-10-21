// The boundary between the tool and the team's code: the app (app/) and the proposals (proposals/) import the tool
// only as `herocanvas` (src/index.ts, its public API), never a file inside src/. That's what lets the tool update
// (and one day be a package) without touching their code.
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['/app/**/*.{ts,tsx}', '/proposals/**/*.{ts,tsx}'], { eager: true, query: '?raw', import: 'default' });

/** `spec` imported from `file`, as a path from the project's root (`/src/kit`). */
function resolve(file: string, spec: string): string {
  const parts = file.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}

describe('the team’s code imports the tool only as herocanvas', () => {
  it.each(Object.keys(SOURCES).map((f) => [f]))('%s', (file) => {
    const reaching = [...SOURCES[file].matchAll(/from '(\.[^']*)'/g)].map((m) => m[1]).filter((spec) => resolve(file, spec).startsWith('/src/'));
    expect(reaching).toEqual([]);
  });
});
