// `npm test`: Vitest on each of the copy's projects (herocanvas.config.ts `projects`, scripts/vite/projects.ts): the
// first with every test, each other with its own and the smoke test on its app (vite.config.ts `test`). Arguments go
// to every run (`npm test -- src/proposals`: the first project's only, as no other has them).
import { spawnSync } from 'node:child_process';

// Node reads the config's TypeScript itself (its types stripped), only for its projects' ids.
const { default: hc } = await import('../herocanvas.config.ts');
const ids = (hc.projects ?? []).map((p) => p.id);
const args = process.argv.slice(2);

let failed = false;
for (const [i, id] of (ids.length ? ids : [null]).entries()) {
  if (i > 0 && args.length) break;
  if (id && ids.length > 1) console.log(`\n— ${id} —`);
  const env = { ...process.env, ...(i > 0 ? { HC_PROJECT: id } : {}) };
  const r = spawnSync('npx', ['vitest', 'run', ...args], { stdio: 'inherit', env });
  failed ||= r.status !== 0;
}
process.exit(failed ? 1 : 0);
