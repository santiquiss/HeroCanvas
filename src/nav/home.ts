// The tab an empty or unknown URL opens: the app's (its config, free of its screens, so screens can read it). With no
// app connected, the tool's own page that stands in for its screens (nav/pages.tsx).
import { appConfig } from '@app/config';

export const HOME = appConfig.home || 'start';
