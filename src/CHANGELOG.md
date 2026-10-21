# HeroCanvas changelog

HeroCanvas's own versions (`src/version.json`, in the toolbar's ⓘ); each release is tagged `vX.Y.Z`, which is what
`npm run update` installs. A team's own changes go in the root `CHANGELOG.md`, not here.

While in 0.x: the minor number (0.**Y**.0) goes up for new features or architecture changes; the patch number
(0.Y.**Z**) for fixes, polish and small additions.

## 0.6.1 — 2026-10-21

- **HeroCanvas's page**: an ⓘ at the bottom of the left rail, over the light / dark switch, with HeroCanvas's version
  under it, opens About (`#/about`): who made it, its license and this changelog, as a page of its own (no side
  panels). It replaces the ⓘ beside the version in the toolbar.
- **The copy's version** in the toolbar is a button like its neighbors (the left panel's toggle, the Live menu), with
  the same border.

## 0.6.0 — 2026-10-21

- **Two versions, two changelogs**: a copy's own (`package.json`'s `version`, the root `CHANGELOG.md`: the team's
  mirror and proposals) at the top left of the toolbar, where its changelog opens; HeroCanvas's (`src/version.json`,
  this file) in an ⓘ beside it, with who made it and its license. Here the root changelog is the sample app's.
- **License**: PolyForm Shield 1.0.0 instead of MIT. Free to use, change and share, companies and commercial apps
  included; not to offer a product that competes with HeroCanvas. Source-available, not open source.
- **Contract**:
  - HeroCanvas's version is `src/version.json`, no longer `package.json`'s `version`, which is now the team's (from
    here, the update leaves it alone).
  - The root `CHANGELOG.md` is now the team's. Updating from 0.5.0 leaves HeroCanvas's old changelog there: replace
    it with your own (`## 0.1.0 — <date>` headings), or delete it.
  - `LICENSE` is now PolyForm Shield 1.0.0; `package.json`'s `license` is yours to set (an update doesn't touch it).

## 0.5.0 — 2026-10-21

- **Updates**: `npm run update` brings a newer HeroCanvas into a copy, from the repository's tags with the git
  credentials already set up. The tool's files (`scripts/update/tool-files.json`, read from the new version) are
  replaced; those the team changed are merged three ways, and a clash is left marked; `package.json` is merged by
  field; `app/`, `proposals/`, the config and `brand/` are never touched. `--dry-run` shows what it would do, and it
  prints the changelog in between. Copies from before 0.5.0 lack the command: copy `scripts/update*` in once.
- **The `update-herocanvas` skill**: runs it, resolves the clashes keeping both sides' intent, adapts `app/` and
  `proposals/` to each **Contract** item, then checks and shows the result.

## 0.4.0 — 2026-10-21

- **The team's code and the tool, apart** (as Laravel's skeleton and framework): `app/` and `proposals/` at the root
  are the team's, `src/` is the tool's and what updates replace. The README's layout and AGENTS.md say which is which.
- **The contract**:
  - The app and proposals import the tool only as `herocanvas` (`src/index.ts`, the public API: the same import
    once the tool is a package). A test fails on an import reaching into `src/`.
  - The tool reads the app as `@app`. Moved: `src/app` → `app/`; proposals `src/proposals/<slug>` →
    `proposals/<slug>`; the saved screen config `src/nav/screen-config.json` → `app/screen-config.json`; `AppConfig`,
    `AppNavigation` and `Persona` from `app/types.ts` to the tool (`herocanvas`).
- **Developer experience doc**: the Laravel model, and when it's 1.0: when the contract stops changing, not when the
  features feel done.

## 0.3.1 — 2026-10-21

- **Developer experience doc**: how a team's copy gets HeroCanvas's updates (template, clone, an update command, a
  package) and how they can change the tool itself and still update (configure, extend, eject a piece, eject it all).

## 0.3.0 — 2026-10-20

- **Stories for the sample app**: AppBar, Avatar, Checkbox, EmptyState, ListSection, ListTile, ProjectIcon and
  TextField, each with the variants the app uses (the gallery was empty). Their texts and data come from the app's.
- **Sample data, said so**: the sample app's data lives in `src/app/data/sample.ts` (was `tasks.ts`), marked as made
  up, with helpers for stories (`sampleTask`, `sampleProject`). "Demo" is "sample app" everywhere, and the README says
  its data is invented.
- **Gallery**: without a Figma inventory, the overview no longer shows an empty "0 of 0 Figma components" line.

## 0.2.0 — 2026-10-20

- **Icons from the logo**: the favicon (and the rail's logo), the home-screen icons and the web app manifest are made
  from `herocanvas.config.ts`'s logo, served by the dev server and written by the build (`scripts/vite/png.ts`: PNG
  read, scaled and written, no dependency). Changing the logo changes them all; the hand-made ones in `public/` are
  gone. The 512px icon is a fifth lighter.

## 0.1.0 — 2026-10-20

- **The skeleton**: the canvas and its devices, the simulator (navigation, list–detail, sheets that become menus,
  popovers and dialogs on large screens, the system keyboard, accessibility text sizes), Flow, Scenarios, proposals,
  comments, Capture (images and video), Inspect, Layers and the component gallery.
- **The app boundary** (`src/app`): an app gives its settings (`config.ts`), its pages (`pages.tsx`) and its
  navigation (`nav/`); the tool reads nothing else. Tokens (`--app-*`, `src/kit/tokens.css`) carry its look into the
  overlays the simulator draws.
- **A demo app** (Tasks): tabs, a project list beside its tasks on wide screens, a task's page, a welcome flow, two
  personas and two languages.
- **MIT license**.
