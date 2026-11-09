// The knowledge map (G5, issue #275): the city as a static paper map, each
// buurt filled by how well the player knows the names inside it.
//
// The ride's city overview (game/cityOverview.ts) colours known and mastered
// roads while riding; this is its counterpart off the bike, on the Knowledge
// screen and the run card. It is drawn once from localStorage (review states
// and the passport) over a small cached geometry (boundaries + water), with no
// network in the render path, so it can promise < 100 ms.
//
// It draws no names. The Knowledge screen can open mid-ride, and a labelled
// map would answer the question waiting at the next junction.

import type { KnowledgeItem, KnowledgeStatus } from './knowledgeReview.ts';
import {
  OVERVIEW_MASTERY_KNOWN,
  OVERVIEW_MASTERY_MASTERED,
} from './game/cityOverview.ts';

export type LatLng = readonly [number, number];

/** Boundary kinds that count as a buurt, finest first wins (mirrors
 *  landmarkData.NEIGHBORHOOD_KIND_RANKS, which decides the ride's passport). */
export const BUURT_KIND_RANKS: Readonly<Record<string, number>> = {
  city_block: 5,
  neighbourhood: 4,
  neighborhood: 4,
  quarter: 3,
  locality: 2,
  suburb: 1,
};

/** A buurt with fewer tracked names than this is not "mastered" by one good
 *  name: mastery is the sum over max(tracked, this). */
export const BUURT_FULL_NAMES = 4;

export interface BuurtShape {
  name: string;
  kind: string;
  rank: number;
  /** Outer rings, [lat, lng]. */
  rings: LatLng[][];
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  /** Summed ring area (square degrees): of two same-rank buurts holding a
   *  point, the smaller wins, as on the ride's plaque (#284). */
  area?: number;
}

export interface KnowledgeMapGeometry {
  /** Coarsest first, so drawing in order leaves the finest on top. */
  buurts: BuurtShape[];
  water: LatLng[][];
  /** Frame: the buurts of rank ≥ 3 (quarters and finer), where riding happens. */
  frame: { minLat: number; minLng: number; maxLat: number; maxLng: number };
}

export interface BoundaryInput {
  name?: string;
  kind?: string;
  geometry?: number[][][][] | null;
}

export interface WaterInput {
  path?: number[][] | null;
  paths?: number[][][] | null;
}

/** The Dam, the map's centre of gravity. */
export const DAM: LatLng = [52.3731, 4.8926];
export const FRAME_RADIUS_KM = 3.2;

const round5 = (value: number): number => Math.round(value * 1e5) / 1e5;

function cleanRing(ring: readonly number[][], step: number): LatLng[] {
  const out: LatLng[] = [];
  let last: LatLng | null = null;
  for (const point of ring) {
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const next: LatLng = [round5(point[0]), round5(point[1])];
    if (last && Math.abs(next[0] - last[0]) < step && Math.abs(next[1] - last[1]) < step) continue;
    out.push(next);
    last = next;
  }
  return out;
}

/**
 * The compact geometry the map draws: ranked boundaries (no municipality) and
 * water centrelines, thinned to ~10 m, which is sub-pixel at city scale.
 */
export function geometryFromExtract(
  boundaries: readonly BoundaryInput[],
  water: readonly WaterInput[] = [],
  step = 0.0001,
): KnowledgeMapGeometry {
  const buurts: BuurtShape[] = [];
  for (const boundary of boundaries) {
    const rank = BUURT_KIND_RANKS[boundary.kind || ''];
    if (!rank || !boundary.name || !boundary.geometry) continue;
    const rings = boundary.geometry
      .map(polygon => cleanRing(polygon?.[0] || [], step))
      .filter(ring => ring.length > 2);
    if (!rings.length) continue;
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
    for (const ring of rings) for (const [lat, lng] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    let area = 0;
    for (const ring of rings) {
      let twice = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) twice += ring[j][1] * ring[i][0] - ring[i][1] * ring[j][0];
      area += Math.abs(twice) / 2;
    }
    buurts.push({ name: boundary.name, kind: boundary.kind || '', rank, rings, bbox: { minLat, minLng, maxLat, maxLng }, area });
  }
  buurts.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const lines: LatLng[][] = [];
  for (const feature of water) {
    const paths = feature.paths?.length ? feature.paths : feature.path ? [feature.path] : [];
    for (const path of paths) {
      const line = cleanRing(path, step);
      if (line.length > 1) lines.push(line);
    }
  }
  // Framed on the quarters and finer within FRAME_RADIUS_KM of the Dam: the
  // ring, the 19th-century belt and the harbour islands, where riding happens.
  // The outer districts are still drawn; they run off the edge.
  const nearDam = (buurt: BuurtShape): boolean => {
    const lat = (buurt.bbox.minLat + buurt.bbox.maxLat) / 2;
    const lng = (buurt.bbox.minLng + buurt.bbox.maxLng) / 2;
    const dy = (lat - DAM[0]) * 111.32;
    const dx = (lng - DAM[1]) * 111.32 * Math.cos((DAM[0] * Math.PI) / 180);
    return Math.hypot(dx, dy) <= FRAME_RADIUS_KM;
  };
  const framing = buurts.filter(buurt => buurt.rank >= 3 && nearDam(buurt));
  const source = framing.length ? framing : buurts;
  const frame = { minLat: Infinity, minLng: Infinity, maxLat: -Infinity, maxLng: -Infinity };
  for (const buurt of source) {
    frame.minLat = Math.min(frame.minLat, buurt.bbox.minLat);
    frame.minLng = Math.min(frame.minLng, buurt.bbox.minLng);
    frame.maxLat = Math.max(frame.maxLat, buurt.bbox.maxLat);
    frame.maxLng = Math.max(frame.maxLng, buurt.bbox.maxLng);
  }
  if (!Number.isFinite(frame.minLat)) Object.assign(frame, { minLat: 52.35, minLng: 4.85, maxLat: 52.39, maxLng: 4.94 });
  return { buurts, water: lines, frame };
}

function inRing(lat: number, lng: number, ring: readonly LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    if ((latI > lat) !== (latJ > lat) && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) inside = !inside;
  }
  return inside;
}

/** The finest buurt containing the point, as the ride's passport decides. */
export function buurtAt(geometry: KnowledgeMapGeometry, point: LatLng | null | undefined): BuurtShape | null {
  if (!point) return null;
  const [lat, lng] = point;
  let best: BuurtShape | null = null;
  for (const buurt of geometry.buurts) {
    if (best && (buurt.rank < best.rank || (buurt.rank === best.rank && (buurt.area ?? 0) >= (best.area ?? 0)))) continue;
    const box = buurt.bbox;
    if (lat < box.minLat || lat > box.maxLat || lng < box.minLng || lng > box.maxLng) continue;
    if (buurt.rings.some(ring => inRing(lat, lng, ring))) best = buurt;
  }
  return best;
}

export type BuurtBand = 'fog' | 'learning' | 'known' | 'mastered';

export interface BuurtMastery {
  name: string;
  tracked: number;
  due: number;
  mastered: number;
  /** 0..1: Σ item mastery / max(tracked, BUURT_FULL_NAMES). */
  score: number;
  band: BuurtBand;
  itemKeys: string[];
}

export type KnowledgeMapItem = Pick<KnowledgeItem, 'key' | 'status' | 'mastery' | 'center'>;

export function buurtBand(score: number, tracked: number): BuurtBand {
  if (!tracked) return 'fog';
  if (score >= OVERVIEW_MASTERY_MASTERED) return 'mastered';
  if (score >= OVERVIEW_MASTERY_KNOWN) return 'known';
  // Any practised name lifts a buurt out of the fog: it is "learning" even
  // below the overview's learning threshold, so a first ride shows on the map.
  return 'learning';
}

/**
 * Buurt mastery from the knowledge store, as a pure function: every tracked
 * name goes to the finest buurt containing its centre; a buurt's score is the
 * sum of its names' mastery over max(tracked, BUURT_FULL_NAMES).
 */
export function buurtMastery(
  geometry: KnowledgeMapGeometry,
  items: readonly KnowledgeMapItem[],
  fullNames = BUURT_FULL_NAMES,
): Map<string, BuurtMastery> {
  const out = new Map<string, BuurtMastery>();
  const sums = new Map<string, number>();
  for (const item of items) {
    const buurt = buurtAt(geometry, item.center);
    if (!buurt) continue;
    const entry = out.get(buurt.name) || { name: buurt.name, tracked: 0, due: 0, mastered: 0, score: 0, band: 'fog' as BuurtBand, itemKeys: [] };
    entry.tracked += 1;
    if (item.status === 'due') entry.due += 1;
    if (item.status === 'mastered') entry.mastered += 1;
    entry.itemKeys.push(item.key);
    sums.set(buurt.name, (sums.get(buurt.name) || 0) + Math.max(0, Math.min(1, item.mastery)));
    out.set(buurt.name, entry);
  }
  for (const entry of out.values()) {
    entry.score = (sums.get(entry.name) || 0) / Math.max(entry.tracked, fullNames);
    entry.band = buurtBand(entry.score, entry.tracked);
  }
  return out;
}

// ---- Projection and drawing ----

export interface MapProjection {
  scale: number;
  /** cos(latitude) of the frame centre: longitude is shrunk so the city keeps its shape. */
  lngFactor: number;
  offsetX: number;
  offsetY: number;
  centreLat: number;
  centreLng: number;
}

export function fitMap(frame: KnowledgeMapGeometry['frame'], width: number, height: number, padding = 8): MapProjection {
  const centreLat = (frame.minLat + frame.maxLat) / 2;
  const centreLng = (frame.minLng + frame.maxLng) / 2;
  const lngFactor = Math.cos((centreLat * Math.PI) / 180);
  const spanX = Math.max(1e-6, (frame.maxLng - frame.minLng) * lngFactor);
  const spanY = Math.max(1e-6, frame.maxLat - frame.minLat);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  return { scale, lngFactor, offsetX: width / 2, offsetY: height / 2, centreLat, centreLng };
}

export function projectLatLng(p: MapProjection, [lat, lng]: LatLng): [number, number] {
  return [p.offsetX + (lng - p.centreLng) * p.lngFactor * p.scale, p.offsetY - (lat - p.centreLat) * p.scale];
}

export function unprojectPixel(p: MapProjection, x: number, y: number): LatLng {
  return [p.centreLat - (y - p.offsetY) / p.scale, p.centreLng + (x - p.offsetX) / (p.lngFactor * p.scale)];
}

/** Paper-map palette: the game's daylight paper and ink, greens deepening
 *  with mastery, the copper accent for names due. */
export const KNOWLEDGE_MAP_COLORS = {
  paper: '#f4efe5',
  fog: 'rgba(31,28,23,0.045)',
  learning: '#e3dcb8',
  known: '#a9c79a',
  mastered: '#5f9672',
  outline: 'rgba(31,28,23,0.22)',
  water: 'rgba(110,160,185,0.75)',
  due: '#b4682c',
  selected: '#1f1c17',
  dim: 'rgba(244,239,229,0.55)',
} as const;

export const KNOWLEDGE_STATUS_COLORS: Readonly<Record<KnowledgeStatus, string>> = {
  due: '#b4682c',
  learning: '#c9b45a',
  known: '#3f7d5c',
  mastered: '#1c523a',
};

export interface KnowledgeMapModel {
  geometry: KnowledgeMapGeometry;
  mastery: Map<string, BuurtMastery>;
  items: readonly KnowledgeMapItem[];
}

export function buildKnowledgeMapModel(geometry: KnowledgeMapGeometry, items: readonly KnowledgeMapItem[]): KnowledgeMapModel {
  return { geometry, mastery: buurtMastery(geometry, items), items };
}

type Ctx2D = Pick<CanvasRenderingContext2D,
  'save' | 'restore' | 'beginPath' | 'moveTo' | 'lineTo' | 'closePath' | 'fill' | 'stroke' | 'arc' | 'fillRect' | 'setLineDash'
> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  globalAlpha: number;
};

function tracePolygon(ctx: Ctx2D, p: MapProjection, rings: readonly LatLng[][]): void {
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach((point, index) => {
      const [x, y] = projectLatLng(p, point);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
}

export interface DrawKnowledgeMapOptions {
  width: number;
  height: number;
  /** The tapped buurt: outlined in ink, the rest dimmed. */
  selected?: string | null;
  projection?: MapProjection;
}

/** Draw the whole map in CSS pixels (the caller scales for devicePixelRatio). */
export function drawKnowledgeMap(ctx: Ctx2D, model: KnowledgeMapModel, options: DrawKnowledgeMapOptions): MapProjection {
  const { width, height, selected = null } = options;
  const p = options.projection || fitMap(model.geometry.frame, width, height);
  const c = KNOWLEDGE_MAP_COLORS;
  ctx.save();
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const buurt of model.geometry.buurts) {
    const entry = model.mastery.get(buurt.name);
    const band: BuurtBand = entry?.band || 'fog';
    tracePolygon(ctx, p, buurt.rings);
    ctx.fillStyle = c[band];
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = buurt.rank >= 3 ? 0.6 : 1;
    ctx.stroke();
  }

  ctx.strokeStyle = c.water;
  ctx.lineWidth = Math.max(0.8, Math.min(1.6, p.scale / 9000));
  for (const line of model.geometry.water) {
    ctx.beginPath();
    line.forEach((point, index) => {
      const [x, y] = projectLatLng(p, point);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Buurts with names due: a dashed copper rim, the "come back" signal.
  ctx.strokeStyle = c.due;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 2]);
  for (const buurt of model.geometry.buurts) {
    if (!model.mastery.get(buurt.name)?.due) continue;
    tracePolygon(ctx, p, buurt.rings);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (selected) {
    const shape = model.geometry.buurts.find(buurt => buurt.name === selected);
    ctx.fillStyle = c.dim;
    ctx.fillRect(0, 0, width, height);
    if (shape) {
      const entry = model.mastery.get(shape.name);
      tracePolygon(ctx, p, shape.rings);
      ctx.fillStyle = c[entry?.band || 'fog'];
      ctx.fill();
      ctx.strokeStyle = c.selected;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // One dot per tracked name at its place, coloured by status; no labels.
  for (const item of model.items) {
    if (!item.center) continue;
    const [x, y] = projectLatLng(p, item.center);
    if (x < 0 || y < 0 || x > width || y > height) continue;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = KNOWLEDGE_STATUS_COLORS[item.status];
    ctx.fill();
  }
  ctx.restore();
  return p;
}

/** Tap-to-filter: the buurt under a map pixel, or null for open water/fog. */
export function buurtAtPixel(model: KnowledgeMapModel, p: MapProjection, x: number, y: number): string | null {
  return buurtAt(model.geometry, unprojectPixel(p, x, y))?.name ?? null;
}

/** Totals for the legend: buurts per band, among buurts with any name. */
export function bandCounts(mastery: ReadonlyMap<string, BuurtMastery>): Record<Exclude<BuurtBand, 'fog'>, number> {
  const counts = { learning: 0, known: 0, mastered: 0 };
  for (const entry of mastery.values()) if (entry.band !== 'fog') counts[entry.band] += 1;
  return counts;
}
