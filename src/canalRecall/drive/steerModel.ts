// The vehicle's motion, as a pure fixed-step model.
//
// Why: the legacy `Car.update` integrated once per rendered frame, with `dt`
// clamped to 50 ms, and kept lateral grip as a *per-frame* retention factor
// (`latComp *= driftFactor`). A 120 Hz ProMotion phone and a 30 Hz laptop
// therefore drove different vehicles. Here every response is either a
// `1 − exp(−k·h)` ease or a rate times `h`, and `advance` splits a frame into
// equal substeps no longer than `STEP_MAX`, so paths agree across display
// rates (`steerModel.test.ts`: 30/60/120/144 Hz).
//
// Steering (`steering: 'bicycle'`, the bike and transit): the lock depends on
// speed, after slop-newyork's `controllers.js` (research note
// docs/research/slop-newyork-20261029.md §3). Full lock at parking speed;
// above it the lock shrinks so lateral acceleration stays under `cornering`,
// and a friction circle takes grip away while the rider brakes or pedals hard.
// Unlike a real bicycle the toy keeps a turn rate at a standstill
// (`restYawRate`), because a rider nosed into a kerb must be able to turn away
// without rolling forward first (`CAR_MIN_STEER_FACTOR`, keyboard-ride.spec).
//
// `steering: 'legacy'` (the boat) keeps the old turn-rate curve exactly, now
// substepped: the boat's feel is tuned and not in this lane's scope.
//
// Units are world units: px (3 px per metre), seconds, radians. The game's
// speeds are toy speeds (a bike tops out near 350 px/s, ~117 m/s), so the
// bicycle constants below are chosen in px to keep today's envelope, not
// copied from slop's metric numbers; see BIKE_TRUE_SCALE for those.
//
// `step(state, input, dt)` is the fixed-step entry a frame host calls N times
// a frame with `dtFixed`; `advance(state, input, frameDt)` is the adapter the
// legacy loop uses until engine/frameHost.ts owns the accumulator.

export const STEP_MAX = 1 / 120;
/** Substeps per frame are capped, so a long stall cannot spin forever. */
export const MAX_SUBSTEPS = 16;

export type SteeringKind = 'bicycle' | 'legacy';

export type SteerParams = {
  steering: SteeringKind;
  maxSpeed: number; // px/s
  reverseMax: number; // px/s (negative)
  accel: number; // px/s² at full throttle
  brakeForce: number; // px/s² at full brake (and reverse thrust)
  drag: number; // quadratic drag coefficient, 1/px
  rollingResist: number; // px/s²
  /** 1/s: coasting (no throttle, no brake) decays speed at this rate. */
  liftOffBraking: number;
  /** Lateral grip as the legacy per-60-fps-frame retention (0..1). */
  driftFactor: number;
  handbrakeDrift: number;
  handbrakeTurnMult: number;
  /** Legacy curve: base turn rate, rad/s. Bicycle: the cap on yaw rate. */
  turnRate: number;
  /** Legacy curve: share of the turn rate lost at top speed. */
  turnReductionAtSpeed: number;
  /** Legacy curve: speed (px/s) under which steering authority drops to the floor. */
  speedFactorDivisor: number;
  /** Legacy curve: steering authority at a standstill, 0..1. */
  minSteerFactor: number;
  /** Legacy curve: extra turn when reversing (the boat's 1.18). */
  reverseTurnMult: number;
  /** Bicycle: wheelbase, px. */
  wheelbase: number;
  /** Bicycle: parking lock, rad (slop 0.60). */
  maxLock: number;
  /** Bicycle: lateral acceleration the lock is limited to at speed, px/s². */
  cornering: number;
  /** Bicycle: friction-circle radius, px/s² (≥ cornering). */
  gripMax: number;
  /** Bicycle: how fast the steer follows the input, 1/s (slop 10). */
  steerRate: number;
  /** Bicycle: toy yaw rate at a standstill, rad/s; fades out by restFadeSpeed. */
  restYawRate: number;
  restFadeSpeed: number; // px/s
};

export type SteerInput = {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1, + is right (clockwise in screen space)
  handbrake: boolean;
  /** Surface multipliers, read once a frame by the adapter. */
  surfaceGrip: number;
  surfaceDrag: number; // px/s²
};

export type SteerState = {
  x: number;
  y: number;
  angle: number;
  speed: number; // signed, along the heading
  vx: number;
  vy: number;
  /** The steer actually applied, eased toward the input (bicycle). */
  steer: number;
  /** Yaw rate of the last substep, rad/s. */
  yawRate: number;
  /** Lateral (sideways) speed after the last substep, px/s. */
  lateral: number;
  /** Odometer, px. */
  distance: number;
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function initialSteerState(x = 0, y = 0, angle = 0): SteerState {
  return { x, y, angle, speed: 0, vx: 0, vy: 0, steer: 0, yawRate: 0, lateral: 0, distance: 0 };
}

/** The legacy toy vehicle (constants.js), before the per-mode multipliers. */
export const LEGACY_BASE: SteerParams = {
  steering: 'legacy',
  maxSpeed: 260,
  reverseMax: -30,
  accel: 120,
  brakeForce: 75,
  drag: 0.0024,
  rollingResist: 0.12,
  liftOffBraking: 0,
  driftFactor: 0.84,
  handbrakeDrift: 0.96,
  handbrakeTurnMult: 1.6,
  turnRate: 1.45,
  turnReductionAtSpeed: 0.3,
  speedFactorDivisor: 16,
  minSteerFactor: 0.7,
  reverseTurnMult: 1,
  wheelbase: 3.3,
  maxLock: 0.6,
  cornering: 500,
  gripMax: 560,
  steerRate: 10,
  restYawRate: 1.47,
  restFadeSpeed: 60,
};

/** The bike as the game sets it up (game-route.js: PLAYER_CAR_* multipliers),
 *  on the bicycle model. At top speed (351 px/s) the lock gives
 *  cornering / v ≈ 1.42 rad/s, the legacy curve's 1.47; below ~240 px/s it is
 *  the 2.1 rad/s cap, so junction turns keep today's radius. */
export const BIKE: SteerParams = {
  ...LEGACY_BASE,
  steering: 'bicycle',
  maxSpeed: 260 * 1.35,
  accel: 120 * 1.4,
  brakeForce: 75 * 5.5,
  liftOffBraking: 6.5,
  driftFactor: 0.12,
  turnRate: 1.45 * 1.45,
  restYawRate: 1.45 * 1.45 * 0.7,
};

/** slop's metric bicycle at true scale (7.5 m/s, 4.5 m/s²) in px. Not wired:
 *  at 3 px/m it is ~15× slower than the game's bike, a product call. */
export const BIKE_TRUE_SCALE: SteerParams = {
  ...BIKE,
  maxSpeed: 7.5 * 3,
  accel: 1.6 * 3,
  brakeForce: 4 * 3,
  liftOffBraking: 0.15,
  drag: 0,
  rollingResist: 0.05 * 3,
  cornering: 4.5 * 3,
  gripMax: 5 * 3,
  wheelbase: 1.1 * 3,
  turnRate: 2.2,
  restYawRate: 1.0,
  restFadeSpeed: 1.5 * 3,
};

/** Bicycle: the largest yaw rate at speed `v` (≥ 0), before the steer. */
export function bicycleYawLimit(params: SteerParams, v: number, longitudinalAccel: number): number {
  const speed = Math.abs(v);
  const turn = params.wheelbase * params.cornering;
  // slop: maxSteer = atan(turn / max(v², turn / tan maxLock)).
  const tanLock = turn / Math.max(speed * speed, turn / Math.tan(params.maxLock));
  let kinematic = (speed * tanLock) / params.wheelbase;
  // Friction circle: what braking or pedalling uses is not there for turning.
  const grip = Math.sqrt(Math.max(0, params.gripMax * params.gripMax - longitudinalAccel * longitudinalAccel));
  if (speed > 1e-6) kinematic = Math.min(kinematic, grip / speed);
  const rest = params.restYawRate * clamp(1 - speed / Math.max(1e-6, params.restFadeSpeed), 0, 1);
  return Math.min(params.turnRate, Math.max(rest, kinematic));
}

/** Legacy turn-rate curve (car.js before 2026-10-30), as a yaw limit. */
export function legacyYawLimit(params: SteerParams, v: number): number {
  const speed = Math.abs(v);
  const speedFactor = clamp(speed / params.speedFactorDivisor, params.minSteerFactor, 1);
  let turn = params.turnRate * (1 - (speed / params.maxSpeed) * params.turnReductionAtSpeed);
  if (v < 0) turn *= params.reverseTurnMult;
  return turn * speedFactor;
}

/** One fixed step of `h` seconds. Mutates and returns `state`. */
export function step(state: SteerState, input: SteerInput, h: number, params: SteerParams): SteerState {
  if (!(h > 0)) return state;
  const grip = input.surfaceGrip;
  // --- longitudinal -------------------------------------------------------
  const commanded = (input.throttle > 0 ? params.accel * input.throttle * grip : 0)
    - (input.brake > 0 ? params.brakeForce * input.brake : 0);
  // Midpoint (RK2) on the speed: the error at 144 Hz versus 120 Hz substeps
  // stays well inside the agreement test's 0.05 m/s.
  const accelAt = (v: number): number => {
    const sign = Math.sign(v || 0.001);
    return commanded - v * Math.abs(v) * params.drag - (params.rollingResist + input.surfaceDrag) * sign;
  };
  let speed = state.speed + accelAt(state.speed + accelAt(state.speed) * h * 0.5) * h;
  // Lifting off scrubs speed in proportion to it: exact, not Euler.
  if (params.liftOffBraking > 0 && input.throttle === 0 && input.brake === 0) {
    speed *= Math.exp(-params.liftOffBraking * h);
  }
  speed = clamp(speed, params.reverseMax, params.maxSpeed);

  // --- yaw ----------------------------------------------------------------
  // Second order: the steer's exact mean over the step (it eases
  // exponentially) times the yaw limit averaged over the step's two speeds.
  let meanSteer: number;
  let limit: number;
  if (params.steering === 'bicycle') {
    const kh = params.steerRate * h;
    const kept = Math.exp(-kh);
    meanSteer = input.steer + (state.steer - input.steer) * (1 - kept) / kh;
    state.steer = input.steer + (state.steer - input.steer) * kept;
    limit = 0.5 * (bicycleYawLimit(params, state.speed, commanded) + bicycleYawLimit(params, speed, commanded));
  } else {
    meanSteer = state.steer = input.steer;
    limit = 0.5 * (legacyYawLimit(params, state.speed) + legacyYawLimit(params, speed));
  }
  if (input.handbrake) limit *= params.handbrakeTurnMult;
  const yawRate = meanSteer * limit;
  const angle = state.angle + yawRate * h;

  // --- lateral slip -------------------------------------------------------
  const fx = Math.cos(angle), fy = Math.sin(angle);
  const rx = -fy, ry = fx;
  let lateral = state.vx * rx + state.vy * ry;
  // The legacy retention was per 60 fps frame; as a rate it is −60·ln(df).
  const retention = clamp(input.handbrake ? params.handbrakeDrift : params.driftFactor * grip, 1e-6, 1);
  lateral *= Math.exp(60 * Math.log(retention) * h);
  const vx = fx * speed + rx * lateral;
  const vy = fy * speed + ry * lateral;

  // Trapezoid on the position (second order, where the legacy code used
  // the end-of-step velocity alone).
  state.x += (state.vx + vx) * 0.5 * h;
  state.y += (state.vy + vy) * 0.5 * h;
  state.vx = vx;
  state.vy = vy;
  state.angle = angle;
  state.yawRate = yawRate;
  state.lateral = lateral;
  state.distance += (Math.abs(state.speed) + Math.abs(speed)) * 0.5 * h;
  state.speed = speed;
  return state;
}

/** One rendered frame: equal substeps of at most STEP_MAX. */
export function advance(state: SteerState, input: SteerInput, frameDt: number, params: SteerParams): SteerState {
  if (!(frameDt > 0)) return state;
  const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(frameDt / STEP_MAX - 1e-9)));
  const h = frameDt / n;
  for (let i = 0; i < n; i++) step(state, input, h, params);
  return state;
}

/** Slop's visual lean for a bicycle, rad (+ leans right): the steer times a
 *  speed ramp to `fullAt` px/s, times 0.34. */
export function bikeLean(steer: number, speed: number, fullAt = 27): number {
  return clamp(steer, -1, 1) * Math.min(1, Math.abs(speed) / fullAt) * 0.34;
}
