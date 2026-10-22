// Components › Tokens: the design tokens' groups, as the system organizes them (design/tokenCatalog), and a search
// across every token — by its Figma, CSS or code name — that opens its group with it marked.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { groupSize, TOKEN_GROUPS, type TokenGroup } from '../design/tokenCatalog';
import { useGalleryNav, useGalleryRoute } from '../gallery/route';
import styles from './Panel.module.css';
import { SearchField } from './SearchField';
import { t } from '../i18n/ui';

const SECTION_ICON: Record<TokenGroup['section'], string> = { Colors: 'palette', Dimensions: 'straighten', Type: 'text_fields', Effects: 'blur_on', Other: 'more_horiz' };
const SECTIONS = Object.keys(SECTION_ICON) as TokenGroup['section'][];
const SECTION_LABEL: Record<TokenGroup['section'], string> = { Colors: t('Colors'), Dimensions: t('Dimensions'), Type: t('Typography'), Effects: t('Effects'), Other: t('Other') };

/** Every searchable name of a group's entries: [entry name, the texts it's found by]. */
function entries(g: TokenGroup): [string, string[]][] {
  return [
    ...g.tokens.map((t): [string, string[]] => [t.name, [t.name, t.figma, t.code ?? '']]),
    ...(g.textStyles ?? []).map((t): [string, string[]] => [t.name, [t.name, t.figma, t.code ?? '']]),
    ...(g.elevations ?? []).map((t): [string, string[]] => [t.name, [t.name, t.figma, t.code ?? '']]),
  ];
}

export function TokensPanel() {
  const { tokens: open } = useGalleryRoute();
  const { openTokens } = useGalleryNav();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  // The group shown (none while a component or the overview is).
  const current = open == null ? null : open || TOKEN_GROUPS[0].id;
  const found = useMemo(
    () =>
      query
        ? TOKEN_GROUPS.flatMap((g) =>
            entries(g)
              .filter(([, texts]) => texts.some((t) => t.toLowerCase().includes(query)))
              .map(([name]) => ({ group: g, name })),
          ).slice(0, 80)
        : [],
    [query],
  );

  return (
    <>
      <SearchField placeholder={t('Search tokens (Figma, CSS, code)')} value={q} onChange={setQ} />
      {query ? (
        <div style={{ paddingBottom: 12 }}>
          {!found.length && <div className={styles.muted} style={{ padding: '8px 12px' }}>{t('No tokens match')}</div>}
          {found.map(({ group, name }) => (
            <div key={`${group.id} ${name}`} className={styles.row} style={{ paddingLeft: 12 }} title={name} onClick={() => openTokens(group.id, name)}>
              <span className={styles.name}>{name}</span>
              <span className={styles.muted}>{group.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ paddingBottom: 12 }}>
          {SECTIONS.map((section) => (
            <div key={section}>
              <div className={styles.treeGroup}>{SECTION_LABEL[section]}</div>
              {TOKEN_GROUPS.filter((g) => g.section === section).map((g) => (
                <div key={g.id} className={`${styles.row} ${g.id === current ? styles.current : ''}`} style={{ paddingLeft: 12 }} onClick={() => openTokens(g.id)}>
                  <Icon name={SECTION_ICON[section]} size={16} />
                  <span className={styles.name}>{g.title}</span>
                  <span className={styles.muted}>{groupSize(g)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
