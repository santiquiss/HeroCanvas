# Working on HeroCanvas

Guidance for anyone building here with an AI agent (Claude Code reads it through `CLAUDE.md`; other agents read this
file). The README says what HeroCanvas is; this file is how to change it.

## Where a change goes

Two sides, as in Laravel's skeleton and framework:

- **The team's code**, at the root: `app/` (the connected app; none yet, so HeroCanvas shows its own tour),
  `proposals/`, `herocanvas.config.ts`, `brand/`. It imports the tool only as
  `from 'herocanvas'` (`src/index.ts`, the public API); a test fails on any import reaching into `src/`.
- **The tool**, in `src/`: never knows the app. It reads it as `@app`: its settings (`config.ts`), pages
  (`pages.tsx`), navigation (`index.ts`), stories, connectors (`connectors/*.json`), screen config and the `--app-*`
  tokens. A tool that needs to know a page by name is in the wrong place: declare it in the manifest instead.
- **The iOS kit** (`src/ios`, `herocanvas/ios`): SwiftUI's own views (a NavigationStack's screen, List's Sections and
  rows, Picker, Toggle…), named as SwiftUI names them, on the `--app-*` tokens: a SwiftUI app's mirror uses them
  instead of rebuilding the platform.
- **The kit** (`src/kit`, part of the tool): the overlays the simulator presents with, and their buttons. Styled only
  with `--app-*` tokens, so any app's look reaches them.

**The contract** is what crosses between them: `src/index.ts` and what the tool reads from `app/`. While in 0.x it may
change; each change goes in `src/CHANGELOG.md` under **Contract**, saying what to adapt, so a team's agent can do it on
update (`update-herocanvas`). At 1.0 it holds still. A new folder or file of the tool's goes in
`scripts/update/tool-files.json`, or updates won't bring it.

## Procedures (skills)

Step by step, in `.claude/skills/<name>/SKILL.md` (Claude Code loads them on its own; any other agent reads the file
when the task is one of these):

- **`connect-app`**: the person's app connected for the first time: its code read (any stack), or a Figma file;
  `app/` filled with its mirror (settings, tokens, navigation, one page per screen).
- **`mirror-screen`**: one screen or component of the app, built or fixed to match its code.
- **`new-proposal`**: a change to the app as a proposal (`proposals/<slug>`), with versions and a handoff.
- **`new-persona`**: one or several personas, from what about a user changes the app's screens and the person's
  answers: each with its mock data and an optional photo (`npm run persona:avatar`).
- **`update-herocanvas`**: a newer HeroCanvas into this copy (`npm run update`), its clashes resolved and the team's
  code adapted to the contract's changes.

The person's app's own repository is read, never edited: everything goes in HeroCanvas.

## Rules

- **Fast**: animations on the compositor (`transform`, `opacity`), no heavy work in render, no new runtime dependency
  without a strong reason (today: React, React Router).
- **Declare, don't special-case**: pages, their state, flows, scenario controls and list–detail live in the manifest.
- **One source of truth for data**: an app's mock data lives in one module its screens derive from.
- **Components are instrumented**: a component marks its root with `useComponent(name, props)` (from `herocanvas`)
  so Inspect and Layers find it, and has stories (`<Name>.stories.tsx`) for the gallery.
- **One surface for what floats**: a menu, dropdown or popover of the designer composes `surface` from
  `src/theme/surface.module.css` (its background, radius and the theme's `--ui-pop-shadow`, which sets it apart in
  light and dark), and an empty list shows its `empty` state, never bare headers.
- **Pages, one icon**: wherever the designer lists pages, a page's icon is a phone (`ROLE_ICONS`, `src/nav/stack.ts`),
  its role (tab, push, cover, boot) in its tooltip, badge and indent; the same for every app, never the app's own
  icons, which may be missing or not drawable.
- **The tour stands in for an app**: with none connected (`NO_APP`, `src/nav/noApp.ts`), HeroCanvas shows its own
  (`src/tour`): its pages, navigation, components with their stories, and its theme as `--app-*` tokens
  (`src/tour/theme.css`), so every mode has something real. A new part of the designer gets a step in
  `src/tour/steps.ts`, its `spots` naming the controls it points at (`data-tour` on them): a beacon pulses on
  each while the step is open.
- **Launch in four phases**: an app's launch screen is `appConfig.launch` (screen, enter, hold, exit: the names
  iOS and Android share), played by the simulator; a screen waits for it with `useLaunchPhase()`. Never a splash of
  a screen's own.
- **A component against the code, in three words**: **Matches code**, **Differs from code**, or **Local** (only in
  HeroCanvas, not in the app's code). Where it came from (a Figma file, another design tool, a proposal) is a note,
  never a state of its own; tiers (Atoms…) show only when Figma or the code gives them. Tokens the same: no code
  connector, no "not in the code".
- **Icons as the app draws them**: Material Symbols by name (`<Icon name="search" />`), or the app's SF Symbols and
  its own symbols as `sf:<name>` (`<Icon name="sf:magnifyingglass" />`), made on a Mac with `npm run symbols` into
  `public/symbols/` and `app/symbols.json` (the team's); with no names it makes HeroCanvas's own, the system
  keyboards' and the iOS kit's glyphs (`scripts/symbols/system.json`), which they draw in Material's closest without. HeroCanvas ships no SF Symbols: Apple's license allows them to
  design apps for its platforms, made from the Mac's own copy.
- **Public files by `import.meta.env.BASE_URL`**, never from `/`: the built site is relative (`base: './'`), so it
  works at a domain's root or under a path (GitHub Pages).
- **The interface in two languages**: every text HeroCanvas's own interface shows goes through `t('English text')`
  (`src/i18n/ui.ts`), its Spanish in `src/i18n/es/<area>.json` by the glossary (`src/i18n/GLOSSARY.md`); a test fails
  on a missing or unused one. Never translate what the app's screens show (they keep the app's languages), nor what's
  written for developers and agents (handoffs, prompts, exported files). A team picks it in `herocanvas.config.ts`
  (`language: 'es'`).
- **Comments say why**, in short sentences, matching the code around them.

## Before you call it done

`npm run typecheck`, `npm run lint`, `npm test`, `npx vite build`; then look at it (`npm run shot -- "/today"`, or the
dev server) on a phone and a tablet, light and dark.

Versioning: two versions, two changelogs.

- **This copy's** (`package.json`'s `version`, `CHANGELOG.md` at the root): the team's mirror and proposals. A change
  to `app/` or `proposals/` bumps it and adds an entry. Shown at the top left of the toolbar.
- **HeroCanvas's** (`src/version.json`, `src/CHANGELOG.md`): only when developing HeroCanvas itself. Every commit to
  the tool bumps it (0.Y.0 features, 0.Y.Z fixes), adds an entry (a **Contract** item for what a team must adapt),
  updates the README's badge, and is tagged `vX.Y.Z`: the tags are what `npm run update` installs. Shown on its
  page (`#/about`), from the ⓘ at the bottom of the left rail.
