// Pure layout math, ported from the reference `renderVals()`.
// Screens read these metrics; they never look at device specifics directly.

import type { Corner, DeviceOS, Display, Edge, NavPlacement } from '../devices/devices';

export interface LayoutInput {
  display: Display;
  /** User pressed "rotate". */
  land: boolean;
  /** This device:display supports landscape (else the frame rotates, app stays portrait). */
  supported: boolean;
  /** The split's right part is in use: a push page over a tab, or a side panel (nav/stack detailOpenFor). */
  detailOpen: boolean;
  /** The video layout, where the display offers it (portrait): a 16:9 area on top, the app below. */
  video?: boolean;
  /** The design's rail width (a proposal's, design/overridableRegistry designLayout); none: Live's RAIL_W. */
  railWidth?: number;
  /** The design's room between the rail and the left column of two (a proposal's); none: padX. */
  splitGap?: number;
  /** The design's rail shows the user (a proposal's sidebar, its account at the foot). */
  userInRail?: boolean;
  /** The app has only a phone layout (ScreenLayout.compactOnly): wide screens draw it too. */
  compactOnly?: boolean;
  /** The height of the app's bar at the bottom (ScreenLayout.tabBarHeight); none: the tour's. */
  tabBarHeight?: number;
}

/** The tablet rail's width in Live (NavigationRail: its column of 48 and the room around it). */
export const RAIL_W = 72;

export interface Layout {
  os: DeviceOS;
  vw: number;
  vh: number;
  land: boolean;
  rotLocked: boolean;
  phoneLand: boolean;
  isTablet: boolean;
  isPhone: boolean;
  /**
   * iOS's horizontal size class (SwiftUI's `horizontalSizeClass`, UIKit's trait), for a screen that lays out by it:
   * `regular` on a tablet and on a big phone turned (a Max, a Plus: 900 wide or more), `compact` otherwise. Android's
   * window size classes go by width: `vw` (compact under 600, medium under 840, expanded from 840).
   */
  horizontalSizeClass: 'compact' | 'regular';
  /** Where navigation goes in this orientation (display `nav`, else bottom below 600px and rail from 600). */
  nav: NavPlacement;
  /** `nav === 'bottom'`: tab bar + floating search. */
  bottomNav: boolean;
  /** `nav === 'column'`: vertical controls in the right column (`sideW` wide), status at its top. */
  sideNav: boolean;
  /** Always-visible camera (display `camera`), turned with the display. Drawn in the right column. */
  camera: { y: 'top' | 'bottom'; x: 'left' | 'right'; size: number; inset: number } | null;
  /** Top of the vertical corner status in the right column (below the camera when it's at the top). */
  statusTop: number;
  /** Bottom of the column's nav (above the camera when it's at the bottom). */
  columnNavBottom: number;
  /** Corner status: vertical in the right column, horizontal in the top-right corner, or none. */
  cornerStatus: 'vertical' | 'horizontal' | null;
  /**
   * Area the system keeps in the top-right corner (the horizontal corner status). Like iOS 27.1
   * reserved regions: content may go under it, but header controls in that row must avoid it.
   */
  reserved: Box | null;
  /** Right inset for header rows of pages that reach the right edge (0 when nothing is reserved). */
  headerInsetR: number;
  sideW: number;
  /** Status bar height. */
  sbH: number;
  /** Bottom inset (home indicator area). */
  botIn: number;
  /** Left safe area (phone landscape camera). */
  safeL: number;
  /** Left nav rail width (tablets). */
  railW: number;
  /** The rail shows the user (a sidebar's account): a screen's own way to them (a home page's avatar) leaves. */
  userInRail: boolean;
  mainW: number;
  /** 50/50 master-detail (tablets with 720 next to the rail, portrait or landscape). */
  split: boolean;
  /** Split and a detail is showing in the right panel. */
  dashOpen: boolean;
  detailW: number;
  detailLeft: number;
  baseW: number;
  padT: number;
  /**
   * Vertical center of a page's top header row (a 48px calendar header, a pushed page's 40px app bar), so
   * every page's header buttons line up: 40 beside the iPhone Duo column, centered on the reserved corner status, else
   * 28 below the status bar.
   */
  headerY: number;
  tabPadB: number;
  /** Bottom padding for a tab's scroll view. */
  padB: number;
  /** Bottom padding for pushed screens. */
  padBPush: number;
  /** Side padding of page content (display `padX`, default 16). */
  padX: number;
  /** Space between side-by-side panes (display `columnGap`, default COLUMN_GAP). */
  columnGap: number;
  basePadL: number;
  /** Right padding of the pane against the screen's right edge (the split panel: as far as the left column from the rail). */
  edgePadR: number;
  basePadR: number;
  contentW: number;
  /** Grid columns — breakpoints S <529, M 529–719, L ≥720. */
  cols: 2 | 3 | 4;
  showRail: boolean;
  /** Bottom offset for toasts, above the nav. */
  toastBottom: number;
  // Frame
  bez: number;
  /** The bezel across (left and right) and along (top and bottom) the frame as shown: `ends` goes on the short edges. */
  bezX: number;
  bezY: number;
  /** The display's `ends` (0 for none): where the frame draws its earpiece and Home button. */
  ends: number;
  /** The body's thickness (display `depth`), drawn when Capture turns the device in 3D; 0 for the device in hand. */
  depth: number;
  /** Video layout: the 16:9 area above the app (0 otherwise). vw × vh is the app's area below it. */
  videoH: number;
  /** Video layout: where the display's corner status sits over the video (as `reserved` would place it). */
  videoStatus: Box | null;
  /** The whole screen's corners (the app's own are square on top in the video layout). */
  fullRadius: string;
  frameW: number;
  frameH: number;
  screenRadius: string;
  frameRadius: string;
  camRight: boolean;
  /** iPhone: the Dynamic Island, a notch, or nothing at the top (display `cutout`). */
  cutout: 'island' | 'notch' | 'none';
  /** The Dynamic Island's width (display `islandW`; 124, the 17 Pro's). */
  islandW: number;
  /** A Home button below the screen (display `homeButton`): no home indicator. */
  homeButton: boolean;
  /** The screen alone, no device around it (Capture's Screen only): no bezel, square corners, no camera cutouts. */
  bare?: boolean;
  /** The device in hand (display `real`): the system draws its own status, home indicator, camera and keyboard. */
  real: boolean;
}

const SB_H: Record<DeviceOS, number> = { ios: 54, android: 48, ipad: 24 };
const BOT_IN: Record<DeviceOS, number> = { ios: 34, android: 24, ipad: 20 };
const COLUMN_W = 86;
/** Space between side-by-side panes (list–detail, the split panel, a side panel), unless the display sets `columnGap`. */
export const COLUMN_GAP = 24;

/** Corner status sizes (the images in SystemChrome): vertical in the column, horizontal in the corner. */
export const CORNER_STATUS = { vertical: { w: 48, h: 86 }, horizontal: { w: 104, h: 48 } } as const;

/**
 * How far below the screen's top a sheet as tall as it gets stops: 10 under the status bar (the app's sheets), or 8
 * under a corner status (the iPhone Duo: in the right column, or the top-right corner), so a sheet across the screen
 * never covers the time and the signal. What doesn't fit scrolls in the sheet.
 */
/** An anchored sheet floats from this wide (the compact width class ends at 600). */
export const POPOVER_MIN_W = 600;

/**
 * Whether an anchored sheet floats from its anchor (a + menu's popover, a drop-down) instead of rising as a
 * sheet: 600pt wide or more, as apps float their menus on every size class but compact. Opened
 * from the navigation (`fromNav`: the +), also on every iPhone Duo display: there the nav is a column beside the
 * content, and a sheet from the bottom edge would rise far from it; a menu opened from the content follows the width
 * alone (the Duo's outer display, 466, is compact).
 */
export function anchoredFloats(L: Pick<Layout, 'vw' | 'sideNav'>, fromNav = false): boolean {
  return L.vw >= POPOVER_MIN_W || (fromNav && L.sideNav);
}

export function tallSheetTop(L: Pick<Layout, 'sbH' | 'cornerStatus' | 'statusTop' | 'reserved'>): number {
  if (L.cornerStatus === 'vertical') return L.statusTop + CORNER_STATUS.vertical.h + 8;
  if (L.reserved) return L.reserved.top + L.reserved.height + 8;
  return L.sbH + 10;
}

/** Bottom chrome: the phone tab bar, a floating search or input bar, and the space between them. */
/** A page's content column at most (a chat, a wide sheet, an editor): the wide sheet's width. */
export const CONTENT_MAX_W = 640;

export const TAB_BAR_H = 62;
export const SEARCH_BAR_H = 56;
const BAR_GAP = 12;
/**
 * Whether the app's nav (tab bar, column) stays while a task covers the tab you were on (a chat, a search): on
 * tablet-size screens (the iPhone Duo's inner display, a foldable's inner one, a split) it's a part of the app, as
 * beside the rail; only on phones is it a task of its own, the nav hidden.
 */
export const tasksKeepNav = (L: { isTablet: boolean }) => L.isTablet;

/** What the phone tab bar takes above the bottom inset, with the gap to the search (or a chat's input) over it. */
export const TAB_BAR_ROOM = TAB_BAR_H + BAR_GAP;
/** The header row (back button, title, actions) where there's no status strip: 24 from the top, 40 tall. */
const HEADER_TOP = 24;
const HEADER_ROW_H = 40;

interface Box {
  top: number;
  right: number;
  width: number;
  height: number;
}

/** The horizontal corner status: top right, vertically centered on the header row. */
function cornerStatusBox(padX: number): Box {
  const cs = CORNER_STATUS.horizontal;
  return { top: HEADER_TOP + (HEADER_ROW_H - cs.h) / 2, right: padX, width: cs.w, height: cs.h };
}

/** Landscape turns the display clockwise: what was on the left ends up on top. */
const CW_EDGE: Record<Edge, Edge> = { left: 'top', top: 'right', right: 'bottom', bottom: 'left' };
const CW_CORNER: Record<Corner, Corner> = { tl: 'tr', tr: 'br', br: 'bl', bl: 'tl' };
const EDGE_CORNERS: Record<Edge, Corner[]> = { top: ['tl', 'tr'], right: ['tr', 'br'], bottom: ['br', 'bl'], left: ['bl', 'tl'] };

/** CSS border-radius (tl tr br bl): `r`, except the two corners on the hinge edge. */
function radius(r: number, hinge: { edge: Edge; r: number } | null, add = 0): string {
  if (!hinge) return `${r + add}px`;
  const small = EDGE_CORNERS[hinge.edge];
  return (['tl', 'tr', 'br', 'bl'] as Corner[]).map((c) => `${(small.includes(c) ? hinge.r : r) + add}px`).join(' ');
}

/** The Dynamic Island's usual width (iPhone 17 Pro). */
export const ISLAND_W = 124;
/** The notch's width (iPhone 16e): 162×34 hanging from the top edge. */
export const NOTCH_W = 162;

export function computeLayout({ display: full, land: wantLand, supported, detailOpen, video = false, railWidth = RAIL_W, splitGap, userInRail = false, compactOnly = false, tabBarHeight }: LayoutInput): Layout {
  const land = wantLand && supported;
  const rotLocked = wantLand && !supported;
  // Video layout: a 16:9 area across the top of the screen; the app lays out in the rest, as a display of its own
  // with no status strip or corner status (the status shows over the video).
  const videoH = video && full.videoSplit && !land && !rotLocked ? Math.round((full.w * 9) / 16) : 0;
  const dev: Display = videoH ? { ...full, h: full.h - videoH, cornerStatus: false } : full;
  const vw = land ? dev.h : dev.w;
  const vh = land ? dev.w : dev.h;
  // An app with only a phone layout (compactOnly) draws it on a tablet too: the bar at the bottom, one column.
  const isTablet = vw >= 600 && !dev.compact && !compactOnly;
  const isPhone = !isTablet;
  const nav: NavPlacement = compactOnly && vw >= 600 ? 'bottom' : ((land ? dev.nav?.landscape : dev.nav?.portrait) ?? (vw >= 600 ? 'rail' : 'bottom'));
  const bottomNav = nav === 'bottom';
  const sideNav = nav === 'column';
  // A phone turned sideways (camera on the left, no status bar), unless its controls go to the column.
  const phoneLand = land && dev.w < 600 && !sideNav;
  const sideW = sideNav ? (dev.columnW ?? COLUMN_W) : 0;

  const hinge = dev.hinge ? { ...dev.hinge, edge: land ? CW_EDGE[dev.hinge.edge] : dev.hinge.edge } : null;
  const camCorner = dev.camera && (land ? CW_CORNER[dev.camera.corner] : dev.camera.corner);
  const camera = dev.camera && camCorner
    ? { y: camCorner[0] === 't' ? ('top' as const) : ('bottom' as const), x: camCorner[1] === 'l' ? ('left' as const) : ('right' as const), size: dev.camera.size, inset: dev.camera.inset }
    : null;
  const camEnd = camera ? camera.inset + camera.size : 0;
  // Right column, top to bottom (HIG): camera (if it's at the top), status … nav (above the camera if it's at the bottom).
  const statusTop = camera?.y === 'top' ? camEnd + 8 : 20;
  const columnNavBottom = camera?.y === 'bottom' ? camEnd + 12 : 25;

  const padX = dev.padX ?? 16;
  const columnGap = dev.columnGap ?? COLUMN_GAP;
  // Bars vertical → status in the column; horizontal → status in the top-right corner, with no status strip. The
  // app's header shares that row, to its left, vertically centered with it (as Messages does on iPhone Duo).
  const cornerStatus = dev.cornerStatus ? (sideNav ? 'vertical' : 'horizontal') : null;
  const reserved = cornerStatus === 'horizontal' ? cornerStatusBox(padX) : null;
  const headerInsetR = reserved ? reserved.right + reserved.width + 8 : 0;
  // A display that reports its safe area (the device in hand) gives the insets as they are, turned or not.
  // A Home button keeps nothing clear at the bottom, nor on the side in landscape (no camera cuts into the screen).
  const sbH = sideNav || reserved || videoH ? 0 : dev.safe ? dev.safe.top : phoneLand ? 0 : (dev.statusH ?? SB_H[dev.os]);
  const botIn = sideNav ? (dev.columnSafeBottom ?? 0) : dev.safe ? dev.safe.bottom : dev.homeButton ? 0 : phoneLand ? 21 : BOT_IN[dev.os];
  const safeL = phoneLand ? (dev.safe ? dev.safe.left : dev.homeButton ? 0 : 44) : 0;
  const showRail = nav === 'rail';
  const railW = showRail ? railWidth + safeL : 0;
  const mainW = vw - railW - sideW;
  // Master–detail when there's room for two columns, in either orientation (a tablet in portrait too: an iPad 11"
  // has 762 next to the rail; an iPad mini's 672 stays one column).
  const split = isTablet && mainW >= 720;
  const dashOpen = split && detailOpen;
  const detailW = split ? (dev.detailW ?? Math.round(mainW / 2)) : vw;
  const detailLeft = split ? railW + mainW - detailW : railW;
  const baseW = dashOpen ? mainW - detailW : mainW;
  const padT = sideNav || reserved ? HEADER_TOP : sbH + (isTablet ? 16 : 8);
  // The search pill's bottom; beside a nav column it lines up with the column's buttons, not with the safe area.
  const tabPadB = sideNav ? 24 : Math.max(24, botIn);
  // Clears the bottom chrome of the tab pages (a home, a list): the search pill, plus the tab bar on phones.
  // An app that gives its bar's height (tabBarHeight): the bar over the bottom inset; else the tour's search pill and bar.
  const chromeTop = tabBarHeight != null ? botIn + (bottomNav ? tabBarHeight : 0) : tabPadB + SEARCH_BAR_H + (bottomNav ? TAB_BAR_ROOM : 0);
  const padB = chromeTop + 24;
  const padBPush = botIn + 24;
  // Two columns beside the rail: the left one a design's own distance from it (a proposal's splitGap), and the right
  // one as far from the screen's edge, so the two sides match; else padX.
  const splitEdge = dashOpen && showRail && splitGap != null ? splitGap : padX;
  const basePadL = splitEdge;
  const edgePadR = splitEdge;
  // Beside the tablet split panel the base page keeps half the column gap (the panel's pages keep the other half);
  // against the iPhone Duo right column it has none.
  const basePadR = dashOpen ? columnGap / 2 : sideNav ? 0 : padX;
  const contentW = baseW - basePadL - basePadR;
  const cols = contentW >= 720 ? 4 : contentW >= 529 ? 3 : 2;
  // Above the nav: the column's buttons (48) on the iPhone Duo, the bottom chrome on phones.
  const toastBottom = sideNav ? columnNavBottom + 48 + 16 : bottomNav ? chromeTop + 16 : botIn + 24;

  const bez = dev.bez;
  // The short edges are top and bottom in portrait, left and right turned (a turned-locked frame is portrait, rotated).
  const ends = dev.real ? 0 : (dev.ends ?? 0);
  const bezX = bez + (land ? ends : 0);
  const bezY = bez + (land ? 0 : ends);
  return {
    os: dev.os,
    vw,
    vh,
    land,
    rotLocked,
    phoneLand,
    isTablet,
    isPhone,
    horizontalSizeClass: isTablet || vw >= 900 ? 'regular' : 'compact',
    nav,
    bottomNav,
    sideNav,
    camera,
    statusTop,
    columnNavBottom,
    cornerStatus,
    reserved,
    headerInsetR,
    sideW,
    sbH,
    botIn,
    safeL,
    railW,
    userInRail: showRail && userInRail,
    mainW,
    split,
    dashOpen,
    detailW,
    detailLeft,
    baseW,
    padT,
    headerY: sideNav ? 40 : reserved ? padT + HEADER_ROW_H / 2 : sbH + 28,
    tabPadB,
    padB,
    padBPush,
    padX,
    columnGap,
    basePadL,
    edgePadR,
    basePadR,
    contentW,
    cols,
    showRail,
    toastBottom,
    bez,
    depth: dev.real ? 0 : (dev.depth ?? (Math.min(dev.w, dev.h) >= 600 ? 28 : 50)),
    bezX,
    bezY,
    ends,
    videoH,
    videoStatus: videoH && full.cornerStatus ? cornerStatusBox(padX) : null,
    frameW: vw + bezX * 2,
    frameH: vh + videoH + bezY * 2,
    // The app's area: square on top under the video.
    screenRadius: videoH ? `0 0 ${dev.r}px ${dev.r}px` : radius(dev.r, hinge),
    fullRadius: radius(dev.r, hinge),
    frameRadius: dev.bodyR != null ? `${dev.bodyR}px` : radius(dev.r, hinge, bez),
    camRight: !!dev.camRight,
    cutout: dev.cutout ?? 'island',
    islandW: dev.islandW ?? ISLAND_W,
    homeButton: !!dev.homeButton,
    real: !!dev.real,
  };
}

/**
 * With the phone's bottom navigation (phones, foldables in portrait), list–detail needs at least this width —
 * Material's "expanded" class. Today no foldable reaches it in portrait, so they stack; a much wider one would split.
 */
export const LIST_DETAIL_BOTTOM_NAV_MIN = 840;

/** Whether a list–detail page of `width` px opens children beside it (vs stacking). */
export function listDetailActive(layout: Layout, width: number, minWidth: number): boolean {
  return !layout.isPhone && width >= minWidth && (!layout.bottomNav || width >= LIST_DETAIL_BOTTOM_NAV_MIN);
}

/** Phone-style navigation: pushed pages slide over the previous one, which shifts back 25% (bottom-nav layouts). */
export const phoneMotion = (layout: Layout) => layout.isPhone || layout.bottomNav;

/** Scale that fits the (possibly rotated) frame into the stage with a 24px margin. */
export function fitScale(layout: Layout, availW: number, availH: number): number {
  const bb = layout.rotLocked ? { w: layout.frameH, h: layout.frameW } : { w: layout.frameW, h: layout.frameH };
  return Math.max(0.1, Math.min(1, (availW - 48) / bb.w, (availH - 48) / bb.h));
}

/**
 * The same screen without its device (Capture's Screen only): the app lays out as it does on the device, but the
 * frame is the screen itself, square, with no bezel, forehead or chin, and no camera cut into it.
 */
export function screenOnly(L: Layout): Layout {
  return {
    ...L,
    bare: true,
    bez: 0,
    bezX: 0,
    bezY: 0,
    ends: 0,
    depth: 0,
    frameW: L.vw,
    frameH: L.vh + L.videoH,
    screenRadius: '0px',
    fullRadius: '0px',
    frameRadius: '0px',
  };
}
