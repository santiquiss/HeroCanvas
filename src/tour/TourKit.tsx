// The tour's components (HeroCanvas's own app, shown while no app is connected): built like an app's, instrumented
// (useComponent) so Inspect and Layers name them, and on the app tokens (--app-*), so the device's theme and text
// size apply. Pure but for the page frame, which reads where it sits in the navigation.
import { useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { IconButton } from '../kit';
import { useNav } from '../nav/context';
import { useHeaderInset, usePadL, usePadR, useSim } from '../sim/SimContext';
import styles from './TourKit.module.css';

/**
 * A page's frame: a tab's root has a large title (or none, `bare`) and room for the tab bar under it; a pushed page,
 * a header with back that stays while it scrolls. Side padding from the layout, as the simulator places the page.
 */
export function TourPage({ title, bare = false, children }: { title: string; bare?: boolean; children: ReactNode }) {
  const { layout } = useSim();
  const nav = useNav();
  const padL = usePadL();
  const padR = usePadR();
  const insetR = useHeaderInset();
  const tab = nav.def(nav.ref.id).level === 'tab' && nav.index === 0;
  return (
    <div className={styles.page}>
      <div className={styles.scroll} style={{ paddingLeft: padL, paddingRight: padR, paddingBottom: tab ? layout.padB : layout.padBPush }}>
        {tab ? (
          !bare && (
            <header className={styles.largeHeader} style={{ paddingTop: layout.padT, paddingRight: insetR }}>
              <h1 className={styles.largeTitle}>{title}</h1>
            </header>
          )
        ) : (
          <div className={styles.header} style={{ paddingTop: layout.headerY - 20 }}>
            <TourBar title={title} onNavigateBack={nav.back} />
          </div>
        )}
        <div className={styles.body} style={tab && bare ? { paddingTop: layout.padT } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A pushed page's bar: back on the left, the title centered. */
export function TourBar({ title, onNavigateBack }: { title: string; onNavigateBack: () => void }) {
  const hc = useComponent('TourBar', { title, onNavigateBack });
  return (
    <header {...hc} className={styles.bar}>
      <IconButton icon="arrow_back" elevated tooltip="Back" onTap={onNavigateBack} />
      <span className={styles.barTitle}>{title}</span>
      <span />
    </header>
  );
}

/** One way to begin: what it is, and the request for the agent, ready to copy. */
export function WayCard({ icon, title, tag, body, prompt, recommended = false }: { icon: string; title: string; tag?: string; body: string; prompt: string; recommended?: boolean }) {
  const hc = useComponent('WayCard', { icon, title, tag, body, prompt, recommended });
  return (
    <div {...hc} className={`${styles.way} ${recommended ? styles.wayOn : ''}`}>
      <div className={styles.wayHead}>
        <span className={styles.wayIcon}>
          <Icon name={icon} size={18} />
        </span>
        <h2 className={styles.wayTitle}>{title}</h2>
        {tag && <span className={styles.tag}>{tag}</span>}
      </div>
      <p className={styles.wayBody}>{body}</p>
      <div className={styles.prompt}>
        <code>{prompt}</code>
        <CopyButton text={prompt} />
      </div>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const hc = useComponent('CopyButton', { text });
  const [done, setDone] = useState(false);
  return (
    <button
      {...hc}
      className={styles.copy}
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        })
      }
    >
      <Icon name={done ? 'check' : 'content_copy'} size={16} />
      <span>{done ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

/** A row of a list: its icon, a title over a line, and a chevron; a tap opens it. */
export function TourRow({ icon, title, line, onTap }: { icon: string; title: string; line: string; onTap: () => void }) {
  const hc = useComponent('TourRow', { icon, title, line, onTap });
  return (
    <button {...hc} className={styles.row} onClick={onTap}>
      <span className={styles.rowIcon}>
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.rowTexts}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowLine}>{line}</span>
      </span>
      <Icon name="chevron_right" size={20} color="var(--app-text-muted)" />
    </button>
  );
}

/** What to do now, on the interface around the device. */
export function TryIt({ text }: { text: string }) {
  const hc = useComponent('TryIt', { text });
  return (
    <div {...hc} className={styles.try}>
      <span className={styles.tryLabel}>
        <Icon name="touch_app" size={18} />
        <span>Try it</span>
      </span>
      <p className={styles.tryText}>{text}</p>
    </div>
  );
}

/** The button at the bottom of a step: on to the next, or back to the start. */
export function NextButton({ label, onPressed }: { label: string; onPressed: () => void }) {
  const hc = useComponent('NextButton', { label, onPressed });
  return (
    <button {...hc} className={styles.next} onClick={onPressed}>
      <span>{label}</span>
      <Icon name="arrow_forward" size={18} />
    </button>
  );
}
