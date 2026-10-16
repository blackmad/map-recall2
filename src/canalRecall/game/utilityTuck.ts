// When the corner utilities (Feedback, settings, help, build stamp) show.
//
// Whenever the map is the content they stay out of the picture until asked
// for: riding, the start-of-ride overview flight, and the paused map. A mouse
// move, a non-steering key or a map tap reveals them for a few seconds, and a
// pointer resting on them holds them. Menus, route setup and an open panel
// keep them up; loading and the arrival card hide them outright.
// (User 2026-10-16: "hide these buttons unless the mouse is moved", seen over
// the overview flight.) Keys G and ? work regardless.

/** Same numbers as game.js `GameState`. */
export const UTILITY_STATES = { MENU: 0, MAP_SELECT: 1, LOADING: 2, RACING: 4, FINISHED: 5, PAUSED: 6 } as const;

export type UtilityVisibility = 'none' | 'tuckable' | 'shown';

export interface UtilityInput {
  state: number;
  /** Settings, help or another utility panel the cluster opened is up. */
  utilityOpen: boolean;
}

export function utilityVisibility({ state, utilityOpen }: UtilityInput): UtilityVisibility {
  if (state === UTILITY_STATES.FINISHED || state === UTILITY_STATES.LOADING) return 'none';
  if (utilityOpen) return 'shown';
  if (state === UTILITY_STATES.RACING || state === UTILITY_STATES.PAUSED) return 'tuckable';
  return 'shown';
}

/**
 * Whether entering a map-content phase opens with a reveal. A ride that
 * starts on the bike shows the utilities for its first seconds, so they are
 * discoverable; the overview flight does not, because the flight is the
 * thing to look at and the cluster sat over it.
 */
export function revealOnEnter(enteringTuckable: boolean, introRunning: boolean): boolean {
  return enteringTuckable && !introRunning;
}
