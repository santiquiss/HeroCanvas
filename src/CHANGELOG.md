# HeroCanvas changelog

HeroCanvas's own versions (`src/version.json`, in the toolbar's ⓘ); each release is tagged `vX.Y.Z`, which is what
`npm run update` installs. A team's own changes go in the root `CHANGELOG.md`, not here.

While in 0.x: the minor number (0.**Y**.0) goes up for new features or architecture changes; the patch number
(0.Y.**Z**) for fixes, polish and small additions.

## 0.15.2 — 2026-10-21

- **The launch edge to edge**: no light hairline around it any more. Under the launch screen the app isn't shown yet
  (still laid out, for its exit to find where the icon lands), the screen takes the launch's background while it plays,
  and the launch reaches past the screen's rounded clip.
- **Fix**: Scenarios › Launch Off played it anyway on the dev server (React runs effects twice there, read as a
  replay); a replay is now told by its count.

## 0.15.1 — 2026-10-21

- **The launch in Pages**: a Launch section on top, with Launch screen: it opens the app's first screen and plays the
  launch on every device, again each time it's picked, to watch it while building it. Replays (here and Scenarios'
  Replay) play even with the launch Off, and no longer go in the URL.

## 0.15.0 — 2026-10-21

- **Launch, for any app**: an app declares its launch screen in `appConfig.launch`, in the four phases iOS and Android
  share: the **screen** (background per theme, icon, Android's icon background and brand mark), how the icon
  **enter**s (none, fade, spring, shine), how long it **hold**s while the app loads, how it **exit**s (fade, zoom,
  slide, or the icon flying to a component of the first screen). The simulator plays it on every device on a cold
  start, over the app and its navigation, under the status bar.
- **Scenarios › Launch**: once since HeroCanvas loaded (the default), every time a screen opens, or off; Replay.
- **The tour declares its launch** like any app (it had its own): the splash, then its icon flying to Welcome's.
- **`connect-app`** reads a launch screen from the code: iOS's Info.plist or storyboard, Android's SplashScreen theme
  and API, `flutter_native_splash`, Expo's `splash`.
- **Contract** (additions, nothing to adapt): `AppConfig.launch` (`LaunchConfig`), and `useLaunchPhase()` from
  `herocanvas` for a screen to start its entrance when the launch is over.

## 0.14.0 — 2026-10-21

- **Welcome opens with a launch**, to show the motion a screen can have: a splash in the brand's blue where the app
  icon springs in and a sheen sweeps it; the icon flies to its place in the hero (a shared element) while the blue
  fades; the sections rise in one after another. Then the icon stays alive: it floats, tilts in 3D after the pointer
  with a glare, and spins when tapped. Springs from `kit/motion`, transforms and opacity only; still in Flow and with
  reduced motion.
- **Scenarios › Launch**: once (the default) or every time Welcome opens; changing it plays it again.

## 0.13.0 — 2026-10-21

- **A component against the code, in three words**: Matches code, Differs from code, or **Local** (only in
  HeroCanvas, not in the app's code), which replaces "Not in code" and its "build it". Where it came from is a note,
  not a state. A component's page shows its state beside its name; tiers (Atoms…) only when Figma or the code gives
  them, else one list, Components (no more "Local" as a group).
- **The tour in Components and Tokens**: its nine components have stories (all Local), and its look is a theme of
  `--app-*` tokens with iOS's values (`src/tour/theme.css`), so Tokens lists them and the device's text size scales its
  type through its text styles.
- **Tokens without a code connector**: no more "Not in the code" in red on every token; the tour's say Local, an
  app's say nothing until a connector names them.
- **Fix**: Tokens read none of the space, corner and type tokens (a comment before their block hid it): they show now.
- **Contract**: none for a team's app.

## 0.12.0 — 2026-10-21

- **The tour is the starting point, on `main`**: the Tasks sample app is gone (it's kept in the `sample-tasks` tag), and so
  is the `empty` branch. A fresh copy opens on HeroCanvas's own tour until an app is connected.
- **The tour after iOS**: three tabs, Welcome (what HeroCanvas is, its goal, how it works), Tour (a page per part) and
  Get Started (connecting an app's code or a Figma file). Large titles, inset grouped lists, Settings-style icon tiles,
  iOS's system colors in light and dark, SF Pro, capsule buttons, and Liquid Glass on the tab bar, the back button and
  Copy. Its type follows the device's text size.
- **Contract**: none for a team's app. The tool's tests that used Tasks's pages are skipped.

## 0.11.1 — 2026-10-21

- **The tour's Welcome** offers two ways to begin, the app's code or a Figma file: no more "Look at a sample app", since
  the tour is already one.

## 0.11.0 — 2026-10-21

- **The tour**: with no app connected, HeroCanvas shows an app of its own (`src/tour`), declared and built like any
  app: a Welcome tab with the ways to connect yours, and a Tour tab with a page per part of HeroCanvas (devices, light
  and dark, Inspect and Layers, Pages and Flow, Scenarios, proposals and comments, Capture), each saying what it is
  and what to try on the interface around the device, then on to the next.
- **Everything works on it**: Pages and Layers list the tour's pages and components, Inspect names them, the Page
  panel, Scenarios, Comments, Live and Share are on again, Flow lays the tour out, Capture shoots it, and devices
  compare side by side (a tab bar on phones, a rail on tablets). Components and Tokens still say what they show.

## 0.10.0 — 2026-10-21

- **The welcome is a screen**: with no app connected, the devices show HeroCanvas's welcome as an app screen (on the
  app's tokens, so the device's theme and text size apply): the three ways to begin, each ready to copy. It replaces
  the right panel's Get started tab, which took room from the panels.
- **Flow and Capture work in empty mode**, on the welcome screen: try them, take images and videos, before there's an
  app. Components and Tokens keep saying what they show.

## 0.9.0 — 2026-10-21

- **Empty mode**: with no app connected, HeroCanvas shows its whole interface instead of a page of its own. The
  device shows where the app's screens will be; each panel (Pages, Layers, Page, Scenarios, Comments, Proposal,
  Components, Tokens) says what it shows once there's an app; Flow, Components, Tokens and Capture say the same on
  the canvas; Live, Inspect, Comment and Share are on view but off, their tooltips saying what they do. The devices,
  their themes and sizes work.
- **Get started** is the right panel's first tab in empty mode: the three ways to begin, ready to copy.

## 0.8.0 — 2026-10-21

- **Get started**: with no app connected (it declares no pages), HeroCanvas opens on a page that guides the start
  instead of failing: connect the app's code (recommended), start from a Figma file, or look at the sample app first,
  each as a request to the agent, ready to copy. Light and dark.
- **The `empty` branch**: HeroCanvas with no app at all, for a clean start; `main` keeps the sample app.
- **`connect-app` from Figma**: with no code, or when the design leads, the skill builds the mirror from a Figma file
  (frames, prototype links, variables, components), through the agent's Figma connection.
- **Tests without the sample app**: the tool's tests that use the sample app's pages are skipped when another app,
  or none, is connected; with none, a test checks Get started.

## 0.7.0 — 2026-10-21

- **The `new-persona` skill**: one or several personas for the connected app. It reads the app for what about a user
  changes its screens (account state, plan, role, how much data, language), proposes a set or asks what defines each
  one (the app's own values as options), and saves each with its mock data, derived like the rest, and a photo if
  wanted; then checks the screens as them.
- **`npm run persona:avatar -- <image> <id>`**: a persona's photo from an image the person gives: its centered square
  at 256 px, in `public/personas/<id>.png` (JPEG, HEIC and others converted with macOS's `sips`). No photo: their
  initials, as before.

## 0.6.6 — 2026-10-21

- **Page icons by role**: Pages, Flow, the changes menu and a component's places show each page by its role in the
  navigation, from one vocabulary (`ROLE_ICONS`): a tab, a pushed page, a cover, before the app. No longer a tab's own
  icon, which an app may not have, or may have one a Material Symbol can't draw (it showed as text). Hover names the
  role.

## 0.6.5 — 2026-10-21

- **One surface for menus and popovers**: the version's changelog, Live, the dropdowns, the persona and token menus,
  the comment popovers and Capture's menu share it (`src/theme/surface.module.css`): the same background, radius and
  shadow, which in dark has a lighter edge and a deeper shadow so it no longer blends into the background.
- **Live's empty state**: with no proposals, what one is and how to start it, instead of the table's headers alone (or,
  with all of them archived, where they are).

## 0.6.4 — 2026-10-21

- **The rail's ⓘ** shows no version number (the rail is 60px wide: a version like 0.125.34 wouldn't fit). The version is
  in its tooltip and on the About page.

## 0.6.3 — 2026-10-21

- **About, a page of its own**: no toolbar over it (the versions, proposals and Share are the app's), a back arrow at
  the top left to where it was opened from (the prototype, from a link), and its header centered: the app icon at
  192px, sharp at 96, over a larger name and the version.

## 0.6.2 — 2026-10-21

- **Authors**: HeroCanvas is made by Santiago Quiss and Agus Salas, both credited with their GitHub profiles on the
  About page, in the README and in `LICENSE`'s required copyright notice.

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
