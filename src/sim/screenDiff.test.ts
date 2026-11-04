// What Highlight changes marks on a changed screen: what the proposal's has that Live's doesn't, added (a row, a card)
// or changed (a text), compared as a text diff compares lines but on the screens' trees.
import { describe, expect, it } from 'vitest';
import { diffScreens } from './screenDiff';

const tree = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('diffScreens', () => {
  it('marks a row the proposal adds, whole, and nothing else', () => {
    const live = tree('<ul><li>Display</li><li>Nutrients</li></ul>');
    const prop = tree('<ul><li>Display</li><li id="n"><b>bell</b> Notifications</li><li>Nutrients</li></ul>');
    const d = diffScreens(prop, live);
    expect(d.added.map((e) => e.id)).toEqual(['n']);
    expect(d.changed).toEqual([]);
  });
  it('marks a text that changed, the smallest part', () => {
    const live = tree('<section><h1>Plan</h1><p><span>7 days</span><span>left</span></p></section>');
    const prop = tree('<section><h1>Plan</h1><p><span id="d">5 days</span><span>left</span></p></section>');
    const d = diffScreens(prop, live);
    expect(d.added).toEqual([]);
    expect(d.changed.map((e) => e.id)).toEqual(['d']);
  });
  it('marks nothing when the screens are the same', () => {
    const html = '<div><p>Same</p><p>Screen</p></div>';
    expect(diffScreens(tree(html), tree(html))).toEqual({ added: [], changed: [] });
  });
});
