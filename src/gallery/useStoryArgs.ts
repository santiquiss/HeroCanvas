import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { Args, StoryModule } from '../design/stories';
import { fitArgs } from '../design/storyArgs';

type Overrides = Record<string, Args>;

function parse(q: URLSearchParams): Overrides {
  try {
    return JSON.parse(q.get('args') || '{}');
  } catch {
    return {};
  }
}

/**
 * Arg overrides per story, in the URL (`args={"Primary":{"label":"Go"}}`) so a tweaked state can be shared.
 * Effective args = module defaults < story args < overrides.
 */
export function useStoryArgs(mod: StoryModule<Args>) {
  const [search, setSearch] = useSearchParams();
  const overrides = parse(search);

  // Always derive from the latest URL, so quick successive edits don't overwrite each other.
  const change = useCallback(
    (fn: (o: Overrides) => Overrides) =>
      setSearch(
        (prev) => {
          const q = new URLSearchParams(prev);
          const next = Object.fromEntries(Object.entries(fn(parse(prev))).filter(([, v]) => Object.keys(v).length));
          if (Object.keys(next).length) q.set('args', JSON.stringify(next));
          else q.delete('args');
          return q;
        },
        { replace: true },
      ),
    [setSearch],
  );

  // A prop set to null (Props: a nullable parameter cleared) renders as not passed, so the component's own default applies.
  const argsFor = (story: string): Args =>
    // A link's overrides fitted to the story's selects: a value that isn't an option would break the component.
    Object.fromEntries(Object.entries({ ...mod.args, ...mod.stories.find((s) => s.name === story)?.args, ...fitArgs(mod, overrides[story] ?? {}) }).map(([k, v]) => [k, v === null ? undefined : v]));
  const update = (story: string, patch: Args) => change((o) => ({ ...o, [story]: { ...o[story], ...patch } }));
  const reset = (story: string) =>
    change((o) => {
      const next = { ...o };
      delete next[story];
      return next;
    });
  return { argsFor, update, reset, overrides };
}
