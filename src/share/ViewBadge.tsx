// The toolbar's word on the view in use (src/share/view.ts): a guest's, with when their link ends (and at that moment
// the page reloads, so the door says it expired); or one being tried with `?view=`. Exit goes back to the whole
// designer: always from a tried view, from a guest's only with the team's password too (someone of the team seeing
// their link as the guest does).
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { t } from '../i18n/ui';
import { formatUntil } from './ShareMenu';
import { isTeam, leaveView, VIEW } from './view';
import styles from './ViewBadge.module.css';

/** Longest a timer waits (setTimeout's limit, about 24 days); a link never lasts that long. */
const MAX_WAIT = 2 ** 31 - 1;

/** Whether this browser can leave the view (the team's): false until the server says, in a guest's. */
export function useCanLeave(): boolean {
  const [can, setCan] = useState(!!VIEW && VIEW.expires == null);
  useEffect(() => {
    if (!VIEW || VIEW.expires == null) return;
    let live = true;
    isTeam().then((team) => live && setCan(team));
    return () => {
      live = false;
    };
  }, []);
  return can;
}

export function ViewBadge() {
  const expires = VIEW?.expires ?? null;
  const canLeave = useCanLeave();
  useEffect(() => {
    if (expires == null) return;
    const timer = setTimeout(() => window.location.reload(), Math.min(MAX_WAIT, Math.max(0, expires - Date.now())));
    return () => clearTimeout(timer);
  }, [expires]);
  if (!VIEW) return null;
  const exit = canLeave && (
    <button className={styles.exit} onClick={() => void leaveView()} title={t('Back to the whole designer')}>
      {t('Exit')}
    </button>
  );
  if (expires != null)
    return (
      <span className={styles.badge} title={t('Shared with you until {until}', { until: formatUntil(expires) })}>
        <Icon name="schedule" size={16} />
        {t('Until {until}', { until: formatUntil(expires) })}
        {exit}
      </span>
    );
  return (
    <span className={styles.badge}>
      <Icon name="visibility" size={16} />
      {t('Guest view: {profile}', { profile: VIEW.profile.label })}
      {exit}
    </span>
  );
}
