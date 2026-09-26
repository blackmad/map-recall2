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
 *
 * `zoom` > 1 tightens the framing after the fit (cropping a little rim) so the
 * overview can sit a notch closer without losing the city's shape.
 */
export function fitProjection(
  bounds: Bounds,
  rect: Rect,
  padding = 6,
  zoom = 1,
): Projection {
  const usableWidth = Math.max(1, rect.width - padding * 2);
  const usableHeight = Math.max(1, rect.height - padding * 2);
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  // A single point, or a perfectly straight line of them, has no extent on one
  // axis; fall back to a scale that puts it in the middle rather than dividing
  // by zero and projecting everything to NaN.
  const fitted = spanX <= 0 && spanY <= 0
    ? 1
    : Math.min(spanX > 0 ? usableWidth / spanX : Infinity, spanY > 0 ? usableHeight / spanY : Infinity);
  const scale = fitted * Math.max(0.01, zoom);
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
  /** Unpractised fog — streets and other land corridors. */
  network: WorldPoint[][];
  /** Unpractised fog — canals / rivers when present on the track. */
  waterNetwork: WorldPoint[][];
  /** Early practice (mastery mid band). */
  learningNetwork: WorldPoint[][];
  learningWater: WorldPoint[][];
  /** Comfortable recall. */
  knownNetwork: WorldPoint[][];
  knownWater: WorldPoint[][];
  /** Strong mastery. */
  masteredNetwork: WorldPoint[][];
  masteredWater: WorldPoint[][];
  /** Practised places whose spaced-review interval has elapsed. */
  reviewDueNetwork: WorldPoint[][];
  reviewDueWater: WorldPoint[][];
  /** The planned route, start to finish. */
  route: WorldPoint[];
  start: WorldPoint | null;
  finish: WorldPoint | null;
}

export interface OverviewSources {
  areaRings: readonly (readonly WorldPoint[])[];
  networkSegments: readonly (readonly WorldPoint[])[];
  waterNetworkSegments?: readonly (readonly WorldPoint[])[];
  learningNetworkSegments?: readonly (readonly WorldPoint[])[];
  learningWaterSegments?: readonly (readonly WorldPoint[])[];
  knownNetworkSegments?: readonly (readonly WorldPoint[])[];
  knownWaterSegments?: readonly (readonly WorldPoint[])[];
  masteredNetworkSegments?: readonly (readonly WorldPoint[])[];
  masteredWaterSegments?: readonly (readonly WorldPoint[])[];
  reviewDueNetworkSegments?: readonly (readonly WorldPoint[])[];
  reviewDueWaterSegments?: readonly (readonly WorldPoint[])[];
  route: readonly WorldPoint[];
  start: WorldPoint | null;
  finish: WorldPoint | null;
}

/** Mastery bands for the knowledge tint (still unnamed — no quiz leak). */
export const OVERVIEW_MASTERY_LEARNING = 0.25;
export const OVERVIEW_MASTERY_KNOWN = 0.45;
export const OVERVIEW_MASTERY_MASTERED = 0.75;

export function isWaterSegmentType(type: string | null | undefined): boolean {
  const t = String(type || '').toLowerCase();
  return t === 'canal' || t === 'river' || t === 'dock' || t === 'stream' || t === 'drain';
}

export type OverviewMasteryBand = 'fog' | 'learning' | 'known' | 'mastered';

export function overviewMasteryBand(mastery: number): OverviewMasteryBand {
  if (mastery >= OVERVIEW_MASTERY_MASTERED) return 'mastered';
  if (mastery >= OVERVIEW_MASTERY_KNOWN) return 'known';
  if (mastery >= OVERVIEW_MASTERY_LEARNING) return 'learning';
  return 'fog';
}

/**
 * Choose the framing and thin the geometry for it, once per route.
 *
 * Framed on the city's areas rather than on the route, so that the same place
 * sits in the same spot on every trip — which is what lets the map become
 * something the player knows rather than something they re-read each time. The
 * route and its endpoints are unioned in so a trip that runs past the mapped
 * areas cannot fall off the edge.
 *
 * `OVERVIEW_ZOOM` pulls in from a pure fit-to-city framing: the canal ring
 * stays readable and the player mark is easier to find in the 260×200 box.
 * 1.35 crops a bit more empty rim than the original 1.18 notch.
 */
export const OVERVIEW_ZOOM = 1.35;

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
  const projection = fitProjection(bounds, rect, padding, OVERVIEW_ZOOM);
  const thin = (segments: readonly (readonly WorldPoint[])[] | undefined) =>
    (segments || [])
      .map(segment => simplifyForScale(segment, projection.scale))
      .filter(segment => segment.length >= 2);

  return {
    projection,
    layers: {
      areas: sources.areaRings.map(ring => simplifyForScale(ring, projection.scale)),
      network: thin(sources.networkSegments),
      waterNetwork: thin(sources.waterNetworkSegments),
      learningNetwork: thin(sources.learningNetworkSegments),
      learningWater: thin(sources.learningWaterSegments),
      knownNetwork: thin(sources.knownNetworkSegments),
      knownWater: thin(sources.knownWaterSegments),
      masteredNetwork: thin(sources.masteredNetworkSegments),
      masteredWater: thin(sources.masteredWaterSegments),
      reviewDueNetwork: thin(sources.reviewDueNetworkSegments),
      reviewDueWater: thin(sources.reviewDueWaterSegments),
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
  waterNetwork: string;
  learningNetwork: string;
  learningWater: string;
  knownNetwork: string;
  knownWater: string;
  masteredNetwork: string;
  masteredWater: string;
  reviewDueNetwork: string;
  reviewDueWater: string;
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
// Knowledge tints: land stays green-olive; waterways use cool blue so canal
// practice does not read as the same ink as streets.
export const OVERVIEW_COLORS: OverviewColors = {
  background: 'rgba(255,253,248,0.94)',
  border: 'rgba(97,89,74,0.30)',
  area: 'rgba(53,102,83,0.13)',
  network: 'rgba(36,50,43,0.16)',
  waterNetwork: 'rgba(8,90,130,0.14)',
  learningNetwork: 'rgba(53,102,83,0.32)',
  learningWater: 'rgba(20,110,150,0.34)',
  knownNetwork: 'rgba(53,102,83,0.55)',
  knownWater: 'rgba(15,100,140,0.55)',
  masteredNetwork: 'rgba(28,82,58,0.82)',
  masteredWater: 'rgba(8,78,120,0.78)',
  // Warm copper — distinct from green mastery and blue waterways so “due for
  // review” reads at a glance on the city overview.
  reviewDueNetwork: 'rgba(176,96,28,0.82)',
  reviewDueWater: 'rgba(150,78,36,0.78)',
  route: '#c75f43',
  start: '#356653',
  finish: '#c75f43',
  // Bright ink-blue, not the route terracotta or the dark network: the whole
  // point of the overview is finding yourself on it at a glance.
  player: '#1f4fd8',
  playerRing: 'rgba(255,253,248,0.96)',
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

  ctx.strokeStyle = colors.waterNetwork;
  ctx.lineWidth = 0.7;
  for (const segment of layers.waterNetwork) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.learningNetwork;
  ctx.lineWidth = 0.9;
  for (const segment of layers.learningNetwork) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.learningWater;
  ctx.lineWidth = 1.0;
  for (const segment of layers.learningWater) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.knownNetwork;
  ctx.lineWidth = 1.1;
  for (const segment of layers.knownNetwork) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.knownWater;
  ctx.lineWidth = 1.2;
  for (const segment of layers.knownWater) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.masteredNetwork;
  ctx.lineWidth = 1.35;
  for (const segment of layers.masteredNetwork) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.masteredWater;
  ctx.lineWidth = 1.4;
  for (const segment of layers.masteredWater) strokePath(ctx, segment, projection);

  // Due ink sits above mastery bands so overdue places stay visible even when
  // they would otherwise paint as known/mastered green.
  ctx.strokeStyle = colors.reviewDueNetwork;
  ctx.lineWidth = 1.5;
  for (const segment of layers.reviewDueNetwork) strokePath(ctx, segment, projection);

  ctx.strokeStyle = colors.reviewDueWater;
  ctx.lineWidth = 1.55;
  for (const segment of layers.reviewDueWater) strokePath(ctx, segment, projection);

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
    // Soft halo → solid disc → heading wedge. The old lone dark cone vanished
    // into the network at city scale; the disc pins "where", the wedge "which way".
    ctx.fillStyle = 'rgba(31, 79, 216, 0.22)';
    ctx.beginPath();
    ctx.arc(at.x, at.y, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.player;
    ctx.strokeStyle = colors.playerRing;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const spread = 0.42, length = 12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(at.x + Math.cos(vehicle.angle) * length, at.y + Math.sin(vehicle.angle) * length);
    ctx.lineTo(at.x + Math.cos(vehicle.angle + Math.PI - spread) * 5.5,
      at.y + Math.sin(vehicle.angle + Math.PI - spread) * 5.5);
    ctx.lineTo(at.x + Math.cos(vehicle.angle + Math.PI + spread) * 5.5,
      at.y + Math.sin(vehicle.angle + Math.PI + spread) * 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
