/** This copy's version (package.json `version`: the team's, for their mirror and proposals), injected by vite.config.ts. */
declare const __APP_VERSION__: string;
/** HeroCanvas's own version (src/version.json). */
declare const __HC_VERSION__: string;
declare const __BUILD_ID__: string;
/** The interface's language (herocanvas.config.ts `language`). */
declare const __HC_LANGUAGE__: string;
/** Where comments are shared (herocanvas.config.ts `comments`); null: this browser only. */
declare const __HC_COMMENTS__: { url: string; key: string } | null;
/** Who can be @mentioned in a comment, with their Slack member id (herocanvas.config.ts `comments.team`). */
declare const __HC_TEAM__: { name: string; slack: string }[];

/** Guest links (herocanvas.config.ts `share`): the production site's address, and the team's own views. */
declare const __HC_SHARE__: { url: string | null; profiles: Record<string, import('./share/profiles').ViewProfile> };

/** The tool's brand colors (scripts/vite/brand.ts). */
declare module 'virtual:hc-brand.css';

/** The project this build shows (herocanvas.config.ts `projects`): the first is the root, the others at `path`. */
declare const __HC_PROJECT__: { id: string; root: boolean; path: string; handoff: 'file' | 'code' };
/** Every project of the copy, for the toolbar's menu; empty with only one. */
declare const __HC_PROJECTS__: { id: string; name: string; path: string }[];
/** The proposal codes the copy's other projects took or retired: a code is the copy's, never given twice. */
declare const __HC_OTHER_CODES__: string[];
