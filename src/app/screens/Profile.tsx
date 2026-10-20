// Profile (a tab): who's signed in (the persona), a few settings, and Sign out, which asks first and goes back to the
// welcome flow.
import { Icon } from '../../components/Icon';
import { useNav } from '../../nav/context';
import { useSim } from '../../sim/SimContext';
import { Avatar, ListSection, ListTile, Scaffold } from '../components';
import { findPersona } from '../data/sample';
import { useT } from '../i18n';
import { useTasks } from '../state';
import styles from './screens.module.css';

export function Profile() {
  const t = useT();
  const nav = useNav();
  const { openDialog, oos } = useSim();
  const { personaId } = useTasks();
  const persona = findPersona(personaId);
  return (
    <Scaffold title={t('profile.title')}>
      <div className={styles.profile}>
        <Avatar name={persona.name} image={persona.avatar} size={72} />
        <span className={styles.profileName}>{persona.name}</span>
      </div>
      <ListSection>
        <ListTile title={t('profile.notifications')} leading={<Icon name="notifications" size={24} color="var(--app-icon)" />} onTap={oos(t('profile.notifications'))} />
        <ListTile title={t('profile.appearance')} leading={<Icon name="palette" size={24} color="var(--app-icon)" />} onTap={oos(t('profile.appearance'))} />
        <ListTile title={t('profile.language')} leading={<Icon name="language" size={24} color="var(--app-icon)" />} onTap={oos(t('profile.language'))} />
      </ListSection>
      <ListSection>
        <ListTile
          title={t('profile.signOut')}
          destructive
          onTap={() =>
            openDialog({
              title: t('profile.signOut'),
              content: '',
              actionsAlignment: 'vertical',
              primaryButtonText: t('profile.signOut'),
              primaryButtonVariant: 'danger',
              secondaryButtonText: t('common.cancel'),
              onPrimaryButtonPressed: () => nav.setStack([{ id: 'welcome', params: {} }]),
            })
          }
        />
      </ListSection>
    </Scaffold>
  );
}
