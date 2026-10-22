// The tour's navigation (an AppNavigation, as an app gives one): its two tabs from the manifest, as a glass bar at the
// bottom on phones, a rail with labels on tablets, a column on the iPhone Duo. The simulator places them; this draws them.
import type { CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import type { AppNavigation, ColumnBarProps } from '../contract';
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
  return <Icon name={icon} size={24} fill={sel} color={sel ? 'var(--app-primary)' : 'var(--app-text)'} style={{ position: 'relative' }} />;
}

/** The selected tab's pill: across a bar (`count`), down a column (`size`, a tab's height; `wide`: the column's width). */
function TabIndicator({ index, count, size, wide = false }: { index: number; count?: number; size?: number; wide?: boolean }) {
  const pos: CSSProperties =
    size != null
      ? { left: 4, right: wide ? 4 : undefined, width: wide ? undefined : 40, height: size, top: 4 + Math.max(0, index) * size }
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

/** Tablets: the tabs down the left, each its icon and its label beside it, as an iPad's sidebar. */
function SideRail() {
  const { layout } = useSim();
  const tabs = useTabs();
  const hc = useComponent('NavigationRail', { items: tabs.map((t) => t.label), currentIndex: tabs.findIndex((t) => t.sel) });
  return (
    <div {...hc} className={styles.rail} style={{ left: layout.safeL, width: layout.railW - layout.safeL, paddingTop: layout.sbH + 30 }}>
      <div className={`${styles.glass} ${styles.railTabs}`}>
        <TabIndicator index={tabs.findIndex((t) => t.sel)} size={48} wide />
        {tabs.map((t) => (
          <button key={t.id} className={styles.railTab} onClick={t.on}>
            <TabIcon icon={t.icon} sel={t.sel} />
            <span className={styles.railLabel} style={{ color: t.sel ? 'var(--app-primary)' : 'var(--app-text)' }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>
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

/** The iPhone Duo column's toolbar: the bar's glass circles, one under the other. */
function ColumnBar({ back, actions }: ColumnBarProps) {
  return (
    <div className={styles.columnBar}>
      {back && (
        <button className={`${styles.glass} ${styles.columnButton}`} aria-label={back.icon === 'close' ? 'Close' : 'Back'} onClick={back.onPress}>
          <Icon name={back.icon === 'close' ? 'close' : 'arrow_back_ios_new'} size={20} />
        </button>
      )}
      {actions.map((a) => (
        <button key={`${a.icon}:${a.label}`} className={`${styles.glass} ${styles.columnButton}`} aria-label={a.label} title={a.label} onClick={a.onPress}>
          <Icon name={a.icon} size={20} />
        </button>
      ))}
    </div>
  );
}

export const TOUR_NAVIGATION: AppNavigation = { TabBar, SideRail, SideNav, ColumnBar };
