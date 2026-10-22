import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { SNACKBAR_DURATION, type AlertLevel, type AlertProps, type DialogProps, type SheetLayout, type SheetWidth } from '../kit';
import { DetailPanelCtx, PageScope, RightEdgeCtx, SplitCtx } from '../nav/context';
import type { DropDownAlign } from './DropDownLayer';
import type { Layout } from './layout';
import { tappedControl, type SheetKind, type SheetPresentation } from './sheetPresentation';
import type { StateParams } from '../nav/types';
import { LANG_PARAM, LanguageCtx, languageIn, type Language } from './language';
import { t } from '../i18n/ui';

/** What a sheet built on the kit's Sheet (ActionSheet…) needs from the layer. */
export interface SheetFrame {
  open: boolean;
  onClose: () => void;
  bottomInset: number;
  topInset: number;
}

/**
 * A sheet opened from a page: content in a plain Sheet (`layout`, `content`, which gets a `close`), or a whole
 * sheet component via `render` (it receives open / onClose / insets, so it animates out like any Sheet).
 * How it shows is sim/sheetPresentation's: a sheet, or on large screens a drop-down or a popover hanging from its
 * `anchor`, or a dialog; `content` is told which.
 */
export interface SheetSpec {
  /** Lets the opener tell its own sheet apart (e.g. the nav's + shows × while the plus menu is open). */
  id?: string;
  layout?: SheetLayout;
  width?: SheetWidth;
  showPadding?: boolean;
  /** The panel's background (Sheet `surface`): the page's, for lists and cards (menus and filters), instead of the sheet surface. */
  surface?: 'page';
  /**
   * What it holds (`actions`, `content` or a `task`), which decides what it becomes on large screens
   * (sim/sheetPresentation). Without one it's the sheet at every size.
   */
  kind?: SheetKind;
  /**
   * The control it opens from, for it to hang from on large screens. With a `kind` and no `anchor`, the control the
   * click that opened it was on (`tappedControl`); `null` for none. Other screens showing the same sheet anchor it to
   * their element with `data-sheet-anchor` equal to `id`.
   */
  anchor?: HTMLElement | null;
  content?: ReactNode | ((close: () => void, as: SheetPresentation) => ReactNode);
  /**
   * A whole sheet component instead of `content`: the sheet. With both, `render` is the sheet and `content` what the
   * rule makes of it elsewhere (a picker: a sheet on phones, then a drop-down).
   */
  render?: (frame: SheetFrame) => ReactNode;
  /**
   * Opened from the navigation (the +): where the nav is a column beside the content (the iPhone Duo) it floats on
   * every display, not only from 600pt (sim/layout anchoredFloats).
   */
  fromNav?: boolean;
  dropdownAlign?: DropDownAlign;
  /** As a popover, the side of its control it opens on (Popover `side`); none: by where the control is. */
  popoverSide?: 'left' | 'right' | 'top' | 'bottom';
  /** Runs after the sheet closes (shim, or `close`). */
  onClose?: () => void;
}

/** Why a snackbar went, as the platform's snackbar says it: its time ran out, its action was pressed, or it was hidden. */
export type SnackbarClosedReason = 'timeout' | 'action' | 'hide';

/** A snackbar to show at the bottom of the screen: the kit's Snackbar, as the app shows one. */
export interface SnackbarSpec {
  text: string;
  level?: AlertLevel;
  /** The Alert's action (Retry): pressing it closes the snackbar first. */
  action?: AlertProps['action'];
  /** How long it stays, in ms (the platform's default: 4 s). */
  duration?: number;
  /** Once it's gone, and why. */
  onClosed?: (reason: SnackbarClosedReason) => void;
}

interface Sim {
  layout: Layout;
  theme: 'light' | 'dark';
  toast: (text: string) => void;
  toastText: string | null;
  /** Handler that shows "Out of scope: X". Stops propagation. */
  oos: (label: string) => (e?: { stopPropagation(): void }) => void;
  /** The sheet on top of the device (any content in a Sheet), in memory. */
  sheet: SheetSpec | null;
  openSheet: (s: SheetSpec) => void;
  closeSheet: () => void;
  /** The dialog on top of the device (Dialog), in memory. Actions close it after running their handler. */
  dialog: DialogProps | null;
  openDialog: (d: DialogProps) => void;
  closeDialog: () => void;
  /** The snackbar at the bottom of the device (Snackbar), in memory: one at a time, a new one replaces it. */
  snackbar: SnackbarSpec | null;
  showSnackbar: (s: SnackbarSpec) => void;
  hideSnackbar: () => void;
}

const SimCtx = createContext<Sim | null>(null);

export function useSim(): Sim {
  const s = useContext(SimCtx);
  if (!s) throw new Error('useSim outside <SimProvider>');
  return s;
}

/**
 * The live query string. React Router hands every functional setSearchParams updater the params of the last render,
 * so two sets in one handler (e.g. change the range, then clear the selected point) would drop the first. A replace
 * navigation updates the URL synchronously, so each set starts from what the previous one wrote.
 */
export function liveSearch(): URLSearchParams {
  const h = window.location.hash;
  const q = h.indexOf('?');
  return new URLSearchParams(q < 0 ? '' : h.slice(q + 1));
}

/**
 * A fixed query the screens below read instead of the URL, and can't write: a Flow view thumbnail showing one step of
 * a flow (or any state) without touching the live screen.
 */
const UrlOverrideCtx = createContext<URLSearchParams | null>(null);
export const UrlOverride = UrlOverrideCtx.Provider;

/**
 * A piece of screen state stored in the URL query (replace, no history entry),
 * so any state can be shared in a design review. Declare the key in the page's
 * `state` (nav/pages.tsx) so it survives navigation while the page stays open.
 */
export function useUrlState<T extends string>(key: string, fallback: T): [T, (v: T | null) => void] {
  const [search] = useSearchParams();
  const fixed = useContext(UrlOverrideCtx);
  const value = ((fixed ?? search).get(key) as T | null) ?? fallback;
  const patch = useUrlPatch();
  const set = useCallback((v: T | null) => patch({ [key]: v == null || v === fallback ? null : v }), [key, fallback, patch]);
  return [value, set];
}

/** Reads URL params (or the preview's fixed query), for reading several at once. */
export function useUrlParams(): (key: string) => string | null {
  const [search] = useSearchParams();
  const fixed = useContext(UrlOverrideCtx);
  const q = fixed ?? search;
  return useCallback((key: string) => q.get(key), [q]);
}

/** Writes several URL params at once (`null` deletes one): one navigation, so none undoes another. */
export function useUrlPatch(): (patch: StateParams) => void {
  const [, setSearch] = useSearchParams();
  const fixed = useContext(UrlOverrideCtx);
  return useCallback(
    (patch: StateParams) => {
      if (fixed) return;
      const next = liveSearch();
      for (const [k, v] of Object.entries(patch)) {
        if (v == null) next.delete(k);
        else next.set(k, v);
      }
      setSearch(next, { replace: true });
    },
    [fixed, setSearch],
  );
}

/** Numeric variant of useUrlState. `null` clears the param. */
export function useUrlNumber(key: string, fallback: number | null): [number | null, (v: number | null) => void] {
  const [raw, setRaw] = useUrlState<string>(key, fallback == null ? '' : String(fallback));
  const n = raw === '' ? null : Number(raw);
  const set = useCallback((v: number | null) => setRaw(v == null ? '' : String(v)), [setRaw]);
  return [n == null || Number.isNaN(n) ? fallback : n, set];
}

type Store = Record<string, unknown>;
const StoreCtx = createContext<{ store: Store; set: (key: string, v: unknown) => void } | null>(null);

/**
 * useState that every screen on the canvas shares (device sets, All devices): a swipe, a toggle, a typed value on one
 * screen shows on all. For interactive UI state that doesn't belong in the URL (useUrlState is shared too, and
 * survives reloads). `key` names it within its page: the same component on the same page of every screen shares it.
 */
export function useSharedState<T>(
  key: string,
  initial: T | (() => T),
  opts: { app?: boolean; page?: { index: number; id: string } } = {},
): [T, (v: T | ((prev: T) => T)) => void] {
  const ctx = useContext(StoreCtx);
  const scope = useContext(PageScope);
  // `app`: one value for the whole app (pages share it), not one per page. `page`: another page's value (a page
  // pushed on a list fills the list's selection).
  const page = opts.page ?? (scope ? { index: scope.index, id: scope.ref.id } : null);
  const full = page && !opts.app ? `${page.index}:${page.id}:${key}` : `app:${key}`;
  // Outside the simulator (component gallery, stories) it's a plain useState.
  const [local, setLocal] = useState(initial);
  const value = ctx && full in ctx.store ? (ctx.store[full] as T) : local;
  const setShared = ctx?.set;
  const valueRef = useRef(value);
  valueRef.current = value;
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const next = typeof v === 'function' ? (v as (prev: T) => T)(valueRef.current) : v;
      valueRef.current = next;
      if (setShared) setShared(full, next);
      else setLocal(() => next);
    },
    // Stable while the key is: effects can depend on it.
    [setShared, full],
  );
  return [value, set];
}

/** What every screen on the canvas shares: overlays (sheet, dialog, snackbar) and toasts. */
type Shared = Omit<Sim, 'layout' | 'theme'>;
const SharedCtx = createContext<Shared | null>(null);

/**
 * Shares overlay state between the screens inside it (a device set, All devices): opening the + menu, a dialog or a
 * toast on one shows it on all, as navigation already is (it lives in the URL). Without it each SimProvider keeps its
 * own (Flow thumbnails). `fixed`: screens that always show the same page (where-used thumbnails), so the app's
 * navigation doesn't close what they opened.
 */
export function SharedSimProvider({ children, fixed = false }: { children: ReactNode; fixed?: boolean }) {
  const [toastText, setToastText] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogProps | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  // Every action closes the dialog after its handler.
  const openDialog = useCallback((d: DialogProps) => {
    const close = (fn?: () => void) => () => {
      setDialog(null);
      fn?.();
    };
    setDialog({
      ...d,
      onPrimaryButtonPressed: close(d.onPrimaryButtonPressed),
      onSecondaryButtonPressed: close(d.onSecondaryButtonPressed),
      onTertiaryButtonPressed: close(d.onTertiaryButtonPressed),
      onCloseButtonPressed: close(d.onCloseButtonPressed),
    });
  }, []);
  const [snackbar, setSnackbar] = useState<SnackbarSpec | null>(null);
  const snackbarRef = useRef<SnackbarSpec | null>(null);
  const snackbarTimer = useRef<number | undefined>(undefined);
  const closeSnackbar = useCallback((reason: SnackbarClosedReason) => {
    const s = snackbarRef.current;
    if (!s) return;
    snackbarRef.current = null;
    window.clearTimeout(snackbarTimer.current);
    setSnackbar(null);
    s.onClosed?.(reason);
  }, []);
  // Platforms queue snackbars; the app shows one at a time, so a new one takes the place of the one showing.
  const showSnackbar = useCallback(
    (spec: SnackbarSpec) => {
      closeSnackbar('hide');
      const action = spec.action;
      const s: SnackbarSpec = action ? { ...spec, action: { ...action, onPressed: () => (closeSnackbar('action'), action.onPressed()) } } : spec;
      snackbarRef.current = s;
      setSnackbar(s);
      snackbarTimer.current = window.setTimeout(() => closeSnackbar('timeout'), spec.duration ?? SNACKBAR_DURATION);
    },
    [closeSnackbar],
  );
  const hideSnackbar = useCallback(() => closeSnackbar('hide'), [closeSnackbar]);
  useEffect(() => () => window.clearTimeout(snackbarTimer.current), []);
  const [sheet, setSheetSpec] = useState<SheetSpec | null>(null);
  const sheetRef = useRef<SheetSpec | null>(null);
  const openSheet = useCallback((spec: SheetSpec) => {
    // Read now, while the click that opened it is being handled.
    const s = spec.kind && spec.anchor === undefined ? { ...spec, anchor: tappedControl() } : spec;
    sheetRef.current = s;
    setSheetSpec(s);
  }, []);
  const closeSheet = useCallback(() => {
    const s = sheetRef.current;
    // Every screen's shim or close calls this; only the first one closes (and runs onClose once).
    if (!s) return;
    sheetRef.current = null;
    setSheetSpec(null);
    s.onClose?.();
  }, []);
  // A sheet belongs to the page that opened it: going to another page closes it.
  const { pathname } = useLocation();
  useEffect(() => {
    if (!fixed) closeSheet();
  }, [pathname, closeSheet, fixed]);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setToastText(text);
    timer.current = window.setTimeout(() => setToastText(null), 2000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const oos = useCallback(
    (label: string) => (e?: { stopPropagation(): void }) => {
      e?.stopPropagation();
      toast(t('Out of scope: {label}', { label }));
    },
    [toast],
  );

  const value = useMemo(
    () => ({ toast, toastText, oos, sheet, openSheet, closeSheet, dialog, openDialog, closeDialog, snackbar, showSnackbar, hideSnackbar }),
    [toast, toastText, oos, sheet, openSheet, closeSheet, dialog, openDialog, closeDialog, snackbar, showSnackbar, hideSnackbar],
  );
  const [store, setStore] = useState<Store>({});
  const setKey = useCallback((key: string, v: unknown) => setStore((s) => (Object.is(s[key], v) ? s : { ...s, [key]: v })), []);
  const storeValue = useMemo(() => ({ store, set: setKey }), [store, setKey]);
  return (
    <SharedCtx.Provider value={value}>
      <StoreCtx.Provider value={storeValue}>{children}</StoreCtx.Provider>
    </SharedCtx.Provider>
  );
}

/**
 * One screen's sim: its layout, theme and language (the device's, `?lang=`, unless it has its own), over the shared
 * state (its own when there's no SharedSimProvider above).
 */
export function SimProvider({ layout, theme, language, children }: { layout: Layout; theme: 'light' | 'dark'; language?: Language; children: ReactNode }) {
  const shared = useContext(SharedCtx);
  const get = useUrlParams();
  const lang = language ?? languageIn(get(LANG_PARAM));
  if (!shared)
    return (
      <SharedSimProvider>
        <SimProvider layout={layout} theme={theme} language={lang}>
          {children}
        </SimProvider>
      </SharedSimProvider>
    );
  return (
    <ScreenSim layout={layout} theme={theme} shared={shared}>
      <LanguageCtx.Provider value={lang}>{children}</LanguageCtx.Provider>
    </ScreenSim>
  );
}

function ScreenSim({ layout, theme, shared, children }: { layout: Layout; theme: 'light' | 'dark'; shared: Shared; children: ReactNode }) {
  const value = useMemo(() => ({ ...shared, layout, theme }), [shared, layout, theme]);
  return <SimCtx.Provider value={value}>{children}</SimCtx.Provider>;
}

/**
 * Right padding of a page's content: 0 against the iPhone Duo right column, half the column gap beside another pane
 * (the list pane of a list–detail page, the base page with the tablet split panel open), `layout.edgePadR` otherwise
 * (padX, unless a design widens it in two columns).
 */
export function usePadR(): number {
  const { layout } = useSim();
  const atRight = useContext(RightEdgeCtx);
  const split = useContext(SplitCtx);
  const inPanel = useContext(DetailPanelCtx);
  if (layout.sideNav && atRight) return 0;
  if (split?.role === 'master' || (!atRight && !inPanel && layout.dashOpen)) return layout.columnGap / 2;
  // At the screen's right edge: the layout's edge padding (padX, or a design's matching its left gap in two columns).
  return layout.edgePadR;
}

/**
 * Left padding of a page's content: half the column gap beside another pane (the detail pane of a list–detail page,
 * the tablet split panel), else padX.
 */
export function usePadL(): number {
  const { layout } = useSim();
  const split = useContext(SplitCtx);
  const inPanel = useContext(DetailPanelCtx);
  return split?.role === 'detail' || inPanel ? layout.columnGap / 2 : layout.padX;
}

/**
 * Right inset for a header row: the reserved corner width (iPhone Duo inner portrait) when the page reaches the
 * screen's right edge, else 0. Use it for controls on the right of a header.
 */
export function useHeaderInset(): number {
  const { layout } = useSim();
  const atRight = useContext(RightEdgeCtx);
  return atRight ? layout.headerInsetR : 0;
}
