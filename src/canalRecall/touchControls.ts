// On-screen driving controls for touch.
//
// What this replaces: an invisible scheme where the left half of the screen
// steered *and* applied throttle, the right half was gas above / brake below,
// and a double-tap on the right was the handbrake. Nothing was drawn, so the
// only way to learn it was a hint card; and because "touch anywhere on the left
// to steer" overlapped the camera-pan drag, panning the map also drove the boat.
//
// What it is now: one visible control zone (still called the "d-pad" in the
// layout code, since the HUD budgets around its rectangle) that hosts an analog
// thumbstick — see below. One zone keeps a thumb free, keeps the middle of the
// screen — the driving corridor — clear, and gives the pan gesture somewhere
// unambiguous to live: a touch that starts outside the zone pans the camera.

import type { Viewport } from './viewport.ts';
import { HUD_MAX_WIDTH_COMPACT, HUD_MAX_WIDTH_DESKTOP } from './viewport.ts';

export type DpadRect = { x: number; y: number; width: number; height: number };

export type DpadLayout = {
  /** The pad's bounding square, in logical canvas units. */
  bounds: DpadRect;
  /** Centre of the pad. */
  cx: number;
  cy: number;
  /** Width/height of one of the nine cells. */
  cell: number;
};

export type DirectionKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
export type DpadKeys = Record<DirectionKey, boolean>;

export type TouchPoint = { x: number; y: number };

const PAD_FRACTION = 0.42;
const PAD_MIN = 132;
const PAD_MAX = 190;
const PAD_MARGIN = 16;

type Band = { x: number; width: number; height: number };

function chromeBand(viewport: Viewport): Band {
  const maxWidth = viewport.mode === 'compact' ? HUD_MAX_WIDTH_COMPACT : HUD_MAX_WIDTH_DESKTOP;
  const width = Math.min(viewport.width, maxWidth);
  return {
    x: Math.round((viewport.width - width) / 2),
    width,
    height: viewport.height,
  };
}

/** No pad on a mouse-driven desktop: it would only cover the map. */
export function dpadLayout(viewport: Viewport, band: Band = chromeBand(viewport)): DpadLayout | null {
  if (!viewport.touch || viewport.mode !== 'compact') return null;
  const size = Math.round(
    Math.min(PAD_MAX, Math.max(PAD_MIN, Math.min(band.width, band.height) * PAD_FRACTION)),
  );
  // Portrait is held one-handed, so the pad sits under the thumb in the middle
  // of the chrome band. Landscape is held with two hands at the edges of that
  // band — not the monitor bezels on a wide window.
  const cx = viewport.orientation === 'portrait'
    ? Math.round(band.x + band.width / 2)
    : Math.round(band.x + PAD_MARGIN + size / 2);
  const cy = Math.round(band.height - viewport.safeBottom - PAD_MARGIN - size / 2);
  return {
    bounds: { x: cx - size / 2, y: cy - size / 2, width: size, height: size },
    cx,
    cy,
    cell: size / 3,
  };
}

export function noKeys(): DpadKeys {
  return { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
}

export function isInsideDpad(point: TouchPoint, layout: DpadLayout | null): boolean {
  if (!layout) return false;
  const { x, y, width, height } = layout.bounds;
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

// ---------------------------------------------------------------------------
// Analog thumbstick.
//
// The d-pad above was binary and had three faults that together made phones
// feel undriveable:
//   * auto-throttle held ArrowUp, so in absolute mode "right" was really
//     right+up and resolved to north-east — due east/west was unreachable;
//   * absolute headings were world compass angles while the default camera
//     turns with the vehicle, so "right" on the pad was not right on screen;
//   * a thumb that slid off the 160px pad dropped every key mid-turn.
//
// The stick keeps the pad's rectangle as its *activation zone* (so the HUD
// layout budget is unchanged), floats its origin under wherever the thumb
// lands, and keeps the touch captured until it lifts. Directions are screen
// directions; the player converts them to world angles through the camera.
// ---------------------------------------------------------------------------

/** Fraction of full deflection ignored around the origin. */
export const STICK_DEAD_ZONE = 0.18;
/** Relative mode cruises below top speed so junction turns are makeable. */
export const STICK_CRUISE_FRACTION = 0.62;
/** Absolute mode: how fast the heading swings to the pointed direction. */
export const ABSOLUTE_TURN_RATE = 5.5; // rad/s
/** Absolute mode: follow the road when the pointed direction is this close. */
export const ROAD_ASSIST_TOLERANCE = (55 * Math.PI) / 180;

export type StickVector = {
  /** Screen-space deflection after the dead zone, each in -1..1. */
  x: number;
  y: number;
  /** 0..1 after the dead zone. */
  magnitude: number;
  /** Screen angle of the deflection: 0 is right, +π/2 is down. */
  screenAngle: number;
};

export type StickView = {
  origin: TouchPoint;
  point: TouchPoint;
  radius: number;
  vector: StickVector | null;
};

/** Thumb travel for full deflection, sized from the zone. */
export function stickRadius(layout: DpadLayout): number {
  return Math.round(Math.min(64, Math.max(46, layout.bounds.width * 0.34)));
}

/** Deflection of a captured thumb, or null inside the dead zone. The point may
 *  be anywhere on screen: past the rim it simply reads as full deflection. */
export function stickVector(origin: TouchPoint, point: TouchPoint, radius: number): StickVector | null {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const raw = Math.min(1, Math.hypot(dx, dy) / Math.max(1, radius));
  if (raw <= STICK_DEAD_ZONE) return null;
  const magnitude = (raw - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
  const screenAngle = Math.atan2(dy, dx);
  return { x: Math.cos(screenAngle) * magnitude, y: Math.sin(screenAngle) * magnitude, magnitude, screenAngle };
}

export type RelativeCommand = {
  /** Analog steer, -1 (left) .. 1 (right). */
  steer: number;
  /** 0..1 brake. */
  brake: number;
  /** Target speed as a fraction of max speed (0 while braking). */
  speedFraction: number;
  /** Pulled straight back hard: brake, and once slow, turn round. */
  turnAround: boolean;
};

/** A hard turn slows to this fraction of the cruise, like a cyclist turning
 *  in a narrow street. At cruise speed a full-lock turn reached the kerb before
 *  it passed 90°, and the road guard eased it straight again. */
export const HARD_TURN_SPEED_SCALE = 0.3;
/** Below this speed (px/s) a held "turn around" swings the bike 180°. */
export const TURN_AROUND_MAX_SPEED = 30;
/** How quickly the bike swings round on the spot, rad/s (~0.6 s for 180°). */
export const TURN_AROUND_RATE = 5.5;

/** Absolute mode: slow down while the heading is far from where the stick
 *  points, so turning back along the street happens in place rather than as
 *  a wide arc into the kerb. 1 when aligned, down to 0.15 past 100°. */
export function alignmentSpeedScale(headingError: number): number {
  const error = Math.abs(normalizeAngle(headingError));
  const from = (45 * Math.PI) / 180;
  const to = (100 * Math.PI) / 180;
  if (error <= from) return 1;
  if (error >= to) return 0.15;
  return 1 - 0.85 * ((error - from) / (to - from));
}

/** The heading a turn-around swings to: straight back, snapped onto the
 *  street when there is one. */
export function turnAroundHeading(angle: number, roadAngle: number | null | undefined): number {
  return assistedHeading(normalizeAngle(angle + Math.PI), roadAngle);
}

/** Relative (car-style) steering from a held stick. Holding the stick at all
 *  means "drive": it cruises, sideways steers in proportion, pulling back
 *  brakes, pushing forward runs at full speed. */
export function relativeCommand(vector: StickVector | null): RelativeCommand {
  if (!vector) return { steer: 0, brake: 0, speedFraction: STICK_CRUISE_FRACTION, turnAround: false };
  // A gentle curve: small deflections make fine corrections, the rim is full lock.
  const steer = Math.sign(vector.x) * Math.min(1, Math.abs(vector.x) ** 0.8 * 1.15);
  const back = vector.y;
  if (back > 0.45 && back > Math.abs(vector.x) * 0.8) {
    // Straight back and hard is "turn round", not reverse: a bike does not
    // back down a street, and reversing in circles was all it used to do.
    const turnAround = back > 0.75 && Math.abs(vector.x) < 0.45;
    return { steer: turnAround ? 0 : steer, brake: Math.min(1, (back - 0.45) / 0.35), speedFraction: 0, turnAround };
  }
  const forward = Math.max(0, -vector.y);
  let speedFraction = STICK_CRUISE_FRACTION + (1 - STICK_CRUISE_FRACTION) * Math.min(1, forward / 0.8);
  // Ease off as the turn tightens: full speed to half lock, a crawl at full lock.
  const lock = Math.max(0, (Math.abs(steer) - 0.5) / 0.5);
  speedFraction *= 1 - (1 - HARD_TURN_SPEED_SCALE) * lock;
  return { steer, brake: 0, speedFraction, turnAround: false };
}

export type AbsoluteCommand = {
  /** World heading to steer toward. */
  targetAngle: number;
  /** Target speed as a fraction of max speed. */
  speedFraction: number;
};

/** A screen direction converted into a world heading. `cameraRotation` is the
 *  rotation the camera applies (world = screen rotated by it), so pointing
 *  right means screen-right whether the map is north-up or turned. */
export function screenToWorldAngle(screenAngle: number, cameraRotation: number): number {
  return normalizeAngle(screenAngle + cameraRotation);
}

export function absoluteCommand(vector: StickVector | null, cameraRotation: number): AbsoluteCommand | null {
  if (!vector) return null;
  return {
    targetAngle: screenToWorldAngle(vector.screenAngle, cameraRotation),
    speedFraction: 0.35 + 0.65 * vector.magnitude,
  };
}

/** Keyboard arrows in absolute mode, as a screen angle. Null when nothing (or
 *  two cancelling keys) is held. Pure horizontal is exactly 0 or π. */
export function keysScreenAngle(keys: DpadKeys): number | null {
  const horizontal = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const vertical = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
  if (!horizontal && !vertical) return null;
  return Math.atan2(vertical, horizontal);
}

/** Pick the heading to actually drive: the road/canal tangent nearest to the
 *  pointed direction when it is within tolerance, else the pointed direction.
 *  So "push east" on a street running east-north-east follows the street
 *  instead of steering into the kerb. */
export function assistedHeading(
  targetAngle: number,
  roadAngle: number | null | undefined,
  tolerance: number = ROAD_ASSIST_TOLERANCE,
): number {
  if (roadAngle == null || !Number.isFinite(roadAngle)) return targetAngle;
  const forward = normalizeAngle(roadAngle - targetAngle);
  const backward = normalizeAngle(roadAngle + Math.PI - targetAngle);
  const delta = Math.abs(forward) <= Math.abs(backward) ? forward : backward;
  return Math.abs(delta) <= tolerance ? normalizeAngle(targetAngle + delta) : targetAngle;
}

/** Swing `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

/** Throttle that holds a target speed without the lift-off braking a bang-bang
 *  controller would trigger every other frame. */
export function cruiseThrottle(speed: number, targetSpeed: number, maxSpeed: number): number {
  if (targetSpeed <= 0) return 0;
  const band = Math.max(1, maxSpeed * 0.12);
  return Math.max(0.05, Math.min(1, (targetSpeed - speed) / band + 0.35));
}

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
