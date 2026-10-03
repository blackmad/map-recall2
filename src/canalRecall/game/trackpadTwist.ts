// Two-finger twist to orbit the chase/cockpit camera (user ask 2026-10-03:
// "spin the camera with a two-finger twist gesture on my trackpad").
//
// Safari is the only desktop browser that reports a trackpad rotation: its
// `gesturechange` event carries `rotation`, degrees clockwise since the
// gesture began (iOS Safari fires the same events for a two-finger touch).
// Chrome and Firefox expose no twist at all, neither as a gesture event nor
// as a wheel delta, so they get Option/Alt + two-finger scroll instead.
//
// A pinch always wobbles a few degrees, so a twist only engages past a dead
// zone and then tracks from where it engaged rather than jumping.

/** Degrees a gesture must turn before it starts orbiting the camera. */
export const TWIST_DEADZONE_DEG = 6;
/** Degrees of orbit per pixel of Option/Alt + scroll. */
export const WHEEL_TWIST_DEG_PER_PX = 0.25;
/** A ctrl+wheel this recent means the browser is reporting the pinch as
 *  wheel zoom already, so the gesture's own `scale` must not zoom again. */
export const WHEEL_PINCH_GRACE_MS = 250;

export interface TwistState {
  engaged: boolean;
  /** The gesture rotation (degrees) already applied to the camera. */
  applied: number;
}

export function startTwist(): TwistState {
  return { engaged: false, applied: 0 };
}

/** The clockwise turn (degrees) to apply for a gesture now at `rotationDeg`
 *  since it began; 0 until the dead zone is crossed. */
export function twistStep(state: TwistState, rotationDeg: number): number {
  if (!Number.isFinite(rotationDeg)) return 0;
  if (!state.engaged) {
    if (Math.abs(rotationDeg) < TWIST_DEADZONE_DEG) return 0;
    state.engaged = true;
    state.applied = rotationDeg;
    return 0;
  }
  const delta = rotationDeg - state.applied;
  state.applied = rotationDeg;
  return delta;
}

/** The clockwise turn (degrees) for an Option/Alt + scroll, or null when the
 *  wheel event is not a twist. Whichever axis moved more drives it, so a
 *  sideways or an up/down two-finger swipe both work. */
export function wheelTwistDegrees(event: { altKey: boolean; ctrlKey: boolean; deltaX: number; deltaY: number; deltaMode?: number }): number | null {
  if (!event.altKey || event.ctrlKey) return null;
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  return delta * scale * WHEEL_TWIST_DEG_PER_PX;
}

/** Camera bearing offset (degrees, wrapped to [-180, 180)) after the view
 *  turns `clockwiseDeg` on screen. The renderer rotates the world opposite
 *  to the camera, so turning the map with the fingers lowers the bearing. */
export function bearingAfterTwist(bearingDeg: number, clockwiseDeg: number): number {
  const next = bearingDeg - clockwiseDeg;
  return ((next + 180) % 360 + 360) % 360 - 180;
}
