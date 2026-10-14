// One streamed cell of the own ground (pure, DOM-free; built in the ground
// worker). The same layers as the prototype page (main.ts), restricted to
// what the cell owns so neighbouring cells never draw anything twice:
//
//   land grid     the cell rectangle exactly (grid aligned to global multiples
//                 of the step, so seams share vertices' heights)
//   water, quays  the cell's water polygons and shores (elevation-v1 clips them per cell)
//   decks         measured/flat decks whose first station lies in the cell
//   streets       OSM ways whose midpoint lies in the cell (the junction graph
//                 sees the 3×3 neighbourhood, so kerbs are trimmed at seams too)
//   areas         parks/squares/parking whose bbox centre lies in the cell
//
// LOD 0 is the prototype's detail. LOD 1 (the far ring) is a 10 m land grid,
// carriageways only (no kerbs, sidewalks or paint), coarser drape and walls.
//
// The water mask (signed distance, R = water, G = water minus decks) covers
// the cell plus what its streets and areas reach past it (capped), at 1 m
// (LOD 0) or 2 m (LOD 1).

import earcut from 'earcut';
import { buildWaterMask, maskDistance, maskTexels, quayWallMesh, waterSurfaceMesh, waterZAt, type WaterGeometry } from './water.js';
import { drapeTriangles, emptyMesh, gridHeight, merge, reliefGrid, type MeshArrays } from './drape.js';
import { buildStreets, isBridgeWay, prepareWays, resolvePriorSidewalks, LIFT, type LocalWay } from './streets.js';
import { flatDeckBody, footprintAxis, measuredDeckBody, measuredDeckTop, movableFrame, pointInRing, type DeckBuildInfo } from './decks.js';
import { pavedAreaSurface, type OsmGroundExtract } from './osmGround.js';
import { buildParks, cullCovered, drapeBisect, CULL_MARGIN_M, CULL_RES_M, SurfaceIndex, type ParkBuildStats, type ParksCell, type SurfaceRaster } from './parks.js';
import { fillPockets, POCKET_LIFT, type PocketCover, type PocketStats } from './pockets.js';
import type { DeckSurface, GroundSurface, Vec2 } from './surface.js';
import type { Rect } from './groundStore.js';

export type GroundLayer =
  | 'land' | 'park' | 'wood' | 'square' | 'parking'
  | 'lawn' | 'bed' | 'shrub' | 'bark' | 'sand' | 'parkGravel' | 'parkPath' | 'pond' | 'hedge' | 'furniture'
  | 'asphalt' | 'klinker' | 'cycle' | 'paving' | 'gravel' | 'kerb' | 'paint' | 'tram' | 'bollard'
  | 'water' | 'quay' | 'deckBody' | 'deckTop';

export const GROUND_LAYERS: readonly GroundLayer[] = ['land', 'park', 'wood', 'square', 'parking', 'lawn', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'pond', 'hedge', 'furniture', 'asphalt', 'klinker', 'cycle', 'paving', 'gravel', 'kerb', 'paint', 'tram', 'bollard', 'water', 'quay', 'deckBody', 'deckTop'];

/** Transferable mesh arrays. Colours are sRGB 0..1 when present. */
export interface PackedMesh { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array; colors?: Float32Array }

export interface GroundMask { x0: number; y0: number; res: number; width: number; height: number; texels: Uint8Array }

export interface BuiltCell {
  key: string;
  lod: 0 | 1;
  rect: Rect;
  layers: Partial<Record<GroundLayer, PackedMesh>>;
  mask: GroundMask | null;
  stats: { triangles: number; byLayer: Record<string, number>; ways: number; areas: number; decks: number; flatDecks: number; buildMs: number; bytes: number; bridges: BridgeStats; parks: (ParkBuildStats & { ms: number; fillCulled?: number; landCulled?: number }) | null; pockets?: PocketStats | null };
}

/** What the cell's bridges drew: deck tops, railing posts, piers, arches, abutments, movable frames (lane report, named regressions). */
export interface BridgeStats { tops: number; railed: number; railingPosts: number; piers: number; arches: number; abutments: number; frames: number; decks: DeckBuildInfo[]; flat: { id: string; railingPosts: number; frames: number }[] }

export interface CellInput {
  key: string;
  lod: 0 | 1;
  rect: Rect;
  surface: GroundSurface;
  water: WaterGeometry | null;
  /** Water of the 3×3 neighbourhood (for the mask's distances at seams). */
  waterAround: WaterGeometry[];
  decks: readonly DeckSurface[];
  /** Every placed deck's footprint near the cell (street mask exceptions). */
  deckRingsAround: readonly Vec2[][];
  flatDecks: readonly Vec2[][];
  /** Per flat deck (same order): register id and whether it is movable ('Beweegbare brug'). */
  flatDeckMeta?: readonly { id: string; movable: boolean }[];
  osm: OsmGroundExtract | null;
  osmAround: OsmGroundExtract[];
  /** The cell's parks (parks-v1), null when it has none or parks are off. */
  parks?: ParksCell | null;
  /** Parks of the 3×3 neighbourhood (a park's BGT surfaces lie in the cells of their own interior points). */
  parksAround?: readonly (ParksCell | null)[];
  /** Pave the land pockets near junctions (pockets.ts); default on at LOD 0. */
  pockets?: boolean;
  /** OSM path ways the 3×3 neighbourhood's park path polygons replace (not drawn as bands). */
  dropWays?: readonly number[];
  project: (lngLat: [number, number]) => Vec2;
}

/** How far the mask may extend past the cell, metres. */
const MASK_REACH_M = 150;
/** Canal-belt water surface, scene z (−0.40 m NAP under the +1.37 m NAP datum): the default where no polder level is known. */
export const CANAL_WATER_Z = -1.77;
/** Signed-distance range of the water mask (texels saturate at ±this), metres. */
export const MASK_RANGE_M = 4;
/** Coping cap on every quay wall, reaching this far inland over the land's cut edge (water.ts). */
export const QUAY_CAP_M = 0.35;

/** Area-weighted vertex normals (three's computeVertexNormals), here so the main thread need not. */
export function vertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]);
    if (l > 0) { n[k] /= l; n[k + 1] /= l; n[k + 2] /= l; } else n[k + 2] = 1;
  }
  return n;
}

export function packMesh(m: MeshArrays): PackedMesh {
  const positions = Float32Array.from(m.positions), indices = Uint32Array.from(m.indices);
  return { positions, normals: vertexNormals(positions, indices), uvs: Float32Array.from(m.uvs), indices, ...(m.colors ? { colors: Float32Array.from(m.colors) } : {}) };
}

export const packedTriangles = (m: PackedMesh) => m.indices.length / 3;
export const packedBytes = (m: PackedMesh) => m.positions.byteLength + m.normals.byteLength + m.uvs.byteLength + m.indices.byteLength + (m.colors?.byteLength ?? 0);

/** Transfer list for postMessage. */
export function cellTransferables(cell: BuiltCell): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const m of Object.values(cell.layers)) if (m) { out.push(m.positions.buffer as ArrayBuffer, m.normals.buffer as ArrayBuffer, m.uvs.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer); if (m.colors) out.push(m.colors.buffer as ArrayBuffer); }
  if (cell.mask) out.push(cell.mask.texels.buffer as ArrayBuffer);
  return out;
}

/**
 * The far ring's cross-section: every band, flat (no kerbs), no paint. It
 * used to keep carriageways only, so beyond 350 m a street's cycle tracks,
 * sidewalks and separate cycle paths vanished into the land's paving: the
 * De Clercqstraat block past the Bilderdijkstraat cell seam read as an open
 * grey plaza with a ragged strip of asphalt (named regression in
 * check-ground-cells.ts).
 */
function farSection(w: LocalWay): LocalWay {
  const bands = w.section.bands.map(b => (b.raised ? { ...b, raised: 0, kerb: 'none' as const } : b));
  return { ...w, section: { ...w.section, bands, paint: [], rails: [] } };
}

export function buildCell(input: CellInput): BuiltCell {
  const t0 = Date.now();
  const { key, lod, rect, surface } = input;
  const [x0, y0, x1, y1] = rect;
  const parts: Partial<Record<GroundLayer, MeshArrays[]>> = {};
  const add = (layer: GroundLayer, m: MeshArrays) => { if (m.indices.length) (parts[layer] ??= []).push(m); };

  // Streets: the cell's own ways, with the neighbourhood in the junction graph.
  const dropped = new Set<number>(input.dropWays ?? []);
  const seen = new Set<number>(dropped), all: LocalWay[] = [], own = new Set<number>();
  for (const extract of [input.osm, ...input.osmAround]) if (extract) for (const w of prepareWays(extract.ways, input.project)) {
    if (seen.has(w.id)) continue;
    seen.add(w.id); all.push(w);
  }
  for (const w of input.osm?.ways ?? []) if (!dropped.has(w.id)) own.add(w.id);
  const resolved = resolvePriorSidewalks(all);
  const ways = lod === 0 ? resolved : resolved.map(farSection);
  const areas = input.osm?.areas ?? [];

  // Mask extent: the cell plus what its ways and areas reach (capped).
  let mx0 = x0, my0 = y0, mx1 = x1, my1 = y1;
  const grow = (p: Vec2) => { mx0 = Math.min(mx0, p[0] - 8); my0 = Math.min(my0, p[1] - 8); mx1 = Math.max(mx1, p[0] + 8); my1 = Math.max(my1, p[1] + 8); };
  for (const w of ways) if (own.has(w.id)) w.points.forEach(grow);
  for (const a of areas) for (const r of a.rings) for (const p of r) grow(input.project(p));
  for (const d of input.decks) { grow([d.profile.bbox[0], d.profile.bbox[1]]); grow([d.profile.bbox[2], d.profile.bbox[3]]); }
  mx0 = Math.max(mx0, x0 - MASK_REACH_M); my0 = Math.max(my0, y0 - MASK_REACH_M); mx1 = Math.min(mx1, x1 + MASK_REACH_M); my1 = Math.min(my1, y1 + MASK_REACH_M);
  const res = lod === 0 ? 1 : 2;
  const geoAround: WaterGeometry = { polygons: input.waterAround.flatMap(g => g.polygons), shores: input.waterAround.flatMap(g => g.shores), levels: input.waterAround.flatMap(g => g.levels ?? g.polygons.map(() => CANAL_WATER_Z)) };
  const hasWater = geoAround.polygons.length > 0;
  const mask = hasWater ? buildWaterMask(geoAround, mx0, my0, mx1, my1, res, MASK_RANGE_M, input.deckRingsAround) : null;
  const overWater = (x: number, y: number) => !!mask && maskDistance(mask, x, y) < 0;
  const step = lod === 0 ? 5 : 10;
  // Everything flat on the land (areas, street bands) drapes on the land grid's own surface plus
  // the decks' lift, so the grid never pokes through between their vertices.
  const landZ = gridHeight(surface.ground, step);
  // On a deck the measured surface wins (blended over the deck's lateral blend).
  const onLand = (x: number, y: number) => {
    const h = surface.height(x, y), w = surface.deckWeight(x, y);
    return w >= 1 ? h : h * w + (landZ(x, y) + h - surface.ground(x, y)) * (1 - w);
  };

  // Land: the relief grid over the rectangle; quads deep inside a canal skipped.
  const gx0 = Math.floor(x0 / step) * step, gy0 = Math.floor(y0 / step) * step;
  // Grid on global multiples of the step, clipped to the cell by whole quads
  // whose centre is inside, so two cells never both draw a quad.
  const inCell = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const areaLayer: Record<string, GroundLayer> = { park: 'park', grass: 'park', wood: 'wood', square: 'square', paved: 'square', parking: 'parking' };
  // The BGT park surfaces (parks-v1) hide what lies under them: the OSM park fill and the land grid, where a whole
  // triangle / quad lies inside one surface (parks.ts cullCovered). The park surfaces drape at 8 m and sag a few
  // centimetres under the 5 m land grid in hollows (the Vondelpark showed land through its lawn once the fill went),
  // so the land goes too, but only under the cell's own surfaces (drawn by this build, never missing).
  const surveyed = lod === 0 && input.parksAround?.some(p => p?.surfaces.length) ? new SurfaceIndex([input.parks, ...(input.parksAround ?? [])]) : null;
  let cover: SurfaceRaster | null = null;
  if (surveyed) {
    const sb = surveyed.bounds()!, ab: [number, number, number, number] = [x0 - 10, y0 - 10, x1 + 10, y1 + 10];
    for (const a of areas) if (areaLayer[a.kind] === 'park') for (const r of a.rings) for (const q of r) { const [px, py] = input.project(q); ab[0] = Math.min(ab[0], px); ab[1] = Math.min(ab[1], py); ab[2] = Math.max(ab[2], px); ab[3] = Math.max(ab[3], py); }
    const box: [number, number, number, number] = [Math.max(sb[0], ab[0]) - 1, Math.max(sb[1], ab[1]) - 1, Math.min(sb[2], ab[2]) + 1, Math.min(sb[3], ab[3]) + 1];
    if (box[2] > box[0] && box[3] > box[1]) cover = surveyed.raster(box, CULL_RES_M);
  }
  let landCulled = 0;
  const underOwnSurface = (x: number, y: number) => {
    if (!cover || !surveyed) return false;
    const k = cover.find(x, y), h = step / 2 + CULL_MARGIN_M;
    if (k < 0 || k >= surveyed.own || !cover.uniform(x - h, y - h, x + h, y + h, k)) return false;
    landCulled++;
    return true;
  };
  const keepLand = (x: number, y: number) => inCell(x, y) && (!mask || maskDistance(mask, x, y) > -(step * 0.71 + 0.2)) && !underOwnSurface(x, y);
  add('land', reliefGrid(gx0, gy0, Math.ceil(x1 / step) * step, Math.ceil(y1 / step) * step, step, surface.ground, keepLand));

  // Areas.
  let parkFillCulled = 0;
  for (const a of areas) {
    const layer = a.kind === 'paved' ? pavedAreaSurface(a) : areaLayer[a.kind];
    if (!layer) continue;
    let m = emptyMesh();
    for (const r of a.rings) {
      const pts = r.slice(0, -1).map(input.project);
      if (pts.length < 3) continue;
      const flat = pts.flatMap(p => [p[0], p[1]]);
      // Longest-edge bisection (parks.ts): the n² split cost Westerpark's cell 159k triangles of park fill on earcut slivers.
      drapeBisect(m, flat, earcut(flat), onLand, LIFT.area + (layer === 'square' ? 0.004 : 0), lod === 0 ? 8 : 16);
    }
    if (cover && layer === 'park') { const r = cullCovered(m, cover); m = r.mesh; parkFillCulled += r.dropped; }
    add(layer, m);
  }

  // Parks (parks-v1): BGT surfaces between the areas and the street bands, hedges, fences and furniture (parks.ts).
  let parkStats: BuiltCell['stats']['parks'] = null;
  if (input.parks) {
    const tp = Date.now();
    const built = input.parks.version === 2 ? buildParks(input.parks, onLand, lod, overWater) : { layers: {}, stats: null };
    for (const [layer, m] of Object.entries(built.layers)) add(layer as GroundLayer, m!);
    if (built.stats) parkStats = { ...built.stats, ms: Date.now() - tp };
  }

  // Streets: bridge ways sampled finer (decks hump over metres).
  const only = (bridge: boolean) => (w: LocalWay) => own.has(w.id) && isBridgeWay(w) === bridge;
  // Canal-side pavements (kerb within 3.8 m of water; the mask saturates at MASK_RANGE_M) get Amsterdammertjes, near ring only.
  const canalSide = lod === 0 && mask ? (x: number, y: number) => { const d = maskDistance(mask, x, y); return d > 0 && d < MASK_RANGE_M - 0.2; } : undefined;
  const streets = buildStreets(ways, onLand, { step: lod === 0 ? 3 : 6, only: only(false), canalSide, markings: lod === 0 });
  // Bridge ways follow the measured deck exactly (no land under a deck over water to poke through); 0.75 m at LOD 0:
  // on a hump a 1.5 m chord sags (~9 cm on a masonry arch, ~2 cm at 0.75 m), so the bands follow the profile closer.
  // Across, a vertex every 2 m (3 m far): a deck narrower than its mapped carriageway left the band's edges on the
  // relief beside it and the band sagged under the deck top (BRU0292 by 0.15 m; +1.8 % triangles per belt cell).
  const onBridges = buildStreets(ways, surface.height, { step: lod === 0 ? 0.75 : 3, only: only(true), acrossStep: lod === 0 ? 2 : 3, markings: lod === 0 });
  for (const s of ['paving', 'klinker', 'asphalt', 'cycle', 'gravel', 'kerb', 'paint', 'tram', 'bollard'] as const) { add(s, streets[s]); add(s, onBridges[s]); }

  // Water, quays, decks.
  if (input.water) {
    add('water', waterSurfaceMesh(input.water, CANAL_WATER_Z));
    add('quay', quayWallMesh({ polygons: [], shores: input.water.shores, shoreLevels: input.water.shoreLevels }, surface.height, CANAL_WATER_Z, lod === 0 ? 4 : 8, QUAY_CAP_M));
  }
  const bridges: BridgeStats = { tops: 0, railed: 0, railingPosts: 0, piers: 0, arches: 0, abutments: 0, frames: 0, decks: [], flat: [] };
  for (const deck of input.decks) {
    const xs = deck.profile.x, ys = deck.profile.y, mid = xs.length >> 1;
    add('deckBody', measuredDeckBody(deck, surface.ground, overWater, waterZAt(input.waterAround, xs[mid], ys[mid], CANAL_WATER_Z), surface.height, bridges.decks, lod === 0));
    const top = measuredDeckTop(deck, surface.height, lod === 0 ? 4 : 2, lod === 0 ? 2 : 4);
    if (top.indices.length) { add('deckTop', top); bridges.tops++; }
  }
  for (const d of bridges.decks) { bridges.railingPosts += d.railingPosts; bridges.piers += d.piers; bridges.arches += d.arches; bridges.abutments += d.abutments; if (d.railingPosts) bridges.railed++; }
  // Bridge ways near the flat footprints give their crossing axis (movable frames).
  const bridgeLines = ways.filter(isBridgeWay).map(w => w.points);
  input.flatDecks.forEach((ring, k) => {
    const through = bridgeLines.filter(l => l.some(q => pointInRing(ring, q[0], q[1])) || l.some((q, i) => i > 0 && pointInRing(ring, (q[0] + l[i - 1][0]) / 2, (q[1] + l[i - 1][1]) / 2)));
    const { top, body, railingPosts } = flatDeckBody(ring, surface.height, overWater, 0.02, 0.45, { railings: lod === 0, axis: footprintAxis(ring, through).u });
    add('deckTop', top); add('deckBody', body);
    bridges.tops++; bridges.railingPosts += railingPosts; if (railingPosts) bridges.railed++;
    let frames = 0;
    if (input.flatDeckMeta?.[k]?.movable) {
      const frame = movableFrame(ring, surface.height, through, 0.02, lod === 0);
      add('deckBody', frame.mesh); frames = frame.units; bridges.frames += frames;
    }
    bridges.flat.push({ id: input.flatDeckMeta?.[k]?.id ?? '', railingPosts, frames });
  });

  // Land pockets near junctions (pockets.ts): bare land every layer around encloses, paved under the bands. Near ring only.
  let pockets: PocketStats | null = null;
  if (lod === 0 && input.pockets !== false) {
    const cover: PocketCover<PocketSurface>[] = (Object.keys(parts) as GroundLayer[]).filter(l => !NOT_COVER.has(l)).map(l => ({ meshes: parts[l]!, as: POCKET_VOTE[l] ?? null }));
    const r = fillPockets(cover, rect, [...streets.junctionPoints, ...onBridges.junctionPoints], onLand, POCKET_LIFT);
    for (const [s, m] of Object.entries(r.meshes)) add(s as PocketSurface, m as MeshArrays);
    pockets = r.stats;
  }

  const packed: Partial<Record<GroundLayer, PackedMesh>> = {};
  const byLayer: Record<string, number> = {};
  let triangles = 0, bytes = 0;
  for (const layer of GROUND_LAYERS) {
    const list = parts[layer];
    if (!list?.length) continue;
    const m = list.length === 1 ? list[0] : merge(list);
    const p = packMesh(m);
    packed[layer] = p;
    byLayer[layer] = packedTriangles(p);
    triangles += byLayer[layer];
    bytes += packedBytes(p);
  }
  const maskOut: GroundMask | null = mask ? { x0: mask.x0, y0: mask.y0, res: mask.res, width: mask.width, height: mask.height, texels: maskTexels(mask) } : null;
  if (maskOut) bytes += maskOut.texels.byteLength;
  return {
    key, lod, rect, layers: packed, mask: maskOut,
    stats: { triangles, byLayer, ways: [...own].length, areas: areas.length, decks: input.decks.length, flatDecks: input.flatDecks.length, buildMs: Date.now() - t0, bytes, bridges, parks: parkStats ? { ...parkStats, fillCulled: parkFillCulled, landCulled } : null, pockets },
  };
}

/** Layers that do not hide the land from above (vertical faces, thin marks on bands, the land itself). */
const NOT_COVER: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['land', 'kerb', 'bollard', 'furniture', 'hedge', 'deckBody', 'paint', 'tram']);

type PocketSurface = 'asphalt' | 'klinker' | 'paving';
/** What a pocket bordered by a layer becomes (pockets.ts): street surfaces vote for themselves, cycle paths and squares for paving; water, parks and decks for nothing. */
const POCKET_VOTE: Partial<Record<GroundLayer, PocketSurface>> = { asphalt: 'asphalt', klinker: 'klinker', paving: 'paving', cycle: 'paving', square: 'paving', gravel: 'paving' };

/** Park surfaces rank between the OSM areas (1) and the street bands (2+), as their lifts do (parks.ts PARK_LIFT). */
export const PARK_RANK: Partial<Record<GroundLayer, number>> = { lawn: 1.2, bed: 1.4, shrub: 1.4, bark: 1.4, sand: 1.5, pond: 1.5, parkGravel: 1.7, parkPath: 1.7 };
/** Polygon-offset rank of coplanar layers (gameGround.ts OFFSET): later wins a tie. */
export const DRAW_RANK: Partial<Record<GroundLayer, number>> = { deckTop: 1, park: 1, wood: 1, square: 1, parking: 1, ...PARK_RANK, klinker: 2, asphalt: 2, gravel: 3, cycle: 3, paving: 3, paint: 4, tram: 5 };
/** Mask channel that cuts a layer (gameGround.ts CUT): 0 = R (water), 1 = G (water minus decks). */
const CUT_CHANNEL: Partial<Record<GroundLayer, 0 | 1>> = { land: 0, park: 0, wood: 0, square: 0, parking: 0, lawn: 0, bed: 0, shrub: 0, bark: 0, sand: 0, parkGravel: 0, parkPath: 0, pond: 0, asphalt: 1, klinker: 1, cycle: 1, paving: 1, gravel: 1, kerb: 1, paint: 1, tram: 1, bollard: 1 };

/** Topmost first; within 2 cm the higher draw rank wins, as the polygon offsets make it on screen. */
export function compareHits(p: { layer: GroundLayer; z: number }, q: { layer: GroundLayer; z: number }): number {
  return Math.abs(p.z - q.z) > 0.02 ? q.z - p.z : (DRAW_RANK[q.layer] ?? 0) - (DRAW_RANK[p.layer] ?? 0);
}

/**
 * What a camera straight above sees at (x, y) in one built cell: every
 * triangle under the point, the mask discard applied as the shader does
 * (bilinear, < 0.5 discards), topmost first, ties within 2 cm to the higher
 * draw rank. For named regressions (walks every triangle).
 */
export function layersAt(cell: BuiltCell, x: number, y: number): { top: GroundLayer | null; hits: { layer: GroundLayer; z: number; cut: boolean }[] } {
  const hits: { layer: GroundLayer; z: number; cut: boolean; rank: number }[] = [];
  for (const layer of GROUND_LAYERS) {
    const m = cell.layers[layer];
    if (!m) continue;
    const pos = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      if (Math.max(pos[a], pos[b], pos[c]) < x || Math.min(pos[a], pos[b], pos[c]) > x || Math.max(pos[a + 1], pos[b + 1], pos[c + 1]) < y || Math.min(pos[a + 1], pos[b + 1], pos[c + 1]) > y) continue;
      const d = (pos[b + 1] - pos[c + 1]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 1] - pos[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((pos[b + 1] - pos[c + 1]) * (x - pos[c]) + (pos[c] - pos[b]) * (y - pos[c + 1])) / d;
      const v = ((pos[c + 1] - pos[a + 1]) * (x - pos[c]) + (pos[a] - pos[c]) * (y - pos[c + 1])) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const ch = CUT_CHANNEL[layer];
      const cut = ch !== undefined && !!cell.mask && maskChannelAt(cell.mask, x, y, ch) < 0.5;
      hits.push({ layer, z: u * pos[a + 2] + v * pos[b + 2] + (1 - u - v) * pos[c + 2], cut, rank: DRAW_RANK[layer] ?? 0 });
    }
  }
  hits.sort(compareHits);
  return { top: hits.find(h => !h.cut && h.layer !== 'water')?.layer ?? null, hits: hits.map(({ layer, z, cut }) => ({ layer, z: +z.toFixed(3), cut })) };
}

/** Bilinear mask channel (0..1) at a scene point, as the GPU's LinearFilter samples it; 1 (land) outside. */
export function maskChannelAt(m: GroundMask, x: number, y: number, ch: 0 | 1): number {
  const fx = (x - m.x0) / m.res - 0.5, fy = (y - m.y0) / m.res - 0.5;
  if (fx <= -0.5 || fy <= -0.5 || fx >= m.width - 0.5 || fy >= m.height - 0.5) return 1;
  const i = Math.max(0, Math.min(m.width - 2, Math.floor(fx))), j = Math.max(0, Math.min(m.height - 2, Math.floor(fy)));
  const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j)), t = m.texels, w = m.width;
  const at = (a: number, b: number) => t[(b * w + a) * 2 + ch] / 255;
  return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
}
