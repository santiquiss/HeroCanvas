// Status bars, camera cutouts and home indicator. All pointer-events:none, z 95+ (above sheets and dialogs).
import type { CSSProperties } from 'react';
import { CORNER_STATUS, type Layout } from './layout';
import styles from './SystemChrome.module.css';

const Battery = ({ level }: { level: number }) => (
  <svg width="28" height="13" viewBox="0 0 28 13">
    <rect x="0.5" y="0.5" width="24" height="12" rx="3.8" fill="none" stroke="currentColor" opacity="0.4" />
    <rect x="2" y="2" width={21 * level} height="9" rx="2.2" fill="currentColor" />
    <rect x="26" y="4" width="1.6" height="5" rx="0.8" fill="currentColor" opacity="0.4" />
  </svg>
);

const Signal = () => (
  <svg width="18" height="12" viewBox="0 0 18 12">
    <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
    <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" />
    <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
    <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
  </svg>
);

/** Corner status images (@2x), sized by CORNER_STATUS. */
const CORNER_STATUS_SRC = { vertical: 'assets/devices/duo-status-vertical@2x.png', horizontal: 'assets/devices/duo-status-horizontal@2x.png' };

/** A corner status image at its size; the caller places it (`style`). */
export function CornerStatusImage({ kind, style }: { kind: 'vertical' | 'horizontal'; style?: CSSProperties }) {
  const { w, h } = CORNER_STATUS[kind];
  return <img className={styles.cornerStatus} src={import.meta.env.BASE_URL + CORNER_STATUS_SRC[kind]} alt="" width={w} height={h} style={{ pointerEvents: 'none', ...style }} />;
}

/** Always-visible camera: in the right column (centered on it) when there is one, else `inset` from the edges. */
function Camera({ layout }: { layout: Layout }) {
  const cam = layout.camera;
  if (!cam) return null;
  const x = layout.sideW && cam.x === 'right' ? (layout.sideW - cam.size) / 2 : cam.inset;
  return <div className={styles.camera} style={{ width: cam.size, height: cam.size, [cam.x]: x, [cam.y]: cam.inset }} />;
}

export function StatusBar({ layout }: { layout: Layout }) {
  const { os, sideNav, phoneLand, camRight, cornerStatus } = layout;
  // No strip in a landscape phone, nor in the video layout's app area (the status shows over the video).
  if (phoneLand || layout.videoH) return null;
  if (cornerStatus) {
    // Vertical: centered in the right column. Horizontal: nestled in the top-right corner (layout.reserved).
    const pos =
      cornerStatus === 'vertical'
        ? { top: layout.statusTop, right: (layout.sideW - CORNER_STATUS.vertical.w) / 2 }
        : { top: layout.reserved!.top, right: layout.reserved!.right };
    return (
      <>
        {!layout.bare && <Camera layout={layout} />}
        <CornerStatusImage kind={cornerStatus} style={{ position: 'absolute', ...pos, zIndex: 95, filter: 'var(--corner-status-filter)' }} />
      </>
    );
  }
  if (os === 'ios' && !sideNav && layout.homeButton)
    // The iPhone SE's 20pt bar: carrier and signal left, the time centered, the battery right.
    return (
      <div className={styles.iosHome}>
        <span className={styles.icons} style={{ gap: 5 }}>
          <Signal />
        </span>
        <span>9:41 AM</span>
        <span className={styles.icons} style={{ gap: 4 }}>
          <span>100%</span>
          <Battery level={1} />
        </span>
      </div>
    );
  if (os === 'ios' && !sideNav)
    return (
      <>
        <div className={styles.ios} style={{ height: layout.sbH }}>
          <span style={{ minWidth: 56 }}>9:41</span>
          <span className={styles.icons} style={{ gap: 7 }}>
            <Signal />
            <Battery level={1} />
          </span>
        </div>
        {!layout.bare && layout.cutout === 'island' && <div className={styles.island} style={{ width: layout.islandW, marginLeft: -layout.islandW / 2 }} />}
        {!layout.bare && layout.cutout === 'notch' && <div className={styles.notch} />}
      </>
    );
  if (os === 'android') {
    const punch: CSSProperties = camRight ? { right: 28 } : { left: '50%', marginLeft: -11 };
    return (
      <>
        <div className={styles.android} style={{ paddingRight: camRight ? 64 : 24 }}>
          <span>9:30</span>
          <span className={styles.icons} style={{ gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M15 2 L15 15 L2 15 Z" fill="currentColor" />
            </svg>
            <svg width="9" height="16" viewBox="0 0 9 16">
              <rect x="2.5" y="0" width="4" height="2" rx="0.5" fill="currentColor" />
              <rect x="0" y="2" width="9" height="14" rx="1.5" fill="currentColor" />
            </svg>
          </span>
        </div>
        {!layout.bare && <div className={styles.punch} style={punch} />}
      </>
    );
  }
  if (os === 'ipad' && !sideNav)
    return (
      <div className={styles.ipad}>
        <span style={{ whiteSpace: 'pre' }}>9:41  Tue Mar 17</span>
        <span className={styles.icons} style={{ gap: 6 }}>
          <span style={{ fontSize: 11 }}>82%</span>
          <Battery level={0.82} />
        </span>
      </div>
    );
  return null;
}

/** Camera cutout drawn on the left edge in phone landscape. */
export function LandscapeCamera({ layout }: { layout: Layout }) {
  if (!layout.phoneLand) return null;
  // The screen alone (Capture): a screenshot shows no camera.
  if (layout.bare) return null;
  if (layout.os !== 'ios') return <div className={styles.landPunch} />;
  if (layout.cutout === 'none') return null;
  return layout.cutout === 'notch' ? <div className={styles.landNotch} /> : <div className={styles.landIsland} style={{ height: layout.islandW, marginTop: -layout.islandW / 2 }} />;
}

const HOME: Record<Layout['os'], CSSProperties> = {
  ios: { bottom: 8, width: 134, height: 5, borderRadius: 3 },
  android: { bottom: 9, width: 108, height: 4, borderRadius: 2 },
  ipad: { bottom: 7, width: 180, height: 5, borderRadius: 3 },
};

export function HomeIndicator({ layout }: { layout: Layout }) {
  if (layout.sideNav || layout.homeButton) return null;
  const s = HOME[layout.os];
  return <div className={styles.home} style={{ ...s, marginLeft: -(s.width as number) / 2 }} />;
}
