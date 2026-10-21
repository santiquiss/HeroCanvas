// Welcome's illustrations, one per card of its deck: code becoming a screen, the devices and themes, versions to
// compare, a handoff spec, the tour's stops around a phone. Drawn on a 300×220 box, scaled to the room the card leaves them; their pieces pop in when
// their card comes to the top (TourKit's DeckCard sets `data-top`).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { useStill } from '../kit/motion';
import { STEPS } from './steps';
import { IconTile } from './TourKit';
import styles from './Art.module.css';

export type ArtName = 'code' | 'devices' | 'versions' | 'handoff' | 'tour';

const W = 300;
const H = 220;

const at = (left: number | string, top: number | string, extra: CSSProperties = {}): CSSProperties => ({ left, top, ...extra });

/** One of Welcome's illustrations, as large as fits its parent (never more than 1.25×). */
export function Illustration({ name }: { name: ArtName }) {
  const hc = useComponent('Illustration', { name });
  const fit = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outer = fit.current;
    const inner = box.current;
    if (!outer || !inner) return;
    const size = () => inner.style.setProperty('--art-scale', String(Math.min(1.25, outer.clientWidth / W, outer.clientHeight / H)));
    size();
    const ro = new ResizeObserver(size);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);
  return (
    <div {...hc} ref={fit} className={styles.fit}>
      <div ref={box} className={styles.box} role="img" aria-label={LABELS[name]}>
        {name === 'tour' ? <Orbit /> : ART[name]}
      </div>
    </div>
  );
}

const LABELS: Record<ArtName, string> = {
  code: 'Code turning into a real screen',
  devices: 'A tablet and two phones, in light and dark, in several languages',
  versions: 'The live screen beside a proposal, with versions to switch',
  handoff: 'A handoff spec of a component, with its props, tokens and spacing',
  tour: 'A phone with the tour’s stops around it',
};

/** A phone's screen: a title bar, a block, lines, and a button when asked. */
function Phone({ style, className = '', block, dark = false, button = false }: { style: CSSProperties; className?: string; block: string; dark?: boolean; button?: boolean }) {
  return (
    <div className={`${styles.phone} ${dark ? styles.dark : ''} ${className}`} style={style}>
      <span className={styles.bar} style={{ width: '55%' }} />
      <span className={styles.block} style={{ background: block }} />
      <span className={styles.line} style={{ width: '80%' }} />
      <span className={styles.line} style={{ width: '62%' }} />
      {button && <span className={styles.button} />}
    </div>
  );
}

/** The tour's stops in a slow orbit around a phone (still in a still copy or with reduced motion). */
function Orbit() {
  const still = useStill();
  const tile = 42;
  return (
    <>
      <div className={`${styles.pop} ${styles.ring}`} />
      <div className={`${styles.pop} ${styles.d1} ${styles.center}`}>
        <img src="/tour/icon.png" alt="" />
      </div>
      <div className={`${styles.pop} ${styles.d2} ${styles.orbit} ${still ? '' : styles.spin}`}>
        {STEPS.map((step, k) => {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / STEPS.length;
          return (
            <span key={step.id} className={styles.stop} style={{ left: 150 + 100 * Math.cos(a) - tile / 2, top: 110 + 100 * Math.sin(a) - tile / 2 }}>
              <IconTile icon={step.icon} tint={step.tint} size={tile} />
            </span>
          );
        })}
      </div>
    </>
  );
}

const ART: Record<Exclude<ArtName, 'tour'>, ReactNode> = {
  code: (
    <>
      <div className={`${styles.pop} ${styles.code}`} style={at(0, 46)}>
        <span>&lt;TaskCard</span>
        <span className={styles.prop} style={{ color: '#ffd23f' }}>title="Today"</span>
        <span className={styles.prop} style={{ color: '#8fd3ff' }}>done={'{3}'}</span>
        <span className={styles.prop} style={{ color: '#ff9fb2' }}>tone="primary"</span>
        <span>/&gt;</span>
      </div>
      <svg className={`${styles.pop} ${styles.d1} ${styles.stroke}`} style={at(146, 96)} width="54" height="30" viewBox="0 0 54 30" aria-hidden>
        <path d="M3 18c12-12 28-12 44-2" />
        <path d="M40 8l8 8-10 5" />
      </svg>
      <div className={`${styles.pop} ${styles.d2} ${styles.phone} ${styles.shadow}`} style={at(188, 0, { width: 112, height: 220 })}>
        <span className={styles.bar} style={{ width: '50%' }} />
        <span className={styles.today}>
          <b>Today</b>
          <small>3 done</small>
        </span>
        {[true, true, false].map((done, i) => (
          <span key={i} className={styles.task}>
            <span className={done ? styles.check : styles.open} />
            <span className={styles.line} />
          </span>
        ))}
        <span className={styles.button} />
      </div>
    </>
  ),
  devices: (
    <>
      <div className={`${styles.pop} ${styles.tablet}`} style={at(0, 34)}>
        <span style={{ background: '#e7e6fb' }} />
        <span style={{ background: 'var(--app-indigo)' }} />
        <span />
        <span />
      </div>
      <Phone className={`${styles.pop} ${styles.d1} ${styles.shadow}`} style={at(128, 8, { width: 84, height: 176 })} block="#7d7bff" dark />
      <Phone className={`${styles.pop} ${styles.d2} ${styles.shadow}`} style={at(204, 30, { width: 84, height: 176 })} block="var(--app-indigo)" />
      <div className={`${styles.pop} ${styles.d3} ${styles.chips}`} style={at(6, 192)}>
        <span className={styles.chipOn} style={{ color: 'var(--app-indigo)' }}>EN</span>
        <span>ES</span>
        <span>日本語</span>
      </div>
      <div className={`${styles.pop} ${styles.d3} ${styles.toggle}`} style={at(232, 0)}>
        <span className={styles.toggleOn} style={{ color: 'var(--app-indigo)' }}>
          <Icon name="light_mode" size={16} fill />
        </span>
        <span>
          <Icon name="dark_mode" size={16} fill />
        </span>
      </div>
    </>
  ),
  versions: (
    <>
      <div className={`${styles.pop} ${styles.segments}`} style={at(0, 0, { right: 0, width: 'fit-content', margin: '0 auto' })}>
        <span>Live</span>
        <span>v1</span>
        <span className={styles.segmentOn}>v2</span>
      </div>
      <Phone className={`${styles.pop} ${styles.d1} ${styles.faded}`} style={at(22, 52, { width: 104, height: 168 })} block="rgba(17,19,24,.18)" />
      <svg className={`${styles.pop} ${styles.d2} ${styles.stroke}`} style={at(128, 112)} width="44" height="40" viewBox="0 0 44 40" aria-hidden>
        <path d="M4 30c10 0 12-20 34-20" />
        <path d="M31 3l8 7-8 7" />
      </svg>
      <div className={`${styles.pop} ${styles.d3} ${styles.phone} ${styles.shadow}`} style={at(166, 44, { width: 112, height: 176 })}>
        <span className={styles.bar} style={{ width: '55%' }} />
        <span className={styles.changed}>
          <span className={styles.new}>New</span>
        </span>
        <span className={styles.line} style={{ width: '80%' }} />
        <span className={styles.line} style={{ width: '70%' }} />
        <span className={styles.button} />
      </div>
    </>
  ),
  handoff: (
    <>
      <div className={`${styles.pop} ${styles.spec}`} style={at(6, 8)}>
        <span className={styles.specHead}>
          <b>TaskCard</b>
          <span className={styles.matches}>Matches code</span>
        </span>
        <span className={styles.specRow}>
          <span>title</span>
          <span>"Today"</span>
        </span>
        <span className={styles.specRow}>
          <span>padding</span>
          <span>space.m</span>
        </span>
        <span className={styles.specRow}>
          <span>color</span>
          <span className={styles.swatch}>
            <i />
            <span>primary</span>
          </span>
        </span>
        <span className={styles.specRow}>
          <span>radius</span>
          <span>radius.l</span>
        </span>
      </div>
      <div className={`${styles.pop} ${styles.d2} ${styles.measure}`} style={at(204, 118)}>
        <i className={styles.inner} />
        <i className={styles.ticks} />
        <i className={styles.rule} />
        <b>16</b>
      </div>
      <div className={`${styles.pop} ${styles.d3} ${styles.ready}`} style={at(40, 186)}>
        <span className={styles.readyCheck}>
          <Icon name="check" size={15} weight={700} />
        </span>
        <span>Ready to build</span>
      </div>
    </>
  ),
};
