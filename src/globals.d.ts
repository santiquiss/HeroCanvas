/** This copy's version (package.json `version`: the team's, for their mirror and proposals), injected by vite.config.ts. */
declare const __APP_VERSION__: string;
/** HeroCanvas's own version (src/version.json). */
declare const __HC_VERSION__: string;
declare const __BUILD_ID__: string;
/** The interface's language (herocanvas.config.ts `language`). */
declare const __HC_LANGUAGE__: string;

/** The tool's brand colors (scripts/vite/brand.ts). */
declare module 'virtual:hc-brand.css';
