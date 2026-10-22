# Contributing to HeroCanvas

Thanks for helping. HeroCanvas is built with AI agents, and so is its development: [AGENTS.md](AGENTS.md) is the
guide for any change (where code goes, the rules, what to check), whether you write it or your agent does.

## Before you start

- **A bug**: open an issue with the bug template: what you did, what you expected, what happened, and the link
  HeroCanvas shows for the screen (it carries the device, theme and scenario).
- **An idea or a bigger change**: open an issue with the feature template first, so we can agree on the shape
  before you build it.
- **Your app doesn't connect well** (a stack, a pattern the agent misreads): that's most valuable. Tell us the stack
  and what went wrong; a small public repo that shows it is even better.

## Working on it

```
npm install
npm run dev
```

With no app connected, HeroCanvas shows its own tour: every part of it has a page there to try your change on.

Before you open a pull request:

- `npm run typecheck`, `npm run lint`, `npm test` and `npx vite build` pass.
- You looked at it: `npm run shot -- "/<page>"`, or the dev server, on a phone and a tablet, light and dark.
- The version stays as it is: it's bumped, written in `src/CHANGELOG.md` and tagged when the pull request is
  merged, so two open at once don't clash. If it changes what a team's code relies on, say what to adapt in the
  description: it goes in the changelog's **Contract**.
- A new file or folder of the tool's is listed in `scripts/update/tool-files.json`, so updates bring it.

Keep pull requests to one change each, with a line on why in the description. The same checks run on every pull
request (`.github/workflows/checks.yml`), and it's merged once they pass.

## Conduct and security

Everyone here follows the [code of conduct](CODE_OF_CONDUCT.md). A security issue goes privately, never in a public
issue: [SECURITY.md](SECURITY.md) says how.

## License

By contributing, you agree that your contribution is licensed under the project's license ([LICENSE](LICENSE)).
