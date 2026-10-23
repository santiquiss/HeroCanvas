// The sections of the Pages tree: the boot pages, then the app's own sections (`group` on a root page) around App
// (its tabs and the other root pages), in the manifest's order.
import type { Manifest } from './stack';

export interface PageGroup {
  /** 'boot' and 'app' are the tool's sections (named in the interface's language); anything else is the app's. */
  key: 'boot' | 'app' | string;
  roots: string[];
}

const isRoot = (pages: Manifest, id: string) => !pages[id].parent && !pages[id].modeOf && pages[id].level !== 'boot';

/**
 * The tree's sections, each with its root pages. A section of the app's own goes where its first page is in the
 * manifest: above App when that page comes before the first tab (sign-in and onboarding, as the person thinks of
 * them), below it otherwise. A tab is always App's. Empty sections are left out.
 */
export function pageGroups(pages: Manifest): PageGroup[] {
  const ids = Object.keys(pages);
  const tabs = ids.filter((id) => pages[id].level === 'tab');
  const groupOf = (id: string) => (pages[id].level === 'tab' ? 'app' : (pages[id].group ?? 'app'));
  const order: string[] = [];
  for (const id of ids) if (isRoot(pages, id) && !order.includes(groupOf(id))) order.push(groupOf(id));
  // App keeps its tabs first, then the other root pages (a settings page opened from the avatar).
  const rootsOf = (key: string) =>
    key === 'app' ? [...tabs, ...ids.filter((id) => isRoot(pages, id) && pages[id].level !== 'tab' && groupOf(id) === 'app')] : ids.filter((id) => isRoot(pages, id) && groupOf(id) === key);
  const boots = ids.filter((id) => pages[id].level === 'boot');
  return [{ key: 'boot', roots: boots }, ...order.map((key) => ({ key, roots: rootsOf(key) }))].filter((g) => g.roots.length);
}
