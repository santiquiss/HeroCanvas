// Components the app builds on its own, outside its component library: where they live in its code, and their tier
// for the gallery. Kept by the app (app/connectors/app-widgets.json); no imports, so the gallery's tiers
// (design/figma) and the handoff (design/handoff) both read it.
export interface AppWidget {
  widget: string;
  file: string;
  /** Other places it's drawn. */
  also?: string[];
  /** The platform's own component (the SDK's): nothing to build. */
  platform?: boolean;
  /** Its tier, for one the design file doesn't have. */
  tier?: 'atom' | 'molecule' | 'organism';
}

const files = import.meta.glob('@app/connectors/app-widgets.json', { eager: true, import: 'default' }) as Record<string, Record<string, AppWidget>>;

export const APP_WIDGETS: Record<string, AppWidget> = Object.values(files)[0] ?? {};
