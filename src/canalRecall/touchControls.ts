// On-screen driving controls for touch.
//
// What this replaces: an invisible scheme where the left half of the screen
// steered *and* applied throttle, the right half was gas above / brake below,
// and a double-tap on the right was the handbrake. Nothing was drawn, so the
// only way to learn it was a hint card; and because "touch anywhere on the left
// to steer" overlapped the camera-pan drag, panning the map also drove the boat.
//
// What it is now: one visible d-pad with auto-throttle. The vehicle rolls
// forward on its own, left/right steer, down brakes, and up is an explicit
// push. A single pad keeps one thumb free, keeps the middle of the screen — the
// driving corridor — clear, and gives the pan gesture somewhere unambiguous to
// live: anything outside the pad pans the camera.
//
// The pad is a 3×3 grid rather than four wedges so the corners give diagonals
// (steer while braking) and so a thumb that lands slightly off still reads as
// the direction the player meant.

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

/** Which directions a set of live touches is holding down.
 *
 *  Column/row 0 is left/up, 1 is the dead centre, 2 is right/down — so a corner
 *  touch returns two directions and the middle cell returns none. */
export function dpadKeysAt(points: readonly TouchPoint[], layout: DpadLayout | null): DpadKeys {
  const keys = noKeys();
  if (!layout) return keys;
  for (const point of points) {
    if (!isInsideDpad(point, layout)) continue;
    const column = Math.min(2, Math.max(0, Math.floor((point.x - layout.bounds.x) / layout.cell)));
    const row = Math.min(2, Math.max(0, Math.floor((point.y - layout.bounds.y) / layout.cell)));
    if (column === 0) keys.ArrowLeft = true;
    if (column === 2) keys.ArrowRight = true;
    if (row === 0) keys.ArrowUp = true;
    if (row === 2) keys.ArrowDown = true;
  }
  return keys;
}

/** The keys the car actually sees. Auto-throttle means the vehicle rolls
 *  forward unless the player is braking, so a learner can spend their whole
 *  attention on steering and on the city rather than on holding a pedal. */
export function applyAutoThrottle(keys: DpadKeys): DpadKeys {
  if (keys.ArrowDown) return keys;
  return { ...keys, ArrowUp: true };
}
