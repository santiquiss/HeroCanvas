// The tour's screens: Welcome (how to connect an app), the list of the tour's steps, and a page per step.
import type { ComponentType, ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useNav } from '../nav/context';
import type { PageProps } from '../nav/types';
import { STEPS, type TourStep } from './steps';
import { NextButton, TourPage, TourRow, TryIt, WayCard } from './TourKit';
import styles from './screens.module.css';

const WAYS = [
  {
    icon: 'code',
    title: 'Connect your app’s code',
    tag: 'Recommended',
    body: 'Your agent reads your app’s repository (React, React Native, Flutter, SwiftUI or Compose) and builds its mirror here: every screen as a page, with your components, tokens and texts. Your code is only read, never changed.',
    prompt: 'Connect my app to HeroCanvas. Its code is in <the path to your app’s repository>.',
  },
  {
    icon: 'draw',
    title: 'Start from a Figma file',
    body: 'No code yet, or the design leads: your agent reads the file’s frames, components and variables (with Figma connected to it). Connect the code later.',
    prompt: 'Build my app in HeroCanvas from this Figma file: <the file’s link>',
  },
  {
    icon: 'smartphone',
    title: 'Look at a sample app',
    body: 'A task manager with made-up data, mirrored as your app will be. It’s on the main branch.',
    prompt: 'git switch main',
  },
];

export function WelcomeScreen() {
  const nav = useNav();
  return (
    <TourPage title="Welcome" bare>
      <header className={styles.hero}>
        <img src="/pwa/icon-192.png" alt="" width={64} height={64} className={styles.logo} />
        <h1 className={styles.heroTitle}>Welcome to HeroCanvas</h1>
        <p className={styles.heroLead}>Your app’s screens will be here, on every device at once. To begin, open your agent in this folder and ask it one of these.</p>
      </header>
      <div className={styles.stack}>
        {WAYS.map((w, i) => (
          <WayCard key={w.title} {...w} recommended={i === 0} />
        ))}
      </div>
      <TourRowCard>
        <TourRow icon="explore" title="Take the tour" line="What each part of HeroCanvas does, to try right here" onTap={() => nav.goTab('tour')} />
      </TourRowCard>
    </TourPage>
  );
}

function TourRowCard({ children }: { children: ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}

export function TourScreen() {
  const nav = useNav();
  return (
    <TourPage title="Tour">
      <p className={styles.intro}>This is an app too: HeroCanvas’s own, while yours isn’t connected. Each step is a page; open one and try it on the interface around the device.</p>
      <div className={styles.card}>
        {STEPS.map((s) => (
          <TourRow key={s.id} icon={s.icon} title={s.title} line={s.line} onTap={() => nav.push(s.id, {})} />
        ))}
      </div>
    </TourPage>
  );
}

/** A step's page: what the part is, what to try, and on to the next. */
export function stepScreen(step: TourStep): ComponentType<PageProps> {
  const next = STEPS[STEPS.indexOf(step) + 1];
  function Step() {
    const nav = useNav();
    return (
      <TourPage title={step.title}>
        <div className={styles.stepIcon}>
          <Icon name={step.icon} size={36} />
        </div>
        <h1 className={styles.stepTitle}>{step.title}</h1>
        {step.body.map((p) => (
          <p key={p} className={styles.stepBody}>
            {p}
          </p>
        ))}
        <TryIt text={step.tryIt} />
        {next ? <NextButton label={`Next: ${next.title}`} onPressed={() => nav.push(next.id, {})} /> : <NextButton label="Connect your app" onPressed={() => nav.goTab('start')} />}
      </TourPage>
    );
  }
  return Step;
}
