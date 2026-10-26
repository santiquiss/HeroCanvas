// HeroCanvas's own settings: how the tool itself looks (not the app it shows: that's app/config.ts, which also says which devices the app is for). Read when the
// dev server starts or the site is built (scripts/vite/brand.ts); restart `npm run dev` after a change.
import type { HeroCanvasConfig } from './scripts/vite/brand.ts';

const config: HeroCanvasConfig = {
  name: 'HeroCanvas',
  /** A square PNG: the rail's logo and the app icons come from it, and so does the brand color below. */
  logo: 'brand/hc-logo.png',
  /**
   * The brand color (the Share button), per theme of the interface. Leave it out to take it from the logo: its most
   * vivid color that covers a good part of it, made dark enough for white text in light and a step lighter in dark.
   */
  // brand: { light: '#0a5cff', dark: '#3d7dff' },
  /** The interface's language: `en` or `es` (Spanish). The app's screens keep their own languages (app/config.ts). */
  // language: 'es',
  /**
   * Shared comments: a Supabase project's address and publishable key (its table: src/comments/supabase.sql). Left out,
   * each browser keeps its own. `team`: who can be @mentioned, with their Slack member id, to tell them in Slack.
   */
  // comments: { url: 'https://<project>.supabase.co', key: 'sb_publishable_…', team: [{ name: 'Ana Silva', slack: 'U012AB3CD' }] },
};

export default config;
