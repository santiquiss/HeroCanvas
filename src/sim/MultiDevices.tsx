// A custom set of devices side by side (`?devices=`), each with its own display and orientation, repeats allowed, at
// one scale. Each has a small header (DeviceHeader: drag handle, device, display, rotate, version, remove); + at both ends adds one, and a
// small + shows on hover between two to add one there. The screens share the app's navigation and overlays (sheets,
// menus, dialogs, toasts): an action on one shows on all. The active one (the last you touched, or in Inspect with
// nothing selected the one under the pointer) is the inspectable one.
// Each can show its own version instead of the toolbar's (Live, another proposal, a proposal's version): side by side,
// that compares them; the components those versions replace change, navigation stays shared.
import { designLayout } from '../design/overridableRegistry';
import { Fragment, useRef, useState, type PointerEvent } from 'react';
import { Icon } from '../components/Icon';
import { DEVICES, findDevice, findDisplay, type DeviceType } from '../devices/devices';
import { supportsLandscape } from '../nav/screenConfig';
import type { Landscape } from '../nav/types';
import { InspectOverlay } from '../tools/InspectOverlay';
import { CommentPins } from '../comments';
import { useDesign } from '../design/DesignContext';
import { DesignOverride } from '../design/overridable';
import { activeVariant, findProposal, listedProposals, proposalLabel, VARIANT_PARAM } from '../proposals';
import { useUrlParams } from './SimContext';
import { LANG_PARAM, LANGUAGES, languageIn, type Language } from './language';
import { designChoice, type DeviceItem } from './deviceSet';
import { DeviceFrame, frameBox } from './DeviceFrame';
import { computeLayout, type Layout } from './layout';
import { usePan } from './usePan';
import { VIEW_BAR_H } from './ViewBar';
import styles from './SimulatorShell.module.css';

/**
 * Canvas margin around the frames, the same above and below so they center on the frames alone: room for the floating
 * view bar and each device's header (36 px, 12 above the frame), which sit outside the layout.
 */
const MARGIN = VIEW_BAR_H + 36 + 12 + 8;
const SIDE = 96;
const GAP = 48;

const TYPES: [DeviceType, string][] = [
  ['phone', 'Phones'],
  ['foldable', 'Foldables'],
  ['tablet', 'Tablets'],
];

/** A native device menu (grouped by type) laid invisibly over its children: any click opens it. */
function DevicePicker({
  value,
  onPick,
  title,
  children,
  className,
}: {
  value?: string;
  onPick: (id: string) => void;
  title: string;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <label className={className} title={title}>
      {children}
      <select
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
          // Let go of focus so a hover-revealed + hides again once picked.
          e.target.blur();
        }}
      >
        {!value && <option value="">{title}</option>}
        {TYPES.map(([type, label]) => (
          <optgroup key={type} label={label}>
            {DEVICES.filter((d) => d.type === type).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** A version's name: Live, the proposal, or the proposal and its version. */
function designLabel(design: string): string {
  const c = designChoice(design)!;
  if (!c.proposal) return 'Live';
  // By its code, or its folder (a set saved before proposals had codes).
  const p = findProposal(c.proposal);
  if (!p) return c.proposal;
  const v = c.variant && p.variants.find((x) => x.id === c.variant);
  return v ? `${proposalLabel(p)} · ${v.id.toUpperCase()} ${v.label}` : proposalLabel(p);
}

/** The toolbar's version, as a device's version string: `live`, the proposal, or `proposal~version`. */
function useGlobalDesign(): string {
  const get = useUrlParams();
  const p = findProposal(get('proposal'));
  if (!p) return 'live';
  const v = activeVariant(p, get(VARIANT_PARAM));
  return v ? `${p.id}~${v.id}` : p.id;
}

/**
 * The device's version: by default the global selection (the toolbar's, named in the list); another one (Live, a
 * proposal, a proposal's version) is an override, and turns the icon on.
 */
function DesignPicker({ value, onPick }: { value?: string; onPick: (design: string | undefined) => void }) {
  const global = useGlobalDesign();
  return (
    <label className={`${styles.devChip} ${styles.devDesign} ${value ? styles.devChipOn : ''}`} title={value ? `Version on this device: ${designLabel(value)}` : `Version on this device: the global selection (${designLabel(global)})`}>
      <Icon name="call_split" size={16} />
      <select value={value ?? ''} onChange={(e) => onPick(e.target.value || undefined)} aria-label="Version on this device">
        <option value="">{designLabel(global)} (Global selection)</option>
        <option value="live">Live</option>
        {listedProposals(value?.split('~')[0]).map((p) =>
          p.variants.length ? (
            <optgroup key={p.id} label={proposalLabel(p)}>
              {p.variants.map((v) => (
                <option key={v.id} value={`${p.id}~${v.id}`}>
                  {v.id.toUpperCase()} · {v.label}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={p.id} value={p.id}>
              {proposalLabel(p)}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

/**
 * The device's language: by default the global one (`?lang=`, Scenarios › Language, named in the list); another is an
 * override, the icon on with its code (a row of devices reads as the languages they show).
 */
function LanguagePicker({ value, onPick }: { value?: Language; onPick: (lang: Language | undefined) => void }) {
  const get = useUrlParams();
  const global = LANGUAGES.find((l) => l.id === languageIn(get(LANG_PARAM)))!;
  const own = value && LANGUAGES.find((l) => l.id === value);
  return (
    <label className={`${styles.devChip} ${styles.devDesign} ${own ? styles.devChipOn : ''}`} title={own ? `Language on this device: ${own.name}` : `Language on this device: the global one (${global.name})`}>
      <Icon name="translate" size={16} />
      {own && <span>{own.id}</span>}
      <select value={value ?? ''} onChange={(e) => onPick((e.target.value || undefined) as Language | undefined)} aria-label="Language on this device">
        <option value="">{global.name} (Global selection)</option>
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Round + that adds a device next to the current one(s). */
export function AddDeviceButton({ onPick, side }: { onPick: (id: string) => void; side: 'left' | 'right' | 'between' }) {
  const between = side === 'between';
  return (
    <DevicePicker
      className={`${styles.addDevice} ${between ? styles.addDeviceSmall : ''}`}
      title={between ? 'Add a device here' : `Add a device on the ${side}`}
      onPick={onPick}
    >
      <Icon name="add" size={between ? 16 : 20} />
    </DevicePicker>
  );
}


/**
 * A device's header on the canvas: its device, its displays, the video layout, rotate; in a set also
 * the drag handle, its version and remove. The single device has one too (the view bar has Compare).
 */
export function DeviceHeader({
  device: id,
  display: displayKey,
  land,
  video,
  onVideo,
  onDevice,
  onDisplay,
  onRotate,
  grip,
  design,
  language,
  onRemove,
  className,
  style,
}: {
  device: string;
  display: string;
  land: boolean;
  video?: boolean;
  onVideo?: () => void;
  onDevice: (id: string) => void;
  onDisplay: (key: string) => void;
  onRotate: () => void;
  grip?: Pick<React.HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>;
  design?: { value?: string; onPick: (design: string | undefined) => void };
  language?: { value?: Language; onPick: (lang: Language | undefined) => void };
  onRemove?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const dev = findDevice(id);
  return (
    <div className={`${styles.devHead} ${className ?? ''}`} style={style} data-canvas-ui>
      {grip && (
        <span className={styles.devGrip} title="Drag to reorder" {...grip}>
          <Icon name="drag_indicator" size={16} />
        </span>
      )}
      <DevicePicker className={styles.devName} value={id} title={`${dev.name} · change device`} onPick={onDevice}>
        <span className={styles.devNameText}>{dev.name}</span>
        <Icon name="expand_more" size={16} />
      </DevicePicker>
      {dev.displays.length > 1 &&
        dev.displays.map((x) => (
          <button key={x.key} className={`${styles.devChip} ${x.key === displayKey ? styles.devChipOn : ''}`} onClick={() => onDisplay(x.key)}>
            {x.label.split(' ')[0]}
          </button>
        ))}
      {findDisplay(dev, displayKey).videoSplit && !land && onVideo && (
        <button className={`${styles.devChip} ${video ? styles.devChipOn : ''}`} title="Video layout: 16:9 on top, the app below" onClick={onVideo}>
          <Icon name="smart_display" size={16} />
        </button>
      )}
      <button className={`${styles.devChip} ${land ? styles.devChipOn : ''}`} title={land ? 'Portrait' : 'Landscape'} onClick={onRotate}>
        <Icon name="screen_rotation" size={16} />
      </button>
      {design && <DesignPicker value={design.value} onPick={design.onPick} />}
      {language && <LanguagePicker value={language.value} onPick={language.onPick} />}
      {onRemove && (
        <button className={styles.devChip} title="Remove" onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

/** `toolbar`: the toolbar's design, for the devices that keep it (their own design, `design`, else). */
export function multiLayouts(items: DeviceItem[], detailOpen: boolean, pageLandscape: Landscape | undefined, video = false, toolbar: { proposal: string | null; variant: string | null } = { proposal: null, variant: null }, railFolded = false): Layout[] {
  return items.map((it) => {
    const display = findDisplay(findDevice(it.device), it.display);
    const design = designChoice(it.design) ?? toolbar;
    return computeLayout({
      ...designLayout(design.proposal, design.variant, railFolded),
      display,
      land: it.land,
      supported: supportsLandscape(pageLandscape, findDevice(it.device), display),
      detailOpen,
      video,
    });
  });
}

/** Zoom Fit: every device on the canvas fits it — the tallest frame its height (with the margin for the headers), the whole row its width — up to 1:1. */
export function multiFit(layouts: Layout[], stageW: number, stageH: number): number {
  const boxes = layouts.map(frameBox);
  const tallest = Math.max(...boxes.map((b) => b.h));
  // The whole row: the frames scale, the gaps and the side margins (the end +s) don't.
  const row = boxes.reduce((w, b) => w + b.w, 0);
  const fixed = 2 * SIDE + GAP * (layouts.length - 1);
  return Math.max(0.2, Math.min(1, (stageH - 2 * MARGIN) / tallest, (stageW - fixed) / row));
}

export function MultiDevices({
  items,
  layouts,
  scale: k,
  theme,
  video = false,
  onVideo,
  onChange,
}: {
  items: DeviceItem[];
  layouts: Layout[];
  scale: number;
  theme: 'light' | 'dark';
  /** The video layout, on the displays that offer it (one switch for the whole canvas). */
  video?: boolean;
  onVideo?: () => void;
  onChange: (items: DeviceItem[]) => void;
}) {
  const [active, setActive] = useState(0);
  const act = Math.min(active, items.length - 1);
  const pan = usePan();
  const content = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const update = (i: number, patch: Partial<DeviceItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const insert = (at: number, id: string) => {
    const dev = findDevice(id);
    const next = [...items];
    next.splice(at, 0, {
      device: id,
      display: dev.displays[0].key,
      land: false,
    });
    onChange(next);
    setActive(at);
  };
  const remove = (i: number) => {
    onChange(items.filter((_, j) => j !== i));
    setActive(Math.max(0, act > i ? act - 1 : act === i ? i - 1 : act));
  };

  // Drag to reorder (the header's handle): the dragged device follows the pointer, the others slide to make room, and
  // the drop commits the new order. Moves write transforms directly, so the screens don't re-render while dragging.
  const itemEls = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{
    from: number;
    x: number;
    to: number;
    centers: number[];
    shift: number;
  } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const dragStart = (i: number, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || items.length < 2) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rects = items.map((_, j) => itemEls.current[j]!.getBoundingClientRect());
    drag.current = {
      from: i,
      x: e.clientX,
      to: i,
      centers: rects.map((r) => r.left + r.width / 2),
      shift: rects[i].width + GAP,
    };
    setDragging(i);
  };
  const dragMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const center = d.centers[d.from] + dx;
    d.to = d.centers.filter((c, j) => j !== d.from && c < center).length;
    itemEls.current.forEach((el, j) => {
      if (!el) return;
      if (j === d.from) el.style.transform = `translateX(${dx}px)`;
      else if (d.from < d.to && j > d.from && j <= d.to) el.style.transform = `translateX(${-d.shift}px)`;
      else if (d.to < d.from && j >= d.to && j < d.from) el.style.transform = `translateX(${d.shift}px)`;
      else el.style.transform = '';
    });
  };
  const dragEnd = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    itemEls.current.forEach((el) => el && (el.style.transform = ''));
    setDragging(null);
    if (d.to === d.from) return;
    const next = [...items];
    const [moved] = next.splice(d.from, 1);
    next.splice(d.to, 0, moved);
    onChange(next);
    // The active device stays the same device.
    const order = items.map((_, j) => j);
    const [m] = order.splice(d.from, 1);
    order.splice(d.to, 0, m);
    setActive(order.indexOf(act));
  };

  return (
    <div ref={canvas} className={styles.multi} {...pan}>
      <div ref={content} className={styles.multiRow} style={{ padding: `${MARGIN}px ${SIDE}px` }}>
        {/* Only the frames are laid out: headers and the end + are positioned around them. */}
        <div className={styles.multiFrames} style={{ gap: GAP }}>
          <span className={`${styles.multiEnd} ${styles.multiEndL}`}>
            <AddDeviceButton side="left" onPick={(id) => insert(0, id)} />
          </span>
          {items.map((it, i) => {
            const layout = layouts[i];
            const b = frameBox(layout);
            return (
              <Fragment key={i}>
                {i > 0 && (
                  // Zero-width slot in the gap (its negative margins cancel the extra flex gap); hovering the gap shows a small +.
                  <div className={styles.gapSlot} style={{ margin: `0 ${-GAP / 2}px` }} hidden={dragging != null}>
                    <div className={styles.gapHit} style={{ width: GAP }}>
                      <AddDeviceButton side="between" onPick={(id) => insert(i, id)} />
                    </div>
                  </div>
                )}
                <div
                  ref={(el) => {
                    itemEls.current[i] = el;
                  }}
                  className={`${styles.multiItem} ${i === act ? styles.multiActive : ''} ${dragging === i ? styles.multiDragging : ''} ${dragging != null && dragging !== i ? styles.multiShifting : ''}`}
                >
                  {/* No wider than its frame and the gap: zoomed out, neighbours' headers don't overlap (the name gives). */}
                  <DeviceHeader
                    className={it.design || it.lang ? styles.devHeadOwn : undefined}
                    style={{ maxWidth: b.w * k + GAP }}
                    device={it.device}
                    display={it.display}
                    land={it.land}
                    video={video}
                    onVideo={onVideo}
                    onDevice={(id) => update(i, { device: id, display: findDevice(id).displays[0].key })}
                    onDisplay={(key) => update(i, { display: key })}
                    onRotate={() => update(i, { land: !it.land })}
                    grip={{ onPointerDown: (e) => dragStart(i, e), onPointerMove: dragMove, onPointerUp: dragEnd, onPointerCancel: dragEnd }}
                    design={{ value: it.design, onPick: (design) => update(i, { design }) }}
                    language={{ value: it.lang, onPick: (lang) => update(i, { lang }) }}
                    onRemove={() => remove(i)}
                  />
                  {/* Touching a device makes it the active one, before the touch reaches the app. In Inspect, so does
                      hovering it with nothing selected: its components highlight at once (a selection stays on its
                      device until a click picks on another). */}
                  <ActiveDevice w={b.w * k} h={b.h * k} active={i === act} onActivate={() => setActive(i)}>
                    <DesignOverride.Provider value={designChoice(it.design)}>
                      <DeviceFrame layout={layout} scale={k} theme={theme} language={it.lang} active={i === act} screen={{ device: it.device, display: it.display, design: it.design }} />
                    </DesignOverride.Provider>
                  </ActiveDevice>
                </div>
              </Fragment>
            );
          })}
          <span className={`${styles.multiEnd} ${styles.multiEndR}`}>
            <AddDeviceButton side="right" onPick={(id) => insert(items.length, id)} />
          </span>
        </div>
        <InspectOverlay stage={content} />
        <CommentPins stage={content} />
      </div>
    </div>
  );
}

/**
 * A device's box in the set, which makes it the active one when touched or (Inspect, nothing selected) hovered. Reads
 * the Inspect state itself: a hover re-renders this box, not the devices in it.
 */
function ActiveDevice({ w, h, active, onActivate, children }: { w: number; h: number; active: boolean; onActivate: () => void; children: React.ReactNode }) {
  const { inspect, selected, selectedEl } = useDesign();
  return (
    <div
      style={{ position: 'relative', width: w, height: h }}
      onPointerDownCapture={() => !active && onActivate()}
      onPointerMove={() => inspect && !selected && !selectedEl && !active && onActivate()}
    >
      {children}
    </div>
  );
}
