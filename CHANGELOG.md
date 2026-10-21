# Changelog

HeroCanvas's versions. The number shows in the toolbar (package.json `version`); each release is tagged `vX.Y.Z`.

While in 0.x: the minor number (0.**Y**.0) goes up for new features or architecture changes; the patch number
(0.Y.**Z**) for fixes, polish and small additions.

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
