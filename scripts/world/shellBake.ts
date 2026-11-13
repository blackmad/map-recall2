/**
 * Bake a world cell's shells (lane R2-B, #229): SHEL (the runtime coarse chunk of the cell's buildings) and SHL1 (the
 * far ring's simplified level). The coarse chunk is threeBuildingFeatures.buildFeatureChunk(features, look, 'coarse',
 * …, {shellRoofs: true}), the call the browser worker makes for a `coarse:` group (threeBuildingsBrowser rebuild),
 * with the same street-appearance catalogue (public/data/street-appearance/profiles.json through the runtime's
 * validator) and party-wall context (BuildingContextIndex neighbours, the runtime's exclusion rule).
 * The street fronts (doors and shopfronts on the street side) are the ones a street-mode ride hands the layer
 * (lane R4-A #243, `shellStreets`): the city's routing ways (roads-v2 streets-routing.bin.gz, as osm-loader.js
 * fetchRoads reads it for `car`) plus the catalogue's streetFrontPaths, picked per cell as streetsFor picks them per
 * chunk; without them a baked shell's ground floors differed from the detail chunk's (swap-zfight at s3-slab-user).
 * Boat and transit rides hand no streets, so there the runtime coarse still differs (a door on any outer wall).
 * Not baked: host wall openings and the diagnostic surveyed envelopes; a building whose kit replaces it
 * (KIT_HIDE_IDS) is left out as the runtime leaves it out.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildFeatureChunk, asPolygons, ORIGIN, type BuildingLook, type Feature } from '../../src/canalRecall/threeBuildingFeatures.js';
import { FALLBACK_REACH_M, SegmentGrid, streetSegments } from '../../src/canalRecall/streetFronts.js';
import { decodeRoadExtract } from '../../src/canalRecall/routing/roadExtract.js';
import { isMotorOnlyHighway, motorOnlyNames } from '../../src/canalRecall/routing/bikeAccess.js';
import { wallTopHeightM } from '../../src/canalRecall/threeBuildingMesh.js';
import { validateStreetAppearanceCatalog, type StreetAppearanceProfile } from '../../src/canalRecall/streetAppearance.js';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.js';
import { chunkMetres, farPrisms, quantisePrisms, recordShellFromChunk, shellFromChunk, shellOrigin, simplifyRing, NO_BID, SHL1_SIMPLIFY_M, type FarPrism, type RecordShellChunk, type RecordShellMesh, type ShellChunk, type ShellMesh } from '../../src/canalRecall/world/shellMesh.js';
import { FACADE_RECORD_BYTES, FACADE_RECORD_VERSION, packFacadeRecordFor, type FacadeRecordInput, type FacadeSpecInput } from '../../src/canalRecall/look/facadeRecord.js';
import type { FinishHint } from '../../src/canalRecall/look/finishHint.js';
import type { FacadeRecordSet } from '../../src/canalRecall/world/facadeStreams.js';

export const SHELL_LOOK: BuildingLook = 'photo';

let profiles: StreetAppearanceProfile[] | null = null;
export function shellProfiles(root: string): StreetAppearanceProfile[] {
  if (profiles) return profiles;
  const file = path.join(root, 'public/data/street-appearance/profiles.json');
  if (!fs.existsSync(file)) return profiles = [];
  const admitted = validateStreetAppearanceCatalog(JSON.parse(fs.readFileSync(file, 'utf8')));
  return profiles = JSON.parse(JSON.stringify(admitted)).profiles;
}
const KIT_HIDE = new Set(KIT_HIDE_IDS);

let streetGrids: SegmentGrid[] | null = null;
/**
 * The street-mode fronts as the runtime layer holds them: setStreets(fetchRoads ways) (SegmentGrid of 200 m) and
 * setStreetAppearance's streetFrontPaths (default grid). osm-loader.js fetchRoads for `car`: motor-only highways and
 * mostly-motor names are dropped, closed rings (area outlines) skipped, the highway defaulted by type.
 */
export function shellStreetGrids(root: string): SegmentGrid[] {
  if (streetGrids) return streetGrids;
  const grids: SegmentGrid[] = [];
  const file = path.join(root, 'public/data/extracts/amsterdam/roads-v2/streets-routing.bin.gz');
  if (fs.existsSync(file)) {
    const { features } = decodeRoadExtract(new Uint8Array(zlib.gunzipSync(fs.readFileSync(file))));
    const motor = motorOnlyNames(features);
    const ways: { highway?: string; points: (readonly [number, number])[] }[] = [];
    for (const f of features) {
      if (isMotorOnlyHighway(f.highway) || motor.has(f.name)) continue;
      for (const p of f.paths ?? (f.path ? [f.path] : [])) {
        if (!p || p.length < 2) continue;
        const a = p[0], b = p[p.length - 1];
        if (p.length > 3 && a[0] === b[0] && a[1] === b[1]) continue;
        ways.push({ highway: f.highway || (f.type === 'avenue' ? 'secondary' : 'residential'), points: p.map(([lat, lon]) => [lon, lat] as const) });
      }
    }
    const segs = streetSegments(ways, ORIGIN);
    if (segs.length) grids.push(new SegmentGrid(segs, 200));
  }
  const catalogue = path.join(root, 'public/data/street-appearance/profiles.json');
  if (fs.existsSync(catalogue)) {
    const admitted = JSON.parse(JSON.stringify(validateStreetAppearanceCatalog(JSON.parse(fs.readFileSync(catalogue, 'utf8')))));
    if (admitted.streetFrontPaths?.length) grids.push(new SegmentGrid(streetSegments(admitted.streetFrontPaths, ORIGIN)));
  }
  return streetGrids = grids;
}
/** threeBuildingsBrowser streetsFor: the segments within FALLBACK_REACH_M of the features' outer rings' box. */
export function shellStreets(root: string, features: readonly Feature[]): Float32Array | undefined {
  const grids = shellStreetGrids(root);
  if (!grids.length) return undefined;
  const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), ky = 110_540;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of features) for (const polygon of asPolygons(f.geometry)) for (const [lng, lat] of polygon[0] ?? []) {
    const x = (lng - ORIGIN.lng) * kx, y = (lat - ORIGIN.lat) * ky;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!(minX <= maxX)) return undefined;
  const pad = FALLBACK_REACH_M, out: number[] = [];
  for (const grid of grids) { const segs = grid.segs; for (const i of grid.near(minX - pad, minY - pad, maxX + pad, maxY + pad)) out.push(segs[i * 4], segs[i * 4 + 1], segs[i * 4 + 2], segs[i * 4 + 3]); }
  return Float32Array.from(out);
}
/** A building's coarse group without a cell's GRP: the z14 tile of its first vertex (threeBuildingsBrowser tileKeyOf). */
function groupTile(f: Feature): string {
  const [lng, lat] = asPolygons(f.geometry)[0]?.[0]?.[0] ?? [0, 0], n = 2 ** 14, rad = lat * Math.PI / 180;
  return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
}

export type ShellBake = { shel: ShellMesh; far: FarPrism[]; coarseTriangles: number; ms: number; farMs: number; buildings: number };

/**
 * `features`: the cell's styled buildings in cell order (index = bid); `context`: the party-wall neighbours of the
 * cell's buildings that are not in the cell (other cells), as the runtime context of a chunk.
 */
export function bakeCellShell(i: number, j: number, features: readonly Feature[], context: readonly Feature[], root: string, groups: readonly string[] = [], farHidden: ReadonlySet<string> = new Set(), parts?: readonly ShellChunk[]): ShellBake | null {
  const t0 = performance.now();
  const bid = new Map<string, number>();
  features.forEach((f, k) => bid.set(String(f.properties.id), k));
  const drawn = features.filter(f => !KIT_HIDE.has(String(f.properties.id)));
  if (!drawn.length) return null;
  const chunk = parts ? mergeShellChunks(parts) : buildFeatureChunk(drawn as Feature[], SHELL_LOOK, 'coarse', shellStreets(root, drawn as Feature[]), shellProfiles(root), context as Feature[], [], new Map(), { shellRoofs: true });
  if (!chunk.indices.length) return null;
  const origin = shellOrigin(i, j), shel = shellFromChunk(chunk, origin, id => bid.get(id) ?? -1);
  const ms = performance.now() - t0, t1 = performance.now();
  return { shel, far: bakeFar(shel, features, origin, groups, farHidden), coarseTriangles: chunk.indices.length / 3, ms, farMs: performance.now() - t1, buildings: features.length };
}

/**
 * Lane R4-A (#243): the runtime builds its coarse chunk per z14 group tile, and a building's window layers depend on
 * which other buildings share that chunk (row rhythm across the tile; a cell-sized source changed the ground-floor
 * layer of 25 of 1,121 buildings at s3-slab-user). The bake therefore builds each group tile's chunk as the runtime
 * does — every building of the group in (source tile, ordinal) order, the runtime's party-wall context rule, the
 * streets within reach of the tile — and gives each cell the ranges of its own buildings (`subsetShellChunk`).
 */
export function bakeGroupChunk(source: readonly Feature[], context: readonly Feature[], root: string): ShellChunk {
  return buildFeatureChunk(source as Feature[], SHELL_LOOK, 'coarse', shellStreets(root, source), shellProfiles(root), context as Feature[], [], new Map(), { shellRoofs: true });
}

/** The ranges of `chunk` whose building `keep` accepts (an allotment garden's range by its garden's id), re-indexed. */
export function subsetShellChunk(chunk: ShellChunk, keep: (id: string) => boolean): ShellChunk {
  const n = chunk.layers.length, map = new Int32Array(n).fill(-1), ranges: { id: string; start: number; count: number }[] = [];
  let count = 0;
  for (const r of chunk.ranges) {
    const id = r.id.startsWith(ALLOTMENT_PREFIX) ? r.id.slice(ALLOTMENT_PREFIX.length) : r.id;
    if (!keep(id)) continue;
    ranges.push({ id: r.id, start: count, count: r.count });
    for (let v = r.start; v < r.start + r.count; v++) map[v] = count++;
  }
  const idx: number[] = [];
  for (let t = 0; t < chunk.indices.length; t += 3) {
    const a = map[chunk.indices[t]], b = map[chunk.indices[t + 1]], c = map[chunk.indices[t + 2]];
    if (a >= 0 && b >= 0 && c >= 0) idx.push(a, b, c);
  }
  const positions = new Float32Array(count * 3), uvs = new Float32Array(count * 2), layers = new Uint8Array(count), tints = new Uint8Array(count * 4), accents = new Uint8Array(count * 4);
  const thin = chunk.thin && chunk.thin.length === n * 2 ? new Uint8Array(count * 2) : undefined;
  for (let v = 0; v < n; v++) {
    const k = map[v]; if (k < 0) continue;
    positions.set(chunk.positions.subarray(v * 3, v * 3 + 3), k * 3); uvs.set(chunk.uvs.subarray(v * 2, v * 2 + 2), k * 2);
    layers[k] = chunk.layers[v]; tints.set(chunk.tints.subarray(v * 4, v * 4 + 4), k * 4); accents.set(chunk.accents.subarray(v * 4, v * 4 + 4), k * 4);
    if (thin) thin.set(chunk.thin!.subarray(v * 2, v * 2 + 2), k * 2);
  }
  return { positions, uvs, layers, tints, accents, indices: Uint32Array.from(idx), ranges, ...(thin ? { thin } : {}) };
}

/** Several chunks as one (a cell's parts of its group tiles), in the given order. */
export function mergeShellChunks(parts: readonly ShellChunk[]): ShellChunk {
  if (parts.length === 1) return parts[0];
  const vn = parts.reduce((s, p) => s + p.layers.length, 0), tn = parts.reduce((s, p) => s + p.indices.length, 0), anyThin = parts.some(p => p.thin);
  const positions = new Float32Array(vn * 3), uvs = new Float32Array(vn * 2), layers = new Uint8Array(vn), tints = new Uint8Array(vn * 4), accents = new Uint8Array(vn * 4), indices = new Uint32Array(tn);
  const thin = anyThin ? new Uint8Array(vn * 2) : undefined, ranges: { id: string; start: number; count: number }[] = [];
  let v = 0, t = 0;
  for (const p of parts) {
    const m = p.layers.length;
    positions.set(p.positions, v * 3); uvs.set(p.uvs, v * 2); layers.set(p.layers, v); tints.set(p.tints, v * 4); accents.set(p.accents, v * 4);
    if (thin && p.thin && p.thin.length === m * 2) thin.set(p.thin, v * 2);
    for (let k = 0; k < p.indices.length; k++) indices[t + k] = p.indices[k] + v;
    for (const r of p.ranges) ranges.push({ id: r.id, start: r.start + v, count: r.count });
    v += m; t += p.indices.length;
  }
  return { positions, uvs, layers, tints, accents, indices, ranges, ...(thin ? { thin } : {}) };
}
const ALLOTMENT_PREFIX = 'allotment-garden:';

/** SHL1: a prism per building polygon, measured off the SHEL bake (shellMesh.ts farPrisms). */
/** `groups[bid]`: the building's coarse group tile (CellBuilding.group, `x/y`); the far tier hides a tile's prisms while its resident shell draws. */
/** `hidden`: ids an installed model or kit replaces (the cell's HIDE list); they get no prism. */
export function bakeFar(shel: ShellMesh, features: readonly Feature[], origin: readonly [number, number], groups: readonly string[] = [], hidden: ReadonlySet<string> = new Set()): FarPrism[] {
  const top = new Float64Array(features.length).fill(-Infinity);
  for (let k = 0; k < shel.bids.length; k++) top[shel.bids[k]] = Math.max(top[shel.bids[k]], shel.positions[k * 3 + 2]);
  // One prism per polygon of a building (a multipolygon's parts share its colours and heights).
  const rings: (number[][][] | null)[] = [], heights: { eavesM: number; topM: number }[] = [], owner: number[] = [];
  const polys: number[][][][] = [];
  features.forEach((f, b) => {
    if (!Number.isFinite(top[b]) || hidden.has(String(f.properties.id))) return;
    for (const polygon of asPolygons(f.geometry)) {
      const local = polygon.map(ring => { const pts = ring.map(([lng, lat]) => { const [x, y] = chunkMetres(lng, lat); return [x - origin[0], y - origin[1]]; }); if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop(); return pts; }).filter(r => r.length >= 3);
      if (!local.length) continue;
      polys.push(local.map(r => simplifyRing(r, SHL1_SIMPLIFY_M))); owner.push(b);
    }
  });
  // farPrisms reads colours per bid; feed it per building, then fan the result out to the building's polygons.
  features.forEach((f, b) => { rings.push(Number.isFinite(top[b]) ? [[[0, 0]]] : null); heights.push({ eavesM: Math.min(wallTopHeightM(f.properties), top[b]), topM: top[b] }); });
  const perBuilding = farPrisms(shel, rings, heights);
  const out: FarPrism[] = [];
  polys.forEach((poly, n) => { const pr = perBuilding[owner[n]]; if (pr) out.push({ ...pr, rings: poly, tile: groups[owner[n]] ?? groupTile(features[owner[n]]) }); });
  return quantisePrisms(out);
}

// --- F1 record shells (#380, docs/plans/facade-f1-design-20261112.md §1.4, §2.2) -------------------------------------
// The same group-tile bake with the mesher's record mode (threeBuildingMesh ChunkOptions.facadeRecord): one quad per wall
// plane, wall metres, record index and wall kind per vertex. Written to world-v1/facade/<key>.bin (SHEL level 3 + FREC +
// CROW) beside the legacy shells/, which this path never touches.

/** The resolved spec of every pand in a house-specs extract (`<extract>/<dir>/14/x/y.json.gz`): d, x, s. */
export function loadHouseSpecTable(extract: string, dir: string): Map<string, FacadeSpecInput> {
  const out = new Map<string, FacadeSpecInput>(), base = path.join(extract, dir, '14');
  if (!fs.existsSync(base)) return out;
  for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) {
    const tile = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(base, x, y))).toString('utf8')) as { buildings: Record<string, { d: Record<string, unknown>; x?: Record<string, unknown>; s: Record<string, string> }> };
    for (const [id, r] of Object.entries(tile.buildings ?? {})) out.set(id, { d: r.d, ...(r.x ? { x: r.x } : {}), s: r.s });
  }
  return out;
}

/** A record-mode chunk's share for one cell: geometry plus one record input per range (`inputs[k]` for `ranges[k]`). */
export type RecordPart = RecordShellChunk & { inputs: FacadeRecordInput[] };

export function bakeGroupRecordChunk(source: readonly Feature[], context: readonly Feature[], root: string, specFor?: (id: string) => FacadeSpecInput | undefined, finishHintFor?: (id: string) => FinishHint | undefined): RecordPart {
  const c = buildFeatureChunk(source as Feature[], SHELL_LOOK, 'coarse', shellStreets(root, source), shellProfiles(root), context as Feature[], [], new Map(), { shellRoofs: true, facadeRecord: true, ...(specFor ? { specFor } : {}), ...(finishHintFor ? { finishHintFor } : {}) });
  if (!c.record) throw Error('record bake: the mesher returned no record arrays');
  return { positions: c.positions, indices: c.indices, ranges: c.ranges, walls: c.record.walls, recs: c.record.recs, wallKinds: c.record.wallKinds, inputs: c.record.inputs };
}

/** The ranges of a record chunk whose building `keep` accepts, re-indexed; `recs` follow their range's new index. */
export function subsetRecordChunk(chunk: RecordPart, keep: (id: string) => boolean): RecordPart {
  const n = chunk.recs.length, map = new Int32Array(n).fill(-1), recMap = new Int32Array(chunk.ranges.length).fill(-1);
  const ranges: { id: string; start: number; count: number }[] = [], inputs: FacadeRecordInput[] = [];
  let count = 0;
  chunk.ranges.forEach((r, k) => {
    if (!keep(r.id)) return;
    recMap[k] = ranges.length; ranges.push({ id: r.id, start: count, count: r.count }); inputs.push(chunk.inputs[k]);
    for (let v = r.start; v < r.start + r.count; v++) map[v] = count++;
  });
  const idx: number[] = [];
  for (let t = 0; t < chunk.indices.length; t += 3) {
    const a = map[chunk.indices[t]], b = map[chunk.indices[t + 1]], c = map[chunk.indices[t + 2]];
    if (a >= 0 && b >= 0 && c >= 0) idx.push(a, b, c);
  }
  const positions = new Float32Array(count * 3), walls = new Float32Array(count * 3), recs = new Uint16Array(count), wallKinds = new Uint8Array(count);
  for (let v = 0; v < n; v++) {
    const k = map[v]; if (k < 0) continue;
    positions.set(chunk.positions.subarray(v * 3, v * 3 + 3), k * 3); walls.set(chunk.walls.subarray(v * 3, v * 3 + 3), k * 3);
    recs[k] = recMap[chunk.recs[v]]; wallKinds[k] = chunk.wallKinds[v];
  }
  return { positions, walls, recs, wallKinds, indices: Uint32Array.from(idx), ranges, inputs };
}

export function mergeRecordChunks(parts: readonly RecordPart[]): RecordPart {
  if (parts.length === 1) return parts[0];
  const vn = parts.reduce((s, p) => s + p.recs.length, 0), tn = parts.reduce((s, p) => s + p.indices.length, 0);
  const positions = new Float32Array(vn * 3), walls = new Float32Array(vn * 3), recs = new Uint16Array(vn), wallKinds = new Uint8Array(vn), indices = new Uint32Array(tn);
  const ranges: { id: string; start: number; count: number }[] = [], inputs: FacadeRecordInput[] = [];
  let v = 0, t = 0;
  for (const p of parts) {
    const m = p.recs.length, r0 = ranges.length;
    positions.set(p.positions, v * 3); walls.set(p.walls, v * 3); wallKinds.set(p.wallKinds, v);
    for (let k = 0; k < m; k++) recs[v + k] = p.recs[k] + r0;
    for (let k = 0; k < p.indices.length; k++) indices[t + k] = p.indices[k] + v;
    for (const r of p.ranges) ranges.push({ id: r.id, start: r.start + v, count: r.count });
    inputs.push(...p.inputs);
    v += m; t += p.indices.length;
  }
  return { positions, walls, recs, wallKinds, indices, ranges, inputs };
}

/**
 * A cell's record shell: the level 3 mesh with `rec` = the building's bid (FOOT order) and one 64-byte record per cell
 * building (zero for a building with no geometry). Extra street fronts are not yet split into their own records (S3).
 */
export function bakeCellRecordShell(i: number, j: number, features: readonly Feature[], parts: readonly RecordPart[]): { rshel: RecordShellMesh; records: FacadeRecordSet } | null {
  const bid = new Map<string, number>();
  features.forEach((f, k) => bid.set(String(f.properties.id), k));
  if (!parts.length) return null;
  const chunk = mergeRecordChunks(parts);
  if (!chunk.indices.length) return null;
  const recBid = chunk.ranges.map(r => bid.get(r.id) ?? NO_BID);
  const rshel = recordShellFromChunk(chunk, shellOrigin(i, j), id => bid.get(id) ?? -1, r => recBid[r] === NO_BID ? 0 : recBid[r]);
  const bytes = new Uint8Array(features.length * FACADE_RECORD_BYTES);
  chunk.ranges.forEach((r, k) => { const b = recBid[k]; if (b !== NO_BID) bytes.set(packFacadeRecordFor(chunk.inputs[k]), b * FACADE_RECORD_BYTES); });
  return { rshel, records: { version: FACADE_RECORD_VERSION, count: features.length, bytes } };
}
