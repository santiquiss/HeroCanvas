// Components' right panel, Props: the selected example's props as the code names them, each with its control
// (changes go to the URL, so a tweaked state can be shared), then the callbacks (gallery/ComponentInfo's Props).
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { controlFor, type Args, type Control, type StoryModule } from '../design/stories';
import type { ApiParam } from '../design/library';
import { Props } from '../gallery/ComponentInfo';
import { useGalleryRoute, useStories } from '../gallery/route';
import { useStoryArgs } from '../gallery/useStoryArgs';
import { useUrlState } from '../sim/SimContext';
import styles from './Panel.module.css';
import { isTokenColorOptions, TokenColorSelect, tokenForColor, tokenLabel } from './TokenColorSelect';
import { t } from '../i18n/ui';

export function ControlsPanel() {
  const { name } = useGalleryRoute();
  const { stories } = useStories();
  const mod = name ? stories.get(name) : undefined;
  if (!mod) return <div className={styles.section}>{t('Pick a built component to edit its props.')}</div>;
  return <Controls key={name} mod={mod} />;
}

function Controls({ mod }: { mod: StoryModule<Args> }) {
  const [storyName] = useUrlState<string>('story', mod.stories[0]?.name ?? '');
  const story = mod.stories.find((s) => s.name === storyName) ?? mod.stories[0];
  const { argsFor, update, reset, overrides } = useStoryArgs(mod);
  const args = argsFor(story.name);
  const dirty = !!overrides[story.name];
  const field = (k: string, param?: ApiParam) => {
    const control = controlFor(mod, k);
    if (!control) return null;
    const input = <Field control={control} value={args[k]} onChange={(v) => update(story.name, { [k]: v })} />;
    // Nullable in the code (`double?`): it can be left out, to null. A select with a none option says it already.
    const nullable = !!param?.type?.endsWith('?') && !(control.type === 'select' && control.options.includes(''));
    if (!nullable) return input;
    const written = { ...mod.args, ...story.args }[k];
    return (
      <Nullable isNull={args[k] == null} onClear={() => update(story.name, { [k]: null })} onSet={() => update(story.name, { [k]: written ?? emptyValue(control) })}>
        {input}
      </Nullable>
    );
  };
  return (
    <Props
      mod={mod}
      story={story.name}
      args={args}
      field={field}
      reset={
        dirty && (
          <button className={styles.btn} style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }} title={t('Back to “{story}” as written', { story: story.name })} onClick={() => reset(story.name)}>
            <Icon name="restart_alt" size={14} />
            <span>{t('Reset')}</span>
          </button>
        )
      }
    />
  );
}

const input: React.CSSProperties = { width: '100%', height: 26, padding: '0 6px', border: '1px solid #dfe2e6', borderRadius: 6, font: 'inherit', fontSize: 12 };

/** A value to start from when a null prop is set again and its example had none. */
function emptyValue(control: Control): unknown {
  switch (control.type) {
    case 'boolean':
      return false;
    case 'number':
      return control.min ?? 0;
    case 'select':
      return control.options[0];
    case 'color':
      return 'rgb(0,0,0)';
    default:
      return '';
  }
}

/** A nullable prop's control: its value with × to clear it to null, or "null" with Set to give it one again. */
function Nullable({ isNull, onClear, onSet, children }: { isNull: boolean; onClear: () => void; onSet: () => void; children: React.ReactNode }) {
  return isNull ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <span className={styles.muted} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}>
        null
      </span>
      <button className={styles.btn} style={{ marginLeft: 'auto' }} title={t('Give it a value')} onClick={onSet}>
        <Icon name="add" size={14} />
        <span>{t('Set')}</span>
      </button>
    </span>
  ) : (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      <button className={styles.iconBtn} title={t('Clear it: null (not passed)')} onClick={onClear}>
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}

/** The control for a prop's value, by its kind. */
function Field({ control, value, onChange }: { control: Control; value: unknown; onChange: (v: unknown) => void }) {
  let el: React.ReactNode;
  switch (control.type) {
    case 'boolean':
      el = <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
      break;
    case 'number':
      el = (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', minWidth: 0 }}>
          {control.min != null && control.max != null && (
            <input type="range" min={control.min} max={control.max} step={control.step ?? 1} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, minWidth: 0 }} />
          )}
          <TextInput type="number" value={String(value)} onCommit={(v) => onChange(Number(v))} style={{ ...input, flex: 'none', width: 52 }} />
        </div>
      );
      break;
    case 'select':
      if (isTokenColorOptions(control.options)) {
        el = <TokenColorSelect value={String(value ?? '')} options={control.options} onChange={onChange} />;
        break;
      }
      el = (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)} style={input}>
          {control.options.map((o) => (
            <option key={o} value={o}>
              {o || t('(none)')}
            </option>
          ))}
        </select>
      );
      break;
    case 'color':
      el = <ColorField value={String(value)} onChange={onChange} />;
      break;
    default:
      el = <TextInput value={String(value ?? '')} onCommit={onChange} style={input} />;
  }
  return el;
}

/**
 * Text input with local state: typing stays smooth while the value round-trips through the URL,
 * and outside changes (reset, interactive stories) still show up.
 */
function TextInput({ value, onCommit, type = 'text', style }: { value: string; onCommit: (v: string) => void; type?: string; style?: React.CSSProperties }) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(value);
  }, [value, focused]);
  return (
    <input
      type={type}
      value={local}
      style={style}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setLocal(e.target.value);
        onCommit(e.target.value);
      }}
    />
  );
}

/** Color picker that keeps rgb() strings (the format the tokens and mock data use). */
function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const token = tokenForColor(value);
  const hex = m ? '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : '#000000';
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="color"
        value={hex}
        onChange={(e) => {
          const h = e.target.value;
          onChange(`rgb(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)})`);
        }}
        style={{ width: 28, height: 24, padding: 0, border: 'none', background: 'none' }}
      />
      {token ? (
        // A token's color: its name to read; the raw value stays in the tooltip.
        <span title={`${value} · ${tokenLabel(token).css}`} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tokenLabel(token).name}
          <span className={styles.muted}> · {tokenLabel(token).group}</span>
        </span>
      ) : (
        <TextInput value={value} onCommit={onChange} style={{ ...input, flex: 1, minWidth: 0 }} />
      )}
    </div>
  );
}
