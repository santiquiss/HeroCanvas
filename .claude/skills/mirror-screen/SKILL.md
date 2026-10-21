---
name: mirror-screen
description: Mirror one screen of the connected app in HeroCanvas (app/) from the app's code - its components with the code's names and props, its data as mock data, its texts in every language - and check it against the code. Use when the person asks to build, mirror, add or fix a screen or a component of their app.
---

# Mirror a screen

A screen in HeroCanvas is a **mirror**: the app's screen rebuilt in React, close enough to the code that a developer
reading Inspect sees their own components, props and tokens. It's what designs start from (proposals change it), so
it must be what the app is today, not what it should be.

## 1. Read the screen in the app's code

The screen's file and every component it builds, down to the app's design system. Note: the components and their
parameters, the tokens they use, the texts (their keys), the data they show and where it comes from, the states
(loading, empty, error, a long text), what each tap does. Read, never edit the app's code.

## 2. Components first

For each component the screen uses, reuse the mirror's if it exists (`app/components`). If not, write it there:

- **Its name and props are the code's** (`onPressed`, not `onClick`, if the code says so). A prop the code doesn't
  have (something only the simulator needs) is declared with `declareProps` (`src/design/simulatorProps.ts`):
  `simulator` (only here), `differs` (a design option the code lacks), `look` (it looks unlike the code).
- **Pure**: props in, callbacks out; no navigation or app state inside.
- **Instrumented**: `useComponent(name, props)` on its root (from `herocanvas`), so Inspect and Layers name it.
- **Styled with the app's tokens** (`var(--app-…)`), never raw values another component also uses.
- **A story** beside it (`<Name>.stories.tsx`, `src/design/stories.ts`): its states, for the gallery.
- **Every text** in an element of its own, in one of the app's type styles (`font: var(--app-font-…)`).

## 3. Data and texts

Mock data in one module under `app/data/`, derived from the persona (`?persona=`), never numbers written in the
screen that another screen also shows. Texts by their key in the app's translations (`app/i18n.ts`), in every
language the app has: convert its files as they are (`.strings`, `.xcstrings`, ARB, `strings.xml`) into one JSON per
language (`app/i18n.<lang>.json`), never retyped.

**What only the platform draws** (a MapKit map, a Swift Charts chart, a video, a web view) is drawn here as close as
the web allows: a chart's marks with SVG, a map as its colors and a pin. Say in the component's comment what it
stands for. A custom symbol (an SF Symbol of the app's own, a `.symbolset`) takes the closest Material Symbol.

## 4. The screen

In `app/screens/`, reading the layout from the simulator (`useSim().layout`, `usePadL`, `usePadR`), never a
device's name or size. A screen that changes by size class (SwiftUI's `horizontalSizeClass`: a List on iPhone, a
Table on iPad) reads `layout.horizontalSizeClass`; one by Android's window size classes, `layout.vw`. A bar fixed at the top
(a navigation bar, sticky while the page scrolls) spans the screen's whole width: take the side margins back with
negative margins and pad its content by them (the tour's `Screen`, `src/tour/TourKit.tsx`), or the page shows beside it
as it scrolls under. Sheets and dialogs through `useSim().openSheet` / `openDialog` / `useActionSheet` (they become
menus and dialogs on large screens by themselves). States the person can try go in the page's manifest entry as
`controls` (Scenarios). Then `status: 'done'` in `app/pages.tsx`.

## 5. Check it

`npm run shot -- "/<route>"`, on a phone and a tablet, light and dark: look at the pictures beside the app (a
screenshot of the real app if the person has one). `npm run typecheck`, `npm run lint`, `npm test`. Show the person
the pictures and what differs from the code, if anything.
