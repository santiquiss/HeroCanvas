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

Tell the person what you found in two or three lines (stack, how many screens, tabs, languages) before writing. A
platform HeroCanvas has no device for (the Mac, the Apple Watch, a TV, a desktop web layout) is left out: say so.
Widgets, Live Activities and App Intents aren't screens: leave them out too.

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

`appConfig`: the app's name, its languages (the base first, as its code lists them), its home page, and 2–3
**personas**: who uses the app in ways that change the screens (new with no data, an active one, a paying one…). Ask
the person who they are if the code doesn't say (a subscription tier, an empty state); an app with no accounts has
none (leave them out). A language written right to left (Arabic, Hebrew, Persian, Urdu) mirrors its screens on its
own: write the screens with logical sides (`margin-inline-start`, `text-align: start`, flex order), never left and
right, and flip only what points (a chevron, a back arrow) with `:dir(rtl)`.

**Images** the screens use: `npm run assets -- --from <its .xcassets | res/ | assets folder>` copies them into
`public/<app>/` (an asset catalog's 2×, Android's densest, folders kept) and lists an asset catalog's colors, light and
dark, to make tokens of (step 3); screens reach the images through `import.meta.env.BASE_URL`
(`${import.meta.env.BASE_URL}<app>/…`), never from `/`.

**Texts**: `npm run texts -- --from <its translations>` (`.strings`, `.xcstrings`, `strings.xml`, ARB, i18next JSON)
writes one `app/i18n.<lang>.json` per language, key → text; `app/i18n.ts` reads them in the screen's language.

**Icons**: an iOS or macOS app's SF Symbols, as the app has them: `npm run symbols` first (HeroCanvas's own: the
system keyboards' and the iOS kit's glyphs), then `npm run symbols -- <name>…` (every
`systemName:` / `systemImage:` the screens use; on a Mac) and its own symbols, `npm run symbols -- --from
<its .xcassets>`; then `<Icon name="sf:<name>" />`. Other apps: the closest Material Symbol by name.

Name the copy after the app: `package.json`'s `name` (`<app>-herocanvas`, e.g. `food-truck-herocanvas`).

### The devices (`appConfig.devices`)

Which devices the app is made for, so the designer offers only those (`DeviceTargets`: `platforms` iOS and/or Android,
`types` phone, foldable, tablet; left out, every device). Read it from the code: an Xcode project alone is iOS, its
`TARGETED_DEVICE_FAMILY` (1 iPhone, with the iPhone Duo, a foldable that runs iPhone apps; 2 iPad) the kinds; an Android project alone is Android (a `largeScreens` or
tablet-only `<supports-screens>` narrows it); React Native and Flutter by the platform folders they ship (`ios/`,
`android/`); a web app, every device. Say what you set, and leave it out when the code doesn't narrow it.

### Its own sheets and dialogs (`navigation.kit`)

When the app's library has its own bottom sheet, action sheet, drop-down, dialog, popover or snackbar, give them to
`navigation.kit` (app/index.ts), each with the kit's props (src/kit), adapting a prop where the library names it
otherwise: what the screens open then shows as the app draws it. Leave out what the app takes from the platform: the
kit draws it on the `--app-*` tokens.

### A side panel (`appConfig.sidePanel`)

An assistant or a chat that opens beside the screens rather than over them (a tablet's panel on the right, the tab
covered on a phone), kept as a state over the tabs (`?<param>=1`): declare its page (`{ page, param }`). The page reads
`useInPanel()` to draw itself as the panel (a close instead of back); the navigation opens it with `useSidePanel()`.

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
contract doesn't: add it as `--app-<name>` too; screens may read it. HeroCanvas applies the file to the screens itself:
don't import it.

**Themes of its own** (palettes its settings offer beyond light and dark): list them in `appConfig.themes` (the
default first; `scheme: 'dark'` for one made dark, as SwiftUI's `preferredColorScheme`), each one's tokens in a
`[data-app-theme='<id>']` block after the light and dark ones. The app's own picker reads and sets it with
`useAppTheme()`; the designer picks it in Scenarios › Theme.

**An appearance setting** (follow the system, or always light or dark; no palette of its own) isn't a theme: declare
it as `appConfig.appearance` with its three options as the app names them (`{ system: 'Automático', light: 'Claro',
dark: 'Oscuro' }`); the app's picker reads and sets it with `useAppearance()`.

An app on the platform's own look (SwiftUI's or UIKit's defaults, Material's) takes the platform's values:
`src/tour/theme.css` has iOS's system colors, text styles and grouped backgrounds to start from; change its accent
(the asset catalog's AccentColor) and what the app sets of its own.

## 4. Navigation (`app/nav/`)

The app's tab bar (phones), and rail and side column (large screens) if it has them, as `AppNavigation` components,
like the tour's (`src/tour/TourNav.tsx`, an example to start from). Same tabs, icons (Material Symbols names closest to the app's), labels and
look. If the app has no tabs, the components render nothing and every page is a push or a cover.

**A SwiftUI (or UIKit) app** builds its screens from the platform's views: take them from `herocanvas/ios`
(`NavigationStack`, `Section`, `NavigationLink`, `LabeledContent`, `Label`, `Picker`, `Menu`, `SearchField`, `TextField`,
`Toggle`, `Gauge`), named as SwiftUI names them; write only the app's own components.

**An adaptive app** (tabs on phones, a sidebar on tablets: SwiftUI's `TabView` with `.sidebarAdaptable`, or a
`horizontalSizeClass` switch between a `TabView` and a `NavigationSplitView`): its sections are tabs; the TabBar draws
them as a bar, the SideRail as the sidebar (its width as `appConfig.layout.railWidth`), grouped by `tab.section`. A
section only the sidebar lists (hidden when compact) is `tab.sidebarOnly`: a phone opens on the home tab instead.

**A sidebar app** (SwiftUI's `NavigationSplitView`, UIKit's `UISplitViewController`, Material's list-detail or a
navigation drawer that stays open on tablets) has no tabs: its sidebar is one root page (`level: 'tab'`, the app's
home) with a `split` (list–detail: `minWidth`, `ratio: 'detail'`, the sidebar's width as `masterWidth`, the section it
opens on as `defaultChild`), and each section a `push` over it. On a phone the sidebar is the screen and a section
slides over it; on a wide screen the sidebar stays and the section shows beside it, as the app does. The sidebar
reads `useSplit()` to highlight the section that's open. Such an app has no rail: `appConfig.layout = { railWidth: 0 }`,
so nothing is kept for one at the left of a tablet.

### What the app's own simulator layer needs

What an app does around its pages has a place, each declared, never a fork of the tool:

- **Back**: a screen that takes the system back (a step in a flow, an open panel) uses `useBackHandler(enabled, onBack)`
  (Android's `BackHandler`); with none, the device goes back a page.
- **Its own host and contexts**: `navigation.Screen` wraps each device's screen (the app's providers), and
  `navigation.Overlays` sits over its pages (its own sheets' host, a gate that asks to sign in); `useScreenInsets()`
  gives the system's insets and the keyboard.
- **Who the user is**: `appConfig.controls` (signed in, verified, a feature flag), each persona with its `values`;
  screens read them with `useAppControl(param)`.
- **Its bar and layout**: `appConfig.layout.tabBarHeight` (its bar's height), `keepTabs` (tabs keep their state),
  `compactOnly` (a phone-only app on tablets too), `tabTransition: 'fade'` (only if it fades its tabs).
- **Pages**: `transition: 'fade' | 'up'`, `keepNav` (a push under the bar), variants by state (`variants: () =>
  [{ label, state }]`).

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
Then version the copy: `package.json`'s `version` to `0.1.0` and its first entry in the root `CHANGELOG.md` (the
team's: what was connected, what's mirrored and what's a placeholder).

## 7. Mirror the first screens

Ask which screen matters most (usually the home tab) and mirror it with `mirror-screen`. One screen at a time, each
shown before the next.
