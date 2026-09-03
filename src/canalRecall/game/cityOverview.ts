// The city overview map: where you are in Amsterdam, not which block you are on.
//
// The old minimap showed about 450 m of road, centred on the vehicle, with
// canals and streets drawn as the same thin white line. At that scale every
// part of Amsterdam looks like every other part, which is the opposite of what
// a geography game's map is for. This one is fixed to the whole city, so the
// shape you are looking at is the shape you are learning.
//
// It draws no names. The street or canal under question must never be revealed
// by the HUD or map before it has been answered, and a labelled overview would
// do exactly that.

import type { WorldPoint } from './worldTypes';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** World -> overview pixels. Uniform scale, so the city keeps its shape. */
export interface Projection {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function project(projection: Projection, point: WorldPoint): WorldPoint {
  return {
    x: point.x * projection.scale + projection.offsetX,
    y: point.y * projection.scale + projection.offsetY,
  };
}

/** `null` when there is nothing to bound, which is not the same as a zero-size
 *  box and must not be silently treated as one. */
export function boundsOf(pointGroups: Iterable<readonly WorldPoint[]>): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let seen = false;
  for (const group of pointGroups) {
    for (const point of group) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      seen = true;
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return seen ? { minX, minY, maxX, maxY } : null;
}

export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * Fit `bounds` inside `rect` with uniform scale and centring.
 *
 * Uniform matters more here than filling the box: Amsterdam stretched to a
 * 180×140 rectangle is not a map of Amsterdam, and the canal ring is only
 * recognisable while it is still round.
 */
export function fitProjection(bounds: Bounds, rect: Rect, padding = 6): Projection {
  const usableWidth = Math.max(1, rect.width - padding * 2);
  const usableHeight = Math.max(1, rect.height - padding * 2);
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  // A single point, or a perfectly straight line of them, has no extent on one
  // axis; fall back to a scale that puts it in the middle rather than dividing
  // by zero and projecting everything to NaN.
  const scale = spanX <= 0 && spanY <= 0
    ? 1
    : Math.min(spanX > 0 ? usableWidth / spanX : Infinity, spanY > 0 ? usableHeight / spanY : Infinity);
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    offsetX: rect.x + rect.width / 2 - centreX * scale,
    offsetY: rect.y + rect.height / 2 - centreY * scale,
  };
}

/**
 * Drop points that would land on the same overview pixel.
 *
 * The whole loaded network is tens of thousands of vertices; at city scale most
 * of them are sub-pixel. Thinning first is what makes drawing the static layer
 * affordable at all, and it is lossless at the resolution being drawn.
 */
export function simplifyForScale(
  points: readonly WorldPoint[],
  scale: number,
  minPixels = 1,
): WorldPoint[] {
  if (points.length <= 2) return [...points];
  const minWorld = minPixels / (scale || 1);
  const kept: WorldPoint[] = [points[0]];
  let last = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    if (Math.hypot(point.x - last.x, point.y - last.y) >= minWorld) {
      kept.push(point);
      last = point;
    }
  }
  kept.push(points[points.length - 1]);
  return kept;
}

/** Everything the overview draws that does not move during a route. */
export interface OverviewStaticLayers {
  /** Neighborhood outlines: the city's structure, and the only thing that makes
   *  a 260 px map of Amsterdam recognisable as Amsterdam. */
  areas: WorldPoint[][];
  /** The loaded network — canals by boat, streets by car. */
  network: WorldPoint[][];
  /** The planned route, start to finish. */
  route: WorldPoint[];
  start: WorldPoint | null;
  finish: WorldPoint | null;
}

export interface OverviewSources {
  areaRings: readonly (readonly WorldPoint[])[];
  networkSegments: readonly (readonly WorldPoint[])[];
  route: readonly WorldPoint[];
  start: WorldPoint | null;
  finish: WorldPoint | null;
}

/**
 * Choose the framing and thin the geometry for it, once per route.
 *
 * Framed on the city's areas rather than on the route, so that the same place
 * sits in the same spot on every trip — which is what lets the map become
 * something the player knows rather than something they re-read each time. The
 * route and its endpoints are unioned in so a trip that runs past the mapped
 * areas cannot fall off the edge.
 */
export function buildOverview(
  sources: OverviewSources,
  rect: Rect,
  padding = 6,
): { projection: Projection; layers: OverviewStaticLayers } | null {
  const endpoints = [sources.start, sources.finish].filter((p): p is WorldPoint => !!p);
  const bounds = unionBounds(
    boundsOf(sources.areaRings),
    boundsOf([sources.route, endpoints]),
  );
  if (!bounds) return null;
  const projection = fitProjection(bounds, rect, padding);
  return {
    projection,
    layers: {
      areas: sources.areaRings.map(ring => simplifyForScale(ring, projection.scale)),
      network: sources.networkSegments
        .map(segment => simplifyForScale(segment, projection.scale))
        .filter(segment => segment.length >= 2),
      route: simplifyForScale(sources.route, projection.scale),
      start: sources.start,
      finish: sources.finish,
    },
  };
}

// ---- Drawing ----

export interface OverviewColors {
  background: string;
  border: string;
  area: string;
  network: string;
  route: string;
  start: string;
  finish: string;
  player: string;
  playerRing: string;
}

// A paper map sheet, like every other card. This was a dark navy panel with
// sky-blue canals and a gold route, which read as a different product sitting
// in the corner of the one you were playing. The route stays the strongest mark
// on it, because "where am I going" is what the overview is for.
export const OVERVIEW_COLORS: OverviewColors = {
  background: 'rgba(255,253,248,0.94)',
  border: 'rgba(97,89,74,0.30)',
  area: 'rgba(53,102,83,0.13)',
  network: 'rgba(36,50,43,0.16)',
  route: '#c75f43',
  start: '#356653',
  finish: '#c75f43',
  player: '#24322b',
  playerRing: 'rgba(255,253,248,0.92)',
};

function strokePath(
  ctx: CanvasRenderingContext2D,
  points: readonly WorldPoint[],
  projection: Projection,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  const first = project(projection, points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const point = project(projection, points[i]);
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

/** The static half: areas, network and route. Cheap enough to render into an
 *  offscreen canvas once per route and blit thereafter. */
export function drawOverviewStatic(
  ctx: CanvasRenderingContext2D,
  layers: OverviewStaticLayers,
  projection: Projection,
  colors: OverviewColors = OVERVIEW_COLORS,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = colors.network;
  ctx.lineWidth = 0.6;
  for (const segment of layers.network) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.area;
  ctx.lineWidth = 0.8;
  for (const ring of layers.areas) strokePath(ctx, ring, projection);

  ctx.strokeStyle = colors.route;
  ctx.lineWidth = 2;
  strokePath(ctx, layers.route, projection);
  ctx.restore();
}

export interface OverviewVehicle extends WorldPoint {
  /** Radians, screen convention: 0 points along +x. */
  angle: number;
}

/** The moving half: endpoints and the vehicle, drawn every frame. */
export function drawOverviewDynamic(
  ctx: CanvasRenderingContext2D,
  layers: Pick<OverviewStaticLayers, 'start' | 'finish'>,
  vehicle: OverviewVehicle | null,
  projection: Projection,
  colors: OverviewColors = OVERVIEW_COLORS,
): void {
  ctx.save();
  for (const [point, color, radius] of [
    [layers.start, colors.start, 3] as const,
    [layers.finish, colors.finish, 4] as const,
  ]) {
    if (!point) continue;
    const at = project(projection, point);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (vehicle) {
    const at = project(projection, vehicle);
    // A heading cone rather than a bare dot: on a city-scale map "which way am
    // I pointing" is most of the orientation problem.
    const spread = 0.45, length = 9;
    ctx.fillStyle = colors.player;
    ctx.strokeStyle = colors.playerRing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(at.x + Math.cos(vehicle.angle) * length, at.y + Math.sin(vehicle.angle) * length);
    ctx.lineTo(at.x + Math.cos(vehicle.angle + Math.PI - spread) * 5,
      at.y + Math.sin(vehicle.angle + Math.PI - spread) * 5);
    ctx.lineTo(at.x + Math.cos(vehicle.angle + Math.PI + spread) * 5,
      at.y + Math.sin(vehicle.angle + Math.PI + spread) * 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
