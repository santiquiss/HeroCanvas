// The screen's regions: where each layer of the app lives, from the layout. One place decides it; DeviceScreen places
// its layers by these boxes, and list–detail pages split (or not) by the width of the region they open in (not the
// screen's).
//
//   app      the app's area: the whole screen. Base, pushes and covers live and animate inside it (it clips them).
//   base     the base tab page (right of the rail; narrower beside the split panel).
//   pushes   pages pushed over the base: the split panel on the right (tablet split), else over the base's area.
//   covers   full pages over everything in the app's area (the iPhone Duo right column stays out of them).
//   panel    the app's side panel (appConfig.sidePanel) where the screen splits, fixed on the right; the app keeps
//            the left part, rail included.
//
// With the navigation over the pages (layout.navOverPages), base and pushes reach under the rail, and they and the
// covers under the iPhone Duo's column; their content stays clear of them (usePadL, usePadR).
import type { Layout } from './layout';

export interface Box {
  left: number;
  width: number;
}

export interface Regions {
  app: Box;
  base: Box;
  /** Where pushed pages go; `inPanel`: the tablet split's right panel (slides in, deeper pages push inside it). */
  pushes: Box & { inPanel: boolean };
  covers: Box;
  panel: Box | null;
}

export function screenRegions(L: Layout, panelOn = false): Regions {
  // Under the nav: the rail's width at the left (base, pushes), the column's at the right (all but the split's).
  const underL = L.navOverPages ? L.railW : 0;
  const underR = L.navOverPages ? L.sideW : 0;
  const base = { left: L.railW - underL, width: L.baseW + underL + (L.dashOpen ? 0 : underR) };
  if (L.split && panelOn) {
    const app = { left: 0, width: L.railW + L.baseW };
    // The base beside the panel stops at it; the panel, at the right edge, reaches under the column.
    const beside = { left: base.left, width: L.railW + L.baseW - base.left };
    return { app, base: beside, pushes: { ...beside, inPanel: false }, covers: app, panel: { left: L.detailLeft, width: L.detailW + underR } };
  }
  return {
    app: { left: 0, width: L.vw },
    base,
    pushes: L.split ? { left: L.detailLeft, width: L.detailW + underR, inPanel: true } : { left: L.railW - underL, width: L.mainW + underL + underR, inPanel: false },
    covers: { left: 0, width: L.vw - L.sideW + underR },
    panel: null,
  };
}
