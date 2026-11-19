import { describe, expect, it } from 'vitest';
import { markAgainst, outline } from './outline.mjs';

const text = (t) => ({ type: 'text', box: [0, 0, 10, 10], text: t });
const comp = (name, props, children) => ({ type: 'component', name, props, box: [0, 0, 10, 10], ...(children ? { children } : {}) });

describe('a spec’s outline', () => {
  it('folds a component built from its props, and opens one given its content', () => {
    const tile = comp('Tile', { title: 'Sound', icon: 'bell' }, [comp('Icon', { icon: 'Symbols.bell' }), text('Sound')]);
    const card = comp('Card', { padding: true }, [text('Hello'), comp('Button', { label: 'Go' }, [text('Go')])]);
    const out = outline([tile, card]);
    expect(out).not.toContain('Symbols.bell');
    expect(out).toContain('Text "Hello"');
    expect(out).toContain('**Button**');
    expect(out).not.toContain('Text "Go"');
  });

  it('marks what Live doesn’t have and folds the rest', () => {
    const row = (title) => comp('Tile', { title }, [text(title)]);
    const live = [{ type: 'column', box: [0, 0, 1, 1], children: [row('Display'), row('Units')] }];
    const now = [{ type: 'column', box: [0, 0, 1, 1], children: [row('Display'), row('Notifications'), row('Units')] }];
    expect(markAgainst(now, live)).toBe(1);
    const out = outline(now, { marked: true });
    expect(out).toContain('+ **Tile**');
    expect(out).toContain('Notifications');
    expect(out).toContain('… 2 unchanged');
    expect(out).not.toContain('Units');
  });
});
