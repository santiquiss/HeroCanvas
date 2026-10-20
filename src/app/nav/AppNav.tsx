// The demo app's navigation (AppNavigation): its tabs from the page manifest, as a glass bar at the bottom (phones), a
// rail on the left (tablets, open foldables) and a column at the right (the iPhone Duo). The selected tab's pill slides
// to the one you pick. The simulator places them per layout; this draws them.
import type { CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { useComponent } from '../../design/component';
import { useNavRoot } from '../../nav/context';
import { useSim } from '../../sim/SimContext';
import { useT, type T } from '../i18n';
import styles from './AppNav.module.css';

/** The tabs' texts, by the manifest's tab label. */
const TAB_TEXT: Record<string, Parameters<T>[0]> = { Today: 'nav.today', Projects: 'nav.projects', Profile: 'nav.profile' };

/** The manifest's tabs, in order, in the screen's language: which is selected, and what a tap does. */
export function useTabs() {
  const t = useT();
  const nav = useNavRoot();
  const current = nav.stack[0].id;
  return nav.tabs.map((id) => {
    const tab = nav.def(id).tab!;
    const key = TAB_TEXT[tab.label];
    return { id, icon: tab.icon, label: key ? t(key) : tab.label, sel: id === current, on: () => nav.goTab(id) };
  });
}

type Tab = ReturnType<typeof useTabs>[number];

function TabIcon({ icon, sel }: { icon: string; sel: boolean }) {
  return <Icon name={icon} size={24} fill={sel} color={sel ? 'var(--app-primary)' : 'var(--app-text)'} style={{ position: 'relative' }} />;
}

/** The selected tab's pill: across the bar (`count` equal tabs) or down a column (`size` tall tabs). */
function TabIndicator({ index, count, size }: { index: number; count?: number; size?: number }) {
  const pos: CSSProperties =
    size != null
      ? { left: 4, width: 40, height: size, top: 4 + Math.max(0, index) * size }
      : { top: 4, bottom: 4, width: `calc((100% - 8px) / ${count})`, left: `calc(4px + ${Math.max(0, index)} * (100% - 8px) / ${count})` };
  return <span className={styles.tabSel} style={{ ...pos, opacity: index < 0 ? 0 : 1 }} />;
}

/** Phones: a glass bar of tabs, each its icon over its name. */
export function TabBar() {
  const { layout } = useSim();
  const tabs = useTabs();
  const mf = useComponent('TabBar', { items: tabs.map((t) => t.label), currentIndex: tabs.findIndex((t) => t.sel) });
  return (
    <div {...mf} className={styles.bottomBar} style={{ paddingBottom: layout.tabPadB }}>
      <div className={`${styles.glass} ${styles.barTabs}`}>
        <TabIndicator index={tabs.findIndex((t) => t.sel)} count={tabs.length} />
        {tabs.map((t) => (
          <button key={t.id} className={styles.barTab} onClick={t.on}>
            <TabIcon icon={t.icon} sel={t.sel} />
            <span className={styles.barLabel} style={{ color: t.sel ? 'var(--app-primary)' : 'var(--app-text)' }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Column({ tabs }: { tabs: Tab[] }) {
  return (
    <div className={`${styles.glass} ${styles.columnTabs}`}>
      <TabIndicator index={tabs.findIndex((t) => t.sel)} size={56} />
      {tabs.map((t) => (
        <button key={t.id} className={styles.sideTab} title={t.label} onClick={t.on}>
          <TabIcon icon={t.icon} sel={t.sel} />
        </button>
      ))}
    </div>
  );
}

/** Tablets and open foldables: a column of tabs on the left. */
export function SideRail() {
  const { layout } = useSim();
  const tabs = useTabs();
  const mf = useComponent('NavigationRail', { items: tabs.map((t) => t.label), currentIndex: tabs.findIndex((t) => t.sel) });
  return (
    <div {...mf} className={styles.rail} style={{ left: layout.safeL, width: layout.railW - layout.safeL, paddingTop: layout.sbH + 30 }}>
      <Column tabs={tabs} />
    </div>
  );
}

/** The iPhone Duo: the column of tabs at the right, in its reserved strip. */
export function SideNav() {
  const { layout } = useSim();
  const tabs = useTabs();
  const mf = useComponent('NavigationRail', { items: tabs.map((t) => t.label), currentIndex: tabs.findIndex((t) => t.sel) });
  return (
    <div {...mf} className={styles.sideCol} style={{ right: (layout.sideW - 48) / 2, bottom: layout.columnNavBottom }}>
      <Column tabs={tabs} />
    </div>
  );
}
