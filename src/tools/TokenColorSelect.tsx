// Props' control for a color picked from the theme's tokens (options like `var(--app-surface)`):
// each option as a swatch and a name to read — the one the code gives it (`appSurface` → "App
// surface"), else its Figma path — with its group beside it. A native select can't draw a swatch, so it's a small
// menu of our own.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { findToken, TOKEN_GROUPS } from '../design/tokenCatalog';
import styles from './Panel.module.css';
import { t } from '../i18n/ui';

const VAR = /^var\(--([\w-]+)\)$/;

/** Whether every option but none ('') is a theme token. */
export const isTokenColorOptions = (options: string[]) => options.some((o) => o) && options.every((o) => !o || VAR.test(o));

const words = (camel: string) => camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** A token's name to read, its group, and its value (light) for the swatch. */
export function tokenLabel(option: string): { name: string; group: string; swatch: string; css: string } {
  const css = option.match(VAR)?.[1] ?? option;
  const t = findToken(css);
  const path = (t?.figma ?? css.replace(/-/g, '/')).split('/');
  const group = words(path[0] ?? '');
  // The code's name, without the `normal` its default colors carry (`normalBackgroundSurface`).
  const code = t?.code?.split('.').pop()?.replace(/^normal(?=[A-Z])/, '');
  const name = code ? words(code) : words(path.slice(1).filter((p) => p !== 'normal').join(' ') || css);
  return { name, group, swatch: t?.value ?? option, css: `--${css}` };
}

const flat = (c: string) => c.toLowerCase().replace(/\s/g, '');
/** Every color token by its value (light), the system's first, the palette's primitives last: a raw color's name. */
const BY_VALUE = (() => {
  const out = new Map<string, string>();
  const groups = [...TOKEN_GROUPS.filter((g) => g.id !== 'palette'), ...TOKEN_GROUPS.filter((g) => g.id === 'palette')];
  for (const g of groups) for (const t of g.tokens) if (t.kind === 'color' && !out.has(flat(t.base))) out.set(flat(t.base), `var(--${t.name})`);
  return out;
})();

/** The token a raw color is (`rgb(233,19,95)` → background/accent), when it is one. */
export const tokenForColor = (color: string): string | null => BY_VALUE.get(flat(color)) ?? null;

export function TokenColorSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => root.current?.contains(e.target as Node) || setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  // The group only when the options mix them (Background and Text); one group says nothing.
  const showGroup = new Set(options.filter(Boolean).map((o) => tokenLabel(o).group)).size > 1;
  const row = (o: string) => {
    if (!o)
      return (
        <>
          <span className={`${styles.swatch} ${styles.swatchNone}`} />
          <span className={styles.tokenName}>{t('None')}</span>
        </>
      );
    const tok = tokenLabel(o);
    return (
      <>
        <span className={styles.swatch} style={{ background: tok.swatch }} />
        <span className={styles.tokenName}>{tok.name}</span>
        {showGroup && <span className={styles.tokenGroup}>{tok.group}</span>}
      </>
    );
  };
  return (
    <div ref={root} className={styles.tokenSelect}>
      <button className={styles.tokenButton} aria-haspopup="listbox" aria-expanded={open} title={value ? tokenLabel(value).css : t('None')} onClick={() => setOpen(!open)}>
        {row(value)}
        <Icon name="expand_more" size={14} />
      </button>
      {open && (
        <div className={styles.tokenMenu} role="listbox">
          {options.map((o) => (
            <button
              key={o}
              role="option"
              aria-selected={o === value}
              className={`${styles.tokenOption} ${o === value ? styles.tokenOptionOn : ''}`}
              title={o ? tokenLabel(o).css : undefined}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              {row(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
