// Flows: a page made of several screens shown one at a time (a welcome, a sign-up). The page declares them in
// the manifest (`flow`: the step param and its steps); this file runs them and describes them for the tools.
//
// Add a flow: list its steps in the page's manifest entry, then in the page call `useFlow(def)` and render by
// `step.id`, moving on with `go(next)`. The Pages panel, the page inspector and the Flow view pick it up.
import { useCallback, useEffect } from 'react';
import { useUrlPatch, useUrlState } from '../sim/SimContext';
import { HOLD_PARAM, stateKeys } from './stack';
import type { FlowDef, FlowStep, PageDef, Params, StateParams } from './types';
import { t } from '../i18n/ui';

/** The current step and how to move on. Loaders (`auto`) move on by themselves unless held. */
export function useFlow(flow: FlowDef) {
  const first = flow.steps[0].id;
  const [raw] = useUrlState<string>(flow.param, first);
  const [hold] = useUrlState<string>(HOLD_PARAM, '');
  const patch = useUrlPatch();
  const step = flow.steps.find((s) => s.id === raw) ?? flow.steps[0];
  /** To a step, writing any other state with it (one navigation); it lets go of a held step. */
  const go = useCallback(
    (to: string, state: StateParams = {}) => patch({ ...state, [flow.param]: to === first ? null : to, [HOLD_PARAM]: null }),
    [patch, flow.param, first],
  );
  useEffect(() => {
    if (!step.auto || hold) return;
    const { to, ms } = step.auto;
    const t = setTimeout(() => go(to), ms);
    return () => clearTimeout(t);
  }, [step, hold, go]);
  return { step, go, held: !!hold };
}

/** The step a query shows (the first when its param is unset or unknown). */
export function stepOf(flow: FlowDef, search: URLSearchParams): FlowStep {
  return flow.steps.find((s) => s.id === search.get(flow.param)) ?? flow.steps[0];
}

/** The state that shows a step (a variant of it) to look at: its params set, the page's others cleared, loaders held. */
export function stepState(def: PageDef, step: FlowStep, variant?: { state: Params }): StateParams {
  const flow = def.flow!;
  const s: StateParams = Object.fromEntries(stateKeys(def).map((k) => [k, null]));
  return { ...s, ...step.state, ...variant?.state, [flow.param]: step.id === flow.steps[0].id ? null : step.id, [HOLD_PARAM]: step.auto ? '1' : null };
}

/** The same state as a query, for a preview (Flow view thumbnail). */
export function stepQuery(def: PageDef, step: FlowStep, variant?: { state: Params }): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(stepState(def, step, variant))) if (v != null) q.set(k, v);
  q.set(HOLD_PARAM, '1');
  return q;
}

/** Whether a query shows this variant of the step (all its params match). */
export function isVariant(search: URLSearchParams, variant: { state: Params }): boolean {
  return Object.entries(variant.state).every(([k, v]) => search.get(k) === v);
}

export interface FlowTransition {
  from: string;
  /** None: leaves the flow. */
  to?: string;
  label: string;
  when?: string;
  auto?: boolean;
}

/** Every transition of a flow: actions (`next`), loaders (`auto`), else on to the following step. */
export function flowTransitions(flow: FlowDef): FlowTransition[] {
  return flow.steps.flatMap((s, i): FlowTransition[] => {
    if (s.auto) return [{ from: s.id, to: s.auto.to, label: `${(s.auto.ms / 1000).toFixed(1)} s`, auto: true }];
    if (s.next) return s.next.map((n) => ({ from: s.id, ...n }));
    const after = flow.steps[i + 1];
    return [{ from: s.id, to: after?.id, label: after ? t('Next') : t('Done') }];
  });
}
