// What a guest sees (a link's profile, src/share/gate.ts), or anyone with `?view=<profile>`: the modes, the panels
// and the controls it keeps; the rest of the designer is out of sight. A view, not a lock: the site is one bundle,
// so what a profile hides is out of reach of the interface, not of someone reading its code.
// No imports: the server reads it too (middleware.ts).

/** What a profile can keep besides its modes and panels. */
export type ViewControl =
  /** The screens' Light / Dark (ThemeSwitch). */
  | 'theme'
  /** The device's header on the canvas: device, display, rotate. */
  | 'devices'
  /** Compare: devices side by side (the view bar, and the + beside a device). */
  | 'compare'
  /** The zoom bar. */
  | 'zoom'
  | 'inspect'
  /** Comment mode and the pins. */
  | 'comments'
  /** The toolbar's proposal menu, its versions and changes. */
  | 'proposals'
  /** The toolbar's Share: a link to the view, a guest link. */
  | 'share'
  /** The rail's About (HeroCanvas's page). */
  | 'about';

export interface ViewProfile {
  /** Shown to the person making a link, and in the guest's badge. */
  label: string;
  /** The modes it keeps (the rail's): 'prototype', 'flow', 'components', 'tokens'. */
  modes: string[];
  /** The panels it keeps, by their id (src/tools/registry.ts): 'pages', 'layers', 'scenarios'… */
  tools: string[];
  /** Of its panels, those a link can leave out (a checkbox each in Share: "Show Pages"). */
  optional?: string[];
  controls: ViewControl[];
  /** Controls it doesn't keep that a link can give back (a checkbox each in Share: "Let them change the device"). */
  extra?: ViewControl[];
}

/** HeroCanvas's own: a team adds or replaces them in herocanvas.config.ts (`share.profiles`). */
export const BUILT_IN_PROFILES: Record<string, ViewProfile> = {
  // The app's screens and nothing else: Pages to move between them, and their Light / Dark.
  simple: { label: 'Simple', modes: ['prototype'], tools: ['pages'], optional: ['pages'], controls: ['theme'], extra: ['devices'] },
};

/** Panels a link leaves out, as the URL and the cookie carry them: ids joined by `+`, nothing else let through. */
export const parseHidden = (raw: string | null | undefined): string[] =>
  (raw ?? '').split('+').filter((id) => /^[a-z][a-z0-9-]{0,31}$/.test(id)).slice(0, 16);

export const profilesOf = (own?: Record<string, ViewProfile>): Record<string, ViewProfile> => ({ ...BUILT_IN_PROFILES, ...own });

/** How long a guest link can last, in hours: Share's choices (src/share/ShareMenu.tsx). */
export const LINK_HOURS = [1, 24, 24 * 7] as const;
