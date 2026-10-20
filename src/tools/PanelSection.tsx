// The right panel's sections (Inspect, Components' Info and Props): a title that opens and closes its section, with an
// optional icon and something beside it on the right. Which are closed is remembered per viewer for every component
// and element at once (localStorage).
import { useSyncExternalStore, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import styles from './Panel.module.css';

const CLOSED_KEY = 'hc.inspect.closed';
let closed: Set<string> = (() => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(CLOSED_KEY) || '[]'));
  } catch {
    return new Set<string>();
  }
})();
const closedListeners = new Set<() => void>();

/** Whether a section is closed now (for a section that skips building its content while closed). */
export const sectionClosed = (id: string) => closed.has(id);

function toggleSection(id: string) {
  closed = new Set(closed);
  if (!closed.delete(id)) closed.add(id);
  try {
    localStorage.setItem(CLOSED_KEY, JSON.stringify([...closed]));
  } catch {
    /* storage unavailable */
  }
  closedListeners.forEach((l) => l());
}
const subscribeClosed = (l: () => void) => (closedListeners.add(l), () => closedListeners.delete(l));

/**
 * A section's title that opens and closes it (its caret). Closed, the rest of its section is hidden (Panel.module.css:
 * a section that has a closed title). `children` go on the right, while it's open.
 */
export function SectionTitle({ id, title, icon, children }: { id: string; title: string; icon?: string; children?: ReactNode }) {
  const isClosed = useSyncExternalStore(subscribeClosed, () => closed).has(id);
  return (
    <div className={`${styles.sectionTitle} ${isClosed ? styles.sectionClosed : ''}`}>
      <button className={styles.sectionToggle} aria-expanded={!isClosed} onClick={() => toggleSection(id)}>
        <Icon name={isClosed ? 'chevron_right' : 'expand_more'} size={16} />
        {icon && <Icon name={icon} size={14} className={styles.sectionIcon} />}
        <span>{title}</span>
      </button>
      {!isClosed && children}
    </div>
  );
}

/** A whole section: its title (and `aside`, a muted note on the right), then its content. */
export function PanelSection({ id, title, icon, aside, children }: { id: string; title: string; icon?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <SectionTitle id={id} title={title} icon={icon}>
        {aside != null && <span className={styles.sectionAside}>{aside}</span>}
      </SectionTitle>
      {children}
    </div>
  );
}
