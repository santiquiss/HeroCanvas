// The code's components the simulator doesn't replicate as components of their own, and why: the gallery lists them
// apart (Components' "Not replicated", muted) rather than as missing work. Kept by the app
// (app/connectors/unreplicated.json): { "<Name>": { "kind": "part", "reason": "…" } }.
import { t } from '../i18n/ui';

export type UnreplicatedKind = 'text-styles' | 'part' | 'unused';

export interface Unreplicated {
  kind: UnreplicatedKind;
  /** One line: why, with the code it's read from. */
  reason: string;
}

export const UNREPLICATED_KIND: Record<UnreplicatedKind, string> = {
  'text-styles': t('Applied as text styles'),
  part: t('Part of another component'),
  unused: t('Not used by the app'),
};

const files = import.meta.glob('@app/connectors/unreplicated.json', { eager: true, import: 'default' }) as Record<string, Record<string, Unreplicated>>;

export const UNREPLICATED: Record<string, Unreplicated> = Object.values(files)[0] ?? {};

export const unreplicated = (name: string): Unreplicated | undefined => UNREPLICATED[name];
