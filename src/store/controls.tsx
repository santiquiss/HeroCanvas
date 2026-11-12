// App Store Assets' small controls, drawn as the designer draws them: a choice (the system's menu under a field of
// ours), a slider with its value, a color, a row of segments.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { TypedNumber } from '../components/TypedNumber';
import { t } from '../i18n/ui';
import panel from '../tools/Panel.module.css';
import { Icon } from '../components/Icon';
import styles from './StoreAssets.module.css';

/**
 * A choice as the designer draws one (Scenarios' selects): the system's menu, opened from a field of ours with its
 * chevron inside (a bare select puts it on the edge). With a placeholder it's an action: it shows that, and picks.
 */
export function Dropdown({
  label,
  title,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  title?: string;
  placeholder?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const shown = options.find((o) => o.value === value)?.label ?? placeholder ?? '';
  return (
    <label className={styles.dropdown} title={title}>
      <select aria-label={label} value={value} onChange={(e) => e.target.value && onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className={styles.dropdownValue}>{shown}</span>
      <Icon name="expand_more" size={16} />
    </label>
  );
}

/**
 * The layer's values that are the open size's own (not the reference's), for the controls inside: one given a `field`
 * (the property it edits) marks its own in color, with a reset back to the reference's.
 */
export const OwnValues = createContext<{ from: (key: string) => 'device' | undefined; reset: (key: string) => void } | null>(null);
function useOwn(field: string | undefined, from?: string, onReset?: () => void): { from?: string; onReset?: () => void } {
  const own = useContext(OwnValues);
  if (from !== undefined || !field || !own) return { from, onReset };
  return { from: own.from(field), onReset: () => own.reset(field) };
}

/** Back to the reference's value (this size's own dropped): shown beside a value this size has of its own. */
export function ResetValue({ onReset, disabled }: { onReset?: () => void; disabled?: boolean }) {
  if (!onReset) return null;
  return (
    <button type="button" className={styles.resetValue} disabled={disabled} onClick={onReset} title={t('Back to the reference’s')} aria-label={t('Back to the reference’s')}>
      <Icon name="restart_alt" size={14} />
    </button>
  );
}

/** What the slider's number reads in, against its value (40 for 0.4 shown as 40%): from its own format, at its max. */
const shownScale = (format: (v: number) => string, max: number) => {
  const k = parseFloat(format(max)) / max;
  return Number.isFinite(k) && k !== 0 ? k : 1;
};

/**
 * A value on a track, its number typed too: its label and number above it, or with `inline` in one row as the device
 * sections draw theirs (label, track, number). `from: 'device'`: this size's own value, in its color, with a reset.
 */
export function Slider({ label, value, min, max, step, format, disabled, onChange, field, inline = false, title, ...mark }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; disabled: boolean; onChange: (v: number) => void; field?: string; from?: string; onReset?: () => void; inline?: boolean; title?: string }) {
  const { from, onReset } = useOwn(field, mark.from, mark.onReset);
  const k = shownScale(format, max);
  const round = (v: number) => Math.round(v / step) * step;
  const typed = (
    <TypedNumber
      className={inline ? styles.sliderNum : undefined}
      value={Number((value * k).toFixed(2))}
      text={format(value)}
      min={min * k}
      max={max * k}
      step={step * k}
      disabled={disabled}
      label={label}
      onCommit={(v) => onChange(Number(round(v / k).toFixed(4)))}
    />
  );
  const own = from === 'device';
  if (inline)
    return (
      <div className={styles.sliderInline} title={title} data-bp={own ? from : undefined}>
        <span className={styles.sliderLabel}>{label}</span>
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
        {typed}
        {own && <ResetValue onReset={onReset} disabled={disabled} />}
      </div>
    );
  return (
    <div className={styles.slider} title={title} data-bp={own ? from : undefined}>
      <span className={styles.sliderHead}>
        <span>{label}</span>
        <span className={styles.sliderEnd}>
          {own && <ResetValue onReset={onReset} disabled={disabled} />}
          {typed}
        </span>
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

/** A color: its swatch opens the picker, its hex can be typed. */
export function ColorRow({ label, value, disabled, onChange, field }: { label: string; value: string; disabled: boolean; onChange: (c: string) => void; field?: string }) {
  const { from, onReset } = useOwn(field);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const hex = draft.trim().replace(/^#?/, '#');
    setDraft(null);
    if (/^#[0-9a-f]{6}$/i.test(hex)) onChange(hex.toUpperCase());
    else if (/^#[0-9a-f]{3}$/i.test(hex)) onChange(('#' + [...hex.slice(1)].map((c) => c + c).join('')).toUpperCase());
  };
  return (
    <div className={styles.toggleRow} data-bp={from === 'device' ? from : undefined}>
      <span className={styles.toggleLabel}>
        {label}
        {from === 'device' && <ResetValue onReset={onReset} disabled={disabled} />}
      </span>
      <span className={styles.colorValue}>
        <input
          className={styles.hexField}
          aria-label={label}
          value={draft ?? value.toUpperCase()}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setDraft(null);
          }}
        />
        <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} disabled={disabled} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      </span>
    </div>
  );
}

/** A choice of a few, side by side; `caption`: its name above it (a row of icons or "Aa" says nothing alone). */
export function Segments<T extends string | number>({ label, caption, value, options, disabled, onChange, field, ...mark }: { label: string; caption?: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; disabled: boolean; onChange: (v: T) => void; field?: string; from?: string; onReset?: () => void }) {
  const { from, onReset } = useOwn(field, mark.from, mark.onReset);
  const row = (
    <div className={styles.segments} role="radiogroup" aria-label={label} data-bp={from === 'device' ? from : undefined}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} title={o.title} className={`${styles.segment} ${value === o.value ? styles.segmentOn : ''}`} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
  if (!caption) return row;
  return (
    <div className={styles.captioned}>
      <span className={styles.caption}>
        {caption}
        {from === 'device' && <ResetValue onReset={onReset} disabled={disabled} />}
      </span>
      {row}
    </div>
  );
}

/** On or off, as a switch (the designer's: Capture's Screen glare). */
export function Toggle({ label, value, disabled, onChange, title, field, ...mark }: { label: string; value: boolean; disabled: boolean; onChange: (v: boolean) => void; title?: string; field?: string; from?: string; onReset?: () => void }) {
  const { from, onReset } = useOwn(field, mark.from, mark.onReset);
  return (
    <div className={styles.toggleRow} title={title} data-bp={from === 'device' ? from : undefined}>
      <span className={styles.toggleLabel}>
        {label}
        {from === 'device' && <ResetValue onReset={onReset} disabled={disabled} />}
      </span>
      <button type="button" role="switch" aria-checked={value} aria-label={label} disabled={disabled} className={`${panel.switch} ${value ? panel.switchOn : ''}`} onClick={() => onChange(!value)} />
    </div>
  );
}

/**
 * A stretch on one track: where it starts and where it ends (`low` ≤ `high`), each a handle that can't pass the other.
 * Two of the browser's own ranges laid over one track (only their handles take the pointer), the stretch filled.
 */
export function RangeSlider({ label, low, high, min, max, step, format, disabled, onChange, inline = false, title }: { label: string; low: number; high: number; min: number; max: number; step: number; format: (v: number) => string; disabled: boolean; onChange: (low: number, high: number) => void; inline?: boolean; title?: string }) {
  // A handle's center, as the browser places it: half a handle (8px) in from each end of the track.
  const share = (v: number) => (v - min) / (max - min);
  const value = `${format(low)}–${format(high)}`;
  return (
    <div className={inline ? styles.sliderInline : styles.slider} title={title}>
      {inline ? (
        <span className={styles.sliderLabel}>{label}</span>
      ) : (
        <span className={styles.sliderHead}>
          <span>{label}</span>
          <span className={styles.mono}>{value}</span>
        </span>
      )}
      <div className={styles.range} data-off={disabled || undefined} data-inline={inline || undefined}>
        <span className={styles.rangeTrack} />
        <span className={styles.rangeFill} style={{ left: `calc(8px + (100% - 16px) * ${share(low)})`, right: `calc(8px + (100% - 16px) * ${1 - share(high)})` }} />
        <input type="range" aria-label={`${label}: ${format(low)}`} min={min} max={max} step={step} value={low} disabled={disabled} onChange={(e) => onChange(Math.min(Number(e.target.value), high), high)} />
        <input type="range" aria-label={`${label}: ${format(high)}`} min={min} max={max} step={step} value={high} disabled={disabled} onChange={(e) => onChange(low, Math.max(Number(e.target.value), low))} />
      </div>
      {inline && <span className={`${styles.sliderNum} ${styles.sliderNumWide}`}>{value}</span>}
    </div>
  );
}
