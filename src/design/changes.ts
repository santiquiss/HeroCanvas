// The colors of change, the same everywhere in the designer (badges in Pages, Flow, the gallery and the Proposal
// panel; Inspect's work; the highlight on the screens; the changes popover). Cyan for new (green is a common status
// color in apps: on the screens it would read as the app's), hot pink for changed (the highlight's color: what's
// highlighted on a screen is what changed), red for removed.
import { t } from '../i18n/ui';

export type ChangeKind = 'new' | 'changed' | 'removed';

export const CHANGE: Record<ChangeKind, { label: string; color: string; soft: string; text: string }> = {
  new: { label: t('New'), color: '#06b6d4', soft: 'rgba(6, 182, 212, 0.16)', text: '#0e7490' },
  changed: { label: t('Changed'), color: '#ff2d95', soft: 'rgba(255, 45, 149, 0.14)', text: '#c8006b' },
  removed: { label: t('Removed'), color: '#e5484d', soft: 'rgba(229, 72, 77, 0.14)', text: '#c4262c' },
};

/**
 * Highlight changes on the screens (ChangesOverlay): the color of changed, a color apps seldom use, so it
 * stands out on any screen.
 */
export const HIGHLIGHT = CHANGE.changed.color; // = --hc-hl in sim/ChangesOverlay.module.css
