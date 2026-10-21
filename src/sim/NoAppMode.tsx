// A mode's canvas with no app connected: what the mode shows once there is one, centered where it would be.
import { EmptyHint } from '../components/EmptyHint';
import styles from './NoAppMode.module.css';

const MODES = {
  flow: { icon: 'account_tree', title: 'Flow', body: 'Every page of your app on one canvas, linked the way it navigates, each step of a flow in a row. Open any of them from here.' },
  components: { icon: 'widgets', title: 'Components', body: 'Your app’s components, each with its stories: every state side by side, in light and dark, with the props to change and the places the app uses it.' },
  tokens: { icon: 'palette', title: 'Tokens', body: 'Your app’s design tokens: colors per theme, spacing, radii and type, with where each is used.' },
  capture: { icon: 'photo_camera', title: 'Capture', body: 'Your screens as images and videos to share or market: a device turned in 3D, with light, motion and its own colors.' },
};

export function NoAppMode({ mode }: { mode: keyof typeof MODES }) {
  const m = MODES[mode];
  return (
    <div className={styles.canvas}>
      <div className={styles.card}>
        <EmptyHint icon={m.icon} title={m.title}>
          {m.body} It fills in once your app is connected: see Get started.
        </EmptyHint>
      </div>
    </div>
  );
}
