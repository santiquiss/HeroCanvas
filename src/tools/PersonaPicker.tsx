// The Scenarios panel's persona: the one in use as a card, and a dropdown to pick another (one row each: avatar,
// name, who they are). Closes on a pick, Escape or a click outside; arrows move between rows.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { Persona } from '../app/types';
import { Icon } from '../components/Icon';
import { DEFAULT_PERSONA, findPersona, PERSONA_PARAM, PERSONAS } from '../sim/persona';
import { useUrlPatch } from '../sim/SimContext';
import styles from './Panel.module.css';

/** The persona in the URL (none when the app has no personas), and picking one (the default is no param). */
export function usePersonaParam(): [Persona | undefined, (id: Persona['id']) => void] {
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  const pick = (id: string) => patch({ [PERSONA_PARAM]: id === DEFAULT_PERSONA ? null : id });
  return [findPersona(search.get(PERSONA_PARAM)), pick];
}

export function PersonaPicker({ persona, onPick }: { persona: Persona; onPick: (id: Persona['id']) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Listeners only while open; the current row takes focus so the arrows start from it.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
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
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const i = rows.indexOf(document.activeElement as HTMLElement);
      rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus();
    }
  };

  return (
    <div ref={root} className={styles.personaPicker} onKeyDown={open ? onKey : undefined}>
      <button className={`${styles.persona} ${styles.personaTrigger} ${open ? styles.personaTriggerOpen : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <PersonaRow persona={persona} />
        <Icon name="unfold_more" size={18} color="var(--ui-text-muted)" />
      </button>
      {open && (
        <div ref={list} className={styles.personaMenu} role="listbox" aria-label="Persona">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={p.id === persona.id}
              className={`${styles.persona} ${p.id === persona.id ? styles.personaOn : ''}`}
              onClick={() => {
                onPick(p.id);
                setOpen(false);
              }}
            >
              <PersonaRow persona={p} />
              <Icon name="check" size={18} color="var(--ui-text)" style={{ visibility: p.id === persona.id ? 'visible' : 'hidden' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Avatar, then name, then who they are. */
function PersonaRow({ persona: p }: { persona: Persona }) {
  return (
    <>
      {p.avatar ? <img className={styles.personaAvatar} src={`${import.meta.env.BASE_URL}${p.avatar}`} alt="" /> : <span className={`${styles.personaAvatar} ${styles.personaInitial}`}>{p.name.charAt(0)}</span>}
      <span className={styles.personaText}>
        <span className={styles.personaHead}>
          <span className={styles.personaName}>{p.name}</span>
        </span>
        {p.description && <span className={styles.personaTagline}>{p.description}</span>}
      </span>
    </>
  );
}
