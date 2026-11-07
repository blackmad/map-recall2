/**
 * Baked building shells (lane R2-B, #229): the SHEL and SHL1 streams of world-v1 format 6.
 *
 * SHEL is the cell's buildings as the runtime coarse chunk (threeBuildingFeatures.buildFeatureChunk(…, 'coarse',
 * {shellRoofs: true})) builds them, merged into one mesh and quantised: positions to 0.1 m from the cell origin, the
 * chunk's façade UVs (1/4096 of a repeat), layer, tint (RGB + the baked shade in alpha) and accent, and a per-vertex
 * `bid` (the vertex's building, an index into the cell's building list) so a resident ring can hide one building.
 *
 * SHL1 is the far ring's level. The brief asked for SHEL through `MeshoptSimplifier.simplify` (error 0.02, ≤ 8k
 * triangles or ratio 0.25); measured on the S1 cell (0_-1, 80k coarse triangles) that stays at 64k triangles and
 * 194 KB gz (every window bay is its own quad with its own layer and tint, so nothing welds), 36k / 184 KB with
 * `Permissive`, and the touch `shell` mode still 11k / 74 KB: none near the 40 KB target. So SHL1 is a prism per
 * building instead, measured off the same bake: the footprint rings (Douglas–Peucker 1 m, 0.5 m grid), the eaves
 * (`wallTopHeightM`) and roof top (`height`) in decimetres, and the wall and roof (tint, layer) that cover the most
 * area of that building's SHEL triangles. `farShellMesh` extrudes it in the world worker: walls to the eaves in the
 * wall tint, a roof band to the roof's mid height in the roof tint, a flat lid there, shades from the light rig.
 *
 * Pure and DOM-free: the compiler encodes, the world worker decodes. Layouts (LEB128 varints, signed zigzag; byte
 * planes raw so gzip sees runs):
 *   SHEL  u8 level (0)  uvar vertices  uvar indices  uvar runs { zz(bid delta) uvar vertexCount }*
 *         XY: per vertex uvar k (k > 0: the k-th most recent distinct XY, moved to front; 0: zz dx zz dy from the
 *         last literal, 0.1 m)  Z column (zz deltas, 0.1 m)  U, V columns (zz deltas, 1/UV_UNITS)
 *         layer bytes  tint R, G, B, A planes  accent R, G, B planes  indices (high-water-mark code)
 *   SHL1  u8 level (2)  uvar tiles { uvar x uvar y }*  uvar prisms  per prism uvar tile index  per prism uvar rings
 *         per ring uvar points  X, Y columns (zz deltas, 0.5 m, running across rings and prisms)  eaves dm (uvar)
 *         rise dm (uvar)  wall R, G, B, layer planes  roof R, G, B, layer planes
 * Index code: `hw - index`, `hw` the next unseen vertex (0 = a new vertex), the usual high-water mark.
 */
import earcut from 'earcut';
import { Reader, Writer } from './cellFormat.js';
import { BAKED_LID_SHADE, bakedFaceShade, bakedWallShade } from '../rendererShared/lightRig.js';

/** SHEL position unit, metres (int16 range: ±3,276 m from the cell origin). */
export const SHEL_UNIT_M = 0.1;
/** SHL1 footprint grid, metres. */
export const SHL1_UNIT_M = 0.5;
/** SHL1 footprint simplification (Douglas–Peucker), metres: a pixel at 1.5 km on a 1,512 px wide 60° view is ~1.1 m. */
export const SHL1_SIMPLIFY_M = 1;
/** UV units per texture repeat (1/4096 of a repeat is < 0.07 texel of a 256 px cell). */
export const UV_UNITS = 4096;
/** Recent distinct XY positions the SHEL position code refers back to (a quad's corners reuse two). */
export const XY_RECENT = 16;
const MAX_VERTICES = 4_000_000;
/** The `bid` of shell vertices that belong to no single cell building (allotment gardens). */
export const NO_BID = 65535;

/** A decoded SHEL mesh. Positions are metres from the cell origin (`shellOrigin`) in the chunk frame (x east, y north, z up). */
export type ShellMesh = {
  positions: Float32Array; uvs: Float32Array; layers: Uint8Array; tints: Uint8Array; accents: Uint8Array;
  /** Per vertex, the building's index in the cell (uint16; a cell holds at most a few thousand buildings). */
  bids: Uint16Array; indices: Uint32Array;
};
/** One building of SHL1: rings (outer first, then holes; open, metres from the cell origin), eaves and roof top (m), wall and roof (r, g, b, layer). */
export type FarPrism = { rings: number[][][]; eavesM: number; topM: number; wall: [number, number, number, number]; roof: [number, number, number, number]; /** The building's coarse group tile (`x/y`, CellBuilding.group): the far tier hides it while that tile's resident shell draws. */ tile: string };
/** The far ring's mesh (farShellMesh): positions (metres from the cell origin), layer, tint (RGB + shade), indices. */
export type FarShellMesh = { positions: Float32Array; layers: Uint8Array; tints: Uint8Array; indices: Uint32Array };

/** The chunk-frame metres (threeBuildingFeatures ORIGIN projection: 111,320 m × cos(lat0) east, 110,540 m north) of a cell's SW corner. */
export function shellOrigin(i: number, j: number, cellSizeM = 1000, gridMetresPerDegree: readonly [number, number] = [67967.53053174692, 111320.0], chunkMetresPerDegree: readonly [number, number] = [111_320 * Math.cos(52.37 * Math.PI / 180), 110_540]): [number, number] {
  // The cell grid and the chunk frame share their origin (4.9, 52.37); they differ in the metres per degree north.
  return [i * cellSizeM / gridMetresPerDegree[0] * chunkMetresPerDegree[0], j * cellSizeM / gridMetresPerDegree[1] * chunkMetresPerDegree[1]];
}
/** lng/lat → chunk-frame metres (threeBuildingMesh ringEdges). */
export const chunkMetres = (lng: number, lat: number): [number, number] => [(lng - 4.9) * 111_320 * Math.cos(52.37 * Math.PI / 180), (lat - 52.37) * 110_540];

const q = (v: number, unit: number) => Math.round(v / unit) + 0; // + 0: no -0 (the decoder gives +0 back)
function writeColumn(w: Writer, values: ArrayLike<number>, stride: number, offset: number, count: number, unit: number): void {
  let prev = 0;
  for (let k = 0; k < count; k++) { const v = q(values[k * stride + offset], unit); w.zvar(v - prev); prev = v; }
}
function readColumn(r: Reader, out: Float32Array, stride: number, offset: number, count: number, unit: number): void {
  let prev = 0;
  for (let k = 0; k < count; k++) { prev += r.zvar(); out[k * stride + offset] = prev * unit; }
}
function writePlanes(w: Writer, bytes: ArrayLike<number>, stride: number, planes: number, count: number): void {
  for (let p = 0; p < planes; p++) { const plane = new Uint8Array(count); for (let k = 0; k < count; k++) plane[k] = bytes[k * stride + p]; w.bytes(plane); }
}
function readPlanes(r: Reader, out: Uint8Array | number[], stride: number, planes: number, count: number): void {
  for (let p = 0; p < planes; p++) { const plane = r.take(count); for (let k = 0; k < count; k++) out[k * stride + p] = plane[k]; }
}
function writeIndices(w: Writer, indices: ArrayLike<number>, vertexCount: number): void {
  let hw = 0;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    if (i > hw || i >= vertexCount) throw Error(`shell index ${i} skips ahead of ${hw}`);
    w.uvar(hw - i); if (i === hw) hw++;
  }
}
function readIndices(r: Reader, count: number, vertexCount: number): Uint32Array {
  const out = new Uint32Array(count); let hw = 0;
  for (let k = 0; k < count; k++) {
    const d = r.uvar(); if (d > hw) r.fail(`index code ${d} above ${hw}`);
    const i = hw - d; if (i >= vertexCount) r.fail(`index ${i} >= ${vertexCount}`);
    out[k] = i; if (d === 0) hw++;
  }
  return out;
}
/** XY positions (integer units) with a move-to-front list of the XY_RECENT most recent distinct ones. */
function writeXY(w: Writer, positions: ArrayLike<number>, count: number, unit: number): void {
  const recent: number[] = []; let px = 0, py = 0;
  for (let k = 0; k < count; k++) {
    const x = q(positions[k * 3], unit), y = q(positions[k * 3 + 1], unit);
    let hit = -1;
    for (let m = 0; m < recent.length; m += 2) if (recent[m] === x && recent[m + 1] === y) { hit = m; break; }
    if (hit >= 0) { w.uvar(hit / 2 + 1); recent.splice(hit, 2); recent.unshift(x, y); continue; }
    w.uvar(0); w.zvar(x - px); w.zvar(y - py); px = x; py = y;
    recent.unshift(x, y); if (recent.length > XY_RECENT * 2) recent.length = XY_RECENT * 2;
  }
}
function readXY(r: Reader, out: Float32Array, count: number, unit: number): void {
  const recent: number[] = []; let px = 0, py = 0;
  for (let k = 0; k < count; k++) {
    const c = r.uvar();
    let x: number, y: number;
    if (c > 0) {
      const m = (c - 1) * 2; if (m >= recent.length) r.fail(`xy back-reference ${c} of ${recent.length / 2}`);
      x = recent[m]; y = recent[m + 1]; recent.splice(m, 2); recent.unshift(x, y);
    } else {
      x = px + r.zvar(); y = py + r.zvar(); px = x; py = y;
      recent.unshift(x, y); if (recent.length > XY_RECENT * 2) recent.length = XY_RECENT * 2;
    }
    out[k * 3] = x * unit; out[k * 3 + 1] = y * unit;
  }
}

/** Reorder a mesh's vertices by first use in the index buffer (the high-water-mark code needs it); unused vertices are dropped. */
export function firstUseOrder(indices: ArrayLike<number>, vertexCount: number): { order: Uint32Array; indices: Uint32Array } {
  const map = new Int32Array(vertexCount).fill(-1), order: number[] = [], out = new Uint32Array(indices.length);
  for (let k = 0; k < indices.length; k++) { const i = indices[k]; if (map[i] < 0) { map[i] = order.length; order.push(i); } out[k] = map[i]; }
  return { order: Uint32Array.from(order), indices: out };
}

/** Encode a SHEL payload at level 0 (lane R2-B; still decoded). Positions are metres from the cell origin; vertices in first-use order. */
export function encodeShelLevel0(mesh: ShellMesh): Uint8Array {
  const n = mesh.layers.length, w = new Writer();
  w.byte(0); w.uvar(n); w.uvar(mesh.indices.length);
  const runs: [number, number][] = [];
  for (let k = 0; k < n; k++) { const b = mesh.bids[k]; if (runs.length && runs[runs.length - 1][0] === b) runs[runs.length - 1][1]++; else runs.push([b, 1]); }
  w.uvar(runs.length); let prev = 0;
  for (const [b, c] of runs) { w.zvar(b - prev); w.uvar(c); prev = b; }
  writeXY(w, mesh.positions, n, SHEL_UNIT_M);
  writeColumn(w, mesh.positions, 3, 2, n, SHEL_UNIT_M);
  for (let a = 0; a < 2; a++) writeColumn(w, mesh.uvs, 2, a, n, 1 / UV_UNITS);
  w.bytes(mesh.layers);
  writePlanes(w, mesh.tints, 4, 4, n);
  writePlanes(w, mesh.accents, 4, 3, n);
  writeIndices(w, mesh.indices, n);
  return w.done();
}
/**
 * SHEL level 1 (lane R4-A, #243): the same mesh, coded by primitive. A coarse chunk is ~85 % wall quads written as four
 * fresh vertices (k, k+1, k+2, k+3; indices k k+1 k+2 k k+2 k+3) whose corners share their footprint XY in pairs, their
 * base and top z, their two U and two V values and one (layer, tint, accent) record. Level 1 writes such a quad as two XY
 * (the move-to-front code), z and height, u and width, v and height in repeats, and one record; anything else is a
 * triangle coded as level 0 codes it, except that a fresh vertex identical to one of the DUP_WINDOW before it (the
 * duplicated corners of the roof planes) is a back-reference. Records are split: the layer and the baked shade (tint
 * alpha) per record, the colour (tint RGB, accent RGB) only when it changes. Every field is its own stream so gzip sees
 * like with like. Lossless against level 0 (same decoded mesh); 604 cells: see the lane's size table.
 *   level (1)  uvar vertices  uvar indices  uvar streams { uvar bytes }*  then the streams, in SHEL1_STREAMS order
 */
const SHEL1_STREAMS = ['kind', 'index', 'dup', 'xyCode', 'dx', 'dy', 'quadZ', 'quadH', 'quadU', 'quadDu', 'quadV', 'quadDv', 'z', 'u', 'v', 'layer', 'shade', 'colourSame', 'colour', 'bids'] as const;
type Shel1Stream = (typeof SHEL1_STREAMS)[number];
/** How far back a fresh triangle vertex may refer to an identical one. */
export const DUP_WINDOW = 8;
const SHEL_LEVEL = 1;

/** Integer fields of a vertex (positions in SHEL_UNIT_M, UVs in 1/UV_UNITS) and its record bytes, as the codes see them. */
function shelInts(m: ShellMesh) {
  const n = m.layers.length, X = new Int32Array(n), Y = new Int32Array(n), Z = new Int32Array(n), U = new Int32Array(n), V = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    X[k] = q(m.positions[k * 3], SHEL_UNIT_M); Y[k] = q(m.positions[k * 3 + 1], SHEL_UNIT_M); Z[k] = q(m.positions[k * 3 + 2], SHEL_UNIT_M);
    U[k] = q(m.uvs[k * 2], 1 / UV_UNITS); V[k] = q(m.uvs[k * 2 + 1], 1 / UV_UNITS);
  }
  return { X, Y, Z, U, V };
}
const sameRecord = (m: ShellMesh, a: number, b: number) => m.layers[a] === m.layers[b] && m.tints[a * 4] === m.tints[b * 4] && m.tints[a * 4 + 1] === m.tints[b * 4 + 1] && m.tints[a * 4 + 2] === m.tints[b * 4 + 2] && m.tints[a * 4 + 3] === m.tints[b * 4 + 3]
  && m.accents[a * 4] === m.accents[b * 4] && m.accents[a * 4 + 1] === m.accents[b * 4 + 1] && m.accents[a * 4 + 2] === m.accents[b * 4 + 2];
const sameColour = (m: ShellMesh, a: number, b: number) => m.tints[a * 4] === m.tints[b * 4] && m.tints[a * 4 + 1] === m.tints[b * 4 + 1] && m.tints[a * 4 + 2] === m.tints[b * 4 + 2]
  && m.accents[a * 4] === m.accents[b * 4] && m.accents[a * 4 + 1] === m.accents[b * 4 + 1] && m.accents[a * 4 + 2] === m.accents[b * 4 + 2];

/** The XY move-to-front list both sides keep (XY_RECENT entries). */
class RecentXY {
  private readonly xs: number[] = []; private readonly ys: number[] = [];
  find(x: number, y: number): number { for (let m = 0; m < this.xs.length; m++) if (this.xs[m] === x && this.ys[m] === y) return m; return -1; }
  at(m: number): [number, number] { return [this.xs[m], this.ys[m]]; }
  get size(): number { return this.xs.length; }
  front(m: number): void { const x = this.xs[m], y = this.ys[m]; this.xs.splice(m, 1); this.ys.splice(m, 1); this.xs.unshift(x); this.ys.unshift(y); }
  push(x: number, y: number): void { this.xs.unshift(x); this.ys.unshift(y); if (this.xs.length > XY_RECENT) { this.xs.length = XY_RECENT; this.ys.length = XY_RECENT; } }
}

/** Encode a SHEL payload (level 1). Positions are metres from the cell origin; vertices in first-use order (`shellFromChunk`). */
export function encodeShel(mesh: ShellMesh): Uint8Array {
  const m = mesh, n = m.layers.length, I = m.indices, { X, Y, Z, U, V } = shelInts(m);
  const w = Object.fromEntries(SHEL1_STREAMS.map(k => [k, new Writer()])) as Record<Shel1Stream, Writer>;
  const recent = new RecentXY();
  let px = 0, py = 0;
  const xy = (x: number, y: number) => {
    const hit = recent.find(x, y);
    if (hit >= 0) { w.xyCode.uvar(hit + 1); recent.front(hit); return; }
    w.xyCode.uvar(0); w.dx.zvar(x - px); w.dy.zvar(y - py); px = x; py = y; recent.push(x, y);
  };
  let last = -1;
  const colour: number[][] = [[], [], [], [], [], []];
  const record = (k: number) => {
    w.layer.byte(m.layers[k]); w.shade.byte(m.tints[k * 4 + 3]);
    const same = last >= 0 && sameColour(m, k, last);
    w.colourSame.byte(same ? 1 : 0);
    if (!same) { colour[0].push(m.tints[k * 4]); colour[1].push(m.tints[k * 4 + 1]); colour[2].push(m.tints[k * 4 + 2]); colour[3].push(m.accents[k * 4]); colour[4].push(m.accents[k * 4 + 1]); colour[5].push(m.accents[k * 4 + 2]); }
    last = k;
  };
  let qz = 0, qu = 0, qv = 0, gz = 0, gu = 0, gv = 0, hw = 0, t = 0;
  while (t < I.length) {
    const k = hw;
    if (t + 6 <= I.length && k + 3 < n && I[t] === k && I[t + 1] === k + 1 && I[t + 2] === k + 2 && I[t + 3] === k && I[t + 4] === k + 2 && I[t + 5] === k + 3
      && X[k + 2] === X[k + 1] && Y[k + 2] === Y[k + 1] && X[k + 3] === X[k] && Y[k + 3] === Y[k] && Z[k + 1] === Z[k] && Z[k + 2] === Z[k + 3]
      && U[k + 2] === U[k + 1] && U[k + 3] === U[k] && V[k + 1] === V[k] && V[k + 3] === V[k + 2]
      && sameRecord(m, k, k + 1) && sameRecord(m, k, k + 2) && sameRecord(m, k, k + 3)) {
      w.kind.byte(1);
      xy(X[k], Y[k]); xy(X[k + 1], Y[k + 1]);
      w.quadZ.zvar(Z[k] - qz); qz = Z[k]; w.quadH.zvar(Z[k + 2] - Z[k]);
      w.quadU.zvar(U[k] - qu); qu = U[k]; w.quadDu.zvar(U[k + 1] - U[k]);
      w.quadV.zvar(V[k] - qv); qv = V[k]; w.quadDv.zvar(V[k + 2] - V[k]);
      record(k);
      hw += 4; t += 6; continue;
    }
    w.kind.byte(0);
    for (let c = 0; c < 3; c++) {
      const i = I[t + c];
      if (i > hw || i >= n) throw Error(`shell index ${i} skips ahead of ${hw}`);
      w.index.uvar(hw - i);
      if (i !== hw) continue;
      hw++;
      let ref = 0;
      for (let b = 1; b <= DUP_WINDOW && i - b >= 0; b++) { const j = i - b; if (X[j] === X[i] && Y[j] === Y[i] && Z[j] === Z[i] && U[j] === U[i] && V[j] === V[i] && sameRecord(m, i, j)) { ref = b; break; } }
      w.dup.byte(ref);
      if (ref) continue;
      xy(X[i], Y[i]);
      w.z.zvar(Z[i] - gz); gz = Z[i]; w.u.zvar(U[i] - gu); gu = U[i]; w.v.zvar(V[i] - gv); gv = V[i];
      record(i);
    }
    t += 3;
  }
  if (hw !== n) throw Error(`shell indices use ${hw} of ${n} vertices`);
  for (const plane of colour) w.colour.bytes(Uint8Array.from(plane));
  const runs: [number, number][] = [];
  for (let k = 0; k < n; k++) { const b = m.bids[k]; if (runs.length && runs[runs.length - 1][0] === b) runs[runs.length - 1][1]++; else runs.push([b, 1]); }
  w.bids.uvar(runs.length); let prev = 0;
  for (const [b, c] of runs) { w.bids.zvar(b - prev); w.bids.uvar(c); prev = b; }
  const out = new Writer(), streams = SHEL1_STREAMS.map(k => w[k].done());
  out.byte(SHEL_LEVEL); out.uvar(n); out.uvar(I.length); out.uvar(streams.length);
  for (const b of streams) out.uvar(b.length);
  for (const b of streams) out.bytes(b);
  return out.done();
}

function decodeShel1(r: Reader): ShellMesh {
  const n = r.count(MAX_VERTICES, 'shell vertices'), ni = r.count(MAX_VERTICES * 3, 'shell indices');
  if (ni % 3) r.fail(`${ni} shell indices`);
  const count = r.count(64, 'SHEL streams');
  if (count !== SHEL1_STREAMS.length) r.fail(`${count} SHEL streams, expected ${SHEL1_STREAMS.length}`);
  const lengths: number[] = []; for (let k = 0; k < count; k++) lengths.push(r.count(r.buf.length, 'SHEL stream length'));
  const s = Object.fromEntries(SHEL1_STREAMS.map((k, i) => [k, new Reader(r.take(lengths[i]), `${r.what} SHEL ${k}`)])) as Record<Shel1Stream, Reader>;
  r.end();
  const positions = new Float32Array(n * 3), uvs = new Float32Array(n * 2), layers = new Uint8Array(n), tints = new Uint8Array(n * 4), accents = new Uint8Array(n * 4).fill(255), bids = new Uint16Array(n), indices = new Uint32Array(ni);
  const recent = new RecentXY();
  let px = 0, py = 0;
  const xy = (): [number, number] => {
    const c = s.xyCode.uvar();
    if (c > 0) { if (c > recent.size) s.xyCode.fail(`xy back-reference ${c} of ${recent.size}`); const at = recent.at(c - 1); recent.front(c - 1); return at; }
    px += s.dx.zvar(); py += s.dy.zvar(); recent.push(px, py); return [px, py];
  };
  // A record's colour is an index into the colour planes, read once every record is known (the planes follow each other).
  type Rec = { layer: number; shade: number; colour: number };
  let colourIndex = -1;
  const record = (): Rec => { const layer = s.layer.byte(), shade = s.shade.byte(), same = s.colourSame.byte(); if (same > 1) s.colourSame.fail(`flag ${same}`); if (!same) colourIndex++; else if (colourIndex < 0) s.colourSame.fail('no colour yet'); return { layer, shade, colour: colourIndex }; };
  const recOf: Rec[] = new Array(n);
  const put = (k: number, x: number, y: number, z: number, u: number, v: number, rec: Rec) => {
    positions[k * 3] = x * SHEL_UNIT_M; positions[k * 3 + 1] = y * SHEL_UNIT_M; positions[k * 3 + 2] = z * SHEL_UNIT_M;
    uvs[k * 2] = u / UV_UNITS; uvs[k * 2 + 1] = v / UV_UNITS; recOf[k] = rec;
  };
  let qz = 0, qu = 0, qv = 0, gz = 0, gu = 0, gv = 0, hw = 0, t = 0;
  const ix = new Int32Array(n * 5); // the integer fields, for back-references
  const keep = (k: number, x: number, y: number, z: number, u: number, v: number) => { ix[k * 5] = x; ix[k * 5 + 1] = y; ix[k * 5 + 2] = z; ix[k * 5 + 3] = u; ix[k * 5 + 4] = v; };
  while (t < ni) {
    const kind = s.kind.byte();
    if (kind === 1) {
      const k = hw;
      if (k + 3 >= n || t + 6 > ni) s.kind.fail(`quad at vertex ${k} of ${n}`);
      const [x0, y0] = xy(), [x1, y1] = xy();
      qz += s.quadZ.zvar(); const h = s.quadH.zvar(); qu += s.quadU.zvar(); const du = s.quadDu.zvar(); qv += s.quadV.zvar(); const dv = s.quadDv.zvar();
      const rec = record();
      const corners: [number, number, number, number, number][] = [[x0, y0, qz, qu, qv], [x1, y1, qz, qu + du, qv], [x1, y1, qz + h, qu + du, qv + dv], [x0, y0, qz + h, qu, qv + dv]];
      corners.forEach(([x, y, z, u, v], c) => { put(k + c, x, y, z, u, v, rec); keep(k + c, x, y, z, u, v); });
      indices.set([k, k + 1, k + 2, k, k + 2, k + 3], t);
      hw += 4; t += 6; continue;
    }
    if (kind !== 0) s.kind.fail(`primitive kind ${kind}`);
    for (let c = 0; c < 3; c++) {
      const d = s.index.uvar(); if (d > hw) s.index.fail(`index code ${d} above ${hw}`);
      const i = hw - d; if (i >= n) s.index.fail(`index ${i} >= ${n}`);
      indices[t + c] = i;
      if (d !== 0) continue;
      hw++;
      const ref = s.dup.byte();
      if (ref) {
        if (ref > DUP_WINDOW || ref > i) s.dup.fail(`back-reference ${ref} at ${i}`);
        const j = i - ref;
        put(i, ix[j * 5], ix[j * 5 + 1], ix[j * 5 + 2], ix[j * 5 + 3], ix[j * 5 + 4], recOf[j]); keep(i, ix[j * 5], ix[j * 5 + 1], ix[j * 5 + 2], ix[j * 5 + 3], ix[j * 5 + 4]);
        continue;
      }
      const [x, y] = xy();
      gz += s.z.zvar(); gu += s.u.zvar(); gv += s.v.zvar();
      put(i, x, y, gz, gu, gv, record()); keep(i, x, y, gz, gu, gv);
    }
    t += 3;
  }
  if (hw !== n) r.fail(`shell indices use ${hw} of ${n} vertices`);
  // Colour planes: one entry per colour record, six planes.
  const nc = colourIndex + 1, planes: Uint8Array[] = [];
  for (let p = 0; p < 6; p++) planes.push(s.colour.take(nc));
  for (let k = 0; k < n; k++) {
    const rec = recOf[k], c = rec.colour;
    layers[k] = rec.layer; tints[k * 4 + 3] = rec.shade;
    tints[k * 4] = planes[0][c]; tints[k * 4 + 1] = planes[1][c]; tints[k * 4 + 2] = planes[2][c];
    accents[k * 4] = planes[3][c]; accents[k * 4 + 1] = planes[4][c]; accents[k * 4 + 2] = planes[5][c];
  }
  const runs = s.bids.count(n, 'bid runs');
  let at = 0, b = 0;
  for (let k = 0; k < runs; k++) { b += s.bids.zvar(); const c = s.bids.count(n - at, 'bid run'); if (b < 0 || b > 65535) s.bids.fail(`bid ${b}`); bids.fill(b, at, at + c); at += c; }
  if (at !== n) s.bids.fail(`bid runs cover ${at} of ${n} vertices`);
  for (const k of SHEL1_STREAMS) s[k].end();
  return { positions, uvs, layers, tints, accents, bids, indices };
}

export function decodeShel(r: Reader): ShellMesh {
  const level = r.byte();
  if (level === SHEL_LEVEL) return decodeShel1(r);
  if (level !== 0) r.fail(`SHEL level ${level}`);
  const n = r.count(MAX_VERTICES, 'shell vertices'), ni = r.count(MAX_VERTICES * 3, 'shell indices');
  if (ni % 3) r.fail(`${ni} shell indices`);
  const runs = r.count(n, 'bid runs'), bids = new Uint16Array(n);
  let at = 0, b = 0;
  for (let k = 0; k < runs; k++) { b += r.zvar(); const c = r.count(n - at, 'bid run'); if (b < 0 || b > 65535) r.fail(`bid ${b}`); bids.fill(b, at, at + c); at += c; }
  if (at !== n) r.fail(`bid runs cover ${at} of ${n} vertices`);
  const positions = new Float32Array(n * 3), uvs = new Float32Array(n * 2), layers = new Uint8Array(n), tints = new Uint8Array(n * 4), accents = new Uint8Array(n * 4).fill(255);
  readXY(r, positions, n, SHEL_UNIT_M);
  readColumn(r, positions, 3, 2, n, SHEL_UNIT_M);
  for (let a = 0; a < 2; a++) readColumn(r, uvs, 2, a, n, 1 / UV_UNITS);
  layers.set(r.take(n));
  readPlanes(r, tints, 4, 4, n);
  readPlanes(r, accents, 4, 3, n);
  const indices = readIndices(r, ni, n);
  r.end();
  return { positions, uvs, layers, tints, accents, bids, indices };
}

/** The chunk arrays a shell is baked from (threeBuildingMesh Chunk, the fields read here). */
export type ShellChunk = { positions: Float32Array; uvs: Float32Array; layers: Uint8Array; tints: Uint8Array; accents: Uint8Array; indices: Uint32Array; ranges: readonly { id: string; start: number; count: number }[] };

/**
 * A coarse chunk as a SHEL mesh: positions moved to the cell origin, vertices in first-use order, each vertex's
 * building index from `bidOf` (the chunk's ranges name the building). Values are quantised as the encoder will
 * (so `decodeShel(encodeShel(m))` gives `m` back exactly, which the compiler checks).
 */
export function shellFromChunk(chunk: ShellChunk, origin: readonly [number, number], bidOf: (id: string) => number): ShellMesh {
  const vertexBid = new Int32Array(chunk.layers.length).fill(-1);
  // A range the cell does not list (an allotment garden's houses, `allotment-garden:<id>`) takes NO_BID: drawn, never hidden alone.
  for (const r of chunk.ranges) { const b = bidOf(r.id); if (!(b >= 0 && b < NO_BID)) { vertexBid.fill(NO_BID, r.start, r.start + r.count); continue; } vertexBid.fill(b, r.start, r.start + r.count); }
  const { order, indices } = firstUseOrder(chunk.indices, chunk.layers.length), n = order.length;
  const positions = new Float32Array(n * 3), uvs = new Float32Array(n * 2), layers = new Uint8Array(n), tints = new Uint8Array(n * 4), accents = new Uint8Array(n * 4), bids = new Uint16Array(n);
  for (let k = 0; k < n; k++) {
    const o = order[k];
    positions[k * 3] = q(chunk.positions[o * 3] - origin[0], SHEL_UNIT_M) * SHEL_UNIT_M;
    positions[k * 3 + 1] = q(chunk.positions[o * 3 + 1] - origin[1], SHEL_UNIT_M) * SHEL_UNIT_M;
    positions[k * 3 + 2] = q(chunk.positions[o * 3 + 2], SHEL_UNIT_M) * SHEL_UNIT_M;
    uvs[k * 2] = q(chunk.uvs[o * 2], 1 / UV_UNITS) / UV_UNITS; uvs[k * 2 + 1] = q(chunk.uvs[o * 2 + 1], 1 / UV_UNITS) / UV_UNITS;
    layers[k] = chunk.layers[o];
    for (let c = 0; c < 4; c++) tints[k * 4 + c] = chunk.tints[o * 4 + c];
    for (let c = 0; c < 3; c++) accents[k * 4 + c] = chunk.accents[o * 4 + c];
    accents[k * 4 + 3] = 255;
    if (vertexBid[o] < 0) throw Error(`shell vertex ${o} belongs to no building range`);
    bids[k] = vertexBid[o];
  }
  return { positions, uvs, layers, tints, accents, bids, indices };
}

// --- SHL1: far prisms ------------------------------------------------------------------------------------------

/** Douglas–Peucker on a closed ring (open list of points); keeps at least a triangle. */
export function simplifyRing(ring: readonly number[][], tol: number): number[][] {
  if (ring.length <= 3) return ring.map(p => [p[0], p[1]]);
  // Split at the point farthest from the first, simplify both halves as open polylines.
  let far = 1, best = -1;
  for (let k = 1; k < ring.length; k++) { const d = Math.hypot(ring[k][0] - ring[0][0], ring[k][1] - ring[0][1]); if (d > best) { best = d; far = k; } }
  const dp = (pts: readonly number[][]): number[][] => {
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack: [number, number][] = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, l = Math.hypot(dx, dy) || 1e-9;
      let worst = -1, at = -1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l; if (d > worst) { worst = d; at = i; } }
      if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
    }
    return pts.filter((_, i) => keep[i]).map(p => [p[0], p[1]]);
  };
  const a = dp(ring.slice(0, far + 1)), b = dp([...ring.slice(far), ring[0]]);
  const out = [...a, ...b.slice(1, -1)];
  return out.length >= 3 ? out : ring.slice(0, 3).map(p => [p[0], p[1]]);
}

/**
 * The prism of each building (bid) of a SHEL mesh: its wall and roof (tint, layer) by triangle area (walls: |nz| < 0.5,
 * roofs and lids: nz ≥ 0.5). `rings[bid]`: the building's footprint rings in chunk metres from the cell origin
 * (outer first; null: not drawn), `heights[bid]`: eaves and roof top. One entry per bid: null for a building without
 * rings or without a SHEL triangle.
 */
export function farPrisms(shel: ShellMesh, rings: readonly (number[][][] | null)[], heights: readonly { eavesM: number; topM: number }[]): (FarPrism | null)[] {
  const wallArea = new Map<number, Map<string, number>>(), roofArea = new Map<number, Map<string, number>>();
  const p = shel.positions, t = shel.tints;
  for (let k = 0; k < shel.indices.length; k += 3) {
    const a = shel.indices[k], b = shel.indices[k + 1], c = shel.indices[k + 2];
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;
    const roof = Math.abs(nz) / len >= 0.5, bid = shel.bids[a];
    const key = `${t[a * 4]},${t[a * 4 + 1]},${t[a * 4 + 2]},${shel.layers[a]}`;
    const by = roof ? roofArea : wallArea;
    let m = by.get(bid); if (!m) by.set(bid, m = new Map());
    m.set(key, (m.get(key) ?? 0) + len / 2);
  }
  const top = (m: Map<string, number> | undefined) => { let best: string | null = null, area = -1; if (m) for (const [k, v] of m) if (v > area || (v === area && k < best!)) { best = k; area = v; } return best ? best.split(',').map(Number) as [number, number, number, number] : null; };
  return rings.map((r, bid) => {
    if (!r || !r.length) return null;
    const wall = top(wallArea.get(bid)), roof = top(roofArea.get(bid));
    if (!wall && !roof) return null;
    const { eavesM, topM } = heights[bid];
    return { rings: r, eavesM, topM: Math.max(eavesM, topM), wall: wall ?? roof!, roof: roof ?? wall!, tile: '' };
  });
}

/** Quantise a prism list as SHL1 stores it (the compiler compares decode(encode(x)) with this). */
export function quantisePrisms(prisms: readonly FarPrism[]): FarPrism[] {
  const g = (v: number) => q(v, SHL1_UNIT_M) * SHL1_UNIT_M, dm = (v: number) => Math.max(0, Math.round(v * 10)) / 10;
  return prisms.map(pr => {
    const rings = pr.rings.map(ring => {
      const pts: number[][] = [];
      for (const [x, y] of ring) { const gx = g(x), gy = g(y); const last = pts[pts.length - 1]; if (!last || last[0] !== gx || last[1] !== gy) pts.push([gx, gy]); }
      if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      return pts;
    }).filter(r => r.length >= 3);
    const eavesM = dm(pr.eavesM);
    return { rings, eavesM, topM: Math.max(eavesM, dm(pr.topM)), wall: pr.wall, roof: pr.roof, tile: pr.tile };
  }).filter(pr => pr.rings.length);
}

export function encodeShl1(prisms: readonly FarPrism[]): Uint8Array {
  const w = new Writer(), n = prisms.length;
  w.byte(2);
  const tiles: string[] = [], tileIndex = new Map<string, number>();
  for (const pr of prisms) if (!tileIndex.has(pr.tile)) { const [x, y] = pr.tile.split('/').map(Number); if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || `${x}/${y}` !== pr.tile) throw Error(`bad prism tile ${pr.tile}`); tileIndex.set(pr.tile, tiles.length); tiles.push(pr.tile); }
  w.uvar(tiles.length); for (const t of tiles) { const [x, y] = t.split('/').map(Number); w.uvar(x); w.uvar(y); }
  w.uvar(n);
  for (const pr of prisms) w.uvar(tileIndex.get(pr.tile)!);
  for (const pr of prisms) w.uvar(pr.rings.length);
  for (const pr of prisms) for (const r of pr.rings) w.uvar(r.length);
  let px = 0, py = 0;
  const xs: number[] = [], ys: number[] = [];
  for (const pr of prisms) for (const r of pr.rings) for (const [x, y] of r) { xs.push(q(x, SHL1_UNIT_M)); ys.push(q(y, SHL1_UNIT_M)); }
  for (const x of xs) { w.zvar(x - px); px = x; }
  for (const y of ys) { w.zvar(y - py); py = y; }
  for (const pr of prisms) w.uvar(Math.round(pr.eavesM * 10));
  for (const pr of prisms) w.uvar(Math.round((pr.topM - pr.eavesM) * 10));
  writePlanes(w, prisms.flatMap(pr => pr.wall), 4, 4, n);
  writePlanes(w, prisms.flatMap(pr => pr.roof), 4, 4, n);
  return w.done();
}
export function decodeShl1(r: Reader): FarPrism[] {
  const level = r.byte(); if (level !== 2) r.fail(`SHL1 level ${level}`);
  const nt = r.count(10_000, 'prism tiles'), tiles: string[] = [];
  for (let k = 0; k < nt; k++) tiles.push(`${r.uvar()}/${r.uvar()}`);
  const n = r.count(200_000, 'prisms'), ringCounts: number[] = [], tileOf: string[] = [];
  for (let k = 0; k < n; k++) { const t = r.uvar(); if (t >= tiles.length) r.fail(`prism tile ${t} of ${tiles.length}`); tileOf.push(tiles[t]); }
  for (let k = 0; k < n; k++) ringCounts.push(r.count(10_000, 'rings'));
  const pointCounts: number[][] = ringCounts.map(c => { const l: number[] = []; for (let k = 0; k < c; k++) { const m = r.count(100_000, 'ring points'); if (m < 3) r.fail(`ring of ${m} points`); l.push(m); } return l; });
  const total = pointCounts.reduce((s, l) => s + l.reduce((a, b) => a + b, 0), 0);
  if (total > MAX_VERTICES) r.fail(`${total} ring points`);
  const xs = new Float64Array(total), ys = new Float64Array(total);
  let p = 0; for (let k = 0; k < total; k++) { p += r.zvar(); xs[k] = p * SHL1_UNIT_M; }
  p = 0; for (let k = 0; k < total; k++) { p += r.zvar(); ys[k] = p * SHL1_UNIT_M; }
  const eaves: number[] = [], rise: number[] = [];
  for (let k = 0; k < n; k++) eaves.push(r.uvar() / 10);
  for (let k = 0; k < n; k++) rise.push(r.uvar() / 10);
  const wall: number[] = new Array(n * 4), roof: number[] = new Array(n * 4);
  readPlanes(r, wall, 4, 4, n); readPlanes(r, roof, 4, 4, n);
  r.end();
  const out: FarPrism[] = []; let v = 0;
  for (let k = 0; k < n; k++) {
    const rings = pointCounts[k].map(m => { const ring: number[][] = []; for (let e = 0; e < m; e++, v++) ring.push([xs[v], ys[v]]); return ring; });
    out.push({ rings, eavesM: eaves[k], topM: +(eaves[k] + rise[k]).toFixed(1), wall: wall.slice(k * 4, k * 4 + 4) as FarPrism['wall'], roof: roof.slice(k * 4, k * 4 + 4) as FarPrism['roof'], tile: tileOf[k] });
  }
  return out;
}

/** Far walls start this far below 0 (the own ground's relief lies a few metres either side of it; buildings are not lifted at this distance). */
export const FAR_BASE_M = -3;
/** A rise under this draws no roof band (a flat roof: the lid at the eaves). */
export const FAR_FLAT_RISE_M = 0.5;
/** A pitched roof's band leans this much (its baked shade is a 45° slope's facing the wall's normal). */
const SLOPE = Math.SQRT1_2;

/**
 * Extrude SHL1 prisms into one mesh (the far tier draws one per cell): per ring edge a wall quad from 0 to the eaves
 * (wall tint, the light rig's wall shade) and, under a pitched roof, a band from the eaves to the roof's mid height
 * (roof tint, a 45° slope's shade), then an earcut lid at that height (roof tint, the flat-roof shade). Positions in
 * metres from the cell origin, z from 0 (the ground lift is the layer's).
 */
export function farShellMesh(prisms: readonly FarPrism[], options: { partyWalls?: boolean; /** Prisms whose walls hide these prisms' party walls (default: `prisms`). */ neighbours?: readonly FarPrism[] } = {}): FarShellMesh {
  // Party walls (lane R2-B): an edge whose reverse is another prism's edge (same 0.5 m grid points) is hidden up to the
  // lower of the two eaves; a wall at or under a neighbour of at least its height is not drawn (`partyWalls: true` draws all).
  const cull = !options.partyWalls, key = (x0: number, y0: number, x1: number, y1: number) => `${Math.round(x0 * 2)},${Math.round(y0 * 2)},${Math.round(x1 * 2)},${Math.round(y1 * 2)}`;
  const oriented = prisms.map(pr => pr.rings.map((ring, ri) => {
    let area2 = 0; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) area2 += ring[b][0] * ring[a][1] - ring[a][0] * ring[b][1];
    // Outer rings counter-clockwise, holes clockwise: the outward normal is on the right of travel.
    return (area2 > 0) !== (ri === 0) ? [...ring].reverse() : ring;
  }));
  const edgeEaves = new Map<string, number>(), others = options.neighbours ?? prisms;
  const orient = (pr: FarPrism) => pr.rings.map((ring, ri) => { let area2 = 0; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) area2 += ring[b][0] * ring[a][1] - ring[a][0] * ring[b][1]; return (area2 > 0) !== (ri === 0) ? [...ring].reverse() : ring; });
  if (cull) for (const pr of others) for (const ring of others === prisms ? oriented[prisms.indexOf(pr)] : orient(pr)) for (let e = 0; e < ring.length; e++) { const a = ring[e], b = ring[(e + 1) % ring.length]; const id = key(a[0], a[1], b[0], b[1]); edgeEaves.set(id, Math.max(edgeEaves.get(id) ?? -Infinity, pr.eavesM)); }
  const hidden = (a: number[], b: number[], eavesM: number) => cull && (edgeEaves.get(key(b[0], b[1], a[0], a[1])) ?? -Infinity) >= eavesM;
  let quads = 0, lidTris = 0, lidVerts = 0;
  const lids = prisms.map((pr, k) => {
    const flat: number[] = [], holes: number[] = [], pitched = pr.topM - pr.eavesM >= FAR_FLAT_RISE_M;
    oriented[k].forEach((ring, ri) => {
      if (ri) holes.push(flat.length / 2);
      for (let e = 0; e < ring.length; e++) { flat.push(ring[e][0], ring[e][1]); if (!hidden(ring[e], ring[(e + 1) % ring.length], pr.eavesM)) quads += pitched ? 2 : 1; }
    });
    const tri = earcut(flat, holes);
    lidTris += tri.length / 3; lidVerts += flat.length / 2;
    return { flat, tri };
  });
  const n = quads * 4 + lidVerts, positions = new Float32Array(n * 3), layers = new Uint8Array(n), tints = new Uint8Array(n * 4), indices = new Uint32Array(quads * 6 + lidTris * 3);
  let v = 0, ix = 0;
  const vert = (x: number, y: number, z: number, c: readonly number[], shade: number) => {
    positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z;
    tints[v * 4] = c[0]; tints[v * 4 + 1] = c[1]; tints[v * 4 + 2] = c[2]; tints[v * 4 + 3] = Math.round(shade * 255); layers[v] = c[3];
    return v++;
  };
  prisms.forEach((pr, k) => {
    const pitched = pr.topM - pr.eavesM >= FAR_FLAT_RISE_M, lidZ = pitched ? (pr.eavesM + pr.topM) / 2 : pr.eavesM;
    for (const ring of oriented[k]) for (let e = 0; e < ring.length; e++) {
      const [x0, y0] = ring[e], [x1, y1] = ring[(e + 1) % ring.length];
      if (hidden(ring[e], ring[(e + 1) % ring.length], pr.eavesM)) continue;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (y1 - y0) / len, ny = -(x1 - x0) / len;
      const bands: [number, number, readonly number[], number][] = [[FAR_BASE_M, pr.eavesM, pr.wall, bakedWallShade(nx, ny)]];
      if (pitched) bands.push([pr.eavesM, lidZ, pr.roof, bakedFaceShade([nx * SLOPE, ny * SLOPE, SLOPE])]);
      for (const [z0, z1, c, s] of bands) {
        const a = vert(x0, y0, z0, c, s), b = vert(x1, y1, z0, c, s), cc = vert(x1, y1, z1, c, s), d = vert(x0, y0, z1, c, s);
        indices.set([a, b, cc, a, cc, d], ix); ix += 6;
      }
    }
    const { flat, tri } = lids[k], base = v;
    for (let p = 0; p < flat.length; p += 2) vert(flat[p], flat[p + 1], lidZ, pr.roof, BAKED_LID_SHADE);
    // The lid faces up (counter-clockwise seen from above) whatever earcut's winding.
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t], b = tri[t + 1], c = tri[t + 2];
      const ccw = (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]) > 0;
      indices[ix++] = base + a; indices[ix++] = base + (ccw ? b : c); indices[ix++] = base + (ccw ? c : b);
    }
  });
  return { positions, layers, tints, indices };
}

export const shellTriangles = (m: { indices: Uint32Array }) => m.indices.length / 3;

/** A far cell as the far tier uploads it: one mesh, positions in decimetres (int16) from the cell origin, the vertex range of each z14 tile's prisms. */
export type FarCellArrays = { positions: Int16Array; layers: Uint8Array; tints: Uint8Array; indices: Uint16Array | Uint32Array; parts: { tile: string; start: number; count: number }[] };
/** Extrude a cell's prisms tile by tile (farShellMesh per tile, party walls culled within the cell) into one buffer set. */
export function farCellArrays(prisms: readonly FarPrism[]): FarCellArrays {
  const byTile = new Map<string, FarPrism[]>();
  for (const pr of prisms) { let l = byTile.get(pr.tile); if (!l) byTile.set(pr.tile, l = []); l.push(pr); }
  // Party walls are culled across the whole cell: a wall hidden by a neighbour in another tile part stays hidden.
  const meshes = [...byTile].map(([tile, list]) => ({ tile, mesh: farShellMesh(list, { neighbours: prisms }) }));
  const nv = meshes.reduce((s, m) => s + m.mesh.layers.length, 0), ni = meshes.reduce((s, m) => s + m.mesh.indices.length, 0);
  const positions = new Int16Array(nv * 3), layers = new Uint8Array(nv), tints = new Uint8Array(nv * 4), indices = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const parts: FarCellArrays['parts'] = [];
  let v = 0, ix = 0;
  for (const { tile, mesh } of meshes) {
    const n = mesh.layers.length;
    for (let k = 0; k < n * 3; k++) positions[v * 3 + k] = Math.round(mesh.positions[k] * 10);
    layers.set(mesh.layers, v); tints.set(mesh.tints, v * 4);
    for (let k = 0; k < mesh.indices.length; k++) indices[ix + k] = mesh.indices[k] + v;
    parts.push({ tile, start: v, count: n });
    v += n; ix += mesh.indices.length;
  }
  return { positions, layers, tints, indices, parts };
}
