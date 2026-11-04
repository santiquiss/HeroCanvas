// Capture's device controls, shared by every view that shows a device in 3D (Capture's panel, App Store Assets' device
// layers): its color and metal, its angle, the light and the glass's glare, its shadow. Each takes its values and
// tells what changed; where they're kept is the caller's.
import { TypedNumber } from '../components/TypedNumber';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import panel from '../tools/Panel.module.css';
import styles from './CapturePanel.module.css';
import type { Shadow } from './exportImage';
import { SHADOW_PRESETS, type ShadowPreset } from './prefs';
import type { Finish } from './models';
import { DEFAULT_LIGHT, lightSide, presetAt, PRESET_SIDE, type LightFrom, type Lighting } from './scene';
import { clampTilt, FLAT, isFlat, project, TILT_MAX, TILT_PRESETS, type Tilt } from './tilt';
import { t } from '../i18n/ui';

/** A light preset's tooltip: where it comes from. */
const LIGHT_FROM: Record<LightFrom, string> = { left: t('Light from the left'), top: t('Light from the top'), right: t('Light from the right') };

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

/**
 * A value the caller keeps apart from a default (App Store Assets: one size's own, over the reference's): given, its
 * title reads in the caller's color (`--own-color`) with a button back to the default. Capture passes none.
 */
export type Own = (() => void) | undefined;

function OwnReset({ own }: { own: Own }) {
  if (!own) return null;
  return (
    <button type="button" className={styles.ownReset} onClick={own} title={t('Back to the reference’s')} aria-label={t('Back to the reference’s')}>
      <Icon name="restart_alt" size={14} />
    </button>
  );
}

const ADVANCED_KEY = 'hc.capture.advanced';
type AdvancedPart = 'color' | 'angle' | 'light';

/** Which sections show their fine controls (the sliders), per viewer. */
export function useAdvanced(): [Record<AdvancedPart, boolean>, (part: AdvancedPart) => void] {
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
export function AdvancedButton({ open, onClick, what }: { open: boolean; onClick: () => void; what: string }) {
  return (
    <button className={`${styles.advanced} ${open ? styles.on : ''}`} onClick={onClick} title={open ? t('Hide {what}', { what }) : t('Adjust {what}', { what })} aria-expanded={open}>
      <Icon name="tune" size={14} />
    </button>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, disabled = false }: { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
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


/** An option that's on or off, as the other rows: its name in their column, the switch where their controls start. */
export function Toggle({ label, checked, onChange, disabled = false, title, own }: { label: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; title?: string; own?: Own }) {
  return (
    <div className={`${styles.field} ${styles.toggle} ${disabled ? styles.toggleOff : ''}`} title={title} data-own={own ? '' : undefined}>
      <span className={`${styles.label} ${styles.ownName}`}>
        {label}
        <OwnReset own={own} />
      </span>
      <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`${panel.switch} ${checked ? panel.switchOn : ''}`} onClick={() => onChange(!checked)} />
    </div>
  );
}

/** The device's color: its model's finishes, any color, and (fine controls) how metallic and grainy its body is. */
export function ColorSection({ finishes, color, onColor, light, onLight, own }: { finishes: Finish[]; color: string; onColor: (c: string) => void; light: Lighting; onLight: (l: Lighting) => void; own?: Own }) {
  const [advanced, toggle] = useAdvanced();
  return (
    <>
      <div className={styles.subTitle} data-own={own ? '' : undefined}>
        <span className={styles.ownName}>
          {t('Color')}
          <OwnReset own={own} />
        </span>
        <span className={styles.titleEnd}>
          <span className={styles.muted}>{finishes.find((f) => f.color === color)?.name ?? t('Custom')}</span>
          <AdvancedButton open={advanced.color} onClick={() => toggle('color')} what={t("the metal's look")} />
        </span>
      </div>
      <div className={styles.swatches}>
        {finishes.map((f) => (
          <button key={f.color} className={`${styles.swatch} ${f.color === color ? styles.swatchOn : ''}`} style={{ background: f.color }} title={f.name} onClick={() => onColor(f.color)} />
        ))}
        <label className={`${styles.swatch} ${styles.custom} ${finishes.some((f) => f.color === color) ? '' : styles.swatchOn}`} title={t('Any color')}>
          <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
          <Icon name="palette" size={14} />
        </label>
      </div>
      {advanced.color && (
        <>
      <label className={styles.slider}>
        <span className={styles.label}>{t('Metallic')}</span>
        <input type="range" min={0} max={100} step={5} value={Math.round(light.metal * 100)} onChange={(e) => onLight({ ...light, metal: Number(e.target.value) / 100 })} />
        <TypedNumber className={styles.num} value={Math.round(light.metal * 100)} min={0} max={100} step={5} label={t('Metallic')} onCommit={(v) => onLight({ ...light, metal: v / 100 })} />
      </label>
      <label className={styles.slider}>
        <span className={styles.label}>{t('Grain')}</span>
        <input type="range" min={0} max={100} step={5} value={Math.round(light.grain * 100)} onChange={(e) => onLight({ ...light, grain: Number(e.target.value) / 100 })} />
        <TypedNumber className={styles.num} value={Math.round(light.grain * 100)} min={0} max={100} step={5} label={t('Grain')} onCommit={(v) => onLight({ ...light, grain: v / 100 })} />
      </label>
        </>
      )}
    </>
  );
}

/** The device's angle: facing front, the presets, and (fine controls) its turn and lean. */
/** `hint`: a line under its controls (where else it's turned: App Store Assets' canvas). */
export function AngleSection({ tilt, onTilt, hint, own }: { tilt: Tilt; onTilt: (t: Tilt) => void; hint?: string; own?: Own }) {
  const [advanced, toggle] = useAdvanced();
  const slider = (axis: keyof Tilt, label: string) => (
    <label className={styles.slider}>
      <span className={styles.label}>{label}</span>
      <input type="range" min={-TILT_MAX} max={TILT_MAX} step={1} value={tilt[axis]} onChange={(e) => onTilt(clampTilt({ ...tilt, [axis]: Number(e.target.value) }))} />
      <TypedNumber className={styles.num} value={tilt[axis]} text={`${tilt[axis]}°`} min={-TILT_MAX} max={TILT_MAX} step={1} label={label} onCommit={(v) => onTilt(clampTilt({ ...tilt, [axis]: v }))} />
    </label>
  );
  return (
    <section className={panel.section}>
      <div className={panel.sectionTitle} data-own={own ? '' : undefined}>
        <span className={styles.ownName}>
          {t('Angle')}
          <OwnReset own={own} />
        </span>
        <span className={styles.titleEnd}>
          <span className={styles.muted}>
            {tilt.y}° · {tilt.x}°
          </span>
          <AdvancedButton open={advanced.angle} onClick={() => toggle('angle')} what={t('turn and lean')} />
        </span>
      </div>
      <div className={styles.presets}>
        <button className={styles.iconBtn} disabled={isFlat(tilt)} onClick={() => onTilt(FLAT)} title={t('Reset: face the device')}>
          <Icon name="restart_alt" size={18} />
        </button>
        <span className={styles.presetSep} />
        {TILT_PRESETS.map((t) => (
          <button
            key={t.label}
            className={`${styles.iconBtn} ${t.tilt.x === tilt.x && t.tilt.y === tilt.y ? styles.on : ''}`}
            onClick={() => onTilt(t.tilt)}
            title={t.label}
            aria-label={t.label}
          >
            <TiltGlyph tilt={t.tilt} />
          </button>
        ))}
      </div>
      {advanced.angle && (
        <>
          {slider('y', t('Turn'))}
          {slider('x', t('Lean'))}
        </>
      )}
      {hint && <p className={styles.hint}>{hint}</p>}
    </section>
  );
}

/** The glass's glare: on or off, the lightbox above or below, how strong. */
export interface GlareSettings {
  on: boolean;
  side: 'top' | 'bottom';
  strength: number;
}

/** The scene's light (where it comes from, and its fine controls) and the glass's glare. */
export function LightingSection({ light, onLight, glare, onGlare, own }: { light: Lighting; onLight: (l: Lighting) => void; glare: GlareSettings; onGlare: (g: Partial<GlareSettings>) => void; own?: { light?: Own; glare?: Own } }) {
  const [advanced, toggle] = useAdvanced();
  return (
    <section className={panel.section}>
      <div className={panel.sectionTitle} data-own={own?.light ? '' : undefined}>
        <span className={styles.ownName}>
          {t('Lighting')}
          <OwnReset own={own?.light} />
        </span>
        <span className={styles.titleEnd}>
          {(lightSide(light) !== lightSide(DEFAULT_LIGHT) || light.brightness !== DEFAULT_LIGHT.brightness || light.shine !== DEFAULT_LIGHT.shine) && (
            <button className={styles.link} onClick={() => onLight({ ...DEFAULT_LIGHT, metal: light.metal, grain: light.grain })}>
              <span>{t('Reset')}</span>
            </button>
          )}
          <AdvancedButton open={advanced.light} onClick={() => toggle('light')} what={t('the angle, brightness and shine')} />
        </span>
      </div>
      {/* Where the light comes from: three presets across, the section's width; any angle in Advanced. */}
      <div className={`${styles.presetTiles} ${styles.three}`}>
        {(['left', 'top', 'right'] as LightFrom[]).map((f) => (
          <button key={f} className={`${styles.presetTile} ${presetAt(lightSide(light)) === f ? styles.on : ''}`} onClick={() => onLight({ ...light, from: f, side: undefined })} title={LIGHT_FROM[f]}>
            <LightGlyph side={PRESET_SIDE[f]} />
            <span>{{ left: t('Left'), top: t('Top'), right: t('Right') }[f]}</span>
          </button>
        ))}
      </div>
      {advanced.light && (
        <>
      {/* Any angle across, the presets on it: -40° left, 0° top, 40° right, up to 60° to a side. */}
      <label className={styles.slider} title={t('Where the light is across: the presets are −40°, 0° and 40°')}>
        <span className={styles.label}>{t('Angle')}</span>
        <input
          type="range"
          min={-60}
          max={60}
          step={5}
          value={Math.round(lightSide(light) * 40)}
          onChange={(e) => {
            const side = Number(e.target.value) / 40;
            const at = presetAt(side);
            onLight({ ...light, from: at ?? (side < 0 ? 'left' : 'right'), side: at ? undefined : side });
          }}
        />
        <TypedNumber
          className={styles.num}
          value={Math.round(lightSide(light) * 40)}
          text={`${Math.round(lightSide(light) * 40)}°`}
          min={-60}
          max={60}
          step={5}
          label={t('Angle')}
          onCommit={(v) => {
            const side = v / 40;
            const at = presetAt(side);
            onLight({ ...light, from: at ?? (side < 0 ? 'left' : 'right'), side: at ? undefined : side });
          }}
        />
      </label>
      <label className={styles.slider}>
        <span className={styles.label}>{t('Brightness')}</span>
        <input type="range" min={50} max={150} step={5} value={Math.round(light.brightness * 100)} onChange={(e) => onLight({ ...light, brightness: Number(e.target.value) / 100 })} />
        <TypedNumber className={styles.num} value={Math.round(light.brightness * 100)} min={50} max={150} step={5} label={t('Brightness')} onCommit={(v) => onLight({ ...light, brightness: v / 100 })} />
      </label>
      <label className={styles.slider}>
        <span className={styles.label}>{t('Shine')}</span>
        <input type="range" min={0} max={100} step={5} value={Math.round(light.shine * 100)} onChange={(e) => onLight({ ...light, shine: Number(e.target.value) / 100 })} />
        <TypedNumber className={styles.num} value={Math.round(light.shine * 100)} min={0} max={100} step={5} label={t('Shine')} onCommit={(v) => onLight({ ...light, shine: v / 100 })} />
      </label>
        </>
      )}
      <Toggle label={t('Screen glare')} checked={glare.on} onChange={(on) => onGlare({ on })} title={t('A softbox mirrored in the glass, sliding as the device turns')} own={own?.glare} />
      {glare.on && (
        <>
          <div className={styles.field} title={t('Where the lightbox the glass mirrors is: above the scene (more of it as the screen faces up) or below (as it faces down)')}>
            <span className={styles.label}>{t('Lightbox')}</span>
            <Seg value={glare.side} options={[['top', t('Above')], ['bottom', t('Below')]]} onChange={(side) => onGlare({ side })} />
          </div>
          <label className={styles.slider}>
            <span className={styles.label}>{t('Intensity')}</span>
            <input type="range" min={10} max={100} step={5} value={Math.round(glare.strength * 100)} onChange={(e) => onGlare({ strength: Number(e.target.value) / 100 })} />
            <TypedNumber className={styles.num} value={Math.round(glare.strength * 100)} min={10} max={100} step={5} label={t('Intensity')} onCommit={(v) => onGlare({ strength: v / 100 })} />
          </label>
        </>
      )}
    </section>
  );
}

/** The device's shadow: the presets, and a custom one's softness, distance and opacity. */
export function ShadowSection({ preset, look, onChange, own }: { preset: ShadowPreset; look: Shadow; onChange: (p: { shadowPreset?: ShadowPreset; shadow?: boolean; shadowLook?: Shadow }) => void; own?: Own }) {
  return (
    <section className={panel.section}>
      <div className={panel.sectionTitle} data-own={own ? '' : undefined}>
        <span className={styles.ownName}>
          {t('Shadow')}
          <OwnReset own={own} />
        </span>
      </div>
      <div className={styles.presetTiles}>
        {SHADOW_PRESETS.map((x) => (
          <button
            key={x.id}
            className={`${styles.presetTile} ${preset === x.id ? styles.on : ''}`}
            onClick={() => onChange(x.look ? { shadowPreset: x.id, shadow: true, shadowLook: x.look } : x.id === 'none' ? { shadowPreset: 'none', shadow: false } : { shadowPreset: 'custom', shadow: true })}
            title={x.label}
          >
            <ShadowGlyph look={x.id === 'custom' ? null : (x.look ?? undefined)} />
            <span>{x.label}</span>
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <label className={styles.slider}>
            <span className={styles.label}>{t('Softness')}</span>
            <input type="range" min={0} max={120} step={2} value={look.blur} onChange={(e) => onChange({ shadowLook: { ...look, blur: Number(e.target.value) } })} />
            <TypedNumber className={styles.num} value={look.blur} min={0} max={120} step={2} label={t('Softness')} onCommit={(v) => onChange({ shadowLook: { ...look, blur: v } })} />
          </label>
          <label className={styles.slider}>
            <span className={styles.label}>{t('Distance')}</span>
            <input type="range" min={0} max={80} step={2} value={look.distance} onChange={(e) => onChange({ shadowLook: { ...look, distance: Number(e.target.value) } })} />
            <TypedNumber className={styles.num} value={look.distance} min={0} max={80} step={2} label={t('Distance')} onCommit={(v) => onChange({ shadowLook: { ...look, distance: v } })} />
          </label>
          <label className={styles.slider}>
            <span className={styles.label}>{t('Opacity')}</span>
            <input type="range" min={0} max={80} step={2} value={Math.round(look.opacity * 100)} onChange={(e) => onChange({ shadowLook: { ...look, opacity: Number(e.target.value) / 100 } })} />
            <TypedNumber className={styles.num} value={Math.round(look.opacity * 100)} min={0} max={80} step={2} label={t('Opacity')} onCommit={(v) => onChange({ shadowLook: { ...look, opacity: v / 100 } })} />
          </label>
        </>
      )}
    </section>
  );
}
