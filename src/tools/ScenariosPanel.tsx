// Scenarios: the conditions to try the screens in. The persona (who's using the app: the app's personas, for every
// page), the language, the system's accessibility settings, and the controls of each page in the stack (manifest
// `controls`: content, special cases) — each a row: a dropdown, or a switch for one that's on or off. Everything goes
// to the URL, so a scenario can be shared; screens read it as usual (usePersona, their state params), never from this
// panel.
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { ACCESSIBILITY_PARAMS, accessibilityIn, DEFAULT_TEXT_SIZE, TEXT_SIZES, textSizeFor, textSystemOf } from '../sim/systemText';
import { findDevice, findDisplay } from '../devices/devices';
import { useNavRoot } from '../nav/context';
import type { PageControl } from '../nav/types';
import { useUrlPatch } from '../sim/SimContext';
import { BASE_LANGUAGE, LANG_PARAM, LANGUAGES, languageIn } from '../sim/language';
import styles from './Panel.module.css';
import { PersonaPicker, usePersonaParam } from './PersonaPicker';

interface Option {
  value: string;
  label: string;
}

export function ScenariosPanel() {
  const nav = useNavRoot();
  const [persona, pick] = usePersonaParam();
  // Top page first: the one on screen, then the ones under it (a cover's page still shapes it).
  const pages = [...nav.stack].reverse().filter((r, i, all) => nav.def(r.id).controls?.length && all.findIndex((x) => x.id === r.id) === i);

  return (
    <>
      {persona && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Persona
            <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
              every page
            </span>
          </div>
          <PersonaPicker persona={persona} onPick={pick} />
        </div>
      )}

      <LanguageSection />

      <AccessibilitySection />

      {pages.map((r) => {
        const def = nav.def(r.id);
        return (
          <div key={r.id} className={styles.section}>
            <Title label={nav.title(r)} hint="page" params={def.controls!.map((c) => c.param)} />
            {def.controls!.map((c) => (
              <Control key={c.param} control={c} />
            ))}
          </div>
        );
      })}

      {!pages.length && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{nav.title(nav.stack[nav.stack.length - 1])}</div>
          <span className={styles.muted} style={{ lineHeight: '16px' }}>
            No page controls yet. Add <code>controls</code> to its manifest entry: each sets one of its state params.
          </span>
        </div>
      )}
    </>
  );
}

/**
 * The system's accessibility settings (sim/systemText), the device's whoever uses it: the text size, as the system's
 * own slider with the steps of the device on the canvas (a set: its first), and Bold Text.
 */
function AccessibilitySection() {
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  const system = textSystemOf(findDisplay(findDevice(search.get('device')), search.get('display')).os);
  const { textSize, boldText } = accessibilityIn((k) => search.get(k));
  const steps = TEXT_SIZES[system].map((s) => ({ value: s.id, label: s.label }));
  const size = textSizeFor(system, textSize);
  const normal = textSizeFor(system, DEFAULT_TEXT_SIZE).id;
  return (
    <div className={styles.section}>
      <Title label="Accessibility" hint="system" params={Object.values(ACCESSIBILITY_PARAMS)} />
      <Row
        label="Text size"
        below={<StepSlider label="Text size" value={size.id} own={normal} options={steps} onChange={(v) => patch({ [ACCESSIBILITY_PARAMS.textSize]: v === normal ? null : v })} />}
      >
        <span className={styles.settingValue}>{size.id === normal ? `${size.label} · default` : size.label}</span>
      </Row>
      <Row label="Bold text">
        <Switch label="Bold text" checked={boldText} onChange={(on) => patch({ [ACCESSIBILITY_PARAMS.bold]: on ? 'on' : null })} />
      </Row>
    </div>
  );
}

/** The device's language: the app shows its texts in it (sim/language), its base language for one it doesn't have. */
function LanguageSection() {
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  const language = languageIn(search.get(LANG_PARAM));
  return (
    <div className={styles.section}>
      <Title label="Language" hint="system" params={[LANG_PARAM]} />
      <Row label="Language" note="A device of a set can have its own: its header’s language.">
        <Select label="Language" value={language} onChange={(v) => patch({ [LANG_PARAM]: v === BASE_LANGUAGE ? null : v })} options={LANGUAGES.map((l) => ({ value: l.id, label: l.name }))} />
      </Row>
    </div>
  );
}

/** A section's title and its reset (clears its params). */
function Title({ label, hint, params }: { label: string; hint: string; params: string[] }) {
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  const dirty = params.some((p) => search.has(p));
  return (
    <div className={styles.sectionTitle}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <span className={styles.name}>{label}</span>
        <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          {hint}
        </span>
      </span>
      <button className={styles.btn} disabled={!dirty} title="Back to the defaults" onClick={() => patch(Object.fromEntries(params.map((p) => [p, null])))}>
        <Icon name="restart_alt" size={14} />
        Reset
      </button>
    </div>
  );
}

/**
 * One of the persona's traits: a dropdown (its own value marked with the persona's name) or a switch. A value other
 * than its own is an override (in the URL), undone by picking its own back.
 */
/** A page control: a dropdown, or a switch when its options are On / Off (the first is the default: the unset param). */
function Control({ control }: { control: PageControl }) {
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  const first = control.options[0].value;
  const value = search.get(control.param) ?? first;
  // The default is the unset param.
  const set = (v: string) => patch({ [control.param]: v === first ? null : v });
  const on = control.options.length === 2 ? control.options.find((o) => /^on$/i.test(o.label))?.value : undefined;
  const off = control.options.find((o) => o.value !== on)?.value ?? first;
  return (
    <Row label={control.label} note={control.note}>
      {on ? <Switch label={control.label} checked={value === on} onChange={(c) => set(c ? on : off)} /> : <Select label={control.label} value={value} onChange={set} options={control.options} />}
    </Row>
  );
}

/** A setting: its name on the left (marked when it's overridden), its control on the right, a note under. */
function Row({ label, overridden, note, below, children }: { label: string; overridden?: boolean; note?: string; below?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.setting}>
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>
          {label}
          {overridden && <span className={styles.overriddenDot} title="Overridden: not the persona’s own" />}
        </span>
        {children}
      </div>
      {below}
      {note && <span className={styles.settingNote}>{note}</span>}
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (v: string) => void }) {
  return (
    <label className={styles.settingSelect}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className={styles.settingValue}>{options.find((o) => o.value === value)?.label.split(' · ')[0]}</span>
      <Icon name="expand_more" size={16} />
    </label>
  );
}

/**
 * A value among ordered steps, as a slider with a stop on each (the system's text size: a small A and a big A at its
 * ends). The default step (`own`) is marked under the track. It moves step by step, so the URL is written once a step.
 */
function StepSlider({ label, value, own, options, onChange }: { label: string; value: string; own: string; options: Option[]; onChange: (v: string) => void }) {
  const last = options.length - 1;
  const at = (v: string) => Math.max(0, options.findIndex((o) => o.value === v));
  return (
    <div className={styles.stepSlider}>
      <span style={{ fontSize: 10 }}>A</span>
      <span className={styles.stepTrack}>
        <input type="range" aria-label={label} aria-valuetext={options[at(value)]?.label} min={0} max={last} step={1} value={at(value)} style={{ ['--at' as string]: `calc(7px + (100% - 14px) * ${last ? at(value) / last : 0})` }} onChange={(e) => onChange(options[Number(e.target.value)].value)} />
        <span className={styles.stepOwn} style={{ left: `calc(7px + (100% - 14px) * ${last ? at(own) / last : 0})` }} title="The default" />
      </span>
      <span style={{ fontSize: 16 }}>A</span>
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button role="switch" aria-checked={checked} aria-label={label} className={`${styles.switch} ${checked ? styles.switchOn : ''}`} onClick={() => onChange(!checked)} />;
}
