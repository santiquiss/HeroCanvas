// What HeroCanvas shows before any app is connected (the app declares no pages: the `empty` branch, or a fresh
// start): how to begin, instead of an empty simulator. Each way is something to ask the agent, ready to copy.
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { setUiTheme, useUiTheme } from './uiTheme';
import styles from './GetStarted.module.css';

const REPO = 'https://github.com/santiquiss/HeroCanvas';

const WAYS = [
  {
    icon: 'code',
    title: 'Connect your app’s code',
    tag: 'Recommended',
    body: 'Your agent reads your app’s repository (React, React Native, Flutter, SwiftUI or Compose) and builds its mirror here: every screen as a page, your components, tokens and texts, with the names your code uses. Your app’s code is only read, never changed.',
    prompt: 'Connect my app to HeroCanvas. Its code is in <the path to your app’s repository>.',
  },
  {
    icon: 'draw',
    title: 'Start from a Figma file',
    body: 'No code yet, or the design leads: your agent reads the file’s frames, components and variables (with Figma connected to it) and builds the screens from them. Connect the code later, when there is some.',
    prompt: 'Build my app in HeroCanvas from this Figma file: <the file’s link>',
  },
  {
    icon: 'smartphone',
    title: 'Look around first',
    body: 'A sample app, a small task manager with made-up data, shows every part of HeroCanvas working. It lives on the main branch.',
    prompt: 'git switch main',
  },
];

function Copy({ text }: { text: string }) {
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
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export function GetStarted() {
  const ui = useUiTheme();
  return (
    <div className={styles.window}>
      <button className={styles.theme} aria-label={ui === 'dark' ? 'Light interface' : 'Dark interface'} title={ui === 'dark' ? 'Light interface' : 'Dark interface'} onClick={() => setUiTheme(ui === 'dark' ? 'light' : 'dark')}>
        <Icon name={ui === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
      </button>
      <main className={styles.page}>
        <header className={styles.head}>
          <img src="/pwa/icon-192.png" alt="" width={88} height={88} className={styles.logo} />
          <h1 className={styles.title}>Welcome to HeroCanvas</h1>
          <p className={styles.lead}>
            Design your app’s screens in code, with an AI agent, on a canvas of real devices. It starts with your app: there isn’t one here yet.
          </p>
        </header>

        <p className={styles.how}>
          Open your agent (Claude Code, or any that reads <code>AGENTS.md</code>) in this folder, and ask it one of these:
        </p>
        <ol className={styles.ways}>
          {WAYS.map((w, i) => (
            <li key={w.title} className={`${styles.way} ${i === 0 ? styles.first : ''}`}>
              <span className={styles.wayIcon}>
                <Icon name={w.icon} size={22} />
              </span>
              <div className={styles.wayText}>
                <h2 className={styles.wayTitle}>
                  {w.title}
                  {w.tag && <span className={styles.tag}>{w.tag}</span>}
                </h2>
                <p>{w.body}</p>
                <div className={styles.prompt}>
                  <code>{w.prompt}</code>
                  <Copy text={w.prompt} />
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className={styles.next}>
          Once it’s connected, this page gives way to your app: its pages on phones and tablets, Flow, Scenarios, the
          components, and proposals for what to change. The README walks through all of it.
        </p>
        <footer className={styles.foot}>
          HeroCanvas {__HC_VERSION__} ·{' '}
          <a href={REPO} target="_blank" rel="noreferrer">
            README
          </a>{' '}
          · PolyForm Shield License 1.0.0
        </footer>
      </main>
    </div>
  );
}
