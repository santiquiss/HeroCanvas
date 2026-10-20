// A panel's search (Pages, Layers, Components): fixed at the top while the list scrolls, with a clear button once
// there's text (Escape clears too). `action`: a small button of the list's own beside it (a SearchAction: Collapse /
// Expand all in Pages and Layers).
import { useRef, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import styles from './Panel.module.css';

export function SearchField({ value, placeholder, onChange, action }: { value: string; placeholder: string; onChange: (value: string) => void; action?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    onChange('');
    input.current?.focus();
  };
  return (
    <div className={styles.searchBar}>
      <div className={styles.searchInput}>
        <input
          ref={input}
          className={styles.search}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && value && (e.stopPropagation(), clear())}
        />
        {value && (
          <button className={styles.searchClear} title="Clear search" aria-label="Clear search" onClick={clear}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {action}
    </div>
  );
}

/** An icon button beside a panel's search. */
export function SearchAction({ icon, title, disabled = false, onClick }: { icon: string; title: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={styles.searchAction} title={title} aria-label={title} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={18} />
    </button>
  );
}
