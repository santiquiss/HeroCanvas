// A slider's value that can also be typed: shown as it reads (`text`), a number to edit on focus. Enter or leaving
// commits it (clamped to the slider's range), Escape drops it, the arrows step it (Shift: ten steps).
import { useState, type CSSProperties } from 'react';
import styles from './TypedNumber.module.css';

export function TypedNumber({
  value,
  text,
  min,
  max,
  step = 1,
  disabled,
  label,
  className,
  style,
  onCommit,
}: {
  /** The number as it's typed (the slider's shown units: 40 for 40%). */
  value: number;
  /** As it reads when not edited (`40%`, `None`); the number by default. */
  text?: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  className?: string;
  style?: CSSProperties;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const round = (v: number) => Number(v.toFixed(4));
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft.replace(',', '.').replace(/[^\d.+-]/g, ''));
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(v)) onCommit(round(clamp(v)));
  };
  return (
    <input
      className={`${styles.typed} ${className ?? ''}`}
      style={style}
      inputMode="decimal"
      aria-label={label}
      title={label}
      disabled={disabled}
      value={draft ?? text ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const typed = Number((draft ?? String(value)).replace(',', '.'));
          const base = Number.isFinite(typed) ? typed : value;
          const v = round(clamp(base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
          setDraft(String(v));
          onCommit(v);
        }
      }}
    />
  );
}
