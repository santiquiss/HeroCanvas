// Shot mode's URL params (ShotShell): kept across navigation like the simulator's own (nav/stack.ts SIM_PARAMS), so a
// step that opens another page stays a shot. scripts/shot/args.mjs writes them (its test checks the names match).

/** `?shot=1`: the agent's capture view. */
export const SHOT_PARAM = 'shot';
/** `light`, `dark`, or both (unset). */
export const SHOT_THEMES_PARAM = 'shot_themes';
/** Room around the devices and between them, in points. */
export const SHOT_PADDING_PARAM = 'shot_padding';
export const SHOT_GAP_PARAM = 'shot_gap';
/** `?shot_compare=1`: Live ("Before") beside the proposal ("After"). */
export const SHOT_COMPARE_PARAM = 'shot_compare';

export const SHOT_PARAMS = [SHOT_PARAM, SHOT_THEMES_PARAM, SHOT_PADDING_PARAM, SHOT_GAP_PARAM, SHOT_COMPARE_PARAM] as const;
