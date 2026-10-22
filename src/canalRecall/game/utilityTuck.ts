// When the corner utilities (Feedback, settings, help, build stamp) show.
//
// Whenever the map is the content they stay out of the picture until asked
// for: riding and the start-of-ride overview flight. A mouse
// move, a non-steering key or a map tap reveals them for a few seconds, and a
// pointer resting on them holds them. Menus, route setup and an open panel
// keep them up, and so does the pause card (a menu); loading and the arrival
// card hide them outright.
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
  if (state === UTILITY_STATES.RACING) return 'tuckable';
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

export interface ScreenRect { left: number; top: number; right: number; bottom: number }

/** Clearance kept between a utility button and a card it would touch, in CSS px. */
export const UTILITY_CARD_CLEARANCE = 6;

/**
 * Whether any utility button would sit on (or within `clearance` of) an open
 * card, such as the question card. Then the cluster stays tucked whatever
 * reveal is running: on a 390×844 phone "Report a problem" covered the fourth
 * answer and settings / help covered "No idea" (teaser capture 2026-10-22;
 * a tap on the map or a key press revealed them over the card). Measured from
 * the live layout, so a docked desktop card that does not reach the corner
 * leaves the cluster alone.
 */
export function utilityBlockedByCards(
  buttons: readonly ScreenRect[],
  cards: readonly (ScreenRect | null | undefined)[],
  clearance = UTILITY_CARD_CLEARANCE,
): boolean {
  for (const card of cards) {
    if (!card || card.right <= card.left || card.bottom <= card.top) continue;
    for (const b of buttons) {
      if (b.right <= b.left || b.bottom <= b.top) continue;
      if (b.left < card.right + clearance && b.right > card.left - clearance
        && b.top < card.bottom + clearance && b.bottom > card.top - clearance) return true;
    }
  }
  return false;
}
