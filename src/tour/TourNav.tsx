// The tour's navigation (an AppNavigation, as an app gives one): its two tabs from the manifest, as a glass bar at the
// bottom on phones, a rail on tablets, a column on the iPhone Duo. The simulator places them; this draws them.
import type { CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import type { AppNavigation } from '../contract';
import { useComponent } from '../design/component';
import { useNavRoot } from '../nav/context';
import { useSim } from '../sim/SimContext';
import styles from './TourNav.module.css';

function useTabs() {
  const nav = useNavRoot();
  const current = nav.stack[0].id;
  return nav.tabs.map((id) => {
    const tab = nav.def(id).tab!;
    return { id, icon: tab.icon, label: tab.label, sel: id === current, on: () => nav.goTab(id) };
  });
}

type Tab = ReturnType<typeof useTabs>[number];

function TabIcon({ icon, sel }: { icon: string; sel: boolean }) {
  return <Icon name={icon} size={24} fill={sel} color={sel ? 'var(--tab-tint)' : 'var(--tab-label)'} style={{ position: 'relative' }} />;
}

function TabIndicator({ index, count, size }: { index: number; count?: number; size?: number }) {
  const pos: CSSProperties =
    size != null
      ? { left: 4, width: 40, height: size, top: 4 + Math.max(0, index) * size }
      : { top: 4, bottom: 4, width: `calc((100% - 8px) / ${count})`, left: `calc(4px + ${Math.max(0, index)} * (100% - 8px) / ${count})` };
  return <span className={styles.tabSel} style={{ ...pos, opacity: index < 0 ? 0 : 1 }} />;
}

function TabBar() {
  const { layout } = useSim();
  const tabs = useTabs();
  const hc = useComponent('TabBar', { items: tabs.map((t) => t.label), currentIndex: tabs.findIndex((t) => t.sel) });
  return (
    <div {...hc} className={styles.bottomBar} style={{ paddingBottom: layout.tabPadB }}>
      <div className={`${styles.glass} ${styles.barTabs}`}>
        <TabIndicator index={tabs.findIndex((t) => t.sel)} count={tabs.length} />
        {tabs.map((t) => (
          <button key={t.id} className={styles.barTab} onClick={t.on}>
            <TabIcon icon={t.icon} sel={t.sel} />
            <span className={styles.barLabel} style={{ color: t.sel ? 'var(--tab-tint)' : 'var(--tab-label)' }}>
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

function SideRail() {
  const { layout } = useSim();
  const tabs = useTabs();
  const hc = useComponent('NavigationRail', { items: tabs.map((t) => t.label), currentIndex: tabs.findIndex((t) => t.sel) });
  return (
    <div {...hc} className={styles.rail} style={{ left: layout.safeL, width: layout.railW - layout.safeL, paddingTop: layout.sbH + 30 }}>
      <Column tabs={tabs} />
    </div>
  );
}

function SideNav() {
  const { layout } = useSim();
  const tabs = useTabs();
  const hc = useComponent('NavigationRail', { items: tabs.map((t) => t.label), currentIndex: tabs.findIndex((t) => t.sel) });
  return (
    <div {...hc} className={styles.sideCol} style={{ right: (layout.sideW - 48) / 2, bottom: layout.columnNavBottom }}>
      <Column tabs={tabs} />
    </div>
  );
}

export const TOUR_NAVIGATION: AppNavigation = { TabBar, SideRail, SideNav };
