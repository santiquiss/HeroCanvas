// The app's token stylesheets, whatever their selectors' spelling.
import { describe, expect, it } from 'vitest';
import { readBlocks, scopeOf } from './appTokens';

describe('token stylesheets', () => {
  it('reads where a selector applies', () => {
    expect(scopeOf(':root')).toBe('all');
    expect(scopeOf("[data-theme]")).toBe('all');
    expect(scopeOf(':root[data-theme="dark"]')).toBe('dark');
    expect(scopeOf("[data-theme='light']")).toBe('light');
    expect(scopeOf("[data-app-theme='sepia']")).toBe('app:sepia');
    expect(scopeOf('.button')).toBeNull();
  });
  it('keeps each property where it applies, the later one winning', () => {
    const b = readBlocks([
      ':root { --a: 1px; } /* x */ :root[data-theme="light"] { --c: #fff; }',
      "[data-theme='dark'], [data-app-theme='night'] { --c: #000; } .x { --ignored: 1; } :root { --a: 2px; }",
    ]);
    expect(b.all.get('a')).toBe('2px');
    expect(b.light.get('c')).toBe('#fff');
    expect(b.dark.get('c')).toBe('#000');
    expect(b.appThemes.get('night')?.get('c')).toBe('#000');
    expect(b.all.has('ignored')).toBe(false);
  });
});
