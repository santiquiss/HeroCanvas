// A page far out in Flow (semantic zoom): its icon, its status and its change — what can be told apart at that size —
// instead of the live screen, which wouldn't read there (and costs nothing to draw).
import { Icon } from '../components/Icon';
import { CHANGE, type ChangeKind } from '../design/changes';
import type { PageStatus } from '../nav/types';
import { STATUS_COLOR } from '../tools/PagesPanel';
import styles from './Flow.module.css';

export function PageCard({ icon, status, change }: { icon: string; status?: PageStatus; change?: ChangeKind | null }) {
  return (
    <div className={styles.card} style={change ? { boxShadow: `inset 0 0 0 6px ${CHANGE[change].color}` } : undefined}>
      <Icon name={icon} size={56} />
      <span className={styles.cardDot} style={{ background: STATUS_COLOR[status ?? 'placeholder'] }} />
    </div>
  );
}
