// Args that come from outside a story (an instance's props opened from Inspect, a shared link) fitted to its controls.
// A component records an enum prop as the code writes it (`AvatarSize.small`); a story's select lists
// the bare values (`small`). A value a select doesn't list would reach the component as an unknown option.
import type { Args, StoryModule } from './stories';

/** `value` as one of a select's options: as is, else by its last segment (`Enum.value` → `value`); undefined if neither. */
export function fitOption(options: readonly string[], value: unknown): string | undefined {
  const s = String(value);
  if (options.includes(s)) return s;
  const bare = s.slice(s.lastIndexOf('.') + 1);
  return options.includes(bare) ? bare : undefined;
}

/** `args` with each select's value fitted to its options; a value that fits none is dropped (the story's own applies). */
export function fitArgs(m: Pick<StoryModule<Args>, 'controls'>, args: Args): Args {
  const out: Args = {};
  for (const [k, v] of Object.entries(args)) {
    const c = m.controls?.[k];
    if (c?.type !== 'select' || v == null) {
      out[k] = v;
      continue;
    }
    const fit = fitOption(c.options, v);
    if (fit !== undefined) out[k] = fit;
  }
  return out;
}
