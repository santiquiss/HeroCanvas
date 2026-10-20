// The kit's buttons: what its overlays need (a dialog's actions, an alert's close) and a starting point for an app's
// own. Pure: props in, callbacks out; the look from the app's tokens (kit/tokens.css).
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'link';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  /** A Material Symbol before the label. */
  leftIcon?: string;
  /** None: disabled. */
  onPressed?: () => void;
  size?: 'default' | 'small';
  /** The container's whole width. */
  block?: boolean;
}

export function Button({ label, variant = 'primary', leftIcon, onPressed, size = 'default', block = false }: ButtonProps) {
  const mf = useComponent('Button', { label, variant, leftIcon, onPressed, size, block });
  return (
    <button {...mf} className={`${styles.button} ${styles[variant]} ${styles[size]} ${block ? styles.block : ''}`} disabled={!onPressed} onClick={onPressed}>
      {leftIcon && <Icon name={leftIcon} size={20} />}
      <span>{label}</span>
    </button>
  );
}

export interface IconButtonProps {
  /** A Material Symbol. */
  icon: string;
  variant?: ButtonVariant;
  size?: 'small' | 'medium';
  /** Lifted off the page (a shadow), for a button over content. */
  elevated?: boolean;
  onTap?: () => void;
  tooltip?: string;
}

export function IconButton({ icon, variant = 'tertiary', size = 'medium', elevated = false, onTap, tooltip }: IconButtonProps) {
  const mf = useComponent('IconButton', { icon, variant, size, elevated, onTap, tooltip });
  return (
    <button
      {...mf}
      className={`${styles.iconButton} ${styles[variant]} ${styles[`icon_${size}`]} ${elevated ? styles.elevated : ''}`}
      title={tooltip}
      aria-label={tooltip}
      disabled={!onTap}
      onClick={onTap}
    >
      <Icon name={icon} size={size === 'small' ? 20 : 24} />
    </button>
  );
}
