# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately instead:

- **On GitHub** (preferred): [Report a vulnerability](https://github.com/santiquiss/HeroCanvas/security/advisories/new),
  from the repository's Security tab.
- **By email**: santiquiss@gmail.com.

Say what you found, how to reproduce it, and what it affects. You'll get an answer within a week; once it's fixed,
the release notes credit you, unless you'd rather not.

## Versions

HeroCanvas is in beta: fixes go into the latest version only. Update a copy with `npm run update`.

## Scope

HeroCanvas runs on your machine, or as a static site you deploy. What's most worth a look: the comments backend
(`src/comments/`, a Supabase project you set up), `npm run update` (it fetches and merges code from this repository's
tags) and the scripts in `scripts/`. A vulnerability in your own app, mirrored in HeroCanvas, belongs to that app.
