// The Scenarios panel's persona: the one in use as a card, and a dropdown to pick another (one row each: avatar,
// name, who they are). ui-sdk's Select (try-ui-library): opening, closing, the keyboard, typing a name, focus and
// keeping the list on screen are its; the rows and their look are ours.
import { Select, SelectContent, SelectItem, SelectTrigger } from '@ui-sdk/react/select';
import { useSearchParams } from 'react-router';
import type { Persona } from '../contract';
import { Icon } from '../components/Icon';
import { APP_CONTROLS, DEFAULT_PERSONA, findPersona, PERSONA_PARAM, PERSONAS } from '../sim/persona';
import { useUrlPatch } from '../sim/SimContext';
import surface from '../theme/surface.module.css';
import styles from './Panel.module.css';
import { t } from '../i18n/ui';

/** Who the screens show when the app has no personas: anyone, with the app's own sample data. */
export const ANONYMOUS: Persona = { id: 'anonymous', name: t('Anonymous user'), description: t('Anyone, with the app’s sample data') };

/**
 * The persona in the URL, and picking one (the default is no param). With no personas, the anonymous user: the
 * picker still shows, to say what personas are.
 */
export function usePersonaParam(): [Persona, (id: Persona['id']) => void] {
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  // Another persona brings their own values for the app's controls: what was changed for the last one goes.
  const pick = (id: string) => patch({ [PERSONA_PARAM]: id === DEFAULT_PERSONA ? null : id, ...Object.fromEntries(APP_CONTROLS.map((c) => [c.param, null])) });
  return [findPersona(search.get(PERSONA_PARAM)) ?? ANONYMOUS, pick];
}

export function PersonaPicker({ persona, onPick }: { persona: Persona; onPick: (id: Persona['id']) => void }) {
  const people = PERSONAS.length ? PERSONAS : [ANONYMOUS];
  return (
    <Select value={persona.id} onValueChange={(id) => typeof id === 'string' && onPick(id)}>
      <SelectTrigger aria-label={t('Persona')} className={`${styles.persona} ${styles.personaTrigger}`}>
        <PersonaRow persona={persona} />
        <Icon name="unfold_more" size={18} color="var(--ui-text-muted)" />
      </SelectTrigger>
      <SelectContent className={styles.personaMenu} sideOffset={6} align="start" alignOffset={-6}>
        {people.map((p) => (
          <SelectItem key={p.id} value={p.id} label={p.name} className={styles.persona}>
            <PersonaRow persona={p} />
            <Icon name="check" size={18} color="var(--ui-text)" className={styles.personaCheck} />
          </SelectItem>
        ))}
        {/* No personas yet: the empty state, under the one user there is. */}
        {!PERSONAS.length && (
          <div className={`${surface.empty} ${styles.personaEmpty}`}>
            <span className={surface.emptyIcon}>
              <Icon name="group" size={22} />
            </span>
            <span className={surface.emptyTitle}>{t('No personas yet')}</span>
            <span className={surface.emptyBody}>
              {t('Personas are who the app is tried as: a new user with nothing yet, someone on a paid plan, an admin with a busy team. Each brings their own data, and every screen shows theirs. Ask your agent: “Create personas for my app.”')}
            </span>
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

/** Avatar, then name, then who they are. */
export function PersonaRow({ persona: p }: { persona: Persona }) {
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

