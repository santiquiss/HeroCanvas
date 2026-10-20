// HeroCanvas's own settings: how the tool itself looks (not the app it shows: that's src/app/config.ts). Read when the
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
};

export default config;
