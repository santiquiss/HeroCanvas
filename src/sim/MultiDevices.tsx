// A custom set of devices side by side (`?devices=`), each with its own display and orientation, repeats allowed, at
// one scale, closer together the more there are, so they show as large as they can. Each has a small header (DeviceHeader: drag handle,
// device, display, rotate, version, language, remove; what doesn't fit in a ⋯ menu); + at both ends adds one, and a
// small + shows on hover between two to add one there. The screens share the app's navigation and overlays (sheets,
// menus, dialogs, toasts): an action on one shows on all. The active one (the last you touched, or in Inspect with
// nothing selected the one under the pointer) is the inspectable one.
// Each can show its own version instead of the toolbar's (Live, another proposal, a proposal's version): side by side,
// that compares them; the components those versions replace change, navigation stays shared.
import { designLayout } from '../design/overridableRegistry';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
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
import { t } from '../i18n/ui';

/**
 * Canvas margin around the frames, the same above and below so they center on the frames alone: room for the floating
 * view bar and each device's header (36 px, 12 above the frame), which sit outside the layout.
 */
const MARGIN = VIEW_BAR_H + 36 + 12 + 8;
const SIDE = 64;
/** The room between devices: generous for a few, tighter as more share the canvas, so they still show large. */
export const deviceGap = (count: number) => (count <= 2 ? 56 : count === 3 ? 40 : 24);

const TYPES: [DeviceType, string][] = [
  ['phone', t('Phones')],
  ['foldable', t('Foldables')],
  ['tablet', t('Tablets')],
];

/** A native device menu (grouped by type) laid invisibly over its children: any click opens it. */
function DevicePicker({
  value,
  onPick,
  title,
  children,
  className,
  tour,
}: {
  value?: string;
  onPick: (id: string) => void;
  title: string;
  children: React.ReactNode;
  className: string;
  /** What the tour points at it by (data-tour). */
  tour?: string;
}) {
  return (
    <label className={className} title={title} data-tour={tour}>
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
        {TYPES.filter(([type]) => DEVICES.some((d) => d.type === type)).map(([type, label]) => (
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
  if (!c.proposal) return t('Live');
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
function DesignPicker({ value, onPick, row = false }: { value?: string; onPick: (design: string | undefined) => void; row?: boolean }) {
  const global = useGlobalDesign();
  return (
    <label
      className={row ? `${styles.devMenuRow} ${styles.devDesign}` : `${styles.devChip} ${styles.devDesign} ${value ? styles.devChipOn : ''}`}
      title={value ? t('Version on this device: {design}', { design: designLabel(value) }) : t('Version on this device: the global selection ({design})', { design: designLabel(global) })}
    >
      <Icon name="call_split" size={16} />
      {row && <span className={styles.devMenuLabel}>{value ? t('Version: {design}', { design: designLabel(value) }) : t('Version: {design} (global)', { design: designLabel(global) })}</span>}
      <select value={value ?? ''} onChange={(e) => onPick(e.target.value || undefined)} aria-label={t('Version on this device')}>
        <option value="">{t('{name} (Global selection)', { name: designLabel(global) })}</option>
        <option value="live">{t('Live')}</option>
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
function LanguagePicker({ value, onPick, row = false }: { value?: Language; onPick: (lang: Language | undefined) => void; row?: boolean }) {
  const get = useUrlParams();
  const global = LANGUAGES.find((l) => l.id === languageIn(get(LANG_PARAM)))!;
  const own = value && LANGUAGES.find((l) => l.id === value);
  return (
    <label
      className={row ? `${styles.devMenuRow} ${styles.devDesign}` : `${styles.devChip} ${styles.devDesign} ${own ? styles.devChipOn : ''}`}
      title={own ? t('Language on this device: {language}', { language: own.name }) : t('Language on this device: the global one ({language})', { language: global.name })}
    >
      <Icon name="translate" size={16} />
      {row ? <span className={styles.devMenuLabel}>{own ? t('Language: {language}', { language: own.name }) : t('Language: {language} (global)', { language: global.name })}</span> : own && <span>{own.id}</span>}
      <select value={value ?? ''} onChange={(e) => onPick((e.target.value || undefined) as Language | undefined)} aria-label={t('Language on this device')}>
        <option value="">{t('{name} (Global selection)', { name: global.name })}</option>
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
      title={between ? t('Add a device here') : side === 'left' ? t('Add a device on the left') : t('Add a device on the right')}
      onPick={onPick}
      tour={between ? undefined : 'add-device'}
    >
      <Icon name="add" size={between ? 14 : 20} />
    </DevicePicker>
  );
}


/** What a header can show after its device's name, in order; the first of `DROP` go into its ⋯ menu first. */
type HeadPart = 'displays' | 'video' | 'rotate' | 'design' | 'language';
const DROP: HeadPart[] = ['language', 'design', 'video', 'rotate', 'displays'];
/** The name keeps at least this much (or all of it, if shorter) before a control moves into the menu. */
const NAME_MIN = 84;

/**
 * A device's header on the canvas: its device, its displays, the video layout, rotate; in a set also the drag handle,
 * its version, its language and remove. The single device has one too (the view bar has Compare). Narrower than all of
 * them (`style.maxWidth`, a device zoomed out), what doesn't fit goes into a ⋯ menu, the least used first; remove
 * stays out, last of all.
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
  const hasVideo = !!(findDisplay(dev, displayKey).videoSplit && !land && onVideo);
  const parts: HeadPart[] = [
    ...(dev.displays.length > 1 ? (['displays'] as const) : []),
    ...(hasVideo ? (['video'] as const) : []),
    'rotate' as const,
    ...(design ? (['design'] as const) : []),
    ...(language ? (['language'] as const) : []),
  ];

  // Which parts fit: each one's width read from a hidden copy of them all, against the room the header has.
  const measure = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<HeadPart[]>([]);
  // Too narrow even then: the name drops its chevron (the name still opens the menu) to keep more of itself.
  const [tight, setTight] = useState(false);
  const room = typeof style?.maxWidth === 'number' ? style.maxWidth : Infinity;
  const key = parts.join() + displayKey + land + (design?.value ?? '') + (language?.value ?? '');
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const width = (k: string) => el.querySelector<HTMLElement>(`[data-part="${k}"]`)?.offsetWidth ?? 0;
    const GAP_PX = 4;
    const PAD = 8;
    const fixed = PAD + (grip ? width('grip') + GAP_PX : 0) + Math.min(width('name'), NAME_MIN) + (onRemove ? width('remove') + GAP_PX : 0);
    const sizes = new Map(parts.map((p) => [p, width(p) + GAP_PX]));
    const more = width('more') + GAP_PX;
    const drop: HeadPart[] = [];
    const total = () => fixed + parts.filter((p) => !drop.includes(p)).reduce((w, p) => w + sizes.get(p)!, 0) + (drop.length ? more : 0);
    for (const p of DROP) {
      if (total() <= room) break;
      if (parts.includes(p)) drop.push(p);
    }
    setHidden((h) => (h.join() === drop.join() ? h : drop));
    setTight(total() > room);
    // `parts` is described by `key`.
  }, [key, room, !!grip, !!onRemove]);

  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: globalThis.PointerEvent) => !root.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);
  const shown = hidden.length ? parts.filter((p) => !hidden.includes(p)) : parts;
  const closing = (f: () => void) => () => {
    f();
    setMenu(false);
  };

  const chip = (p: HeadPart) => {
    switch (p) {
      case 'displays':
        return dev.displays.map((x) => (
          <button key={x.key} className={`${styles.devChip} ${x.key === displayKey ? styles.devChipOn : ''}`} onClick={() => onDisplay(x.key)}>
            {x.label.split(' ')[0]}
          </button>
        ));
      case 'video':
        return (
          <button key={p} className={`${styles.devChip} ${video ? styles.devChipOn : ''}`} title={t('Video layout: 16:9 on top, the app below')} onClick={onVideo}>
            <Icon name="smart_display" size={16} />
          </button>
        );
      case 'rotate':
        return (
          <button key={p} data-tour="rotate" className={`${styles.devChip} ${land ? styles.devChipOn : ''}`} title={land ? t('Portrait') : t('Landscape')} onClick={onRotate}>
            <Icon name="screen_rotation" size={16} />
          </button>
        );
      case 'design':
        return <DesignPicker key={p} value={design!.value} onPick={design!.onPick} />;
      case 'language':
        return <LanguagePicker key={p} value={language!.value} onPick={language!.onPick} />;
    }
  };
  const row = (p: HeadPart) => {
    const check = (on: boolean) => <Icon name="check" size={16} className={on ? styles.devMenuCheck : styles.devMenuNoCheck} />;
    switch (p) {
      case 'displays':
        return dev.displays.map((x) => (
          <button key={x.key} className={styles.devMenuRow} onClick={closing(() => onDisplay(x.key))}>
            {check(x.key === displayKey)}
            <span className={styles.devMenuLabel}>{x.label}</span>
          </button>
        ));
      case 'video':
        return (
          <button key={p} className={styles.devMenuRow} onClick={closing(() => onVideo?.())}>
            {check(!!video)}
            <span className={styles.devMenuLabel}>{t('Video layout')}</span>
          </button>
        );
      case 'rotate':
        return (
          <button key={p} className={styles.devMenuRow} onClick={closing(onRotate)}>
            {check(land)}
            <span className={styles.devMenuLabel}>{t('Landscape')}</span>
          </button>
        );
      case 'design':
        return <DesignPicker key={p} row value={design!.value} onPick={(v) => (design!.onPick(v), setMenu(false))} />;
      case 'language':
        return <LanguagePicker key={p} row value={language!.value} onPick={(v) => (language!.onPick(v), setMenu(false))} />;
    }
  };

  return (
    <div ref={root} className={`${styles.devHead} ${menu ? styles.devHeadOpen : ''} ${tight ? styles.devHeadTight : ''} ${className ?? ''}`} style={style} data-canvas-ui>
      {grip && (
        <span className={styles.devGrip} title={t('Drag to reorder')} {...grip}>
          <Icon name="drag_indicator" size={16} />
        </span>
      )}
      <DevicePicker className={styles.devName} value={id} title={t('{device} · change device', { device: dev.name })} onPick={onDevice} tour="device-menu">
        <span className={styles.devNameText}>{dev.name}</span>
        {!tight && <Icon name="expand_more" size={16} />}
      </DevicePicker>
      {shown.map(chip)}
      {hidden.length > 0 && (
        <button className={`${styles.devChip} ${menu ? styles.devChipOn : ''}`} title={t('More')} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <Icon name="more_horiz" size={16} />
        </button>
      )}
      {/* Remove, always shown and last of all. */}
      {onRemove && (
        <button className={styles.devChip} title={t('Remove')} onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      )}
      {menu && hidden.length > 0 && (
        <div className={styles.devMenu} role="menu">
          {parts.filter((p) => hidden.includes(p)).map(row)}
        </div>
      )}
      {/* Every part at its full width, unseen: what the header measures to know what fits. */}
      <div ref={measure} className={styles.devMeasure} aria-hidden inert>
        {grip && (
          <span className={styles.devGrip} data-part="grip">
            <Icon name="drag_indicator" size={16} />
          </span>
        )}
        <span className={styles.devName} data-part="name">
          <span>{dev.name}</span>
          <Icon name="expand_more" size={16} />
        </span>
        {parts.map((p) => (
          <span key={p} className={styles.devMeasurePart} data-part={p}>
            {chip(p)}
          </span>
        ))}
        <span className={styles.devChip} data-part="more">
          <Icon name="more_horiz" size={16} />
        </span>
        <span className={styles.devChip} data-part="remove">
          <Icon name="close" size={16} />
        </span>
      </div>
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
  const fixed = 2 * SIDE + deviceGap(layouts.length) * (layouts.length - 1);
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
  const gap = deviceGap(items.length);
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
      shift: rects[i].width + gap,
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
        <div className={styles.multiFrames} style={{ gap }}>
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
                  <div className={styles.gapSlot} style={{ margin: `0 ${-gap / 2}px` }} hidden={dragging != null}>
                    <div className={styles.gapHit} style={{ width: gap }}>
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
                    style={{ maxWidth: b.w * k + gap }}
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
                    // A language of its own only when the app has more than one to show.
                    language={LANGUAGES.length > 1 ? { value: it.lang, onPick: (lang) => update(i, { lang }) } : undefined}
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
