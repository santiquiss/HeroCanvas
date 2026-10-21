// The tour's screens, three tabs after iOS: Welcome (what HeroCanvas is, in a deck of cards to swipe), Tour (a page per
// part of HeroCanvas, to try around the device) and Get Started (how to connect an app: its code, or a Figma file).
import type { ComponentType } from 'react';
import { useNav } from '../nav/context';
import { useLaunchPhase } from '../sim/launchPhase';
import { AppIcon, Reveal } from './Motion';
import type { PageProps } from '../nav/types';
import { STEPS, type TourStep } from './steps';
import { Illustration } from './Art';
import { CapsuleButton, CardDeck, IconTile, ListRow, PromptField, Screen, Section, TextCell, type DeckCardProps } from './TourKit';
import styles from './screens.module.css';

/** Welcome's cards, in order: what HeroCanvas is, then the tour. */
export const WELCOME: Omit<DeckCardProps, 'count' | 'top' | 'style' | 'action'>[] = [
  { tint: 'blue', kicker: 'What it is', title: 'Your app, not a drawing.', text: 'Its screens rebuilt from your code, with the components, props and tokens your developers use.', art: <Illustration name="code" /> },
  { tint: 'green', kicker: 'How you work', title: 'You ask, your agent builds.', text: 'Nothing to drag or draw: every change goes through your AI agent. Describe it, add a screenshot or a Figma link, and it writes it in code.', art: <Illustration name="agent" /> },
  { tint: 'indigo', kicker: 'Everywhere', title: 'Every device, every theme.', text: 'Phones, foldables and tablets side by side, in light and dark, in every language.', art: <Illustration name="devices" /> },
  { tint: 'pink', kicker: 'Proposals', title: 'Change it in versions.', text: 'Ideas stay apart from the app as it is, to compare before anything ships.', art: <Illustration name="versions" /> },
  { tint: 'yellow', kicker: 'Handoff', title: 'Hand it off in code’s terms.', text: 'A spec with your own component names and tokens, ready for whoever builds it.', art: <Illustration name="handoff" /> },
  { tint: 'purple', kicker: 'Capture', title: 'Screens ready to share.', text: 'Any screen as an image or a video, on its device turned in 3D, with its color, light and shadow. For a deck, a store page or a post.', art: <Illustration name="capture" /> },
  { tint: 'ink', kicker: 'Next', title: 'Start with the Tour.', text: `${STEPS.length} short stops to try every part on the interface around this device.`, art: <Illustration name="tour" /> },
];

/** Welcome: the icon beside "Welcome to HeroCanvas", over a deck of cards to swipe; the last one opens the tour. */
export function WelcomeScreen() {
  const nav = useNav();
  // The deck rises in once the launch is over (the simulator plays it: the tour's LaunchConfig).
  const ready = useLaunchPhase() === 'done';
  const cards = WELCOME.map((c, i) => (i === WELCOME.length - 1 ? { ...c, action: { title: 'Take the Tour', onPressed: () => nav.goTab('tour') } } : c));
  return (
    <Screen title="Welcome" plain>
      <header data-tilt-area className={styles.welcomeHead}>
        <AppIcon size={58} />
        <div className={styles.welcomeTitle}>
          <span>Welcome to</span>
          <h1>HeroCanvas</h1>
        </div>
      </header>
      <Reveal on={ready} index={0} className={styles.welcomeDeck}>
        <CardDeck cards={cards} onFinish={() => nav.goTab('tour')} />
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
