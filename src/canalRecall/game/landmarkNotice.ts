// How long a landmark card stays up, and how it fades.
//
// This used to be one countdown for three different intentions, which is why
// the drive-by card was wrong: six seconds is plenty when you are stopped
// beside a church and far too little when you are still approaching it. A card
// opened by proximity is now held by proximity, and the other two intentions
// say what they mean instead of borrowing the timer (the arrival card was
// literally `timer = 3600`).

import type { WorldPoint } from './worldTypes';

/** Why a card is up, which is what decides when it comes down. */
export type NoticeHold =
  /** Opened by driving near a landmark: held while the player is still near
   *  it. The anchor is the landmark's world position. */
  | { kind: 'proximity'; anchor: WorldPoint }
  /** Opened by a deliberate click, possibly on something far away or with no
   *  position at all, so proximity says nothing. Held for a fixed time. */
  | { kind: 'timed'; seconds: number }
  /** Held until something replaces it — the arrival card on the finish screen. */
  | { kind: 'sticky' };

export interface NoticeState {
  /** Seconds since the card opened. */
  elapsed: number;
  /** Seconds of fade-out left. `null` while the card is still held open. */
  fadeRemaining: number | null;
}

export interface NoticeConfig {
  /**
   * px — the card is held while the player is within this distance. Larger
   * than the radius that opens it, so that driving along the boundary does not
   * flicker the card on and off.
   */
  exitRadius: number;
  /** Seconds a proximity card stays up even if the player is already leaving,
   *  so passing at speed still leaves something readable. */
  minSeconds: number;
  /** Seconds to fade in, and to fade out once released. */
  fadeSeconds: number;
}

export const DEFAULT_NOTICE_CONFIG: NoticeConfig = {
  exitRadius: 480,
  minSeconds: 6,
  fadeSeconds: 0.8,
};

export function openNotice(): NoticeState {
  return { elapsed: 0, fadeRemaining: null };
}

export interface NoticeVisibility {
  state: NoticeState;
  /** 0 to 1, ready to multiply into `globalAlpha`. */
  alpha: number;
  /** False once the card has finished fading and should be dropped. */
  visible: boolean;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Advance one frame of a card's life.
 *
 * `playerPosition` is `null` when there is no vehicle — during loading, or on
 * the finish screen — in which case a proximity card is held rather than
 * dismissed, because "nobody is nearby" is not the same as "the player drove
 * away".
 */
export function advanceNotice(
  state: NoticeState,
  hold: NoticeHold,
  playerPosition: WorldPoint | null,
  dt: number,
  config: NoticeConfig = DEFAULT_NOTICE_CONFIG,
): NoticeVisibility {
  const elapsed = state.elapsed + dt;
  let held: boolean;
  switch (hold.kind) {
    case 'sticky':
      held = true;
      break;
    case 'timed':
      held = elapsed < hold.seconds;
      break;
    case 'proximity': {
      if (!playerPosition) { held = true; break; }
      const distance = Math.hypot(hold.anchor.x - playerPosition.x, hold.anchor.y - playerPosition.y);
      held = distance <= config.exitRadius || elapsed < config.minSeconds;
      break;
    }
  }

  const fadeRemaining = held
    ? null
    : (state.fadeRemaining === null ? config.fadeSeconds : state.fadeRemaining) - dt;
  const next: NoticeState = { elapsed, fadeRemaining };
  const fadeIn = clamp01(elapsed / config.fadeSeconds);
  const fadeOut = fadeRemaining === null ? 1 : clamp01(fadeRemaining / config.fadeSeconds);
  return {
    state: next,
    alpha: Math.min(fadeIn, fadeOut),
    visible: fadeRemaining === null || fadeRemaining > 0,
  };
}
