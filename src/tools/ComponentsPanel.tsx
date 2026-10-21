// Component tree for the gallery: Figma tiers, then catalog-only and local (or one A–Z list); built first, search,
// a filter by state against the code (the dots), counts.
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { CATALOG } from '../design/catalog';
import { componentIcon } from '../design/element';
import { componentGroups, GROUP_TITLES, groupTitle, type GroupKey } from '../design/figma';
import { useGalleryNav, useGalleryRoute, useStories } from '../gallery/route';
import { COMPONENT_STATUSES, componentState, MISSING_COLOR, statusOf, type ComponentStatus } from '../design/componentState';
import { useLibrary } from '../design/library';
import styles from './Panel.module.css';
import { SearchField } from './SearchField';
import { CheckDropdown } from './CheckDropdown';

type Grouping = 'tiers' | 'az';
interface ListPrefs {
  /** The states shown; none: all. */
  statuses: ComponentStatus[];
  grouping: Grouping;
}

/** How each viewer last left the list (a convenience: the list works without it). */
const PREFS_KEY = 'hc.components.list';
function readPrefs(): ListPrefs {
  try {
    return { statuses: [], grouping: 'tiers', ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { statuses: [], grouping: 'tiers' };
  }
}

export function ComponentsPanel() {
  const { name } = useGalleryRoute();
  const { openComponent } = useGalleryNav();
  const [q, setQ] = useState('');
  // Not replicated (design/unreplicated): closed, apart from the work, unless searched for, picked in the filter, or open.
  const [showSkipped, setShowSkipped] = useState(false);
  const [prefs, setPrefsState] = useState(readPrefs);
  const setPrefs = (next: ListPrefs) => {
    setPrefsState(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Storage off (a private window): the choice lasts this visit.
    }
  };
  const query = q.trim().toLowerCase();

  const { stories: STORIES } = useStories();
  const lib = useLibrary();
  // Its dot: the component against the code (design/componentState); gray while the code's API loads.
  const stateOf = (n: string) => (lib ? componentState(n, STORIES.has(n), lib) : { color: STORIES.has(n) ? '#9aa0a8' : MISSING_COLOR, label: '' });
  const groups = componentGroups(CATALOG.keys(), STORIES.keys(), (n) => lib?.widget(n)?.tier ?? CATALOG.get(n)?.tier);
  const tiers = Object.keys(GROUP_TITLES) as GroupKey[];
  const matches = (n: string) => !query || n.toLowerCase().includes(query);
  // The count beside each state: what the search leaves, before the state filter. (Built only: every state but
  // Missing and Not replicated.)
  const counts = new Map<ComponentStatus, number>();
  for (const t of tiers) for (const n of groups[t]) if (matches(n)) counts.set(statusOf(stateOf(n)), (counts.get(statusOf(stateOf(n))) ?? 0) + 1);
  const shown = (n: string) => matches(n) && (!prefs.statuses.length || prefs.statuses.includes(statusOf(stateOf(n))));
  const names = (g: GroupKey) => groups[g].filter(shown).sort((a, b) => Number(STORIES.has(b)) - Number(STORIES.has(a)) || a.localeCompare(b));
  const skippedPicked = prefs.statuses.includes('unreplicated');

  const row = (n: string, skipped = false) => {
    const has = STORIES.has(n);
    const state = stateOf(n);
    return (
      <div
        key={n}
        className={`${styles.row} ${n === name ? styles.current : ''}`}
        style={{ paddingLeft: 12 }}
        onClick={() => openComponent(n)}
        title={skipped && 'summary' in state ? state.summary : undefined}
      >
        {/* Its kind (Figma's tier, as its page's badge; else the catalog's), its name, at the end its state against the code. */}
        <Icon name={componentIcon(n)} size={14} color={has ? 'var(--ui-text-muted)' : 'var(--ui-text-faint)'} />
        <span className={styles.name} style={{ color: has || n === name ? undefined : 'var(--ui-text-subtle)' }}>
          {n}
        </span>
        <span className={styles.dot} style={{ background: state.color, marginLeft: 'auto' }} title={state.label} />
      </div>
    );
  };

  // A–Z: one list. The not-replicated stay out of it, as they're closed in the tiers, unless searched for or picked.
  const all = prefs.grouping === 'az' ? tiers.flatMap((t) => (t === 'unreplicated' && !query && !skippedPicked ? [] : groups[t].filter(shown))).sort((a, b) => a.localeCompare(b)) : [];

  return (
    <>
      <SearchField placeholder="Search components" value={q} onChange={setQ} />
      <div className={styles.listTools}>
        <CheckDropdown
          label="State"
          options={COMPONENT_STATUSES.map((s) => ({ value: s.key, label: s.label, color: s.color, count: counts.get(s.key) ?? 0 }))}
          selected={prefs.statuses}
          onChange={(statuses) => setPrefs({ ...prefs, statuses })}
        />
        <div className={styles.segment} title="Group by tier, or one list A–Z">
          {(
            [
              ['tiers', 'Tiers'],
              ['az', 'A–Z'],
            ] as const
          ).map(([g, label]) => (
            <button key={g} className={`${styles.btn} ${prefs.grouping === g ? styles.btnActive : ''}`} onClick={() => setPrefs({ ...prefs, grouping: g })}>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={`${styles.row} ${name == null ? styles.current : ''}`} style={{ paddingLeft: 8 }} onClick={() => openComponent(null)}>
        <Icon name="dashboard" size={16} />
        <span className={styles.name}>Overview</span>
      </div>
      {prefs.grouping === 'az' ? (
        <div style={{ paddingTop: 6 }}>
          {all.length ? all.map((n) => row(n, statusOf(stateOf(n)) === 'unreplicated')) : <span className={styles.muted} style={{ display: 'block', padding: '6px 12px' }}>No components</span>}
        </div>
      ) : (
        tiers.map((tier) => {
          const title = groupTitle(tier, groups);
          const list = names(tier);
          if (!list.length) return null;
          const built = list.filter((n) => STORIES.has(n)).length;
          const skipped = tier === 'unreplicated';
          const open = !skipped || showSkipped || !!query || skippedPicked || (name != null && list.includes(name));
          return (
            <div key={tier} style={{ paddingTop: 6 }}>
              <div
                className={styles.sectionTitle}
                style={{ padding: '6px 12px 2px', margin: 0, ...(skipped ? { color: 'var(--ui-text-subtle)', cursor: 'pointer' } : {}) }}
                onClick={skipped ? () => setShowSkipped(!open) : undefined}
                title={skipped ? 'Library components not replicated on purpose: text styles, parts drawn inside another component, components the app doesn’t use' : undefined}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {skipped && <Icon name={open ? 'expand_more' : 'chevron_right'} size={14} />}
                  {title}
                </span>
                <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  {skipped ? list.length : `${built}/${list.length}`}
                </span>
              </div>
              {open && list.map((n) => row(n, skipped))}
            </div>
          );
        })
      )}
    </>
  );
}
