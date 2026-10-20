// Inspect's pictures of a value: small glyphs beside a row's name that change with it (how an axis is sized, the
// spacing's direction, the corners), and diagrams for what reads better drawn than written (a flex box's alignment,
// the padding on each side).
import type { ReactNode } from 'react';
import type { Corners, Sizing } from '../design/element';
import styles from './Panel.module.css';

const ACCENT = '#0d99ff';

function Svg({ turn, children }: { turn?: boolean; children: React.ReactNode }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" style={turn ? { transform: 'rotate(90deg)' } : undefined} aria-hidden>
      {children}
    </svg>
  );
}

/**
 * How an axis is sized, drawn horizontally (turned for height): Fill |←→|, Hug →||←, Fixed |—|.
 */
export function SizingGlyph({ sizing, axis }: { sizing: Sizing; axis: 'w' | 'h' }) {
  return (
    <Svg turn={axis === 'h'}>
      {sizing === 'fill' && (
        <>
          <path d="M1.5 3v8M12.5 3v8M4 7h6" />
          <path d="M5.5 5.5 4 7l1.5 1.5M8.5 5.5 10 7l-1.5 1.5" />
        </>
      )}
      {sizing === 'hug' && (
        <>
          <path d="M5.5 3v8M8.5 3v8M0.8 7h3M10.2 7h3" />
          <path d="M2.3 5.5 3.8 7 2.3 8.5M11.7 5.5 10.2 7l1.5 1.5" />
        </>
      )}
      {sizing === 'fixed' && <path d="M1.5 3v8M12.5 3v8M1.5 7h11" />}
    </Svg>
  );
}

/** Spacing between children, along the box's direction. */
export function SpacingGlyph({ column }: { column: boolean }) {
  return (
    <Svg turn={column}>
      <rect x={1.5} y={2.5} width={3} height={9} rx={0.8} />
      <rect x={9.5} y={2.5} width={3} height={9} rx={0.8} />
      <path d="M6.5 7h1" />
    </Svg>
  );
}

/** A corner as the radius cuts it: square, rounded, or fully round. */
export function RadiusGlyph({ corners }: { corners: Corners }) {
  const d = { square: 'M2 12V2h10', rounded: 'M2 12V7a5 5 0 0 1 5-5h5', full: 'M2 12A10 10 0 0 1 12 2' }[corners];
  return (
    <Svg>
      <path d={d} />
    </Svg>
  );
}

/**
 * A flex box's alignment, drawn by laying out three bars with the box's own direction, justify-content and
 * align-items: what a flex layout's main- and cross-axis alignment do, at a glance.
 */
export function AlignDiagram({ cs }: { cs: CSSStyleDeclaration }) {
  const column = cs.flexDirection.startsWith('column');
  const stretch = cs.alignItems === 'stretch' || cs.alignItems === 'normal';
  // Different lengths across, so the cross alignment shows; along, a fixed thickness.
  const cross = [10, 18, 13];
  return (
    <span
      className={styles.alignDiagram}
      style={{ flexDirection: cs.flexDirection as React.CSSProperties['flexDirection'], justifyContent: cs.justifyContent === 'normal' ? 'flex-start' : cs.justifyContent, alignItems: stretch ? 'stretch' : cs.alignItems }}
      aria-hidden
    >
      {cross.map((c, i) => (
        <span key={i} style={{ background: ACCENT, borderRadius: 1.5, flex: 'none', ...(column ? { height: 4, width: stretch ? undefined : c * 1.6 } : { width: 5, height: stretch ? undefined : c }) }} />
      ))}
    </span>
  );
}

/** Padding as a box the width of the panel: each side's value (a token, a number) where it goes, around the content. */
export function PaddingDiagram({ sides }: { sides: [ReactNode, ReactNode, ReactNode, ReactNode] }) {
  const [t, r, b, l] = sides;
  return (
    <span className={styles.paddingDiagram}>
      <span style={{ gridArea: 't' }}>{t}</span>
      <span style={{ gridArea: 'l' }}>{l}</span>
      <span className={styles.paddingContent} style={{ gridArea: 'c' }} />
      <span style={{ gridArea: 'r' }}>{r}</span>
      <span style={{ gridArea: 'b' }}>{b}</span>
    </span>
  );
}
