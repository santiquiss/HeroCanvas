// HeroCanvas's iOS kit (`herocanvas/ios`): SwiftUI's own views, as an app that uses them draws them on iOS, for
// mirroring a SwiftUI (or UIKit) app without rebuilding the platform's parts every time: a screen in a
// NavigationStack (its large title collapsing into a glass bar), List's inset grouped Sections and their rows
// (NavigationLink, LabeledContent, Label), Picker (segmented and menu), searchable's field, TextField, Toggle, Gauge.
// Named as SwiftUI names them, so Inspect and Layers say what a developer writes; drawn on the app's tokens
// (`--app-*`); their glyphs SF Symbols when the team made them (`npm run symbols`), Material's otherwise.
// The app's own components stay the app's (app/components), named as its code names them.
import { useState, type ReactNode, type UIEvent } from 'react';
import { hasSymbol, Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { useNav, useSplit } from '../nav/context';
import { usePadL, usePadR, useSim } from '../sim/SimContext';
import styles from './ios.module.css';

/** A system glyph: its SF Symbol when the team made it, else the closest Material Symbol. */
function Glyph({ sf, material, size = 20, className }: { sf: string; material: string; size?: number; className?: string }) {
  return <Icon name={hasSymbol(sf) ? `sf:${sf}` : material} size={size} className={className} />;
}

/** An icon a view takes: `sf:<name>` or a Material Symbol's name, or any element. */
const icon = (i: ReactNode, size = 22) => (typeof i === 'string' ? <Icon name={i} size={size} /> : i);

export interface NavigationStackProps {
  /** `.navigationTitle`. */
  title: string;
  /** `.navigationBarTitleDisplayMode`: `automatic` (large on a stack's root and the screens over it), `inline`. */
  titleDisplayMode?: 'automatic' | 'large' | 'inline';
  /** The List's style: `insetGrouped` (the grouped background) or `plain` (the surface). */
  listStyle?: 'insetGrouped' | 'plain';
  /** `.toolbar`'s trailing items. */
  toolbar?: ReactNode;
  /** `.searchable`: its field under the title. */
  searchable?: { text: string; prompt?: string; onChange: (text: string) => void };
  children: ReactNode;
}

/**
 * A screen of a NavigationStack: its large title at the content's start, collapsing as it scrolls into the bar,
 * which turns to glass once content is under it; back on a pushed screen (none beside a split's sidebar), the
 * toolbar at its end.
 */
export function NavigationStack({ title, titleDisplayMode = 'automatic', listStyle = 'insetGrouped', toolbar, searchable, children }: NavigationStackProps) {
  const hc = useComponent('NavigationStack', { title, titleDisplayMode, listStyle });
  const { layout } = useSim();
  const nav = useNav();
  const split = useSplit();
  const padL = usePadL();
  const padR = usePadR();
  const besideSidebar = split?.role === 'detail' && nav.index === split.masterIndex + 1;
  const back = nav.index > 0 && !besideSidebar;
  const large = titleDisplayMode !== 'inline';
  const [edge, setEdge] = useState({ under: false, collapsed: !large });
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    const next = { under: top > 1, collapsed: !large || top > 40 };
    if (next.under !== edge.under || next.collapsed !== edge.collapsed) setEdge(next);
  };
  return (
    <div {...hc} className={`${styles.screen} ${listStyle === 'plain' ? styles.plain : ''}`}>
      <div className={styles.scroll} style={{ paddingLeft: padL, paddingRight: padR, paddingBottom: nav.index === 0 ? layout.padB : layout.padBPush }} onScroll={onScroll}>
        <div className={`${styles.bar} ${edge.under ? styles.barUnder : ''}`} style={{ margin: `0 ${-padR}px 0 ${-padL}px`, padding: `${layout.headerY - 22}px ${padR}px 6px ${padL}px` }}>
          <span className={styles.barGlass} aria-hidden />
          <span className={styles.barSide}>
            {back && (
              <button className={styles.barButton} aria-label="Back" onClick={nav.back}>
                <Glyph sf="chevron.backward" material="arrow_back_ios_new" size={22} className={styles.flip} />
              </button>
            )}
          </span>
          <span className={`${styles.barTitle} ${edge.collapsed ? styles.barTitleShown : ''}`}>{title}</span>
          <span className={`${styles.barSide} ${styles.barEnd}`}>{toolbar}</span>
        </div>
        {large && <h1 className={styles.largeTitle}>{title}</h1>}
        {searchable && <SearchField {...searchable} />}
        {children}
      </div>
    </div>
  );
}

/** A List's Section: its header, its rows in an inset grouped group, its footer. */
export function Section({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const hc = useComponent('Section', { header: typeof header === 'string' ? header : undefined });
  return (
    <section {...hc} className={styles.section}>
      {header && <h2 className={styles.sectionHeader}>{header}</h2>}
      <div className={styles.group}>{children}</div>
      {footer && <p className={styles.sectionFooter}>{footer}</p>}
    </section>
  );
}

/** A row that pushes (NavigationLink): its Label, a `.badge`, the chevron; selected in a split's sidebar, tinted. */
export function NavigationLink({ icon: i, title, badge, selected = false, iconTint = 'accent', onTap, children }: { icon?: ReactNode; title?: string; badge?: ReactNode; selected?: boolean; iconTint?: 'accent' | 'secondary'; onTap: () => void; children?: ReactNode }) {
  const hc = useComponent('NavigationLink', { title, badge: typeof badge === 'object' ? undefined : badge, selected });
  return (
    <button {...hc} className={`${styles.row} ${styles.tappable} ${selected ? styles.selected : ''}`} onClick={onTap}>
      {i && <span className={iconTint === 'accent' ? styles.rowIcon : styles.rowIconSecondary}>{icon(i)}</span>}
      <span className={styles.rowMain}>{children ?? <span>{title}</span>}</span>
      {badge != null && <span className={styles.badge}>{badge}</span>}
      {!selected && <Glyph sf="chevron.forward" material="chevron_right" size={18} className={`${styles.chevron} ${styles.flip}`} />}
    </button>
  );
}

/** LabeledContent: a label at the start, its value at the end in secondary. */
export function LabeledContent({ label, children }: { label: ReactNode; children: ReactNode }) {
  const hc = useComponent('LabeledContent', { label: typeof label === 'string' ? label : undefined });
  return (
    <div {...hc} className={styles.row}>
      <span className={styles.rowMain}>
        <span>{label}</span>
      </span>
      <span className={styles.badge}>{children}</span>
    </div>
  );
}

/** Label: an icon and its title, side by side. */
export function Label({ icon: i, title, iconStyle = 'accent' }: { icon: ReactNode; title: ReactNode; iconStyle?: 'accent' | 'secondary' | 'inherit' }) {
  const hc = useComponent('Label', { title: typeof title === 'string' ? title : undefined });
  return (
    <span {...hc} className={styles.label}>
      <span className={iconStyle === 'accent' ? styles.rowIcon : iconStyle === 'secondary' ? styles.rowIconSecondary : undefined}>{icon(i, 18)}</span>
      <span>{title}</span>
    </span>
  );
}

export interface PickerProps<T extends string> {
  label: string;
  selection: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (value: T) => void;
  /** `.pickerStyle`: `segmented`, or `menu` (a Form's row: the label, then the picked option and its chevrons). */
  pickerStyle?: 'segmented' | 'menu';
}

/** Picker: segmented (the options in a capsule, the picked one raised) or a Form's menu row. */
export function Picker<T extends string>({ label, selection, options, onChange, pickerStyle = 'menu' }: PickerProps<T>) {
  const hc = useComponent('Picker', { label, selection, pickerStyle });
  if (pickerStyle === 'segmented')
    return (
      <div {...hc} className={styles.segmented} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} role="radio" aria-checked={o.value === selection} className={o.value === selection ? styles.segOn : ''} onClick={() => onChange(o.value)}>
            {o.icon && <Icon name={o.icon} size={15} />}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    );
  const picked = options.find((o) => o.value === selection);
  return (
    <label {...hc} className={styles.row}>
      <span className={styles.rowMain}>
        <span>{label}</span>
      </span>
      <span className={styles.menuValue}>
        <span>{picked?.label}</span>
        <Glyph sf="chevron.up.chevron.down" material="unfold_more" size={15} />
      </span>
      <select className={styles.menuSelect} value={selection} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** `.searchable`'s field: a magnifier and its prompt, on the tertiary fill. */
export function SearchField({ text, prompt = 'Search', onChange }: { text: string; prompt?: string; onChange: (text: string) => void }) {
  const hc = useComponent('SearchField', { prompt });
  return (
    <label {...hc} className={styles.search}>
      <Glyph sf="magnifyingglass" material="search" size={17} />
      <input value={text} placeholder={prompt} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** TextField, in a Form's row. */
export function TextField({ text, prompt, onChange }: { text: string; prompt?: string; onChange?: (text: string) => void }) {
  const hc = useComponent('TextField', { text, prompt });
  return <input {...hc} className={styles.textField} value={text} placeholder={prompt} onChange={(e) => onChange?.(e.target.value)} readOnly={!onChange} />;
}

/** Toggle: its label and iOS's switch, green when on. */
export function Toggle({ label, isOn, onChange }: { label: string; isOn: boolean; onChange: (on: boolean) => void }) {
  const hc = useComponent('Toggle', { label, isOn });
  return (
    <label {...hc} className={styles.row}>
      <span className={styles.rowMain}>
        <span>{label}</span>
      </span>
      <button role="switch" aria-checked={isOn} aria-label={label} className={`${styles.switch} ${isOn ? styles.switchOn : ''}`} onClick={() => onChange(!isOn)} />
    </label>
  );
}

/** Gauge (the linear style): a bar filled to `value` of `max`, in the accent or in secondary. */
export function Gauge({ value, max = 1, tint = 'accent' }: { value: number; max?: number; tint?: 'accent' | 'secondary' }) {
  const hc = useComponent('Gauge', { value, max, tint });
  return (
    <span {...hc} className={styles.gauge}>
      <span className={tint === 'accent' ? styles.gaugeAccent : undefined} style={{ width: `${max ? (Math.max(0, Math.min(value, max)) / max) * 100 : 0}%` }} />
    </span>
  );
}
