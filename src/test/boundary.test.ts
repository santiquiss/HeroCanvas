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

// The API loads before the app: what it exports at once may read the app's settings (app/config), never its pages,
// which import the API (a cycle the app would meet half loaded). What needs the pages loads when it's used.
const TOOL = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], { eager: true, query: '?raw', import: 'default' });

/** The modules `file` loads at once (not `import type`, not a dynamic `import()`), as paths from the root. */
function loadsAtOnce(file: string): string[] {
  const out: string[] = [];
  for (const m of TOOL[file].matchAll(/^(?:import|export)(?!\s+type\b)[^'"\n]*?(?:from\s+)?'([^']+)'/gm)) {
    const spec = m[1].split('?')[0];
    if (spec.startsWith('@app')) out.push(spec);
    else if (spec.startsWith('.')) {
      const base = resolve(file, spec);
      const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((p) => p in TOOL);
      if (hit) out.push(hit);
    }
  }
  return out;
}

describe('the public API loads without the app’s pages', () => {
  it('reaches app/config at most', () => {
    const seen = new Set<string>();
    const pages: string[] = [];
    const walk = (f: string, path: string[]) => {
      if (seen.has(f)) return;
      seen.add(f);
      if (f.startsWith('@app')) {
        if (f !== '@app/config') pages.push([...path, f].join(' > '));
        return;
      }
      for (const d of loadsAtOnce(f)) walk(d, [...path, f]);
    };
    walk('/src/index.ts', []);
    expect(pages).toEqual([]);
  });
});

// The app's settings load with the tool (the API's own modules read them): app/config may not load the API back, or
// the tool meets the settings half loaded ("Cannot access 'app' before initialization").
const APP = import.meta.glob<string>(['/app/**/*.{ts,tsx}', '!/app/**/*.test.{ts,tsx}'], { eager: true, query: '?raw', import: 'default' });

describe('the app’s settings load without the tool', () => {
  it('app/config never imports herocanvas, however deep', () => {
    const seen = new Set<string>();
    const back: string[] = [];
    const walk = (f: string, path: string[]) => {
      if (seen.has(f) || !(f in APP)) return;
      seen.add(f);
      for (const m of APP[f].matchAll(/^(?:import|export)(?!\s+type\b)[^'"\n]*?(?:from\s+)?'([^']+)'/gm)) {
        const spec = m[1].split('?')[0];
        if (spec === 'herocanvas' || spec.startsWith('herocanvas/')) back.push([...path, f].join(' > '));
        else if (spec.startsWith('.')) {
          const base = resolve(f, spec);
          const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((p) => p in APP);
          if (hit) walk(hit, [...path, f]);
        }
      }
    };
    walk('/app/config.ts', []);
    expect(back).toEqual([]);
  });
});
