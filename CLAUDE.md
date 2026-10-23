@AGENTS.md

# Releasing HeroCanvas: the website's example follows

Only for whoever maintains HeroCanvas (this file isn't a copy's: `npm run update` doesn't ship it).

Every release of HeroCanvas (a new `src/version.json`, tagged and pushed) ends by bringing it to the website's live
example, Studio (`https://www.herocanvas.io/examples/studio/`, built from `../adaptive-shell-herocanvas`), so what the
site shows is the latest tool. The site's version number follows on its own (it reads `src/version.json` from GitHub).

1. In `../adaptive-shell-herocanvas`: `npm run update` (the `update-herocanvas` skill: clashes and contract changes),
   then `npm run typecheck`, `npm test`, `npx vite build`, a look with `npm run shot`, and commit
   (`Update HeroCanvas to X.Y.Z`).
2. In `../herocanvas-site`: `rm -rf examples/studio && cp -R ../adaptive-shell-herocanvas/dist examples/studio`, commit
   (`The Studio example on HeroCanvas X.Y.Z`), push, `npx vercel --prod`.
3. Check https://www.herocanvas.io/examples/studio/ opens and its ⓘ shows the new version.

A release isn't done until the example runs it.
