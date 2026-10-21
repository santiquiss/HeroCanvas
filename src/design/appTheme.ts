// The app's theme as text (its `--app-*` tokens, app/theme.css), for what reads tokens rather than draws with them:
// the Tokens view, Inspect, the system text size. With no app connected, the tour's (src/tour/theme.css), which this
// also applies to the screens, over the kit's defaults.
import { NO_APP } from '../nav/noApp';
import tourCss from '../tour/theme.css?raw';

const appCss = Object.values(import.meta.glob('@app/**/theme.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>).join('\n');

export const APP_THEME_CSS: string = NO_APP ? tourCss : appCss;

// The tour's theme on the screens: one step more specific than the kit's defaults (src/kit/tokens.css), whichever
// stylesheet loads first.
if (NO_APP && typeof document !== 'undefined' && !document.getElementById('hc-tour-theme')) {
  const style = document.createElement('style');
  style.id = 'hc-tour-theme';
  style.textContent = tourCss.replace(/\[data-theme/g, ':root [data-theme');
  document.head.append(style);
}
