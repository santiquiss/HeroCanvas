// Who's using the app in the screens: one of the connected app's personas (appConfig.personas), picked in the
// Scenarios panel and kept in the URL (`?persona=`, none: the first). The simulator only carries it; the app reads
// it (usePersona, or the param) and shows that person's data.
import { appConfig } from '../app/config';
import type { Persona } from '../app/types';
import { useUrlParams } from './SimContext';

export const PERSONA_PARAM = 'persona';

export const PERSONAS: Persona[] = appConfig.personas ?? [];
export const DEFAULT_PERSONA: string | undefined = PERSONAS[0]?.id;

export const findPersona = (id: string | null | undefined): Persona | undefined => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

/** The persona of the screen this renders in. */
export function usePersona(): Persona | undefined {
  return findPersona(useUrlParams()(PERSONA_PARAM));
}

/** A persona's avatar URL, or null (no photo: the initial). */
export const avatarUrl = (p: Persona) => (p.avatar ? `${import.meta.env.BASE_URL}${p.avatar}` : null);
