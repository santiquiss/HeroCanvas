---
name: new-persona
description: Create one or several personas for the connected app - read the app to find what about a user changes its screens (account state, plan, role, how much data, language), ask the person the questions that define each profile, then save each persona with its own mock data and optional photo, and check the screens as them. Use when the person asks for a persona, a user profile, a test user, "someone who…", or more kinds of users to try the app as.
---

# New personas

A **persona** is someone the app is tried as: picked in the Scenarios panel (`?persona=<id>`), every screen shows
their data. HeroCanvas only carries the pick; the app declares them (`appConfig.personas`: `id`, `name`, a one-line
`description`, an optional `avatar`) and its mock data module gives each one their data. One module holds it all:
`PERSONAS` and the data per persona id (the `sample-tasks` tag has an example, its `app/data/sample.ts`).

A persona is **who** someone is, lasting: a new user with nothing yet, a paying admin with a lot. What any user can
run into for a moment (loading, an error, offline, a sheet open) is not a persona: it's a page's state or a scenario
control in the manifest.

## 1. Read the app: what about a user changes the screens

In the person's app's code (read, never edited) and in the mirror (`app/`), find what differs from one user to
another and shows on screen:

- **Account state**: just signed up (empty states, onboarding not finished), active, lapsed, a trial ending.
- **Plan and entitlements**: free or paid tiers, feature flags, limits ("3 of 5 projects").
- **Role and permissions**: owner, member, viewer, admin: what they can see or do.
- **Their data**: how much (none, one, a lot), what kind, its extremes (a very long name, an overdue item, a big
  number), what's connected (integrations, a team, a device).
- **Where they are**: language, region, currency, units, time zone, when the app varies by them.

Tell the person what you found in a few lines: the dimensions, the values the code allows, the personas that exist
and what none of them covers yet (no paying user, no one with a lot of data). Don't ask what the code answers.

## 2. Ask

**Several personas**: first propose a set that covers the dimensions that matter, as a short table (name, who they
are, the values that set them apart), and confirm it. Then ask only what's left open for each.

**One persona**: ask what defines it. In Claude Code, with the question tool, up to four questions a round, options
taken from the app's own values (its plans, roles, states), your recommendation first; other agents ask in plain
text. Typically:

- **Who**: what they use the app for, in a sentence; their name (offer one).
- **Account and plan**: state, tier, role, from what the app has.
- **Their data**: how much and what's notable about it, concretely ("two projects, one with an overdue task").
- **Language or region**, only if the app varies by them.
- **Photo**: none (their initials), an image they give, or one they generate (step 3).

Names are invented: plausible where the app is used, varied, never a real person's, no stereotypes tied to the
profile.

## 3. The photo

- **None** (the default): the app's avatar shows their initials. Nothing to do.
- **An image the person gives** (a path, or one dropped in the chat): `npm run persona:avatar -- <image> <id>` crops
  its centered square, scales it to 256 px and writes `public/personas/<id>.png`; put the printed path in the
  persona's `avatar`. PNG, or anything macOS's `sips` converts (JPEG, HEIC).
- **One they generate** (an illustrated avatar, from an image tool of their choice): the same command, once they
  pass the file.

Never download a photo from the web on your own, and never use a real person's photo without their say: suggest
initials or a generated one instead.

## 4. Save

- **The persona**: in the app's personas list (the one `appConfig.personas` reads), with a kebab-case `id`, its
  `name`, a `description` of one line for the Scenarios panel ("Admin on the paid plan, a busy team"), and `avatar` if
  there's a photo. The list's first persona is the default: add new ones after it unless the person says otherwise.
- **Their data**: in the mirror's one mock data module, keyed by the persona's id, in the same shapes the screens
  already read. Derived, not duplicated: counts, totals and "3 overdue" come from the data, so every screen agrees.
  Reuse shared data (catalogs, products) instead of copying it.
- **Their texts**: data the app localizes follows its languages; names and user content stay as the user wrote them.
- Nothing in the tool (`src/`) changes: a persona is the app's.

## 5. Check and show

- `npm run typecheck`, `npm run lint`, `npm test`.
- Look at the screens the persona changes, as them: `npm run shot -- "/<page>?persona=<id>"`, phone and tablet, light and dark. Empty states for a new user, long names that wrap or
  cut, a paid feature shown or locked, a role's missing actions.
- Show the person, short: each persona, who they are, what they change on screen, the link to try them.
- Add an entry to the root `CHANGELOG.md` (and bump `package.json`'s version): it's a change to the team's mirror.
