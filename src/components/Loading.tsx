// Loading states for the designer's own UI (not the app's): a spinner and a progress line. Both animate on the
// compositor (a transform), so they cost nothing while the work they wait for runs.
import styles from './Loading.module.css';
import { t } from '../i18n/ui';

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} role="progressbar" aria-label={t('Loading')} />;
}

/** How far along something is (0–1): a thin bar. */
export function ProgressLine({ value }: { value: number }) {
  return (
    <span className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span className={styles.fill} style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, value))})` }} />
    </span>
  );
}
