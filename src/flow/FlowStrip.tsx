// A flow page in the Flow view: its steps left → right as live thumbnails (each one held, at its own state), with
// their transitions. Next steps: a straight arrow; further ahead: an arc above; back: an arc below; out of the flow: an
// arrow off the step. Loaders' arrows are dashed (they move on by themselves). Click a step to open it.
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useNavRoot } from '../nav/context';
import { flowTransitions, stepQuery, stepState } from '../nav/flow';
import type { Layout } from '../sim/layout';
import { PageCard } from './PageCard';
import { FlowThumb } from './FlowThumb';
import styles from './Flow.module.css';

/** Space between step thumbnails (room for a transition's label). */
export const STEP_GAP = 104;
/** Room above the thumbnails for arcs forward, and below the labels for arcs back. */
export const ARC_ABOVE = 72;
export const ARC_BELOW = 96;

interface Props {
  id: string;
  params: Record<string, string>;
  /** Thumbnail size and scale. */
  w: number;
  h: number;
  scale: number;
  radius: string;
  /** Height of the header above (the strip starts below it) and of the labels below the thumbnails. */
  head: number;
  labels: number;
  current: boolean;
  moved: () => boolean;
  makeLayout: (detailOpen: boolean, pageId?: string) => Layout;
  /** Zoomed far out: each step a card, without labels (semantic zoom). */
  far?: boolean;
}

export function FlowStrip({ id, params, w, h, scale, radius, head, labels, current, moved, makeLayout, far = false }: Props) {
  const nav = useNavRoot();
  const def = nav.pages[id];
  const flow = def.flow!;
  const [variant, setVariant] = useState<Record<string, number>>({});
  const at = (i: number) => i * (w + STEP_GAP);
  const index = (step: string) => flow.steps.findIndex((s) => s.id === step);
  const top = head + ARC_ABOVE;
  const mid = top + h / 2;
  // Arcs back start under the labels (a step's variants can take two rows).
  const below = top + h + labels + 30;

  // One arrow per pair of steps (labels joined), one per step leaving the flow.
  const groups = new Map<string, { from: number; to: number; labels: string[]; auto: boolean }>();
  for (const t of flowTransitions(flow)) {
    const from = index(t.from);
    const to = t.to ? index(t.to) : -1;
    const key = `${from}>${to}`;
    const g = groups.get(key) ?? { from, to, labels: [], auto: !!t.auto };
    g.labels.push(t.when ? `${t.label} · ${t.when}` : t.label);
    groups.set(key, g);
  }
  const width = at(flow.steps.length - 1) + w;

  return (
    <>
      <svg className={styles.stripEdges} width={width + STEP_GAP} height={below + ARC_BELOW} aria-hidden>
        {[...groups.values()].map((g, k) => {
          const x1 = at(g.from);
          let d: string;
          if (g.to < 0) d = `M${x1 + w + 6} ${mid} h${STEP_GAP * 0.55}`;
          else if (g.to === g.from + 1) d = `M${x1 + w + 6} ${mid} L${at(g.to) - 8} ${mid}`;
          else if (g.to > g.from) {
            const a = x1 + w / 2 + 12;
            const b = at(g.to) + w / 2 - 12;
            const lift = 22 + 16 * (g.to - g.from);
            d = `M${a} ${top - 4} C${a} ${top - lift}, ${b} ${top - lift}, ${b} ${top - 8}`;
          } else {
            const a = x1 + w / 2 - 12;
            const b = at(g.to) + w / 2 + 12;
            const drop = 18 + 14 * (g.from - g.to);
            d = `M${a} ${below + 2} C${a} ${below + drop}, ${b} ${below + drop}, ${b} ${below + 6}`;
          }
          return <path key={k} d={d} fill="none" stroke="#7d848e" strokeWidth={1.5} strokeDasharray={g.auto ? '4 4' : undefined} markerEnd="url(#flow-arrow)" />;
        })}
      </svg>
      {[...groups.values()].map((g, k) => {
        if (far) return null;
        // Label: over a straight arrow, at the top of an arc above, at the bottom of an arc below.
        const x1 = at(g.from);
        let pos: { left: number; top: number; width?: number };
        if (g.to < 0) pos = { left: x1 + w + 6, top: mid - 8, width: STEP_GAP * 0.9 };
        else if (g.to === g.from + 1) pos = { left: x1 + w + 4, top: mid - 8, width: STEP_GAP - 8 };
        else if (g.to > g.from) pos = { left: (x1 + at(g.to) + w) / 2, top: top - (22 + 16 * (g.to - g.from)) * 0.75 - 4 };
        else pos = { left: (x1 + at(g.to) + w) / 2, top: below + (18 + 14 * (g.from - g.to)) * 0.75 + 4 };
        const side = g.to < 0 || g.to === g.from + 1;
        return (
          <span
            key={k}
            className={`${styles.stepEdgeLabel} ${side ? styles.stepEdgeSide : ''} ${g.to >= 0 && g.to < g.from ? styles.stepEdgeBelow : ''}`}
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            {g.to < 0 && <Icon name="logout" size={12} />}
            {g.labels.join(' / ')}
          </span>
        );
      })}

      {flow.steps.map((step, i) => {
        const variants = step.variants ?? [];
        const vi = Math.min(variant[step.id] ?? 0, Math.max(0, variants.length - 1));
        const v = variants[vi];
        return (
          <div key={step.id} className={styles.step} style={{ left: at(i), top, width: w }}>
            <div
              className={`${styles.thumb} ${current ? styles.current : ''}`}
              style={{ width: w, height: h, borderRadius: radius }}
              title={step.note ? `${step.label}: ${step.note}` : step.label}
              onClick={() => !moved() && nav.open(id, params, stepState(def, step, v))}
            >
              {far ? (
                <PageCard icon={step.kind === 'loading' ? 'hourglass_empty' : 'crop_portrait'} status={def.status} />
              ) : (
                <div className={styles.thumbInner} style={{ width: w / scale, height: h / scale, transform: `scale(${scale})` }}>
                  <FlowThumb page={{ id, params }} query={stepQuery(def, step, v)} makeLayout={makeLayout} />
                </div>
              )}
            </div>
            {!far && (
              <div className={styles.stepName}>
                <span className={styles.stepNum}>{i + 1}</span>
                {step.kind === 'loading' && <Icon name="hourglass_empty" size={14} />}
                <span className={styles.name}>{step.label}</span>
              </div>
            )}
            {!far && variants.length > 1 && (
              <div className={styles.variants} style={{ marginTop: 2 }}>
                {variants.map((x, j) => (
                  <button key={x.label} className={`${styles.variant} ${j === vi ? styles.variantOn : ''}`} onClick={() => setVariant((s) => ({ ...s, [step.id]: j }))}>
                    {x.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
