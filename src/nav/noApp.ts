// No app connected: the app declares no pages (app/pages.tsx), so HeroCanvas shows its own tour (src/tour) with its
// theme and its components' stories. Read from the pages alone, so modules loaded early can ask.
import { BASE_PAGES } from '@app/pages';

export const NO_APP = Object.keys(BASE_PAGES).length === 0;
