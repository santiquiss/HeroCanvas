// The sample app's lists: a section (an optional header over a card of rows) and its rows (leading, title, subtitle,
// trailing; a tap). Pure: props in, callbacks out.
import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { useComponent } from '../../design/component';
import styles from './List.module.css';

export interface ListSectionProps {
  header?: string;
  children: ReactNode;
}

export function ListSection({ header, children }: ListSectionProps) {
  const mf = useComponent('ListSection', { header });
  return (
    <section {...mf} className={styles.section}>
      {header && <h2 className={styles.header}>{header}</h2>}
      <div className={styles.card}>{children}</div>
    </section>
  );
}

export interface ListTileProps {
  title: string;
  subtitle?: string;
  /** Before the texts (an icon, a checkbox, an avatar). */
  leading?: ReactNode;
  /** After them; with onTap and nothing else, a chevron. */
  trailing?: ReactNode;
  /** Struck through and muted (a done task). */
  muted?: boolean;
  /** In the danger color (Sign out). */
  destructive?: boolean;
  onTap?: () => void;
}

export function ListTile({ title, subtitle, leading, trailing, muted = false, destructive = false, onTap }: ListTileProps) {
  const mf = useComponent('ListTile', { title, subtitle, muted, destructive, onTap });
  const content = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.texts}>
        <span className={`${styles.title} ${muted ? styles.muted : ''} ${destructive ? styles.destructive : ''}`}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing ?? (onTap && !destructive && <Icon name="chevron_right" size={20} color="var(--app-text-muted)" />)}
    </>
  );
  // A tappable row is a role="button" div, not a <button>: it can hold controls of its own (a checkbox).
  return onTap ? (
    <div
      {...mf}
      role="button"
      tabIndex={0}
      className={`${styles.tile} ${styles.tappable}`}
      onClick={onTap}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onTap())}
    >
      {content}
    </div>
  ) : (
    <div {...mf} className={styles.tile}>
      {content}
    </div>
  );
}
