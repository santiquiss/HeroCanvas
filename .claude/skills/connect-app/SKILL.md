---
name: connect-app
description: Connect someone's app to HeroCanvas for the first time - read its code (any stack), replace the demo in src/app with a mirror of it (settings, tokens, navigation, one page per screen as a placeholder), then mirror the first screens. Use when the person asks to connect, set up, onboard or "make HeroCanvas show" their app.
---

# Connect an app

The person has HeroCanvas running with the demo (`src/app`, a task manager) and wants it to show their app instead.
The result: `src/app` replaced by a **mirror** of their app — its settings, its look (tokens), its navigation and one
page per screen — that the tool reads through the same boundary (`src/app/index.ts`). Screens start as placeholders
and get mirrored one at a time (`mirror-screen`).

Talk to the person in their language; write code and comments in English.

## 1. Find the app and its stack

Ask where its code is (a path on this machine; a GitHub URL they can clone), unless they said. **Read it, never edit
it**: their app's repository is theirs; everything you write goes in HeroCanvas.

Detect the stack from the root:

| File | Stack | Routes | Theme | Texts |
|---|---|---|---|---|
| `package.json` with `react-dom` / `next` | React (web) | React Router, Next.js `app/` or `pages/`, TanStack Router | CSS variables, Tailwind config, a theme object | i18next / FormatJS JSON |
| `package.json` with `react-native` / `expo` | React Native | Expo Router (`app/`), React Navigation | a theme object, Tamagui, NativeWind | i18next JSON |
| `pubspec.yaml` | Flutter | go_router, auto_route, `routes:` | `ThemeData`, `ColorScheme`, ThemeExtensions | ARB files (`l10n/`) |
| `*.xcodeproj`, `Package.swift` with SwiftUI | SwiftUI | `NavigationStack` destinations, a route enum, `TabView` | the asset catalog's colors, a theme struct | `.xcstrings`, `Localizable.strings` |
| `build.gradle(.kts)` with Compose | Jetpack Compose | Navigation Compose `NavHost` | `MaterialTheme`, `ColorScheme` | `res/values*/strings.xml` |

Tell the person what you found in two or three lines (stack, how many screens, tabs, languages) before writing.

## 2. Settings (`src/app/config.ts`)

`appConfig`: the app's name, its languages (the base first, as its code lists them), its home tab, and 2–3
**personas**: who uses the app in ways that change the screens (new with no data, an active one, a paying one…). Ask
the person who they are if the code doesn't say (a subscription tier, an empty state). Put the app's logo or icon in
`public/assets/` if they want it on the screens.

## 3. Look (`src/app/theme.css`)

Write the app's tokens as the `--app-*` variables the kit and the screens read (`src/kit/tokens.css` lists them and
their defaults): colors per theme (`[data-theme='light']`, `[data-theme='dark']`), space, radii, the type styles as
`font` shorthands, elevation. Take the values from the app's theme, not from screenshots. A token the app has and the
contract doesn't: add it as `--app-<name>` too; screens may read it.

## 4. Navigation (`src/app/nav/`)

The app's tab bar (phones), and rail and side column (large screens) if it has them, as `AppNavigation` components,
starting from the demo's `AppNav.tsx`. Same tabs, icons (Material Symbols names closest to the app's), labels and
look. If the app has no tabs, the components render nothing and every page is a push or a cover.

## 5. Pages (`src/app/pages.tsx`)

One page per screen of the app, at its route, from its router (not from guessing): `level` (`tab`, `push`, `cover`,
`boot` for what comes before the tabs: welcome, sign in, onboarding), `parent`, `tab` for tabs, `links` (where it
navigates), `defaults` and `variants` for routes with params, `status: 'placeholder'` until mirrored. Each component a
placeholder for now: the screen's title in the app's scaffold (`Scaffold` from the demo, restyled) and one line saying
it's not mirrored yet. Sheets, dialogs and links aren't pages. Flows (onboarding steps) are one page with `flow`.

Delete what's left of the demo (its screens, components, data, texts) once nothing reads it.

## 6. Check it and show it

`npm run typecheck`, `npm run lint`, `npm test`, `npx vite build`. Then `npm run shot -- "/<home route>"` and look at
the picture: the tabs, the colors in light and dark. Show it to the person, with the list of pages and their status.

## 7. Mirror the first screens

Ask which screen matters most (usually the home tab) and mirror it with `mirror-screen`. One screen at a time, each
shown before the next.
