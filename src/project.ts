// The project this build shows (herocanvas.config.ts `projects`, scripts/vite/projects.ts): a copy's first is at the
// site's root, each other at /<id>/, the tool built for it. They share one origin, so what the browser keeps for a
// project (its pages' state, its comments while no store is shared) has its own key: the first's as it always was.

export const PROJECT = __HC_PROJECT__;

/** Every project of the copy, in its order (none but this one: an empty list). */
export const PROJECTS = __HC_PROJECTS__;

/** A key of the browser's storage for this project: `hc.<name>` for the first, `hc.<id>.<name>` for another. */
export const projectKey = (key: string): string => (PROJECT.root ? key : key.replace(/^hc\./, `hc.${PROJECT.id}.`));

/**
 * Another project's address from this page: the site's root (this page's, less this project's own path) and its path,
 * at its start (`#/`), where it opens on what it showed last.
 */
export function projectUrl(path: string, location: Pick<Location, 'pathname'> = window.location): string {
  const dir = location.pathname.replace(/[^/]*$/, '');
  const root = PROJECT.path && dir.endsWith(`/${PROJECT.path}`) ? dir.slice(0, -PROJECT.path.length) : dir;
  return `${root}${path}#/`;
}
