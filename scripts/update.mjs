// `npm run update [-- <version>]`: HeroCanvas's newer version into this copy. The tool's files (scripts/update/
// tool-files.json, read from the new version) are replaced; those the team changed are merged (theirs, the version
// they had, the new one), and a clash is left marked for them or their agent (the update-herocanvas skill). app/,
// proposals/ and the config are never touched. Releases come from git tags (vX.Y.Z), fetched with the git
// credentials already set up.
//
//   npm run update                   the latest version
//   npm run update -- 0.6.0          a given one
//   npm run update -- --dry-run      what it would do, changing nothing
//   npm run update -- --from <git url>   another source (a fork); default: the `herocanvas` remote, else GitHub's
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { changesBetween, mergePackage, newer, plan, versions } from './update/plan.mjs';

const DEFAULT_SOURCE = 'https://github.com/santiquiss/HeroCanvas.git';
const BASE = 'refs/herocanvas/base';
const TARGET = 'refs/herocanvas/target';
const MANIFEST = 'scripts/update/tool-files.json';

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...opts });
const gitBuffer = (args) => execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

function args(argv) {
  const out = { version: null, from: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--from') out.from = argv[++i];
    else if (/^v?\d+\.\d+\.\d+$/.test(a)) out.version = a.replace(/^v/, '');
    else fail(`Unknown argument: ${a}`);
  }
  return out;
}

/** path → blob hash of the tool's files in a fetched version (or in the index, for this copy). */
function hashes(ref, paths) {
  const out = ref ? git(['ls-tree', '-r', ref, '--', ...paths]) : git(['ls-files', '-s', '--', ...paths]);
  const map = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [meta, path] = line.split('\t');
    const parts = meta.split(' ');
    map.set(path, ref ? parts[2] : parts[1]);
  }
  return map;
}

const show = (ref, path) => gitBuffer(['show', `${ref}:${path}`]);
const isBinary = (buf) => buf.subarray(0, 8000).includes(0);

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** A three-way merge of one file; returns whether it clashed (then it's written with conflict markers). */
function merge(path, from, to) {
  const base = show(BASE, path);
  const theirs = show(TARGET, path);
  const mine = readFileSync(path);
  if ([base, theirs, mine].some(isBinary)) {
    // Not mergeable: theirs stays, the new one beside it.
    write(`${path}.herocanvas-new`, theirs);
    return true;
  }
  const dir = mkdtempSync(join(tmpdir(), 'hc-merge-'));
  try {
    const [m, b, t] = ['mine', 'base', 'theirs'].map((n) => join(dir, n));
    writeFileSync(m, mine);
    writeFileSync(b, base);
    writeFileSync(t, theirs);
    let merged;
    let clashed = false;
    try {
      merged = git(['merge-file', '-p', '-L', 'yours', '-L', `HeroCanvas ${from}`, '-L', `HeroCanvas ${to}`, m, b, t]);
    } catch (e) {
      // Exit status = the number of clashes (the merged text, with markers, is still on stdout).
      if (typeof e.status !== 'number' || e.status < 0 || e.status > 127) throw e;
      merged = e.stdout;
      clashed = true;
    }
    writeFileSync(path, merged);
    return clashed;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const opts = args(process.argv.slice(2));
  try {
    git(['rev-parse', '--is-inside-work-tree']);
  } catch {
    fail('This copy isn’t a git repository: an update needs git to merge and to undo. Run `git init` and commit first.');
  }
  if (!opts.dryRun && git(['status', '--porcelain']).trim())
    fail('There are uncommitted changes. Commit them first, so the update is one change you can review (git diff) or undo.');

  const remotes = git(['remote']).split('\n');
  const source = opts.from ?? (remotes.includes('herocanvas') ? git(['remote', 'get-url', 'herocanvas']).trim() : DEFAULT_SOURCE);
  // HeroCanvas's version here (src/version.json; before 0.6.0, package.json's held it).
  const current = JSON.parse(readFileSync(existsSync('src/version.json') ? 'src/version.json' : 'package.json', 'utf8')).version;

  let tags;
  try {
    tags = git(['ls-remote', '--tags', '--refs', source]).split('\n').map((l) => l.split('refs/tags/')[1]).filter(Boolean);
  } catch (e) {
    fail(`Couldn't read HeroCanvas's versions from ${source}:\n${e.stderr || e.message}`);
  }
  const available = versions(tags);
  const target = opts.version ?? available[0];
  if (!target) fail(`No versions (vX.Y.Z tags) at ${source}.`);
  if (!available.includes(target)) fail(`No version ${target} at ${source}. The latest: ${available.slice(0, 5).join(', ')}.`);
  if (!available.includes(current)) fail(`This copy's HeroCanvas version (${current}, src/version.json) isn't one of ${source}'s: can't tell what changed here.`);
  if (!newer(target, current)) {
    console.log(`HeroCanvas is up to date (${current}).`);
    return;
  }

  console.log(`HeroCanvas ${current} → ${target}, from ${source}`);
  git(['fetch', '--quiet', '--no-tags', source, `+refs/tags/v${current}:${BASE}`, `+refs/tags/v${target}:${TARGET}`]);

  let manifest;
  try {
    manifest = JSON.parse(show(TARGET, MANIFEST).toString());
  } catch {
    fail(`Version ${target} has no ${MANIFEST}: it predates the update command.`);
  }
  const paths = [...manifest.dirs, ...manifest.files];
  const steps = plan(hashes(BASE, paths), hashes(TARGET, paths), hashes(null, paths));

  const clashes = [];
  for (const s of steps) {
    if (opts.dryRun || s.action === 'keep') continue;
    if (s.action === 'write') write(s.path, show(TARGET, s.path));
    else if (s.action === 'delete') rmSync(s.path);
    else if (merge(s.path, current, target)) clashes.push(s.path);
  }

  // package.json: merged by field (the scripts and dependencies are the tool's; the rest, the version included, the team's).
  const pkgChanged = !opts.dryRun && manifest.merged.includes('package.json');
  if (pkgChanged) {
    const local = JSON.parse(readFileSync('package.json', 'utf8'));
    const merged = mergePackage(local, JSON.parse(show(BASE, 'package.json')), JSON.parse(show(TARGET, 'package.json')));
    writeFileSync('package.json', JSON.stringify(merged, null, 2) + '\n');
  }

  const by = (a) => steps.filter((s) => s.action === a);
  const list = (a, label) => by(a).length && console.log(`\n${label} (${by(a).length}):\n${by(a).map((s) => `  ${s.path}  — ${s.why}`).join('\n')}`);
  list('write', opts.dryRun ? 'Would write' : 'Written');
  list('delete', opts.dryRun ? 'Would delete' : 'Deleted');
  list('merge', opts.dryRun ? 'Would merge (changed here and upstream)' : 'Merged');
  list('keep', 'Kept as they are here');
  if (clashes.length) console.log(`\n⚠ Clashes to resolve (conflict markers, or a .herocanvas-new beside a binary file):\n${clashes.map((p) => `  ${p}`).join('\n')}`);

  // HeroCanvas's changelog: src/CHANGELOG.md (before 0.6.0, the root's).
  let log;
  try {
    log = show(TARGET, 'src/CHANGELOG.md').toString();
  } catch {
    log = show(TARGET, 'CHANGELOG.md').toString();
  }
  console.log(`\n──── What changed in HeroCanvas (src/CHANGELOG.md, ${current} → ${target}) ────\n\n${changesBetween(log, current, target)}\n`);
  console.log(
    opts.dryRun
      ? 'Dry run: nothing changed.'
      : [
          'Next:',
          clashes.length ? '  - resolve the clashes above' : null,
          '  - adapt app/ and proposals/ to each **Contract** change above',
          '  - npm install, then npm run typecheck, npm run lint, npm test',
          `  - review it (git diff) and commit: "Update HeroCanvas to ${target}"`,
          `  (Or ask your agent to "update HeroCanvas": the update-herocanvas skill does all of it.)`,
          `  Both versions stay fetched for comparing: git diff ${BASE} ${TARGET} -- <path>`,
        ]
          .filter(Boolean)
          .join('\n'),
  );
}

main();
