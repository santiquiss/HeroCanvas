---
name: connect-app
description: Connect someone's app to HeroCanvas for the first time - read its code (any stack), or a Figma file when there's no code, fill app/ (empty until then: HeroCanvas shows its own tour) with a mirror of it (settings, tokens, navigation, one page per screen as a placeholder), then mirror the first screens. Use when the person asks to connect, set up, onboard or "make HeroCanvas show" their app, or to build it from a Figma file.
---

# Connect an app

The person has HeroCanvas running with no app connected (`app/` declares no pages, so HeroCanvas shows its own tour,
`src/tour`) and wants it to show their app. The result: `app/` holding a **mirror** of their app — its settings, its
look (tokens), its navigation and one page per screen — that the tool reads through the same boundary
(`app/index.ts`). Screens start as placeholders and get mirrored one at a time (`mirror-screen`).

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

### From a Figma file instead

When there's no code yet, or the design leads, the person gives a Figma file's link. It needs Figma connected to you
(its MCP server); if it isn't, say so and how to connect it, and offer the code path. Then read, never edit, the file:

- **Pages**: its screen frames (one per screen, by page or section), their names, and the prototype's links between
  them for `links` and the levels (a frame reached from a tab bar is a tab; one over another, a push).
- **Tokens**: its variables (colors per mode, spacing, radii) and text styles, for `app/theme.css`.
- **Components**: its components and their properties: they name the mirror's, as the code's would.
- **Texts**: the frames' copy in the base language; other languages only if the file has them.

The steps below are the same; where they say "the code", read "the file". Say in `app/config.ts`'s comment that the
mirror comes from Figma. When the code exists, connecting it (this skill again) makes the code the source: what
differs from the file is then the file's to update, not the mirror's.

## 2. Settings (`app/config.ts`)

`appConfig`: the app's name, its languages (the base first, as its code lists them), its home tab, and 2–3
**personas**: who uses the app in ways that change the screens (new with no data, an active one, a paying one…). Ask
the person who they are if the code doesn't say (a subscription tier, an empty state). Put the app's logo or icon in
`public/assets/` if they want it on the screens.

### The launch (`appConfig.launch`)

If the app has a launch screen, declare it (`LaunchConfig`, the same four phases on every platform: the **screen**,
how its icon **enter**s, how long it **hold**s, how it **exit**s). Read it from where the code keeps it:

| Stack | Screen | Hold | Exit |
|---|---|---|---|
| iOS | `UILaunchScreen` in Info.plist (`UIColorName`, `UIImageName`) or `LaunchScreen.storyboard` | A view of the app's own over it while it loads | That view's animation |
| Android | A `Theme.SplashScreen` theme: `windowSplashScreenBackground`, `windowSplashScreenAnimatedIcon`, `windowSplashScreenIconBackgroundColor`, `windowSplashScreenBrandingImage` | `setKeepOnScreenCondition` | `setOnExitAnimationListener` |
| Flutter | `flutter_native_splash.yaml` (`color`, `image`, `color_dark`, `branding`, `android_12`) | `FlutterNativeSplash.preserve` / `remove` | In the app |
| Expo / React Native | `app.json` `splash` (`image`, `backgroundColor`, `dark`), `react-native-bootsplash` | `SplashScreen.preventAutoHideAsync` | `hideAsync` (a fade), or in the app |

Colors per theme as the code gives them; the icon and brand mark copied into `public/`; `hold` from what the app
waits for (a short one when it loads nothing); `exit: { to: '<Component>' }` when the icon lands on a component of the
first screen. A logo or emblem with its own shape (on transparency) is `iconShape: 'none'`; when it lands inside a
bigger component (an emblem inside the app icon), mark that spot in the component with `data-launch-anchor`. No launch
screen in the code: leave `launch` out.

## 3. Look (`app/theme.css`)

Write the app's tokens as the `--app-*` variables the kit and the screens read (`src/kit/tokens.css` lists them and
their defaults): colors per theme (`[data-theme='light']`, `[data-theme='dark']`), space, radii, the type styles as
`font` shorthands, elevation. Take the values from the app's theme, not from screenshots. A token the app has and the
contract doesn't: add it as `--app-<name>` too; screens may read it.

## 4. Navigation (`app/nav/`)

The app's tab bar (phones), and rail and side column (large screens) if it has them, as `AppNavigation` components,
like the tour's (`src/tour/TourNav.tsx`, an example to start from). Same tabs, icons (Material Symbols names closest to the app's), labels and
look. If the app has no tabs, the components render nothing and every page is a push or a cover.

## 5. Pages (`app/pages.tsx`)

One page per screen of the app, at its route, from its router (not from guessing): `level` (`tab`, `push`, `cover`,
`boot` for what comes before the tabs: welcome, sign in, onboarding), `parent`, `tab` for tabs, `links` (where it
navigates), `defaults` and `variants` for routes with params, `status: 'placeholder'` until mirrored. Each component a
placeholder for now: the screen's title in the app's scaffold (the tour's `Screen`, `src/tour/TourKit.tsx`, is
an example; write the app's own) and one line saying it's not mirrored yet. Sheets, dialogs and links aren't pages.
Flows (onboarding steps) are one page with `flow`.


## 6. Check it and show it

`npm run typecheck`, `npm run lint`, `npm test`, `npx vite build`. Then `npm run shot -- "/<home route>"` and look at
the picture: the tabs, the colors in light and dark. Show it to the person, with the list of pages and their status.

## 7. Mirror the first screens

Ask which screen matters most (usually the home tab) and mirror it with `mirror-screen`. One screen at a time, each
shown before the next.
