import {envelopeFootprintFingerprint} from './surveyedBuildingEnvelope.js';
import type {SurveyedMeshBinding,SurveyedMeshWallEdge} from './surveyedEnvelopeMeshBinding.js';
import { planInterwarGroundFrontage, type InterwarGroundFrontagePlan } from './interwarGroundFrontage.js';
import { planCompoundFrontage, type CompoundFrontagePlan } from './compoundFrontageLayout.js';
import { planRegularCanalFrontage, type RegularCanalFrontagePlan } from './regularCanalFrontage.js';
import { planRepeatedTerraceFrontage, type RepeatedTerraceFrontagePlan } from './repeatedTerraceFrontage.js';
// Merged wall meshes for the three.js building layer (spike, 2026-10-02).
//
// Takes streamed building features and returns typed arrays for ONE
// BufferGeometry per group of buildings: wall quads only (roofs, cornices and
// everything else stay with MapLibre's extrusions), with
//   - UVs counted in bays (u) and storeys (v), for a REPEAT-wrapped cell
//     texture array, so texture filtering needs no `fract` in the shader;
//   - a texture-array layer per quad (style x cell kind);
//   - a per-vertex tint (wall colour x directional shade x per-building jitter);
//   - an id -> vertex range map, so one building (the answer) can be lit or
//     hidden by touching a few bytes instead of rebuilding the mesh.
// Positions are metres east / north / up from a caller-supplied origin.

import { interwarStreetPhase, planInterwarFrontage, type InterwarFrontagePlan } from './interwarFrontageLayout.js';
import { applyHostWallOpenings, type ChunkHostOpeningConfig } from './hostWallOpenings.js';
import { sharedWallCuts, subtractWallCuts, subtractConvex, polygonArea, type Point2 } from './coplanarSurfaces.js';
import { recipeBayOpenings, type Openings } from './facadeOpenings.js';
import { streetWallBuilding, frontageLayoutScale, PROCEDURAL_RECIPE_LAYER_OFFSET, type StreetFacadeContext } from './streetFacadeRendering.js';
import { BAY_LAYER_COUNT, bayLookFor } from './bayLook.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';
import { streetCrown, type StreetCrownFront, type StreetCrownTri } from './streetCrown.js';
import { CELL_VARIANTS, CELL_LAYER_COUNT, cellLayer } from './facadeCells.js';
import { edgeGroundPieces, edgeLayout, layoutRun } from './facadeLayout.js';
import { FALLBACK_REACH_M, SegmentGrid, streetDistance } from './streetFronts.js';
import { FACADE_CORNICE_M, type FacadeStyle } from './genericFacades.js';
import type { KitPartGeometry } from './landmarkKits.js';
import type { ChainLook } from './shopfronts.js';
import { wordRuns } from './blockLetters.js';
import earcut from 'earcut';
import { ExtraSink, EXTRA_BUDGET, roofExtras, buildingWallExtras, type ExtraContext } from './facadeExtras.js';
import { fitRect, roofTrianglesForOutline, type RoofDims, type RoofPlan, type RoofTri } from './roofMesh.js';

export type MeshBuilding = {
  /** Diagnostic-only, already validated exact native parent/envelope binding. */
  surveyedEnvelope?: SurveyedMeshBinding;
  streetAppearance?: StreetFacadeContext;
  recipe?: ArchitecturalRecipe;
  /** Exact opening positions of the active texture, shared with 3D entrance details. */
  openings?: Openings;
  id: string;
  /** Rings of [lng, lat]; outer first, holes after. One polygon per entry. */
  polygons: number[][][][];
  heightM: number;
  minHeightM: number;
  style: FacadeStyle;
  /** The building's real period when the look lays it out as another style (facadeExtras: 19th-century dressing on a bay-look canal layout). */
  period?: FacadeStyle;
  wallHex: string;
  /** A bay look's own layers and accent colour; absent means the procedural cells. */
  layers?: { upper: number; ground: number; door: number };
  accentHex?: string;
  /** Paint of a shop's ground floor (bay looks): tints the shop bays' painted surface instead of the wall colour. */
  groundHex?: string;
  /** A shopfront on the street-level bays (procedural cells; the bay looks choose their own layer). */
  shop?: boolean;
  /** The ground floor is a shopfront (either look): it takes the whole frontage, no house door beside it. */
  shopfront?: boolean;
  /**
   * A signature storefront for a business the map labels: a projecting blade sign and a 3D
   * awning in the business's colour, on the wall nearest its OSM point ([lng, lat]).
   */
  signature?: { at: [number, number]; hex: string };
  /** A supermarket chain's own shopfront (fascia, logo panel, brand word) at its OSM point; replaces the signature. */
  chain?: { at: [number, number]; look: ChainLook };
  /** Draw the facade extras (hoist beams, stoops, balconies, bikes, roof terraces): facadeExtras.ts. */
  extras?: boolean;
  /** Texture layer for bare wall: gable faces, chimneys, cornices. */
  plainLayer?: number;
  /** Bare walls only (a church): every row uses the plain layer and there are no doors. */
  plainWalls?: boolean;
  /** No facade at all (a shed, a landmark part, a building with no style): one plain quad per wall. */
  bare?: boolean;
  /**
   * The mesh owns this building's top: walls run to the full height (no MapLibre
   * cornice band) and a flat roof gets a lid in this colour on the flat layer.
   * Without it, MapLibre drew band and lid as separate extrusions that hung in
   * mid-air whenever the walls were rebuilt (user report 2026-10-02).
   */
  lid?: { hex: string; flatLayer: number };
  /** A real roof for this building; its walls already stop at the eaves. */
  roof?: { plan: RoofPlan; layers: { slope: number; plain: number; dormer: number }; roofHex: string; dims: RoofDims };
};

export type Origin = { lng: number; lat: number };
export type VertexRange = { id: string; start: number; count: number };

export type Chunk = {
  /** Exact identities whose source wall opening was successfully installed. */
  hostOpeningIds?: readonly string[];
  positions: Float32Array;
  uvs: Float32Array;
  /** Texture-array layer, one byte per vertex. */
  layers: Uint8Array;
  /** RGB wall tint (colour x per-building tone); alpha is the directional shade. */
  tints: Uint8Array;
  /** RGBA accent colour (door leaf, shutters, awnings) for the bay looks; white otherwise. */
  accents: Uint8Array;
  indices: Uint32Array;
  ranges: VertexRange[];
  vertexCount: number;
  quadCount: number;
  wallCount: number;
  buildingCount: number;
};

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/** Top of the facade (and bottom of the plain cornice band above it). */
export const facadeTopM = (wallTopM: number) => wallTopM - FACADE_CORNICE_M;

/**
 * The wall top MapLibre's plain layer uses (`wallTopHeightExpression`):
 * pyramidal and tagged-tip roofs end the wall at their eaves. Ported to
 * plain code so the mesh stops where the extrusion does; the check script
 * evaluates the real expression on the same properties to prove it.
 */
export function wallTopHeightM(p: Record<string, unknown>): number {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const height = num(p.height, 5), minHeight = num(p.minHeight, 0);
  const exposed = height - minHeight;
  const inventedTip = Math.max(3, Math.min(12, 0.35 * exposed));
  const tagged = num(p.roofHeight, 0);
  const pyramidalTip = tagged > 0 ? tagged : inventedTip;
  const eaves = (tip: number) => Math.max(minHeight, height - tip);
  if (typeof p.roofEavesHeightM === 'number' && p.roofEavesHeightM > 0) return Math.min(height, p.roofEavesHeightM);
  if (p.roofShape === 'pyramidal') return eaves(pyramidalTip);
  const flatOrUntagged = p.roofShape === undefined || p.roofShape === '' || p.roofShape === 'flat';
  const hasRoofColour = p.roofColour !== undefined && p.roofColour !== null;
  const distinct = hasRoofColour && !(p.colour !== undefined && p.colour !== null && p.roofColour === p.colour);
  if (tagged > 0 && flatOrUntagged && distinct) return eaves(tagged);
  return height;
}

/** Which of a style's looks a building wears (shared with the roof plan so gable faces match the walls). */
export const lookVariant = (id: string) => Math.floor(hash01(`${id}:look`) * CELL_VARIANTS);

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const parseHex = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [200, 190, 175];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Fixed light from the north-west, so walls facing it read lighter. */
export function wallShade(nx: number, ny: number): number {
  const d = nx * -0.45 + ny * 0.89;
  return 0.8 + 0.2 * (0.5 + 0.5 * d);
}

type Edge = { x0: number; y0: number; x1: number; y1: number; len: number; nx: number; ny: number; hole: boolean };

function ringEdges(ring: number[][], origin: Origin, hole: boolean): Edge[] {
  const kx = mPerDegLng(origin.lat);
  const pts = ring.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT]);
  // GeoJSON closes the ring; drop the repeat.
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return [];
  let area2 = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  // The solid must lie on the left of travel for an outer ring (CCW), and on
  // the left of travel for a hole too once the hole runs clockwise.
  const wantCcw = !hole;
  if ((area2 > 0) !== wantCcw) pts.reverse();
  const edges: Edge[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    // Outward from the solid is the right-hand side of travel.
    edges.push({ x0, y0, x1, y1, len, nx: dy / len, ny: -dx / len, hole });
  }
  return edges;
}

type LidMesh = { xy: number[]; index: number[] };
/** An upward face's shade under the fixed light (matches the roof shading formula for n = up). */
const LID_SHADE = 0.58 + 0.42 * 0.8;

/** A flat lid over every polygon (courtyards kept open) at the wall top, as shared vertices plus earcut indices facing up. */
function lidMesh(b: MeshBuilding, origin: Origin): LidMesh | null {
  const kx = mPerDegLng(origin.lat), xy: number[] = [], index: number[] = [];
  for (const polygon of b.polygons) {
    const flat: number[] = [], holes: number[] = [];
    for (const [i, ring] of polygon.entries()) {
      const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
      if (pts.length < 3) { if (i === 0) break; continue; }
      if (i > 0) holes.push(flat.length / 2);
      for (const [lng, lat] of pts) flat.push((lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT);
    }
    if (flat.length < 6) continue;
    const offset = xy.length / 2, tri = earcut(flat, holes.length ? holes : undefined, 2);
    for (let i = 0; i < tri.length; i += 3) {
      const [a, c, d] = [tri[i], tri[i + 1], tri[i + 2]];
      const cross = (flat[c * 2] - flat[a * 2]) * (flat[d * 2 + 1] - flat[a * 2 + 1]) - (flat[c * 2 + 1] - flat[a * 2 + 1]) * (flat[d * 2] - flat[a * 2]);
      // Counter-clockwise from above, so the face points up.
      if (cross >= 0) index.push(offset + a, offset + c, offset + d); else index.push(offset + a, offset + d, offset + c);
    }
    xy.push(...flat);
  }
  return index.length ? { xy, index } : null;
}

/** `lit`: lit signage (a chain's fascia and lettering), barely dimmed on a wall facing away from the sun. */
type SignTri = { p: [number, number, number][]; hex: string; n: [number, number, number]; lit?: boolean; texture?: 'glass-block'; uv?: [number,number][]; layer?: number; accentHex?: string };

/** One flat quad (corners in order) as two triangles wound to face `n`. */
function faceTris(q: [number, number, number][], n: [number, number, number], hex: string, out: SignTri[]) {
  const [A, B, C, D] = q, cr = (u: number[], w: number[]) => [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const c = cr([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]);
  const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0;
  out.push({ p: flip ? [A, C, B] : [A, B, C], hex, n }, { p: flip ? [A, D, C] : [A, C, D], hex, n });
}

/** Box faces (no bottom unless asked) with outward normals; frame: x along the wall, y outward, z up. */
function boxTris(e: { x0: number; y0: number; ux: number; uy: number; nx: number; ny: number }, a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, out: SignTri[], bottom = false) {
  const P = (a: number, o: number, z: number): [number, number, number] => [e.x0 + e.ux * a + e.nx * o, e.y0 + e.uy * a + e.ny * o, z];
  const face = (q: [number, number, number][], n: [number, number, number]) => faceTris(q, n, hex, out);
  const N = (a: number, o: number, z: number): [number, number, number] => [e.ux * a + e.nx * o, e.uy * a + e.ny * o, z];
  face([P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], N(0, 1, 0));
  face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o0, z1), P(a0, o0, z1)], N(0, -1, 0));
  face([P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], N(-1, 0, 0));
  face([P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], N(1, 0, 0));
  face([P(a0, o0, z1), P(a1, o0, z1), P(a1, o1, z1), P(a0, o1, z1)], [0, 0, 1]);
  if (bottom) face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o1, z0), P(a0, o1, z0)], [0, 0, -1]);
}

/**
 * A signature storefront on the wall nearest the business's point: an awning slab over the
 * ground floor across the frontage, and a blade sign sticking out from the wall above it,
 * both in the business's colour (the sign framed in dark iron), so the label on the map and
 * the building on the street match.
 */
function signatureTris(sig: { at: [number, number]; hex: string }, edges: readonly Edge[], base: number, origin: Origin): SignTri[] {
  const kx = mPerDegLng(origin.lat), px = (sig.at[0] - origin.lng) * kx, py = (sig.at[1] - origin.lat) * M_PER_DEG_LAT;
  let best: Edge | null = null, bestD = Infinity;
  for (const e of edges) {
    if (e.hole || e.len < 2.5) continue;
    const dx = e.x1 - e.x0, dy = e.y1 - e.y0, t = Math.max(0, Math.min(1, ((px - e.x0) * dx + (py - e.y0) * dy) / (e.len * e.len)));
    const d = Math.hypot(px - e.x0 - dx * t, py - e.y0 - dy * t);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best) return [];
  const e = { x0: best.x0, y0: best.y0, ux: (best.x1 - best.x0) / best.len, uy: (best.y1 - best.y0) / best.len, nx: best.nx, ny: best.ny };
  const out: SignTri[] = [], L = best.len, z = base;
  // Awning: the frontage less 0.4 m each side, 0.9 m deep, a thin band at 3.0-3.2 m. A 1.2 m deep,
  // 0.45 m thick slab read as a heavy black box on dark brands (user 2026-10-03).
  boxTris(e, 0.4, L - 0.4, 0.05, 0.95, z + 3.0, z + 3.2, sig.hex, out, true);
  // Blade sign near the end of the frontage closest to the point: iron bracket and a 0.9 m board.
  const along = Math.max(0.6, Math.min(L - 0.6, (px - e.x0) * e.ux + (py - e.y0) * e.uy));
  const at = along < L / 2 ? 0.6 : L - 0.6;
  boxTris(e, at - 0.04, at + 0.04, 0.05, 1.2, z + 4.3, z + 4.38, '#2a2a2a', out, true);
  boxTris(e, at - 0.07, at + 0.07, 0.25, 1.15, z + 3.45, z + 4.3, sig.hex, out, true);
  return out;
}

/**
 * A supermarket chain's shopfront on the street wall nearest its OSM point: a fascia board in
 * the chain's colour across the frontage (at most 24 m of a long block) just under the first
 * floor, a square logo panel with its inner mark at the end nearest the entrance point, and the
 * brand word in blocky capitals on the board. Walls run CCW with the outward normal on the
 * right of travel, so increasing distance along the wall reads left to right from the street.
 */
export function chainFrontTris(chain: NonNullable<MeshBuilding['chain']>, candidates: readonly Edge[], base: number, groundM: number, origin: Origin): SignTri[] {
  const kx = mPerDegLng(origin.lat), px = (chain.at[0] - origin.lng) * kx, py = (chain.at[1] - origin.lat) * M_PER_DEG_LAT;
  let best: Edge | null = null, bestD = Infinity;
  for (const e of candidates) {
    if (e.hole || e.len < 2.5) continue;
    const dx = e.x1 - e.x0, dy = e.y1 - e.y0, t = Math.max(0, Math.min(1, ((px - e.x0) * dx + (py - e.y0) * dy) / (e.len * e.len)));
    const d = Math.hypot(px - e.x0 - dx * t, py - e.y0 - dy * t);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best) return [];
  const e = { x0: best.x0, y0: best.y0, ux: (best.x1 - best.x0) / best.len, uy: (best.y1 - best.y0) / best.len, nx: best.nx, ny: best.ny };
  const L = best.len, look = chain.look, out: SignTri[] = [];
  const along = Math.max(0, Math.min(L, (px - e.x0) * e.ux + (py - e.y0) * e.uy));
  const half = Math.min((L - 0.6) / 2, 12), s0 = Math.max(0.3, Math.min(L - 0.3 - 2 * half, along - half)), s1 = s0 + 2 * half;
  const top = base + Math.max(2.6, groundM) - 0.05, bottom = top - 0.7;
  boxTris(e, s0, s1, 0.02, 0.2, bottom, top, look.fascia, out, true);
  // Logo panel at the end of the board nearer the entrance, standing proud of it.
  const logoW = Math.min(1.0, (s1 - s0) * 0.3), atStart = along - s0 < s1 - along;
  const l0 = atStart ? s0 + 0.15 : s1 - 0.15 - logoW, l1 = l0 + logoW;
  const lc = (l0 + l1) / 2, zc = top - 0.35, m = logoW * 0.27;
  boxTris(e, l0, l1, 0.2, 0.3, zc - logoW / 2, zc + logoW / 2, look.logo, out, true);
  boxTris(e, lc - m, lc + m, 0.3, 0.32, zc - m, zc + m, look.mark, out);
  // The brand word, centred on the rest of the board, as flat quads just in front of it.
  const free0 = atStart ? l1 + 0.2 : s0 + 0.2, free1 = atStart ? s1 - 0.2 : l0 - 0.2;
  const { runs, width } = wordRuns(look.word);
  const cell = Math.min(0.065, (free1 - free0) / Math.max(1, width));
  if (cell >= 0.035 && runs.length) {
    const w0 = (free0 + free1) / 2 - (width * cell) / 2, zMid = (top + bottom) / 2, o = 0.205;
    const n: [number, number, number] = [e.nx, e.ny, 0];
    const P = (a: number, z: number): [number, number, number] => [e.x0 + e.ux * a + e.nx * o, e.y0 + e.uy * a + e.ny * o, z];
    for (const r of runs) {
      const a0 = w0 + r.c0 * cell, a1 = w0 + r.c1 * cell, z1 = zMid + (3.5 - r.row) * cell, z0 = z1 - cell;
      faceTris([P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1)], n, look.letters, out);
    }
  }
  for (const t of out) t.lit = true;
  return out;
}

const edgeKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

/** Edges whose directions differ by less than this read as one wall (a curve or a slight kink). */
export const RUN_TURN_DEG = 25;
const COS_RUN = Math.cos(RUN_TURN_DEG * Math.PI / 180);

/**
 * A ring's visible walls grouped into runs: consecutive exposed edges that meet end to end
 * and turn by less than RUN_TURN_DEG, laid out as one facade. A hidden (party) wall or a
 * real corner ends a run.
 */
export function wallRuns(rings: readonly (readonly Edge[])[], hidden: (e: Edge) => boolean): Array<Array<{ e: Edge }>> {
  const runs: Array<Array<{ e: Edge }>> = [];
  for (const ring of rings) {
    const n = ring.length;
    if (!n) continue;
    const joins = (a: Edge, b: Edge) => !hidden(a) && !hidden(b) && Math.hypot(a.x1 - b.x0, a.y1 - b.y0) < 0.05
      && ((a.x1 - a.x0) * (b.x1 - b.x0) + (a.y1 - a.y0) * (b.y1 - b.y0)) / (a.len * b.len) >= COS_RUN;
    // Start at an edge that does not join its predecessor, so no run wraps round the ring's start.
    // A ring that joins all the way round (a round building) is one run from edge 0.
    const start = Math.max(0, ring.findIndex((e, i) => !joins(ring[(i - 1 + n) % n], e)));
    let run: Array<{ e: Edge }> = [];
    for (let k = 0; k < n; k++) {
      const e = ring[(start + k) % n];
      if (hidden(e)) { if (run.length) runs.push(run); run = []; continue; }
      if (run.length && !joins(run[run.length - 1].e, e)) { runs.push(run); run = []; }
      run.push({ e });
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

/**
 * Build one chunk. Walls shared exactly with a taller-or-equal neighbour in
 * the same chunk (party walls between terraced houses, the bulk of a canal
 * belt's edges) are skipped: nobody sees them, and they are about half the
 * vertices of a naive mesh.
 */
function sourceEdgeFor(b:MeshBuilding,e:Edge){
 const exact=(a:number,b:number)=>Math.abs(a-b)<1e-8;
 const match=b.surveyedEnvelope?.edges.find(s=>exact(s.start[0],e.x0)&&exact(s.start[1],e.y0)&&exact(s.end[0],e.x1)&&exact(s.end[1],e.y1)||exact(s.end[0],e.x0)&&exact(s.end[1],e.y0)&&exact(s.start[0],e.x1)&&exact(s.start[1],e.y1));
 if(!match)return;const reversed=!exact(match.start[0],e.x0)||!exact(match.start[1],e.y0);
 return {binding:match,segments:reversed?match.segments.map(s=>({...s,t0:1-s.t1,t1:1-s.t0,z0:s.z1,z1:s.z0})).reverse():match.segments};
}
function validatedSourceBuilding(input:MeshBuilding,origin:Origin):MeshBuilding{
 const binding=input.surveyedEnvelope;if(!binding)return input;
 const valid=binding.nativeParentId===input.id&&binding.meshOrigin.lng===origin.lng&&binding.meshOrigin.lat===origin.lat&&input.polygons.length===1&&input.polygons[0].length===1&&binding.installedFootprintFingerprint===envelopeFootprintFingerprint({type:'Polygon',coordinates:input.polygons[0]})&&input.plainLayer!==undefined&&!!input.lid;
 const edges=input.polygons.flatMap(p=>p.flatMap((ring,i)=>ringEdges(ring,origin,i>0)));
 if(!valid||edges.length!==binding.edges.length||!edges.every(e=>{const source=sourceEdgeFor(input,e);return source&&source.segments.length&&Math.abs(source.segments[0].t0)<1e-8&&Math.abs(source.segments[source.segments.length-1].t1-1)<1e-8&&source.segments.every((s,i)=>[s.t0,s.t1,s.z0,s.z1].every(Number.isFinite)&&s.t1>s.t0&&(!i||Math.abs(s.t0-source.segments[i-1].t1)<1e-8));}))return{...input,surveyedEnvelope:undefined};return input;
}
function sourceWallCutGroups(b:MeshBuilding,edges:readonly Edge[]){
 if(!b.surveyedEnvelope)return[{b,edges}];
 return edges.flatMap(e=>{const s=sourceEdgeFor(b,e)!;return s.segments.map(p=>({b:{...b,heightM:Math.min(p.z0,p.z1)},edges:[{...e,x0:e.x0+(e.x1-e.x0)*p.t0,y0:e.y0+(e.y1-e.y0)*p.t0,x1:e.x0+(e.x1-e.x0)*p.t1,y1:e.y0+(e.y1-e.y0)*p.t1,len:e.len*(p.t1-p.t0)}]}));});
}
/**
 * `mode: 'extras'` builds only the facade extras (facadeExtras.ts) of these buildings: they are a
 * separate, near-camera chunk, too many triangles to draw across the whole resident city.
 */
export function buildChunk(buildings: readonly MeshBuilding[], origin: Origin, mode: 'walls' | 'extras' = 'walls', streets?: Float32Array, context: readonly MeshBuilding[] = [], hostOpenings: readonly ChunkHostOpeningConfig[] = []): Chunk {
  type Prepared = { b: MeshBuilding; edges: Edge[]; top: number };
  const prepared: Prepared[] = [];
  const rings: Edge[][][] = [];
  const shared = new Map<string, { top: number; base: number }[]>();
  for (const input of buildings) {
    const b=validatedSourceBuilding(input,origin);
    // A lidded building owns its top, so its facade rows run to the full height (no band to leave room for).
    const top = b.lid ? b.heightM : facadeTopM(b.heightM);
    const own: Edge[][] = [];
    for (const polygon of b.polygons) polygon.forEach((ring, i) => own.push(ringEdges(ring, origin, i > 0)));
    const edges = own.flat();
    rings.push(own);
    prepared.push({ b, edges, top });
    for (const e of edges) {
      const key = `${edgeKey(e.x0, e.y0)}>${edgeKey(e.x1, e.y1)}`;
      let list = shared.get(key);
      if (!list) shared.set(key, list = []);
      list.push({ top: sourceEdgeFor(b,e)?.segments.reduce((m,s)=>Math.max(m,s.z0,s.z1),-Infinity)??b.heightM, base: b.minHeightM });
    }
  }
  // Resident context can include the target parent at its fallback eave height.
  // It must never clip the same parent's newly source-owned facade out of existence.
  const ownIds=new Set(prepared.map(p=>p.b.id));
  const contextPrepared = context.filter(input=>!ownIds.has(input.id)).map(input=>{const b=validatedSourceBuilding(input,origin);return {b,edges:b.polygons.flatMap(p=>p.flatMap((ring,i)=>ringEdges(ring,origin,i>0)))};});
  const cutters=[...prepared,...contextPrepared].flatMap(({b,edges})=>sourceWallCutGroups(b,edges));
  const wallCuts=sharedWallCuts(cutters);
  // Preserve original edge keys for source walls while using per-segment
  // source heights when this parent clips an ordinary/context neighbor.
  if(prepared.some(p=>p.b.surveyedEnvelope)){
    const direct=sharedWallCuts([...prepared.filter(p=>p.b.surveyedEnvelope),...cutters.filter(p=>!p.b.surveyedEnvelope)]);
    for(const p of prepared.filter(p=>p.b.surveyedEnvelope))for(const e of p.edges)if(direct.has(e))wallCuts.set(e,direct.get(e)!);
  }
  const hiddenByNeighbour = (e: Edge, b: MeshBuilding) => {
    const others = shared.get(`${edgeKey(e.x1, e.y1)}>${edgeKey(e.x0, e.y0)}`);
    return !!others && others.some(o => o.top >= (sourceEdgeFor(b,e)?.segments.reduce((m,s)=>Math.max(m,s.z0,s.z1),-Infinity)??b.heightM) && o.base <= b.minHeightM);
  };

  // Street side: with the streets near this chunk, a door goes only on a wall that sees a street
  // before it sees another building (streetFronts.ts). Without them, any outer wall may carry one.
  const streetGrid = streets && streets.length ? new SegmentGrid(streets) : null;
  let wallGrid: SegmentGrid | null = null;
  if (streetGrid) {
    const segs: number[] = [], owners: number[] = [];
    prepared.forEach(({ edges }, i) => { for (const e of edges) { segs.push(e.x0, e.y0, e.x1, e.y1); owners.push(i); } });
    wallGrid = new SegmentGrid(segs, 25, owners);
  }
  const doorWalls = (bi: number): Set<Edge> => {
    const { b, edges } = prepared[bi];
    const outer = edges.filter(e => !e.hole && e.len >= 2.4 && !hiddenByNeighbour(e, b));
    if (!streetGrid) return new Set(outer);
    const facing = new Set(outer.filter(e => streetDistance(e, streetGrid, wallGrid, bi) < Infinity));
    if (facing.size || !outer.length) return facing;
    // Set back from every street (an inner-block house): one door, on the wall nearest a street.
    let best: Edge | null = null, bestD = Infinity;
    for (const e of outer) { const d = streetDistance(e, streetGrid, null, bi, FALLBACK_REACH_M); if (d < bestD) { bestD = d; best = e; } }
    return new Set(best ? [best] : []);
  };

  const CORNICE_STYLES = new Set<string>(['canal', 'c19', 'school']);
  type Quad = { accent: [number, number, number]; e: Edge; u0: number; u1: number; v1: number; v0?: number; z1Left?:number;z1Right?:number;v1Left?:number;v1Right?:number;layer: number; z0: number; z1: number; tint: [number, number, number, number]; along0: number; along1: number };
  const quadsByBuilding: Array<{ b: MeshBuilding; quads: Quad[]; walls: number; roof: StreetCrownTri[]; lid: LidMesh | null; sign: SignTri[] }> = [];
  let signTotal = 0;
  let quadTotal = 0, wallTotal = 0, roofTotal = 0, lidVerts = 0, lidIndices = 0;
  const kxLocal = mPerDegLng(origin.lat);
  for (const [bi, { b, edges, top:buildingTop }] of prepared.entries()) {
    const quads: Quad[] = [];
    const base = b.minHeightM;
    const wallRGB = parseHex(b.wallHex), wallAccent = parseHex(b.accentHex ?? '#ffffff');
    const groundPaint = b.groundHex && b.layers ? parseHex(b.groundHex) : null;
    const variant = Math.floor(hash01(`${b.id}:look`) * CELL_VARIANTS);
    // No two neighbours share a rhythm: bay width, storey and ground-floor height vary per building.
    const scale = { bay: 0.88 + hash01(`${b.id}:bay`) * 0.3, storey: 0.93 + hash01(`${b.id}:storey`) * 0.16, ground: 0.92 + hash01(`${b.id}:ground`) * 0.2 };
    const jitter = 0.9 + hash01(`${b.id}:tone`) * 0.2;
    let walls = 0;
    const extraSink = mode === 'extras' && b.extras ? new ExtraSink(EXTRA_BUDGET.building) : null;
    const wallExtraContexts: ExtraContext[] = [];
    const frontageTriangles: SignTri[] = [];
    const cornice: StreetCrownTri[] = [];
    const doorAllowed = doorWalls(bi);
    let groundSeen = Infinity;
    const streetEdges = [...doorAllowed];
    const streetCorner = !!streetGrid && streetEdges.some((a, i) => streetEdges.slice(i + 1).some(c => a.nx * c.nx + a.ny * c.ny < .5));
    const fallbackBuilding = b.streetAppearance ? { ...b, streetAppearance: { ...b.streetAppearance, streetCorner } } : b;
    const crownFronts: StreetCrownFront[] = [];
    for (const run of wallRuns(rings[bi], e => hiddenByNeighbour(e, fallbackBuilding))) {
      const first = run[0].e;
      const sourceSegments=run.flatMap(({e})=>sourceEdgeFor(fallbackBuilding,e)?.segments??[]);
      const top=sourceSegments.length?Math.min(...sourceSegments.flatMap(s=>[s.z0,s.z1])):buildingTop;
      let b = fallbackBuilding.streetAppearance ? streetWallBuilding(fallbackBuilding, {
        ...first, x1: run[run.length - 1].e.x1, y1: run[run.length - 1].e.y1,
      }, origin, run.some(({ e }) => doorAllowed.has(e))) : fallbackBuilding;
      if(!b.recipe?.shopCanopy&&!run.some(({e})=>doorAllowed.has(e))&&!first.hole&&fallbackBuilding.streetAppearance?.profiles.some(p=>p.recipes.some(r=>r.recipe.shopCanopy))){
        // A front split entirely into sub-door-width facets still has its observed canopy.
        // Apply exactly the usual source/profile admission and street visibility to its run;
        // this exception accepts only a recipe carrying the explicit canopy assembly.
        const end=run[run.length-1].e,full={...first,x1:end.x1,y1:end.y1,len:Math.hypot(end.x1-first.x0,end.y1-first.y0)};
        const candidate=streetWallBuilding(fallbackBuilding,full,origin,!streetGrid||streetDistance(full,streetGrid,wallGrid,bi)<Infinity);
        if(candidate.recipe?.shopCanopy)b=candidate;
      }
      const runScale = frontageLayoutScale(b.recipe, scale, b.style, run.reduce((sum,r)=>sum+r.e.len,0));
      const [r, g, bl] = b === fallbackBuilding ? wallRGB : parseHex(b.wallHex);
      const accent = b === fallbackBuilding ? wallAccent : parseHex(b.accentHex ?? '#ffffff');
      if (b.recipe) crownFronts.push({ start:[first.x0,first.y0],end:[run[run.length-1].e.x1,run[run.length-1].e.y1],normal:[first.nx,first.ny],tint:[r*jitter,g*jitter,bl*jitter],plainLayer:b.plainLayer,recipe:b.recipe,frameHex:b.recipe.frameHex??'#e6e1d4',glassHex:b.streetAppearance?.look==='cartoon'?'#68a2bf':'#35464f' });
      if(b.surveyedEnvelope&&b.plainLayer!==undefined)for(const {e}of run)for(const s of sourceEdgeFor(b,e)!.segments){
        if(Math.max(s.z0,s.z1)-top<1e-7)continue;
        const point=(t:number,z:number):[number,number,number]=>[e.x0+(e.x1-e.x0)*t,e.y0+(e.y1-e.y0)*t,z];
        const A=point(s.t0,top),B=point(s.t1,top),C=point(s.t1,s.z1),D=point(s.t0,s.z0),uv=(p:[number,number,number]):[number,number]=>[Math.hypot(p[0]-e.x0,p[1]-e.y0)/5,p[2]/3],n:[number,number,number]=[e.nx,e.ny,0];
        for(const p of [[A,B,C],[A,C,D]]as [number,number,number][][]){if(Math.hypot(...p[0].map((v,i)=>v-p[1][i]))<1e-8||Math.hypot(...p[0].map((v,i)=>v-p[2][i]))<1e-8)continue;cornice.push({p:p as RoofTri['p'],uv:p.map(uv)as RoofTri['uv'],part:'plate',n,facadeLayer:b.plainLayer,facadeTint:[r*jitter,g*jitter,bl*jitter]});}
      }
      const paintTint = b === fallbackBuilding ? groundPaint : b.groundHex && b.layers ? parseHex(b.groundHex) : null;
      const layout = b.bare ? null : layoutRun(b.style, run.map(r => r.e.len), top - base, hash01(`${b.id}:${edgeKey(first.x0, first.y0)}`), base < 0.5, runScale, run.map(r => doorAllowed.has(r.e)));
      if(layout&&b.recipe?.facadeAssembly==='stacked-open-balcony'&&base<.5){
        const center=(layout.bays-1)/2;
        const eligible=Array.from({length:layout.bays},(_,i)=>i).filter(i=>{
          const x=(i+.5)*layout.bayWidthM;
          return run.some((r,k)=>doorAllowed.has(r.e)&&x>=layout.edgeStartM[k]&&x<=layout.edgeStartM[k]+r.e.len);
        });
        // The same street-facing access module owns its door and vertical balcony stack.
        layout.doorBays=eligible.length?[eligible.reduce((a,c)=>Math.abs(c-center)<Math.abs(a-center)?c:a)]:[];
      }
      if (!layout) {
        // With the top owned here, a wall too short for a layout (a corner chamfer) is still walled, in bare wall.
        if (b.lid && b.plainLayer !== undefined && top > base + 0.01) for (const { e } of run) {
          quads.push({ e, u0: 0, u1: Math.max(1, e.len / 5), v1: 1, layer: b.plainLayer, accent, z0: base, z1: top, tint: [Math.min(255, r * jitter), Math.min(255, g * jitter), Math.min(255, bl * jitter), wallShade(e.nx, e.ny) * 255], along0: 0, along1: 1 });
        }
        continue;
      }
      // Doors first, so the stoops and pediments the extras hang on a door follow them.
      if (b.plainWalls && b.plainLayer !== undefined) layout.doorBays.length = 0;
      // A shop fills its ground floor; only a wide front keeps a separate door to the floors above.
      if (b.shopfront && layout.bays < 3) layout.doorBays.length = 0;
      const bw = layout.bayWidthM, groundTop = base + layout.groundM;
      const compound=b.recipe?.compoundFrontage&&b.layers&&b.plainLayer!==undefined&&base<.5
        &&run.every(({e})=>!e.hole&&Math.abs(e.nx-first.nx)+Math.abs(e.ny-first.ny)<1e-6)
        ?planCompoundFrontage({lengthM:layout.lengthM,baseM:base,topM:top,recipe:b.recipe.compoundFrontage,direction:compoundDirection(b,first,origin)}):undefined;
      if(compound&&mode==='walls')frontageTriangles.push(...compoundTriangles(compound,first,b));
      const regular=b.recipe?.regularCanalFrontage&&b.layers&&b.plainLayer!==undefined&&base<.5
        &&run.every(({e})=>!e.hole&&Math.abs(e.nx-first.nx)+Math.abs(e.ny-first.ny)<1e-6)
        ?planRegularCanalFrontage({lengthM:layout.lengthM,baseM:base,topM:top,recipe:b.recipe.regularCanalFrontage,direction:compoundDirection(b,first,origin)}):undefined;
      if(regular&&mode==='walls')frontageTriangles.push(...regularCanalTriangles(regular,first,b));
      const terrace=b.recipe?.repeatedTerraceFrontage&&b.layers&&b.plainLayer!==undefined&&base<.5
        &&run.every(({e})=>!e.hole&&Math.abs(e.nx-first.nx)+Math.abs(e.ny-first.ny)<1e-6)
        ?planRepeatedTerraceFrontage({lengthM:layout.lengthM,baseM:base,topM:top,recipe:b.recipe.repeatedTerraceFrontage,direction:compoundDirection(b,first,origin)}):undefined;
      if(terrace&&mode==='walls')frontageTriangles.push(...regularCanalTriangles(terrace,first,b));
      // Defining window groups live in the wall chunk, so near-detail LOD cannot erase them.
      const interwar = b.recipe?.interwarFrontage && b.layers && b.plainLayer !== undefined
        && run.every(({e}) => !e.hole && Math.abs(e.nx-first.nx)+Math.abs(e.ny-first.ny)<1e-6)
        ? planInterwarFrontage({lengthM:layout.lengthM,baseM:base,topM:top,groundM:layout.groundM,recipe:b.recipe.interwarFrontage,...interwarRowPhase(b,first,origin,layout.lengthM)}) : undefined;
      if(interwar && mode==='walls') frontageTriangles.push(...interwarTriangles(interwar,first,b));
      const groundFrontage=b.recipe?.interwarGround&&b.layers&&b.plainLayer!==undefined&&base<.5&&interwar
        ? planInterwarGroundFrontage({lengthM:layout.lengthM,baseM:base,groundM:layout.groundM,recipe:b.recipe.interwarGround}) : undefined;
      if(groundFrontage){
        const look=b.streetAppearance?.look==='procedural'?'photo':b.streetAppearance?.look??'photo';
        const shop=bayLookFor(b.id,b.streetAppearance?.year??null,b.heightM,look,'shopWindow',b.recipe);
        const offset=b.streetAppearance?.look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
        b={...b,layers:{...b.layers!,ground:shop.layers.ground+offset}};
        if(mode==='walls')frontageTriangles.push(...interwarGroundTriangles(groundFrontage,first,b));
      }
      groundSeen = Math.min(groundSeen, layout.groundM);
      // Polygon vertices do not create additional observed stacks: one eligible facet owns
      // each continuous facade. Keep relief contained on that facet, without seam matching.
      const assemblyOwnerEdge = extraSink && b.recipe?.facadeAssembly ? run.reduce((best, { e }, k) =>
        !e.hole && e.len >= 2.5 && doorAllowed.has(e) && (best < 0 || e.len > run[best].e.len + 1e-6) ? k : best, -1) : -1;
      // A canopy spans eligible continuous facets, never a rear facet, hole or hidden party wall.
      // Collinear vertices are merged by the assembly, so tessellation cannot spend its budget.
      const canopyRuns=new Map<number,NonNullable<ExtraContext['canopyFrames']>>();
      if(extraSink&&b.recipe?.shopCanopy){
        let start=-1,frames:NonNullable<ExtraContext['canopyFrames']>[number][]=[];
        const finish=()=>{if(start>=0&&frames.reduce((sum,f)=>sum+f.len,0)>=2.5)canopyRuns.set(start,frames);start=-1;frames=[];};
        run.forEach(({e},k)=>{
          // The door test deliberately rejects tiny facets; a continuous canopy still owns
          // those surveyed pieces when the same street visibility test supports them.
          if(e.hole||!(doorAllowed.has(e)||e.len<2.4&&(!streetGrid||streetDistance(e,streetGrid,wallGrid,bi)<Infinity))){finish();return;}
          if(start<0)start=k;
          frames.push({x0:e.x0,y0:e.y0,ux:(e.x1-e.x0)/e.len,uy:(e.y1-e.y0)/e.len,nx:e.nx,ny:e.ny,len:e.len});
        });
        finish();
      }
      run.forEach(({ e }, k) => {
        walls++;
        const s = layout.edgeStartM[k];
        if (extraSink && !b.plainWalls && !e.hole && ((b.recipe?.openingGroup ? k === 0 && layout.lengthM >= 2.5 : e.len >= 2.5) || canopyRuns.has(k))) wallExtraContexts.push({ id: b.id, style: b.style, wallKey: edgeKey(e.x0, e.y0), f: { x0: e.x0, y0: e.y0, ux: (e.x1 - e.x0) / e.len, uy: (e.y1 - e.y0) / e.len, nx: e.nx, ny: e.ny, len: b.recipe?.openingGroup ? layout.lengthM : e.len }, base, top, layout: b.recipe?.openingGroup ? layout : edgeLayout(layout, k, e.len), wallHex: b.wallHex, accentHex: b.accentHex ?? '#ffffff', groundLevel: base < 0.5, period: b.period, recipe: b.recipe, runStart: k === 0, runEnd: k === run.length - 1, assemblyOwner: b.recipe?.facadeAssembly ? k === assemblyOwnerEdge : undefined, canopyOwner: b.recipe?.shopCanopy ? canopyRuns.has(k) : undefined, canopyFrames: canopyRuns.get(k), groundFrontageActive:!!(groundFrontage||compound||regular||terrace), openings: b.recipe ? recipeBayOpenings(b.id, b.recipe, b.streetAppearance?.look === 'procedural' ? 'photo' : b.streetAppearance?.look ?? 'photo') : b.openings, streetSide: canopyRuns.has(k) || (b.recipe?.openingGroup ? run.some(r=>doorAllowed.has(r.e)) : doorAllowed.has(e)), shopfront: !!(b.shopfront || b.shop), roofKind: b.roof ? b.roof.plan.kind : 'flat' });
        // A projecting cornice under the flat lid: one sloped strip that catches the light and throws a shadow line.
        if (!b.surveyedEnvelope && !b.roof && b.plainLayer !== undefined && CORNICE_STYLES.has(b.style) && e.len >= 3.5 && !e.hole) {
          const z = top - 0.05, out = 0.26, drop = 0.22, nx = e.nx * out, ny = e.ny * out;
          const A: [number, number, number] = [e.x0, e.y0, z], B: [number, number, number] = [e.x1, e.y1, z];
          const C: [number, number, number] = [e.x1 + nx, e.y1 + ny, z - drop], D: [number, number, number] = [e.x0 + nx, e.y0 + ny, z - drop];
          const n: [number, number, number] = [e.nx * drop, e.ny * drop, out], l = Math.hypot(...n);
          const nn: [number, number, number] = [n[0] / l, n[1] / l, n[2] / l], u1 = e.len / 5;
          cornice.push({ p: [A, D, C], uv: [[0, 0], [0, 0.1], [u1, 0.1]], part: 'plate', n: nn }, { p: [A, C, B], uv: [[0, 0], [u1, 0.1], [u1, 0]], part: 'plate', n: nn });
        }
        const tint: [number, number, number, number] = [Math.min(255, r * jitter), Math.min(255, g * jitter), Math.min(255, bl * jitter), wallShade(e.nx, e.ny) * 255];
        const paint = paintTint ? [paintTint[0], paintTint[1], paintTint[2], tint[3]] as [number, number, number, number] : tint;
        // u counts bays along the whole run, so the bay grid carries on round a kink.
        if(compound||regular||terrace||groundFrontage){
          for(const piece of (compound??regular??terrace??groundFrontage!).wallSegments){
            const a=Math.max(s,piece.left),end=Math.min(s+e.len,piece.left+piece.width);if(end<=a)continue;
            quads.push({e,u0:a/5,u1:end/5,v0:piece.bottom/3,v1:(piece.bottom+piece.height)/3,tint,layer:b.plainLayer!,accent,z0:piece.bottom,z1:piece.bottom+piece.height,along0:(a-s)/e.len,along1:(end-s)/e.len});
          }
        }else for (const piece of edgeGroundPieces(layout, k, e.len)) {
          quads.push({ e, u0: piece.a0 / bw, u1: piece.a1 / bw, v1: 1, tint: (piece.door && !b.recipe?.groundWallHex) || b.plainWalls ? tint : paint, layer: b.plainWalls && b.plainLayer !== undefined ? b.plainLayer : b.layers ? (piece.door ? b.layers.door : b.layers.ground) : cellLayer(b.style, piece.door ? 'door' : b.shop ? 'shop' : 'ground', variant), accent, z0: base, z1: groundTop, along0: (piece.a0 - s) / e.len, along1: (piece.a1 - s) / e.len });
        }
        if (!compound&&!regular&&!terrace&&layout.storeys > 0) quads.push({ e, u0: s / bw, u1: (s + e.len) / bw, v1: layout.storeys, layer: (b.plainWalls || interwar) && b.plainLayer !== undefined ? b.plainLayer : b.layers ? b.layers.upper : cellLayer(b.style, 'upper', variant), accent, z0: groundTop, z1: top, tint, along0: 0, along1: 1 });
      });
    }
    const clampToSource=(q:Quad):Quad[]=>{
      const source=sourceEdgeFor(b,q.e);if(!source)return[q];const out:Quad[]=[];
      for(const s of source.segments){const a=Math.max(q.along0,s.t0),end=Math.min(q.along1,s.t1);if(end-a<1e-10)continue;
        const height=(t:number)=>s.z0+(s.z1-s.z0)*(t-s.t0)/(s.t1-s.t0),breaks=[a,end];
        if(Math.abs(s.z1-s.z0)>1e-9)for(const z of[q.z0,q.z1]){const t=s.t0+(z-s.z0)*(s.t1-s.t0)/(s.z1-s.z0);if(t>a&&t<end)breaks.push(t);}breaks.sort((a,b)=>a-b);
        for(let i=1;i<breaks.length;i++){const left=breaks[i-1],right=breaks[i],zl=Math.max(q.z0,Math.min(q.z1,height(left))),zr=Math.max(q.z0,Math.min(q.z1,height(right)));if(Math.max(zl,zr)-q.z0<1e-8)continue;const u=(t:number)=>q.u0+(q.u1-q.u0)*(t-q.along0)/(q.along1-q.along0),v=(z:number)=>(q.v0??0)+(q.v1-(q.v0??0))*(z-q.z0)/(q.z1-q.z0);out.push({...q,along0:left,along1:right,u0:u(left),u1:u(right),z1Left:zl,z1Right:zr,v1Left:v(zl),v1Right:v(zr)});}
      }return out;
    };
    // Clip conflicting wall rectangles while retaining their original UV grid.
    const visibleQuads = quads.flatMap(q => subtractWallCuts(q, wallCuts.get(q.e) ?? [], (p, r) => {
      const u = (a: number) => p.u0 + (p.u1 - p.u0) * (a - p.along0) / (p.along1 - p.along0);
      const v = (z: number) => (p.v0 ?? 0) + (p.v1 - (p.v0 ?? 0)) * (z - p.z0) / (p.z1 - p.z0);
      return { ...p, ...r, u0: u(r.along0), u1: u(r.along1), v0: v(r.z0), v1: v(r.z1) };
    })).flatMap(clampToSource);
    let roof: StreetCrownTri[] = cornice;
    if(b.surveyedEnvelope){
      roof.push(...b.surveyedEnvelope.roofTriangles.map(t=>({...t,uv:t.p.map(p=>[p[0]/5,p[1]/5])as RoofTri['uv'],part:'trim' as const,hex:'#4a525d'})),...b.surveyedEnvelope.closureTriangles.map(t=>({...t,uv:t.p.map(p=>[p[0]/5,p[2]/3])as RoofTri['uv'],part:'plate' as const,facadeLayer:b.plainLayer})));
    }else if (b.roof) {
      roof = roofTrianglesForOutline(b.polygons[0]?.[0] ?? [], origin, b.roof.plan, b.heightM, b.roof.dims, kxLocal);
      if (crownFronts.length&&!b.roof.plan.repeatedTerrace) roof = streetCrown(roof,crownFronts,b.heightM,['gable','pitched','halfHipped'].includes(b.roof.plan.kind)&&!b.roof.plan.shutters);
    }
    const walled = mode === 'walls';
    const lid = walled && !b.surveyedEnvelope && b.lid && (!b.roof || !roof.length || b.roof.plan.keepLid) ? lidMesh(b, origin) : null;
    // Walls mode carries the signature storefront; extras mode only the extras.
    const sign: SignTri[] = [...frontageTriangles,...(walled && b.signature && b.lid ? signatureTris(b.signature, edges, b.minHeightM, origin) : [])];
    // A chain supermarket's fascia goes on a street wall (else any exposed wall) nearest its point.
    if (walled && b.chain && b.lid) {
      const exposed = edges.filter(e => !e.hole && !hiddenByNeighbour(e, b));
      const street = exposed.filter(e => doorAllowed.has(e));
      sign.push(...chainFrontTris(b.chain, street.length ? street : exposed.length ? exposed : edges, b.minHeightM, groundSeen < Infinity ? groundSeen : 3.2, origin));
    }
    if (extraSink) {
      buildingWallExtras(wallExtraContexts, extraSink);
      // Roof extras on a flat roof only (a pitched roof has its own chimneys and dormers).
      if (!b.surveyedEnvelope && (!b.roof || b.roof.plan.kind === 'parapet')) {
        const outer = b.polygons[0]?.[0] ?? [];
        const rect = fitRect(outer.map(([lng, lat]) => [(lng - origin.lng) * kxLocal, (lat - origin.lat) * M_PER_DEG_LAT] as [number, number]), 40);
        if (rect && rect.coverage > 0.75 && rect.len > 4 && rect.wid > 4) roofExtras({ id: b.id, style: b.style, rect, z: b.heightM, wallHex: b.wallHex }, extraSink);
      }
      sign.push(...extraSink.tris);
    }
    if (!walled) { quads.length = 0; visibleQuads.length = 0; roof = []; }
    signTotal += sign.length;
    quadsByBuilding.push({ b, quads: visibleQuads, walls, roof, lid, sign });
    quadTotal += visibleQuads.length; wallTotal += walls; roofTotal += roof.length;
    if (lid) { lidVerts += lid.xy.length / 2; lidIndices += lid.index.length; }
  }

  // Equal-height flat tops can overlap even when neither footprint contains the
  // other (Centraal's mapped parts). Give the intersection one stable owner.
  const lids = [
    ...quadsByBuilding.filter(x => x.lid).map(x => ({...x, contextOnly:false, target:x})),
    ...contextPrepared.map(p=>p.b).filter(b=>!b.surveyedEnvelope && b.lid && (!b.roof || b.roof.plan.keepLid)).map(b => ({b,lid:lidMesh(b,origin),contextOnly:true,target:null})),
  ].filter(x=>x.lid).sort((a,b)=>a.b.id.localeCompare(b.b.id));
  type PriorLid = { z: number; tri: Point2[]; box: number[] };
  const prior = new Map<string, PriorLid[]>();
  const lidCells = (box: number[]) => {
    const keys: string[] = [];
    for(let x=Math.floor(box[0]/25);x<=Math.floor(box[2]/25);x++) for(let y=Math.floor(box[1]/25);y<=Math.floor(box[3]/25);y++) keys.push(`${x},${y}`);
    return keys;
  };
  lidVerts = 0; lidIndices = 0;
  for (const item of lids) {
    const original = item.lid!, xy: number[] = [], index: number[] = [];
    let changed = false;
    for (let k = 0; k < original.index.length; k += 3) {
      const tri = original.index.slice(k, k + 3).map(i => [original.xy[i * 2], original.xy[i * 2 + 1]] as Point2);
      const box = [Math.min(...tri.map(p=>p[0])), Math.min(...tri.map(p=>p[1])), Math.max(...tri.map(p=>p[0])), Math.max(...tri.map(p=>p[1]))];
      if(item.contextOnly) {
        const record={z:item.b.heightM,tri,box};
        for(const cell of lidCells(box)){const key=`${Math.floor(item.b.heightM/.002)}:${cell}`;const bucket=prior.get(key)??[];bucket.push(record);prior.set(key,bucket);}
        continue;
      }
      let pieces = [tri];
      for (const other of new Set(lidCells(box).flatMap(key=>[-1,0,1].flatMap(dz=>prior.get(`${Math.floor(item.b.heightM/.002)+dz}:${key}`) ?? [])))) {
        if (Math.abs(other.z-item.b.heightM)>.002 || box[0]>=other.box[2] || box[2]<=other.box[0] || box[1]>=other.box[3] || box[3]<=other.box[1]) continue;
        pieces = pieces.flatMap(p => subtractConvex(p, other.tri));
      }
      if(pieces.length!==1 || pieces[0]!==tri) changed=true;
      for (const p of pieces) {
        if (polygonArea(p)<1e-6) continue;
        const start=xy.length/2; xy.push(...p.flat());
        for(let j=1;j<p.length-1;j++) index.push(start,start+j,start+j+1);
      }
      // Also catch overlapping polygons/triangles within one mapped feature.
      const record={z:item.b.heightM,tri,box};
      for(const cell of lidCells(box)) { const key=`${Math.floor(item.b.heightM/.002)}:${cell}`; const bucket=prior.get(key) ?? [];bucket.push(record);prior.set(key,bucket); }
    }
    if(item.target){item.target.lid=changed?{xy,index}:original;lidVerts+=item.target.lid.xy.length/2;lidIndices+=item.target.lid.index.length;}
  }
  const vertexCount = quadTotal * 4 + roofTotal * 3 + lidVerts + signTotal * 3;
  const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const layers = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4), accents = new Uint8Array(vertexCount * 4);
  const indices = new Uint32Array(quadTotal * 6 + roofTotal * 3 + lidIndices + signTotal * 3);
  const ranges: VertexRange[] = [];
  let v = 0, q = 0, ti = quadTotal * 6;
  for (const { b, quads, roof, lid, sign } of quadsByBuilding) {
    if (!quads.length && !roof.length && !lid && !sign.length) continue;
    const start = v;
    for (const quad of quads) {
      const { e } = quad;
      // Sub-span of the wall this quad covers (a ground run is a slice).
      const ax = e.x0 + (e.x1 - e.x0) * quad.along0, ay = e.y0 + (e.y1 - e.y0) * quad.along0;
      const bx = e.x0 + (e.x1 - e.x0) * quad.along1, by = e.y0 + (e.y1 - e.y0) * quad.along1;
      const corners: Array<[number, number, number, number, number]> = [
        [ax, ay, quad.z0, quad.u0, quad.v0 ?? 0], [bx, by, quad.z0, quad.u1, quad.v0 ?? 0], [bx, by, quad.z1Right??quad.z1, quad.u1, quad.v1Right??quad.v1], [ax, ay, quad.z1Left??quad.z1, quad.u0, quad.v1Left??quad.v1],
      ];
      for (const [x, y, z, u, vv] of corners) {
        positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z;
        uvs[v * 2] = u; uvs[v * 2 + 1] = vv;
        layers[v] = quad.layer;
        tints[v * 4] = quad.tint[0]; tints[v * 4 + 1] = quad.tint[1]; tints[v * 4 + 2] = quad.tint[2]; tints[v * 4 + 3] = quad.tint[3];
        accents[v * 4] = quad.accent[0]; accents[v * 4 + 1] = quad.accent[1]; accents[v * 4 + 2] = quad.accent[2]; accents[v * 4 + 3] = 255;
        v++;
      }
      const i = v - 4;
      indices.set([i, i + 1, i + 2, i, i + 2, i + 3], q * 6);
      q++;
    }
    if (roof.length) {
      const [wr, wg, wb] = parseHex(b.wallHex), [rr, rg, rb] = parseHex(b.roof?.roofHex ?? b.wallHex);
      const jitter = 0.9 + hash01(`${b.id}:tone`) * 0.2, white: [number, number, number] = [255, 255, 255];
      const defaultWallTint = [wr*jitter,wg*jitter,wb*jitter];
      for (const t of roof) {
        const shade = Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
        const wall = t.part === 'plate' || t.part === 'dormerFace', flat = t.part === 'trim' || t.part === 'decal';
        // Trim and decals (white stone, cornices, shutters) are flat colour on the lid's flat layer.
        const layer = flat ? (b.lid?.flatLayer ?? b.roof?.layers.slope ?? b.lid!.flatLayer) : t.part === 'plate' ? (t.facadeLayer ?? b.plainLayer ?? b.roof?.layers.plain ?? b.plainLayer!) : t.part === 'dormerFace' ? b.roof?.layers.dormer ?? b.plainLayer! : b.roof?.layers.slope ?? b.lid!.flatLayer;
        const tint = t.hex ? parseHex(t.hex) : flat ? white : wall ? t.facadeTint ?? defaultWallTint : [rr, rg, rb];
        for (let k = 0; k < 3; k++) {
          positions[v * 3] = t.p[k][0]; positions[v * 3 + 1] = t.p[k][1]; positions[v * 3 + 2] = t.p[k][2];
          uvs[v * 2] = t.uv[k][0]; uvs[v * 2 + 1] = t.uv[k][1];
          layers[v] = layer;
          tints[v * 4] = Math.min(255, tint[0]); tints[v * 4 + 1] = Math.min(255, tint[1]); tints[v * 4 + 2] = Math.min(255, tint[2]); tints[v * 4 + 3] = shade * 255;
          const acc = b.accentHex ? parseHex(b.accentHex) : white;
          accents[v * 4] = acc[0]; accents[v * 4 + 1] = acc[1]; accents[v * 4 + 2] = acc[2]; accents[v * 4 + 3] = 255;
          indices[ti++] = v; v++;
        }
      }
    }
    if (lid) {
      // Indexed: earcut shares the ring's vertices, a third of the cost of loose triangles.
      const [lr, lg, lb] = parseHex(b.lid!.hex), base = v, z = b.heightM;
      for (let k = 0; k < lid.xy.length; k += 2) {
        positions[v * 3] = lid.xy[k]; positions[v * 3 + 1] = lid.xy[k + 1]; positions[v * 3 + 2] = z;
        uvs[v * 2] = lid.xy[k] / 4; uvs[v * 2 + 1] = lid.xy[k + 1] / 4;
        layers[v] = b.lid!.flatLayer;
        tints[v * 4] = lr; tints[v * 4 + 1] = lg; tints[v * 4 + 2] = lb; tints[v * 4 + 3] = LID_SHADE * 255;
        accents[v * 4] = accents[v * 4 + 1] = accents[v * 4 + 2] = accents[v * 4 + 3] = 255;
        v++;
      }
      for (const k of lid.index) indices[ti++] = base + k;
    }
    for (const t of sign) {
      // Signature storefront boxes: flat colour on the flat layer, shaded by facing.
      const shade = Math.max(t.lit ? 0.9 : 0.55, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
      const [sr, sg, sb] = parseHex(t.hex);
      for (const [qi,q] of t.p.entries()) {
        positions[v * 3] = q[0]; positions[v * 3 + 1] = q[1]; positions[v * 3 + 2] = q[2];
        uvs[v * 2] = t.uv?.[qi][0] ?? 0.5; uvs[v * 2 + 1] = t.uv?.[qi][1] ?? 0.5;
        layers[v] = t.layer ?? (t.texture === 'glass-block' ? BAY_LAYER_COUNT + (b.streetAppearance?.look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET : PROCEDURAL_RECIPE_LAYER_OFFSET - CELL_LAYER_COUNT) : b.lid!.flatLayer);
        tints[v * 4] = sr; tints[v * 4 + 1] = sg; tints[v * 4 + 2] = sb; tints[v * 4 + 3] = shade * 255;
        const acc=t.accentHex?parseHex(t.accentHex):[255,255,255];
        accents[v * 4] = acc[0]; accents[v * 4+1]=acc[1]; accents[v * 4+2]=acc[2]; accents[v * 4+3]=255;
        indices[ti++] = v; v++;
      }
    }
    ranges.push({ id: b.id, start, count: v - start });
  }
  const chunk = { positions, uvs, layers, tints, accents, indices, ranges, vertexCount, quadCount: quadTotal + Math.ceil(roofTotal / 2), wallCount: wallTotal, buildingCount: ranges.length };
  return mode === 'walls' ? applyHostWallOpenings(chunk, origin, hostOpenings) : chunk;
}


/** Carry the observed repeating subtype along its admitted street, across physical Pand boundaries. */
function compoundDirection(b:MeshBuilding,e:Edge,origin:Origin):1|-1 {
  const profile=b.streetAppearance?.profiles.find(p=>p.id===b.recipe?.profileId);
  if(!profile)return 1;
  const [a,c]=profile.segment,kx=111320*Math.cos(origin.lat*Math.PI/180);
  const dx=(c[0]-a[0])*kx,dy=(c[1]-a[1])*110540;
  return (e.x1-e.x0)*dx+(e.y1-e.y0)*dy<0?-1:1;
}

function interwarRowPhase(b:MeshBuilding,e:Edge,origin:Origin,lengthM:number):{projectionPhase:number;projectionStep:1|-1} {
  const profile=b.streetAppearance?.profiles.find(p=>p.id===b.recipe?.profileId);
  if(!profile)return {projectionPhase:0,projectionStep:1};
  const kx=111320*Math.cos(origin.lat*Math.PI/180),[a,c]=profile.segment;
  const ax=(a[0]-origin.lng)*kx,ay=(a[1]-origin.lat)*110540,dx=(c[0]-a[0])*kx,dy=(c[1]-a[1])*110540,len=Math.hypot(dx,dy);
  if(!len)return {projectionPhase:0,projectionStep:1};
  const start=(e.x0-ax)*dx/len+(e.y0-ay)*dy/len;
  const end=(e.x1-ax)*dx/len+(e.y1-ay)*dy/len;
  return interwarStreetPhase(start,end,lengthM,b.recipe!.interwarFrontage!.groupPitchM);
}


/** True cut portico backs, source shop glass and a separate customer door remain textured. */
function interwarGroundTriangles(plan:InterwarGroundFrontagePlan,e:Edge,b:MeshBuilding):SignTri[] {
  const r=b.recipe!.interwarGround!,openings=recipeBayOpenings(b.id,b.recipe!,b.streetAppearance?.look==='procedural'?'photo':b.streetAppearance?.look??'photo');
  const ux=(e.x1-e.x0)/e.len,uy=(e.y1-e.y0)/e.len;
  const world=([a,o,z]:number[]):[number,number,number]=>[e.x0+ux*a+e.nx*o,e.y0+uy*a+e.ny*o,z];
  const material=(q:InterwarGroundFrontagePlan['quads'][number])=>{
    // The stock school door contains a fanlight and an overpainted floor band.
    // Use its rectangular relief panel, while the recessed geometry owns access.
    if(q.role==='door')return {layer:b.layers!.door,hex:'#35413d',rect:[openings.door.axis-openings.door.width/2+14/520,openings.door.top-148/340,openings.door.width-28/520,66/340]};
    // Keep the painted glazing gradient above the school cell's floor band.
    if(q.role==='shopGlass'||q.role==='shopDoor')return {layer:b.layers!.ground,hex:'#ffffff',rect:[.42,.24,.06,.31]};
    return {layer:q.role==='wall'?b.plainLayer!:b.lid!.flatLayer,hex:q.role==='wall'?b.wallHex:r.frameHex??b.recipe!.frameHex??'#e5e5d8',rect:[.5,.5,0,0]};
  };
  const tris=plan.quads.flatMap(q=>{
    const m=material(q),n:[number,number,number]=[ux*q.normal[0]+e.nx*q.normal[1],uy*q.normal[0]+e.ny*q.normal[1],q.normal[2]],p=q.points.map(world);
    const uv=q.uv.map(([u,v]):[number,number]=>[m.rect[0]+m.rect[2]*u,m.rect[1]+m.rect[3]*v]);
    return [[0,1,2],[0,2,3]].map(ids=>{
      const ab=p[ids[1]].map((v,i)=>v-p[ids[0]][i]),ac=p[ids[2]].map((v,i)=>v-p[ids[0]][i]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(cross.reduce((sum,v,i)=>sum+v*n[i],0)<0)ids=[ids[0],ids[2],ids[1]];
      return {p:ids.map(i=>p[i]),uv:ids.map(i=>uv[i]),n,hex:m.hex,layer:m.layer,accentHex:q.role==='door'?'#35413d':r.frameHex??b.recipe!.frameHex};
    });
  });
  // A small upright pull makes the source-selected glass customer leaf readable as access.
  if(plan.shopDoor){
    const door=plan.shopDoor.opening,a=door.left+door.width-.14,z=door.bottom+door.height*.45;
    const p=[[a,.065,z],[a+.035,.065,z],[a+.035,.065,z+.3],[a,.065,z+.3]].map(world),n:[number,number,number]=[e.nx,e.ny,0];
    for(const ids of [[0,1,2],[0,2,3]]){const ab=p[ids[1]].map((v,i)=>v-p[ids[0]][i]),ac=p[ids[2]].map((v,i)=>v-p[ids[0]][i]);if((ab[1]*ac[2]-ab[2]*ac[1])*n[0]+(ab[2]*ac[0]-ab[0]*ac[2])*n[1]<0)[ids[1],ids[2]]=[ids[2],ids[1]];tris.push({p:ids.map(i=>p[i]),uv:ids.map(()=>[.5,.5] as [number,number]),n,hex:'#454b49',layer:b.lid!.flatLayer,accentHex:r.frameHex??b.recipe!.frameHex});}
  }
  return tris;
}

/** Crop glass from the active atlas, while shared geometry owns white frames and transoms. */
/** Coupled zones and their cut access belong to ordinary wall LOD, including textures. */
function compoundTriangles(plan:CompoundFrontagePlan,e:Edge,b:MeshBuilding):SignTri[] {
  const openings=recipeBayOpenings(b.id,b.recipe!,b.streetAppearance?.look==='procedural'?'photo':b.streetAppearance?.look??'photo');
  const upper=openings.upper,width=upper.widths?.[0]??upper.width,axis=upper.axes[0];
  const ux=(e.x1-e.x0)/e.len,uy=(e.y1-e.y0)/e.len;
  const world=([a,o,z]:number[]):[number,number,number]=>[e.x0+ux*a+e.nx*o,e.y0+uy*a+e.ny*o,z];
  const frame=b.recipe!.frameHex??'#e5e5d8';
  return plan.quads.flatMap(q=>{
    const door=q.part==='access-door',glass=q.role==='glass';
    // The stock school cell has six-over-six muntins: the former -.21..-.13
    // crop included the first vertical bar. This narrower interior retains the
    // painted glass gradient, with room for filtering at both atlas resolutions.
    // Access geometry owns the rectangular head; sample only the relief leaf,
    // below doorAt's fanlight and above the school floor band painted over its
    // lower leaf. The complete upper relief panel supplies the dark leaf detail.
    const rect=door
      ?[openings.door.axis-openings.door.width/2+14/520,openings.door.top-148/340,openings.door.width-28/520,66/340]
      :glass?[axis-width*.24,upper.sill+(upper.head-upper.sill)*.10,width*.02,(upper.head-upper.sill)*.09]:[.5,.5,0,0];
    const p=q.points.map(world),uv=q.uv.map(([u,v],i):[number,number]=>q.role==='wall'&&q.part==='shaft-body'?[q.points[i][0]/5,q.points[i][2]/3]:[rect[0]+rect[2]*u,rect[1]+rect[3]*v]);
    const n:[number,number,number]=[ux*q.normal[0]+e.nx*q.normal[1],uy*q.normal[0]+e.ny*q.normal[1],q.normal[2]];
    return [[0,1,2],[0,2,3]].map(ids=>{
      const ab=p[ids[1]].map((v,i)=>v-p[ids[0]][i]),ac=p[ids[2]].map((v,i)=>v-p[ids[0]][i]);
      const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(cross.reduce((sum,v,i)=>sum+v*n[i],0)<0)ids=[ids[0],ids[2],ids[1]];
      return {p:ids.map(i=>p[i]),uv:ids.map(i=>uv[i]),n,
        layer:door?b.layers!.door:glass?b.layers!.upper:q.role==='wall'?b.plainLayer!:b.lid!.flatLayer,
        hex:door?'#35413d':glass?'#ffffff':q.role==='wall'?b.wallHex:q.role==='cap'?'#454b49':frame,accentHex:door?'#35413d':frame};
    });
  });
}

/** Regular source tiers share the audited quiet glazing/dark leaf crop, while
 * physical frames own pane subdivisions and pale stone remains a solid role. */
function regularCanalTriangles(plan:RegularCanalFrontagePlan|RepeatedTerraceFrontagePlan,e:Edge,b:MeshBuilding):SignTri[] {
  const openings=recipeBayOpenings(b.id,b.recipe!,b.streetAppearance?.look==='procedural'?'photo':b.streetAppearance?.look??'photo');
  const upper=openings.upper,width=upper.widths?.[0]??upper.width,axis=upper.axes[0];
  const ux=(e.x1-e.x0)/e.len,uy=(e.y1-e.y0)/e.len;
  const world=([a,o,z]:number[]):[number,number,number]=>[e.x0+ux*a+e.nx*o,e.y0+uy*a+e.ny*o,z];
  const frame=b.recipe!.frameHex??'#e5e5d8';
  return plan.quads.flatMap(q=>{
    const door=q.role==='door'||q.role==='door-panel',glass=q.role==='glass';
    const rect=door?[openings.door.axis-openings.door.width/2+14/520,openings.door.top-148/340,openings.door.width-28/520,66/340]
      :glass?[axis-width*.24,upper.sill+(upper.head-upper.sill)*.10,width*.02,(upper.head-upper.sill)*.09]:[.5,.5,0,0];
    if(q.role==='door-panel'){
      // Sample quiet timber, away from doorAt's handle/frame/head glyphs.
      rect[0]=openings.door.axis-openings.door.width*.18;
      rect[1]=openings.door.top-130/340;rect[2]=openings.door.width*.08;rect[3]=12/340;
    }
    const p=q.points.map(world),uv=q.uv.map(([u,v],i):[number,number]=>q.role==='wall'?[q.points[i][0]/5,q.points[i][2]/3]:[rect[0]+rect[2]*u,rect[1]+rect[3]*v]);
    const n:[number,number,number]=[ux*q.normal[0]+e.nx*q.normal[1],uy*q.normal[0]+e.ny*q.normal[1],q.normal[2]];
    return [[0,1,2],[0,2,3]].map(ids=>{
      const ab=p[ids[1]].map((v,i)=>v-p[ids[0]][i]),ac=p[ids[2]].map((v,i)=>v-p[ids[0]][i]);
      const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(cross.reduce((sum,v,i)=>sum+v*n[i],0)<0)ids=[ids[0],ids[2],ids[1]];
      const colour=q.role==='sash'?(b.recipe!.sashHex??'#244c3d'):q.part==='string-course'||q.part==='segmental-lintel'?(b.recipe!.courseHex??frame):undefined;
      return {p:ids.map(i=>p[i]),uv:ids.map(i=>uv[i]),n,
        layer:door?b.layers!.door:glass?b.layers!.upper:q.role==='wall'?b.plainLayer!:b.lid!.flatLayer,
        hex:colour??(door?(q.role==='door-panel'?'#526057':'#35413d'):glass?'#ffffff':q.role==='wall'?b.wallHex:q.role==='rail'?'#35413d':q.role==='door-hardware'?'#b5b49f':frame),
        accentHex:door?(q.role==='door-panel'?'#526057':'#35413d'):frame,
        lit:!!b.recipe!.repeatedTerraceFrontage&&(q.role==='frame'||q.role==='stone'||q.role==='glass')};
    });
  });
}

function interwarTriangles(plan:InterwarFrontagePlan,e:Edge,b:MeshBuilding):SignTri[] {
  const r=b.recipe!.interwarFrontage!,openings=recipeBayOpenings(b.id,b.recipe!,b.streetAppearance?.look==='procedural'?'photo':b.streetAppearance?.look??'photo').upper;
  const width=openings.widths?.[0]??openings.width,axis=openings.axes[0];
  const u0=axis-width*.24,u1=axis-width*.22;
  // The stock school first vertical muntin starts inside the former -.21..-.13
  // crop. This interior stays glazing through full/half atlas linear filtering.
  // Physical framing owns subdivisions.
  const v0=openings.sill+(openings.head-openings.sill)*.10,v1=openings.sill+(openings.head-openings.sill)*.19;
  const ux=(e.x1-e.x0)/e.len,uy=(e.y1-e.y0)/e.len;
  const world=([a,o,z]:number[]):[number,number,number]=>[e.x0+ux*a+e.nx*o,e.y0+uy*a+e.ny*o,z];
  return plan.quads.flatMap(q=>{
    const n:[number,number,number]=[ux*q.normal[0]+e.nx*q.normal[1],uy*q.normal[0]+e.ny*q.normal[1],q.normal[2]];
    const p=q.points.map(world),uv=q.uv.map(([u,v]):[number,number]=>q.role==='glass'?[u0+(u1-u0)*u,v0+(v1-v0)*v]:[.5,.5]);
    // Local wall frames may be left-handed in world XY; correct using actual world normals.
    const tri=(a:number,c:number,d:number):SignTri=>{
      let ids=[a,c,d];const ab=p[c].map((v,i)=>v-p[a][i]),ac=p[d].map((v,i)=>v-p[a][i]);
      const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(cross.reduce((sum,v,i)=>sum+v*n[i],0)<0)ids=[a,d,c];
      return {p:ids.map(i=>p[i]),uv:ids.map(i=>uv[i]),n,hex:q.role==='glass'?'#ffffff':q.role==='frame'?r.frameHex??b.recipe!.frameHex??'#e5e5d8':q.role==='cap'?r.capHex??'#454b49':b.wallHex,layer:q.role==='glass'?b.layers!.upper:b.lid!.flatLayer,accentHex:r.frameHex??b.recipe!.frameHex};
    };
    return [tri(0,1,2),tri(0,2,3)];
  });
}

/**
 * A chunk for landmark kits: pre-built triangles per part, with the layer chosen
 * by material kind (bare wall, flat colour, roof tiles) and the colour per
 * triangle. One range per part id, so a part can be hidden with the answer.
 */
export function buildKitChunk(parts: readonly KitPartGeometry[], layers: { plain: number; flat: number; slope: number; fatihMasonry?: number }): Chunk {
  let tris = 0;
  for (const part of parts) tris += part.tris.length;
  const vertexCount = tris * 3;
  const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const layerArr = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4), accents = new Uint8Array(vertexCount * 4).fill(255);
  const indices = new Uint32Array(vertexCount);
  const ranges: VertexRange[] = [];
  let v = 0;
  for (const part of parts) {
    if (!part.tris.length) continue;
    const start = v;
    for (const t of part.tris) {
      const [r, g, b] = parseHex(t.hex);
      const shade = Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
      for (let k = 0; k < 3; k++) {
        positions[v * 3] = t.p[k][0]; positions[v * 3 + 1] = t.p[k][1]; positions[v * 3 + 2] = t.p[k][2];
        uvs[v * 2] = t.uv[k][0]; uvs[v * 2 + 1] = t.uv[k][1];
        layerArr[v] = part.id === 'NL.IMBAG.Pand.0363100012167944' && t.layer === 'plain' && layers.fatihMasonry !== undefined ? layers.fatihMasonry : layers[t.layer];
        tints[v * 4] = r; tints[v * 4 + 1] = g; tints[v * 4 + 2] = b; tints[v * 4 + 3] = shade * 255;
        indices[v] = v; v++;
      }
    }
    ranges.push({ id: part.id, start, count: v - start });
  }
  return { positions, uvs, layers: layerArr, tints, accents, indices, ranges, vertexCount, quadCount: Math.ceil(tris / 2), wallCount: 0, buildingCount: ranges.length };
}
