// When a landmark card opens by itself, and what it may replace.
//
// The drive-by card used to open when the vehicle came within
// `DRIVE_BY_RADIUS` of a landmark's centre. At cruising speed (up to 260 px/s)
// that radius is crossed in about a second, and the card spends most of that
// second fading in — so it arrived as the rider was passing, or already past
// (user report 2026-09-29, "this card/highlight happens a little late"). A
// street card opened at the start of the street also held the one card slot
// for eight seconds, so a landmark part-way down the block waited behind it.
//
// Now the trigger looks ahead along where the rider is going — the route line
// when they are on it, the heading otherwise — for a few seconds of travel,
// and a landmark about to be passed may replace a street card or an earlier
// drive-by card that has had a few seconds on screen. A clicked card is never
// replaced: the player asked for it.

import type { WorldPoint } from './worldTypes';
import type { NoticeHold } from './landmarkNotice';
import { nearestRouteIndex } from './routeSelection';

/** px — how close the path ahead must pass to a landmark to open its card.
 *  About 45 m: a facade on the street being ridden, or across one canal. At
 *  100 m (300 px) a card opened for Huis Bartolotti while it stood a block
 *  away behind other houses, never on screen (user report 2026-10-01). */
export const DRIVE_BY_RADIUS = 135;
/** Seconds of travel the trigger looks ahead, so the card is up and readable
 *  before the rider reaches the landmark rather than as they pass it. */
export const DRIVE_BY_LOOKAHEAD_SECONDS = 3;
/** px — the lookahead is never shorter than the radius, so a stopped or slow
 *  rider still sees what is beside them. */
export const DRIVE_BY_MIN_LOOKAHEAD = DRIVE_BY_RADIUS;
/** px — the route line is followed only while the rider is on it; off it, the
 *  heading is a better guess of where they are going. */
export const DRIVE_BY_ROUTE_TOLERANCE = 140;
/** px — a landmark this far behind the rider has been passed; a card for it now
 *  would describe something out of view. */
export const DRIVE_BY_PASSED_BEHIND = 90;
/** Seconds a street or drive-by card keeps the slot before a landmark about to
 *  be passed may take it. */
export const PREEMPT_AFTER_SECONDS = 6;
/** Seconds between drive-by cards. In the canal belt a landmark stands every
 *  few houses, and cards replacing each other every few seconds left no time
 *  to read one or to watch the road (user report 2026-10-01, "pace the rate
 *  at which we pop up those cards"). */
export const DRIVE_BY_MIN_GAP_SECONDS = 15;

export interface Rider extends WorldPoint {
  /** Radians; the direction of travel is (cos, sin). */
  angle: number;
  /** px/s; negative when reversing. */
  speed: number;
}

/** Why the current card is up. */
export type NoticeSource = 'click' | 'street' | 'drive-by' | 'arrival';

/** The polyline the rider is expected to travel next, starting at the rider. */
export function pathAhead(rider: Rider, route: readonly WorldPoint[] | null | undefined): WorldPoint[] {
  const reach = Math.max(DRIVE_BY_MIN_LOOKAHEAD, Math.abs(rider.speed) * DRIVE_BY_LOOKAHEAD_SECONDS);
  if (route && route.length >= 2) {
    const nearest = nearestRouteIndex(route, rider);
    if (nearest.distance <= DRIVE_BY_ROUTE_TOLERANCE) {
      const path: WorldPoint[] = [{ x: rider.x, y: rider.y }];
      let left = reach;
      for (let i = nearest.index + 1; i < route.length && left > 0; i++) {
        const from = path[path.length - 1];
        const step = Math.hypot(route[i].x - from.x, route[i].y - from.y);
        if (step >= left) {
          const t = left / step;
          path.push({ x: from.x + (route[i].x - from.x) * t, y: from.y + (route[i].y - from.y) * t });
          left = 0;
        } else {
          path.push({ x: route[i].x, y: route[i].y });
          left -= step;
        }
      }
      if (path.length >= 2) return path;
    }
  }
  const direction = rider.speed < 0 ? rider.angle + Math.PI : rider.angle;
  return [
    { x: rider.x, y: rider.y },
    { x: rider.x + Math.cos(direction) * reach, y: rider.y + Math.sin(direction) * reach },
  ];
}

/**
 * How far along `path` the rider will be when closest to `point`, or null when
 * the path never comes within `DRIVE_BY_RADIUS` of it or the point is already
 * behind the rider.
 */
export function approachAlong(path: readonly WorldPoint[], point: WorldPoint): number | null {
  const start = path[0];
  // Behind the rider: the first leg's direction says which way is forward.
  const lead = path[1];
  const leadLength = Math.hypot(lead.x - start.x, lead.y - start.y) || 1;
  const forward = ((point.x - start.x) * (lead.x - start.x) + (point.y - start.y) * (lead.y - start.y)) / leadLength;
  if (forward < -DRIVE_BY_PASSED_BEHIND) return null;

  let travelled = 0;
  let best: { distance: number; along: number } | null = null;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length))) : 0;
    const distance = Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y);
    if (!best || distance < best.distance) best = { distance, along: travelled + length * t };
    travelled += length;
  }
  return best && best.distance <= DRIVE_BY_RADIUS ? best.along : null;
}

/** The landmark the rider will reach first, among those the path ahead passes. */
export function pickDriveBy<T extends WorldPoint>(candidates: readonly T[], path: readonly WorldPoint[]): T | null {
  let chosen: T | null = null;
  let soonest = Infinity;
  for (const candidate of candidates) {
    const along = approachAlong(path, candidate);
    if (along !== null && along < soonest) { chosen = candidate; soonest = along; }
  }
  return chosen;
}

/** Whether a drive-by landmark may replace the card currently up. */
export function mayReplaceNotice(source: NoticeSource | null, hold: NoticeHold | null, elapsed: number): boolean {
  if (!source || !hold) return true;
  if (source === 'click' || source === 'arrival' || hold.kind === 'sticky') return false;
  return elapsed >= PREEMPT_AFTER_SECONDS;
}

/** Whether enough time has passed since the last drive-by card for another. */
export function driveByGapElapsed(lastShownAt: number | null | undefined, now: number): boolean {
  return lastShownAt == null || now - lastShownAt >= DRIVE_BY_MIN_GAP_SECONDS;
}
