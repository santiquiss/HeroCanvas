// The app's component catalog (its Storybook or similar), from a connector
// (src/app/connectors/catalog.json): the reference for component *names* and taxonomy, and links to each use case.
const raw = (Object.values(import.meta.glob('../app/connectors/catalog.json', { eager: true, import: 'default' }))[0] as Node[] | undefined) ?? [];
const files = import.meta.glob('../app/connectors/catalog-url.json', { eager: true, import: 'default' }) as Record<string, { url: string }>;
const CATALOG_URL = Object.values(files)[0]?.url ?? '';
export type Tier = 'token' | 'atom' | 'molecule' | 'organism';

export interface CatalogEntry {
  name: string;
  tier: Tier;
  /** Folder path in the catalog, e.g. ['widgets', 'atoms', 'button']. */
  folders: string[];
  useCases: { name: string; figma: string | null }[];
}

type Node = { folder: string; children: Node[] } | { component: string; useCases: { name: string; figma: string | null }[] };

const TIER: Record<string, Tier> = { tokens: 'token', atoms: 'atom', molecules: 'molecule', organisms: 'organism' };

function flatten(nodes: Node[], folders: string[], out: Map<string, CatalogEntry>) {
  for (const n of nodes) {
    if ('folder' in n) flatten(n.children, [...folders, n.folder], out);
    else {
      const tier = TIER[folders.find((f) => TIER[f]) ?? 'atoms'];
      out.set(n.component, { name: n.component, tier, folders, useCases: n.useCases });
    }
  }
  return out;
}

export const CATALOG: Map<string, CatalogEntry> = flatten(raw, [], new Map());

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The catalog's link to a component's first (or given) use case (empty without a catalog URL). */
export function catalogUrl(e: CatalogEntry, useCase = e.useCases[0]?.name ?? ''): string {
  const path = [...e.folders, e.name.toLowerCase(), slug(useCase)].join('/');
  return CATALOG_URL && `${CATALOG_URL}/#/?path=${path}`;
}

/** First Figma link among the component's use cases. */
export function figmaUrl(e: CatalogEntry): string | null {
  return e.useCases.find((u) => u.figma)?.figma ?? null;
}
