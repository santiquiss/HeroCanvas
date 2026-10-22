// Every device and display side by side (device menu → All devices, `?device=all`), at one shared scale so their sizes
// compare truly; as a wrapping grid or one row (`?arrange=row`), sorted by type, OS, size, width or height (`?sort=`).
// The screens use the app's real navigation and share overlays (menus, sheets, dialogs, toasts): an action in one shows
// in all, so a flow can be checked on every size at once. Inspect stays off here; the label opens that device.
import type { ProposalLayout } from '../proposals/types';
import { useRef } from 'react';
import { DEVICES, type Device, type DeviceGroup, type DeviceType, type Display } from '../devices/devices';
import { DeviceFrame, frameBox } from './DeviceFrame';
import { computeLayout, type Layout } from './layout';
import { usePan } from './usePan';
import { VIEW_BAR_H, type Arrange, type DeviceSort } from './ViewBar';
import styles from './SimulatorShell.module.css';
import { t } from '../i18n/ui';

const LABEL_H = 40;
const GAP = 40;
const TYPE_ORDER: DeviceType[] = ['phone', 'foldable', 'tablet'];

export interface Entry {
  device: Device;
  display: Display;
  layout: Layout;
}

/**
 * A screen's width and height as shown: landscape swaps them; a portrait-only page in a turned frame too. The whole
 * screen, the video layout's video included.
 */
const shown = (l: Layout) => (l.rotLocked ? { w: l.vh + l.videoH, h: l.vw } : { w: l.vw, h: l.vh + l.videoH });

/**
 * Order of the screens: by device type (phones, foldables, tablets; iOS before Android within each) or OS (iOS /
 * iPadOS, then Android), keeping registry order and a device's displays together; by size (area, smallest first), where a foldable's outer display
 * lands among the phones; or by the width or height shown (smallest first).
 */
function sortEntries(entries: Entry[], sort: DeviceSort): Entry[] {
  const rank = (e: Entry) => {
    if (sort === 'size') return e.display.w * e.display.h;
    if (sort === 'width') return shown(e.layout).w;
    if (sort === 'height') return shown(e.layout).h;
    const os = e.display.os === 'android' ? 1 : 0;
    if (sort === 'os') return os;
    // Type, then OS within each type (iOS / iPadOS before Android).
    return TYPE_ORDER.indexOf(e.device.type) * 2 + os;
  };
  // Array.prototype.sort is stable: ties keep registry order.
  return [...entries].sort((a, b) => rank(a) - rank(b));
}

/** Every device × display with its layout for the current page. */
/** `group`: Compare's preset (DEVICE_GROUPS), the devices and displays it keeps; all of them by default. */
export function allDeviceEntries(land: boolean, detailOpen: boolean, supportedFor: (device: Device, display: Display) => boolean, video = false, group?: DeviceGroup, design: ProposalLayout = {}): Entry[] {
  return DEVICES.flatMap((device) =>
    device.displays.filter((display) => !group || group.has(device, display)).map((display) => ({
      device,
      display,
      layout: computeLayout({ display, land, supported: supportedFor(device, display), detailOpen, video, ...design }),
    })),
  );
}

/** Bounding box of a frame (a rotation-locked frame is turned 90°). */
const box = frameBox;

/** Zoom Fit: one scale for all, the tallest frame fitting the canvas height (capped so phones don't get huge). */
export function allDevicesFit(entries: Entry[], stageH: number): number {
  const tallest = Math.max(...entries.map((e) => box(e.layout).h));
  return Math.max(0.2, Math.min(0.6, (stageH - 2 * GAP - LABEL_H - VIEW_BAR_H) / tallest));
}

export function AllDevices({
  entries,
  scale: k,
  arrange,
  sort,
  theme,
  onOpen,
}: {
  entries: Entry[];
  /** Shared scale (zoom). */
  scale: number;
  /** Grid (wrapping rows) or one row (scrolls sideways). */
  arrange: Arrange;
  /** Order: by type, OS, size, width or height. */
  sort: DeviceSort;
  theme: 'light' | 'dark';
  onOpen: (device: Device, display: Display) => void;
}) {
  const pan = usePan();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`${styles.allDevices} ${arrange === 'row' ? styles.allRow : ''}`}
      style={{ gap: GAP, padding: `${GAP + VIEW_BAR_H}px ${GAP}px ${GAP}px` }}
      {...pan}
    >
      {sortEntries(entries, sort).map(({ device, display, layout }) => {
        const b = box(layout);
        return (
          <div
            key={`${device.id}:${display.key}`}
            className={styles.allItem}
            // Off-canvas devices skip rendering; the intrinsic size keeps the layout (and scroll) unchanged.
            style={{ containIntrinsicSize: `${Math.ceil(b.w * k)}px ${Math.ceil(b.h * k) + LABEL_H}px` }}
          >
            <button className={styles.allLabel} title={t('Open {device}', { device: device.name })} onClick={() => onOpen(device, display)}>
              <span>{device.name}</span>
              <span className={styles.allSub}>
                {device.displays.length > 1 ? `${display.label} · ` : ''}
                {layout.vw}×{layout.vh + layout.videoH}
                {/* The page doesn't rotate here: the frame turns, the screen stays portrait. */}
                {layout.rotLocked ? ` · ${t('portrait only')}` : ''}
              </span>
            </button>
            <div style={{ position: 'relative', width: b.w * k, height: b.h * k }}>
              <DeviceFrame layout={layout} scale={k} theme={theme} />
            </div>
          </div>
        );
      })}
    </div>
  );
}


