// Every prop an example passes its component that the widget has no parameter for is declared beside the component
// (design/simulatorProps), even one the examples leave empty by default (the smoke test only sees the set ones). The
// story's own controls (args the component doesn't receive) aren't props: the Props tab lists them apart.
import { describe, expect, it } from 'vitest';
import { proposedParams } from '../design/handoff';
import { loadLibrary } from '../design/library';
import { propDecl } from '../design/simulatorProps';
import { STORIES } from '../design/stories';
import { receivedProps } from '../gallery/receivedProps';
import { renderAt } from './render';

// None without stories (an empty `each` is no test, which vitest fails).
describe.runIf(STORIES.size)('props the examples pass', () => {
  it.each([...STORIES.keys()])('%s: each one the widget lacks is declared', async (name) => {
    const lib = await loadLibrary();
    const widget = lib.widget(name);
    if (!widget) return;
    let got: Set<string> | null = null;
    await renderAt(`/components/${encodeURIComponent(name)}`, (root) => {
      got = receivedProps(name, root);
    });
    const received: Set<string> = got ?? new Set();
    const params = new Set(widget.params.map((p) => p.name));
    const decl = propDecl(name);
    const added = proposedParams(name);
    const mod = STORIES.get(name)!;
    const args = Object.assign({}, mod.args, ...mod.stories.map((s) => s.args ?? {}));
    const undeclared = Object.keys(args).filter(
      (k) =>
        received.has(k) &&
        !params.has(k) &&
        !(k in added) &&
        k !== 'constructor' &&
        k !== decl.constructorBy?.prop &&
        !decl.simulator?.[k] &&
        !decl.differs?.[k] &&
        !widget.constructors.includes(`${name}.${String(args[k])}`),
    );
    expect(undeclared).toEqual([]);
  });
});
