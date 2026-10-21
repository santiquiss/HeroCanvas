// The tour's screens, three tabs after iOS: Welcome (what HeroCanvas is, its goal, how it works), Tour (a page per
// part of HeroCanvas, to try around the device) and Get Started (how to connect an app: its code, or a Figma file).
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useStill } from '../kit/motion';
import { useNav } from '../nav/context';
import { useUrlState } from '../sim/SimContext';
import { AppIcon, LaunchScreen, Reveal } from './Launch';
import type { PageProps } from '../nav/types';
import { STEPS, type TourStep } from './steps';
import { CapsuleButton, Hero, IconTile, ListRow, PromptField, Screen, Section, TextCell } from './TourKit';
import styles from './screens.module.css';

export const HOW = [
  { icon: 'link', tint: 'blue', title: 'Connect your app', subtitle: 'Your agent reads its code and mirrors it here' },
  { icon: 'devices', tint: 'indigo', title: 'See it everywhere', subtitle: 'Every screen on every device, in light and dark' },
  { icon: 'call_split', tint: 'pink', title: 'Propose changes', subtitle: 'Kept apart, in versions to compare' },
  { icon: 'send', tint: 'green', title: 'Hand them off', subtitle: 'A spec in your code’s own terms' },
] as const;

/** Whether the launch already played since HeroCanvas loaded: by default once, not every time Welcome shows again. */
let launched = false;

export function WelcomeScreen() {
  const nav = useNav();
  const still = useStill();
  // Scenarios › Launch: once (the default) or every time Welcome opens; changing it plays it again.
  const [launch] = useUrlState<string>('launch', 'once');
  const [splash, setSplash] = useState(() => !still && !(launch === 'once' && launched));
  const heroIcon = useRef<HTMLSpanElement>(null);
  const done = useCallback(() => {
    launched = true;
    setSplash(false);
  }, []);
  // A change of the option plays it again (not its first value: that's the mount, decided above).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    if (!still) setSplash(true);
  }, [launch, still]);
  let i = 0;
  return (
    <Screen title="Welcome">
      {splash && <LaunchScreen target={heroIcon} onDone={done} />}
      <div data-tilt-area>
        <Hero icon={<AppIcon iconRef={heroIcon} hidden={splash} />} title="HeroCanvas" subtitle="Design your app’s screens in code, with an AI agent, on a canvas of real devices." />
      </div>
      <Reveal on={!splash} index={i++}>
        <Section header="What it is">
          <TextCell>A design tool built on your app’s code. Its screens aren’t drawings: they’re a mirror of your app, rebuilt from the code with the same components, props and tokens your developers use.</TextCell>
        </Section>
      </Reveal>
      <Reveal on={!splash} index={i++}>
        <Section header="The goal">
          <TextCell>Design where your app will live: on every phone and tablet at once, in light and dark, in every language, with its real navigation. Then hand off changes in the terms your code already speaks.</TextCell>
        </Section>
      </Reveal>
      <Reveal on={!splash} index={i++}>
        <Section header="How it works">
          {HOW.map((h) => (
            <ListRow key={h.title} icon={h.icon} tint={h.tint} title={h.title} subtitle={h.subtitle} />
          ))}
        </Section>
      </Reveal>
      <Reveal on={!splash} index={i++}>
        <div className={styles.actions}>
          <CapsuleButton title="Take the Tour" onPressed={() => nav.goTab('tour')} />
          <CapsuleButton title="Get Started" filled={false} onPressed={() => nav.goTab('getStarted')} />
        </div>
      </Reveal>
    </Screen>
  );
}

export function TourScreen() {
  const nav = useNav();
  return (
    <Screen title="Tour">
      <Section header="Try each part" footer="This is an app too: HeroCanvas’s own, here until yours is connected. Each step is a page; try it on the interface around the device.">
        {STEPS.map((s) => (
          <ListRow key={s.id} icon={s.icon} tint={s.tint} title={s.title} subtitle={s.line} onTap={() => nav.push(s.id, {})} />
        ))}
      </Section>
    </Screen>
  );
}

export const WAYS = [
  {
    header: 'Recommended',
    icon: 'code',
    tint: 'blue',
    title: 'Connect your app’s code',
    text: 'Your agent reads your app’s repository (React, React Native, Flutter, SwiftUI or Compose) and builds its mirror here: every screen as a page, with your components, tokens and texts. Your code is only read, never changed.',
    prompt: 'Connect my app to HeroCanvas. Its code is in <the path to your app’s repository>.',
  },
  {
    header: 'No code yet',
    icon: 'draw',
    tint: 'purple',
    title: 'Start from a Figma file',
    text: 'When the design leads: your agent reads the file’s frames, components and variables, with Figma connected to it. Connect the code later.',
    prompt: 'Build my app in HeroCanvas from this Figma file: <the file’s link>',
  },
] as const;

export function GetStartedScreen() {
  return (
    <Screen title="Get Started">
      <p className={styles.lead}>Open your agent (Claude Code, or any that reads AGENTS.md) in this folder, and ask it one of these.</p>
      {WAYS.map((w) => (
        <Section key={w.title} header={w.header}>
          <ListRow icon={w.icon} tint={w.tint} title={w.title} />
          <TextCell>{w.text}</TextCell>
          <PromptField prompt={w.prompt} />
        </Section>
      ))}
    </Screen>
  );
}

/** A step's page: what the part is, what to try, and on to the next. */
export function stepScreen(step: TourStep): ComponentType<PageProps> {
  const next = STEPS[STEPS.indexOf(step) + 1];
  function Step() {
    const nav = useNav();
    return (
      <Screen title={step.title}>
        <div className={styles.stepHead}>
          <IconTile icon={step.icon} tint={step.tint} size={64} />
          <h1 className={styles.stepTitle}>{step.title}</h1>
          <p className={styles.stepLine}>{step.line}</p>
        </div>
        <Section>
          {step.body.map((p) => (
            <TextCell key={p}>{p}</TextCell>
          ))}
        </Section>
        <Section header="Try it">
          <TextCell>{step.tryIt}</TextCell>
        </Section>
        <div className={styles.actions}>
          {next ? <CapsuleButton title={`Next: ${next.title}`} onPressed={() => nav.push(next.id, {})} /> : <CapsuleButton title="Get Started" onPressed={() => nav.goTab('getStarted')} />}
        </div>
      </Screen>
    );
  }
  return Step;
}
