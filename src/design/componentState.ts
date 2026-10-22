// A component against the code, as the gallery shows it (the dot beside it in Components, and Info's Status): green,
// it matches the code's component library; amber, it differs (props the widget doesn't have, or a look unlike the code, declared
// beside it: simulatorProps); blue, the app builds it itself; gray, drawn here only, or (lighter) missing in the
// simulator; or (lightest, apart) not replicated on purpose (design/unreplicated).
import { NO_APP } from '../nav/noApp';
import { proposalsAdding } from '../proposals';
import { APP_WIDGETS, WORK } from './handoff';
import type { Library } from './library';
import { acceptedDifferences, declaredDifferences, kindsOf, lookDifferences, type Acceptance } from './simulatorProps';
import { UNREPLICATED, UNREPLICATED_KIND } from './unreplicated';
import { plural, t } from '../i18n/ui';

export interface ComponentState {
  color: string;
  /** A few words: the dot's tooltip and Status' badge. */
  label: string;
  /** One line on what it means for whoever builds it, when the label doesn't say it already (empty: none). */
  summary: string;
  /** Why it differs, each a short line ("size: …", or a look note) and its key (the prop, or the note). */
  reasons: { key: string; text: string }[];
  /** The differences accepted as they are: they don't make it differ. */
  accepted: { key: string; text: string; acceptance: Acceptance }[];
  /** The app's own widget: what it is and the files it's drawn in. */
  where?: { widget: string; files: string[] };
  /** The open proposals that add it to the component library (its code and title). */
  proposals?: { code: string; title: string }[];
}

export const MISSING_COLOR = '#d2d6dc';
/** Not replicated on purpose: no work, so lighter than missing. */
export const UNREPLICATED_COLOR = '#e8eaed';

export function componentState(name: string, built: boolean, lib: Library): ComponentState {
  const none = { reasons: [], accepted: [] };
  const skip = UNREPLICATED[name];
  if (!built && skip) return { color: UNREPLICATED_COLOR, label: t('Not replicated · {kind}', { kind: UNREPLICATED_KIND[skip.kind] }), summary: skip.reason, ...none };
  if (!built) return { color: MISSING_COLOR, label: t('Missing in the simulator'), summary: t('Not built here yet: it has no stories.'), ...none };
  // A class of named constructors (Message) is its kinds: their differences, each under its widget's name.
  const kinds = lib.widget(name) ? [] : kindsOf(name).filter((k) => lib.widget(k));
  if (lib.widget(name) || kinds.length) {
    const of = (n: string, prefix: string) => [
      ...Object.entries(declaredDifferences(n)).map(([key, why]) => ({ key: prefix + key, text: `${prefix}${key}: ${why}` })),
      ...lookDifferences(n).map((l) => ({ key: prefix + l, text: prefix + l })),
    ];
    const reasons = kinds.length ? kinds.flatMap((k) => of(k, `${k} · `)) : of(name, '');
    const accepted = kinds.length ? kinds.flatMap((k) => acceptedDifferences(k).map((a) => ({ ...a, key: `${k} · ${a.key}`, text: `${k} · ${a.text}` }))) : acceptedDifferences(name);
    const n = accepted.length;
    return reasons.length
      ? { color: WORK.differs.color, label: t('Differs from code'), summary: '', reasons, accepted }
      : {
          color: WORK.reuse.color,
          label: n ? plural(n, '{badge} · {n} difference accepted', '{badge} · {n} differences accepted', { badge: WORK.reuse.badge }) : WORK.reuse.badge,
          summary: '',
          reasons,
          accepted,
        };
  }
  const app = APP_WIDGETS[name];
  if (app) {
    // The app's own widget is the reference: what's drawn unlike it (declared beside the component) makes it differ.
    const reasons = [...Object.entries(declaredDifferences(name)).map(([key, why]) => ({ key, text: `${key}: ${why}` })), ...lookDifferences(name).map((l) => ({ key: l, text: l }))];
    const where = { widget: app.widget, files: [app.file, ...(app.also ?? [])] };
    const proposals = proposalsAdding(name).map((p) => ({ code: p.id, title: p.meta.title }));
    const extra = { reasons, accepted: acceptedDifferences(name), where, proposals };
    if (reasons.length) return { color: WORK.differs.color, label: t('Differs from the app'), summary: t('The app draws it on its own; here it’s drawn as Figma has it, unlike the app in:'), ...extra };
    if (app.platform)
      return {
        color: WORK.reuse.color,
        label: t('The platform’s own component'),
        summary: t('Not a component of the app’s or its library’s: the platform draws it, set as the app sets it. Nothing to build.'),
        ...extra,
      };
    return proposals.length
      ? {
          color: WORK.app.color,
          label: t('In the app · ready for the library'),
          summary: t('The app draws it on its own, not with a component of its library. Here it’s a component, and a proposal specifies it to move into the library; until it does, the app’s is the reference.'),
          ...extra,
        }
      : {
          color: WORK.app.color,
          label: t('In the app · not in the library'),
          summary: t('The app draws it on its own, not with a component of its library. Here it’s a component; no proposal moves it into the library yet, so the app’s is the reference.'),
          ...extra,
        };
  }
  // With no app connected, the components on screen are the tour's: HeroCanvas's own, nothing to build.
  if (NO_APP) return { color: WORK.build.color, label: WORK.build.label, summary: t('HeroCanvas’s own, part of its tour: not an app’s. Once your app is connected, its components show here, each matching its code or not.'), ...none };
  return { color: WORK.build.color, label: WORK.build.label, summary: WORK.build.hint, ...none };
}

/** The states a component can be in, as the Components list filters them: each its dot's color. */
export const COMPONENT_STATUSES = [
  { key: 'matches', label: t('Matches code'), color: WORK.reuse.color },
  { key: 'differs', label: t('Differs from code'), color: WORK.differs.color },
  { key: 'app', label: t('In the app'), color: WORK.app.color },
  { key: 'build', label: t('Local'), color: WORK.build.color },
  { key: 'missing', label: t('Missing in the simulator'), color: MISSING_COLOR },
  { key: 'unreplicated', label: t('Not replicated'), color: UNREPLICATED_COLOR },
] as const;

export type ComponentStatus = (typeof COMPONENT_STATUSES)[number]['key'];

/** A component's state as one of COMPONENT_STATUSES (by its dot: each state has a color of its own). */
export const statusOf = (state: Pick<ComponentState, 'color'>): ComponentStatus => COMPONENT_STATUSES.find((s) => s.color === state.color)?.key ?? 'build';
