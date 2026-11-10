// Free Ride keeps its pins and its taps out of the waterways (lane S2, #314; user 2026-11-09: "in free ride, get
// the landmark clicks out of the waterways").
//
// A bridge's crossing centre is where the bridge way meets the canal's centreline: mid-canal, so its marker stood
// on open water (Niek Engelschmanbrug, Nieuwe-Wercksbrug at Westermarkt). The marker now stands where the bridge
// way reaches land, at the end nearer the rider. Pure: the water test is passed in (the engine's water index,
// built from water.json), so this is tested on its own (`freeRideWater.test.ts`).

import type { WorldPoint } from './worldTypes';

/** A bridge way vertex this far (world px) from the crossing still belongs to that crossing's deck. */
export const DECK_VERTEX_REACH_PX = 60 * 3;
/** How far past a bridge way's end (world px) to look for the quay when the end itself tests as water. */
export const DECK_LAND_SEARCH_PX = 12 * 3;
const DECK_LAND_STEP_PX = 2 * 3;

export type IsWater = (x: number, y: number) => boolean;

/**
 * Points of a bridge's deck that may carry its marker: the bridge ways' vertices near the crossing, and for each
 * way end a few points past it along the way's own direction to the first land point (an end mapped a metre into the canal polygon still
 * finds its quay).
 */
export function deckPoints(
  lines: readonly (readonly WorldPoint[])[],
  crossing: WorldPoint,
  isWater: IsWater = () => false,
  reachPx = DECK_VERTEX_REACH_PX,
): WorldPoint[] {
  const out: WorldPoint[] = [];
  const near = (p: WorldPoint) => Math.hypot(p.x - crossing.x, p.y - crossing.y) <= reachPx;
  for (const line of lines) {
    if (!line || line.length < 2 || !line.some(near)) continue;
    for (const p of line) if (near(p)) out.push({ x: p.x, y: p.y });
    for (const [end, prev] of [[line[0], line[1]], [line[line.length - 1], line[line.length - 2]]] as const) {
      const dx = end.x - prev.x, dy = end.y - prev.y, len = Math.hypot(dx, dy);
      if (!len || !near(end) || !isWater(end.x, end.y)) continue;
      for (let d = DECK_LAND_STEP_PX; d <= DECK_LAND_SEARCH_PX; d += DECK_LAND_STEP_PX) {
        const p = { x: end.x + dx / len * d, y: end.y + dy / len * d };
        if (!isWater(p.x, p.y)) { out.push(p); break; }
      }
    }
  }
  return out;
}

/**
 * A marker's anchor dot must sit clearly on land, not on the waterline: the drawn dot is the ground point
 * projected to the screen, and a tap or a re-projection a metre off (the engine's ground height at a quay,
 * Blauwbrug 2026-11-10: a deck corner on the polygon edge unprojected 5 px into the Amstel) lands in the water.
 * A point counts as land only when it and eight points `LAND_MARGIN_PX` around it are all off the water.
 */
export const LAND_MARGIN_PX = 3 * 3;

/** `isWater` widened by `marginPx`: water within the margin counts as water. */
export function withLandMargin(isWater: IsWater, marginPx = LAND_MARGIN_PX): IsWater {
  return (x, y) => {
    if (isWater(x, y)) return true;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      if (isWater(x + Math.cos(a) * marginPx, y + Math.sin(a) * marginPx)) return true;
    }
    return false;
  };
}

/** How far (world px) a bridge marker may move from its deck point to land clear of the waterline. */
export const DECK_SETTLE_PX = 12 * 3;

/**
 * Where a bridge marker stands: on land clear of the waterline (`LAND_MARGIN_PX`), at the deck point nearest the
 * rider, settled inland from it when it sits on the quay edge; null when no deck point reaches land (no marker
 * then: a pin on open water is the thing being removed). Without a water test the crossing itself is kept.
 */
export function bridgeMarkerAnchor(
  lines: readonly (readonly WorldPoint[])[],
  crossing: WorldPoint,
  rider: WorldPoint,
  isWater: IsWater | null,
): WorldPoint | null {
  if (!isWater) return { x: crossing.x, y: crossing.y };
  const solid = withLandMargin(isWater);
  if (!solid(crossing.x, crossing.y)) return { x: crossing.x, y: crossing.y };
  const deck = deckPoints(lines, crossing, isWater)
    .filter(p => !isWater(p.x, p.y))
    .sort((a, b) => Math.hypot(a.x - rider.x, a.y - rider.y) - Math.hypot(b.x - rider.x, b.y - rider.y));
  for (const p of deck) {
    const at = landAnchor(p, isWater, DECK_SETTLE_PX);
    if (at) return at;
  }
  return null;
}

/** How far (world px) a landmark marker may move off open water to its quay or building (Westertoren's point
 *  lies in the Prinsengracht, 2026-11-09 measurement). */
export const LAND_SEARCH_PX = 40 * 3;
const LAND_RING_STEP_PX = 3 * 3;

/**
 * A landmark marker's anchor: its own point when that is on land clear of the waterline, else the nearest such
 * point within `maxPx` (rings of 16 bearings), else null: no pin on open water.
 */
export function landAnchor(point: WorldPoint, isWater: IsWater | null, maxPx = LAND_SEARCH_PX): WorldPoint | null {
  if (!isWater) return { x: point.x, y: point.y };
  const solid = withLandMargin(isWater);
  if (!solid(point.x, point.y)) return { x: point.x, y: point.y };
  for (let r = LAND_RING_STEP_PX; r <= maxPx; r += LAND_RING_STEP_PX) {
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const p = { x: point.x + Math.cos(a) * r, y: point.y + Math.sin(a) * r };
      if (!solid(p.x, p.y)) return p;
    }
  }
  return null;
}

/**
 * A Free Ride tap on open water opens nothing but a pill (lane S2): the tap is on water when the ground under it is
 * water and no building, model or label stands in front of it. `surfaceHit` is the pick under the pixel (labels
 * included), `groundWater` the water test of the ground point.
 */
export function tapOnOpenWater(surfaceHit: unknown, groundWater: boolean): boolean {
  return !surfaceHit && groundWater;
}

/**
 * Whether a Free Ride tap that hit no pill, building or label may name the way under it (ruling 2026-11-09 on
 * #314): a boat names its canal only from a tap on open water, the water's own story card, never from a quay or a
 * facade beside it; a bike names a street only from a tap off the water.
 */
export function freeRideWayTapAllowed(onWater: boolean, boat: boolean): boolean {
  return boat ? onWater : !onWater;
}

/** How far (world px) a landmark pin standing inside a building footprint may move to open ground (S5, #333). */
export const FACADE_NUDGE_PX = 15 * 3;

/**
 * A landmark pin whose own point falls inside a building's footprint moves to the nearest open ground (off the
 * footprint, clear of the waterline) within `maxPx`, rings of 16 bearings. A pin on a building bigger than the
 * reach (a museum block) keeps its point: the pin is the building. `moved` tells the caller which case it was.
 */
export function facadeNudge(
  point: WorldPoint, isWater: IsWater | null, inBuilding: IsWater | null, maxPx = FACADE_NUDGE_PX,
): { point: WorldPoint; inside: boolean; moved: boolean } {
  if (!inBuilding || !inBuilding(point.x, point.y)) return { point, inside: false, moved: false };
  const solid = isWater ? withLandMargin(isWater) : () => false;
  for (let r = LAND_RING_STEP_PX; r <= maxPx; r += LAND_RING_STEP_PX) {
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      const p = { x: point.x + Math.cos(a) * r, y: point.y + Math.sin(a) * r };
      if (!inBuilding(p.x, p.y) && !solid(p.x, p.y)) return { point: p, inside: true, moved: true };
    }
  }
  return { point, inside: true, moved: false };
}
