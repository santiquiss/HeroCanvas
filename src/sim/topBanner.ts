// The app's banner under the status bar (AppNavigation.TopBanner): how tall it is now. Its own module, free of
// imports: the simulator's context reads it (SimContext) without importing the app, which imports the context.
let heightHook: () => number = () => 0;

/** Set once, where the app's navigation is read (nav/pages). */
export function setTopBannerHeight(useHeight: (() => number) | undefined) {
  if (useHeight) heightHook = useHeight;
}

/** The banner's height now (0: none). A hook: the app's own decides (its state, the URL). */
export function useTopBannerHeight(): number {
  return heightHook();
}
