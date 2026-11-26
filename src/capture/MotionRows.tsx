// Video's Motion section: Loop (one motion, repeating) or Once (three rows, In, Middle and Out), each row a dropdown of
// its motions (their paths as icons; each In and Out brings its own short fade) and one of its length. The clip is their sum; a recording sets the
// Middle's. The designer's own UI (as CheckDropdown), not the app's.
import { useRef, type ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@ui-sdk/react/select';
import { Icon } from '../components/Icon';
import { EDGE_SECONDS, hasIn, hasOut, IN_STEPS, MID_SECONDS, MID_STEPS, OUT_STEPS, stepMotion, type Sequence, type Step } from './video/motion';
import { MotionGlyph } from './video/MotionGlyph';
import styles from './MotionRows.module.css';
import { t } from '../i18n/ui';

/** Seconds as the rows show them: `1.4 s`, `6 s`. */
const secs = (v: number) => `${Number(v.toFixed(1))} s`;

export function MotionRows({ sequence, recorded, onChange }: { sequence: Sequence; /** A recording's length: the Middle's. */ recorded: number | null; onChange: (s: Sequence) => void }) {
  const set = (patch: Partial<Sequence>) => onChange({ ...sequence, ...patch });
  const once = sequence.mode === 'once';
  return (
    <>
      {/* Loop: one motion, repeating without a seam. Once: In, the middle, Out, from start to end. */}
      <div className={styles.modes} role="radiogroup" aria-label={t('Playback')}>
        {(
          [
            ['loop', t('Loop'), 'repeat', t('One motion, repeating without a seam')],
            ['once', t('Once'), 'arrow_right_alt', t('Plays once, start to end: In, the middle, Out')],
          ] as const
        ).map(([v, label, icon, title]) => (
          <button key={v} role="radio" aria-checked={sequence.mode === v} className={`${styles.mode} ${sequence.mode === v ? styles.on : ''}`} onClick={() => set({ mode: v })} title={title}>
            <Icon name={icon} size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className={styles.rows}>
        {once && (
          <Row
            label={t('In')}
            steps={IN_STEPS}
            value={sequence.in}
            // A motion picked starts at its own length.
            onPick={(x) => set({ in: x.id, ...(x.offset ? { inSeconds: x.seconds } : {}) })}
            seconds={hasIn(sequence) ? sequence.inSeconds : null}
            options={EDGE_SECONDS}
            onSeconds={(inSeconds) => set({ inSeconds })}
          />
        )}
        <Row
          label={once ? t('Middle') : t('Motion')}
          steps={MID_STEPS}
          middle
          value={sequence.mid}
          onPick={(x) => set({ mid: x.id })}
          // With a recording, what In and Out leave of it.
          seconds={recorded != null ? Math.max(0, recorded - (hasIn(sequence) ? sequence.inSeconds : 0) - (hasOut(sequence) ? sequence.outSeconds : 0)) : sequence.midSeconds}
          fixed={recorded != null ? (once ? t('What In and Out leave of the recording') : t('The recording’s length')) : undefined}
          options={MID_SECONDS}
          onSeconds={(midSeconds) => set({ midSeconds })}
        />
        {once && (
          <Row
            label={t('Out')}
            steps={OUT_STEPS}
            value={sequence.out}
            onPick={(x) => set({ out: x.id, ...(x.offset ? { outSeconds: x.seconds } : {}) })}
            seconds={hasOut(sequence) ? sequence.outSeconds : null}
            options={EDGE_SECONDS}
            onSeconds={(outSeconds) => set({ outSeconds })}
          />
        )}
      </div>
      {sequence.mid === 'angle' && <p className={styles.hint}>{t('Holds the angle you set: drag beside the device on the canvas, even while it plays, or use Angle below.')}</p>}
    </>
  );
}

function Row<Id extends string>({
  label,
  steps,
  value,
  middle = false,
  onPick,
  seconds,
  fixed,
  options,
  onSeconds,
}: {
  label: string;
  steps: Step<Id>[];
  value: Id;
  middle?: boolean;
  onPick: (step: Step<Id>) => void;
  /** Its length; null: the step is skipped (no length to set). */
  seconds: number | null;
  /** Its length is set elsewhere (a recording's): shown, not chosen, with why. */
  fixed?: string;
  options: number[];
  onSeconds: (v: number) => void;
}) {
  const step = steps.find((x) => x.id === value) ?? steps[0];
  const skipped = !step.offset && !middle;
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <Dropdown
        label={t('{step} motion', { step: label })}
        across
        value={value}
        onPick={(id) => onPick(steps.find((x) => x.id === id)!)}
        trigger={
          <>
            <StepIcon step={step} middle={middle} faded={skipped} />
            <span className={`${styles.name} ${skipped ? styles.none : ''}`}>{step.label}</span>
          </>
        }
        options={steps.map((x) => ({
          value: x.id,
          label: x.label,
          content: (
            <>
              <StepIcon step={x} middle={middle} faded={!x.offset && !middle} />
              <span className={styles.optionText}>
                <span>{x.label}</span>
                <span className={styles.note}>{x.note}</span>
              </span>
            </>
          ),
        }))}
      />
      {seconds == null ? (
        <span className={styles.length} aria-label={t('{step} length', { step: label })}>
          —
        </span>
      ) : fixed ? (
        <span className={styles.length} title={fixed}>
          {secs(seconds)}
        </span>
      ) : (
        <Dropdown
          label={t('{step} length', { step: label })}
          narrow
          short
          value={String(seconds)}
          onPick={(v) => onSeconds(Number(v))}
          trigger={<span className={styles.name}>{secs(seconds)}</span>}
          options={options.map((v) => ({ value: String(v), label: secs(v), content: <span className={styles.optionText}>{secs(v)}</span> }))}
        />
      )}
    </div>
  );
}

/** A step's icon: its path, its own icon (No motion: custom angle), or none (skipped). */
function StepIcon({ step, middle, faded }: { step: Step<string>; middle: boolean; faded: boolean }) {
  const m = stepMotion(step, middle);
  return (
    <span className={styles.icon}>
      {step.icon ? <Icon name={step.icon} size={18} /> : m && !faded ? <MotionGlyph motion={m} /> : <Icon name="block" size={16} color="var(--ui-text-faint)" />}
    </span>
  );
}

/**
 * A button that opens a list of options under it: ui-sdk's Select (try-ui-library), its rows ours. The arrows, typing an
 * option's name, Escape, a click outside and focus are its. `across`: the list spans the whole row (label to length).
 */
function Dropdown({
  label,
  trigger,
  value,
  options,
  onPick,
  narrow = false,
  across = false,
  short = false,
}: {
  label: string;
  trigger: ReactNode;
  value: string;
  options: { value: string; label: string; content: ReactNode }[];
  onPick: (value: string) => void;
  narrow?: boolean;
  /** Its list across the whole row. */
  across?: boolean;
  /** Short options (a length): less padding. */
  short?: boolean;
}) {
  const button = useRef<HTMLButtonElement>(null);
  // Across: placed against the row it's in, as wide as it.
  const row = across ? { getBoundingClientRect: () => (button.current?.closest(`.${styles.row}`) ?? button.current)!.getBoundingClientRect() } : undefined;
  return (
    <div className={`${styles.dropdown} ${narrow ? styles.narrow : ''}`}>
      <Select value={value} onValueChange={(v) => typeof v === 'string' && onPick(v)}>
        <SelectTrigger ref={button} className={styles.trigger} aria-label={label}>
          {trigger}
          <Icon name="expand_more" size={16} color="var(--ui-text-muted)" />
        </SelectTrigger>
        <SelectContent className={`${styles.menu} ${across ? styles.across : ''}`} anchor={row} side="bottom" align={narrow ? 'end' : 'start'} sideOffset={4} aria-label={label}>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} label={o.label} className={`${styles.option} ${short ? styles.short : ''}`}>
              {o.content}
              <Icon name="check" size={16} color="#0d99ff" className={styles.check} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
