// Components › Overview › Usage: what the page index (every page and variant as it loads, sim/pageIndex) says about
// the components as a whole — the most used, the built ones no page shows, the ones only ever inside another
// component. Derived once per index (it's cached in the browser per build, so it's there at once after the first scan).
import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { ProgressLine, Spinner } from '../components/Loading';
import { nesting, rescan, useIndexBuiltAt, usePageIndex, useScanProgress, type PageIndex } from '../sim/pageIndex';
import { useUrlParams } from '../sim/SimContext';
import { useGalleryNav } from './route';
import styles from './UsageStats.module.css';
import { plural, t } from '../i18n/ui';

/** How many of the most used it lists. */
const TOP = 12;

interface Usage {
  name: string;
  /** Instances on all pages (each variant counted). */
  count: number;
  /** Pages it's on (a page with variants counts once). */
  pages: number;
  /** Instances on the page itself (the rest are inside other components). */
  own: number;
  inside: [string, number][];
}

function usageOf(index: PageIndex): Usage[] {
  return Object.entries(index)
    .map(([name, places]) => ({ name, count: places.reduce((s, p) => s + (p.count ?? 1), 0), pages: new Set(places.map((p) => p.id)).size, ...nesting(places) }))
    .sort((a, b) => b.count - a.count || b.pages - a.pages);
}

export function UsageStats({ built }: { built: string[] }) {
  const get = useUrlParams();
  const design = get('proposal') ?? 'live';
  const index = usePageIndex(design, true);
  const scanning = useScanProgress(design);
  const at = useIndexBuiltAt(design);
  const { openComponent } = useGalleryNav();

  const stats = useMemo(() => {
    if (!index) return null;
    const usage = usageOf(index);
    const used = new Set(usage.map((u) => u.name));
    return {
      usage,
      instances: usage.reduce((s, u) => s + u.count, 0),
      pages: new Set(Object.values(index).flatMap((ps) => ps.map((p) => p.id))).size,
      builtUsed: built.filter((n) => used.has(n)).length,
      unused: built.filter((n) => !used.has(n)).sort(),
      onlyInside: usage.filter((u) => u.own === 0),
    };
  }, [index, built]);

  return (
    <section className={styles.usage}>
      <div className={styles.head}>
        <span className={styles.title}>{t('Usage')}</span>
        {stats ? (
          <span className={styles.meta}>
            {at ? t('From every page and variant as it loads · scanned {ago}', { ago: ago(at) }) : t('From every page and variant as it loads')}
            <button className={styles.rescan} onClick={() => rescan(design)} title={t('Scan the pages again (after changing them)')}>
              <Icon name="refresh" size={14} />
              {t('Rescan')}
            </button>
          </span>
        ) : (
          <span className={styles.meta}>
            <Spinner size={12} /> {scanning != null ? t('Scanning the pages · {pct}%', { pct: Math.round(scanning * 100) }) : t('Scanning the pages…')}
          </span>
        )}
      </div>
      {!stats ? (
        <ProgressLine value={scanning ?? 0} />
      ) : (
        <>
          <div className={styles.tiles}>
            <Tile value={t('{n} of {total}', { n: stats.builtUsed, total: built.length })} label={t('built components on a page')} />
            <Tile value={stats.instances.toLocaleString()} label={plural(stats.pages, 'instances on {n} page', 'instances on {n} pages')} />
            <Tile value={String(stats.unused.length)} label={t('built, on no page')} />
            <Tile value={String(stats.onlyInside.length)} label={t('only inside other components')} />
          </div>

          <div className={styles.cols}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>{t('Most used')}</h3>
              <div className={styles.rank}>
                {stats.usage.slice(0, TOP).map((u, i) => (
                  <button key={u.name} className={styles.rankRow} onClick={() => openComponent(u.name)} title={inside(u)}>
                    <span className={styles.pos}>{i + 1}</span>
                    <span className={styles.rankName}>
                      {u.name}
                      <span className={styles.bar}>
                        <span style={{ width: `${(u.count / stats.usage[0].count) * 100}%` }} />
                      </span>
                    </span>
                    <span className={styles.num}>
                      {u.count}
                      <span className={styles.dim}>
                        {' '}
                        · {plural(u.pages, '{n} page', '{n} pages')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.side}>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  {t('Built, on no page')} <span className={styles.dim}>{stats.unused.length}</span>
                </h3>
                <p className={styles.note}>{t('Not on any page as it loads: unused, or only in a sheet, a dialog or a state.')}</p>
                <div className={styles.chips}>
                  {stats.unused.map((n) => (
                    <button key={n} className={styles.chip} onClick={() => openComponent(n)}>
                      {n}
                    </button>
                  ))}
                  {!stats.unused.length && <span className={styles.dim}>{t('None: every built component is on a page.')}</span>}
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  {t('Only inside other components')} <span className={styles.dim}>{stats.onlyInside.length}</span>
                </h3>
                <p className={styles.note}>{t("Never on a page by itself: a part of the ones it's in.")}</p>
                <div className={styles.chips}>
                  {stats.onlyInside.map((u) => (
                    <button key={u.name} className={styles.chip} onClick={() => openComponent(u.name)} title={inside(u)}>
                      {u.name}
                      <span className={styles.chipIn}>{t('in {name}', { name: u.inside[0]?.[0] ?? '' })}{u.inside.length > 1 ? ` +${u.inside.length - 1}` : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.dim}>{label}</span>
    </div>
  );
}

/** "Inside ListSection ×36, ListTile ×30 · 2 on the page" for a tooltip. */
function inside(u: Usage): string {
  const parts = u.inside.map(([p, n]) => `${p} ×${n}`);
  return [parts.length ? t('Inside {list}', { list: parts.join(', ') }) : '', u.own ? t('{n} on the page', { n: u.own }) : ''].filter(Boolean).join(' · ');
}

function ago(at: number): string {
  const m = Math.round((Date.now() - at) / 60000);
  return m < 1 ? t('just now') : m < 60 ? t('{m} min ago', { m }) : t('{h} h ago', { h: Math.round(m / 60) });
}
