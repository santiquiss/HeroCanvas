// What `npm run update` does to each of the tool's files, from three versions of it: the one the team had installed
// (base), the one being installed (target) and what's on their disk (local). Pure: hashes in, actions out.

/**
 * @typedef {{ path: string, action: 'write' | 'merge' | 'delete' | 'keep', why: string }} Step
 * @param {Map<string, string>} base    path → blob hash, the installed version's tool files
 * @param {Map<string, string>} target  the new version's
 * @param {Map<string, string>} local   the team's (only within the tool's paths)
 * @returns {Step[]} only the files that change or need a look, sorted by path
 */
export function plan(base, target, local) {
  const paths = [...new Set([...base.keys(), ...target.keys(), ...local.keys()])].sort();
  const steps = [];
  for (const path of paths) {
    const b = base.get(path);
    const t = target.get(path);
    const l = local.get(path);
    if (t) {
      if (l === t) continue;
      if (!l) steps.push({ path, action: 'write', why: b ? 'restored (it was deleted here)' : 'new' });
      else if (l === b) steps.push({ path, action: 'write', why: 'updated' });
      // Changed here and not upstream: theirs stays.
      else if (b === t) steps.push({ path, action: 'keep', why: 'changed here, not in this update' });
      // Changed here and upstream (or added on both sides): merged.
      else steps.push({ path, action: 'merge', why: b ? 'changed here and upstream' : 'added here and upstream' });
    } else if (l) {
      if (!b) steps.push({ path, action: 'keep', why: 'your own file in a tool folder' });
      else if (l === b) steps.push({ path, action: 'delete', why: 'removed upstream' });
      else steps.push({ path, action: 'keep', why: 'removed upstream, but changed here: check if it still has a use' });
    }
  }
  return steps;
}

/**
 * package.json: the new version's `version`, `scripts` and dependencies, keeping what the team added (a script, a
 * dependency) and what they changed that this update doesn't change. Fields outside those are the team's.
 */
export function mergePackage(local, base, target) {
  const out = { ...local, version: target.version };
  for (const field of ['scripts', 'dependencies', 'devDependencies']) {
    const l = local[field] ?? {};
    const b = base[field] ?? {};
    const t = target[field] ?? {};
    const merged = {};
    for (const key of new Set([...Object.keys(l), ...Object.keys(t)])) {
      if (key in t) merged[key] = l[key] !== undefined && l[key] !== b[key] && b[key] === t[key] ? l[key] : t[key];
      // Gone upstream: removed, unless it's the team's (never upstream) or they changed it.
      else if (!(key in b) || l[key] !== b[key]) merged[key] = l[key];
    }
    if (Object.keys(merged).length) out[field] = Object.fromEntries(Object.entries(merged).sort(([a], [z]) => (field === 'scripts' ? 0 : a.localeCompare(z))));
    else delete out[field];
  }
  return out;
}

/** `v1.2.3` tags as versions, newest first. */
export function versions(tags) {
  const parse = (v) => v.split('.').map(Number);
  return tags
    .map((t) => t.match(/^v(\d+\.\d+\.\d+)$/)?.[1])
    .filter(Boolean)
    .sort((a, b) => {
      const [x, y] = [parse(a), parse(b)];
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
    });
}

/** Whether `a` is a newer version than `b`. */
export const newer = (a, b) => versions([`v${a}`, `v${b}`])[0] === a && a !== b;

/** The changelog's sections after `from` up to `to` (CHANGELOG.md's `## 1.2.3 — date` headings). */
export function changesBetween(changelog, from, to) {
  const sections = changelog.split(/^(?=## \d+\.\d+\.\d+)/m).slice(1);
  return sections
    .filter((s) => {
      const v = s.match(/^## (\d+\.\d+\.\d+)/)[1];
      return newer(v, from) && !newer(v, to);
    })
    .join('')
    .trim();
}
