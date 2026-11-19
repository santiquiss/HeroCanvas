// A copy's projects (herocanvas.config.ts `projects`): apps of one team that share a design system but nothing else.
// The first is the copy's own, at the root (app/, proposals/), served at the site's root; each other one lives in a
// folder of its own (<dir>/app, <dir>/proposals) and is served at /<id>/: the same tool built once per project, so its
// pages, proposals, comments and what the browser keeps never mix with another's. What a project takes from another
// (`shares`): its components, its theme and its connectors to the code those components come from.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface ProjectConfig {
  /** Its id: its address (`/<id>/`) and its comments' key. */
  id: string;
  /** Shown in the toolbar's project menu. */
  name: string;
  /** Its folder, from the copy's root (`<dir>/app`, `<dir>/proposals`); the first project's is the root. Default: its id. */
  dir?: string;
  /**
   * What it takes from another project, as folders from the copy's root: `components` (their stories show in its
   * gallery), `theme` (its `theme.css` and token stylesheets: the `--app-*` tokens) and `connectors` (the
   * `connectors/*.json` that compare those components and tokens against the code).
   */
  shares?: { components?: string; theme?: string; connectors?: string };
  /**
   * What tells its builders what a proposal changes: `file` (the default), each proposal's `handoff.md`, which a test
   * asks of every proposal that changes something; `code`, the mirror's code itself (its comments say why), so its
   * proposals need none.
   */
  handoff?: 'file' | 'code';
}

export interface Project {
  id: string;
  name: string;
  /** The first project: at the root, with the copy's own folders. */
  root: boolean;
  /** Its folders, from the copy's root. */
  app: string;
  proposals: string;
  /** Its address from the site's root: '' for the first, `<id>/` for the others. */
  path: string;
  shares: NonNullable<ProjectConfig['shares']>;
  handoff: NonNullable<ProjectConfig['handoff']>;
}

/** The project a copy has when it declares none: its app at the root. */
const SINGLE: ProjectConfig = { id: 'app', name: '' };

export function projectsOf(configs: ProjectConfig[] | undefined): Project[] {
  const list = configs?.length ? configs : [SINGLE];
  return list.map((p, i) => {
    const dir = i === 0 ? '' : (p.dir ?? p.id);
    return {
      id: p.id,
      name: p.name,
      root: i === 0,
      app: dir ? `${dir}/app` : 'app',
      proposals: dir ? `${dir}/proposals` : 'proposals',
      path: i === 0 ? '' : `${p.id}/`,
      shares: p.shares ?? {},
      handoff: p.handoff ?? 'file',
    };
  });
}

/** A project by its id (`HC_PROJECT`); the first when unset. Throws on an unknown one. */
export function projectById(projects: Project[], id: string | undefined): Project {
  if (!id) return projects[0];
  const p = projects.find((x) => x.id === id);
  if (!p) throw new Error(`HC_PROJECT=${id}: no such project in herocanvas.config.ts (${projects.map((x) => x.id).join(', ')})`);
  return p;
}

/**
 * The codes a project's proposals took (`<proposals>/*\/proposal.json`) and retired (`retired.json`): a code is the
 * copy's, never given again in another of its projects (an author's series goes on across them).
 */
export function takenCodes(root: string, p: Project): string[] {
  const dir = resolve(root, p.proposals);
  if (!existsSync(dir)) return [];
  const read = (f: string) => {
    try {
      return JSON.parse(readFileSync(f, 'utf8'));
    } catch {
      return null;
    }
  };
  const made = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => read(join(dir, e.name, 'proposal.json'))?.code as string | undefined);
  const retired = ((read(join(dir, 'retired.json')) ?? []) as { code?: string }[]).map((r) => r.code);
  return [...made, ...retired].filter((c): c is string => !!c);
}

/** A folder no project has: what an alias of something a project doesn't share points to (its globs find nothing). */
const NOTHING = 'node_modules/.hc-none';

/** Where the tool reads a project from (vite.config.ts's aliases), as absolute paths. */
export function projectAliases(p: Project, root: string) {
  const at = (dir: string | undefined) => resolve(root, dir ?? NOTHING);
  return [
    // Before `@app`: a project that shares another's connectors reads them there.
    ...(p.shares.connectors ? [{ find: /^@app\/connectors(?=\/|$)/, replacement: at(p.shares.connectors) }] : []),
    { find: /^@app(?=\/|$)/, replacement: at(p.app) },
    { find: /^@proposals(?=\/|$)/, replacement: at(p.proposals) },
    { find: /^@shared\/components(?=\/|$)/, replacement: at(p.shares.components) },
    { find: /^@shared\/theme(?=\/|$)/, replacement: at(p.shares.theme) },
  ];
}
