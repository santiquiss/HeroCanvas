// Top toolbar + scaled device frame. Simulator state (device, display, land, theme) lives in the URL.
import { sidePanelOnIn } from '../nav/sidePanel';
import { systemBack } from './back';
import { schemeIn } from './appThemes';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { deviceGroup, findDevice, findDisplay } from '../devices/devices';
import { DesignProvider, useDesign, useDesignRoot } from '../design/DesignContext';
import { SelectionInUrl } from '../design/SelectionInUrl';
import { Gallery } from '../gallery/Gallery';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FlowView } from '../flow/FlowView';
import { About } from './About';
import { useMode, useRememberMode, useSetMode, type Mode } from './modes';
import { useNavRoot } from '../nav/context';
import { detailOpenFor } from '../nav/stack';
import { landscapeFor, supportsLandscape, useScreenConfig } from '../nav/screenConfig';
import { DeviceScreen } from './DeviceScreen';
import { PageScanner } from './pageIndex';
import { useWhere, WHERE_RAIL_W, WhereRail } from './WhereRail';
import { CapturePanel } from '../capture/CapturePanel';
import { CapturePreviewBar, CaptureStage, RecordingBadge } from '../capture/CaptureStage';
import { ScreenGlare } from '../capture/ScreenGlare';
import { bodyOf, modelOf } from '../capture/models';
import { DEFAULT_LIGHT, lightSide, type Lighting } from '../capture/scene';
import { FLAT, tiltCss, type Tilt } from '../capture/tilt';
import { exportPlan } from '../capture/exportImage';
import { effectivePrefs, playedLength, useCapturePrefs, videoOn } from '../capture/prefs';
import { ShotShell } from '../capture/shot/ShotShell';
import { SHOT_PARAM } from '../capture/shot/params';
import { videoOptionsOf, videoPlan } from '../capture/video/plan';
import { isStill, loopsAlone, sequenceDuration, sequenceMotion } from '../capture/video/motion';
import { useRecording } from '../capture/video/useRecording';
import { FrameHardware, frameBox, frameStyle } from './DeviceFrame';
import { RealShell, useRealMode } from './RealShell';
import { designLayout, railFoldedIn, VARIANT_PARAM } from '../design/overridableRegistry';
import { computeLayout, fitScale, screenOnly } from './layout';
import { SharedSimProvider, SimProvider } from './SimContext';
import { InspectOverlay } from '../tools/InspectOverlay';
import { CommentPins, CommentsProvider, useCommentsUi } from '../comments';
import { screenAttrs } from '../comments/anchor';
import { DEFAULT_W, PanelHost, usePanelPrefs, type PanelPrefs } from '../tools/PanelHost';
import { ModeRail } from './ModeRail';
import { ThemeSwitch } from './ThemeSwitch';
import { useGalleryRoute } from '../gallery/route';
import { Toolbar } from './Toolbar';
import { AllDevices, allDeviceEntries, allDevicesFit } from './AllDevices';
import { deviceSetParams, parseDevices, type DeviceItem } from './deviceSet';
import { AddDeviceButton, DeviceHeader, MultiDevices, multiFit, multiLayouts } from './MultiDevices';
import { FpsMeter } from './FpsMeter';
import { usePan } from './usePan';
import { DEVICE_SORTS, parseZoom, VIEW_BAR_H, ViewBar, ZoomBar, type Arrange, type DeviceSort } from './ViewBar';
import { TouchPointer } from './TouchPointer';
import { NO_APP } from '../nav/noApp';
import { TourBeacons } from '../tour/Beacons';
import styles from './SimulatorShell.module.css';
import { t } from '../i18n/ui';

/**
 * Measures the stage. A callback ref, because the stage element is replaced when switching
 * between the prototype and the gallery.
 */
function useStageSize() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 60 });
  const setRef = useCallback((node: HTMLDivElement | null) => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [el]);
  return [setRef, size] as const;
}

/** The designer, or just the app at the real size of the device it's opened on (sim/RealShell). */
const COMPARE_FROM = 'hc.compareFrom';
/** `?device=` for Compare (All devices). */
const COMPARE_ALL = 'all';

/**
 * The designer, just the app at the real size of the device it's opened on (sim/RealShell), or an agent's shot (the
 * screen in light and dark, nothing else: capture/shot).
 */
export function SimulatorShell() {
  const [search] = useSearchParams();
  const real = useRealMode();
  if (search.get(SHOT_PARAM) === '1') return <ShotShell />;
  return real ? <RealShell /> : <DesignerShell />;
}

function DesignerShell() {
  useRememberMode();
  const [search, setSearch] = useSearchParams();
  const { stack, def, pages } = useNavRoot();
  // The split panel opens for push pages (covers sit above everything).
  const detailOpen = detailOpenFor(pages, stack, sidePanelOnIn(search));
  // `device=all`: every device side by side (prototype mode); the rest of the shell uses the default device.
  // Capture (`?capture=1`) shows one device: All devices and a set give way to their first.
  const captureParam = search.get('capture') === '1';
  const allDevices = !captureParam && search.get('device') === 'all';
  // Compare's preset: which devices All devices shows (DEVICE_GROUPS).
  const compareGroup = deviceGroup(search.get('compare'));
  // A custom set of devices side by side (`?devices=`, two or more).
  const devicesParam = search.get('devices');
  const items = useMemo(() => parseDevices(devicesParam), [devicesParam]);
  const multi = !captureParam && !allDevices && items.length >= 2;
  const arrange: Arrange = search.get('arrange') === 'row' ? 'row' : 'grid';
  const sortParam = search.get('sort');
  const sort: DeviceSort = DEVICE_SORTS.includes(sortParam as DeviceSort) ? (sortParam as DeviceSort) : 'type';
  const device = findDevice(search.get('device'));
  const display = findDisplay(device, search.get('display'));
  const land = search.get('land') === '1';
  const theme = schemeIn((k) => search.get(k));
  // The video layout (16:9 video on top, the app below), on every display that offers it.
  const video = search.get('video') === '1';

  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  // The system back (sim/back): Alt+←, or Esc while the focus is inside a device's screen (typing in it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inScreen = (e.target as Element | null)?.closest?.('[data-device-screen]');
      if ((e.altKey && e.key === 'ArrowLeft') || (e.key === 'Escape' && inScreen)) {
        if (systemBack()) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Capture mode (src/capture): its 3D turn and each device's color are the canvas's, not the URL's.
  const [tilt, setTilt] = useState<Tilt>(FLAT);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [light, setLight] = useState<Lighting>(DEFAULT_LIGHT);
  // Each device's metal and grain (its model's until changed), over the scene's one light.
  const [materials, setMaterials] = useState<Record<string, Pick<Lighting, 'metal' | 'grain'>>>({});
  // Landscape support is a page setting (manifest + screen config), per size class with display exceptions; unset
  // follows the display's default.
  const [cfg] = useScreenConfig();
  const top = stack[stack.length - 1];
  const pageLandscape = landscapeFor(top.id, def(top.id), cfg);
  const supported = supportsLandscape(pageLandscape, device, display);

  // Same inputs for another page (its own landscape setting) and detail state, for the Flow thumbnails.
  // The rail's width the design on screen asks for (a proposal's version may widen it: labels).
  const designProposal = search.get('proposal');
  const designVariant = search.get(VARIANT_PARAM);
  const railFolded = railFoldedIn(search);
  const design = useMemo(() => designLayout(designProposal, designVariant, railFolded), [designProposal, designVariant, railFolded]);
  const makeLayout = useCallback(
    (open: boolean, pageId?: string) =>
      computeLayout({ display, land, supported: supportsLandscape(pageId ? landscapeFor(pageId, def(pageId), cfg) : pageLandscape, device, display), detailOpen: open, video, ...design }),
    [device, display, land, def, cfg, pageLandscape, video, design],
  );
  const layout = useMemo(
    () => computeLayout({ display, land, supported, detailOpen, video, ...design }),
    [display, land, supported, detailOpen, video, design],
  );
  const [stageRef, stage] = useStageSize();
  const [prefs, updatePrefs] = usePanelPrefs();
  const mode = useMode();
  const { name: galleryName } = useGalleryRoute();
  // The where-used rail, beside the canvas in the prototype (only for a component the design on changes).
  const where = useWhere();
  const rail = mode === 'prototype' ? where : null;
  const location = useLocation();
  const setMode = useSetMode();
  // Zoom: Fit (the device keeps clear of the view bar at the top of the canvas) or a fixed scale (1 = 1:1).
  const zoom = parseZoom(search.get('zoom'));
  // The device centers on the canvas itself; the margin for the view bar and zoom is the same above and below.
  const fit = fitScale(layout, stage.w, stage.h - 2 * VIEW_BAR_H + 48);
  const box = frameBox(layout);
  const capture = captureParam && mode === 'prototype';
  const model = modelOf(device.id);
  const bodyColor = colors[device.id] ?? model.finishes[0].color;
  const bodySpec = bodyOf(device.id, display.key);
  const [capPrefs, setCapPrefs] = useCapturePrefs();
  // An interaction recorded on the device, to be a video's screen (capture/video/useRecording).
  const interaction = useRecording();
  // What holds the video's preview now (an export, a slider dragged): it plays again when none does.
  const [holds, setHolds] = useState<Record<string, boolean>>({});
  const holdPreview = useCallback((why: string, on: boolean) => setHolds((h) => (!!h[why] === on ? h : { ...h, [why]: on })), []);
  const previewHeld = Object.values(holds).some(Boolean);
  // Recording an interaction: the interface but the device and Stop locks meanwhile (see `lockable`).
  const recordingNow = capture && interaction.active;
  const recorded = interaction.recording;
  // In video mode the canvas is the clip's preview, always playing: the motion in a loop and the recording on the
  // screen (Still with nothing recorded has nothing to play). Not while recording: the device faces you then.
  const playScreen = useMemo(
    () => (recorded?.preview ? { url: recorded.preview, taps: recorded.taps, touches: capPrefs.showTouches, speed: capPrefs.playbackSpeed } : null),
    [recorded, capPrefs.showTouches, capPrefs.playbackSpeed],
  );
  const capPlay =
    capture && videoOn(capPrefs) && !interaction.active && (!isStill(capPrefs.sequence) || playScreen)
      ? { sequence: capPrefs.sequence, rest: tilt, duration: playedLength(recorded, capPrefs.playbackSpeed) ?? sequenceDuration(capPrefs.sequence), screen: playScreen }
      : null;
  // One object while nothing changes: the canvas redraws the body when it does.
  const look = useMemo(
    () => ({ ...light, ...(materials[device.id] ?? { metal: model.metal ?? DEFAULT_LIGHT.metal, grain: model.grain ?? DEFAULT_LIGHT.grain }) }),
    [light, materials, device.id, model],
  );
  const setLook = (l: Lighting) => {
    setLight(l);
    setMaterials((m) => ({ ...m, [device.id]: { metal: l.metal, grain: l.grain } }));
  };
  // Capture shows the picture: its box (the turned device and the margin, around the frame's center, in points)
  // fitted to the canvas, or at its real size (a pixel of the file a pixel of the screen).
  // Screen only: the screen as its own frame, facing you, no shadow (nothing to cast one).
  const bare = capture && capPrefs.frame === 'screen';
  const shownLayout = useMemo(() => (bare ? screenOnly(layout) : layout), [bare, layout]);
  const videoSeq = capture && videoOn(capPrefs) ? capPrefs.sequence : null;
  // A video's canvas rests on the clip's first frame (the motion turns it from there); a picture's, on its angle.
  const videoStart = useMemo(() => (videoSeq ? sequenceMotion(videoSeq, sequenceDuration(videoSeq), tilt).at(0) : null), [videoSeq, tilt]);
  // Recording faces the device, so the recorded screen is straight (the motion turns it on export).
  const shownTilt = bare || interaction.active ? FLAT : (videoStart ?? tilt);
  const shownPrefs = useMemo(() => effectivePrefs(capPrefs), [capPrefs]);
  // In video mode the crop is the clip's (every turn of its motion fits), not the picture's at this angle.
  const capVideo = capture && videoOn(capPrefs);
  // The custom angle with nothing around it: the device stands where you turn it, by hand as a picture's (its crop follows).
  const holdsAngle = capVideo && capPrefs.sequence.mid === 'angle' && loopsAlone(capPrefs.sequence);
  const capPlan = useMemo(
    () =>
      !capture
        ? null
        : capVideo
          ? videoPlan(shownLayout, bodySpec, videoOptionsOf(shownPrefs, bare, look, playedLength(interaction.recording, capPrefs.playbackSpeed), tilt))
          : exportPlan(shownLayout, bodySpec, shownTilt, { ...shownPrefs, light: look }),
    [capture, capVideo, shownLayout, bodySpec, shownTilt, shownPrefs, look, bare, interaction.recording],
  );
  const capBox = capPlan?.box ?? null;
  // The view centers on the picture (a turn and its shadow move it off the frame's center), Fit sizes it to the canvas.
  const capCenter: [number, number] = capBox ? [(capBox.minX + capBox.maxX) / 2, (capBox.minY + capBox.maxY) / 2] : [0, 0];
  const capHalf = capBox && [(capBox.maxX - capBox.minX) / 2, (capBox.maxY - capBox.minY) / 2];
  const capScale = capHalf
    ? capPrefs.preview === 'actual'
      ? capPlan!.scale / (window.devicePixelRatio || 1)
      : Math.min((stage.w / 2 - 40) / capHalf[0], (stage.h / 2 - 40) / capHalf[1])
    : null;
  const scale = capScale ?? (zoom === 'fit' ? fit : zoom);
  const scrolls = capScale ? capPrefs.preview === 'actual' : zoom !== 'fit';
  const spacerRef = useRef<HTMLDivElement>(null);
  // At its real size the picture is larger than the canvas: start with its middle in view.
  const actual = capture && capPrefs.preview === 'actual';
  useLayoutEffect(() => {
    const st = spacerRef.current?.parentElement;
    if (!actual || !st) return;
    st.scrollLeft = (st.scrollWidth - st.clientWidth) / 2;
    st.scrollTop = (st.scrollHeight - st.clientHeight) / 2;
  }, [actual, capPlan?.scale, device.id, display.key, land]);
  const pan = usePan();
  const allEntries = useMemo(
    // Without the video layout: All devices has no switch for it (the view bar's Video chip is per device).
    () => (allDevices ? allDeviceEntries(land, detailOpen, (d, x) => supportsLandscape(pageLandscape, d, x), false, compareGroup, design) : []),
    [allDevices, land, detailOpen, pageLandscape, compareGroup, design],
  );
  const allFit = allDevices ? allDevicesFit(allEntries, stage.h) : 1;
  const multiLay = useMemo(() => (multi ? multiLayouts(items, detailOpen, pageLandscape, video, { proposal: search.get('proposal'), variant: search.get(VARIANT_PARAM) }, railFoldedIn(search)) : []), [multi, items, detailOpen, pageLandscape, video, search]);
  const toggleVideo = () => setParam({ video: video ? null : '1' });
  const multiFitScale = multi ? multiFit(multiLay, stage.w, stage.h) : 1;
  // Compare (`?device=all`, a preset in `?compare=`) remembers the view it came from, so its Exit goes back there.
  const compareAll = (group: string) => {
    // Switching presets inside Compare keeps where it was opened from.
    if (!allDevices)
      try {
        sessionStorage.setItem(COMPARE_FROM, JSON.stringify({ device: search.get('device'), display: search.get('display'), devices: search.get('devices') }));
      } catch {
        /* storage unavailable: Exit goes to the default device */
      }
    setParam({ device: COMPARE_ALL, display: null, devices: null, compare: group === 'all' ? null : group });
  };
  const exitCompare = () => {
    let from: Record<string, string | null> = {};
    try {
      from = JSON.parse(sessionStorage.getItem(COMPARE_FROM) ?? '{}');
    } catch {
      /* none kept */
    }
    setParam({ device: from.device && from.device !== COMPARE_ALL ? from.device : null, display: from.display ?? null, devices: from.devices ?? null, compare: null });
  };
  /** Adds a device beside the single one: the view becomes a set. */
  const addBeside = (side: 'left' | 'right', id: string) => {
    const cur: DeviceItem = { device: device.id, display: display.key, land };
    const added: DeviceItem = { device: id, display: findDevice(id).displays[0].key, land: false };
    setParam(deviceSetParams(side === 'left' ? [added, cur] : [cur, added]));
  };

  const setParam = useCallback(
    (patch: Record<string, string | null>) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v == null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      ),
    [setSearch],
  );


  // The device on the stage. In Capture: its turn written frame by frame (no transition), above its body, and no
  // shadow of its own (the picture's is drawn around it).
  const frameNode = (
    <div
      ref={setFrameEl}
      className={`${styles.frame} ${capture ? styles.turned : ''}`}
      style={{ ...frameStyle(shownLayout, scale, capture ? tiltCss(shownTilt) : ''), ...(capture ? { zIndex: 1, transition: 'none', boxShadow: 'none' } : {}) }}
      {...screenAttrs({ device: device.id, display: display.key })}
    >
      <DeviceScreen />
      <FrameHardware layout={shownLayout} />
      {capture && shownPrefs.glare && <ScreenGlare layout={shownLayout} tilt={shownTilt} light={lightSide(look)} strength={shownPrefs.glareStrength} side={shownPrefs.glareSide} softness={shownPrefs.glareSoftness} />}
    </div>
  );

  return (
    // The gallery is components already: Inspect picks any element there, with no scope to choose.
    <DesignProvider scale={mode === 'prototype' ? scale : 1} allOnly={mode === 'components'}>
      <WithComments>
      <RevealInspector mode={mode} update={updatePrefs} />
      <RevealComment update={updatePrefs} />
      <SelectionInUrl />
      {/* With no app connected, the tour's step points at the parts it names. */}
      {NO_APP && (mode === 'prototype' || mode === 'flow') && <TourBeacons />}
      {/* The mode rail at the left edge, the full height; the toolbar and the workspace beside it. */}
      <div className={styles.window}>
      {/* While an interaction records, the rest of the interface dims and stops answering, in place (no layout
          jump): only the device, Stop and Esc do. */}
      <div className={styles.lockable} data-locked={recordingNow || undefined} inert={recordingNow}>
        <ModeRail mode={mode} onMode={setMode} />
      </div>
      <div className={styles.app}>
        {/* About is a page to read: no toolbar over it (its versions, proposals and sharing are the app's). */}
        {mode !== 'about' && (
          <div className={styles.lockable} data-locked={recordingNow || undefined} inert={recordingNow}>
            <Toolbar
              leftOpen={prefs.left}
              rightOpen={prefs.right}
              onToggleLeft={() => updatePrefs({ left: !prefs.left })}
              onToggleRight={() => updatePrefs({ right: !prefs.right })}
              mode={mode}
            />
          </div>
        )}
        <SharedSimProvider>
        <SimProvider layout={shownLayout} theme={theme}>
          {/* Off screen, on demand: where each component shows up (the changes popover's links). */}
          <PageScanner design={search.get('proposal') ?? 'live'} />
          <div className={styles.workspace}>
            {/* About is a page to read: no panels beside it. */}
            {prefs.left && mode !== 'about' && (
              <ErrorBoundary label={t('Left panel')} resetKey={location.pathname}>
                {/* Capture keeps Pages: the screen to shoot, picked without leaving it. */}
                <div className={styles.lockable} data-locked={recordingNow || undefined} inert={recordingNow}>
                  <PanelHost side="left" mode={mode} prefs={prefs} update={updatePrefs} only={capture ? ['pages'] : undefined} />
                </div>
              </ErrorBoundary>
            )}
            <div className={styles.canvas} data-canvas>
            {rail && <WhereRail name={rail} makeLayout={makeLayout} />}
            {/* Components and Tokens: the gallery's pages (a component's examples, or the tokens). */}
            {mode === 'about' ? (
              <About />
            ) : mode === 'components' || mode === 'tokens' ? (
              <ErrorBoundary label={t('Gallery')} fill resetKey={location.pathname + location.search}>
                <Gallery />
              </ErrorBoundary>
            ) : mode === 'flow' ? (
              <ErrorBoundary label={t('Flow')} fill resetKey={location.search}>
                <FlowView makeLayout={makeLayout} />
              </ErrorBoundary>
            ) : multi ? (
              <div ref={stageRef} className={styles.stage}>
                <MultiDevices
                  items={items}
                  layouts={multiLay}
                  scale={zoom === 'fit' ? multiFitScale : zoom}
                  theme={theme}
                  video={video}
                  onVideo={toggleVideo}
                  onChange={(next) => setParam(deviceSetParams(next))}
                />
              </div>
            ) : allDevices ? (
              <div ref={stageRef} className={styles.stage}>
                <AllDevices
                  entries={allEntries}
                  scale={zoom === 'fit' ? allFit : zoom}
                  arrange={arrange}
                  sort={sort}
                  theme={theme}
                  onOpen={(d, x) => setParam({ device: d.id, display: d.displays.length > 1 ? x.key : null })}
                />
              </div>
            ) : (
              // Zoomed past Fit, the stage scrolls (middle-button drag pans); at Fit it clips, so scrollIntoView can't
              // shift the device.
              <div ref={stageRef} className={styles.stage} style={scrolls ? { overflow: 'auto' } : undefined} {...pan}>
                <div
                  ref={spacerRef}
                  style={{
                    position: 'relative',
                    width: Math.max(stage.w, (capHalf ? capHalf[0] * 2 : box.w) * scale + 96),
                    height: Math.max(stage.h, capHalf ? capHalf[1] * 2 * scale + 96 : box.h * scale + 2 * VIEW_BAR_H),
                    // Capture: the picture's area and nothing past it (the turned frame and its body reach further, and
                    // would stretch the scroll past the background).
                    ...(capture && { overflow: 'hidden' }),
                  }}
                >
                  {capture ? (
                    <CaptureStage frame={frameEl} layout={shownLayout} scale={scale} tilt={shownTilt} color={bodyColor} spec={bodySpec} light={look} prefs={shownPrefs} center={capCenter} onTilt={setTilt} play={capPlay} paused={previewHeld} crop={capVideo && !holdsAngle ? capBox : null} turnable={capVideo && capPrefs.sequence.mid === 'angle'}>
                      {frameNode}
                    </CaptureStage>
                  ) : (
                    <>
                      {frameNode}
                      {/* The device's header above it, as each one of a set has. */}
                      <DeviceHeader
                        className={styles.singleHead}
                        style={{ top: `calc(50% - ${(box.h * scale) / 2}px)` }}
                        device={device.id}
                        display={display.key}
                        land={land}
                        video={video}
                        onVideo={toggleVideo}
                        onDevice={(id) => setParam({ device: id, display: null })}
                        onDisplay={(key) => setParam({ display: key })}
                        onRotate={() => setParam({ land: land ? null : '1' })}
                      />
                      <InspectOverlay stage={spacerRef} />
                      <CommentPins stage={spacerRef} />
                    </>
                  )}
                  {/* + on each side adds a device to compare with (the view becomes a set). */}
                  {!capture && [-1, 1].map((dir) => (
                    <span
                      key={dir}
                      className={styles.addSide}
                      style={{ left: `calc(50% + ${dir * ((box.w * scale) / 2 + 32)}px)`, top: '50%' }}
                    >
                      <AddDeviceButton side={dir < 0 ? 'left' : 'right'} onPick={(id) => addBeside(dir < 0 ? 'left' : 'right', id)} />
                    </span>
                  ))}
                </div>
                <StageTouch frame={frameEl} scale={scale} rotated={shownLayout.rotLocked} />
              </div>
            )}
            {mode === 'prototype' && (
              <>
                <FpsMeter />
                {capture && interaction.active && (
                  <RecordingBadge seconds={interaction.state.status === 'recording' ? interaction.state.seconds : 0} starting={interaction.state.status === 'starting'} onStop={interaction.stop} />
                )}
                {capture ? (
                  <div className={styles.lockable} data-locked={recordingNow || undefined} inert={recordingNow}>
                    <CapturePreviewBar
                      bare={bare}
                      preview={capPrefs.preview}
                      onPreview={(v) => setCapPrefs({ preview: v })}
                      crop={capPrefs.cropPreview}
                      onCrop={(on) => setCapPrefs({ cropPreview: on })}
                    />
                  </div>
                ) : (
                  <ZoomBar zoom={zoom} fitScale={allDevices ? allFit : multi ? multiFitScale : fit} onZoom={(z) => setParam({ zoom: z === 'fit' ? null : String(z) })} />
                )}
              </>
            )}
              {/* The view bar: Flow's device and orientation; in the prototype, Compare (and in it, its preset, options and
                  Exit). A single device and a set have their headers on the canvas (DeviceHeader). */}
              {(mode === 'flow' || mode === 'prototype') && !capture && (
              <ViewBar
                left={rail ? WHERE_RAIL_W : 0}
                mode={mode}
                device={device}
                display={display}
                allDevices={allDevices}
                arrange={arrange}
                sort={sort}
                land={land}
                video={video}
                onVideo={toggleVideo}
                onDevice={(id) => setParam({ device: id, display: null, devices: null })}
                onDisplay={(key) => setParam({ display: key })}
                onArrange={(a) => setParam({ arrange: a === 'row' ? 'row' : null })}
                onSort={(s) => setParam({ sort: s === 'type' ? null : s })}
                onRotate={() => setParam({ land: land ? null : '1' })}
                group={compareGroup.id}
                onCompare={compareAll}
                onExit={exitCompare}
              />
              )}
              {/* The screens' theme, at the same place in every mode that shows them (a component's examples too). */}
              {(mode === 'prototype' || mode === 'flow' || (mode === 'components' && galleryName)) && !capture && <ThemeSwitch floating />}
            </div>
            {capture ? (
              prefs.right && (
              <CapturePanel
                width={prefs.width?.right ?? DEFAULT_W.right}
                onWidth={(w) => updatePrefs({ width: { right: w } })}
                device={device}
                display={display}
                land={land}
                dark={theme === 'dark'}
                onDevice={(id) => setParam({ device: id, display: null, devices: null })}
                onDisplay={(key) => setParam({ display: key })}
                onRotate={() => setParam({ land: land ? null : '1' })}
                onTheme={() => setParam({ theme: theme === 'dark' ? null : 'dark' })}
                tilt={shownTilt}
                onTilt={setTilt}
                interaction={interaction}
                onHold={holdPreview}
                finishes={model.finishes}
                color={bodyColor}
                onColor={(c) => setColors((m) => ({ ...m, [device.id]: c }))}
                light={look}
                onLight={setLook}
                frame={frameEl}
                layout={shownLayout}
                spec={bodySpec}
                name={`${device.id}${display.key === 'main' ? '' : `-${display.key}`}-${top.id}-${theme}${land ? '-landscape' : ''}`}
                prefs={capPrefs}
                setPrefs={setCapPrefs}
                pixels={capPlan?.pixels ?? [0, 0]}
              />
              )
            ) : prefs.right && mode !== 'about' && (
              <ErrorBoundary label={t('Right panel')} resetKey={location.pathname}>
                <PanelHost side="right" mode={mode} prefs={prefs} update={updatePrefs} />
              </ErrorBoundary>
            )}
          </div>
        </SimProvider>
        </SharedSimProvider>
      </div>
      </div>
      </WithComments>
    </DesignProvider>
  );
}

/** Comments (src/comments): comment mode and Inspect take turns. */
function WithComments({ children }: { children: React.ReactNode }) {
  const { inspect, setInspect } = useDesign();
  return (
    <CommentsProvider exclusive={inspect} onExclusive={setInspect}>
      {children}
    </CommentsProvider>
  );
}

/** Opening a comment (a pin, a link) shows the Comments panel, where its thread is. */
function RevealComment({ update }: { update: (p: Partial<PanelPrefs>) => void }) {
  const { selected, commenting } = useCommentsUi();
  // Commenting (the toolbar's Comment, or C) and a comment picked both show the Comments tab.
  useEffect(() => {
    if (selected || commenting) update({ right: true, tool: { right: 'comments' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, commenting]);
  return null;
}

/** The touch pointer, in the prototype outside Inspect and comment mode (they keep their cursor and click instead). */
function StageTouch({ frame, scale, rotated }: { frame: HTMLElement | null; scale: number; rotated: boolean }) {
  const { inspect } = useDesignRoot();
  const { commenting } = useCommentsUi();
  return <TouchPointer frame={frame} enabled={!inspect && !commenting} scale={scale} rotated={rotated} />;
}

/**
 * Selecting a component (on the device, in Layers) enters Inspect and opens the right panel, where the inspector is;
 * in the prototype, Layers on the left too, at the selection.
 */
function RevealInspector({ mode, update }: { mode: Mode; update: (p: Partial<PanelPrefs>) => void }) {
  const { selected, selectedEl, setInspect } = useDesign();
  useEffect(() => {
    if (!selected && !selectedEl) return;
    setInspect(true);
    // In the prototype, Layers shows where it is: its tab, the rows above it open, the row scrolled to.
    update(mode === 'prototype' ? { right: true, left: true, tool: { left: 'layers' } } : { right: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedEl]);
  return null;
}
