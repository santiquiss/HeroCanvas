// The tour's components (HeroCanvas's own app, shown while no app is connected), after iOS: large titles, inset
// grouped lists, Settings-style icon tiles, capsule buttons, Liquid Glass on what floats. Instrumented (useComponent)
// so Inspect and Layers name them. Drawn with the app tokens the tour's theme sets (theme.css: iOS's values).
import { useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { useNav } from '../nav/context';
import { usePadL, usePadR, useSim } from '../sim/SimContext';
import styles from './TourKit.module.css';

/** iOS's system tints, for icon tiles (their light and dark values are in TourKit.module.css). */
export type Tint = 'blue' | 'indigo' | 'purple' | 'pink' | 'orange' | 'green' | 'teal' | 'gray';

/**
 * A screen: a tab's root opens with a large title; a pushed screen has a navigation bar with a glass back button and
 * its title inline. The page's grouped background, its side margins from the simulator's layout.
 */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const { layout } = useSim();
  const nav = useNav();
  const padL = usePadL();
  const padR = usePadR();
  const root = nav.def(nav.ref.id).level === 'tab' && nav.index === 0;
  return (
    <div className={styles.screen}>
      <div className={styles.scroll} style={{ paddingLeft: padL, paddingRight: padR, paddingBottom: root ? layout.padB : layout.padBPush }}>
        {root ? (
          <LargeTitle title={title} top={layout.padT} />
        ) : (
          <div className={styles.navArea} style={{ paddingTop: layout.headerY - 22 }}>
            <NavigationBar title={title} onBack={nav.back} />
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export function LargeTitle({ title, top }: { title: string; top: number }) {
  const hc = useComponent('LargeTitle', { title });
  return (
    <h1 {...hc} className={styles.largeTitle} style={{ paddingTop: top }}>
      {title}
    </h1>
  );
}

/** A pushed screen's bar: back as a glass circle (iOS 26), the title inline in the middle. */
export function NavigationBar({ title, onBack }: { title: string; onBack: () => void }) {
  const hc = useComponent('NavigationBar', { title, onBack });
  return (
    <header {...hc} className={styles.navBar}>
      <button className={`${styles.glass} ${styles.back}`} aria-label="Back" onClick={onBack}>
        <Icon name="arrow_back_ios_new" size={20} />
      </button>
      <span className={styles.navTitle}>{title}</span>
      <span />
    </header>
  );
}

/** An inset grouped section: a header over a rounded group of rows or text, a footer under it. */
export function Section({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const hc = useComponent('Section', { header, footer });
  return (
    <section {...hc} className={styles.section}>
      {header && <h2 className={styles.sectionHeader}>{header}</h2>}
      <div className={styles.group}>{children}</div>
      {footer && <p className={styles.sectionFooter}>{footer}</p>}
    </section>
  );
}

/** A Settings-style icon: a symbol on a rounded square in a system tint. */
export function IconTile({ icon, tint, size = 30 }: { icon: string; tint: Tint; size?: number }) {
  const hc = useComponent('IconTile', { icon, tint, size });
  return (
    <span {...hc} className={`${styles.tile} ${styles[tint]}`} style={{ width: size, height: size, borderRadius: size * 0.23 }}>
      <Icon name={icon} size={size * 0.62} fill />
    </span>
  );
}

/** A row of a group: its icon, a title over an optional subtitle, and a chevron when it opens something. */
export function ListRow({ icon, tint, title, subtitle, onTap }: { icon?: string; tint?: Tint; title: string; subtitle?: string; onTap?: () => void }) {
  const hc = useComponent('ListRow', { icon, tint, title, subtitle, onTap });
  const content = (
    <>
      {icon && tint && <IconTile icon={icon} tint={tint} />}
      <span className={styles.rowMain}>
        <span className={styles.rowTexts}>
          <span className={styles.rowTitle}>{title}</span>
          {subtitle && <span className={styles.rowSubtitle}>{subtitle}</span>}
        </span>
        {onTap && <Icon name="chevron_right" size={22} className={styles.chevron} />}
      </span>
    </>
  );
  return onTap ? (
    <button {...hc} className={`${styles.row} ${styles.tappable}`} onClick={onTap}>
      {content}
    </button>
  ) : (
    <div {...hc} className={styles.row}>
      {content}
    </div>
  );
}

/** Text in a group's cell: a paragraph, as a grouped list holds one. */
export function TextCell({ children }: { children: ReactNode }) {
  const hc = useComponent('TextCell', {});
  return (
    <p {...hc} className={styles.textCell}>
      {children}
    </p>
  );
}

/** A screen's opening: the icon, a title and a line, centered. */
export function Hero({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  const hc = useComponent('Hero', { title, subtitle });
  return (
    <header {...hc} className={styles.hero}>
      {icon}
      <h2 className={styles.heroTitle}>{title}</h2>
      <p className={styles.heroSubtitle}>{subtitle}</p>
    </header>
  );
}

/** A capsule button: filled (the screen's one main action) or gray (a second one). */
export function CapsuleButton({ title, filled = true, onPressed }: { title: string; filled?: boolean; onPressed: () => void }) {
  const hc = useComponent('CapsuleButton', { title, filled, onPressed });
  return (
    <button {...hc} className={`${styles.capsule} ${filled ? styles.filled : styles.tinted}`} onClick={onPressed}>
      {title}
    </button>
  );
}

/** A request for the agent, in a field of its own, with Copy. */
export function PromptField({ prompt }: { prompt: string }) {
  const hc = useComponent('PromptField', { prompt });
  const [done, setDone] = useState(false);
  return (
    <div {...hc} className={styles.prompt}>
      <code className={styles.promptText}>{prompt}</code>
      <button
        className={`${styles.glass} ${styles.copy}`}
        onClick={() =>
          navigator.clipboard?.writeText(prompt).then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          })
        }
      >
        <Icon name={done ? 'check' : 'content_copy'} size={16} />
        <span>{done ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}
