# HeroCanvas changelog

HeroCanvas's own versions (`src/version.json`, in the toolbar's ⓘ); each release is tagged `vX.Y.Z`, which is what
`npm run update` installs. A team's own changes go in the root `CHANGELOG.md`, not here.

While in 0.x: the minor number (0.**Y**.0) goes up for new features or architecture changes; the patch number
(0.Y.**Z**) for fixes, polish and small additions.

## 0.40.3 — 2026-10-22

- A carousel dragged with the touch pointer rests on the card it's heading to (its own snap position, one card per
  flick), not on a screen-wide page that can stop between two cards.
- An element that took a press itself (a long press that became a drag) marks itself `[data-held]`: the touch pointer
  leaves the drag to it.
- Capture: a bar's blur (`backdrop-filter`) on a turned device blurs what's under it, instead of cutting it with a
  hard edge.

**Contract**

- None.

## 0.40.2 — 2026-10-22

- A button drawn inline in a sentence (a link that acts: "Read the [terms]") is one of its text's runs, not loose
  text beside it.

**Contract**

- None.

## 0.40.1 — 2026-10-22

From moving Andaremos Designer onto HeroCanvas:

- **A variant by state replaces the page's state**: opening one clears the page's other state (a search's text
  gone when its "Auctions" variant opens), and it's the one shown only while the URL holds exactly its state; its
  thumbnail in Flow shows only that state.
- **The app's fonts** (`appConfig.fonts`): stylesheets with its typeface (a Google Fonts `css2` URL), loaded with the
  designer.
- The tool's own tests run in English whatever the copy's language, and the brand's test reads the tour's icon, not
  the team's logo: a copy in Spanish, or with its own logo, passes them.
- An empty inline run (a `<b>` around an empty value) isn't loose text beside a text.
- `npm test` runs a team's own script tests too (`app/**/*.test.mjs`: a connector's).

**Contract**

- `AppConfig.fonts` (new): nothing to adapt.

## 0.40.0 — 2026-10-22

What an app does around its pages, declared instead of forked (from moving Andaremos Designer, a Compose app's
mirror, onto HeroCanvas):

- **Tabs switch at once**, as on iOS and Android, with no animation; `appConfig.layout.tabTransition: 'fade'` keeps
  the old fade for an app that animates its tabs.
- **The system back**: `useBackHandler(enabled, onBack)`, as Android's `BackHandler`: the screen takes the back
  while it's enabled; with none, the device puts the keyboard away, then closes a dialog or a sheet, then goes back a
  page. Sent with Alt+←, Esc while typing in a screen, or the back button in an Android device's header.
- **Variants by state**: a page's variant can set state params (`variants: () => [{ label, state }]`): its error, its
  empty case, a step. The Pages panel opens it, Flow and the page scan show it, the smoke test renders it.
- **Transitions**: a page fades in place (`transition: 'fade'`) or rises from the bottom (`'up'`); a push can keep
  the app's bar over it (`keepNav`), and `usePadB()` gives its content the room.
- **The app's controls**: `appConfig.controls`, conditions for every page (signed in, verified, a feature flag),
  each persona with its `values`; Scenarios › App changes them for a moment, marked, and a link keeps them; picking a
  persona brings its values back. Screens read them with `useAppControl(param)`.
- **The app's own layer**: `navigation.Screen` wraps each device's screen (the app's providers), `navigation.Overlays`
  sits over its pages; `useScreenInsets()` gives the system's insets and the keyboard.
- **Layout**: `compactOnly` (a phone-only app draws its phone layout on tablets and open foldables),
  `tabBarHeight` (the app's bar), `keepTabs` (tabs keep their pages and state when another is picked; the one on
  screen goes back to its root).
- Public: `useUrlParams`, `useUrlPatch`, `useKeyboardInset`, `usePersona`, `useScreenInsets`, `usePadB`, and the
  types `PageVariant`, `PageControl`, `Params`, `StateParams`, `AppControl`.
- The device in hand (real mode) takes the app's layout and the proposal's, as the canvas does.

**Contract**

- A page variant's `params` is optional now (`{ label, params?, state? }`): code reading `variant.params` takes
  `variant.params ?? {}`.
- Tabs no longer fade in: an app whose design fades them sets `appConfig.layout.tabTransition: 'fade'`.
- Everything else is new and optional: nothing to adapt.

## 0.39.0 — 2026-10-22

- **HeroCanvas in Spanish**: its whole interface (the panels, the toolbar and menus, Capture, Flow, the gallery and
  Tokens, comments, proposals) in neutral Latin American Spanish, picked per copy in `herocanvas.config.ts`
  (`language: 'es'`). English stays the default. The app's screens keep their own languages, and what's written for
  developers and agents (handoffs, prompts, exported files) stays English.
- How it's built: `t('English text')` from `src/i18n/ui.ts`, a catalog per area (`src/i18n/es/*.json`) and a glossary
  (`src/i18n/GLOSSARY.md`); a test fails on a text with no translation, an unused one, or one translated two ways.
- Capture's light section reads "Lighting"; Tokens' type group reads "Typography".
- A resolved comment with no name is stored as such and shown in the interface's language.

**Contract**

- `HeroCanvasConfig.language` (new, `herocanvas.config.ts`): nothing to adapt. To have your copy in Spanish, set
  `language: 'es'` and restart `npm run dev`.

## 0.38.2 — 2026-10-22

- Agustina Salas, by her full name, as a creator: NOTICE, the About page and the README.

**Contract**

- None.

## 0.38.1 — 2026-10-22

- `npm test` no longer keeps Vitest's module cache between runs: it kept the old list of proposals, stories and pages,
  so a team's first proposal failed as having no handoff until the cache was cleared.

**Contract**

- None.

## 0.38.0 — 2026-10-22

Tokens and themes beyond light and dark:

- **The theme picker lists every theme**: with the app's own themes (`appConfig.themes`), the canvas's Light / Dark
  becomes a dropdown of them, each with its page color and accent; one that follows the device is there twice
  (Light and Dark). An app with no themes keeps Light / Dark.
- **Tokens has a column per theme**: Light and Dark, or each of the app's (Classic, Graphite, Stone…), its values
  read from `[data-app-theme='<id>']` over its scheme's. A color's swatch sits beside its value in each column.
- Tokens inside a value (a shadow in the theme's shadow color) are resolved per theme, so Elevation shows each one.

**Contract**

- None. (Inside the tool: a token's `value` and `alias` are keyed by theme mode, `THEME_MODES`; `base` is the first's.)

## 0.37.1 — 2026-10-22

- **The keyboards' glyphs as Apple draws them**: on iPhone and iPad, shift, delete, return, emoji, globe, dictation,
  hide and the shortcuts are SF Symbols at the letters' weight when the team made HeroCanvas's own; without them,
  Material's at a lighter weight (its font now loads 100–700), so none stands out bolder than the letters. Android
  keeps Gboard's.
- `npm run symbols` with no names makes HeroCanvas's own symbols (`scripts/symbols/system.json`: the keyboards' and
  the iOS kit's); with names, those too the first time.
- The iOS kit's search field asks for the keyboard's blue Search key.

**Contract**

- None.

## 0.37.0 — 2026-10-22

The iOS kit, from mirroring Studio (AdaptiveAppShell's demo):

- **`Menu`**, in `herocanvas/ios`: a button whose items pop up from it, on an iPhone as on an iPad, as SwiftUI's
  `Menu` does (a Picker in it: its items with `isSelected`).
- A sheet of the new kind `menu` hangs from its control on every screen, phones too; the other kinds float only on
  large screens, as before.
- `SearchField` (and `NavigationStack`'s `searchable`) as iOS 26 draws it: a 44-point capsule, its clear button with
  text, and `scopes` (`.searchScopes`) as a segmented Picker under it while it's active.
- A Form's `TextField`s are divided like its other rows.

**Contract**

- `Menu`, `SearchFieldProps` and the `menu` sheet kind (new): nothing to adapt. `SearchField` is taller (iOS 26's):
  a screen that sized around the old one may want a look.

## 0.36.0 — 2026-10-22

From connecting AdaptiveAppShell (a SwiftUI shell: tabs on iPhone, a sidebar on iPad, three themes of its own):

- **An app's own themes** (`appConfig.themes`): palettes beyond light and dark, as an app whose settings offer
  several. Picked in Scenarios › Theme (`?apptheme=`) or by the app's own settings (`useAppTheme()`); their tokens in
  `app/theme.css` under `[data-app-theme='<id>']`. One made for light or dark (`scheme`, SwiftUI's
  `preferredColorScheme`) sets the screens' scheme and holds the Light / Dark switch on it; a screenshot shows it in
  that scheme alone.
- **Tabs only in the sidebar** (`tab.sidebarOnly`), and the sidebar's sections (`tab.section`): an adaptive app's
  sections that its iPad sidebar lists and its iPhone tab bar doesn't. A screen without the rail (a phone) opens on
  the home tab instead, as the app does when it turns compact.
- `connect-app`: an adaptive app (tabs on phones, a sidebar on tablets) and an app's own themes.

**Contract**

- `AppConfig.themes`, `AppTheme`, `useAppTheme`, `tab.section` and `tab.sidebarOnly` (new): nothing to adapt.

## 0.35.0 — 2026-10-21

- **An iOS kit**, `herocanvas/ios`: SwiftUI's own views as iOS draws them, for mirroring a SwiftUI or UIKit app
  without rebuilding the platform: `NavigationStack` (a screen: its large title collapsing into a glass bar, back,
  toolbar, `searchable`), `Section` (inset grouped), `NavigationLink`, `LabeledContent`, `Label`, `Picker` (segmented
  and menu), `SearchField`, `TextField`, `Toggle`, `Gauge`. Named as SwiftUI names them (Inspect and Layers say so),
  on the app's tokens, right to left as the screen is, their glyphs SF Symbols when the team made them.
- `hasSymbol(name)`, from `herocanvas`: whether an SF Symbol was made.
- `connect-app`, `mirror-screen` and AGENTS.md: a SwiftUI app's mirror uses the kit; only its own components are
  written.

**Contract**

- `herocanvas/ios` (new entry) and `hasSymbol`: nothing to adapt.

## 0.34.1 — 2026-10-21

- The new commands pass the linter.

## 0.34.0 — 2026-10-21

What connecting Food Truck took by hand, now in the tool:

- **`npm run assets -- --from <path>`**: an app's images into `public/<app>/`: an asset catalog's (`.xcassets`, the 2×
  of each, folders kept), Android's `res/` (the densest of each; vector drawables listed) or any folder's; and an asset
  catalog's colors, light and dark, listed to make tokens of.
- **`npm run texts -- --from <path>`**: an app's translations into `app/i18n.<lang>.json`, from `.strings` (UTF-8 or
  UTF-16), String Catalogs (`.xcstrings`), Android's `strings.xml`, ARB or i18next JSON, merged by key.
- **`npm run shot` finds this project's dev server** on its own, on whatever port it took (Vite moves on when 5173 is
  taken, often by another project): no more `--base`. The dev server says which project it serves (`/__hc/status`).
- `connect-app` and `mirror-screen` use the new commands.

## 0.33.0 — 2026-10-21

- **SF Symbols on the screens**: `<Icon name="sf:box.truck" />`, beside Material Symbols. `npm run symbols -- <name>…`
  renders the app's SF Symbols with the Mac's own copy (any weight: `trophy:semibold`), crisp masks in the text's
  color; `npm run symbols -- --from <Assets.xcassets>` turns the app's own symbols (`.symbolset`) into vectors. They go
  in `public/symbols/` and `app/symbols.json`, the team's. `fill` picks a symbol's `.fill` variant and `weight` its
  weight, when made. HeroCanvas ships none: Apple's license lets them be used to design apps for its platforms.
- `connect-app` and `mirror-screen` use the app's own icons: SF Symbols for an Apple app, Material otherwise.

**Contract**

- `Icon` takes `sf:<name>`; `app/symbols.json` and `public/symbols/` are new, the team's. Nothing to adapt.

## 0.32.3 — 2026-10-21

- `mirror-screen`, from mirroring all of Food Truck: translations converted from the app's files into one JSON per
  language, never retyped; what only the platform draws (maps, charts, video) drawn as close as the web allows and
  said so; an app's custom symbols as the closest Material Symbol.

## 0.32.2 — 2026-10-21

- `mirror-screen`: a bar fixed at the top spans the screen's whole width (its side margins taken back), or the page
  shows beside it as it scrolls under.

## 0.32.1 — 2026-10-21

- **A sidebar app upright on a tablet**: when its list and detail show one at a time (an iPad upright), a section
  slides over the sidebar across the whole screen, as SwiftUI does, instead of opening in the tablet's side panel.
- `connect-app`: an iPhone app runs on the iPhone Duo too: an iOS app's targets keep it.

## 0.32.0 — 2026-10-21

- **Page describes the layout, it doesn't edit it**: how a page's list and detail show on this display (side by side,
  or one at a time and from what width), the iPhone Duo's right column, the tablet's side panel and the size class
  are read-only lines of Layout, in words for any layout. The controls that overrode them by hand (and saved them to
  `screen-config.json`) are gone: they're set in code. "Stack" is "Open pages".
- **An app with no rail keeps no room for one**: `appConfig.layout.railWidth: 0` (a sidebar app), said in the
  contract and in `connect-app`. Page's Navigation says when the app draws its own.

**Contract**

- `ScreenLayout.railWidth: 0` means no rail: set it if your app has none on tablets.

## 0.31.0 — 2026-10-21

- **The layout has iOS's size class**: `layout.horizontalSizeClass` (`compact` or `regular`), for a screen that lays
  out by it (SwiftUI's `horizontalSizeClass`: a List on iPhone, a Table on iPad). Regular on tablets and on a big phone
  turned (900 wide or more), as iOS has it. `mirror-screen` says so.
- **Page's list–detail reads a root's split right**: it measured a sidebar app's root by the side panel's width and
  said it stacked while it showed side by side.

**Contract**

- `Layout.horizontalSizeClass` (from `useSim().layout`): new, nothing to adapt.

## 0.30.0 — 2026-10-21

From connecting a real app for the first time (Apple's Food Truck, SwiftUI):

- **The app's theme applies itself**: `app/theme.css` was only read as text (Tokens, Inspect) and the screens showed
  the kit's defaults unless the app imported it. Now HeroCanvas applies it, as it does the tour's.
- **A root page can be a list–detail**: a sidebar app (SwiftUI's `NavigationSplitView`, a split view, Material's
  list-detail) is a root page with a `split`, its sections pushed over it. On a wide screen the sidebar stays and the
  section shows beside it; the tablet's side panel doesn't open over it. Until now only pushed pages could split.
- **Right-to-left languages mirror the screens** (Arabic, Hebrew, Persian, Urdu…): the screen takes `dir="rtl"`, so
  rows, bars and the status bar flip, as iOS and Android do.
- **The tool's tests don't depend on the app**: they look devices up among all of them (`findAnyDevice`), whatever
  the app targets, and accept `/` as a page's path.
- `connect-app` knows more: sidebar apps, an iOS app's theme from the platform's values, images from an asset
  catalog, right-to-left texts, platforms HeroCanvas has no device for, naming the copy after the app.

**Contract**

- `app/theme.css` needs no import: if the app imports it, the import can go (keeping it does no harm).
- A root page may have `split`: nothing to adapt.

## 0.29.3 — 2026-10-21

- **About credits the MacrosFirst team**: made by Santiago Quiss and Agus Salas, in collaboration with the
  [MacrosFirst](https://macrosfirst.com) team, as the README says.

## 0.29.2 — 2026-10-21

- **The built site works under a path** (GitHub Pages' `user.github.io/repo`), not only at a domain's root: the build
  is relative (`base: './'`) and the tool's own images (the rail's logo, About's icon, the tour's icon and emblem, the
  favicon) are reached through `import.meta.env.BASE_URL`. The README's Deploy has GitHub Pages' workflow.

## 0.29.1 — 2026-10-21

- **"Superpowers for Designers"**, HeroCanvas's tagline, under its name on the About page and at the top of the README.

## 0.29.0 — 2026-10-21

- **The tour says how you work with HeroCanvas**: AI first, every change asked of the agent, not drawn by hand as in
  Figma, with words, screenshots, references or Figma links. Welcome has a card for it, second ("You ask, your agent
  builds.", with its illustration: a request with a screenshot and a Figma link becoming a change), and the Tour
  opens with a step of its own, "Working with your agent", with what to try.
- `Illustration` takes `agent`; the deck's cards take a green tint (dark text).

## 0.28.0 — 2026-10-21

- **Apache License 2.0**, instead of PolyForm Shield: open source, free to use, change and share, commercial uses
  included. A `NOTICE` file names its creators, Santiago Quiss and Agus Salas, and any copy or project built from it
  keeps it (the license's section 4(d)); nothing has to show in an app's interface. The README, the About page and
  `package.json` say so; updates bring `NOTICE` too.

## 0.27.0 — 2026-10-21

- **Inspect speaks no one framework**: sizes are Fill, Hug or Fixed and how (the room left in its parent, stretched
  by it, pinned to two sides, its content), alignment is Along / Across (Start, Center, Space between…), a pinned box
  says its sides, a text's overflow its lines and "…", a color at an opacity is its token at that share. It used to
  say them in Flutter's names (Expanded, CrossAxisAlignment.stretch, MainAxisSize, Positioned, TextStyle,
  .withValues(alpha:)) for any app.
- **Inspect's Code**: with a code connector, the call as the app's code writes it; without one, the component as the
  mirror writes it, in JSX, and it says which.
- **Spacing and radius by the app's own tokens** (`--app-space-*`, `--app-radius-*`) in Inspect and handoffs, instead
  of a fixed scale (Spacing/2x, Corner radius/L) from another project: a value none of them has is flagged.
- `CONTRIBUTING.md`, issue and pull request templates; the repository has a description and topics.

## 0.26.3 — 2026-10-21

- **Every test runs**: the four that needed the old sample app (Tasks) now run on whichever pages are loaded (the
  tour's, or the connected app's); 211 pass, none skipped.
- **Dependencies up to date** within their ranges (React 19.3.1, React Router 8.5, Vite 8.3.5, Vitest 5.0.5, oxlint),
  and happy-dom 21 (tests only), which closes a critical advisory.
- The docs no longer mention the project HeroCanvas came from.

## 0.26.2 — 2026-10-21

- **Inspect names Figma and the code only when they're connected**: a token without a code name no longer says
  "Only in Figma" (now "Not in the code", and only with a code connector), and a style's Figma name shows only with
  a Figma file connected.
- **Inspect selects any element by default**: All first and on, Components second.

## 0.26.1 — 2026-10-21

- **Layers speaks the components' states**: its legend and icons were still Library / In app / Local in their old
  colors; now they're the gallery's: Matches code, Differs from code, Local (and In the app when the app has widgets
  of its own), each component's color and word from the same state. With no app connected, only Local.
- **Inspect's tier only when given**: the component's tier (atom, molecule…) shows when the code or Figma names one,
  never guessed, and no longer in the old colors; its state against the code is the colored badge.

## 0.26.0 — 2026-10-21

- **An app says which devices it's for**: `appConfig.devices` (`DeviceTargets`: `platforms` iOS and/or Android,
  `types` phone, foldable, tablet), and the designer offers only those, in the device menus, a set's +, Compare's
  presets (none left empty or repeating All devices) and Capture. Left out: every device, as before. The canvas opens
  on the iPhone 17 Pro, or the first target when it isn't one. A real phone is still matched against every device.
- `connect-app` reads the targets from the app's code (an Xcode or Android project alone, its device family, the
  platform folders it ships); `app/config.ts` shows examples.

**Contract**

- `appConfig.devices` (optional) and the `DeviceTargets` type, exported from `herocanvas`. Nothing to adapt: without
  it, every device stays. To narrow them, add it to `app/config.ts`, e.g. `devices: { platforms: ['ios'] }`.

## 0.25.4 — 2026-10-21

- **A phone for every page** in the lists of pages (Pages, Flow, the changes menu), instead of an icon per role (a
  tab, a document…) that didn't read: the role stays in its tooltip, badge and indent.

## 0.25.3 — 2026-10-21

- **Swiping on past Welcome's last card opens the Tour**, as Take the Tour does; so does Next there, instead of
  being off. `CardDeck` takes `onFinish`.

## 0.25.2 — 2026-10-21

- **Text size says whose sizes they are**: the slider is the device's system's, and now shows it: under it, iOS's
  seven Standard sizes and its five Accessibility ones (Larger Text, AX1–AX5) as named ranges, the current one
  stronger; on Android, its one font size range, 85% to 200%; and a line saying so.

## 0.25.1 — 2026-10-21

- **No personas: the picker all the same**: Scenarios › Persona shows "Anonymous user" in its usual dropdown, and
  opening it lists them over the empty state (what personas are, what to ask the agent). Capture lists personas only
  when the app has some.

## 0.25.0 — 2026-10-21

- **Scenarios › Persona is always there**: with no personas, it shows the one user every app has ("User", anyone with
  the app's sample data) and what personas are, with what to ask the agent to make some.
- **One language, no language picker**: a device's header drops its language when the app has only one, and
  Scenarios › Language shows it with how to add more (ask the agent for the app's languages).

## 0.24.1 — 2026-10-21

- **The comment cursor on every device**: with several devices on the canvas, their touch pointers stayed on in
  comment mode and hid it; now they step aside, as the single device's already did.

## 0.24.0 — 2026-10-21

- **Comments without a shared store say so kindly**: a quiet note instead of a yellow warning, with the two ways to
  share them: Supabase, ready to go (`supabase.sql`, `supabase.json`), or a database the team already has (an
  adapter in `src/comments/backend.ts`), either set up by the agent.
- **No tags on comments for now**: Design, Handoff, Copy… are gone from the composer, the threads and the panel's
  filters. Comments are still stored with one (design), so a connected table needs nothing.
- **Comment opens the Comments tab**: the toolbar's Comment (or C) shows the right panel on Comments.

## 0.23.6 — 2026-10-21

- **The launch plays only where the app starts**: opening (or reloading) on any other page, a tour step, another
  tab, goes straight to it, as an app restored there would. Replay (Pages, Scenarios) still plays it anywhere.

## 0.23.5 — 2026-10-21

- **The ring of the + beside the devices a touch softer** (20% of the icon's color, from 30%).

## 0.23.4 — 2026-10-21

- **The + beside the devices a little less faint**: a ring of the icon's color, mostly see-through, and the button
  nearer to full at rest.

## 0.23.3 — 2026-10-21

- **The room between devices follows how many there are**: 56 for two, 40 for three, 24 for four or more, so a few
  breathe and many still show large.
- **Subtler + buttons**: at rest only their + in a faint ring, solid with a shadow when pointed at; the one between
  two devices is smaller, so it never sits over them.

## 0.23.2 — 2026-10-21

- **The tour's beacons in the emblem's red**: its yellow didn't show on the light interface.

## 0.23.1 — 2026-10-21

- **The tour's beacons in the emblem's yellow** instead of the interface's blue, their ring a little stronger at
  its faintest so it shows on white.

## 0.23.0 — 2026-10-21

- **The tour points at what it talks about**: while a step is open on the device, each part of the interface it
  names pulses (a dot at its corner rippling out, a ring around it in its shape): Inspect and Layers, the device
  menu, rotate and +, Light / Dark and the interface's moon, Pages and Flow, Scenarios, the Live menu and Comment,
  Capture. A part stops once clicked; opening the step again brings it back.
- Steps declare their `spots`; the designer's controls carry `data-tour` (AGENTS.md: a new part's step names its own).

## 0.22.1 — 2026-10-21

- **The bar's glass, as iOS draws it**: an even, lighter blur that ends straight, with a very faint line under it,
  instead of fading out downward.

## 0.22.0 — 2026-10-21

- **The tour's titles behave as iOS's**: a tab opens with an empty bar over its large title (34, at the content's
  left); scrolled, the content goes under the bar, which blurs it, and once the large title is under it, its title shows in the bar, small and centered. The
  bar stays at the top; pushed pages get the same glass. Replaces 0.20.0's centered, smaller titles.
- `NavigationBar` takes no back button (a tab's bar) and `titleShown`; `LargeTitle` no longer takes `top`.

## 0.21.1 — 2026-10-21

- **Welcome's Capture card in purple**, titled "Screens ready to share." with a clearer line, instead of teal and
  "Show it off.". The deck's cards take a purple tint instead of teal.

## 0.21.0 — 2026-10-21

- **A Capture card on Welcome**: "Show it off.", before the tour's card, with its illustration (a phone turned in 3D
  in a camera's frame, Image or Video, recording, the device's colors). `Illustration` takes `capture`; the deck's
  cards take a teal tint.
- **Larger illustrations on tablets**: they grow with their card up to 1.6× (1.25× before).

## 0.20.1 — 2026-10-21

- **Welcome on tablets**: its deck takes more of the screen (up to 580 wide and 790 tall, from an iPad mini up), and
  "Welcome to HeroCanvas" is centered on every device.

## 0.20.0 — 2026-10-21

- **The tour's tab pages**: their titles centered and a size smaller (Title, 28); on tablets the content as wide as
  about 70% of the screen (a phone keeps its whole width).
- **The tour's rail shows its labels** on tablets: each tab its icon and its name beside it, as an iPad's sidebar
  (the rail 200 wide).

**Contract**

- `appConfig.layout` (optional, `ScreenLayout`, exported from `herocanvas`): the room the app's screens give its
  navigation, its rail's width and the like, which until now only a proposal could set. A proposal's layout now
  applies over the app's. Nothing to adapt: without it, the defaults stay.

## 0.19.1 — 2026-10-21

- **The launch's color leaves with it**: the screen takes the launch's background only while its screen shows, and
  the page's again as the exit starts, declared rather than set and restored by hand. The areas beside a tablet's
  rail or the iPhone Duo's column no longer stay the launch's blue.
- **Welcome's shadows reach under the column**: a plain screen (the tour's Welcome) doesn't clip, so its cards'
  shadows go on under the iPhone Duo's column and a tablet's rail, which have no background of their own.

## 0.19.0 — 2026-10-21

- **A device's header fits its device**: when its controls don't fit above a device (a set zoomed out), the ones
  that don't go into a ⋯ menu, the least used first (language, version, video layout, rotate, displays); the name
  keeps what room it can, and remove stays out, last of all.
- **Devices closer together**: a set's devices sit 20 apart instead of 48, and the + at its ends (and beside a
  single device) closer to them, so Fit shows them larger.

## 0.18.2 — 2026-10-21

- **Welcome's last card draws the tour**: its seven stops, in their own icons and colors, orbiting slowly around a
  phone with HeroCanvas's icon, instead of the emblem. `Illustration` takes `tour`.

## 0.18.1 — 2026-10-21

- **Welcome's deck swipes as it should**: a short flick moves on (it's the speed that counts, or a drag past 15% of
  the card, measured in the device's own size), and a drag always ends when the button is let go, even outside the
  deck, instead of the card staying stuck to the pointer. No text selection or image drag while dragging.

## 0.18.0 — 2026-10-21

- **Welcome as a deck of cards**: the icon beside "Welcome to HeroCanvas", over a stack of cards in color to swipe
  (or drag, or step with the buttons under it), as Wallet holds them. Each card has its own illustration (code
  becoming a screen, the devices and themes, versions to compare, a handoff spec) whose pieces pop in when it comes
  to the top; the last one is "Start with the Tour". Replaces 0.17.0's pages.
- **In the tour's kit**: `CardDeck`, `DeckCard` and `Illustration`, with stories; a yellow tint (`--app-yellow` in
  the tour's theme). Gone: `Pager`, `PageControl` and `Hero`, which nothing uses now.

## 0.17.0 — 2026-10-21

- **Welcome in pages**: "Welcome to HeroCanvas" under the icon, then pages to swipe (what it is, the goal, how it
  works) with a page control, the last one "Start with the Tour". No long scroll; on a short phone the hero drops its
  line so the tallest page fits.
- **Pager and PageControl** in the tour's kit, with stories: pages swiped one at a time (a mouse drags them too), a
  dot per page. `Screen` takes `plain` for a screen laid out in its own height, without a large title.

## 0.16.2 — 2026-10-21

- **Welcome's icon shines when tapped** instead of spinning: a band of light across it, in its shape. It still floats
  and tilts after the pointer.

## 0.16.1 — 2026-10-21

- **The launch settles instead of snapping**: flying to a component, the icon lands a little bigger and both shrink
  into place together while one crossfades into the other (the icon fading out faster than the component fades in).
  Two images that don't match to the pixel read as one thing changing, not a jump.

## 0.16.0 — 2026-10-21

- **The tour's launch with its emblem**: the emblem alone on the blue (`brand/hc-emblem.png`), flying onto the emblem
  inside Welcome's app icon (`brand/hc-icon.png`, its rounded tile and depth) and crossfading into it as it lands,
  aligned to the pixel: no jump. The icon starts floating only once the launch is over.
- **The launch's exit lands exactly**: on the component's `data-launch-anchor` when it has one, without overshoot,
  crossfading into it.
- **Contract** (additions, nothing to adapt): `LaunchConfig.iconShape` (`none`: an image with its own shape, the
  sheen following it), and `data-launch-anchor` for where an exit lands inside a component.

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
