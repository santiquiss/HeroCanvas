// Floating view controls at the top left of the canvas (zoom: bottom right, ZoomBar): Flow's device, display and
// orientation; All devices' arrangement, order and orientation, with its Exit. A single device and a set have their
// headers on the canvas instead (DeviceHeader); the screens' theme is ThemeSwitch, at the top
// right. Each mode shows what applies to it. Whether a page supports landscape is page
// config: Page panel → Orientation.
import { Icon } from '../components/Icon';
import { DEVICE_GROUPS, DEVICES, deviceGroup, type Device, type DeviceType, type Display } from '../devices/devices';
import type { Mode } from './modes';
import styles from './Toolbar.module.css';

/** Device menu groups. */
const DEVICE_TYPES: [DeviceType, string][] = [
  ['phone', 'Phones'],
  ['foldable', 'Foldables'],
  ['tablet', 'Tablets'],
];

/** Room the canvas keeps for the bar at its top. */
export const VIEW_BAR_H = 64;

export type Arrange = 'grid' | 'row';
/** All devices: order by device type, OS, size (area), width or height. */
export type DeviceSort = 'type' | 'os' | 'size' | 'width' | 'height';
export const DEVICE_SORTS: DeviceSort[] = ['type', 'os', 'size', 'width', 'height'];

export interface ViewBarProps {
  /** Room on the canvas's left taken by a rail (WhereRail): the bar starts after it. */
  left?: number;
  mode: Mode;
  device: Device;
  display: Display;
  allDevices: boolean;
  arrange: Arrange;
  sort: DeviceSort;
  land: boolean;
  /** The display's video layout (16:9 on top, the app below). */
  video: boolean;
  onVideo: () => void;
  onDevice: (id: string) => void;
  onDisplay: (key: string) => void;
  onArrange: (a: Arrange) => void;
  onSort: (s: DeviceSort) => void;
  onRotate: () => void;
  /** Compare's preset (DEVICE_GROUPS' id). */
  group: string;
  /** Opens Compare on a preset, or switches it there. */
  onCompare: (group: string) => void;
  /** Leaves Compare, back to the view it was opened from. */
  onExit: () => void;
}

function Chip({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button className={`${styles.chip} ${active ? styles.active : ''}`} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export function ViewBar(p: ViewBarProps) {
  // All devices is the prototype's Compare (a preset of devices side by side); Flow works on one device.
  const all = p.allDevices && p.mode === 'prototype';
  // The prototype's single device and its sets: only Compare (each device's header has the rest).
  if (p.mode === 'prototype' && !all)
    return (
      <div className={styles.viewBar} style={p.left ? { left: 12 + p.left } : undefined} data-canvas-ui>
        <GroupPicker title="Compare: devices side by side, at one scale" onPick={p.onCompare}>
          <Icon name="devices" size={18} />
          <span>Compare</span>
        </GroupPicker>
      </div>
    );
  return (
    <div className={styles.viewBar} style={p.left ? { left: 12 + p.left } : undefined} data-canvas-ui>
      {all ? (
        <>
          <Chip onClick={p.onExit} title="Back to the device you compared from">
            <Icon name="close" size={18} />
            Exit compare
          </Chip>
          <GroupPicker title="Which devices" value={p.group} onPick={p.onCompare}>
            <Icon name="devices" size={18} />
            <span>{deviceGroup(p.group).label}</span>
          </GroupPicker>
        </>
      ) : (
        <label className={styles.select}>
          <Icon name={p.device.displays[0].w >= 600 ? 'tablet' : 'smartphone'} size={18} />
          <span>{p.device.name}</span>
          <select value={p.device.id} onChange={(e) => p.onDevice(e.target.value)} title="Device">
            {DEVICE_TYPES.map(([type, label]) => (
              <optgroup key={type} label={label}>
                {DEVICES.filter((d) => d.type === type).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Icon name="expand_more" size={18} />
        </label>
      )}
      {all && <span className={styles.viewSep} />}
      {all ? (
        <div className={styles.segment} title="Arrange devices">
          <Chip active={p.arrange === 'grid'} onClick={() => p.onArrange('grid')} title="Grid">
            <Icon name="grid_view" size={18} />
            Grid
          </Chip>
          <Chip active={p.arrange === 'row'} onClick={() => p.onArrange('row')} title="One row">
            <Icon name="view_carousel" size={18} />
            Row
          </Chip>
        </div>
      ) : null}
      {all ? (
        <label className={styles.select} title="Sort devices">
          <Icon name="sort" size={18} />
          <span>{{ type: 'Type', os: 'OS', size: 'Size', width: 'Width', height: 'Height' }[p.sort]}</span>
          <select value={p.sort} onChange={(e) => p.onSort(e.target.value as DeviceSort)}>
            <option value="type">Sort by type (phones, foldables, tablets), then OS</option>
            <option value="os">Sort by OS (iOS, Android)</option>
            <option value="size">Sort by size (smallest area first)</option>
            <option value="width">Sort by width (narrowest first)</option>
            <option value="height">Sort by height (shortest first)</option>
          </select>
          <Icon name="expand_more" size={18} />
        </label>
      ) : (
        p.device.displays.length > 1 &&
        p.device.displays.map((x) => (
          <Chip key={x.key} active={x.key === p.display.key} onClick={() => p.onDisplay(x.key)}>
            {x.label}
          </Chip>
        ))
      )}
      {p.mode !== 'components' && (
        <>
          <span className={styles.viewSep} />
          <Chip active={p.land} onClick={p.onRotate} title="Rotate device">
            <Icon name="screen_rotation" size={18} />
            {p.land ? 'Landscape' : 'Portrait'}
          </Chip>
          {p.display.videoSplit && !p.land && !all && (
            <Chip active={p.video} onClick={p.onVideo} title="Video layout: a 16:9 video on top, the app below">
              <Icon name="smart_display" size={18} />
              Video
            </Chip>
          )}
        </>
      )}
    </div>
  );
}

/** Compare's presets in a native menu over a chip: picking one opens (or switches) Compare. */
function GroupPicker({ title, value, onPick, children }: { title: string; value?: string; onPick: (group: string) => void; children: React.ReactNode }) {
  return (
    <label className={styles.select} title={title}>
      {children}
      <select
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
          e.target.blur();
        }}
      >
        {!value && <option value="">Compare…</option>}
        {DEVICE_GROUPS.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
      <Icon name="expand_more" size={18} />
    </label>
  );
}

/** Canvas zoom: fit the canvas, or a fixed scale where 1 is one device point per CSS pixel (1:1). */
export type Zoom = 'fit' | number;
const ZOOMS = [0.5, 0.75, 1, 1.5, 2];

export function parseZoom(raw: string | null): Zoom {
  const n = Number(raw);
  return raw && ZOOMS.includes(n) ? n : 'fit';
}

/** Zoom control (bottom right of the canvas): −, a preset menu (Fit shows the scale it uses), +. */
export function ZoomBar({ zoom, fitScale, onZoom }: { zoom: Zoom; fitScale: number; onZoom: (z: Zoom) => void }) {
  const current = zoom === 'fit' ? fitScale : zoom;
  const pct = (z: number) => `${Math.round(z * 100)}%`;
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOMS.find((z) => z > current + 0.001) : [...ZOOMS].reverse().find((z) => z < current - 0.001);
    if (next != null) onZoom(next);
  };
  return (
    <div className={styles.zoomBar} data-canvas-ui>
      <button className={styles.zoomBtn} title="Zoom out" disabled={current <= ZOOMS[0] + 0.001} onClick={() => step(-1)}>
        <Icon name="remove" size={18} />
      </button>
      <label className={`${styles.select} ${styles.zoomSelect}`} title="Zoom">
        <span>{zoom === 'fit' ? `Fit · ${pct(fitScale)}` : zoom === 1 ? '1:1' : pct(zoom)}</span>
        <select value={String(zoom)} onChange={(e) => onZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}>
          <option value="fit">Fit to canvas</option>
          {ZOOMS.map((z) => (
            <option key={z} value={String(z)}>
              {z === 1 ? '1:1 (100%)' : pct(z)}
            </option>
          ))}
        </select>
        <Icon name="expand_more" size={18} />
      </label>
      <button className={styles.zoomBtn} title="Zoom in" disabled={current >= ZOOMS[ZOOMS.length - 1] - 0.001} onClick={() => step(1)}>
        <Icon name="add" size={18} />
      </button>
      <button className={styles.zoomBtn} title="Fit to canvas" disabled={zoom === 'fit'} onClick={() => onZoom('fit')}>
        <Icon name="fit_screen" size={18} />
      </button>
    </div>
  );
}
