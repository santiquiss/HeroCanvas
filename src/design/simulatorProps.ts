// The props a component draws with that the code's component has no parameter for, each declared beside the
// component (`declareProps`), and how it looks unlike the code:
// - `simulator`: only the simulator needs it: state the app keeps itself (a field's text in its controller, a chart's
//   tapped bar), or what the code gets another way (the widget works it out, another parameter gives it, the app
//   builds it around the widget). Its note says which. Not a difference. Inspect shows it as such; the handoff and the code snippet leave
//   it out.
// - `differs`: something the widget doesn't have yet (a Figma variant, a size, a state): the component differs from
//   the code until design and the app agree on it. Inspect marks it; the gallery colors the component.
// - `look`: how it looks unlike the code with no prop behind it (Figma is the reference): each a line on what differs.
// - `constructorBy`: the prop that picks the constructor, when its values aren't the constructors' names (`variant:
//   'icon'` is `Logo()`); a value that is one (`variant: 'primary'`, Button.primary) needs no declaring.
// - `kinds`: for a class of named constructors that isn't a widget itself (Message: `Message.userText` is
//   MessageUserText), the widgets they build. The class stands for them in the gallery: it differs where they do.
// - `accepted`: a difference reviewed and accepted as it is (keyed by its `differs` prop, or by its `look` line), with
//   why, who and when. It no longer makes the component differ: the dot and Status read it as matching the code, the
//   handoff leaves it out of the work, and a new difference still shows (an acceptance names only its own).
// An undeclared prop counts as `differs` (the smoke test asks for each to be declared: src/test/undeclaredProps.ts).

export interface Acceptance {
  reason: string;
  by: string;
  /** The date, `yyyy-mm-dd`. */
  on: string;
}

export interface PropDecl {
  /** A prop that picks the widget's constructor, and the one each value is (`icon` → `Logo`, the default one). */
  constructorBy?: { prop: string; values: Record<string, string> };
  simulator?: Record<string, string>;
  differs?: Record<string, string>;
  look?: string[];
  kinds?: string[];
  accepted?: Record<string, Acceptance>;
}

const DECLS = new Map<string, PropDecl>();

/** Declares a component's props that aren't its widget's: next to the component, with a reason each. */
export function declareProps(name: string, decl: PropDecl): void {
  DECLS.set(name, decl);
}

export const propDecl = (name: string): PropDecl => DECLS.get(name) ?? {};

/** The widgets a class of named constructors builds (`kinds`), or none. */
export const kindsOf = (name: string): string[] => DECLS.get(name)?.kinds ?? [];

/** Every component's declaration (its tests check them). */
export const allDeclarations = (): [string, PropDecl][] => [...DECLS];

/** Whether a prop is the simulator's alone (never in the handoff). */
export const isSimulatorProp = (name: string, prop: string) => !!DECLS.get(name)?.simulator?.[prop];

/** How a difference (a `differs` prop, or a `look` line) was accepted, or null while it's open. */
export const acceptanceOf = (name: string, key: string): Acceptance | null => DECLS.get(name)?.accepted?.[key] ?? null;

/** What a component declares it differs from its widget in (a prop each, with why), not counting the accepted ones. */
export const declaredDifferences = (name: string): Record<string, string> =>
  Object.fromEntries(Object.entries(DECLS.get(name)?.differs ?? {}).filter(([k]) => !acceptanceOf(name, k)));

/** How it looks unlike the code (Figma's way), declared beside it, not counting the accepted ones. */
export const lookDifferences = (name: string): string[] => (DECLS.get(name)?.look ?? []).filter((l) => !acceptanceOf(name, l));

/** The differences accepted as they are: each its key, what it is, and how it was accepted. */
export function acceptedDifferences(name: string): { key: string; text: string; acceptance: Acceptance }[] {
  const d = DECLS.get(name);
  if (!d?.accepted) return [];
  return Object.entries(d.accepted).map(([key, acceptance]) => ({ key, text: d.differs?.[key] ? `${key}: ${d.differs[key]}` : key, acceptance }));
}
