// Capture mode's sidebar (in place of the right panel): the device and how it's shown, its angle and color, and the
// export (format, size, background, shadow). The export's settings are per viewer (localStorage); the angle and the
// color live in the shell, shared with the canvas.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { DEVICES, type Device, type DeviceType, type Display } from '../devices/devices';
import type { Layout } from '../sim/layout';
import panel from '../tools/Panel.module.css';
import styles from './CapturePanel.module.css';
import { exportImage, FORMATS, type ImageFormat } from './exportImage';
import { BACKGROUNDS, effectivePrefs, exportBackground, playedLength, PLAYBACK_SPEEDS, presetOf, SHADOW_PRESETS, SIZE_PRESETS, videoOn, type CapturePrefs, type PlaybackSpeed } from './prefs';
import { PersonaPicker, usePersonaParam } from '../tools/PersonaPicker';
import { ResizeEdge } from '../tools/PanelHost';
import type { BodySpec, Finish } from './models';
import { DEFAULT_LIGHT, lightSide, presetAt, PRESET_SIDE, type LightFrom, type Lighting } from './scene';
import { clampTilt, FLAT, isFlat, project, TILT_MAX, TILT_PRESETS, type Tilt } from './tilt';
import { recordableMime, VIDEO_CONTAINERS, videoOptionsOf, type VideoContainer } from './video/plan';
import { sequenceDuration, sequenceName } from './video/motion';
import { MotionRows } from './MotionRows';
import { canRecord } from './video/recording';
import type { InteractionRecording } from './video/useRecording';

const SCALES = [1, 2, 3, 4];
const TYPES: [DeviceType, string][] = [
  ['phone', 'Phones'],
  ['foldable', 'Foldables'],
  ['tablet', 'Tablets'],
];

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export interface CapturePanelProps {
  device: Device;
  display: Display;
  land: boolean;
  dark: boolean;
  onDevice: (id: string) => void;
  onDisplay: (key: string) => void;
  onRotate: () => void;
  onTheme: () => void;
  tilt: Tilt;
  onTilt: (t: Tilt) => void;
  finishes: Finish[];
  color: string;
  onColor: (c: string) => void;
  light: Lighting;
  onLight: (l: Lighting) => void;
  frame: HTMLElement | null;
  layout: Layout;
  spec: BodySpec | undefined;
  /** The file's name, without size or extension. */
  name: string;
  prefs: CapturePrefs;
  setPrefs: (patch: Partial<CapturePrefs>) => void;
  /** The file's size in pixels at these settings. */
  pixels: [number, number];
  /** The right panel's width (shared with the panel it replaces), and setting it. */
  width: number;
  onWidth: (w: number | undefined) => void;
  /** An interaction recorded on the device (a video's screen): its state, and starting, stopping, dropping it. */
  interaction: InteractionRecording;
  /** Holds the canvas's preview (`why`: what asks, so two don't release each other) while something heavier runs. */
  onHold?: (why: 'export' | 'slider', on: boolean) => void;
}

/**
 * A preset's icon: a phone at that angle, drawn with the canvas's own projection (its back, then its face), the turn
 * doubled so it reads at 20 px.
 */
function TiltGlyph({ tilt }: { tilt: Tilt }) {
  const t = { x: tilt.x * 2, y: tilt.y * 2 };
  // A 10 × 18 phone, 3 deep, in a 24 box (the projection's own units, scaled so its perspective reads).
  const K = 60;
  const pts = (z: number) =>
    [
      [-5, -9],
      [5, -9],
      [5, 9],
      [-5, 9],
    ].map(([x, y]) => project(x * K, y * K, t, z * K).slice(0, 2).map((v) => 12 + v / K).join(','));
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <polygon points={pts(-3).join(' ')} fill="currentColor" opacity="0.35" />
      <polygon points={pts(0).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Where the light comes from: a sun above the device, as far across as the light is, its rays toward it. */
function LightGlyph({ side }: { side: number }) {
  const sx = 12 + Math.max(-1, Math.min(1, side)) * 7;
  const sy = 5;
  // Toward the device's middle.
  const [dx, dy] = [12 - sx, 15 - sy];
  const l = Math.hypot(dx, dy);
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <rect x="8.5" y="11" width="7" height="11" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <circle cx={sx} cy={sy} r="2.6" fill="currentColor" />
      <line x1={sx + (dx / l) * 4} y1={sy + (dy / l) * 4} x2={sx + (dx / l) * 6.5} y2={sy + (dy / l) * 6.5} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A size in pixels, typed: kept within what a canvas can hold. */
function PixelInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      className={styles.pixels}
      type="number"
      min={64}
      max={8192}
      step={1}
      value={value}
      aria-label={label}
      onChange={(e) => {
        const v = Math.round(Number(e.target.value));
        if (v >= 64 && v <= 8192) onChange(v);
      }}
    />
  );
}

/** A shadow preset's icon: a card over its shadow at that softness and reach; none drawn for None, a slider for Custom. */
function ShadowGlyph({ look }: { look: { blur: number; distance: number; opacity: number } | null | undefined }) {
  if (look === null)
    return (
      <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden>
        <path d="M5 7h18M5 15h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <circle cx="10" cy="7" r="2.4" fill="currentColor" />
        <circle cx="18" cy="15" r="2.4" fill="currentColor" />
      </svg>
    );
  const blur = look ? look.blur / 22 : 0;
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" aria-hidden style={{ overflow: 'visible' }}>
      {look && <rect x="9" y={3 + look.distance / 13} width="10" height="16" rx="2.5" fill="#000000" opacity={look.opacity} style={{ filter: `blur(${blur}px)` }} />}
      <rect x="9" y="2" width="10" height="16" rx="2.5" fill="#ffffff" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

const ADVANCED_KEY = 'hc.capture.advanced';
type AdvancedPart = 'color' | 'angle' | 'light';

/** Which sections show their fine controls (the sliders), per viewer. */
function useAdvanced(): [Record<AdvancedPart, boolean>, (part: AdvancedPart) => void] {
  const [open, setOpen] = useState<Record<AdvancedPart, boolean>>(() => {
    try {
      return { color: false, angle: false, light: false, ...JSON.parse(localStorage.getItem(ADVANCED_KEY) || '{}') };
    } catch {
      return { color: false, angle: false, light: false };
    }
  });
  const toggle = (part: AdvancedPart) =>
    setOpen((cur) => {
      const next = { ...cur, [part]: !cur[part] };
      try {
        localStorage.setItem(ADVANCED_KEY, JSON.stringify(next));
      } catch {
        // Not kept: private mode.
      }
      return next;
    });
  return [open, toggle];
}

/** A section's fine controls behind a small button by its title. */
function AdvancedButton({ open, onClick, what }: { open: boolean; onClick: () => void; what: string }) {
  return (
    <button className={`${styles.advanced} ${open ? styles.on : ''}`} onClick={onClick} title={open ? `Hide ${what}` : `Adjust ${what}`} aria-expanded={open}>
      <Icon name="tune" size={14} />
    </button>
  );
}

function Seg<T extends string | number>({ value, options, onChange, disabled = false }: { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={`${styles.seg} ${disabled ? styles.locked : ''}`}>
      {options.map(([v, label]) => (
        <button key={String(v)} className={`${styles.segBtn} ${v === value ? styles.on : ''}`} disabled={disabled} onClick={() => onChange(v)}>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export function CapturePanel(p: CapturePanelProps) {
  const { prefs, setPrefs } = p;
  const [advanced, toggle] = useAdvanced();
  // Screen only: no device to color, turn, light or shade.
  const bare = prefs.frame === 'screen';
  const preset = presetOf(prefs.size);
  const [persona, pickPersona] = usePersonaParam();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const format = FORMATS.find((f) => f.id === prefs.format)!;
  // A clip only of the device in 3D (videoOn): Screen only exports a picture whatever was chosen.
  const video = videoOn(prefs);
  // The containers this browser records (MP4 first); the chosen one if it can, else the first.
  const containers = VIDEO_CONTAINERS.filter((c) => recordableMime(c.id));
  const container = containers.find((c) => c.id === prefs.videoContainer) ?? containers[0];
  // The background the file gets (a format without alpha can't be transparent: white then).
  const alphaNow = video ? !!container?.alpha : format.alpha;
  const formatLabel = video ? (container?.label ?? 'Video') : format.label;
  const bgNow = exportBackground(prefs, alphaNow);
  const bgName = bgNow === null ? 'Transparent' : (BACKGROUNDS.find((b) => b.color === bgNow)?.name ?? 'Custom');
  const ext = prefs.format === 'jpeg' ? 'jpg' : prefs.format;
  // Fit by its scale, Custom by its size.
  const file = `${p.name}${prefs.crop === 'custom' && !bare ? `-${prefs.size[0]}x${prefs.size[1]}` : `@${prefs.scale}x`}.${ext}`;

  const render = (format: ImageFormat) => exportImage(p.frame!, p.layout, p.spec, { ...effectivePrefs(prefs), format, tilt: p.tilt, color: p.color, light: p.light, shadowLook: prefs.shadowLook });
  const run = async (job: () => Promise<void>) => {
    if (!p.frame) return;
    setBusy(true);
    setError('');
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const save = () => run(async () => download(await render(prefs.format), file));

  // The clip: the picture's look (color, light, shadow, background, padding) with the device moving.
  const [progress, setProgress] = useState(0);
  // Frames that missed their slot in the last clip (they show as a stutter): said under the button.
  const [late, setLate] = useState(0);
  const recorded = p.interaction.recording;
  // A video with a recorded interaction: its screen is the recording, so the device, display, orientation and theme
  // stay as they were recorded.
  const deviceLocked = video && !!recorded;
  // A video's export draws frame by frame: the preview holds while it does.
  const onHold = p.onHold;
  useEffect(() => {
    if (!video) return;
    onHold?.('export', busy);
    return () => onHold?.('export', false);
  }, [video, busy, onHold]);
  const videoOpts = useMemo(() => videoOptionsOf(prefs, bare, p.light, playedLength(recorded, prefs.playbackSpeed), p.tilt), [prefs, bare, p.light, recorded, p.tilt]);
  const recState = p.interaction.state;
  const recordable = canRecord();
  // The clip's size: the canvas's plan (SimulatorShell), which is the clip's in video mode.
  const videoPixels = video ? p.pixels : null;
  const videoSize = videoOpts.crop === 'custom' ? `-${videoPixels?.[0]}x${videoPixels?.[1]}` : `@${prefs.scale}x`;
  const videoFile = `${p.name}-${sequenceName(prefs.sequence)}${videoSize}-${prefs.fps}fps.${container?.id ?? 'mp4'}`;
  // Motion blur is drawn frame by frame (MP4): WebM records in real time and can't afford it.
  const blurs = container?.id === 'mp4';
  const record = () =>
    run(async () => {
      if (!container) throw new Error("This browser doesn't record video");
      setProgress(0);
      setLate(0);
      // The encoder loads on the first export: the panel doesn't carry it.
      const { exportVideo } = await import('./video/exportVideo');
      const { blob, late: missed } = await exportVideo(
        p.frame!,
        p.layout,
        p.spec,
        {
          ...videoOpts,
          container: container.id,
          color: p.color,
          background: bgNow,
          // The glare as the canvas shows it, drawn on each frame at its turn.
          glare: prefs.glare ? { light: lightSide(p.light), strength: prefs.glareStrength, side: prefs.glareSide, softness: prefs.glareSoftness } : null,
        },
        setProgress,
        recorded ? { rec: recorded, touches: prefs.showTouches, speed: prefs.playbackSpeed } : null,
      );
      setLate(missed);
      download(blob, videoFile);
    });
  // The clipboard takes PNG only: copy renders one whatever the format.
  const [copied, setCopied] = useState(false);
  const copy = () =>
    run(async () => {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': await render('png') })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });

  const slider = (axis: keyof Tilt, label: string) => (
    <label className={styles.slider}>
      <span className={styles.label}>{label}</span>
      <input type="range" min={-TILT_MAX} max={TILT_MAX} step={1} value={p.tilt[axis]} onChange={(e) => p.onTilt(clampTilt({ ...p.tilt, [axis]: Number(e.target.value) }))} />
      <span className={styles.num}>{p.tilt[axis]}°</span>
    </label>
  );

  return (
    <aside
      // While an interaction records, only its section answers (Stop); the rest dims, in place.
      className={`${panel.panel} ${panel.right} ${p.interaction.active ? styles.recLock : ''}`}
      style={{ width: p.width }}
      data-canvas-ui
      // A slider dragged (the angle, the light, the glare, the size) redraws the device on each step: the preview
      // holds meanwhile, so the two don't fight over the frame.
      onPointerDownCapture={(e) => {
        if (!(e.target instanceof HTMLInputElement) || e.target.type !== 'range') return;
        p.onHold?.('slider', true);
        window.addEventListener('pointerup', () => p.onHold?.('slider', false), { once: true });
      }}
    >
      {/* Resized as the right panel it replaces: the same width, the same limits. */}
      <ResizeEdge side="right" width={p.width} onWidth={p.onWidth} />
      {/* Picture or video: the first choice, since it changes what the rest sets (an angle or a motion); pinned at
          the top as Export is at the bottom, whatever the panel scrolls to. Only the device in 3D moves: with Screen
          only there's no choice to make. */}
      {!bare && (
        <div className={styles.header}>
          <div className={`${styles.showRow} ${styles.modes}`}>
            {(
              [
                ['image', 'Image', 'image', 'A picture of the device at the angle you choose'],
                ['video', 'Video', 'movie', 'A few seconds of the device moving'],
              ] as const
            ).map(([v, label, icon, title]) => (
              <button key={v} className={`${styles.showBtn} ${prefs.output === v ? styles.on : ''}`} onClick={() => setPrefs({ output: v })} title={title}>
                <Icon name={icon} size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={panel.body}>
        {persona && (
          <section className={panel.section}>
            <div className={panel.sectionTitle}>
              <span>Persona</span>
            </div>
            <PersonaPicker persona={persona} onPick={pickPersona} />
          </section>
        )}

        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>Device</span>
          </div>
          {/* A recorded interaction is this device's screen, in this orientation and theme: they stay as recorded. */}
          {deviceLocked && (
            <p className={`${styles.hint} ${styles.lockHint}`}>
              <Icon name="lock" size={14} />
              <span>The interaction was recorded on this device. To change it, its orientation or its theme, record the interaction again.</span>
            </p>
          )}
          <label className={`${styles.select} ${deviceLocked ? styles.locked : ''}`}>
            <span>{p.device.name}</span>
            <select value={p.device.id} disabled={deviceLocked} onChange={(e) => p.onDevice(e.target.value)}>
              {TYPES.map(([type, label]) => (
                <optgroup key={type} label={label}>
                  {DEVICES.filter((d) => d.type === type).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Icon name="expand_more" size={16} />
          </label>
          {/* 3D device or Screen only: a picture's choice; a video is of the 3D device alone. */}
          {!video && (
          <div className={styles.showRow}>
            {(
              [
                ['device', '3D device', 'deployed_code', 'The device in 3D: its frame and body, turned, lit, with a shadow'],
                ['screen', 'Screen only', 'crop_portrait', "Its screen alone, square, no frame: what a screenshot would be"],
              ] as const
            ).map(([v, label, icon, title]) => (
              <button key={v} className={`${styles.showBtn} ${prefs.frame === v ? styles.on : ''}`} onClick={() => setPrefs({ frame: v })} title={title}>
                <Icon name={icon} size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          )}
          {p.device.displays.length > 1 && (
            <div className={styles.pair}>
              <Seg value={p.display.key} options={p.device.displays.map((x) => [x.key, x.label])} onChange={p.onDisplay} disabled={deviceLocked} />
            </div>
          )}
          <div className={styles.pair}>
            <Seg value={p.land ? 'land' : 'port'} options={[['port', 'Portrait'], ['land', 'Landscape']]} onChange={(v) => (v === 'land') !== p.land && p.onRotate()} disabled={deviceLocked} />
            <Seg value={p.dark ? 'dark' : 'light'} options={[['light', 'Light'], ['dark', 'Dark']]} onChange={(v) => (v === 'dark') !== p.dark && p.onTheme()} disabled={deviceLocked} />
          </div>
          {!bare && (
            <>
          <div className={styles.subTitle}>
            <span>Color</span>
            <span className={styles.titleEnd}>
              <span className={styles.muted}>{p.finishes.find((f) => f.color === p.color)?.name ?? 'Custom'}</span>
              <AdvancedButton open={advanced.color} onClick={() => toggle('color')} what="the metal's look" />
            </span>
          </div>
          <div className={styles.swatches}>
            {p.finishes.map((f) => (
              <button key={f.color} className={`${styles.swatch} ${f.color === p.color ? styles.swatchOn : ''}`} style={{ background: f.color }} title={f.name} onClick={() => p.onColor(f.color)} />
            ))}
            <label className={`${styles.swatch} ${styles.custom} ${p.finishes.some((f) => f.color === p.color) ? '' : styles.swatchOn}`} title="Any color">
              <input type="color" value={p.color} onChange={(e) => p.onColor(e.target.value)} />
              <Icon name="palette" size={14} />
            </label>
          </div>
          {advanced.color && (
            <>
          <label className={styles.slider}>
            <span className={styles.label}>Metallic</span>
            <input type="range" min={0} max={100} step={5} value={Math.round(p.light.metal * 100)} onChange={(e) => p.onLight({ ...p.light, metal: Number(e.target.value) / 100 })} />
            <span className={styles.num}>{Math.round(p.light.metal * 100)}</span>
          </label>
          <label className={styles.slider}>
            <span className={styles.label}>Grain</span>
            <input type="range" min={0} max={100} step={5} value={Math.round(p.light.grain * 100)} onChange={(e) => p.onLight({ ...p.light, grain: Number(e.target.value) / 100 })} />
            <span className={styles.num}>{Math.round(p.light.grain * 100)}</span>
          </label>
            </>
          )}
            </>
          )}
        </section>

        {!bare && (
        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>Background</span>
            <span className={styles.muted}>{bgName}</span>
          </div>
          <div className={styles.swatches}>
            <button
              className={`${styles.swatch} ${styles.transparent} ${prefs.background === null && alphaNow ? styles.swatchOn : ''}`}
              disabled={!alphaNow}
              title={alphaNow ? 'Transparent' : `${formatLabel} has no transparency`}
              onClick={() => setPrefs({ background: null })}
            />
            {BACKGROUNDS.map((b) => (
              <button key={b.color} className={`${styles.swatch} ${bgNow === b.color ? styles.swatchOn : ''}`} style={{ background: b.color }} title={b.name} onClick={() => setPrefs({ background: b.color })} />
            ))}
            <label className={`${styles.swatch} ${styles.custom} ${bgNow && !BACKGROUNDS.some((b) => b.color === bgNow) ? styles.swatchOn : ''}`} title="Any color">
              <input type="color" value={bgNow ?? '#ffffff'} onChange={(e) => setPrefs({ background: e.target.value })} />
              <Icon name="palette" size={14} />
            </label>
          </div>
          {!alphaNow && <p className={styles.hint}>{video ? 'Transparent is only available in WebM.' : 'Transparent is only available in PNG and WebP.'}</p>}
        </section>
        )}

        {video && (
          <section className={panel.section} data-keep>
            <div className={panel.sectionTitle}>
              <span>Interaction</span>
            </div>
            {recState.status === 'recording' || recState.status === 'starting' ? (
              <button className={`${styles.showBtn} ${styles.wide} ${styles.recording}`} onClick={p.interaction.stop}>
                <Icon name="stop_circle" size={18} />
                <span>{recState.status === 'starting' ? 'Waiting for permission…' : `Stop · ${recState.seconds.toFixed(1)} s`}</span>
              </button>
            ) : (
              // Record (again), and with a recording, a bin beside it that drops it (back to the still screen).
              <div className={styles.recRow}>
                <button
                  className={`${styles.showBtn} ${styles.wide}`}
                  disabled={!p.frame || !recordable || busy}
                  onClick={() => p.interaction.start(p.frame!)}
                  title={recordable ? 'Record what you do in the prototype: tap, swipe, navigate' : 'Recording the device’s screen needs Chrome'}
                >
                  <Icon name="radio_button_checked" size={18} />
                  <span>{recorded ? 'Record again' : 'Record interaction'}</span>
                </button>
                {recorded && (
                  <button className={`${styles.iconBtn} ${styles.binBtn}`} onClick={p.interaction.discard} title="Discard the recording: back to the still screen" aria-label="Discard the recording">
                    <Icon name="delete" size={18} />
                  </button>
                )}
              </div>
            )}
            {recorded && (
              <p className={styles.hint}>
                {recordingSummary(recorded)}
              </p>
            )}
            {recorded ? (
              <>
              <div className={`${styles.field} ${styles.longLabel}`} title="How fast the recording plays in the clip: faster makes it shorter">
                <span className={styles.label}>Playback speed</span>
                <Seg value={prefs.playbackSpeed} options={PLAYBACK_SPEEDS.map((v) => [v, `${v}x`] as [PlaybackSpeed, string])} onChange={(playbackSpeed) => setPrefs({ playbackSpeed })} />
              </div>
              <Toggle label="Show touches" checked={prefs.showTouches} onChange={(showTouches) => setPrefs({ showTouches })} title="A circle where each finger touches, over the recording" />
              </>
            ) : (
              <p className={styles.hint}>
                {recState.status === 'idle' && recState.error
                  ? `Couldn't record: ${recState.error}`
                  : 'Use the prototype on the canvas while it records: tap, swipe, navigate; press Esc to stop. Chrome asks for permission to record the tab.'}
              </p>
            )}
          </section>
        )}

        {video && (
          <section className={panel.section}>
            <div className={panel.sectionTitle}>
              <span>Motion</span>
            </div>
            <MotionRows sequence={prefs.sequence} recorded={playedLength(recorded, prefs.playbackSpeed)} onChange={(sequence) => setPrefs({ sequence })} />
          </section>
        )}

        {/* The angle: a picture's, or the one a video holds (No motion: custom angle). */}
        {!bare && (!video || prefs.sequence.mid === 'angle') && (
        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>Angle</span>
            <span className={styles.titleEnd}>
              <span className={styles.muted}>
                {p.tilt.y}° · {p.tilt.x}°
              </span>
              <AdvancedButton open={advanced.angle} onClick={() => toggle('angle')} what="turn and lean" />
            </span>
          </div>
          <div className={styles.presets}>
            <button className={styles.iconBtn} disabled={isFlat(p.tilt)} onClick={() => p.onTilt(FLAT)} title="Reset: face the device">
              <Icon name="restart_alt" size={18} />
            </button>
            <span className={styles.presetSep} />
            {TILT_PRESETS.map((t) => (
              <button
                key={t.label}
                className={`${styles.iconBtn} ${t.tilt.x === p.tilt.x && t.tilt.y === p.tilt.y ? styles.on : ''}`}
                onClick={() => p.onTilt(t.tilt)}
                title={t.label}
                aria-label={t.label}
              >
                <TiltGlyph tilt={t.tilt} />
              </button>
            ))}
          </div>
          {advanced.angle && (
            <>
              {slider('y', 'Turn')}
              {slider('x', 'Lean')}
            </>
          )}
        </section>
        )}

        {!bare && (
        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>Light</span>
            <span className={styles.titleEnd}>
              {(lightSide(p.light) !== lightSide(DEFAULT_LIGHT) || p.light.brightness !== DEFAULT_LIGHT.brightness || p.light.shine !== DEFAULT_LIGHT.shine) && (
                <button className={styles.link} onClick={() => p.onLight({ ...DEFAULT_LIGHT, metal: p.light.metal, grain: p.light.grain })}>
                  <span>Reset</span>
                </button>
              )}
              <AdvancedButton open={advanced.light} onClick={() => toggle('light')} what="the angle, brightness and shine" />
            </span>
          </div>
          {/* Where the light comes from: three presets across, the section's width; any angle in Advanced. */}
          <div className={`${styles.presetTiles} ${styles.three}`}>
            {(['left', 'top', 'right'] as LightFrom[]).map((f) => (
              <button key={f} className={`${styles.presetTile} ${presetAt(lightSide(p.light)) === f ? styles.on : ''}`} onClick={() => p.onLight({ ...p.light, from: f, side: undefined })} title={`Light from the ${f}`}>
                <LightGlyph side={PRESET_SIDE[f]} />
                <span>{{ left: 'Left', top: 'Top', right: 'Right' }[f]}</span>
              </button>
            ))}
          </div>
          {advanced.light && (
            <>
          {/* Any angle across, the presets on it: -40° left, 0° top, 40° right, up to 60° to a side. */}
          <label className={styles.slider} title="Where the light is across: the presets are −40°, 0° and 40°">
            <span className={styles.label}>Angle</span>
            <input
              type="range"
              min={-60}
              max={60}
              step={5}
              value={Math.round(lightSide(p.light) * 40)}
              onChange={(e) => {
                const side = Number(e.target.value) / 40;
                const at = presetAt(side);
                p.onLight({ ...p.light, from: at ?? (side < 0 ? 'left' : 'right'), side: at ? undefined : side });
              }}
            />
            <span className={styles.num}>{Math.round(lightSide(p.light) * 40)}°</span>
          </label>
          <label className={styles.slider}>
            <span className={styles.label}>Brightness</span>
            <input type="range" min={50} max={150} step={5} value={Math.round(p.light.brightness * 100)} onChange={(e) => p.onLight({ ...p.light, brightness: Number(e.target.value) / 100 })} />
            <span className={styles.num}>{Math.round(p.light.brightness * 100)}</span>
          </label>
          <label className={styles.slider}>
            <span className={styles.label}>Shine</span>
            <input type="range" min={0} max={100} step={5} value={Math.round(p.light.shine * 100)} onChange={(e) => p.onLight({ ...p.light, shine: Number(e.target.value) / 100 })} />
            <span className={styles.num}>{Math.round(p.light.shine * 100)}</span>
          </label>
            </>
          )}
          <Toggle label="Screen glare" checked={prefs.glare} onChange={(glare) => setPrefs({ glare })} title="A softbox mirrored in the glass, sliding as the device turns" />
          {prefs.glare && (
            <>
              <div className={styles.field} title="Where the lightbox the glass mirrors is: above the scene (more of it as the screen faces up) or below (as it faces down)">
                <span className={styles.label}>Lightbox</span>
                <Seg value={prefs.glareSide} options={[['top', 'Above'], ['bottom', 'Below']]} onChange={(v) => setPrefs({ glareSide: v })} />
              </div>
              <label className={styles.slider}>
                <span className={styles.label}>Intensity</span>
                <input type="range" min={10} max={100} step={5} value={Math.round(prefs.glareStrength * 100)} onChange={(e) => setPrefs({ glareStrength: Number(e.target.value) / 100 })} />
                <span className={styles.num}>{Math.round(prefs.glareStrength * 100)}</span>
              </label>
            </>
          )}
        </section>
        )}

        {!bare && (
        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>Shadow</span>
          </div>
          <div className={styles.presetTiles}>
            {SHADOW_PRESETS.map((x) => (
              <button
                key={x.id}
                className={`${styles.presetTile} ${prefs.shadowPreset === x.id ? styles.on : ''}`}
                onClick={() => setPrefs(x.look ? { shadowPreset: x.id, shadow: true, shadowLook: x.look } : x.id === 'none' ? { shadowPreset: 'none', shadow: false } : { shadowPreset: 'custom', shadow: true })}
                title={x.label}
              >
                <ShadowGlyph look={x.id === 'custom' ? null : (x.look ?? undefined)} />
                <span>{x.label}</span>
              </button>
            ))}
          </div>
          {prefs.shadowPreset === 'custom' && (
            <>
              <label className={styles.slider}>
                <span className={styles.label}>Softness</span>
                <input type="range" min={0} max={120} step={2} value={prefs.shadowLook.blur} onChange={(e) => setPrefs({ shadowLook: { ...prefs.shadowLook, blur: Number(e.target.value) } })} />
                <span className={styles.num}>{prefs.shadowLook.blur}</span>
              </label>
              <label className={styles.slider}>
                <span className={styles.label}>Distance</span>
                <input type="range" min={0} max={80} step={2} value={prefs.shadowLook.distance} onChange={(e) => setPrefs({ shadowLook: { ...prefs.shadowLook, distance: Number(e.target.value) } })} />
                <span className={styles.num}>{prefs.shadowLook.distance}</span>
              </label>
              <label className={styles.slider}>
                <span className={styles.label}>Opacity</span>
                <input type="range" min={0} max={80} step={2} value={Math.round(prefs.shadowLook.opacity * 100)} onChange={(e) => setPrefs({ shadowLook: { ...prefs.shadowLook, opacity: Number(e.target.value) / 100 } })} />
                <span className={styles.num}>{Math.round(prefs.shadowLook.opacity * 100)}</span>
              </label>
            </>
          )}
        </section>
        )}


        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>Size</span>
            <span className={styles.muted}>
              {(videoPixels ?? p.pixels)[0]} × {(videoPixels ?? p.pixels)[1]} px
            </span>
          </div>
          {!bare && (
            <div className={styles.field}>
              <span className={styles.label}>Mode</span>
              <Seg value={prefs.crop} options={[['fit', 'Auto'], ['custom', 'Fixed']]} onChange={(v) => setPrefs({ crop: v })} />
            </div>
          )}
          {prefs.crop === 'fit' || bare ? (
            <div className={styles.field}>
              <span className={styles.label}>Scale</span>
              <Seg value={prefs.scale} options={SCALES.map((s) => [s, `${s}×`] as [number, string])} onChange={(v) => setPrefs({ scale: v })} />
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Preset</span>
                <label className={`${styles.select} ${styles.inline}`}>
                  <span>{preset ? `${preset.group} · ${preset.label}` : 'Custom'}</span>
                  <select
                    value={preset ? String(SIZE_PRESETS.indexOf(preset)) : 'custom'}
                    onChange={(e) => e.target.value !== 'custom' && setPrefs({ size: SIZE_PRESETS[Number(e.target.value)].size })}
                  >
                    {[...new Set(SIZE_PRESETS.map((x) => x.group))].map((g) => (
                      <optgroup key={g} label={g}>
                        {SIZE_PRESETS.map((x, i) =>
                          x.group === g ? (
                            <option key={i} value={i}>
                              {x.label} · {x.size[0]} × {x.size[1]}
                            </option>
                          ) : null,
                        )}
                      </optgroup>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                  <Icon name="expand_more" size={16} />
                </label>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Pixels</span>
                <div className={styles.dims}>
                  <PixelInput value={prefs.size[0]} onChange={(w) => setPrefs({ size: [w, prefs.size[1]] })} label="Width" />
                  <span>×</span>
                  <PixelInput value={prefs.size[1]} onChange={(h) => setPrefs({ size: [prefs.size[0], h] })} label="Height" />
                  <button className={styles.iconBtn} onClick={() => setPrefs({ size: [prefs.size[1], prefs.size[0]] })} title="Swap width and height">
                    <Icon name="swap_horiz" size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
          {!bare && (
          <label className={styles.slider} title="Room between the device (and its shadow) and the picture's edges, in the file's pixels">
            <span className={styles.label}>Padding</span>
            <input type="range" min={0} max={600} step={10} value={prefs.padding} onChange={(e) => setPrefs({ padding: Number(e.target.value) })} />
            <span className={styles.num}>{prefs.padding}</span>
          </label>
          )}
        </section>

        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>Export</span>
          </div>
          <div className={styles.field} title={video ? 'MP4 plays everywhere; WebM keeps a transparent background' : undefined}>
            <span className={styles.label}>Format</span>
            {video ? (
              containers.length > 0 && <Seg value={container.id} options={containers.map((c) => [c.id, c.label] as [VideoContainer, string])} onChange={(v) => setPrefs({ videoContainer: v })} />
            ) : (
              <Seg value={prefs.format} options={FORMATS.map((f) => [f.id, f.label] as [ImageFormat, string])} onChange={(v) => setPrefs({ format: v })} />
            )}
          </div>
          {/* A clip's frame rate and motion blur: how it's written, beside its format. */}
          {video && (
            <>
              <div className={styles.field} title="Frames a second: 60 looks smoother; the file is heavier">
                <span className={styles.label}>Frames</span>
                <Seg value={prefs.fps} options={[[30, '30 fps'], [60, '60 fps']]} onChange={(v) => setPrefs({ fps: v })} />
              </div>
              <Toggle
                label="Motion blur"
                checked={blurs && prefs.motionBlur}
                disabled={!blurs}
                onChange={(motionBlur) => setPrefs({ motionBlur })}
                title={blurs ? 'Each frame blends the motion of its instant, as a camera does: the turn looks continuous' : 'MP4 only: WebM records in real time'}
              />
            </>
          )}
          {!video && prefs.format !== 'png' && (
            <label className={styles.slider}>
              <span className={styles.label}>Quality</span>
              <input type="range" min={50} max={100} step={1} value={Math.round(prefs.quality * 100)} onChange={(e) => setPrefs({ quality: Number(e.target.value) / 100 })} />
              <span className={styles.num}>{Math.round(prefs.quality * 100)}</span>
            </label>
          )}
        </section>
      </div>
      {/* Always in view at the bottom, whatever the panel scrolls to. */}
      <div className={styles.footer}>
        {video ? (
          <div className={styles.actions}>
            <button className={styles.primary} disabled={!p.frame || busy || !container} onClick={record}>
              <Icon name={busy ? 'hourglass_empty' : 'movie'} size={16} />
              <span>{busy ? `Recording… ${Math.round(progress * 100)}%` : `Export ${container?.label ?? 'video'}`}</span>
            </button>
          </div>
        ) : (
        <div className={styles.actions}>
          <button className={styles.primary} disabled={!p.frame || busy} onClick={save}>
            <Icon name={busy ? 'hourglass_empty' : 'download'} size={16} />
            <span>{busy ? 'Rendering…' : `Export ${format.label}`}</span>
          </button>
          <button className={styles.copy} disabled={!p.frame || busy} onClick={copy} title="Copy the picture to the clipboard (as PNG)">
            <Icon name={copied ? 'check' : 'photo_library'} size={16} />
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        )}
        <p className={`${styles.hint} ${styles.file}`}>
          {error
            ? `Couldn't render: ${error}`
            : video
              ? container
                ? late > 0
                  ? `${late} frames came out late: the video may stutter. Try a smaller scale.`
                  : `${videoFile} · ${videoPixels![0]} × ${videoPixels![1]} px · ${(playedLength(recorded, prefs.playbackSpeed) ?? sequenceDuration(prefs.sequence)).toFixed(1).replace(/\.0$/, '')} s`
                : "This browser doesn't record video"
              : `${file} · ${p.pixels[0]} × ${p.pixels[1]} px`}
        </p>
      </div>
    </aside>
  );
}

/** What a recording holds, under its buttons: how long, how many touches, its size. */
function recordingSummary(r: { duration: number; taps: { kind: string }[]; width: number; height: number }): string {
  const touches = r.taps.filter((t) => t.kind === 'down').length;
  return `${r.duration.toFixed(1)} s recorded · ${touches} ${touches === 1 ? 'touch' : 'touches'} · ${r.width} × ${r.height} px`;
}

/** An option that's on or off, as the other rows: its name in their column, the switch where their controls start. */
function Toggle({ label, checked, onChange, disabled = false, title }: { label: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <div className={`${styles.field} ${styles.toggle} ${disabled ? styles.toggleOff : ''}`} title={title}>
      <span className={styles.label}>{label}</span>
      <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`${panel.switch} ${checked ? panel.switchOn : ''}`} onClick={() => onChange(!checked)} />
    </div>
  );
}
