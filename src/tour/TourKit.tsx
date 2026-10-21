// The tour's components (HeroCanvas's own app, shown while no app is connected), after iOS: large titles, inset
// grouped lists, Settings-style icon tiles, capsule buttons, Liquid Glass on what floats. Instrumented (useComponent)
// so Inspect and Layers name them. Drawn with the app tokens the tour's theme sets (theme.css: iOS's values).
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref, type UIEvent } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { useNav } from '../nav/context';
import { SEARCH_BAR_H } from '../sim/layout';
import { usePadL, usePadR, useSim } from '../sim/SimContext';
import styles from './TourKit.module.css';

/** iOS's system tints, for icon tiles (their light and dark values are in TourKit.module.css). */
export type Tint = 'blue' | 'indigo' | 'purple' | 'pink' | 'orange' | 'yellow' | 'green' | 'teal' | 'gray';

/**
 * A screen, as iOS lays one out. A tab's root opens with an empty bar over a large title at the left; scrolled, its
 * content goes under the bar, which blurs it (glass, evenly, ending straight with a very faint line), and
 * once the large title is under the bar too, its title shows in it, small and centered. A pushed screen's bar has a
 * glass back button and its title inline from the start. The bar stays at the top. The page's grouped background, its
 * side margins from the simulator's layout. `plain`: no title and no scroll, its content laid out in the screen's
 * height (a screen that opens with its own, like Welcome).
 */
export function Screen({ title, plain = false, children }: { title: string; plain?: boolean; children: ReactNode }) {
  const { layout } = useSim();
  const nav = useNav();
  const padL = usePadL();
  const padR = usePadR();
  const root = nav.def(nav.ref.id).level === 'tab' && nav.index === 0;
  const large = useRef<HTMLHeadingElement>(null);
  // `under`: content has scrolled under the bar (its glass shows); `collapsed`: the large title has too (the bar's own
  // title shows).
  const [edge, setEdge] = useState({ under: false, collapsed: !root });
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const under = top > 1;
    const collapsed = !root || (!!large.current && top >= large.current.offsetHeight - 6);
    if (under !== edge.under || collapsed !== edge.collapsed) setEdge({ under, collapsed });
  };
  // A plain screen keeps clear of the tab bar only (the tour has no search pill, nothing scrolls under it), so its
  // content has all the room.
  return (
    <div className={styles.screen}>
      <div
        className={`${styles.scroll} ${plain ? styles.plain : ''}`}
        style={{ paddingLeft: padL, paddingRight: padR, paddingTop: plain ? layout.padT : undefined, paddingBottom: plain ? layout.padB - SEARCH_BAR_H - 24 : root ? layout.padB : layout.padBPush }}
        onScroll={plain ? undefined : onScroll}
      >
        {!plain && (
          // The bar spans the screen's width (over the side margins), its row where every page's header sits.
          <div className={`${styles.bar} ${edge.under ? styles.barUnder : ''}`} style={{ margin: `0 ${-padR}px 0 ${-padL}px`, padding: `${layout.headerY - 22}px ${padR}px 0 ${padL}px` }}>
            <span className={styles.barGlass} aria-hidden />
            <NavigationBar title={title} onBack={root ? undefined : nav.back} titleShown={edge.collapsed} />
          </div>
        )}
        <div className={styles.content}>
          {root && !plain && <LargeTitle title={title} titleRef={large} />}
          {children}
        </div>
      </div>
    </div>
  );
}

/** A tab's title, large, at the left: where its screen opens (the bar takes it over once it scrolls under). */
export function LargeTitle({ title, titleRef }: { title: string; titleRef?: Ref<HTMLHeadingElement> }) {
  const hc = useComponent('LargeTitle', { title });
  return (
    <h1 {...hc} ref={titleRef} className={styles.largeTitle}>
      {title}
    </h1>
  );
}

/**
 * A screen's bar: its title small and centered (`titleShown`: a tab's root shows it only once its large title has
 * scrolled away); on a pushed screen, back as a glass circle at the left (iOS 26).
 */
export function NavigationBar({ title, onBack, titleShown = true }: { title: string; onBack?: () => void; titleShown?: boolean }) {
  const hc = useComponent('NavigationBar', { title, onBack, titleShown });
  return (
    <header {...hc} className={styles.navBar}>
      {onBack ? (
        <button className={`${styles.glass} ${styles.back}`} aria-label="Back" onClick={onBack}>
          <Icon name="arrow_back_ios_new" size={20} />
        </button>
      ) : (
        <span />
      )}
      <span className={`${styles.navTitle} ${titleShown ? styles.navTitleShown : ''}`} aria-hidden={!titleShown}>
        {title}
      </span>
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

/** A deck card's color: a system tint, or ink (the text's color, so it turns over with the theme). */
export type DeckTint = 'blue' | 'green' | 'indigo' | 'pink' | 'yellow' | 'purple' | 'ink';

export interface DeckCardProps {
  tint: DeckTint;
  /** A word or two over the card. */
  kicker: string;
  title: string;
  text: string;
  /** Its illustration. */
  art?: ReactNode;
  /** "2 of 5", when in a deck. */
  count?: string;
  /** The card's one button. */
  action?: { title: string; onPressed: () => void };
  /** Whether it's the deck's top card: its illustration pops in then. */
  top?: boolean;
  style?: CSSProperties;
}

/** A card of a deck, full of color: a kicker, an illustration, a title and its line, maybe a button. */
export function DeckCard({ tint, kicker, title, text, art, count, action, top = true, style }: DeckCardProps) {
  const hc = useComponent('DeckCard', { tint, kicker, title, text, count, action });
  return (
    <article {...hc} className={`${styles.deckCard} ${styles[tint]}`} data-top={top} aria-hidden={!top} style={style}>
      <header className={styles.deckHead}>
        <span>{kicker}</span>
        {count && <span className={styles.deckCount}>{count}</span>}
      </header>
      <div className={styles.deckArt}>{art}</div>
      <h2 className={styles.deckTitle}>{title}</h2>
      <p className={styles.deckText}>{text}</p>
      {action && (
        <button className={styles.deckAction} onClick={action.onPressed} tabIndex={top ? 0 : -1}>
          {action.title}
        </button>
      )}
    </article>
  );
}

/** How far each card behind the top one peeks out over it. */
const PEEK = 14;

/**
 * Cards in a stack, as Wallet holds them: the top one is swiped (or dragged) away to show the next, back brings it
 * back; buttons under it do the same, with a hint between them.
 */
export function CardDeck({ cards, onFinish }: { cards: Omit<DeckCardProps, 'count' | 'top' | 'style'>[]; /** Swiping on past the last card (or Next on it): where the deck leads. */ onFinish?: () => void }) {
  const hc = useComponent('CardDeck', { cards: cards.length });
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // The drag under way: it follows the pointer on the window, so a release anywhere (or a lost one) ends it.
  const end = useRef<(() => void) | null>(null);
  useEffect(() => () => end.current?.(), []);
  const last = cards.length - 1;
  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(last, i)));
    setDx(0);
    setDragging(false);
  };
  const start = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    // No text selection, no image drag: the pointer is the card's.
    if (e.pointerType === 'mouse') e.preventDefault();
    end.current?.();
    const from = index;
    const x0 = e.clientX;
    const r = e.currentTarget.getBoundingClientRect();
    // The device may be drawn scaled: the pointer's pixels into the deck's.
    const ratio = e.currentTarget.clientWidth / r.width;
    let moved = false;
    let x = 0;
    // The last moments of the drag, for a flick's speed.
    let trail = [{ x: 0, t: e.timeStamp }];
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      // The button let go where no release reached us: the drag is over.
      if (ev.pointerType === 'mouse' && ev.buttons === 0) return up(ev);
      x = (ev.clientX - x0) * ratio;
      trail = [...trail.filter((p) => ev.timeStamp - p.t < 120), { x, t: ev.timeStamp }];
      if (!moved) {
        if (Math.abs(x) < 6) return;
        moved = true;
        setDragging(true);
      }
      setDx(x);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      stop();
      if (!moved) return;
      const first = trail[0];
      const speed = (x - first.x) / Math.max(1, ev.timeStamp - first.t);
      // Past 15% of the card, or flicked: the next (or the last) card; else back.
      const width = r.width * ratio;
      const dir = x < -width * 0.15 || speed < -0.25 ? 1 : x > width * 0.15 || speed > 0.25 ? -1 : 0;
      // On past the last card: where the deck leads (it stays on its last card, behind).
      if (from + dir > last && onFinish) {
        go(last);
        onFinish();
      } else go(from + dir);
    };
    const cancel = () => {
      stop();
      go(from);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      end.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    end.current = cancel;
  };
  return (
    <div {...hc} className={styles.deck}>
      <div className={styles.stack} style={{ paddingTop: PEEK * 2 }} onPointerDown={start} onDragStart={(e) => e.preventDefault()}>
        <div className={styles.stackInner}>
          {cards.map((card, k) => {
            const d = k - index;
            const transform =
              d < 0 ? 'translateX(-130%) rotate(-16deg)' : d === 0 ? `translateX(${dx}px) rotate(${dx / 18}deg)` : `translateY(${-d * PEEK}px) scale(${1 - d * 0.06})`;
            return (
              <DeckCard
                key={card.title}
                {...card}
                count={`${k + 1} of ${cards.length}`}
                top={d === 0}
                style={{
                  transform,
                  opacity: d < 0 || d > 2 ? 0 : 1,
                  zIndex: cards.length - Math.abs(d),
                  transition: d === 0 && dragging ? 'none' : undefined,
                }}
              />
            );
          })}
        </div>
      </div>
      <div className={styles.deckControls}>
        <button className={`${styles.round} ${styles.roundBack}`} aria-label="Previous card" disabled={index === 0} onClick={() => go(index - 1)}>
          <Icon name="arrow_back_ios_new" size={20} />
        </button>
        <span className={styles.deckHint}>{index === last ? 'Ready when you are' : 'Swipe the card'}</span>
        <button className={`${styles.round} ${styles.roundNext}`} aria-label="Next card" disabled={index === last && !onFinish} onClick={() => (index === last ? onFinish?.() : go(index + 1))}>
          <Icon name="arrow_forward_ios" size={20} />
        </button>
      </div>
    </div>
  );
}
