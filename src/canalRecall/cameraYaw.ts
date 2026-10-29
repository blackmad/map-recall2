// How the heading-following camera turns.
//
// The chase camera used to ease toward the vehicle's heading at ~6% a frame
// (a ~0.25 s lag), so it reproduced every steering correction, every kerb
// nudge from the road guard, and every on-the-spot pivot as a yaw of the whole
// city. Yaw the eye did not ask for is the classic trigger for motion sickness
// (user report 2026-10-29, mobile steering "kind of nauseating").
//
// Now the camera:
//   * ignores small heading changes (a dead band with hysteresis: it starts
//     turning only past FOLLOW_START, then settles fully before resting);
//   * eases more slowly; and
//   * never yaws faster than a cap, so a 180° turn-around is a steady pan
//     rather than a whip.

export type CameraYawState = {
  /** True while the camera is catching up to the heading. */
  following: boolean;
};

export type CameraYawOptions = Readonly<{
  /** Fraction of the remaining angle closed per 60 fps frame. */
  ease: number;
  /** Maximum yaw rate, rad/s. */
  maxRate: number;
  /** Start following once the heading is this far off, rad. */
  followStart: number;
  /** Stop following (rest) once within this, rad. */
  followStop: number;
}>;

export const CAMERA_YAW_DEFAULT: CameraYawOptions = {
  ease: 0.04,
  maxRate: (80 * Math.PI) / 180,
  followStart: (10 * Math.PI) / 180,
  followStop: (1 * Math.PI) / 180,
};

export const CAMERA_YAW_REDUCED_MOTION: CameraYawOptions = {
  ease: 0.025,
  maxRate: (45 * Math.PI) / 180,
  followStart: (16 * Math.PI) / 180,
  followStop: (1 * Math.PI) / 180,
};

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** The camera's rotation after `dt` seconds of following `wanted`, wrapped to
 *  (-π, π]. Mutates `state.following`. */
export function stepCameraYaw(
  current: number,
  wanted: number,
  dt: number,
  state: CameraYawState,
  options: CameraYawOptions = CAMERA_YAW_DEFAULT,
): number {
  const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 1 / 60;
  const delta = wrap(wanted - current);
  const size = Math.abs(delta);
  if (!state.following && size > options.followStart) state.following = true;
  if (state.following && size < options.followStop) state.following = false;
  if (!state.following) return current;
  const eased = delta * (1 - Math.pow(1 - options.ease, seconds * 60));
  const cap = options.maxRate * seconds;
  return wrap(current + Math.max(-cap, Math.min(cap, eased)));
}
