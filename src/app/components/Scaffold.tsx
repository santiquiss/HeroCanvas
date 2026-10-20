// A page's frame, by where the page sits (the manifest's level): a tab's root has a large title and room for the
// navigation under it; a pushed page or a cover has the app bar, back (or close, as the first page in the tablet's
// split panel) and its actions, in a header that stays while the page scrolls. Side padding from the layout, so a
// page beside another pane, the rail or the Duo's column sits as the simulator places it.
import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { useNav, useSplit } from '../../nav/context';
import { useHeaderInset, usePadL, usePadR, useSim } from '../../sim/SimContext';
import { AppBar, type AppBarAction } from './AppBar';
import styles from './Scaffold.module.css';

export interface ScaffoldProps {
  title: string;
  /** Buttons on the right of the header. */
  actions?: AppBarAction[];
  /** A floating button at the bottom right (a tab's +). */
  fab?: { icon: string; semanticLabel: string; onPressed: () => void };
  children: ReactNode;
}

export function Scaffold({ title, actions = [], fab, children }: ScaffoldProps) {
  const { layout } = useSim();
  const nav = useNav();
  const split = useSplit();
  const padL = usePadL();
  const padR = usePadR();
  const insetR = useHeaderInset();
  const level = nav.def(nav.ref.id).level;
  const tab = level === 'tab' && nav.index === 0;
  // The first page pushed into the tablet's split panel closes it instead of going back.
  const below = nav.stack[nav.index - 1];
  const closes = layout.split && level === 'push' && !!below && nav.def(below.id).level === 'tab';
  const paneRoot = split?.role === 'detail' && nav.def(nav.ref.id).parent === split.masterId;
  return (
    <div className={styles.page}>
      <div className={styles.scroll} style={{ paddingLeft: padL, paddingRight: padR, paddingBottom: tab ? layout.padB : layout.padBPush }}>
        {tab ? (
          <header className={styles.largeHeader} style={{ paddingTop: layout.padT, paddingRight: insetR }}>
            <h1 className={styles.largeTitle}>{title}</h1>
            <div className={styles.headerActions}>
              {actions.map((a) => (
                <button key={a.semanticLabel} className={styles.headerButton} title={a.semanticLabel} aria-label={a.semanticLabel} onClick={a.onPressed}>
                  <Icon name={a.icon} size={24} />
                </button>
              ))}
            </div>
          </header>
        ) : (
          <div className={styles.header} style={{ paddingTop: layout.headerY - 20 }}>
            <AppBar title={title} onNavigateBack={paneRoot ? undefined : nav.back} backIcon={closes ? 'close' : 'arrow_back'} actions={actions} />
          </div>
        )}
        {children}
      </div>
      {fab && (
        <button className={styles.fab} style={{ right: padR, bottom: tab ? layout.padB - 24 : layout.padBPush }} title={fab.semanticLabel} aria-label={fab.semanticLabel} onClick={fab.onPressed}>
          <Icon name={fab.icon} size={28} />
        </button>
      )}
    </div>
  );
}
