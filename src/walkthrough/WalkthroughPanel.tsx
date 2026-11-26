// The Walkthrough panel, beside Pages and Layers: a proposal's guided tour. First its stories, one thing to do with the
// feature each ("Discover it", "Change today's target", "Delete one"). A story opens into its steps, with a way back
// to the list, one step at a time: the step that's open says what to look at (its text, its numbered marks, which are pointed at from
// beside the device) and how to go on: tapping what it marks on the screen, the arrows here, or ← → on the keyboard.
// It never moves by itself.
import { Icon } from '../components/Icon';
import { t } from '../i18n/ui';
import { useWalk } from './useWalk';
import styles from './Walkthrough.module.css';

export function WalkthroughPanel() {
  const w = useWalk();
  if (!w.proposal) return <p className={styles.empty}>{t('Pick a proposal to walk through it.')}</p>;
  if (!w.steps.length) return <p className={styles.empty}>{t('This proposal has no walkthrough yet.')}</p>;
  const step = w.step;

  // The stories.
  if (!step)
    return (
      <div className={styles.panel}>
        <div className={styles.list}>
          {w.stories.map((story, si) => (
            <button key={story.title} className={styles.story} onClick={() => w.open(w.steps.find((s) => s.story === si)!)}>
              <span className={styles.storyIcon}>
                <Icon name={story.icon ?? 'play_arrow'} size={16} />
              </span>
              <span className={styles.storyText}>
                <span className={styles.storyTitle}>{story.title}</span>
                <span className={styles.storyLine}>{story.line}</span>
              </span>
              <span className={styles.storyCount}>{story.steps.length}</span>
            </button>
          ))}
        </div>
      </div>
    );

  // A story, one step at a time: the way back and its title, the steps as segments (the one that's open filled, each
  // a way to it), then the step as a card of its own (its title, its text, its numbered marks), and Back and Next at
  // the foot.
  const story = w.stories[step.story];
  const own = w.steps.filter((s) => s.story === step.story);
  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <button className={styles.back} onClick={w.close}>
          <Icon name="arrow_back" size={14} />
          {t('All stories')}
        </button>
        <div className={styles.headRow}>
          <h4 className={styles.headTitle}>{story.title}</h4>
          <button className={`${styles.iconButton} ${w.marksOn ? styles.on : ''}`} title={w.marksOn ? t('Hide the numbers beside the screen') : t('Show the numbers beside the screen')} onClick={() => w.setMarksOn(!w.marksOn)}>
            <Icon name="looks_one" size={16} />
          </button>
        </div>
        <div className={styles.segments} role="tablist" aria-label={t('{n} of {total}', { n: step.n, total: step.of })}>
          {own.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === step.id} title={`${s.n} · ${s.title}`} className={`${styles.segment} ${s.n <= step.n ? styles.segmentOn : ''}`} onClick={() => w.open(s)} />
          ))}
        </div>
      </div>
      <div className={styles.card}>
        <span className={styles.eyebrow}>{t('Step {n} of {total}', { n: step.n, total: step.of })}</span>
        <h3 className={styles.cardTitle}>{step.title}</h3>
        <p className={styles.text}>{step.body}</p>
        {w.status.missing && (
          // The way in stopped at something not on the screen: the proposal's screen changed, or the step names it
          // wrong. Said here, so the step isn't shown in a state it isn't in.
          <div className={styles.missing} role="alert">
            <Icon name="error" size={14} />
            <span>{t('Couldn’t get to this step: “{target}” isn’t on the screen.', { target: w.status.missing })}</span>
            <button className={styles.retry} onClick={() => w.open(step)}>
              {t('Try again')}
            </button>
          </div>
        )}
        {!!step.marks?.length && (
          <ol className={styles.marks}>
            {step.marks.map((m, i) => (
              <li key={i} className={styles.mark}>
                <span className={styles.badge}>{i + 1}</span>
                <span className={styles.markText}>
                  {m.note}
                  {m.next && <span className={styles.nextHint}> {t('Tap it on the screen to go on.')}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className={styles.foot}>
        <button className={styles.footButton} disabled={step.n <= 1} onClick={() => w.move(-1)}>
          <Icon name="arrow_back" size={14} />
          {t('Back')}
        </button>
        {step.n < step.of ? (
          <button className={`${styles.footButton} ${styles.footPrimary}`} onClick={() => w.move(1)}>
            {t('Next')}
            <Icon name="arrow_forward" size={14} />
          </button>
        ) : (
          <button className={`${styles.footButton} ${styles.footPrimary}`} onClick={w.close}>
            {t('Done')}
            <Icon name="check" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
