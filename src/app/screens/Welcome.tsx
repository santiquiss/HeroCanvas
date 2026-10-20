// Welcome (where the app starts, before its tabs): a flow of three steps, declared in the manifest (`flow`), so the
// Pages panel lists them and the Flow view lays them out.
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { useFlow } from '../../nav/flow';
import { useNav } from '../../nav/context';
import type { FlowDef } from '../../nav/types';
import { Button } from '../../kit';
import { useSim } from '../../sim/SimContext';
import { TextField } from '../components';
import { useT } from '../i18n';
import styles from './screens.module.css';

export const WELCOME_FLOW: FlowDef = {
  param: 'step',
  steps: [
    { id: 'intro', label: 'Intro' },
    { id: 'name', label: 'Your name' },
    { id: 'ready', label: 'All set', next: [{ label: 'Open the app' }] },
  ],
};

export function Welcome() {
  const t = useT();
  const nav = useNav();
  const { layout } = useSim();
  const { step, go } = useFlow(WELCOME_FLOW);
  const [name, setName] = useState('');
  return (
    <div className={styles.welcome} style={{ paddingTop: layout.sbH + 48, paddingBottom: layout.padBPush }}>
      {step.id === 'intro' && (
        <>
          <span className={styles.welcomeIcon}>
            <Icon name="task_alt" size={56} color="var(--app-on-primary)" />
          </span>
          <h1 className={styles.welcomeTitle}>{t('welcome.title')}</h1>
          <p className={styles.welcomeBody}>{t('welcome.body')}</p>
          <div className={styles.welcomeActions}>
            <Button label={t('welcome.start')} block onPressed={() => go('name')} />
          </div>
        </>
      )}
      {step.id === 'name' && (
        <>
          <h1 className={styles.welcomeTitle}>{t('welcome.nameTitle')}</h1>
          <TextField value={name} hintText={t('welcome.namePlaceholder')} onChanged={setName} />
          <div className={styles.welcomeActions}>
            <Button label={t('welcome.continue')} block onPressed={name.trim() ? () => go('ready') : undefined} />
          </div>
        </>
      )}
      {step.id === 'ready' && (
        <>
          <span className={styles.welcomeIcon}>
            <Icon name="celebration" size={56} color="var(--app-on-primary)" />
          </span>
          <h1 className={styles.welcomeTitle}>{t('welcome.doneTitle')}</h1>
          <p className={styles.welcomeBody}>{t('welcome.doneBody')}</p>
          <div className={styles.welcomeActions}>
            <Button label={t('welcome.open')} block onPressed={() => nav.goTab('today', { step: null })} />
          </div>
        </>
      )}
    </div>
  );
}
