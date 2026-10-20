// A sheet a page keeps itself (open with the page's own state, as a review step) goes over the whole screen, not inside
// the page's layer: a cover stops at the iPhone Duo's right column and clips what's in it, while a sheet spans the
// screen, as the ones the screen opens (useSim().openSheet) do. The layer sits under those, so a sheet opened from it
// (an item's details) still comes up over it.
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SHEET_ATTR } from './sheetLinks';

/** The screen's layer for page sheets (DeviceScreen); null where there are no overlays (Flow thumbnails). */
export const ScreenLayerCtx = createContext<HTMLElement | null>(null);

/**
 * Renders its children in the screen's sheet layer, or in place where the screen has none. `id`: the sheet's, for a
 * link to open it again (sim/sheetLinks).
 */
export function OnScreen({ id, children }: { id?: string; children: ReactNode }) {
  const layer = useContext(ScreenLayerCtx);
  const content = id ? (
    <div {...{ [SHEET_ATTR]: id }} style={{ display: 'contents' }}>
      {children}
    </div>
  ) : (
    children
  );
  return layer ? createPortal(content, layer) : content;
}
