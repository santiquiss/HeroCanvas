// A layer's place, as Figma's Position: align it to the image, its anchor's point (X, Y) and its box (W, H) as
// shares of the image, its constraints (which point keeps its place on every size: an edge, or Center for a layer
// centered on the image), and its turn. The shared layout is drawn at every store size: W and H say what's drawn on the size open, and a device that
// fits its box's height there says so.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { t } from '../i18n/ui';
import type { Display } from '../devices/devices';
import { Dropdown, ResetValue } from './controls';
import { sizeOf } from './sizes';
import { anchorSide, fitScale, inShares, leadsByHeight, ptScale, toUnits, type AnchorX, type AnchorY, type Layer } from './shots';
import styles from './StoreAssets.module.css';

const round = (v: number) => Math.round(v * 10000) / 10000;
const pct1 = (v: number) => String(Math.round(v * 1000) / 10);

/** The layer's box as drawn on the size open (shares of its image), read from the canvas; null until it's there. */
function useDrawnSize(id: string, display: Display): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    let el: HTMLElement | null = null;
    const ro = new ResizeObserver(() => read());
    const read = () => {
      if (!el) return;
      // A turned device: its outline as seen (what its W and H are), else its box.
      const turned = el.dataset.storeOutline?.split(' ').map(Number);
      const w = turned ? turned[0] : el.offsetWidth / display.w;
      const h = turned ? turned[1] : el.offsetHeight / display.h;
      setSize((s) => (s && Math.abs(s.w - w) < 1e-4 && Math.abs(s.h - h) < 1e-4 ? s : { w, h }));
    };
    // On the size being edited (every size's row draws the same layer), looked for again now and then: a row drawn
    // late (it waits its turn), or the layer's box drawn anew, is found and measured.
    const find = () => {
      const now = document.querySelector<HTMLElement>(`[data-store-size="${CSS.escape(sizeOf(display) ?? '')}"] [data-store-edited="${CSS.escape(id)}"]`);
      if (now === el) return read();
      if (el) ro.unobserve(el);
      el = now;
      if (el) {
        ro.observe(el);
        read();
      }
    };
    find();
    const poll = setInterval(find, 300);
    return () => {
      clearInterval(poll);
      ro.disconnect();
    };
  }, [id, display]);
  return size;
}

/**
 * A number typed in a field of ours, its unit after it; saved on Enter or leaving it. Its letter (or icon) drags it, as
 * Figma's: across, `step` a pixel, saved as it moves. The arrow keys step it by one of its unit (Shift: ten).
 */
function NumberField({
  prefix,
  unit,
  value,
  num,
  step,
  min = -Infinity,
  max = Infinity,
  title,
  disabled,
  onCommit,
  onUnit,
  unitTitle,
  from,
  onReset,
  follows,
  leads,
}: {
  prefix: ReactNode;
  unit: string;
  value: string;
  /** The value as it's typed (what the drag starts from). */
  num: number;
  step: number;
  min?: number;
  max?: number;
  title: string;
  disabled?: boolean;
  onCommit?: (v: number) => void;
  /** The unit, clicked: the other one (percent or points). */
  onUnit?: () => void;
  unitTitle?: string;
  /** This size's own value (marked in its color), with a reset back to the reference's. */
  from?: 'device';
  onReset?: () => void;
  /** Calculated from the side that leads (the lock): shown, greyed, not typed. */
  follows?: boolean;
  /** The side that leads: its letter in blue, a lock beside it. */
  leads?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const drag = useRef<{ x: number; from: number } | null>(null);
  // The value an arrow last applied, until it comes back as `num`: a key held repeats faster than the render.
  const stepped = useRef<number | null>(null);
  useEffect(() => {
    stepped.current = null;
  }, [num]);
  const off = disabled || !onCommit;
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft.replace(',', '.'));
    setDraft(null);
    if (onCommit && draft.trim() !== '' && Number.isFinite(v)) onCommit(Math.min(max, Math.max(min, v)));
  };
  const scrub = {
    onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
      if (off || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, from: num };
    },
    onPointerMove: (e: PointerEvent<HTMLSpanElement>) => {
      const d = drag.current;
      if (!d || !onCommit) return;
      const v = Math.round((d.from + (e.clientX - d.x) * step) / step) * step;
      onCommit(Math.min(max, Math.max(min, Number(v.toFixed(4)))));
    },
    onPointerUp: () => (drag.current = null),
    onPointerCancel: () => (drag.current = null),
  };
  return (
    <label className={`${styles.numField} ${off ? styles.numOff : ''} ${from ? styles.numFrom : ''} ${follows ? styles.numFollows : ''} ${leads ? styles.numLeads : ''}`} title={title} data-bp={from}>
      <span className={styles.numPrefix} {...scrub}>
        {prefix}
        {leads && <Icon name="lock" size={11} />}
      </span>
      <input
        inputMode="decimal"
        aria-label={title}
        value={draft ?? value}
        disabled={off}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(null);
          // The arrows, as Figma's: one of its unit up or down (Shift: ten), applied at once (the canvas follows,
          // a key held keeps going), from what's typed if it's a number.
          if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && onCommit && !off) {
            e.preventDefault();
            const typed = draft === null ? NaN : Number(draft.replace(',', '.'));
            const base = Number.isFinite(typed) ? typed : (stepped.current ?? num);
            const by = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
            const v = Math.min(max, Math.max(min, Number((base + by).toFixed(4))));
            setDraft(null);
            stepped.current = v;
            onCommit(v);
          }
        }}
      />
      {onUnit ? (
        <button type="button" className={`${styles.numUnit} ${styles.numUnitButton}`} disabled={disabled} onClick={onUnit} title={unitTitle} aria-label={unitTitle}>
          {unit}
        </button>
      ) : (
        <span className={styles.numUnit}>{unit}</span>
      )}
      {from === 'device' && <ResetValue onReset={onReset} disabled={disabled} />}
    </label>
  );
}

/**
 * X and Y as typed: from the edge the layer's anchored to, inward, as Figma's constraints (Left/Top: from that edge;
 * Right/Bottom: from that one; Center: from the middle), negative past the edge. Saved as its point's share from the
 * left or top (Placed.x, y), as before.
 */
const fromEdge = (v: number, a: AnchorX | AnchorY) => (a === 'right' || a === 'bottom' ? 1 - v : a === 'center' ? v - 0.5 : v);
const toEdge = (v: number, a: AnchorX | AnchorY) => (a === 'right' || a === 'bottom' ? 1 - v : a === 'center' ? v + 0.5 : v);

/**
 * `mode`: `free`, a layer placed on the image; `group`, a group (placed, its size its layers'); `child`, a layer in a
 * group (placed by it: its size and turn only).
 */
export function PositionFields({ layer, display, disabled, set, from, reset, mode = 'free' }: { layer: Layer; display: Display; disabled: boolean; set: (patch: Partial<Layer>) => void; from?: (key: string) => 'device' | undefined; reset?: (key: string) => void; mode?: 'free' | 'group' | 'child' }) {
  const drawn = useDrawnSize(layer.id, display);
  // Its sizes as shares of this image (one in points, divided by it): what places it and what the handles size.
  const S = inShares(layer, display);
  const w = drawn?.w ?? S.w;
  const h = drawn?.h ?? 0;
  const sx = anchorSide(layer.ax);
  const sy = anchorSide(layer.ay);
  // An edge keeps the layer where it is (its point moves to that edge); Center centers it on the image, as Figma's.
  const constrainX = (a: AnchorX) => set(a === 'center' ? { ax: undefined, x: 0.5 } : { ax: a, x: round(layer.x + ((anchorSide(a) - sx) * w) / 2) });
  const constrainY = (a: AnchorY) => set(a === 'center' ? { ay: undefined, y: 0.5 } : { ay: a, y: round(layer.y + ((anchorSide(a) - sy) * h) / 2) });
  const ax: AnchorX = layer.ax ?? 'center';
  const ay: AnchorY = layer.ay ?? 'center';
  // A device's box: its width and height; it's drawn as large as fits both, so on some sizes it's narrower.
  const sH = S.kind === 'device' || S.kind === 'shape' ? S.h : undefined;
  const boxH = S.kind === 'device' ? (sH ?? h) : S.kind === 'shape' ? (sH ?? 0) : h;
  // Set in shares, kept in the layer's units.
  const setW = (v: number) => set(toUnits(S.kind === 'device' && sH ? { w: v, h: round((sH * v) / S.w) } : { w: v }, layer, display));
  const hasH = layer.kind === 'shape' || (layer.kind === 'device' && !!layer.h);
  const setH = layer.kind === 'device' || layer.kind === 'shape' ? (v: number) => set(toUnits({ h: v }, layer, display)) : undefined;
  const fitsHeight = S.kind === 'device' && !!sH && !!drawn && drawn.w < S.w - 0.001;
  // Proportioned (a device, an image, a component): one side leads, the other follows its shape (the lock between).
  const proportioned = layer.kind === 'device' || layer.kind === 'image' || layer.kind === 'component';
  const lead = layer.lead ?? 'h';
  // Its shape as drawn: its height over its width, in shares of the image (known once it's drawn).
  const shape = drawn && drawn.w > 0 ? drawn.h / drawn.w : null;
  /**
   * One side set, the other from its shape (as drawn): a device's box made its exact shape, so what's typed is drawn
   * (a box wider than the device drew it narrower than its W).
   */
  const sizeFrom = (side: 'w' | 'h', v: number) => {
    if (!shape) return;
    const nw = side === 'w' ? v : v / shape;
    const nh = nw * shape;
    set(toUnits(layer.kind === 'device' && (sH || side === 'h') ? { w: nw, h: nh } : { w: nw }, layer, display));
  };
  // Percent of the image, or points on every size: the unit clicked switches, the size as it's drawn here kept.
  const pts = (v: number) => Math.round(v * 10) / 10;
  // Points are the breakpoint's reference size's (shots.ts ptScale): this image's sizes over k.
  const k = ptScale(display);
  // Saved shares are the reference's: fit to this image (over f) only for one its height leads.
  const f = leadsByHeight(layer) ? fitScale(display) : 1;
  // A text cycles on to Hug (its words' width) after points; a width typed in sets it aside.
  const hugs = layer.kind === 'text' && !!layer.hug;
  const switchW = () =>
    hugs
      ? set({ hug: undefined, wUnit: '%', w: round(w / f) })
      : layer.kind === 'text' && layer.wUnit === 'pt'
        ? set({ hug: true })
        : set(layer.wUnit === 'pt' ? { wUnit: '%', w: round(S.w / f) } : { wUnit: 'pt', w: pts((S.w * display.w) / k) });
  const switchH = () => set(layer.hUnit === 'pt' ? { hUnit: '%', h: round(boxH) } : { hUnit: 'pt', h: pts((boxH * display.h) / k) });
  const unitTitle = t('Percent of the image, or points on every size: click to switch');
  const wTitle = layer.kind === 'text' ? t('Percent of the image, points on every size, or Hug (as wide as its words): click to switch') : unitTitle;
  const wField = hugs
    ? { unit: t('Hug'), num: (w * display.w) / k, step: 1, value: String(pts((w * display.w) / k)), commit: (v: number) => set({ hug: undefined, ...toUnits({ w: (v * k) / display.w }, { ...layer, wUnit: 'pt' }, display), wUnit: 'pt' }) }
    : layer.wUnit === 'pt'
    ? { unit: 'pt', num: layer.w, step: 1, value: String(pts(layer.w)), commit: (v: number) => setW((v * k) / display.w) }
    // As drawn here (a share of this image, fit included): typed, it's drawn at that (toUnits saves it unfitted).
    : { unit: '%', num: S.w * 100, step: 0.1, value: pct1(S.w), commit: (v: number) => setW(share(v)) };
  const hField = layer.hUnit === 'pt' && hasH
    ? { unit: 'pt', num: (boxH * display.h) / k, step: 1, value: String(pts((boxH * display.h) / k)), commit: (v: number) => setH?.((v * k) / display.h) }
    : { unit: '%', num: boxH * 100, step: 0.1, value: boxH ? pct1(boxH) : '–', commit: (v: number) => setH?.(share(v)) };
  // Aligned to an edge of the image, it's held by that edge; to its middle, centered.
  const ALIGN: { icon: string; label: string; act: () => void }[] = [
    { icon: 'align_horizontal_left', label: t('Align left'), act: () => set({ ax: 'left', x: 0 }) },
    { icon: 'align_horizontal_center', label: t('Align horizontal centers'), act: () => set({ ax: undefined, x: 0.5 }) },
    { icon: 'align_horizontal_right', label: t('Align right'), act: () => set({ ax: 'right', x: 1 }) },
    { icon: 'align_vertical_top', label: t('Align top'), act: () => set({ ay: 'top', y: 0 }) },
    { icon: 'align_vertical_center', label: t('Align vertical centers'), act: () => set({ ay: undefined, y: 0.5 }) },
    { icon: 'align_vertical_bottom', label: t('Align bottom'), act: () => set({ ay: 'bottom', y: 1 }) },
  ];
  const tick = (on: boolean, cls: string, label: string, act: () => void) => (
    <button className={`${styles.cTick} ${cls} ${on ? styles.cTickOn : ''}`} disabled={disabled} onClick={act} title={label} aria-label={label} aria-pressed={on} />
  );
  // Shares of the image, typed and dragged in percent (a tenth a pixel).
  const share = (v: number) => round(v / 100);
  const place = mode !== 'child';
  const size = mode !== 'group';
  return (
    <div className={styles.position}>
      {place && <div className={styles.alignRow}>
        {[ALIGN.slice(0, 3), ALIGN.slice(3)].map((group, i) => (
          <div key={i} className={styles.alignGroup}>
            {group.map((a) => (
              <button key={a.icon} className={styles.alignButton} disabled={disabled} onClick={a.act} title={a.label} aria-label={a.label}>
                <Icon name={a.icon} size={18} />
              </button>
            ))}
          </div>
        ))}
      </div>}
      {place && <div className={styles.numRow}>
        {place && <NumberField from={from?.('x')} onReset={reset && (() => reset('x'))} prefix="X" unit="%" num={fromEdge(layer.x, ax) * 100} step={0.1} value={pct1(fromEdge(layer.x, ax))} title={ax === 'center' ? t('X: from the middle, across (0: centered)') : ax === 'right' ? t('X: from the right edge, inward (negative: past it)') : t('X: from the left edge, inward (negative: past it)')} disabled={disabled} onCommit={(v) => set({ x: round(toEdge(share(v), ax)) })} />}
        {place && <NumberField from={from?.('y')} onReset={reset && (() => reset('y'))} prefix="Y" unit="%" num={fromEdge(layer.y, ay) * 100} step={0.1} value={pct1(fromEdge(layer.y, ay))} title={ay === 'center' ? t('Y: from the middle, down (0: centered)') : ay === 'bottom' ? t('Y: from the bottom edge, inward (negative: past it)') : t('Y: from the top edge, inward (negative: past it)')} disabled={disabled} onCommit={(v) => set({ y: round(toEdge(share(v), ay)) })} />}
      </div>}
      {size && proportioned ? (
        <div className={styles.sizeRow}>
          <NumberField from={from?.('w')} onReset={reset && (() => reset('w'))} prefix="W" unit={wField.unit} num={wField.num} step={wField.step} min={1} value={wField.value} title={lead === 'w' ? t('Width: it leads, the height follows') : t('Width: follows the height')} disabled={disabled} onCommit={lead === 'w' ? (layer.wUnit === 'pt' || hugs ? wField.commit : (v: number) => sizeFrom('w', share(v))) : undefined} onUnit={lead === 'w' ? switchW : undefined} unitTitle={wTitle} follows={lead !== 'w'} leads={lead === 'w'} />
          <button
            type="button"
            className={styles.leadLock}
            data-lead={lead}
            disabled={disabled}
            onClick={() => set({ lead: lead === 'w' ? 'h' : 'w' })}
            title={lead === 'w' ? t('The width leads: click for the height') : t('The height leads: click for the width')}
            aria-label={lead === 'w' ? t('The width leads: click for the height') : t('The height leads: click for the width')}
          >
            <Icon name="link" size={16} />
          </button>
          <NumberField from={from?.('h')} onReset={reset && (() => reset('h'))} prefix="H" unit="%" num={(drawn?.h ?? boxH) * 100} step={0.1} min={1} value={drawn || boxH ? pct1(drawn?.h ?? boxH) : '–'} title={lead === 'h' ? t('Height: it leads, a share of the image’s height on every size') : t('Height: follows the width')} disabled={disabled} onCommit={lead === 'h' ? (v: number) => sizeFrom('h', share(v)) : undefined} follows={lead !== 'h'} leads={lead === 'h'} />
        </div>
      ) : (
        <div className={styles.numRow}>
        {size && <NumberField from={from?.('w')} onReset={reset && (() => reset('w'))} prefix="W" unit={wField.unit} num={wField.num} step={wField.step} min={1} value={wField.value} title={t('Width')} disabled={disabled} onCommit={wField.commit} onUnit={switchW} unitTitle={wTitle} />}
        {size && <NumberField from={from?.('h')} onReset={reset && (() => reset('h'))} prefix="H" unit={hField.unit} num={hField.num} step={hField.step} min={1} value={hField.value} title={t('Height')} disabled={disabled} onCommit={setH && hField.commit} onUnit={hasH ? switchH : undefined} unitTitle={unitTitle} />}
        </div>
      )}
      {fitsHeight && drawn && <p className={styles.positionNote}>{t('Drawn here {w} wide: it fits its box’s height', { w: `${pct1(drawn.w)}%` })}</p>}
      {place && <div className={styles.constraints}>
        <div className={styles.constraintSelects}>
          <Dropdown label={t('Horizontal')} title={t('Horizontal')} value={ax} onChange={(v) => constrainX(v as AnchorX)} options={[{ value: 'left', label: t('Left') }, { value: 'center', label: t('Center') }, { value: 'right', label: t('Right') }]} />
          <Dropdown label={t('Vertical')} title={t('Vertical')} value={ay} onChange={(v) => constrainY(v as AnchorY)} options={[{ value: 'top', label: t('Top') }, { value: 'center', label: t('Center') }, { value: 'bottom', label: t('Bottom') }]} />
        </div>
        <div className={styles.cBox} aria-label={t('Constraints')} title={t('On every size, the edge the constraints pick keeps the same place (X, Y), and the box keeps its share of the image. Center: centered on the image.')}>
          {tick(ay === 'top', styles.cTop, t('Top'), () => constrainY('top'))}
          {tick(ay === 'bottom', styles.cBottom, t('Bottom'), () => constrainY('bottom'))}
          {tick(ax === 'left', styles.cLeft, t('Left'), () => constrainX('left'))}
          {tick(ax === 'right', styles.cRight, t('Right'), () => constrainX('right'))}
          <span className={styles.cInner}>
            {tick(ax === 'center', styles.cMidH, t('Center horizontally'), () => constrainX('center'))}
            {tick(ay === 'center', styles.cMidV, t('Center vertically'), () => constrainY('center'))}
          </span>
        </div>
      </div>}
      <div className={styles.numRow}>
        <NumberField from={from?.('rotate')} onReset={reset && (() => reset('rotate'))} prefix={<Icon name="rotate_right" size={14} />} unit="°" num={layer.rotate} step={1} min={-180} max={180} value={String(layer.rotate)} title={t('Rotation')} disabled={disabled} onCommit={(v) => set({ rotate: Math.round(v) })} />
      </div>
    </div>
  );
}
