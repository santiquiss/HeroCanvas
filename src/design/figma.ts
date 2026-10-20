// The design file's components and the code ↔ design map, for the gallery and Inspect. Both come from a design
// connector (src/app/connectors/figma-components.json: the file's components and their options; code-map.json: which
// code component each one is, and how they differ). Without them the gallery lists the app's components alone.
import { APP_WIDGETS } from './appWidgets';
import { UNREPLICATED } from './unreplicated';

/** An optional file a connector writes (src/app/connectors/<name>), or `fallback` when there's none. */
function optional<T>(files: Record<string, unknown>, fallback: T): T {
  const hit = Object.values(files)[0];
  return (hit as T | undefined) ?? fallback;
}

const inventory = optional(import.meta.glob('../app/connectors/figma-components.json', { eager: true, import: 'default' }), { file: '', exportedAt: '', components: [] as unknown[] });
const codeMap = optional(import.meta.glob('../app/connectors/code-map.json', { eager: true, import: 'default' }), { map: [] as unknown[] });

export interface FigmaProp {
  name: string;
  type: string;
  options?: string[];
  default?: string | boolean;
}

export interface FigmaComponent {
  name: string;
  page: string;
  tier: string | null;
  kind: string;
  private: boolean;
  node: string;
  figmaUrl: string;
  props: FigmaProp[];
  variants?: { name: string }[];
}

/** `unused`: a Figma component the code has no widget for and doesn't draw: left out of the lists (nothing to build). */
export type MapStatus = 'same' | 'renamed' | 'part' | 'partial' | 'different' | 'missing' | 'code-only' | 'unused';

export interface MapEntry {
  code: string;
  figma: string | null;
  status: MapStatus;
  diff: string;
  todo: string[];
}

const all = inventory.components as FigmaComponent[];

/** Public Figma components by name. */
export const FIGMA: Map<string, FigmaComponent> = new Map(all.filter((c) => !c.private).map((c) => [c.name, c]));
export const FIGMA_FILE = { name: inventory.file as string, exportedAt: inventory.exportedAt as string };

/** "Chart › _Bar" → the private part on the Chart page. */
export function figmaComponent(name: string | null): FigmaComponent | undefined {
  if (!name) return undefined;
  const [parent, part] = name.split(' › ');
  if (!part) return FIGMA.get(name);
  const page = FIGMA.get(parent)?.page ?? parent;
  return all.find((c) => c.name === part && c.page === page);
}

export const CODE_MAP = codeMap.map as MapEntry[];

/**
 * The code's name for a Figma component: components take the code's names (Progressbar → ProgressBar), the
 * code map says which; the Figma name when it maps to none.
 */
export function codeName(figma: string): string {
  return CODE_MAP.find((m) => m.figma === figma && !m.code.includes(' ('))?.code ?? figma;
}

/** Map entries for a code component ("Card" matches "Card (goal)" too). */
export function mappingsFor(code: string): MapEntry[] {
  return CODE_MAP.filter((m) => m.code === code || m.code.startsWith(code + ' ('));
}

/** Figma components that some code component maps to. */
export const MAPPED_FIGMA = new Set(CODE_MAP.map((m) => m.figma?.split(' › ')[0]).filter(Boolean) as string[]);

export const STATUS_LABEL: Record<MapStatus, { label: string; color: string }> = {
  same: { label: 'Same name · align options', color: '#16a34a' },
  renamed: { label: 'Other name in Figma', color: '#0d99ff' },
  part: { label: 'Part of a Figma component', color: '#7c5cff' },
  partial: { label: 'Some Figma variants built', color: '#0891b2' },
  different: { label: 'Significantly different · pending', color: '#f59e0b' },
  missing: { label: 'Not in Figma · pending', color: '#9aa0a8' },
  'code-only': { label: 'In code, no Figma frame', color: '#64748b' },
  unused: { label: 'Figma only: not used in the code', color: '#9aa0a8' },
};

export type GroupKey = 'atom' | 'molecule' | 'organism' | 'local' | 'unreplicated';

export const GROUP_TITLES: Record<GroupKey, string> = {
  atom: 'Atoms',
  molecule: 'Molecules',
  organism: 'Organisms',
  local: 'Local',
  /** The component catalog's components the simulator doesn't replicate (design/unreplicated: why), apart from the work. */
  unreplicated: 'Not replicated',
};

/**
 * Component names for the gallery by tier: Figma's components (names and tiers from Figma, the current naming
 * decision), then the component catalog's and the simulator's that Figma doesn't name, each in its tier (the code's,
 * else the catalog's); Local only for what nothing gives a tier.
 */
type Tier = 'atom' | 'molecule' | 'organism';
const isTier = (t: string | null | undefined): t is Tier => t === 'atom' || t === 'molecule' || t === 'organism';

/**
 * A component's tier: Figma's, by its name or by the Figma component the code map points it to , else its tier in the app's code, else the one an app's widget
 * declares (design/appWidgets); undefined when none says.
 */
export function componentTier(name: string, codeTier?: (name: string) => string | undefined): Tier | undefined {
  const own = FIGMA.get(name)?.tier;
  if (isTier(own)) return own;
  const mapped = mappingsFor(name).map((m) => figmaComponent(m.figma)?.tier).find(isTier);
  if (mapped) return mapped;
  const code = codeTier?.(name);
  if (isTier(code)) return code;
  // The app's own widget the design doesn't have: the tier it's declared with.
  return APP_WIDGETS[name]?.tier;
}

/** Figma components the code doesn't use (the code map's `unused`): not listed as components to build. */
export const UNUSED_FIGMA = new Set(CODE_MAP.filter((m) => m.status === 'unused').map((m) => m.figma).filter(Boolean) as string[]);

export function componentGroups(
  catalog: Iterable<string>,
  withStories: Iterable<string>,
  /** Its tier in the app's code or the component catalog (`atom`…), for a component Figma doesn't name. */
  codeTier?: (name: string) => string | undefined,
): Record<GroupKey, string[]> {
  const wb = [...catalog];
  const built = [...withStories];
  const out: Record<GroupKey, string[]> = { atom: [], molecule: [], organism: [], local: [], unreplicated: [] };
  for (const c of FIGMA.values()) {
    if (UNUSED_FIGMA.has(c.name)) continue;
    const t = c.tier === 'atom' || c.tier === 'molecule' || c.tier === 'organism' ? c.tier : null;
    // A Figma component the code has only as part of one (a logo's mark) is that component, listed once.
    const whole = codeName(c.name);
    const name = whole !== c.name ? whole : (CODE_MAP.find((m) => m.figma === c.name && m.code.includes(' ('))?.code.split(' (')[0] ?? whole);
    if (t && !out[t].includes(name)) out[t].push(name);
  }
  // A catalog name counts as covered when Figma has it (any casing) or the code map points it to Figma.
  const figmaLower = new Set([...FIGMA.keys()].map((n) => n.toLowerCase()));
  const mappedCode = new Set(CODE_MAP.filter((m) => m.figma).map((m) => m.code.split(' (')[0]));
  const figmaCode = new Set([...FIGMA.keys()].map(codeName));
  // The catalog's that Figma doesn't have, and the ones built here Figma doesn't name: each in its tier
  // (componentTier, then the code's or the catalog's), Local only when nothing says one.
  const rest = [...wb.filter((n) => !figmaLower.has(n.toLowerCase()) && !mappedCode.has(n)), ...built.filter((n) => !FIGMA.has(n) && !figmaCode.has(n) && !n.includes(' › '))];
  for (const n of rest) {
    // The catalog's token pages (ColorToken, Elevation) aren't components: the Tokens mode has them.
    if (codeTier?.(n) === 'token') continue;
    // One not replicated (and not built after all) goes apart: not missing, nothing to build.
    if (UNREPLICATED[n] && !built.includes(n)) {
      if (!out.unreplicated.includes(n)) out.unreplicated.push(n);
      continue;
    }
    const tier = componentTier(n, codeTier) ?? 'local';
    if (!out[tier].includes(n)) out[tier].push(n);
  }
  return out;
}
