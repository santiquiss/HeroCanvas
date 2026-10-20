// Components a proposal can replace on every screen (its pages.tsx `components`), without copying the screens that
// use them: export the component wrapped, `export const ListTile = overridable('ListTile', ListTileLive)`. With the proposal active,
// the replacement (of its active version, `?variant=`) renders with the same props; otherwise the live one. Reads the
// proposal from the URL (or a Flow thumbnail's fixed query), unless the screen overrides it (DesignOverride).
import { createContext, useContext, type ComponentType } from 'react';
// The proposals are looked up through the registry (proposals/index plugs them in), not imported: see there.
import { LIVE, PROPOSAL_LOOKUP, VARIANT_PARAM } from './overridableRegistry';
import type { Proposal } from '../proposals/types';
import { useUrlParams } from '../sim/SimContext';

/** What a screen shows instead of the toolbar's design: Live (proposal null), or a proposal and its version. */
export interface DesignChoice {
  proposal: string | null;
  variant: string | null;
}

/** A screen showing another design than the toolbar's (a device on the canvas set to Live, or a proposal's version). */
export const DesignOverride = createContext<DesignChoice | null>(null);

/** The proposal and version this screen shows: its device's override, else the toolbar's (the URL). */
export function useScreenDesign(): { proposal: Proposal | null; variant: string | null } {
  const get = useUrlParams();
  const own = useContext(DesignOverride);
  return { proposal: PROPOSAL_LOOKUP.find(own ? own.proposal : get('proposal')), variant: own ? own.variant : get(VARIANT_PARAM) };
}

export const isOverridable = (name: string) => LIVE.has(name);

export function overridable<P extends object>(name: string, Live: ComponentType<P>): ComponentType<P> {
  LIVE.add(name);
  function Overridable(props: P) {
    const { proposal: p, variant } = useScreenDesign();
    const Replacement = (p && PROPOSAL_LOOKUP.components(p, variant)[name]) as ComponentType<P> | undefined;
    const C = Replacement ?? Live;
    return <C {...props} />;
  }
  Overridable.displayName = name;
  return Overridable;
}
