// Where the follow camera's centre sits relative to the vehicle.
//
// The camera used to ease its *world position* toward a point ahead of the
// vehicle. A world-space follower trails a moving target by speed / rate (at
// the bike's top speed ~80 px behind), and that lag changes with every uneven
// frame time, so the view surged forward and back (slop-newyork
// `js/cameras.js:333-352` smooths the offset relative to the entity for this
// reason; research note slop-newyork-20261029.md §3).
//
// Here the camera centre is the vehicle plus an *offset*, and only the offset
// is eased, in the frame of the view: the lead points along the view's own
// forward direction, which cameraYaw.ts already dead-bands and rate-caps. So
// the vehicle holds its place on screen, nothing trails by speed, and the
// view yaws no faster than before (the 80°/s cap is untouched). In north-up
// and held views the lead points along the heading, eased the same way.
//
// Speed adds a look-ahead and an optional pull-back (a zoom-out), both eased
// slowly so throttle changes do not pump the view.

export type CameraFollowOptions = Readonly<{
  /** Extra lead at top speed, px. */
  lookahead: number;
  /** 1/s: how fast the lead's length follows speed. */
  lookaheadRate: number;
  /** 1/s: how fast the offset's direction settles in a north-up/held view. */
  offsetRate: number;
  /** Zoom-out at top speed as a fraction of the distance (0.1 = 10 % wider). */
  pullBack: number;
  /** 1/s: how fast the pull-back follows speed. */
  pullBackRate: number;
}>;

export type CameraFollowState = {
  /** Current speed look-ahead (eased), px, on top of the view's fixed lead. */
  lookahead: number;
  /** Current offset in world px (camera centre − vehicle). */
  ox: number;
  oy: number;
  /** Current pull-back, 0..options.pullBack. */
  pullBack: number;
};

export function initialCameraFollow(): CameraFollowState {
  return { lookahead: 0, ox: 0, oy: 0, pullBack: 0 };
}

export type FollowTarget = Readonly<{ x: number; y: number; angle: number; speed: number; maxSpeed: number }>;

/**
 * One frame. `fixedLead` is the view mode's constant lead (chase/cockpit);
 * `forward` is the direction the lead points, rad in world space: the view's
 * forward (camera rotation − π/2) for a heading-following view, the vehicle
 * heading otherwise. Returns the camera centre; mutates `state`.
 */
export function stepCameraFollow(
  state: CameraFollowState,
  target: FollowTarget,
  fixedLead: number,
  forward: number,
  dt: number,
  options: CameraFollowOptions,
  followsView: boolean,
  reducedMotion = false,
): { x: number; y: number } {
  const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 1) : 1 / 60;
  const ease = (rate: number): number => 1 - Math.exp(-rate * seconds);
  const ratio = target.maxSpeed > 0 ? Math.min(1, Math.max(0, Math.abs(target.speed) / target.maxSpeed)) : 0;
  const wantedLookahead = reducedMotion ? 0 : options.lookahead * ratio;
  state.lookahead += (wantedLookahead - state.lookahead) * ease(options.lookaheadRate);
  const lead = fixedLead + state.lookahead;
  const wx = Math.cos(forward) * lead;
  const wy = Math.sin(forward) * lead;
  if (followsView) {
    // Rigid in the view's frame: the view's yaw is already smoothed.
    state.ox = wx;
    state.oy = wy;
  } else {
    const k = ease(options.offsetRate);
    state.ox += (wx - state.ox) * k;
    state.oy += (wy - state.oy) * k;
  }
  const wantedPull = reducedMotion ? 0 : options.pullBack * ratio;
  state.pullBack += (wantedPull - state.pullBack) * ease(options.pullBackRate);
  return { x: target.x + state.ox, y: target.y + state.oy };
}

/** The camera zoom multiplier for the current pull-back (≤ 1). */
export function pullBackZoomScale(state: CameraFollowState): number {
  return 1 / (1 + Math.max(0, state.pullBack));
}
