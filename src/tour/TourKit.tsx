// The tour's components (HeroCanvas's own app, shown while no app is connected), after iOS: large titles, inset
// grouped lists, Settings-style icon tiles, capsule buttons, Liquid Glass on what floats. Instrumented (useComponent)
// so Inspect and Layers name them. Drawn with the app tokens the tour's theme sets (theme.css: iOS's values).
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { reducedMotion } from '../kit/motion';
import { useNav } from '../nav/context';
import { SEARCH_BAR_H } from '../sim/layout';
import { usePadL, usePadR, useSim } from '../sim/SimContext';
import styles from './TourKit.module.css';

/** iOS's system tints, for icon tiles (their light and dark values are in TourKit.module.css). */
export type Tint = 'blue' | 'indigo' | 'purple' | 'pink' | 'orange' | 'green' | 'teal' | 'gray';

/**
 * A screen: a tab's root opens with a large title; a pushed screen has a navigation bar with a glass back button and
 * its title inline. The page's grouped background, its side margins from the simulator's layout. `plain`: no title
 * and no scroll, its content laid out in the screen's height (a screen that opens with its own, like Welcome).
 */
export function Screen({ title, plain = false, children }: { title: string; plain?: boolean; children: ReactNode }) {
  const { layout } = useSim();
  const nav = useNav();
  const padL = usePadL();
  const padR = usePadR();
  const root = nav.def(nav.ref.id).level === 'tab' && nav.index === 0;
  // A plain screen keeps clear of the tab bar only (the tour has no search pill, nothing scrolls under it), so its
  // content has all the room.
  return (
    <div className={styles.screen}>
      <div className={`${styles.scroll} ${plain ? styles.plain : ''}`} style={{ paddingLeft: padL, paddingRight: padR, paddingTop: plain ? layout.padT : undefined, paddingBottom: plain ? layout.padB - SEARCH_BAR_H - 24 : root ? layout.padB : layout.padBPush }}>
        {plain ? null : root ? (
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

/**
 * Pages side by side, one at a time: swiped (a mouse drags them as a finger would), with a page control under them,
 * as iOS's paged scroll view. As tall as its tallest page; a page taller than the room left scrolls on its own.
 */
export function Pager({ children }: { children: ReactNode }) {
  const pages = Children.toArray(children);
  const hc = useComponent('Pager', { pages: pages.length });
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const go = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(pages.length - 1, i)) * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const scrolled = () => setPage(Math.round(el.scrollLeft / el.clientWidth));
    // A mouse drag: snapping off while it follows the pointer, then on to the next page past 15% of a page, or back.
    let drag: { x: number; left: number; id: number; moved: boolean } | null = null;
    // The last drag's landing, until snapping is back on (a new drag ends it first).
    let landing = () => {};
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      landing();
      drag = { x: e.clientX, left: el.scrollLeft, id: e.pointerId, moved: false };
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      // The device may be drawn scaled: the pointer's pixels into the page's.
      const dx = (e.clientX - drag.x) * (el.clientWidth / el.getBoundingClientRect().width);
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        try {
          el.setPointerCapture(drag.id);
        } catch {
          // A pointer already gone: the drag follows it while it stays over the pages.
        }
        el.classList.add(styles.dragging);
      }
      el.scrollLeft = drag.left - dx;
    };
    const up = () => {
      const d = drag;
      drag = null;
      if (!d?.moved) return;
      const from = Math.round(d.left / el.clientWidth);
      const moved = (el.scrollLeft - d.left) / el.clientWidth;
      const to = Math.max(0, Math.min(pages.length - 1, Math.abs(moved) > 0.15 ? from + Math.sign(moved) : from));
      const left = to * el.clientWidth;
      el.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
      // Snapping back on once it's there (sooner, it would pull the page back where the drag left it).
      const timer = window.setTimeout(() => landing(), 1000);
      const arrived = () => {
        if (Math.abs(el.scrollLeft - left) <= 1) landing();
      };
      landing = () => {
        window.clearTimeout(timer);
        el.removeEventListener('scroll', arrived);
        el.classList.remove(styles.dragging);
        landing = () => {};
      };
      el.addEventListener('scroll', arrived, { passive: true });
      arrived();
      // The drag isn't a tap on what's under it.
      const swallow = (c: MouseEvent) => c.stopPropagation();
      el.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
    };
    el.addEventListener('scroll', scrolled, { passive: true });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      landing();
      el.removeEventListener('scroll', scrolled);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [pages.length]);
  return (
    <div {...hc} className={styles.pager}>
      <div ref={track} className={styles.track}>
        {pages.map((p, i) => (
          <div key={i} className={styles.page} aria-hidden={i !== page}>
            {p}
          </div>
        ))}
      </div>
      <PageControl count={pages.length} current={page} onSelect={go} />
    </div>
  );
}

/** A row of dots, one per page, the current one solid; a dot takes you to its page. */
export function PageControl({ count, current, onSelect }: { count: number; current: number; onSelect: (page: number) => void }) {
  const hc = useComponent('PageControl', { count, current, onSelect });
  return (
    <div {...hc} className={styles.pageControl}>
      {Array.from({ length: count }, (_, i) => (
        <button key={i} className={`${styles.dot} ${i === current ? styles.currentDot : ''}`} aria-label={`Page ${i + 1} of ${count}`} aria-current={i === current} onClick={() => onSelect(i)} />
      ))}
    </div>
  );
}
