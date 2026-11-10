// The project's proposals (`@proposals`: proposals/, or <dir>/proposals for a project beside the first, vite.config.ts)
// as their folders: a glob's paths start wherever the project's folder is, so a file is known by the folder it's in.

/** The proposal folder a glob's path is in: the folder before `/<file>` (`x/handoff.md`, `x/components/A.stories.tsx`). */
export const folderOf = (path: string, file: string): string => {
  const parts = path.slice(0, path.lastIndexOf(`/${file.split('/')[0]}`)).split('/');
  return parts[parts.length - 1];
};

/** A glob's entries keyed by their proposal's folder. */
export const byFolder = <T>(files: Record<string, T>, file: string): Record<string, T> =>
  Object.fromEntries(Object.entries(files).map(([path, v]) => [folderOf(path, file), v]));
