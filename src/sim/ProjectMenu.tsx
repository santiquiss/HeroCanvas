// The toolbar's project picker (herocanvas.config.ts `projects`): the copy's apps, each its own designer at its own
// address (src/project.ts), so going to another loads it. Only with more than one. Each is a link: a new tab opens it
// beside this one. Closes on Escape or a click outside; the arrows move between the rows.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../components/Icon';
import { PROJECT, PROJECTS, projectUrl } from '../project';
import { t } from '../i18n/ui';
import styles from './ProjectMenu.module.css';

export function ProjectMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = PROJECTS.find((p) => p.id === PROJECT.id);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  if (PROJECTS.length < 2 || !current) return null;
  const close = () => {
    setOpen(false);
    root.current?.querySelector<HTMLElement>('button')?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('a') ?? [])];
      const i = rows.indexOf(document.activeElement as HTMLElement);
      rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus();
    }
  };
  return (
    <div ref={root} className={styles.root} onKeyDown={open ? onKey : undefined}>
      <button
        data-tour="projects"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        title={t('Project: which of the team’s apps')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.name}>{current.name}</span>
        <Icon name="expand_more" size={18} />
      </button>
      {open && (
        <div ref={list} id={id} className={styles.menu} role="menu" aria-label={t('Projects')}>
          {PROJECTS.map((p) => {
            const on = p.id === PROJECT.id;
            return (
              <a key={p.id} role="menuitem" aria-current={on || undefined} className={`${styles.row} ${on ? styles.rowOn : ''}`} href={projectUrl(p.path)} onClick={(e) => on && (e.preventDefault(), close())}>
                <span className={styles.check}>{on && <Icon name="check" size={16} />}</span>
                <span className={styles.rowName}>{p.name}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
