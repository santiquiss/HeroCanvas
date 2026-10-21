// A mode's canvas with no app connected, for the modes with nothing to show without one (the prototype, Flow and
// Capture show the welcome screen): what the mode shows once there is one, centered where it would be.
import { EmptyHint } from '../components/EmptyHint';
import styles from './NoAppMode.module.css';

const MODES = {
  components: { icon: 'widgets', title: 'Components', body: 'Your app’s components, each with its stories: every state side by side, in light and dark, with the props to change and the places the app uses it.' },
  tokens: { icon: 'palette', title: 'Tokens', body: 'Your app’s design tokens: colors per theme, spacing, radii and type, with where each is used.' },
};

export function NoAppMode({ mode }: { mode: keyof typeof MODES }) {
  const m = MODES[mode];
  return (
    <div className={styles.canvas}>
      <div className={styles.card}>
        <EmptyHint icon={m.icon} title={m.title}>
          {m.body} It fills in once your app is connected: the device’s welcome screen says how.
        </EmptyHint>
      </div>
    </div>
  );
}
