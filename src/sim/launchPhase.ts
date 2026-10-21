// Where a screen is in the app's launch (sim/launch): its `screen` (the icon entering and holding), its `exit`, or
// `done` (also when there's none to play). Apart from the launch itself so screens can read it without importing
// the simulator.
import { createContext, useContext } from 'react';

export type LaunchPhase = 'screen' | 'exit' | 'done';

/** The phase of the launch on the screen this renders in (DeviceScreen provides it). */
export const LaunchPhaseCtx = createContext<LaunchPhase>('done');

/** The launch's phase on this screen: start a screen's own entrance on `done`. */
export function useLaunchPhase(): LaunchPhase {
  return useContext(LaunchPhaseCtx);
}
