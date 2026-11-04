// Capture mode's sidebar (in place of the right panel): the device and how it's shown, its angle and color, and the
// export (format, size, background, shadow). The export's settings are per viewer (localStorage); the angle and the
// color live in the shell, shared with the canvas.
import { TypedNumber } from '../components/TypedNumber';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { DEVICES, foldOf, type Device, type DeviceType, type Display } from '../devices/devices';
import type { Layout } from '../sim/layout';
import panel from '../tools/Panel.module.css';
import styles from './CapturePanel.module.css';
import { exportImage, FORMATS, type ImageFormat } from './exportImage';
import { BACKGROUNDS, effectivePrefs, exportBackground, playedLength, PLAYBACK_SPEEDS, presetOf, SIZE_PRESETS, videoOn, type CapturePrefs, type PlaybackSpeed } from './prefs';
import { PersonaPicker, usePersonaParam } from '../tools/PersonaPicker';
import { PERSONAS } from '../sim/persona';
import { ResizeEdge } from '../tools/PanelHost';
import type { BodySpec, Finish } from './models';
import { lightSide, type Lighting } from './scene';
import type { Tilt } from './tilt';
import { recordableMime, VIDEO_CONTAINERS, videoOptionsOf, type VideoContainer } from './video/plan';
import { sequenceDuration, sequenceName } from './video/motion';
import { MotionRows } from './MotionRows';
import { AngleSection, ColorSection, LightingSection, Seg, ShadowSection, Toggle } from './CaptureSections';
import { canRecord } from './video/recording';
import type { InteractionRecording } from './video/useRecording';
import { plural, t } from '../i18n/ui';

const SCALES = [1, 2, 3, 4];
const TYPES: [DeviceType, string][] = [
  ['phone', t('Phones')],
  ['foldable', t('Foldables')],
  ['tablet', t('Tablets')],
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

export function CapturePanel(p: CapturePanelProps) {
  const { prefs, setPrefs } = p;
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
  const formatLabel = video ? (container?.label ?? t('Video')) : format.label;
  const bgNow = exportBackground(prefs, alphaNow);
  const bgName = bgNow === null ? t('Transparent') : (BACKGROUNDS.find((b) => b.color === bgNow)?.name ?? t('Custom'));
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
      if (!container) throw new Error(t("This browser doesn't record video"));
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
                ['image', t('Image'), 'image', t('A picture of the device at the angle you choose')],
                ['video', t('Video'), 'movie', t('A few seconds of the device moving')],
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
        {PERSONAS.length > 0 && (
          <section className={panel.section}>
            <div className={panel.sectionTitle}>
              <span>{t('Persona')}</span>
            </div>
            <PersonaPicker persona={persona} onPick={pickPersona} />
          </section>
        )}

        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>{t('Device')}</span>
          </div>
          {/* A recorded interaction is this device's screen, in this orientation and theme: they stay as recorded. */}
          {deviceLocked && (
            <p className={`${styles.hint} ${styles.lockHint}`}>
              <Icon name="lock" size={14} />
              <span>{t('The interaction was recorded on this device. To change it, its orientation or its theme, record the interaction again.')}</span>
            </p>
          )}
          <label className={`${styles.select} ${deviceLocked ? styles.locked : ''}`}>
            <span>{p.device.name}</span>
            <select value={p.device.id} disabled={deviceLocked} onChange={(e) => p.onDevice(e.target.value)}>
              {TYPES.filter(([type]) => DEVICES.some((d) => d.type === type)).map(([type, label]) => (
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
                ['device', t('3D device'), 'deployed_code', t('The device in 3D: its frame and body, turned, lit, with a shadow')],
                ['screen', t('Screen only'), 'crop_portrait', t('Its screen alone, square, no frame: what a screenshot would be')],
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
              {foldOf(p.device) ? (
                // A foldable: closed or open, its two displays.
                <Seg value={p.display.key} options={[[foldOf(p.device)!.closed.key, t('Closed')], [foldOf(p.device)!.open.key, t('Open')]]} onChange={p.onDisplay} disabled={deviceLocked} />
              ) : (
                <Seg value={p.display.key} options={p.device.displays.map((x) => [x.key, x.label])} onChange={p.onDisplay} disabled={deviceLocked} />
              )}
            </div>
          )}
          <div className={styles.pair}>
            <Seg value={p.land ? 'land' : 'port'} options={[['port', t('Portrait')], ['land', t('Landscape')]]} onChange={(v) => (v === 'land') !== p.land && p.onRotate()} disabled={deviceLocked} />
            <Seg value={p.dark ? 'dark' : 'light'} options={[['light', t('Light')], ['dark', t('Dark')]]} onChange={(v) => (v === 'dark') !== p.dark && p.onTheme()} disabled={deviceLocked} />
          </div>
          {!bare && (
            <>
          <ColorSection finishes={p.finishes} color={p.color} onColor={p.onColor} light={p.light} onLight={p.onLight} />
            </>
          )}
        </section>

        {!bare && (
        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>{t('Background')}</span>
            <span className={styles.muted}>{bgName}</span>
          </div>
          <div className={styles.swatches}>
            <button
              className={`${styles.swatch} ${styles.transparent} ${prefs.background === null && alphaNow ? styles.swatchOn : ''}`}
              disabled={!alphaNow}
              title={alphaNow ? t('Transparent') : t('{format} has no transparency', { format: formatLabel })}
              onClick={() => setPrefs({ background: null })}
            />
            {BACKGROUNDS.map((b) => (
              <button key={b.color} className={`${styles.swatch} ${bgNow === b.color ? styles.swatchOn : ''}`} style={{ background: b.color }} title={b.name} onClick={() => setPrefs({ background: b.color })} />
            ))}
            <label className={`${styles.swatch} ${styles.custom} ${bgNow && !BACKGROUNDS.some((b) => b.color === bgNow) ? styles.swatchOn : ''}`} title={t('Any color')}>
              <input type="color" value={bgNow ?? '#ffffff'} onChange={(e) => setPrefs({ background: e.target.value })} />
              <Icon name="palette" size={14} />
            </label>
          </div>
          {!alphaNow && <p className={styles.hint}>{video ? t('Transparent is only available in WebM.') : t('Transparent is only available in PNG and WebP.')}</p>}
        </section>
        )}

        {video && (
          <section className={panel.section} data-keep>
            <div className={panel.sectionTitle}>
              <span>{t('Interaction')}</span>
            </div>
            {recState.status === 'recording' || recState.status === 'starting' ? (
              <button className={`${styles.showBtn} ${styles.wide} ${styles.recording}`} onClick={p.interaction.stop}>
                <Icon name="stop_circle" size={18} />
                <span>{recState.status === 'starting' ? t('Waiting for permission…') : t('Stop · {seconds} s', { seconds: recState.seconds.toFixed(1) })}</span>
              </button>
            ) : (
              // Record (again), and with a recording, a bin beside it that drops it (back to the still screen).
              <div className={styles.recRow}>
                <button
                  className={`${styles.showBtn} ${styles.wide}`}
                  disabled={!p.frame || !recordable || busy}
                  onClick={() => p.interaction.start(p.frame!)}
                  title={recordable ? t('Record what you do in the prototype: tap, swipe, navigate') : t('Recording the device’s screen needs Chrome')}
                >
                  <Icon name="radio_button_checked" size={18} />
                  <span>{recorded ? t('Record again') : t('Record interaction')}</span>
                </button>
                {recorded && (
                  <button className={`${styles.iconBtn} ${styles.binBtn}`} onClick={p.interaction.discard} title={t('Discard the recording: back to the still screen')} aria-label={t('Discard the recording')}>
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
              <div className={`${styles.field} ${styles.longLabel}`} title={t('How fast the recording plays in the clip: faster makes it shorter')}>
                <span className={styles.label}>{t('Playback speed')}</span>
                <Seg value={prefs.playbackSpeed} options={PLAYBACK_SPEEDS.map((v) => [v, `${v}x`] as [PlaybackSpeed, string])} onChange={(playbackSpeed) => setPrefs({ playbackSpeed })} />
              </div>
              <Toggle label={t('Show touches')} checked={prefs.showTouches} onChange={(showTouches) => setPrefs({ showTouches })} title={t('A circle where each finger touches, over the recording')} />
              </>
            ) : (
              <p className={styles.hint}>
                {recState.status === 'idle' && recState.error
                  ? t("Couldn't record: {error}", { error: recState.error })
                  : t('Use the prototype on the canvas while it records: tap, swipe, navigate; press Esc to stop. Chrome asks for permission to record the tab.')}
              </p>
            )}
          </section>
        )}

        {video && (
          <section className={panel.section}>
            <div className={panel.sectionTitle}>
              <span>{t('Motion')}</span>
            </div>
            <MotionRows sequence={prefs.sequence} recorded={playedLength(recorded, prefs.playbackSpeed)} onChange={(sequence) => setPrefs({ sequence })} />
          </section>
        )}

        {/* The angle: a picture's, or the one a video holds (No motion: custom angle). */}
        {!bare && (!video || prefs.sequence.mid === 'angle') && (
        <AngleSection tilt={p.tilt} onTilt={p.onTilt} />
        )}

        {!bare && (
        <LightingSection light={p.light} onLight={p.onLight} glare={{ on: prefs.glare, side: prefs.glareSide, strength: prefs.glareStrength }} onGlare={(g) => setPrefs({ ...(g.on !== undefined && { glare: g.on }), ...(g.side && { glareSide: g.side }), ...(g.strength !== undefined && { glareStrength: g.strength }) })} />
        )}

        {!bare && (
        <ShadowSection preset={prefs.shadowPreset} look={prefs.shadowLook} onChange={setPrefs} />
        )}


        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>{t('Size')}</span>
            <span className={styles.muted}>
              {(videoPixels ?? p.pixels)[0]} × {(videoPixels ?? p.pixels)[1]} px
            </span>
          </div>
          {!bare && (
            <div className={styles.field}>
              <span className={styles.label}>{t('Mode')}</span>
              <Seg value={prefs.crop} options={[['fit', t('Auto')], ['custom', t('Fixed')]]} onChange={(v) => setPrefs({ crop: v })} />
            </div>
          )}
          {prefs.crop === 'fit' || bare ? (
            <div className={styles.field}>
              <span className={styles.label}>{t('Scale')}</span>
              <Seg value={prefs.scale} options={SCALES.map((s) => [s, `${s}×`] as [number, string])} onChange={(v) => setPrefs({ scale: v })} />
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <span className={styles.label}>{t('Preset')}</span>
                <label className={`${styles.select} ${styles.inline}`}>
                  <span>{preset ? `${preset.group} · ${preset.label}` : t('Custom')}</span>
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
                    <option value="custom">{t('Custom')}</option>
                  </select>
                  <Icon name="expand_more" size={16} />
                </label>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>{t('Pixels')}</span>
                <div className={styles.dims}>
                  <PixelInput value={prefs.size[0]} onChange={(w) => setPrefs({ size: [w, prefs.size[1]] })} label={t('Width')} />
                  <span>×</span>
                  <PixelInput value={prefs.size[1]} onChange={(h) => setPrefs({ size: [prefs.size[0], h] })} label={t('Height')} />
                  <button className={styles.iconBtn} onClick={() => setPrefs({ size: [prefs.size[1], prefs.size[0]] })} title={t('Swap width and height')}>
                    <Icon name="swap_horiz" size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
          {!bare && (
          <label className={styles.slider} title={t("Room between the device (and its shadow) and the picture's edges, in the file's pixels")}>
            <span className={styles.label}>{t('Padding')}</span>
            <input type="range" min={0} max={600} step={10} value={prefs.padding} onChange={(e) => setPrefs({ padding: Number(e.target.value) })} />
            <TypedNumber className={styles.num} value={prefs.padding} min={0} max={600} step={10} label={t('Padding')} onCommit={(v) => setPrefs({ padding: v })} />
          </label>
          )}
        </section>

        <section className={panel.section}>
          <div className={panel.sectionTitle}>
            <span>{t('Export')}</span>
          </div>
          <div className={styles.field} title={video ? t('MP4 plays everywhere; WebM keeps a transparent background') : undefined}>
            <span className={styles.label}>{t('Format')}</span>
            {video ? (
              containers.length > 0 && <Seg value={container.id} options={containers.map((c) => [c.id, c.label] as [VideoContainer, string])} onChange={(v) => setPrefs({ videoContainer: v })} />
            ) : (
              <Seg value={prefs.format} options={FORMATS.map((f) => [f.id, f.label] as [ImageFormat, string])} onChange={(v) => setPrefs({ format: v })} />
            )}
          </div>
          {/* A clip's frame rate and motion blur: how it's written, beside its format. */}
          {video && (
            <>
              <div className={styles.field} title={t('Frames a second: 60 looks smoother; the file is heavier')}>
                <span className={styles.label}>{t('Frames')}</span>
                <Seg value={prefs.fps} options={[[30, '30 fps'], [60, '60 fps']]} onChange={(v) => setPrefs({ fps: v })} />
              </div>
              <Toggle
                label={t('Motion blur')}
                checked={blurs && prefs.motionBlur}
                disabled={!blurs}
                onChange={(motionBlur) => setPrefs({ motionBlur })}
                title={blurs ? t('Each frame blends the motion of its instant, as a camera does: the turn looks continuous') : t('MP4 only: WebM records in real time')}
              />
            </>
          )}
          {!video && prefs.format !== 'png' && (
            <label className={styles.slider}>
              <span className={styles.label}>{t('Quality')}</span>
              <input type="range" min={50} max={100} step={1} value={Math.round(prefs.quality * 100)} onChange={(e) => setPrefs({ quality: Number(e.target.value) / 100 })} />
              <TypedNumber className={styles.num} value={Math.round(prefs.quality * 100)} min={50} max={100} step={1} label={t('Quality')} onCommit={(v) => setPrefs({ quality: v / 100 })} />
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
              <span>{busy ? t('Recording… {percent}%', { percent: Math.round(progress * 100) }) : t('Export {format}', { format: container?.label ?? t('video') })}</span>
            </button>
          </div>
        ) : (
        <div className={styles.actions}>
          <button className={styles.primary} disabled={!p.frame || busy} onClick={save}>
            <Icon name={busy ? 'hourglass_empty' : 'download'} size={16} />
            <span>{busy ? t('Rendering…') : t('Export {format}', { format: format.label })}</span>
          </button>
          <button className={styles.copy} disabled={!p.frame || busy} onClick={copy} title={t('Copy the picture to the clipboard (as PNG)')}>
            <Icon name={copied ? 'check' : 'photo_library'} size={16} />
            <span>{copied ? t('Copied') : t('Copy')}</span>
          </button>
        </div>
        )}
        <p className={`${styles.hint} ${styles.file}`}>
          {error
            ? t("Couldn't render: {error}", { error })
            : video
              ? container
                ? late > 0
                  ? plural(late, '{n} frame came out late: the video may stutter. Try a smaller scale.', '{n} frames came out late: the video may stutter. Try a smaller scale.')
                  : `${videoFile} · ${videoPixels![0]} × ${videoPixels![1]} px · ${(playedLength(recorded, prefs.playbackSpeed) ?? sequenceDuration(prefs.sequence)).toFixed(1).replace(/\.0$/, '')} s`
                : t("This browser doesn't record video")
              : `${file} · ${p.pixels[0]} × ${p.pixels[1]} px`}
        </p>
      </div>
    </aside>
  );
}

/** What a recording holds, under its buttons: how long, how many touches, its size. */
function recordingSummary(r: { duration: number; taps: { kind: string }[]; width: number; height: number }): string {
  const touches = r.taps.filter((t) => t.kind === 'down').length;
  return `${t('{seconds} s recorded', { seconds: r.duration.toFixed(1) })} · ${plural(touches, '{n} touch', '{n} touches')} · ${r.width} × ${r.height} px`;
}
