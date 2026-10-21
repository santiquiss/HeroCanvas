---
name: update-herocanvas
description: Update this copy of HeroCanvas to a newer version - run `npm run update`, resolve clashes in tool files the team changed, adapt app/ and proposals/ to each contract change in the changelog, then check and show it. Use when the person asks to update or upgrade HeroCanvas, get its latest version, or bring in its new features or fixes.
---

# Update HeroCanvas

A copy has two sides (AGENTS.md): **the tool** (`src/`, `scripts/`, the files in `scripts/update/tool-files.json`),
which an update replaces, and **the team's code** (`app/`, `proposals/`, `herocanvas.config.ts`, `brand/`), which it
never touches. `npm run update` does the replacing; this skill does what's left: the clashes and the team's code.

## 1. Before

- `git status` must be clean: commit or stash the person's work first (ask before committing it for them). The update
  is then one change they can review with `git diff` or undo with `git checkout .`.
- Say which HeroCanvas version they have (`src/version.json`; the About page, from the ⓘ in the left rail) and which
  they'd get: `npm run update -- --dry-run` lists every file it would write, merge, delete or keep, and the
  changelog between the two. A version other than the latest: `npm run update -- 0.6.0`. Their own fork as the
  source: `--from <git url>` (or a `herocanvas` remote).

## 2. Run it

`npm run update`. It replaces the tool's files the team didn't touch, merges those they did (theirs, the version they
had, the new one), merges `package.json` by field (the tool's scripts and dependencies, their own kept), and prints
what it did and the changelog. Both versions stay fetched: `git diff refs/herocanvas/base refs/herocanvas/target --
<path>` shows what upstream changed in a file.

## 3. Clashes in the tool's files

A clash means the team changed a tool file that upstream changed too: an ejected piece. For each file listed:

- Read both sides of the markers (`<<<<<<< yours`, `>>>>>>> HeroCanvas <new>`) and what upstream changed
  (`git diff refs/herocanvas/base refs/herocanvas/target -- <path>`).
- Keep **the intent of each**: upstream's fix or feature, and the team's change on top of it. Never drop the team's
  change silently; if the two can't both stand, ask the person which wins.
- A binary file: theirs stayed, the new one is beside it (`<path>.herocanvas-new`). Ask which to keep; delete the
  other.
- "Kept: removed upstream, but changed here": upstream no longer has the file. Check whether anything still imports
  it; if not, ask before deleting it.

If the same piece clashes update after update, say so: it's missing an extension point, or the team's change belongs
upstream as a pull request (docs/developer-experience.md, Changing the tool itself).

## 4. The team's code: contract changes

Read every section the update printed (HeroCanvas's `src/CHANGELOG.md`; the root `CHANGELOG.md` is the team's own
and the update leaves it alone). Each **Contract** item is a change in what crosses between the tool and the
team's code (`herocanvas`'s exports, what the tool reads from `app/`): a renamed export, a new required field in the
manifest, a moved file, a new token. For each one, adapt `app/` and `proposals/` as it says. `npm run typecheck`
finds most of them; the changelog explains the rest. Don't edit the tool to make old app code fit.

Other items (new features, fixes) need nothing, but tell the person about the ones they'll notice.

## 5. Check and show

- `npm install` (the dependencies may have changed), then `npm run typecheck`, `npm run lint`, `npm test`,
  `npx vite build`.
- Look at it: `npm run shot -- "/<a page>"` (pass `--base` with the dev server's address if another app uses port
  5173), phone and tablet, light and dark. The app should look as it did, plus what the changelog says is new.
- Tell the person, short: the versions (from → to), what's new for them, what you adapted in their code and why, any
  clash and how you resolved it. Then commit, when they say so: `Update HeroCanvas to <version>`. If you adapted
  their code, add a line to their `CHANGELOG.md` too (and bump `package.json`'s version, a fix).
