---
name: proposal-spec
description: Write, generate, check and share a proposal's spec — the proposal as files anyone opens from a link without the designer (each screen and state in pictures, its structure with components, props, spacing and tokens, and the handoff's logic), what the developers and their agents build from. List its screens and states in spec.json, run npm run spec, read it as its reader would, and give its two links (people, agents). Use when a proposal goes to review or dev handoff, before its ticket, before a commit or release that changes a proposal in review or handed off, or when asked for a proposal's spec, its link, or "the spec of PS-…".
---

# A proposal's spec

The spec is the proposal as files on the site, at `/spec/<CODE>-<key>/`, readable with no designer and no password:

| File | For |
| --- | --- |
| `index.html` | a person: contents, every screen and state in light and dark, what it does, its structure, the logic |
| `index.md` | an agent: the same as text, its contents linking each screen's file |
| `screens/<id>.md` | one screen: when it shows, what it does, its structure as an outline (what the proposal adds marked `+`) |
| `screens/<id>.json` | the same structure in full: every component, its props, box, layout and tokens |
| `screens/<id>-light.png`, `-dark.png` | its pictures |

It's what the developers and their agents build from: it replaces handing them a file of instructions. The handoff
(`handoff.md`) stays the source of the logic; the spec carries it, with the screens.

**When**: not while the proposal is being designed. Once it's ready to share (→ In review) or to build (→ Dev
handoff), and again after every change to it or its handoff while it's in either status. A test fails on a proposal in
review or handed off without its spec generated (`src/proposals/specs.test.ts`; the ones from before specs are in
`proposals/specs-pending.json`: when one is touched, it gets its spec and leaves that list).

Not for a project whose handoff is its code (`herocanvas.config.ts` `projects`, `handoff: 'code'`): its code is its spec.

## 1. `spec.json`: its screens and states

In the proposal's folder. **Every screen the proposal adds or changes, in every state that looks or behaves
differently**: empty and filled, an error, each permission, free and paid, each version (`variant`), each Scenarios
control that changes it, a sheet or dialog open. Read `handoff.md` and the proposal's `pages.tsx` (`show`, `variants`,
its controls) to list them; ask the person when a state's worth showing is unclear.

```json
{
  "intro": "Optional: a paragraph before the screens (Markdown).",
  "screens": [
    {
      "id": "notifications-denied",
      "group": "2 · Settings › Notifications",
      "title": "Denied",
      "route": "/more/notifications?pnotif=denied",
      "steps": [{ "click": "Edit" }],
      "when": "The permission was denied in the device's settings.",
      "shows": "The same card, with Open Settings and why it's needed.",
      "actions": [{ "on": "Open Settings", "does": "Opens the app's page in the device's settings", "to": "notifications-allowed" }]
    }
  ]
}
```

- `route` and `steps` as `npm run shot` takes them (the proposal's code is added; a version: `&variant=b`). A state
  reached only by taps the route can't express needs a param for it (a Scenarios control), not a long list of steps.
- `when`: the condition that leads to it, as the user would meet it. `shows`: what's there. `actions`: what each thing
  does, `to` the id of the screen it leads to (a link in the spec).
- `group`: a heading for screens that go together, numbered in the order a person meets them.
- `key` is written by the command the first time: leave it.

## 2. Generate it

`npm run spec -- <CODE>` (several codes, or `--all`). It captures each screen in light and dark, reads its structure
from the screen, marks against Live what the proposal adds, and writes `public/spec/<CODE>-<key>/`. It prints the
local file and, for the site, its two links.

## 3. Read it as its reader would

Open `index.html` (the local path it printed, or the dev server's `/spec/<CODE>-<key>/index.html`) and `index.md`
with one screen's `.md`:

- Every screen and state the handoff talks about is there, in the order a person meets them; its pictures show the
  state its `when` names (not the default one), in both themes.
- The outline names the app's components with their props; nothing in it is the designer's own (a panel, an
  outline): report it if so.
- `when`, `shows` and `actions` say what the handoff says, with the same words. Fix `spec.json` or the handoff, and
  generate again.

Show the person the page before sharing it.

## 4. Share it

Its links, from the command's output, on the site's address (`herocanvas.config.ts` `share.url`), working once the
commit is published there:

- for a person: `<site>/spec/<CODE>-<key>/index.html`
- for an agent: `<site>/spec/<CODE>-<key>/index.md`

Both go wherever the proposal goes, always both: its ticket for the developers (the agent's link is what their coding
agent reads), the board, a message. The Proposal panel's
**Spec** section has them too (open, copy for people, copy for agents).

They open with no password for whoever has them: the key in the address is what keeps it from being guessed. To take
a link back, delete `key` from `spec.json` and generate again: a new address, the old one gone (say so: links given
out stop working).

## 5. Keep it current

It's a picture of the proposal at that moment (its header says the version and commit). After any change to the
proposal's screens, texts or `handoff.md` while it's in review or handed off: generate it again and commit it with
the change. A proposal built into the mirror (its folder deleted) or deleted: its `public/spec/<CODE>-*` folder goes
with it.
