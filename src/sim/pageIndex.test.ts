// Where a component is, on its own or inside others (the gallery's Used in and the usage stats).
import { describe, expect, it } from 'vitest';
import { nesting, type PagePlace } from './pageIndex';

describe('nesting', () => {
  it('splits the instances into on the page and inside each other component, most first', () => {
    const places: PagePlace[] = [
      { id: 'a', params: {}, count: 5, inside: { TaskRow: 3 } },
      { id: 'b', params: {}, count: 4, inside: { ListTile: 4 } },
      { id: 'c', params: {}, count: 2 },
    ];
    expect(nesting(places)).toEqual({ own: 4, inside: [['ListTile', 4], ['TaskRow', 3]] });
  });
  it('a place without a count counts once', () => {
    expect(nesting([{ id: 'a', params: {} }])).toEqual({ own: 1, inside: [] });
  });
});
