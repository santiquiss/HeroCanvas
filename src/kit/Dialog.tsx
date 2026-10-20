// The kit's dialog: a card in the middle over a modal barrier, with a title, content and up to three actions. Pure:
// props in, callbacks out.
import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { Button } from './Button';
import { ModalBarrier } from './Sheet';
import styles from './Dialog.module.css';

export interface DialogProps {
  title?: string;
  /** A Material Symbol before the title (only with a title). */
  titleIcon?: string;
  /** Text, or (simulator) any content. */
  content: ReactNode;
  showCloseButton?: boolean;
  /** The close button, and tapping the shim. */
  onCloseButtonPressed?: () => void;
  primaryButtonText?: string;
  primaryButtonVariant?: 'primary' | 'danger';
  onPrimaryButtonPressed?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonPressed?: () => void;
  tertiaryButtonText?: string;
  onTertiaryButtonPressed?: () => void;
  actionsAlignment?: 'horizontal' | 'vertical';
  /** The title row (title, icon, close). */
  showHeader?: boolean;
}


export function Dialog({
  title = 'Dialog Title',
  titleIcon,
  content,
  showCloseButton = true,
  onCloseButtonPressed,
  primaryButtonText = 'Confirm',
  primaryButtonVariant = 'primary',
  onPrimaryButtonPressed,
  secondaryButtonText,
  onSecondaryButtonPressed,
  tertiaryButtonText,
  onTertiaryButtonPressed,
  actionsAlignment = 'horizontal',
  showHeader = true,
}: DialogProps) {
  const mf = useComponent('Dialog', {
    title,
    titleIcon,
    content: typeof content === 'string' ? content : undefined,
    showCloseButton,
    onCloseButtonPressed,
    primaryButtonText,
    primaryButtonVariant,
    onPrimaryButtonPressed,
    secondaryButtonText,
    onSecondaryButtonPressed,
    tertiaryButtonText,
    onTertiaryButtonPressed,
    actionsAlignment,
    showHeader,
  });
  const vertical = actionsAlignment === 'vertical';
  const onClose = onCloseButtonPressed;
  const primary = <Button label={primaryButtonText} variant={primaryButtonVariant} block={vertical} onPressed={onPrimaryButtonPressed} />;
  const secondary = secondaryButtonText && <Button label={secondaryButtonText} variant="secondary" block={vertical} onPressed={onSecondaryButtonPressed ?? onClose} />;
  return (
    <div {...mf} style={{ position: 'absolute', inset: 0 }}>
      <ModalBarrier onDismiss={onClose} />
      <div className={styles.dialogWrap} onClick={onClose}>
        <div className={styles.dialog} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
          {showHeader && (
            <div className={styles.dialogHeader}>
              {title && titleIcon && <Icon name={titleIcon} />}
              <span className={styles.dialogTitle}>{title}</span>
              {showCloseButton && (
                <button className={styles.dialogClose} title="Close" onClick={onClose}>
                  <Icon name="close" />
                </button>
              )}
            </div>
          )}
          <div className={styles.dialogBody}>{content}</div>
          {vertical ? (
            <div className={styles.actionsV}>
              {primary}
              {secondary}
            </div>
          ) : (
            <div className={styles.actionsH}>
              {tertiaryButtonText && <Button label={tertiaryButtonText} variant="link" leftIcon="chevron_left" onPressed={onTertiaryButtonPressed} />}
              <div className={styles.actionsRight}>
                {secondary}
                {primary}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
