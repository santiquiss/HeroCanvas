// What overridable components need from outside, in a module with no imports (so it's there before anything uses it):
// the Live components a proposal can replace, registered as their modules load, and the proposals' lookup, which the
// proposals registry (proposals/index) plugs in when it loads. Not imported by overridable.tsx directly: the proposals
// load the Live pages, whose screens load the components that are overridable — a cycle that, depending on what loads
// first, reads the pages or this registry before they exist.
import type { Proposal, ProposalLayout } from '../proposals/types';

export const LIVE = new Set<string>();

/** The URL param of a proposal's version (`?variant=b`). Here so overridable.tsx reads it without the proposals. */
export const VARIANT_PARAM = 'variant';

export const PROPOSAL_LOOKUP: {
  find: (id: string | null | undefined) => Proposal | null;
  components: (p: Proposal, variant: string | null) => Proposal['components'];
  layout: (p: Proposal, variant: string | null) => ProposalLayout;
} = { find: () => null, components: () => ({}), layout: () => ({}) };

/** The app's own layout (`appConfig.layout`, or the tour's): set by nav/pages as it loads, under any proposal's. */
export const LIVE_LAYOUT: { current: ProposalLayout } = { current: {} };

/** The URL param of a rail that folds (`?rail=folded`): the app's state, as the user left it. */
export const RAIL_PARAM = 'rail';
export const railFoldedIn = (search: URLSearchParams) => search.get(RAIL_PARAM) === 'folded';

/**
 * The layout a design asks for (Live, or a proposal's version): what computeLayout takes from it. `folded`: its rail
 * folded, for a design whose rail folds (`railFoldedWidth`).
 */
export function designLayout(proposal: string | null | undefined, variant: string | null | undefined, folded = false): ProposalLayout {
  const p = PROPOSAL_LOOKUP.find(proposal);
  const layout = { ...LIVE_LAYOUT.current, ...(p ? PROPOSAL_LOOKUP.layout(p, variant ?? null) : {}) };
  return folded && layout.railFoldedWidth != null ? { ...layout, railWidth: layout.railFoldedWidth } : layout;
}
