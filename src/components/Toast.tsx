import styles from './Toast.module.css';

export function Toast({ text, bottom }: { text: string | null; bottom: number }) {
  if (!text) return null;
  return (
    <div className={styles.toast} style={{ bottom }}>
      {text}
    </div>
  );
}
