// A device drawn minimal: the same model (its size, its screen, its buttons) in one color, matte, as clay, in the place
// of its finish and metal. Its face (the frame) is CSS; its body is the 3D scene's, lit as clay (scene.ts).
import type { CSSProperties } from 'react';
import { t } from '../i18n/ui';
import type { Lighting } from './scene';

/** The clay's color when none is picked: an off-white. */
export const MINIMAL_COLOR = '#F2F3F6';

/** Colors a click away for it, besides any color: white, a warm sand, a gray, black. */
export const MINIMAL_COLORS: { name: string; color: string }[] = [
  { name: t('White'), color: MINIMAL_COLOR },
  { name: t('Sand'), color: '#E7DFD3' },
  { name: t('Gray'), color: '#C9CDD3' },
  { name: t('Black'), color: '#1F2023' },
];

/**
 * Its face in its color, lit from the top left (a touch lighter) and a shade darker toward the bottom right; a soft
 * highlight inside its top edge, a soft shade inside its bottom one. No line around it: frame, edge and sides one color.
 */
export const minimalFrame = (c: string) =>
  ({
    '--hc-device': `linear-gradient(150deg, color-mix(in srgb, ${c}, #fff 55%) 0%, ${c} 50%, color-mix(in srgb, ${c}, #000 7%) 100%)`,
    boxShadow: `inset 0 2px 1px color-mix(in srgb, ${c}, #fff 70%), inset 0 -2px 3px color-mix(in srgb, ${c}, #000 8%)`,
    // Its Home button in its color too, with a ring of a faint gray (the original's silver, barely there).
    '--hc-home-button': `linear-gradient(150deg, color-mix(in srgb, ${c}, #fff 40%), ${c})`,
    '--hc-home-ring': `inset 0 0 0 1.5px color-mix(in srgb, ${c}, #000 12%)`,
  }) as CSSProperties;

/** A minimal device's body as clay: every part in its color, matte (no metal, grain or dark backing). */
export const clayLight = (l: Lighting): Lighting => ({ ...l, clay: true, metal: 0, grain: 0 });
