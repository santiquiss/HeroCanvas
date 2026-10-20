// The app's text has an element of its own, as the code has a text widget: never loose beside an icon, a dot or a
// box (Layers and Inspect read the structure as the app builds it). A text with runs of text in it is one rich text.
import { mixesText, ownText } from '../design/element';
import { componentInstance } from '../design/component';

/** Where the app's screens and components hold loose text: "ListTile › div.meta: “Due today”". */
export function looseTexts(root: HTMLElement): string[] {
  const out = new Set<string>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-hc-page] *')) {
    if (!mixesText(el)) continue;
    const owner = el.closest<HTMLElement>('[data-hc]');
    const name = componentInstance(owner?.dataset.hc)?.name ?? el.closest<HTMLElement>('[data-hc-page]')?.dataset.hcPage;
    // CSS modules hash their class names: the name before the hash.
    const cls = (el.getAttribute('class') ?? '').split(' ')[0].replace(/^_(.+)_[a-z0-9]+$/i, '$1');
    out.add(`${name} › ${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}: “${ownText(el).slice(0, 30)}”`);
  }
  return [...out];
}
