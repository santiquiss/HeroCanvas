// What a device shows before any app is connected (nav/pages.tsx): where the app's screens will be, and where to
// start. On the app's tokens like any screen, so the device's theme and text size apply to it too.
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import styles from './NoAppScreen.module.css';

export function NoAppScreen() {
  // Instrumented like any screen's component: Inspect and Layers name it.
  const hc = useComponent('NoAppScreen', {});
  return (
    <div {...hc} className={styles.screen}>
      <span className={styles.icon}>
        <Icon name="devices" size={34} />
      </span>
      <h1 className={styles.title}>Your app’s screens appear here</h1>
      <p className={styles.body}>On every device at once, in light and dark, in every language, as your app behaves.</p>
      <p className={styles.hint}>
        <Icon name="arrow_forward" size={16} />
        <span>Start in Get started, on the right</span>
      </p>
    </div>
  );
}
