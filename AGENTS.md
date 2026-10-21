# Working on HeroCanvas

Guidance for anyone building here with an AI agent (Claude Code reads it through `CLAUDE.md`; other agents read this
file). The README says what HeroCanvas is; this file is how to change it.

## Where a change goes

Two sides, as in Laravel's skeleton and framework:

- **The team's code**, at the root: `app/` (the connected app, today a sample app, a task manager, with made-up data
  all in `app/data/sample.ts`), `proposals/`, `herocanvas.config.ts`, `brand/`. It imports the tool only as
  `from 'herocanvas'` (`src/index.ts`, the public API); a test fails on any import reaching into `src/`.
- **The tool**, in `src/`: never knows the app. It reads it as `@app`: its settings (`config.ts`), pages
  (`pages.tsx`), navigation (`index.ts`), stories, connectors (`connectors/*.json`), screen config and the `--app-*`
  tokens. A tool that needs to know a page by name is in the wrong place: declare it in the manifest instead.
- **The kit** (`src/kit`, part of the tool): the overlays the simulator presents with, and their buttons. Styled only
  with `--app-*` tokens, so any app's look reaches them.

**The contract** is what crosses between them: `src/index.ts` and what the tool reads from `app/`. While in 0.x it may
change; each change goes in `CHANGELOG.md` under **Contract**, so a team knows what to adapt. At 1.0 it holds still.

## Procedures (skills)

Step by step, in `.claude/skills/<name>/SKILL.md` (Claude Code loads them on its own; any other agent reads the file
when the task is one of these):

- **`connect-app`**: the person's app connected for the first time: its code read (any stack), the sample app in
  `app/` replaced by its mirror (settings, tokens, navigation, one page per screen).
- **`mirror-screen`**: one screen or component of the app, built or fixed to match its code.
- **`new-proposal`**: a change to the app as a proposal (`proposals/<slug>`), with versions and a handoff.

The person's app's own repository is read, never edited: everything goes in HeroCanvas.

## Rules

- **Fast**: animations on the compositor (`transform`, `opacity`), no heavy work in render, no new runtime dependency
  without a strong reason (today: React, React Router).
- **Declare, don't special-case**: pages, their state, flows, scenario controls and list–detail live in the manifest.
- **One source of truth for data**: an app's mock data lives in one module its screens derive from.
- **Components are instrumented**: a component marks its root with `useComponent(name, props)` (from `herocanvas`)
  so Inspect and Layers find it, and has stories (`<Name>.stories.tsx`) for the gallery.
- **Comments say why**, in short sentences, matching the code around them.

## Before you call it done

`npm run typecheck`, `npm run lint`, `npm test`, `npx vite build`; then look at it (`npm run shot -- "/today"`, or the
dev server) on a phone and a tablet, light and dark.

Versioning: every commit bumps `package.json`'s version (0.Y.0 features, 0.Y.Z fixes), adds a `CHANGELOG.md` entry,
updates the README's badge, and is tagged `vX.Y.Z`.
