// The designer's multi-select: a button that opens a list of options, each with a checkbox (and, optionally, a dot of
// its color and a count). None checked means all: the button says so. Closes on Escape or a click outside; the arrows
// move between the options. Designer UI (not an app component): e.g. the Components list's state filter.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../components/Icon';
import styles from './CheckDropdown.module.css';

export interface CheckOption<V extends string> {
  value: V;
  label: string;
  /** A dot before the label, in this color. */
  color?: string;
  /** A number at the end of the row (how many there are). */
  count?: number;
}

export interface CheckDropdownProps<V extends string> {
  /** What it filters, before the choice on the button ("State"). */
  label: string;
  options: CheckOption<V>[];
  /** The checked values; none: all. */
  selected: V[];
  onChange: (selected: V[]) => void;
  /** The button's text when none is checked. Default "All". */
  allLabel?: string;
}

export function CheckDropdown<V extends string>({ label, options, selected, onChange, allLabel = 'All' }: CheckDropdownProps<V>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  // Listeners only while open; the first option takes focus so the arrows start there.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('input')?.focus();
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      root.current?.querySelector<HTMLElement>('button')?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const boxes = [...(list.current?.querySelectorAll<HTMLElement>('input') ?? [])];
      const i = boxes.indexOf(document.activeElement as HTMLElement);
      boxes[(i + (e.key === 'ArrowDown' ? 1 : boxes.length - 1)) % boxes.length]?.focus();
    }
  };

  const toggle = (v: V) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const picked = options.filter((o) => selected.includes(o.value));
  const summary = !picked.length ? allLabel : picked.length === 1 ? picked[0].label : `${picked.length} selected`;

  return (
    <div ref={root} className={styles.root} onKeyDown={open ? onKey : undefined}>
      <button className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`} aria-haspopup="true" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className={styles.label}>{label}</span>
        {picked.some((o) => o.color) && (
          <span className={styles.dots}>
            {picked.map((o) => o.color && <span key={o.value} className={styles.dot} style={{ background: o.color }} />)}
          </span>
        )}
        <span className={styles.summary}>{summary}</span>
        <Icon name="unfold_more" size={16} color="var(--ui-text-muted)" />
      </button>
      {open && (
        <div ref={list} id={id} className={styles.menu} role="group" aria-label={label}>
          {options.map((o) => (
            <label key={o.value} className={styles.option}>
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.color && <span className={styles.dot} style={{ background: o.color }} />}
              <span className={styles.optionLabel}>{o.label}</span>
              {o.count != null && <span className={styles.count}>{o.count}</span>}
            </label>
          ))}
          <button className={styles.clear} disabled={!selected.length} onClick={() => onChange([])}>
            <span>Show all</span>
          </button>
        </div>
      )}
    </div>
  );
}
