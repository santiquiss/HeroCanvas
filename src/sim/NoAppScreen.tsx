// What the devices show before any app is connected (nav/pages.tsx): HeroCanvas's welcome, as a screen of an app,
// with the ways to begin, each something to ask the agent, ready to copy. A screen like any: on the app's tokens, so
// the device's theme and text size apply, and Flow and Capture work with it (try them before there's an app).
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import styles from './NoAppScreen.module.css';

export const WAYS = [
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
    title: 'Look around first',
    body: 'A sample app, a task manager with made-up data, shows every part working. It’s on the main branch.',
    prompt: 'git switch main',
  },
];

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={styles.copy}
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        })
      }
    >
      <Icon name={done ? 'check' : 'content_copy'} size={16} />
      <span>{done ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

export function NoAppScreen() {
  // Instrumented like any screen's component: Inspect and Layers name it.
  const hc = useComponent('NoAppScreen', {});
  return (
    <div {...hc} className={styles.screen}>
      <div className={styles.content}>
        <header className={styles.head}>
          <img src="/pwa/icon-192.png" alt="" width={64} height={64} className={styles.logo} />
          <h1 className={styles.title}>Welcome to HeroCanvas</h1>
          <p className={styles.lead}>Your app’s screens will be here, on every device at once. To begin, open your agent in this folder and ask it one of these.</p>
        </header>
        <ol className={styles.ways}>
          {WAYS.map((w, i) => (
            <li key={w.title} className={`${styles.way} ${i === 0 ? styles.first : ''}`}>
              <div className={styles.wayHead}>
                <span className={styles.wayIcon}>
                  <Icon name={w.icon} size={18} />
                </span>
                <h2 className={styles.wayTitle}>{w.title}</h2>
                {w.tag && <span className={styles.tag}>{w.tag}</span>}
              </div>
              <p className={styles.wayBody}>{w.body}</p>
              <div className={styles.prompt}>
                <code>{w.prompt}</code>
                <CopyButton text={w.prompt} />
              </div>
            </li>
          ))}
        </ol>
        <p className={styles.foot}>Meanwhile, look around: every part of HeroCanvas says what it’s for. Try the devices, their themes, Flow and Capture.</p>
      </div>
    </div>
  );
}
