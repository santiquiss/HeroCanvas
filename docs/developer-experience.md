# Developer experience: connecting any app to HeroCanvas

A first proposal to think through, not a decision. HeroCanvas today shows one app (the sample app, `src/app`) built in its
own React. The goal: a team with an app in React, React Native, Flutter, SwiftUI or Jetpack Compose installs it,
connects their app in minutes, and from then on designs, reviews and hands off on a canvas that matches their code.

## What a team gets

The canvas and its devices, the simulator (navigation, list–detail, sheets that become menus and dialogs on large
screens, the keyboard, accessibility text sizes, light and dark, languages), Flow, Scenarios (personas, page
controls), proposals with versions and a handoff, comments, Capture (images and videos), Inspect, Layers and the
component gallery. None of it knows the app: it reads it through the app boundary.

## The boundary (what exists today)

An app gives HeroCanvas four things (`src/app`):

| | What | Where |
|---|---|---|
| Settings | Name, languages, personas, the home tab | `config.ts` (`AppConfig`) |
| Pages | One per screen, at its route: level (tab, push, cover, boot), links, state, flows, controls, list–detail | `pages.tsx` |
| Navigation | Its tab bar, rail and Duo column | `nav/` (`AppNavigation`) |
| Look | Its tokens (`--app-*`): colors per theme, space, radii, type, elevation | `theme.css` over `src/kit/tokens.css` |

And, optionally, what its code says, through **connectors** (`src/app/connectors/*.json`): the components' API
(names and parameters), a design file's inventory and its map to the code, a component catalog, notes for the API
review. Inspect, the gallery and the handoff use them when they're there.

## Three ways to put an app on the canvas

| | **Mirror** | **Live (web)** | **Snapshots (native)** |
|---|---|---|---|
| What runs | The app's screens re-built in HeroCanvas's React, with the code's component names and props | The app itself, built for the web, in each device (an iframe) with a small SDK | The app's previews, rendered by its own toolchain, as images |
| Stacks | Any | React, React Native (react-native-web, Expo), Flutter (web build) | SwiftUI (`#Preview`), Compose (`@Preview`), Flutter (goldens) |
| Fidelity | As good as the mirror (drift is the risk) | The real code | The real code, pixel for pixel |
| Interaction | Full: navigation, sheets, the keyboard, flows | Full, through the SDK | None: still frames per state |
| Designing new things | Yes: proposals are written in the mirror | Only what the code has | Only what the code has |
| Cost | Keeping two versions (agents make it cheap) | A web build and an SDK in the app | A build per sync; slow |

They're not exclusive. The likely shape: **mirror for designing, live or snapshots for checking it against the
code.** A page could show its mirror beside its real render, and Inspect could diff them (the QA tickets MF Designer
writes by hand today).

## Connectors per stack

What HeroCanvas reads from each kind of codebase, so the mirror starts from the real thing and stays honest:

| | Routes → pages | Components → API | Tokens | Texts | Catalog | Live / snapshots |
|---|---|---|---|---|---|---|
| **React (web)** | React Router, Next.js, TanStack Router | TypeScript props (`react-docgen-typescript`) | CSS variables, Tailwind config, theme objects | i18next / FormatJS JSON | Storybook | Live: the dev server |
| **React Native / Expo** | Expo Router (files), React Navigation | TypeScript props | Theme objects, Tamagui / NativeWind | i18next JSON | Storybook RN | Live: react-native-web |
| **Flutter** | go_router, auto_route | The analyzer: widget constructors | ThemeExtension, ColorScheme | ARB (slang, intl) | Widgetbook | Live: `flutter build web`; goldens |
| **SwiftUI** | NavigationStack destinations (enums), harder to read | swift-syntax: `View` initializers | Asset catalog colors, a theme struct | String catalogs (`.xcstrings`) | Xcode previews | Snapshots: swift-snapshot-testing |
| **Jetpack Compose** | Navigation Compose graphs | Kotlin PSI / KSP: `@Composable` parameters | MaterialTheme, ColorScheme | `strings.xml` | Showkase | Snapshots: Paparazzi, Roborazzi |

Each connector is a small CLI that writes the JSON files the tool already reads. Routes and tokens turn into a first
`pages.tsx` and `theme.css`; texts into the app's i18n; the component API into Inspect's "code API" and the check that
every prop the mirror invents is declared.

## Onboarding (a first sketch)

```
npx herocanvas init
```

1. **Detects the stack** (`package.json` with React / Expo, `pubspec.yaml`, an `.xcodeproj` / `Package.swift`,
   Gradle with Compose) and asks where the mirror lives: a `herocanvas/` folder in the app's repo (recommended: one PR
   changes code and design together) or a repo of its own.
2. **Writes `herocanvas.config.ts`**: the app's name, where its code is, which connectors run.
3. **Runs the connectors once** (`herocanvas sync`): routes, tokens, texts, the component API.
4. **Scaffolds the mirror**: `config.ts`, a `pages.tsx` with a placeholder per route, `theme.css` from the tokens, the
   navigation from the tabs it found.
5. **Leaves instructions for an agent** (`AGENTS.md` and skills): how to mirror a screen from the code, name
   components as the code does, declare what differs, take screenshots.
6. **Opens the canvas** (`herocanvas dev`): every route is a page, the placeholders mark what's left to mirror.

From then on: `herocanvas sync` in CI keeps the connectors' files current, and a check fails when the code gets a
parameter or a token the mirror doesn't know.

## Updates

A team's copy holds two kinds of code: the tool (ours) and their app's mirror and proposals (theirs). An update should
replace the first and never touch the second. How well that works depends on how the copy was made:

| | How they got it | How they update | What goes wrong |
|---|---|---|---|
| **Template** (today's README) | "Use this template": a new repo, one commit, no shared history | A merge with `--allow-unrelated-histories` | Git can't tell who changed what: nearly every file conflicts. In practice, nobody updates |
| **Clone or fork** | History shared with HeroCanvas | `git pull upstream main` | The tool's folders merge cleanly; `src/app` conflicts whenever the sample app changes (it shares the folder with theirs); `package.json`, `CHANGELOG.md` and the README always conflict. A fork of a public repo is public |
| **Update command** | Any of the above | `npx herocanvas update`: the tool's folders replaced by a release's; `src/app`, `src/proposals` and `herocanvas.config.ts` left alone | Nothing in the tool, as long as they didn't edit it. Their app may need changes when the contract does |
| **Package** | `npm install herocanvas`; their repo holds only the config, the app and the proposals | `npm install herocanvas@latest` | Only what the contract breaks, which semver announces |

The contract is what the tool reads from the app: `AppConfig`, the page manifest, `AppNavigation`, the `--app-*`
tokens, `useComponent` and the stories' format, the connectors' JSON. With a package it's public API: it changes in
major versions only, and each change comes with a migration.

An **`update-herocanvas` skill** does the migrating: it reads the changelog between the two versions and adapts the
team's app to each contract change (a renamed manifest field, a new required token), then runs the checks. Updating
becomes "update HeroCanvas" to the agent.

The sample app lives in the package (or `herocanvas init` writes it), never in the team's folder, so changing it never
conflicts with their app.

**Proposed path**: the update command and the skill now, while the repo is still private, so no one ends up with a
copy that can't be updated; the package next (Order, step 1). The skill carries over unchanged.

## Changing the tool itself

A package doesn't stop a team from changing the tool. It makes visible which of their changes updates keep, and
which they maintain. Four levels, cheapest to keep first:

| | What | Example | On update |
|---|---|---|---|
| **Configure** | `herocanvas.config.ts` | Name, logo, brand color, devices, which panels show | Kept, always |
| **Extend** | Their code, loaded through an extension point | A panel of their own, a toolbar tool, another handoff format, a connector, scenario controls | Kept while the extension API holds; a break is in the changelog |
| **Eject a piece** | One of the tool's components copied into their repo (`npx herocanvas eject Toolbar`), used instead of the package's (as Docusaurus's *swizzle*) | A toolbar laid out differently | The rest updates; that piece is theirs |
| **Eject everything** | The whole tool in their repo | Today's template | Full control; updating is a git merge |

The app boundary already works this way: the app, its manifest, navigation, tokens and connectors are extension
points ("declare, don't special-case"). More come when they're needed.

**Ejected pieces need not go stale.** The update skill can merge them: it diffs the package's piece between the old
and the new version and applies that diff to the team's copy, keeping their changes, and asks when the two clash —
what a developer would do by hand, without anyone having to remember to.

**Signals to act on**: when several teams eject the same piece, it's missing an extension point, or the change
belongs in HeroCanvas. And since it's open source, a change that's general should come back as a pull request,
where it stops being something one team maintains.

## Order

1. **The boundary as a package**: HeroCanvas as an npm package (the tool) and the app as a folder it's pointed at
   (`herocanvas.config.ts`), instead of a fork with `src/app` replaced. Everything else depends on this. Before it,
   while the repo is private: the update command and skill (see Updates).
2. **React (web) and React Native / Expo**: the most popular stacks, mirror and live from the same language, routes
   and props readable with TypeScript's own tools.
3. **Flutter**: what MF Designer already does by hand (the analyzer for the API, ARB for texts, Widgetbook as the
   catalog), turned into connectors.
4. **SwiftUI and Compose**: mirror first, snapshots next; their routes are the hardest to read statically.

## Open questions

- Is the mirror the product, with live and snapshots as checks, or the other way round?
- Hosted (a URL per team, comments shared) or self-hosted only (the repo is the source of truth)?
- How much should the agent do on its own: mirror every screen on `init`, or one at a time on request?
- Licensing and naming of the kit: is it HeroCanvas's look, or does it take the app's from day one?
- Which extension points come first (panels, toolbar tools, handoff formats), and which pieces can be ejected?
- Until the package exists: keep "Use this template" in the README (with the update command), or ask for a clone with
  an `upstream` remote?
