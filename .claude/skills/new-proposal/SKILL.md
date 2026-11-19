---
name: new-proposal
description: Design a change to the connected app as a HeroCanvas proposal (proposals/<slug>) - new or replaced pages and components, versions to compare, and the handoff spec for whoever builds it - without touching the mirror of the app as it is. Use when the person wants to explore, propose, redesign or add a feature, or asks for "a version" of a screen.
---

# A proposal

The mirror (`app/`) is the app **as it is**. A change to it is a **proposal**: its own folder that declares only
what it adds or changes, picked in the toolbar, shared by link (`?proposal=PJ-3`), compared side by side with the app
as it is (Compare), and handed off with a specification.

```
proposals/<yyyy-mm-slug>/
  proposal.json   code, title, status, author, created, summary, description, ticket
  pages.tsx       export default proposal({ pages, components, variants })   (optional)
  components/     new or replaced components, with their stories              (optional)
  handoff.md      what changes, in the app's terms, for whoever builds it
  spec.json       the screens and states its spec shows, once it's ready      (section 5)
```

## 1. Ask where it goes

A change to what's on screen is a proposal **unless** the app changed (or the mirror got it wrong): then it's a fix to
the mirror (`mirror-screen`). Ask if it isn't clear.

## 2. Create it

- **The code**: `npm run proposal:code` prints the next one (`PJ-1`: P, the author's initials, their number). It never
  changes and is never reused.
- `proposal.json`: the code, a title, `status: 'draft'`, the author, today's date, a one-sentence summary.
- **Pages**: a new page, or a base page replaced by id (spread it to change only some fields:
  `{ ...BASE_PAGES.today, component: TodayV2 }`). **Components**: replace one the screens render with `overridable`
  (from `herocanvas`), or add new ones in `components/`. **Versions** (`variants`: A, B…) to compare
  designs of the same change.
- **Where it shows** (`show`): a changed component that isn't on its page as it loads (it shows for a new user,
  after a tap, in a state) declares where to see it: `show: { Card: { page: 'dashboard', state: { persona: 'emily' },
  label: 'as Emily, who signed up today' } }` (a version may have its own). The changes popover opens it there, outlined,
  and Pages marks that page changed. The same by a page's id when a page it changes shows its change only in a state
  (a closing screen after a tap): `show: { checkIn: { page: 'checkIn', state: { ck: 'updated' }, label: 'Get reminded' } }`.
  A replacement marks its root with the component's name (`useComponent` or
  `<Component name>`), so Inspect and the outline find it.
- Never copy the mirror: import from `app/` what doesn't change (relative imports), and from the tool only `herocanvas`.

## 3. The handoff

`handoff.md`: what changes in each component and screen, **in the app's terms** (its components, their parameters,
its tokens, its routes), the logic, the data it needs, the texts in every language, and what stays as it is. A part
for one version under `### Version A`. Keep it current with every change: the proposal's spec carries it as its logic.

## 4. Show it

`npm run shot -- "/<route>?proposal=<code>" --compare`: the app as it is beside the proposal. Phones and tablets,
light and dark. Show the person, iterate, and move the status on when they say so: `draft`, `review` (someone has to
look at it), `handed-off` (shown as Dev handoff: its ticket for the developers, `ticket`). Dropped: `"archived": true`.
Built in the app: merged into Live and its folder deleted.

## 5. Its spec, when it's ready

Not while it's being designed: once the person says it's ready to share (in review) or to build (dev handoff), its
spec, with the `proposal-spec` skill: `spec.json` (every screen and state it adds or changes), `npm run spec -- <code>`,
read as its reader would, and its two links (a person's, an agent's) wherever the proposal goes. What the developers
and their agents build from; generated again after every change while it's in review or handed off.
