/**
 * Cheap fills for yards the city draws as bare ground (2026-11-09 feedback: Hornweg container
 * terminal, Zaanstraat rail yard). Open yards have no BAG pands and no OSM container tag, so:
 *
 *   - `isOpenYard`: a landuse=industrial polygon >= MIN_YARD_AREA_M2 whose building cover is under
 *     MAX_YARD_BUILDING_COVER and that holds private service aisles (the terminal's lanes).
 *   - `containerStacks`: boxes on a grid aligned to the polygon's longest edge, skipping the aisles,
 *     buildings and the polygon edge; deterministic from the yard id (no random state).
 *   - `sidingStrip`: ballast width for railway=rail service=yard|spur ways.
 *
 * Layout is invented (the real stacks move daily); only the extent, aisles and buildings are data.
 */
import type { LngLat, Ring } from './landmarks/osmUnderModels';
import { pointInRing } from './landmarks/osmUnderModels';

export const MIN_YARD_AREA_M2 = 20000;
export const MAX_YARD_BUILDING_COVER = 0.15;
export const MIN_YARD_AISLES = 3;
export const CONTAINER_LENGTH_M = 12.2;
export const CONTAINER_WIDTH_M = 2.44;
export const CONTAINER_HEIGHT_M = 2.6;
export const STACK_GAP_M = 0.8; // between rows
export const AISLE_CLEARANCE_M = 6;
export const EDGE_CLEARANCE_M = 5;
export const MAX_STACK_HIGH = 4;
export const SIDING_BALLAST_WIDTH_M = 3.6;
/** Rendering cap per yard so one terminal cannot dominate the instance budget. */
export const MAX_BOXES_PER_YARD = 4000;
export const CONTAINER_COLOURS = ['#b8432f', '#2f5d8c', '#c9a227', '#4f7a4a', '#8a8d91', '#d9d4c7', '#6b3f8a', '#2d7f86'] as const;

export interface ContainerBox { c: LngLat; headingDeg: number; l: number; w: number; h: number; colour: string }

const R = 6371008.8;
export const project = (p: LngLat, o: LngLat): [number, number] => [(p[0] - o[0]) * Math.PI / 180 * R * Math.cos(o[1] * Math.PI / 180), (p[1] - o[1]) * Math.PI / 180 * R];
export const unproject = (x: number, y: number, o: LngLat): LngLat => [o[0] + x / (R * Math.cos(o[1] * Math.PI / 180)) * 180 / Math.PI, o[1] + y / R * 180 / Math.PI];

export const hash32 = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = (a: number) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export const ringArea = (ring: readonly [number, number][]): number => { let a = 0; for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; return Math.abs(a) / 2; };

export function isOpenYard(yardAreaM2: number, buildingAreaInsideM2: number, aisleCount: number): boolean {
  return yardAreaM2 >= MIN_YARD_AREA_M2 && buildingAreaInsideM2 / yardAreaM2 < MAX_YARD_BUILDING_COVER && aisleCount >= MIN_YARD_AISLES;
}

const distToSeg = (p: [number, number], a: [number, number], b: [number, number]): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const inRingXY = (p: [number, number], ring: readonly [number, number][]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > p[1]) !== (ring[j][1] > p[1]) && p[0] < (ring[j][0] - ring[i][0]) * (p[1] - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
  return inside;
};

export function containerStacks(yardId: string, yard: Ring, aisles: readonly (readonly LngLat[])[], buildings: readonly Ring[]): ContainerBox[] {
  const o = yard[0] as LngLat;
  const ring = yard.map(p => project(p, o));
  const aisleXY = aisles.map(l => l.map(p => project(p, o)));
  const bldXY = buildings.map(r => r.map(p => project(p, o)));
  // Grid axis: longest polygon edge.
  let best = 0, ang = 0;
  for (let i = 0; i < ring.length - 1; i++) { const d = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]); if (d > best) { best = d; ang = Math.atan2(ring[i + 1][1] - ring[i][1], ring[i + 1][0] - ring[i][0]); } }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const loc = ring.map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca] as [number, number]);
  const minX = Math.min(...loc.map(p => p[0])), maxX = Math.max(...loc.map(p => p[0])), minY = Math.min(...loc.map(p => p[1])), maxY = Math.max(...loc.map(p => p[1]));
  const rand = mulberry(hash32(yardId));
  const out: ContainerBox[] = [];
  const stepX = CONTAINER_LENGTH_M + 0.4, stepY = CONTAINER_WIDTH_M + STACK_GAP_M;
  for (let y = minY + EDGE_CLEARANCE_M; y < maxY - EDGE_CLEARANCE_M && out.length < MAX_BOXES_PER_YARD; y += stepY) {
    // Every 6th row is a lane, so stacks come in blocks like a real terminal.
    if (Math.round((y - minY) / stepY) % 7 === 6) continue;
    for (let x = minX + EDGE_CLEARANCE_M; x < maxX - EDGE_CLEARANCE_M && out.length < MAX_BOXES_PER_YARD; x += stepX) {
      const r = rand(); // consume in grid order so the layout is stable when a filter changes
      const hi = 1 + Math.floor(rand() * MAX_STACK_HIGH), col = CONTAINER_COLOURS[Math.floor(rand() * CONTAINER_COLOURS.length)];
      if (r < 0.25) continue; // empty slots
      const w: [number, number] = [x * ca - y * sa, x * sa + y * ca];
      const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [w[0] + sx * CONTAINER_LENGTH_M / 2 * ca - sy * CONTAINER_WIDTH_M / 2 * sa, w[1] + sx * CONTAINER_LENGTH_M / 2 * sa + sy * CONTAINER_WIDTH_M / 2 * ca]);
      if (!corners.every(c => inRingXY(c, ring))) continue;
      if (aisleXY.some(l => l.some((p, i) => i > 0 && distToSeg(w, l[i - 1], p) < AISLE_CLEARANCE_M))) continue;
      if (bldXY.some(b => corners.some(c => inRingXY(c, b)) || inRingXY(w, b))) continue;
      out.push({ c: unproject(w[0], w[1], o), headingDeg: Math.round(((90 - ang * 180 / Math.PI) % 360 + 360) % 360 * 10) / 10, l: CONTAINER_LENGTH_M, w: CONTAINER_WIDTH_M, h: Math.round(hi * CONTAINER_HEIGHT_M * 10) / 10, colour: col });
    }
  }
  return out;
}

export const pointInAnyRing = (p: LngLat, rings: readonly Ring[]): boolean => rings.some(r => pointInRing(p, r));
