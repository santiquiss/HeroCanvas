// A component's props that the app's code has no parameter for must be declared beside it (design/simulatorProps:
// the simulator's alone, or a difference to agree on), so the handoff knows which to leave out and the gallery which
// components differ from the code. A proposal's added parameters count as declared (its `params`). Checked against the
// code's API when a connector gives it (app/connectors/components-api.json); without one, nothing to check.
const api = (Object.values(import.meta.glob('@app/connectors/components-api.json', { eager: true, import: 'default' }))[0] as { widgets: unknown[] } | undefined) ?? { widgets: [] };
import { proposedParams } from '../design/handoff';
import { componentInstance } from '../design/component';
import { propDecl } from '../design/simulatorProps';

type Widget = { name: string; params: { name: string }[]; constructors: string[] };
const WIDGETS = new Map((api as unknown as { widgets: Widget[] }).widgets.map((w) => [w.name, w]));

/** "Button.size": the props drawn here that are neither the widget's nor declared. */
export function undeclaredProps(root: HTMLElement): string[] {
  const out = new Set<string>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-hc]')) {
    const inst = componentInstance(el.dataset.hc);
    const w = inst && WIDGETS.get(inst.name);
    if (!inst || !w) continue;
    const params = new Set(w.params.map((p) => p.name));
    const decl = propDecl(inst.name);
    const added = proposedParams(inst.name);
    for (const [k, v] of Object.entries(inst.props)) {
      if (v == null || k === 'constructor' || k === decl.constructorBy?.prop || params.has(k) || k in added || decl.simulator?.[k] || decl.differs?.[k]) continue;
      // A value that names a constructor (Button's variant 'primary' → Button.primary).
      if (w.constructors.includes(`${inst.name}.${String(v)}`)) continue;
      out.add(`${inst.name}.${k}`);
    }
  }
  return [...out];
}
