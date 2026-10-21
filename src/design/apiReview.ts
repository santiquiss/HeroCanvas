// Naming review of the app's component API, for the handoff: parameters whose name breaks a convention, with a
// suggestion. Rules, so it stays current as the API is read again; plus notes kept by hand
// (app/connectors/api-review.json) for what a rule can't see. Shown in Inspect's code API.

/** An optional file a connector writes (app/connectors/<name>), or `fallback` when there's none. */
function optional<T>(files: Record<string, unknown>, fallback: T): T {
  const hit = Object.values(files)[0];
  return (hit as T | undefined) ?? fallback;
}
const notes = optional(import.meta.glob('@app/connectors/api-review.json', { eager: true, import: 'default' }), { widgets: {}, params: {} });
import type { ApiParam, ApiWidget } from './library';

export interface ReviewNote {
  /** What's off, in a few words. */
  issue: string;
  /** The name to use instead, when there's one. */
  suggest?: string;
}

/** Convention rules over one parameter. Each returns a note or nothing. */
const RULES: ((p: ApiParam) => ReviewNote | undefined)[] = [
  // Most of the library (and Material) says `selected`.
  (p) => (p.name === 'isSelected' ? { issue: '`isSelected` here, `selected` in most widgets (and Material)', suggest: 'selected' } : undefined),
  // Callbacks are on + subject + event (onAddPressed); `onTapAdd` puts the event first.
  (p) => {
    const m = p.name.match(/^on(Tap|Press|Pressed|Change|Changed)([A-Z]\w*)$/);
    return m ? { issue: 'event before the subject; callbacks are on + subject + event', suggest: `on${m[2]}${m[1] === 'Change' || m[1] === 'Changed' ? 'Changed' : m[1] === 'Tap' ? 'Tap' : 'Pressed'}` } : undefined;
  },
  // A widget gets its context in build(); a parameter for it is a smell.
  (p) => ((p.type ?? '').startsWith('BuildContext') ? { issue: 'BuildContext as a parameter: read it in build()' } : undefined),
  // Negative booleans read twice (`hideHeader: false`); the library mostly says show…
  (p) => (/^hide[A-Z]/.test(p.name) && (p.type ?? '').startsWith('bool') ? { issue: 'negative boolean; the library mostly uses show…', suggest: `show${p.name.slice(4)}` } : undefined),
];

const NOTES = notes as { widgets: Record<string, string>; params: Record<string, ReviewNote> };

/** The widget's own note (its name, its shape), if any: the rule on class names, then the hand-kept ones. */
export function widgetReview(w: ApiWidget): ReviewNote | undefined {
  const manual = NOTES.widgets[w.name];
  if (manual) return { issue: manual };
  return undefined;
}

/** Notes on a parameter: the hand-kept one (`Widget.param`) first, then the rules'. */
export function paramReview(w: ApiWidget, p: ApiParam): ReviewNote | undefined {
  return NOTES.params[`${w.name}.${p.name}`] ?? RULES.map((r) => r(p)).find(Boolean);
}
