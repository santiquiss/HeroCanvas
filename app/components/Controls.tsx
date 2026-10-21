// The sample app's small controls: a round checkbox, a text field, an avatar, a project's icon tile and an empty state.
// Pure: props in, callbacks out.
import { Icon, useComponent } from 'herocanvas';
import { useEffect, useRef } from 'react';
import styles from './Controls.module.css';

export interface CheckboxProps {
  value: boolean;
  /** None: disabled. */
  onChanged?: (value: boolean) => void;
  semanticLabel?: string;
}

export function Checkbox({ value, onChanged, semanticLabel }: CheckboxProps) {
  const mf = useComponent('Checkbox', { value, onChanged });
  return (
    <button
      {...mf}
      role="checkbox"
      aria-checked={value}
      aria-label={semanticLabel}
      className={`${styles.checkbox} ${value ? styles.checked : ''}`}
      disabled={!onChanged}
      onClick={(e) => {
        // A checkbox in a tappable row: its own tap, not the row's.
        e.stopPropagation();
        onChanged?.(!value);
      }}
    >
      {value && <Icon name="check" size={18} weight={700} />}
    </button>
  );
}

export interface TextFieldProps {
  value: string;
  hintText?: string;
  multiline?: boolean;
  /** Focused as it shows: the keyboard comes up. */
  autofocus?: boolean;
  onChanged: (value: string) => void;
  onSubmitted?: (value: string) => void;
}

export function TextField({ value, hintText, multiline = false, autofocus = false, onChanged, onSubmitted }: TextFieldProps) {
  const mf = useComponent('TextField', { value, hintText, multiline, autofocus });
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autofocus) ref.current?.focus({ preventScroll: true });
  }, [autofocus]);
  const props = {
    ref,
    className: `${styles.field} ${multiline ? styles.multiline : ''}`,
    value,
    placeholder: hintText,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChanged(e.target.value),
  };
  return (
    <div {...mf} className={styles.fieldBox}>
      {multiline ? <textarea {...props} rows={4} /> : <input {...props} onKeyDown={(e) => e.key === 'Enter' && onSubmitted?.(value)} />}
    </div>
  );
}

export interface AvatarProps {
  name: string;
  /** An image; none: the initials. */
  image?: string;
  size?: number;
}

export function Avatar({ name, image, size = 40 }: AvatarProps) {
  const mf = useComponent('Avatar', { name, image, size });
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span {...mf} className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {image ? <img src={image} alt="" /> : <span>{initials}</span>}
    </span>
  );
}

export interface ProjectIconProps {
  /** A Material Symbol. */
  icon: string;
  color: string;
  size?: number;
}

export function ProjectIcon({ icon, color, size = 36 }: ProjectIconProps) {
  const mf = useComponent('ProjectIcon', { icon, color, size });
  return (
    <span {...mf} className={styles.projectIcon} style={{ width: size, height: size, background: color }}>
      <Icon name={icon} size={size * 0.58} fill color="#ffffff" />
    </span>
  );
}

export interface EmptyStateProps {
  /** A Material Symbol. */
  icon: string;
  title: string;
  body?: string;
}

export function EmptyState({ icon, title, body }: EmptyStateProps) {
  const mf = useComponent('EmptyState', { icon, title, body });
  return (
    <div {...mf} className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} size={32} color="var(--app-primary)" />
      </span>
      <span className={styles.emptyTitle}>{title}</span>
      {body && <span className={styles.emptyBody}>{body}</span>}
    </div>
  );
}
