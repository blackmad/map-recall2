// "Follow the street" touch steering.
//
// What this replaces as the touch default: an analog stick that steered the
// bike directly. Every thumb wobble became a heading wobble, the chase camera
// turned with the heading, and the result was the whole city swinging left and
// right under the player's thumb (user report 2026-10-29, "not fun to use and
// kind of nauseating").
//
// The model here is Asphalt 9's TouchDrive and Mario Kart Tour's auto-cruise,
// adapted to a game about learning streets: the bike rides along the street it
// is on by itself, and every input is a *decision* — which way to go at the
// next junction, stop, or turn round. Holding left or right queues a turn; the
// bike takes it where a street opens on that side. With nothing queued it goes
// straight on, follows a bend, and waits at a T-junction for a choice.
//
// The controller is pure: it reads the road contacts around the bike (the same
// `contactsAt` the road guard uses) and returns a heading to ease toward. The
// player applies it with `turnToward`, so the heading — and the camera that
// follows it — only ever changes smoothly.

import { normalizeAngle, TURN_AROUND_MAX_SPEED, type DpadLayout, type TouchPoint } from './touchControls.ts';

export type FollowContact = Readonly<{
  /** Undirected tangent of the span. */
  angle: number;
  /** Distance from the bike to the span's centreline. */
  dist: number;
  /** Half-width of the corridor. */
  width: number;
  /** Span length and the contact's distance along it in the direction of
   *  `angle`. When given, a direction that runs off the end of its span within
   *  SPAN_END_LEAD is not a way on (the next span, if any, is its own contact). */
  length?: number;
  along?: number;
}>;

export type StreetFollowButtons = Readonly<{ left: boolean; right: boolean; back: boolean; forward?: boolean }>;

export type StreetFollowState = {
  /** -1 left, 1 right, 0 nothing queued. */
  queuedTurn: number;
  /** Seconds since the queued side was released (0 while held). */
  queueAge: number;
  /** Seconds the back button has been held, or -1 when up. */
  backHeld: number;
  /** A tapped back: brake, then swing round once slow. */
  uTurnPending: boolean;
  /** The heading of a turn already committed to, until the bike faces it. */
  turning: number | null;
  /** Seconds a side has been held while stopped with nowhere to turn. */
  stuckHeld: number;
  /** The side whose press has already been spent on a turn; it queues again
   *  only after the button is released. One press, one turn: holding left
   *  used to take every left-hand opening in a row. */
  spentSide: number;
  /** Waiting at the start of a ride for the first press, so the player can
   *  look around before the bike sets off (it used to roll straight into the
   *  first question). Any button, or the up arrow, starts it. */
  parked: boolean;
};

export type StreetFollowCommand = {
  /** Heading to ease toward, or null to keep the current one. */
  targetHeading: number | null;
  /** Cruise speed as a fraction of max speed (0 = stop). */
  speedFraction: number;
  /** 0..1 brake. */
  brake: number;
  /** Swing round along the street now (the bike is slow enough). */
  turnAround: boolean;
  /** Free steering where no street is under the bike (-1..1). */
  steer: number;
  /** Swing on the spot: stopped against a kerb with a side held. */
  pivot: number;
  /** At a junction with no straight on and nothing queued: waiting. */
  awaitingChoice: boolean;
};

/** Cruise speed as a fraction of max speed. */
export const STREET_CRUISE_FRACTION = 0.62;
/** How fast the bike swings onto a street, rad/s. Half the old absolute-mode
 *  rate: a 90° turn takes ~0.6 s, which is a turn, not a snap. The camera
 *  does not follow at this rate — cameraYaw.ts caps it lower. */
export const STREET_TURN_RATE = 2.6;
/** A released turn stays queued this long, so a tap well before the junction
 *  still counts. */
export const QUEUE_HOLD_SECONDS = 4;
/** Back pressed for less than this is a tap (turn round); longer is a stop. */
export const BACK_TAP_SECONDS = 0.25;
/** A street this far off the heading is still "straight on". */
export const STRAIGHT_TOLERANCE = (50 * Math.PI) / 180;
/** A side street must open at least this far off the heading to be a turn. */
export const MIN_TURN = (25 * Math.PI) / 180;
/** A queued turn takes an opening this sharp without further question; a
 *  gentler one only at a fork. */
export const QUEUE_MIN_TURN = (40 * Math.PI) / 180;
/** Two ways on are a fork when they split by at least this. */
export const FORK_SPLIT = (15 * Math.PI) / 180;
/** Streets more than this far back are behind the bike, not choices. */
export const MAX_TURN = (150 * Math.PI) / 180;
/** px past a corridor's half-width that still counts as on it. */
export const CANDIDATE_SLACK = 4;
/** A committed turn ends when the heading is this close to it. */
const TURN_DONE = (6 * Math.PI) / 180;
/** px: a span that ends within this much of the contact no longer offers a
 *  way on in that direction. A little lead so a bend starts turning just
 *  before the vertex instead of overshooting it. */
export const SPAN_END_LEAD = 6;
/** px: a queued turn commits no later than this far from the cross street's
 *  centreline, however slow the bike. */
export const COMMIT_MIN = 4;
/** px past a side street's corridor at which a queued turn starts slowing. */
export const APPROACH_REACH = 60;
/** Cruise fraction for taking a corner: ~75 px/s, a 29 px turning radius at
 *  STREET_TURN_RATE — inside an 18 px half-width street plus the junction. */
export const CORNER_FRACTION = 0.28;
/** Seconds a side is held while stopped with no street there before the bike
 *  pivots on the spot (the escape hatch for a kerb wedge or a plaza edge). */
export const STUCK_PIVOT_SECONDS = 0.6;

export function initialStreetFollowState(): StreetFollowState {
  return { queuedTurn: 0, queueAge: 0, backHeld: -1, uTurnPending: false, turning: null, stuckHeld: 0, spentSide: 0, parked: true };
}

export type StreetChoice = { heading: number; turn: number; dist: number; width: number };

/** Every direction the bike could ride from here: both ways along each street
 *  whose corridor it is in, minus the ones behind it. */
export function streetChoices(contacts: readonly FollowContact[], heading: number, reach = CANDIDATE_SLACK): StreetChoice[] {
  const choices: StreetChoice[] = [];
  for (const contact of contacts) {
    if (!(contact.dist <= contact.width + reach)) continue;
    const known = contact.length != null && contact.along != null;
    const ahead = known ? contact.length! - contact.along! : Infinity;
    const behind = known ? contact.along! : Infinity;
    for (const [direction, room] of [[contact.angle, ahead], [contact.angle + Math.PI, behind]] as const) {
      if (room < SPAN_END_LEAD) continue;
      const turn = normalizeAngle(direction - heading);
      if (Math.abs(turn) > MAX_TURN) continue;
      choices.push({ heading: normalizeAngle(direction), turn, dist: contact.dist, width: contact.width });
    }
  }
  return choices;
}

function straightest(choices: readonly StreetChoice[]): StreetChoice | null {
  let best: StreetChoice | null = null;
  for (const choice of choices) if (!best || Math.abs(choice.turn) < Math.abs(best.turn)) best = choice;
  return best;
}

/** The side street to take for a queued turn: on that side, opening far
 *  enough to be a turn, and close enough that an arc at the current speed
 *  lands on its centreline (radius = speed / turn rate; a turn of θ needs the
 *  centreline R·sin θ ahead). Committing at the corridor's edge instead cut
 *  the corner at cruise speed. The one closest to a right angle wins (a
 *  fork's gentle branch loses to a real cross street, but is taken when it is
 *  the only one). */
export function queuedTurnChoice(choices: readonly StreetChoice[], side: number, speed = 0): StreetChoice | null {
  const radius = Math.abs(speed) / STREET_TURN_RATE;
  let best: StreetChoice | null = null;
  for (const choice of choices) {
    if (Math.sign(choice.turn) !== side || Math.abs(choice.turn) < MIN_TURN) continue;
    // A slight bend is a turn only at a fork, where another way runs on
    // further to the other side; otherwise it is the street itself kinking
    // (a bridge approach), which straight-on already follows.
    if (Math.abs(choice.turn) < QUEUE_MIN_TURN && !choices.some(other =>
      Math.abs(other.turn) <= STRAIGHT_TOLERANCE && (choice.turn - other.turn) * side > FORK_SPLIT)) continue;
    const commitAt = Math.max(COMMIT_MIN, radius * Math.sin(Math.min(Math.PI / 2, Math.abs(choice.turn))));
    if (choice.dist > commitAt) continue;
    const score = Math.abs(Math.abs(choice.turn) - Math.PI / 2);
    if (!best || score < Math.abs(Math.abs(best.turn) - Math.PI / 2)) best = choice;
  }
  return best;
}

/** True when a street opens on the queued side within APPROACH_REACH: time to
 *  slow for the corner. */
export function turnAhead(contacts: readonly FollowContact[], heading: number, side: number): boolean {
  if (!side) return false;
  return streetChoices(contacts, heading, APPROACH_REACH)
    .some(choice => Math.sign(choice.turn) === side && Math.abs(choice.turn) >= MIN_TURN);
}

function updateButtons(state: StreetFollowState, buttons: StreetFollowButtons, dt: number): StreetFollowState {
  const next = { ...state };
  if (buttons.left || buttons.right || buttons.back || buttons.forward) next.parked = false;
  const side = (buttons.right ? 1 : 0) - (buttons.left ? 1 : 0);
  if (side !== next.spentSide) next.spentSide = 0;
  if (side && side !== next.spentSide) {
    next.queuedTurn = side;
    next.queueAge = 0;
  } else if (next.queuedTurn) {
    next.queueAge += dt;
    if (next.queueAge > QUEUE_HOLD_SECONDS) next.queuedTurn = 0;
  }
  if (buttons.back) {
    next.backHeld = next.backHeld < 0 ? 0 : next.backHeld + dt;
  } else {
    if (next.backHeld >= 0 && next.backHeld < BACK_TAP_SECONDS) {
      next.uTurnPending = true;
      next.queuedTurn = 0;
      next.turning = null;
    }
    next.backHeld = -1;
  }
  return next;
}

/** One frame of street following. */
export function stepStreetFollow(
  previous: StreetFollowState,
  buttons: StreetFollowButtons,
  context: Readonly<{ heading: number; speed: number; contacts: readonly FollowContact[]; dt: number }>,
): { state: StreetFollowState; command: StreetFollowCommand } {
  const state = updateButtons(previous, buttons, context.dt);
  const { heading, speed } = context;
  const command: StreetFollowCommand = {
    targetHeading: null,
    speedFraction: STREET_CRUISE_FRACTION,
    brake: 0,
    turnAround: false,
    steer: 0,
    pivot: 0,
    awaitingChoice: false,
  };
  const slow = Math.abs(speed) < TURN_AROUND_MAX_SPEED;
  if (state.parked) {
    command.speedFraction = 0;
    return { state, command };
  }

  if (state.uTurnPending) {
    command.speedFraction = 0;
    if (slow) {
      command.turnAround = true;
      state.uTurnPending = false;
    } else {
      command.brake = 1;
    }
    return { state, command };
  }
  // Held back (past a tap) is a stop, and stays one while held.
  if (state.backHeld >= BACK_TAP_SECONDS) {
    command.speedFraction = 0;
    command.brake = 1;
    return { state, command };
  }

  const choices = streetChoices(context.contacts, heading);
  const held = (buttons.right ? 1 : 0) - (buttons.left ? 1 : 0);
  if (!choices.length) {
    state.turning = null;
    const onStreet = context.contacts.some(contact => contact.dist <= contact.width + CANDIDATE_SLACK);
    if (onStreet) {
      // On a street with no way on: a dead end. Stop; back turns round, and
      // a held side pivots after a beat.
      command.speedFraction = 0;
      command.brake = slow ? 0 : 0.6;
      if (held && slow) {
        state.stuckHeld += context.dt;
        if (state.stuckHeld > STUCK_PIVOT_SECONDS) command.pivot = held;
      } else {
        state.stuckHeld = 0;
      }
      return { state, command };
    }
    // Off the network (a plaza, a recovery from the shoulder): the buttons
    // steer directly, gently, rather than leaving the bike stranded.
    command.steer = held * 0.7;
    return { state, command };
  }

  if (state.turning != null) {
    // Track the street being turned into: it may curve, or be digitised a few
    // degrees off the guess made at the junction.
    let snapped = state.turning;
    let bestDelta = Infinity;
    for (const choice of choices) {
      const delta = Math.abs(normalizeAngle(choice.heading - state.turning));
      if (delta < bestDelta && delta < MIN_TURN) { bestDelta = delta; snapped = choice.heading; }
    }
    state.turning = snapped;
    if (Math.abs(normalizeAngle(snapped - heading)) < TURN_DONE) state.turning = null;
    command.targetHeading = snapped;
    command.speedFraction = CORNER_FRACTION;
    state.stuckHeld = 0;
    return { state, command };
  }

  if (state.queuedTurn) {
    const turn = queuedTurnChoice(choices, state.queuedTurn, speed);
    if (turn) {
      state.turning = turn.heading;
      if (held === state.queuedTurn) state.spentSide = held;
      state.queuedTurn = 0;
      state.queueAge = 0;
      state.stuckHeld = 0;
      command.targetHeading = turn.heading;
      command.speedFraction = CORNER_FRACTION;
      return { state, command };
    }
    if (turnAhead(context.contacts, heading, state.queuedTurn)) command.speedFraction = CORNER_FRACTION;
  }

  const ahead = straightest(choices);
  if (ahead && Math.abs(ahead.turn) <= STRAIGHT_TOLERANCE) {
    command.targetHeading = ahead.heading;
  } else {
    // Nothing straight on. All the ways forward on one side is a bend in the
    // street: follow it. Ways on both sides is a T-junction: wait for a choice
    // rather than picking one for the player.
    const sides = new Set(choices.filter(choice => Math.abs(choice.turn) >= MIN_TURN).map(choice => Math.sign(choice.turn)));
    if (sides.size === 1 && ahead) {
      command.targetHeading = ahead.heading;
    } else {
      command.speedFraction = 0;
      command.brake = slow ? 0 : 0.6;
      command.awaitingChoice = !state.queuedTurn;
    }
  }

  // Stopped with a side held and no street that way (wedged at a kerb, a dead
  // end): after a beat, pivot, the way the stick's hard sideways did.
  if (held && slow && !queuedTurnChoice(choices, held, speed)) {
    state.stuckHeld += context.dt;
    if (state.stuckHeld > STUCK_PIVOT_SECONDS && command.speedFraction === 0) command.pivot = held;
  } else {
    state.stuckHeld = 0;
  }
  return { state, command };
}

// ---------------------------------------------------------------------------
// The touch pad for street following. It reuses the stick's zone (the HUD
// budgets around that rectangle): the upper two thirds split into a left and a
// right turn button, the bottom third is back — tap to turn round, hold to
// stop. Several thumbs may be down at once; a thumb that slides across the
// split changes button, and one that leaves the zone keeps its last button
// until it lifts, so a turn is not dropped by a wandering thumb.
// ---------------------------------------------------------------------------

export type StreetPadButton = 'left' | 'right' | 'back';

export type StreetPadRects = Readonly<Record<StreetPadButton, { x: number; y: number; width: number; height: number }>>;

/** Gap between the drawn buttons, logical px. */
const PAD_GAP = 6;

export function streetPadRects(layout: DpadLayout): StreetPadRects {
  const { x, y, width, height } = layout.bounds;
  const top = Math.round(height * 0.64);
  const half = (width - PAD_GAP) / 2;
  return {
    left: { x, y, width: half, height: top - PAD_GAP / 2 },
    right: { x: x + half + PAD_GAP, y, width: half, height: top - PAD_GAP / 2 },
    back: { x, y: y + top + PAD_GAP / 2, width, height: height - top - PAD_GAP / 2 },
  };
}

/** Which button a point presses. Inside the zone it is the button under it;
 *  outside, the nearest one (used for a captured thumb that has wandered). */
export function streetPadButtonAt(point: TouchPoint, layout: DpadLayout): StreetPadButton {
  const { y, height } = layout.bounds;
  if (point.y >= y + height * 0.64) return 'back';
  return point.x < layout.cx ? 'left' : 'right';
}

export function noStreetButtons(): { left: boolean; right: boolean; back: boolean } {
  return { left: false, right: false, back: false };
}
