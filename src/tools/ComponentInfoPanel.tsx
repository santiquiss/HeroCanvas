// Components' right panel, Info: the open component's page beside its examples (gallery/ComponentInfo).
import { componentState } from '../design/componentState';
import { useLibrary } from '../design/library';
import { ComponentInfo } from '../gallery/ComponentInfo';
import { useGalleryRoute, useStories } from '../gallery/route';
import styles from './Panel.module.css';

export function ComponentInfoPanel() {
  const { name } = useGalleryRoute();
  const { stories } = useStories();
  const mod = name ? stories.get(name) : undefined;
  if (!mod) return <div className={styles.section}>Pick a built component to see where it’s used and how to implement it.</div>;
  return <ComponentInfo key={name} mod={mod} />;
}

/** Info's tab: the open component's dot, its state against the code (the Components list has the same). */
export function ComponentStateBadge() {
  const { name } = useGalleryRoute();
  const { stories } = useStories();
  const lib = useLibrary();
  if (!name || !lib || !stories.has(name)) return null;
  const state = componentState(name, true, lib);
  return <span className={styles.dot} style={{ background: state.color, marginLeft: 6 }} title={state.label} />;
}
