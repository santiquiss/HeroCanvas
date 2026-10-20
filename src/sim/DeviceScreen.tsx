// The app viewport: theme root, base tab, push layers (or the split panel), covers, overlays and system chrome.
// Every entry of the navigation stack is its own layer, so navigation can go any number of levels deep.
import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DesignOverride } from '../design/overridable';
import { composePages } from '../nav/manifest';
import { findProposal } from '../proposals';
import { navigation } from '../app';
const { SideNav, SideRail, TabBar } = navigation;
import { Icon } from '../components/Icon';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Dialog, Popover, Sheet, Snackbar, SNACKBAR_MS, sheetMaxWidth, type AnchorRect } from '../kit';
import { Toast } from '../components/Toast';
import { useDesignRoot } from '../design/DesignContext';
import { DetailPanelCtx, PageScope, RightEdgeCtx, SplitCtx, useNavRoot } from '../nav/context';
import { sideColumnFor, splitFor, useScreenConfig, type ScreenConfig } from '../nav/screenConfig';
import type { PageDef, PageRef, SplitConfig } from '../nav/types';
import { ChangesOverlay } from './ChangesOverlay';
import { LocateFlash } from './locate';
import { anchoredFloats, listDetailActive, phoneMotion, tallSheetTop, type Layout } from './layout';
import { EASE, EXIT_MS, PAGE_MS, SWAP, TAB_IN_MS } from './motion';
import { screenRegions } from './regions';
import { DropDownLayer } from './DropDownLayer';
import { useSim, type SheetSpec, type SnackbarSpec } from './SimContext';
import { isTextField, KeyboardInsetCtx, useKeyboardInset } from './keyboard';
import { CornerStatusImage, HomeIndicator, LandscapeCamera, StatusBar } from './SystemChrome';
import { SystemKeyboard } from './SystemKeyboard';
import { useAccessibility } from './scenario';
import { useLanguage } from './language';
import { textSystemOf } from './systemText';
import { systemTextVars } from '../theme/systemTextVars';
import { useRealKeyboard } from './useRealViewport';
import { usePresence } from './usePresence';
import { ScreenLayerCtx } from './screenLayer';
import { SHEET_ATTR } from './sheetLinks';
import { sheetPresentation } from './sheetPresentation';

const T = `transform ${PAGE_MS}ms ${EASE}`;
const SHADOW = '-8px 0 24px rgba(0,0,0,0.12)';
/**
 * The screen's layers, bottom to top: the split panel, pushed pages (beside the tablet rail), the rail (the app's nav: over the pages beside it, so its shadow falls on them), covers (full pages over everything, the rail too),
 * the snackbar (over the pages, under the sheets' and dialogs' routes, as a scaffold has it), dialogs, Inspect.
 */
const Z = { panel: 20, push: 40, rail: 70, cover: 71, snackbar: 85, dialog: 91, inspect: 97 };

interface Entry {
  ref: PageRef;
  /** Index in the navigation stack. */
  index: number;
  /** Master–detail page: its split config and the child shown in the detail pane (stack top, else the default). */
  split?: {
    config: SplitConfig;
    detail: Entry;
    selected: PageRef;
    isDefault: boolean;
  };
}

const entryKey = (e: Entry) => `${e.index}:${e.ref.id}:${JSON.stringify(e.ref.params)}`;

/**
 * Master–detail pages that are wide enough keep the pages above them in their detail pane instead of new layers:
 * the first such page in `entries` absorbs the rest (its pane shows the top one, or its default child).
 */
function foldSplit(entries: Entry[], width: number, cfg: ScreenConfig, def: (id: string) => PageDef, layout: Layout): Entry[] {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const config = splitFor(e.ref.id, def(e.ref.id), cfg);
    if (!config || !listDetailActive(layout, width, config.minWidth)) continue;
    const rest = entries.slice(i + 1);
    const top = rest[rest.length - 1];
    const detail = top ?? { ref: config.defaultChild, index: e.index + 1 };
    // The master highlights the row that was opened (the first page above it), even when deeper pages are shown.
    const selected = rest[0]?.ref ?? config.defaultChild;
    return [...entries.slice(0, i), { ...e, split: { config, detail, selected, isDefault: !top } }];
  }
  return entries;
}

/** Master pane (the page itself) and detail pane side by side. */
function SplitView({ entry }: { entry: Entry }) {
  const { config, detail, selected, isDefault } = entry.split!;
  const scope = {
    masterIndex: entry.index,
    masterId: entry.ref.id,
    selected,
    isDefault,
  };
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* No divider: the panes are separated by their content, as in Apple's split views. */}
      <div
        style={{
          width: config.ratio === 'equal' ? '50%' : config.masterWidth,
          flex: 'none',
          height: '100%',
          position: 'relative',
        }}
      >
        <SplitCtx.Provider value={{ ...scope, role: 'master' }}>
          {/* The list pane never reaches the right edge. */}
          <RightEdgeCtx.Provider value={false}>
            <PageView entry={{ ref: entry.ref, index: entry.index }} />
          </RightEdgeCtx.Provider>
        </SplitCtx.Provider>
      </div>
      <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
        <SplitCtx.Provider value={{ ...scope, role: 'detail' }}>
          <PageView key={entryKey(detail)} entry={detail} />
        </SplitCtx.Provider>
      </div>
    </div>
  );
}

/** A stack entry: a plain page, or a master–detail page. */
function EntryView({ entry }: { entry: Entry }) {
  return entry.split ? <SplitView entry={entry} /> : <PageView entry={entry} />;
}

function PageView({ entry }: { entry: Entry }) {
  const nav = useNavRoot();
  // The page as this screen's design has it: a device set to Live (or another proposal) shows that design's page,
  // while the navigation stays the one the screens share.
  const own = useContext(DesignOverride);
  const def = own ? composePages(findProposal(own.proposal))[entry.ref.id] : nav.def(entry.ref.id);
  if (!def)
    return (
      <div style={{ padding: 24, color: 'var(--text-normal-muted)', fontSize: 15, lineHeight: '22px', textAlign: 'center' }}>
        This page isn't in {own?.proposal ? 'this version' : 'Live'}.
      </div>
    );
  const C = def.component;
  return (
    <PageScope.Provider value={entry}>
      <ErrorBoundary label={`Page “${nav.title(entry.ref)}”`} fill resetKey={entryKey(entry)}>
        <C params={entry.ref.params} />
      </ErrorBoundary>
    </PageScope.Provider>
  );
}

/**
 * A sliding layer. Mounts at its closed position and slides open on the next frame. `fade`: it fades and scales
 * instead (a section swapped for another, SWAP). `covered`: a page is open over it — once that page has slid in, this
 * one stops being drawn: at a fractional zoom the top page's edge is antialiased, and a thin strip of the page under it
 * (slid 25% left, so its content is at that edge) showed through. It's back the moment the page over it starts to leave.
 */
function Layer({
  open,
  animateIn,
  openT,
  closedT,
  fade = false,
  covered = false,
  style,
  page,
  pageId,
  children,
}: {
  open: boolean;
  animateIn: boolean;
  openT: string;
  closedT: string;
  fade?: boolean;
  covered?: boolean;
  style: CSSProperties;
  page: string;
  /** The page's id, for the comment pins (comments/anchor). */
  pageId: string;
  children: ReactNode;
}) {
  const [entered, setEntered] = useState(!animateIn);
  const raf = useRef(0);
  useEffect(() => {
    if (entered) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(raf.current);
  }, [entered]);
  return (
    <div
      data-hc-page={page}
      data-page-id={pageId}
      style={{
        ...style,
        transform: open && entered ? openT : closedT,
        visibility: covered ? 'hidden' : 'visible',
        transition: `${fade ? (open ? SWAP.in : SWAP.out) : T}, visibility 0s linear ${covered ? PAGE_MS : 0}ms`,
        ...(fade && { opacity: open && entered ? 1 : 0 }),
      }}
    >
      {children}
    </div>
  );
}

/**
 * `preview`: not inspectable, and without overlays (Flow thumbnails). `overlays` shows sheets, dialogs and toasts on a
 * preview anyway: the other screens of a device set or All devices, which share them.
 */
export function DeviceScreen({ preview = false, overlays = !preview }: { preview?: boolean; overlays?: boolean }) {
  const { layout: L, theme, toastText, dialog } = useSim();
  const language = useLanguage();
  const nav = useNavRoot();
  const { stack } = nav;
  const { setRoot, captureProps, inspect } = useDesignRoot();
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  const a11y = useAccessibility();
  const textVars = useMemo(() => systemTextVars(textSystemOf(L.os), a11y.textSize, a11y.boldText), [L.os, a11y.textSize, a11y.boldText]);
  // Where the sheets a page keeps itself go (screenLayer.tsx).
  const [sheetLayer, setSheetLayer] = useState<HTMLDivElement | null>(null);
  // The system keyboard: up while a text field in this screen has focus (the last field stays while it slides away).
  const [kbField, setKbField] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbH, setKbH] = useState(0);
  // On the device in hand the keyboard is the system's: its height is what it hides of the window.
  const realKb = useRealKeyboard(L.real && !preview);
  useEffect(() => {
    if (!screen) return;
    const onIn = (e: FocusEvent) => {
      if (!isTextField(e.target)) return;
      setKbField(e.target);
      setKbOpen(true);
    };
    // Focus moving to another field keeps it up; anywhere else (or nowhere) puts it away.
    let t = 0;
    const onOut = () => {
      t = window.setTimeout(() => {
        const a = document.activeElement;
        if (!(a && screen.contains(a) && isTextField(a))) setKbOpen(false);
      });
    };
    screen.addEventListener('focusin', onIn);
    screen.addEventListener('focusout', onOut);
    return () => {
      window.clearTimeout(t);
      screen.removeEventListener('focusin', onIn);
      screen.removeEventListener('focusout', onOut);
    };
  }, [screen]);
  // The inspectable root. An effect, not a ref: when the active screen of a set changes, every cleanup runs before the
  // new root is set.
  useEffect(() => {
    if (preview || !screen) return;
    setRoot(screen);
    return () => setRoot(null);
  }, [preview, screen, setRoot]);

  // Split the stack: base tab, push pages, then covers (and anything pushed on top of a cover). A boot page (a
  // welcome flow) is the base of a stack with no tab under it: it goes with the covers, full screen, and the nav stays
  // out — there's no app yet.
  const boot = nav.def(stack[0].id).level === 'boot';
  const coverAt = boot ? 0 : stack.findIndex((r, i) => i > 0 && nav.def(r.id).level === 'cover');
  const end = coverAt < 0 ? stack.length : coverAt;
  const [cfg] = useScreenConfig();
  // Every layer's box comes from the regions (src/sim/regions.ts).
  const R = screenRegions(L);
  // When the pushes' region moves (the split's right part opening or closing), the pages in it glide
  // from where they were instead of jumping: `glide` is the offset they come from, for one animation. Not on a new
  // screen size (rotation, another device), where everything relays out at once.
  const [prevPush, setPrevPush] = useState({ left: R.pushes.left, vw: L.vw });
  const [glide, setGlide] = useState<number | null>(null);
  if (prevPush.left !== R.pushes.left || prevPush.vw !== L.vw) {
    setPrevPush({ left: R.pushes.left, vw: L.vw });
    if (prevPush.vw === L.vw && stack.length > 1) setGlide(prevPush.left - R.pushes.left);
  }
  useEffect(() => {
    if (glide === null) return;
    const t = window.setTimeout(() => setGlide(null), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [glide]);
  const glideStyle = (glide === null ? {} : { '--glide-from': `${glide}px`, animation: `hcGlide ${PAGE_MS}ms ${EASE}` }) as CSSProperties;
  const appW = R.app.width;
  /** Off the app area's right edge (and its shadow), from a layer's left. */
  const offRight = (left: number) => `translateX(${appW - left + 8}px)`;
  const baseEntry = useMemo(() => ({ ref: stack[0], index: 0 }), [stack]);
  const pushes = foldSplit(
    stack.slice(1, end).map((ref, j) => ({ ref, index: j + 1 })),
    R.pushes.width,
    cfg,
    nav.def,
    L,
  );
  // Covers span the screen, except the iPhone Duo right column (status + nav), which stays reserved.
  // Covers split (list–detail) by the width they actually get.
  const covers = foldSplit(
    stack.slice(end).map((ref, j) => ({ ref, index: end + j })),
    R.covers.width,
    cfg,
    nav.def,
    L,
  );
  const top = stack[stack.length - 1];
  const sideColumn = sideColumnFor(top.id, nav.def(top.id), cfg);
  const pushL = usePresence(pushes, entryKey, EXIT_MS);
  const coverL = usePresence(covers, entryKey, EXIT_MS);
  const anyOpen = pushes.length > 0 || covers.length > 0;

  /** The split panel's section being replaced: one first page leaving while another comes in. */
  const swapping = pushL.some((p) => p.item.index === 1 && !p.present) && pushL.some((p) => p.item.index === 1 && p.present);

  /** Present layer with another present layer above it. */
  const covered = (list: typeof pushL, k: number) => list.slice(k + 1).some((p) => p.present);

  const base: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: R.base.left,
    width: R.base.width,
    background: 'var(--pg)',
    transform: `translateX(${phoneMotion(L) && anyOpen ? -25 : 0}%)`,
    // Its left moves when the rail changes width (a sidebar folding): the page slides along with it, as its
    // width already does beside the split panel (a layout animation, one page for 380 ms).
    transition: `${T}, width ${PAGE_MS}ms ${EASE}, left ${PAGE_MS}ms ${EASE}`,
  };

  const app = (
    <KeyboardInsetCtx.Provider value={L.real ? realKb : kbOpen ? kbH : 0}>
      <div
        ref={setScreen}
        data-theme={theme}
        // The device's language (Scenarios › Language): the browser hyphenates and picks quotes by it.
        lang={language}
        data-device-screen
        {...(preview ? {} : captureProps)}
        style={{
          // The system's text size and Bold Text (Scenarios › Accessibility), as the type tokens they change (none at
          // the defaults).
          // Text with no size of its own has the browser's (16 px): it follows the scale too.
          fontSize: 'calc(16px * var(--text-scale, 1))',
          ...textVars,
          cursor: inspect && !preview ? 'crosshair' : undefined,
          color: 'var(--tx)',
          position: 'relative',
          width: L.vw,
          height: L.vh,
          background: 'var(--pg)',
          borderRadius: L.screenRadius,
          overflow: 'clip',
          transition: 'background 200ms',
          // An app, not a page: no text selection with the cursor (fields keep theirs).
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* The device in hand shows its own status, camera, home indicator and keyboard. */}
        {!L.real && <StatusBar layout={L} />}

        {/* The app's area (no z-index of its own, so its layers still stack with the nav); it clips its layers to it. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: appW,
            overflow: 'clip',
            transition: `width ${PAGE_MS}ms ${EASE}`,
          }}
        >
          <RightEdgeCtx.Provider value>
            {/* Under a boot page there's no base: it's empty (and not a page for the layers or the scanner). */}
            <div data-hc-page={boot ? undefined : nav.title(stack[0])} data-page-id={boot ? undefined : stack[0].id} style={base}>
              {/* The base reaches the right edge unless the tablet split panel is open beside it. */}
              <RightEdgeCtx.Provider value={!L.dashOpen}>
                {/* Each section fades up as it comes in (keyed by the tab). */}
                <div
                  key={stack[0].id}
                  style={{
                    height: '100%',
                    animation: `hcTabIn ${TAB_IN_MS}ms ${EASE}`,
                  }}
                >
                  {boot ? null : <PageView entry={baseEntry} />}
                </div>
              </RightEdgeCtx.Provider>
            </div>
            {R.pushes.inPanel ? (
              // Tablet split: the panel slides in from the right edge; deeper pages push inside it.
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: R.pushes.left,
                  width: R.pushes.width,
                  zIndex: Z.panel,
                  overflow: 'clip',
                  transform: L.dashOpen ? 'translateX(0)' : offRight(R.pushes.left),
                  transition: T,
                  ...glideStyle,
                }}
              >
                {pushL.map((p, k) => {
                  // Another section opening in place of the panel's (its first page, not one pushed inside it): a
                  // crossfade with a slight scale instead of the push slide.
                  const swap = p.item.index === 1 && swapping;
                  return (
                    <Layer
                      key={p.key}
                      page={nav.title(p.item.ref)}
                  pageId={p.item.ref.id}
                      open={p.present}
                      animateIn={p.animateIn && (k > 0 || swap)}
                      fade={swap}
                      covered={covered(pushL, k)}
                      openT={swap ? 'scale(1)' : covered(pushL, k) ? 'translateX(-25%)' : 'translateX(0)'}
                      closedT={swap ? `scale(${SWAP.scale})` : k === 0 ? 'translateX(0)' : 'translateX(calc(100% + 8px))'}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: k,
                        background: 'var(--pg)',
                        boxShadow: k > 0 ? SHADOW : 'none',
                      }}
                    >
                      <DetailPanelCtx.Provider value>
                        <EntryView entry={p.item} />
                      </DetailPanelCtx.Provider>
                    </Layer>
                  );
                })}
              </div>
            ) : (
              pushL.map((p, k) => (
                <Layer
                  key={p.key}
                  page={nav.title(p.item.ref)}
                  pageId={p.item.ref.id}
                  open={p.present}
                  animateIn={p.animateIn}
                  covered={covered(pushL, k)}
                  openT={phoneMotion(L) && covered(pushL, k) ? 'translateX(-25%)' : 'translateX(0)'}
                  closedT={offRight(R.pushes.left)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: R.pushes.left,
                    width: R.pushes.width,
                    zIndex: Z.push + k,
                    background: 'var(--pg)',
                    boxShadow: p.present && !L.railW ? SHADOW : 'none',
                    // Beside the iPhone Duo right column the shadow stays on the left: it would tint the column.
                    clipPath: L.sideNav ? 'inset(0 0 0 -40px)' : undefined,
                    ...glideStyle,
                  }}
                >
                  <EntryView entry={p.item} />
                </Layer>
              ))
            )}

            {coverL.map((p, k) => {
              const bg = nav.def(p.item.ref.id).background;
              return (
                <Layer
                  key={p.key}
                  page={nav.title(p.item.ref)}
                  pageId={p.item.ref.id}
                  open={p.present}
                  animateIn={p.animateIn}
                  covered={covered(coverL, k)}
                  openT={covered(coverL, k) ? 'translateX(-25%)' : 'translateX(0)'}
                  closedT={offRight(R.covers.left)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: R.covers.left,
                    width: R.covers.width,
                    height: L.vh,
                    // Above every push, however deep, and the tablet rail (Z.rail).
                    zIndex: Z.cover + k,
                    background: bg ?? 'var(--pg)',
                    boxShadow: p.present ? SHADOW : 'none',
                    // Beside the iPhone Duo right column the shadow stays on the left, as a push's: its blur would
                    // tint the column. A page with a background of its own still reaches under the column.
                    clipPath: L.sideNav ? `inset(0 ${bg ? -L.sideW : 0}px 0 -40px)` : undefined,
                  }}
                >
                  <EntryView entry={p.item} />
                  {/* The page's own background goes on under the iPhone Duo column (the content stays out of it). */}
                  {bg && L.sideW > 0 && <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: '100%', width: L.sideW, background: bg }} />}
                </Layer>
              );
            })}
          </RightEdgeCtx.Provider>
        </div>

        {!boot && L.bottomNav && <TabBar />}
        {!boot && L.sideNav && sideColumn === 'nav' && <SideNav />}
        {!boot && L.showRail && <SideRail />}

        {overlays && <SnackbarLayer layout={L} />}
        {overlays && <div ref={setSheetLayer} style={{ display: 'contents' }} />}
        {overlays && <SheetLayer layout={L} screen={screen} />}
        {overlays && dialog && (
          <div style={{ position: 'absolute', inset: 0, zIndex: Z.dialog }}>
            <Dialog {...dialog} />
          </div>
        )}
        {overlays && <Toast text={toastText} bottom={L.toastBottom} />}
        <ChangesOverlay screen={screen} zIndex={Z.dialog - 1} radius={L.screenRadius} interactive={!preview} />
        {!preview && <LocateFlash screen={screen} />}
        {inspect && !preview && L.reserved && (
          <div
            title="Reserved: corner status. Header controls in this row must avoid it."
            style={{
              position: 'absolute',
              top: L.reserved.top,
              right: L.reserved.right,
              width: L.reserved.width,
              height: L.reserved.height,
              border: '1px dashed #f24822',
              borderRadius: 8,
              zIndex: Z.inspect,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 2,
                padding: '0 4px',
                borderRadius: 3,
                background: '#f24822',
                color: '#fff',
                font: '600 9px/13px Inter, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              Reserved · status
            </span>
          </div>
        )}
        {kbField && !L.real && <SystemKeyboard os={L.os} land={L.land} open={kbOpen} field={kbField} bottomInset={L.botIn} width={L.vw} height={L.vh} onHeight={setKbH} />}
        {!L.real && <LandscapeCamera layout={L} />}
        {!L.real && <HomeIndicator layout={L} />}
      </div>
    </KeyboardInsetCtx.Provider>
  );
  // The video layout (where the display offers it): a 16:9 video across the top, the app in the rest below. The
  // wrapper is always there (a box only with the video), so turning the video on or off doesn't remount the app.
  return (
    <div style={L.videoH ? { width: L.vw, height: L.videoH + L.vh, borderRadius: L.fullRadius, overflow: 'clip', background: '#000' } : { display: 'contents' }}>
      {L.videoH > 0 && <VideoArea layout={L} />}
      <ScreenLayerCtx.Provider value={overlays ? sheetLayer : null}>{app}</ScreenLayerCtx.Provider>
    </div>
  );
}

/**
 * The video layout's top area: a mock player (a video with its controls). A corner status stays where it always is
 * (layout.videoStatus), in white over the video.
 */
function VideoArea({ layout: L }: { layout: Layout }) {
  const width = L.vw;
  const height = L.videoH;
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        color: '#fff',
        background: 'radial-gradient(120% 90% at 30% 35%, #3b4a63 0%, #1b2230 55%, #0b0d12 100%)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {L.videoStatus && (
        <CornerStatusImage kind="horizontal" style={{ position: 'absolute', top: L.videoStatus.top, right: L.videoStatus.right, filter: 'invert(1)' }} />
      )}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="play_arrow" size={40} fill color="#fff" />
      </span>
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>A video playing</span>
        <span
          style={{
            height: 3,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.3)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: '38%',
              height: '100%',
              background: '#ff3b30',
            }}
          />
        </span>
        <span
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            opacity: 0.75,
          }}
        >
          <span>2:14</span>
          <span>5:48</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The element at the same place in `screen` as `el` in its own device screen: the tapped control's counterpart on the
 * other screens showing the same sheet (light and dark side by side, a device set to another version), so the sheet
 * hangs from it there too. Null where the screens differ there.
 */
function counterpartIn(el: HTMLElement, screen: HTMLElement): HTMLElement | null {
  const own = el.closest('[data-device-screen]');
  if (!own) return null;
  const path: number[] = [];
  for (let n: Element = el; n !== own && n.parentElement; n = n.parentElement) path.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
  let m: Element | undefined = screen;
  for (const i of path) m = m?.children[i];
  return m instanceof HTMLElement ? m : null;
}

/** An element's box within the device screen (offsets, so the canvas scale, zoom and frame rotation don't matter). */
function boxInScreen(el: HTMLElement): AnchorRect | null {
  const root = el.closest('[data-theme]');
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
    if (!n.offsetParent) return null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}


/** The snackbar (useSim().showSnackbar): the kit's Snackbar over the screen's insets, kept while it animates out. */
function SnackbarLayer({ layout: L }: { layout: Layout }) {
  const { snackbar } = useSim();
  const last = useRef<SnackbarSpec | null>(null);
  const [, setGone] = useState(0);
  if (snackbar) last.current = snackbar;
  useEffect(() => {
    if (snackbar) return;
    const t = window.setTimeout(() => ((last.current = null), setGone((n) => n + 1)), SNACKBAR_MS);
    return () => window.clearTimeout(t);
  }, [snackbar]);
  const s = last.current;
  if (!s) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z.snackbar, pointerEvents: 'none' }}>
      <Snackbar text={s.text} level={s.level} action={s.action} open={!!snackbar} bottomInset={L.botIn} endInset={L.sideNav ? L.sideW : 0} />
    </div>
  );
}

/**
 * The page-opened sheet (useSim().openSheet): a Sheet, or what the screen's sheet rule makes of it on a large screen
 * (sim/sheetPresentation: a drop-down or a popover from its anchor, a dialog). Keeps its last content while it animates out.
 */
function SheetLayer({ layout: L, screen }: { layout: Layout; screen: HTMLElement | null }) {
  const { sheet, closeSheet } = useSim();
  const last = useRef<SheetSpec | null>(null);
  if (sheet) last.current = sheet;
  const s = last.current;
  if (!s) return null;
  // Marked with its id: a comment left on it knows which sheet to open again (sim/sheetLinks).
  return s.id ? (
    <div {...{ [SHEET_ATTR]: s.id }} style={{ display: 'contents' }}>
      <SheetBody layout={L} screen={screen} s={s} open={!!sheet} onClose={closeSheet} />
    </div>
  ) : (
    <SheetBody layout={L} screen={screen} s={s} open={!!sheet} onClose={closeSheet} />
  );
}

function SheetBody({ layout: L, screen, s, open, onClose: closeSheet }: { layout: Layout; screen: HTMLElement | null; s: SheetSpec; open: boolean; onClose: () => void }) {
  // Content clears the status bar, or the reserved corner where there's no status strip (iPhone Duo inner portrait).
  const topInset = L.sbH || (L.reserved ? L.reserved.top + L.reserved.height : 0);
  // A bottom sheet's content stays above the keyboard while a field in it has it up (the platform's bottom view inset, which
  // stands in for the home indicator's inset: the keyboard covers it).
  const kb = useKeyboardInset();
  const bottomInset = kb || L.botIn;
  // The anchor, or this screen's counterpart when it was opened on another screen of the canvas.
  const anchorEl =
    s.anchor && screen && !screen.contains(s.anchor)
      ? ((s.id ? screen.querySelector<HTMLElement>(`[data-sheet-anchor="${s.id}"]`) : null) ?? counterpartIn(s.anchor, screen))
      : s.anchor;
  const floats = anchoredFloats(L, s.fromNav);
  const anchor = anchorEl && floats ? boxInScreen(anchorEl) : null;
  // What has no `content` to show elsewhere stays the sheet it renders.
  const as = s.content ? sheetPresentation({ kind: s.kind, layout: s.layout, hasAnchor: !!anchor, floats }) : 'sheet';
  const body = () => (typeof s.content === 'function' ? s.content(closeSheet, as) : s.content);
  if (anchor && as === 'dropdown')
    return (
      <DropDownLayer anchor={anchor} bounds={{ w: L.vw, h: L.vh }} open={open} onClose={closeSheet} topInset={topInset} align={s.dropdownAlign}>
        {body()}
      </DropDownLayer>
    );
  if (anchor && as === 'popover')
    return (
      <Popover anchor={anchor} bounds={{ w: L.vw, h: L.vh }} open={open} onClose={closeSheet} topInset={topInset} side={s.popoverSide}>
        {body()}
      </Popover>
    );
  if (as === 'dialog')
    return (
      // The keyboard's height: the dialog stays above it (a field in it keeps the keyboard up).
      <Sheet layout="dialog" width={s.width} surface={s.surface} open={open} onClose={closeSheet} bottomInset={kb} topInset={topInset}>
        {body()}
      </Sheet>
    );
  if (s.render)
    return (
      <>
        {s.render({
          open,
          onClose: closeSheet,
          bottomInset: L.botIn,
          topInset,
        })}
      </>
    );
  // The status in the right column (iPhone Duo outer display): a bottom sheet wide enough to reach the column stops
  // under it, so it never covers the time and the signal.
  const sheetW = Math.min(L.vw, sheetMaxWidth(s.width));
  const underStatus = L.cornerStatus === 'vertical' && (s.layout ?? 'bottomContent') === 'bottomContent' && (L.vw + sheetW) / 2 > L.vw - L.sideW;
  // A top sheet that wide (a day picker) still spans the screen, under the column; its content stops at
  // the column, so nothing of it sits under the time and the signal.
  const besideStatus = L.cornerStatus === 'vertical' && s.layout === 'topContent' && (L.vw + sheetW) / 2 > L.vw - L.sideW;
  const sheetStyle: CSSProperties = {
    ...(underStatus ? { maxHeight: L.vh - tallSheetTop(L) } : {}),
    // …and what slides or scrolls sideways in it is cut there too, not at the sheet's edge.
    ...(besideStatus ? { paddingRight: L.sideW, ['--sheet-pad-r' as string]: '0px' } : {}),
  };
  return (
    <Sheet
      layout={s.layout}
      width={s.width}
      showPadding={s.showPadding}
      surface={s.surface}
      sheetStyle={sheetStyle}
      open={open}
      onClose={closeSheet}
      bottomInset={bottomInset}
      topInset={topInset}
    >
      {body()}
    </Sheet>
  );
}

