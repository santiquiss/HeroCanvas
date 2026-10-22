// The app's theme (its `--app-*` tokens, app/theme.css; with no app connected, the tour's, src/tour/theme.css): as
// text, for what reads tokens rather than draws with them (the Tokens view, Inspect, the system text size), and
// applied to the screens, over the kit's defaults, so an app's theme needs no import of its own.
import { NO_APP } from '../nav/noApp';
import tourCss from '../tour/theme.css?raw';

const appCss = Object.values(import.meta.glob('@app/**/theme.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>).join('\n');

export const APP_THEME_CSS: string = NO_APP ? tourCss : appCss;

// On the screens: one step more specific than the kit's defaults (src/kit/tokens.css), whichever stylesheet loads
// first; an app theme's block (`[data-app-theme]`, after them) as specific, so it wins. Kept up to date while the app's theme changes in development.
const THEME_ID = 'hc-app-theme';
function applyTheme(css: string) {
  if (typeof document === 'undefined') return;
  const style = document.getElementById(THEME_ID) ?? Object.assign(document.createElement('style'), { id: THEME_ID });
  style.textContent = css.replace(/\[data-(app-)?theme/g, ':root [data-$1theme');
  if (!style.isConnected) document.head.append(style);
}
applyTheme(APP_THEME_CSS);
