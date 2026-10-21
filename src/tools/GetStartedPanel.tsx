// Get started (the right panel's first tab while no app is connected): the ways to begin, each something to ask the
// agent, ready to copy. The rest of the interface stays around it, each part saying what it's for (EmptyHint).
import { useState } from 'react';
import { Icon } from '../components/Icon';
import styles from './GetStartedPanel.module.css';

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

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={styles.copy}
      title="Copy"
      aria-label="Copy"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        })
      }
    >
      <Icon name={done ? 'check' : 'content_copy'} size={15} />
    </button>
  );
}

export function GetStartedPanel() {
  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Welcome to HeroCanvas</h2>
      <p className={styles.lead}>
        It starts with your app: there isn’t one here yet. Open your agent (Claude Code, or any that reads{' '}
        <code>AGENTS.md</code>) in this folder and ask it one of these.
      </p>
      <ol className={styles.ways}>
        {WAYS.map((w, i) => (
          <li key={w.title} className={`${styles.way} ${i === 0 ? styles.first : ''}`}>
            <h3 className={styles.wayTitle}>
              <span className={styles.wayIcon}>
                <Icon name={w.icon} size={16} />
              </span>
              {w.title}
              {w.tag && <span className={styles.tag}>{w.tag}</span>}
            </h3>
            <p>{w.body}</p>
            <div className={styles.prompt}>
              <code>{w.prompt}</code>
              <Copy text={w.prompt} />
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.next}>
        Meanwhile, look around: every part of the interface says what it shows once your app is in. The devices, their
        themes and sizes work already.
      </p>
    </div>
  );
}
