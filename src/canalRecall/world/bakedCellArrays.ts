/**
 * A decoded SHEL mesh as the baked coarse tier uploads it (lane R4-A, #243): vertices regrouped so each building's are
 * one contiguous range (buildings in first-use order, vertices in their decoded order inside it), indices remapped, and
 * every range named by the building's id (the cell's FOOT order is the `bid`). The layer then hides, ghosts, highlights
 * and swap-marks a building by filling its range, exactly as threeBuildingsBrowser applyHidden does for a coarse chunk.
 * Pure: the world worker runs it after decodeShel.
 */
import { NO_BID, WALL_UV_UNIT_M, type RecordShellMesh, type ShellMesh } from './shellMesh.js';

/**
 * The GPU grid of a quantised cell, metres: Int16 steps of a decimetre (±3,276 m from the cell origin). A cell drawn
 * from afar needs no finer; one the detail tier swaps over is fetched unquantised (`quantised` false, the SHEL's own
 * SHEL_UNIT_M) and lifted in Float32 metres.
 */
export const BAKED_GRID_M = 0.1;

export type BakedRange = { id: string; start: number; count: number };
/**
 * Positions are from the cell origin (shellOrigin), z up from 0 (the layer lifts buildings onto the ground), in
 * `positionUnit` metres: 1 (Float32), or BAKED_GRID_M (Int16; `quantised`, 6 bytes a vertex less
 * on the GPU; the mesh is scaled by the unit).
 */
export type BakedCellArrays = {
  positions: Float32Array | Int16Array; positionUnit: number; uvs: Float32Array; layers: Uint8Array; tints: Uint8Array; accents: Uint8Array;
  indices: Uint16Array | Uint32Array; ranges: BakedRange[]; triangles: number;
  /** look/thinFade.ts pairs (2 per vertex) when the SHEL carries them (level 2): the runtime coarse chunk's `thin`. */
  thin?: Uint8Array;
  /**
   * Bytes per vertex of `accents`: 4 (RGBA, as the SHEL stores it), or 3 (`compact`, lane R4-I #253): every SHEL
   * accent's alpha is 255 and the chunk shaders read `accent.rgb` only, so the GPU's default w (1.0) draws the same.
   */
  accentSize: 3 | 4;
};

/** `ids[bid]`: the cell's building ids in FOOT order. Vertices of NO_BID (allotment gardens) form one range with id ''. */
export function bakedCellArrays(shel: ShellMesh, ids: readonly string[], quantised = false, compact = false): BakedCellArrays {
  const n = shel.layers.length;
  // Per bid: its order of first use, then a counting sort of the vertices by that order (stable).
  const rank = new Map<number, number>(), order: number[] = [], counts: number[] = [];
  for (let k = 0; k < n; k++) {
    const b = shel.bids[k];
    let r = rank.get(b);
    if (r === undefined) { rank.set(b, r = order.length); order.push(b); counts.push(0); }
    counts[r]++;
  }
  const starts = new Array<number>(order.length);
  let at = 0;
  for (let r = 0; r < order.length; r++) { starts[r] = at; at += counts[r]; }
  const next = starts.slice(), remap = new Uint32Array(n);
  for (let k = 0; k < n; k++) remap[k] = next[rank.get(shel.bids[k])!]++;
  const as = compact ? 3 : 4;
  const positions = new Float32Array(n * 3), uvs = new Float32Array(n * 2), layers = new Uint8Array(n), tints = new Uint8Array(n * 4), accents = new Uint8Array(n * as);
  const thin = shel.thin ? new Uint8Array(n * 2) : undefined;
  for (let k = 0; k < n; k++) {
    const v = remap[k];
    positions[v * 3] = shel.positions[k * 3]; positions[v * 3 + 1] = shel.positions[k * 3 + 1]; positions[v * 3 + 2] = shel.positions[k * 3 + 2];
    uvs[v * 2] = shel.uvs[k * 2]; uvs[v * 2 + 1] = shel.uvs[k * 2 + 1];
    layers[v] = shel.layers[k];
    if (thin) { thin[v * 2] = shel.thin![k * 2]; thin[v * 2 + 1] = shel.thin![k * 2 + 1]; }
    for (let c = 0; c < 4; c++) tints[v * 4 + c] = shel.tints[k * 4 + c];
    for (let c = 0; c < as; c++) accents[v * as + c] = shel.accents[k * 4 + c];
  }
  const indices = n <= 65536 ? new Uint16Array(shel.indices.length) : new Uint32Array(shel.indices.length);
  for (let k = 0; k < shel.indices.length; k++) indices[k] = remap[shel.indices[k]];
  const ranges: BakedRange[] = order.map((b, r) => ({ id: b === NO_BID ? '' : ids[b] ?? '', start: starts[r], count: counts[r] }));
  const q = quantised ? toGrid(positions) : null;
  return { positions: q ?? positions, positionUnit: q ? BAKED_GRID_M : 1, uvs, layers, tints, accents, indices, ranges, triangles: shel.indices.length / 3, accentSize: as, ...(thin ? { thin } : {}) };
}

/**
 * A record shell (SHEL level 3, F1 #380) as the baked tier uploads it: the 18-byte vertex of the design doc §2.2 —
 * position (Int16 x3 on BAKED_GRID_M, or Float32 when `quantised` is false), wall u/v/len (Int16 x3 in WALL_UV_UNIT_M),
 * record (Uint16), wallKind (Uint8); the layer adds hidden and swapSlot. Regrouped per building like bakedCellArrays.
 */
export type BakedRecordArrays = {
  positions: Float32Array | Int16Array; positionUnit: number; walls: Int16Array; wallUnit: number; recs: Uint16Array; wallKinds: Uint8Array;
  indices: Uint16Array | Uint32Array; ranges: BakedRange[]; triangles: number;
};
export function bakedRecordArrays(shel: RecordShellMesh, ids: readonly string[], quantised = false): BakedRecordArrays {
  const n = shel.recs.length;
  const rank = new Map<number, number>(), order: number[] = [], counts: number[] = [];
  for (let k = 0; k < n; k++) {
    const b = shel.bids[k];
    let r = rank.get(b);
    if (r === undefined) { rank.set(b, r = order.length); order.push(b); counts.push(0); }
    counts[r]++;
  }
  const starts = new Array<number>(order.length);
  let at = 0;
  for (let r = 0; r < order.length; r++) { starts[r] = at; at += counts[r]; }
  const next = starts.slice(), remap = new Uint32Array(n);
  for (let k = 0; k < n; k++) remap[k] = next[rank.get(shel.bids[k])!]++;
  const positions = new Float32Array(n * 3), walls = new Int16Array(n * 3), recs = new Uint16Array(n), wallKinds = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const v = remap[k];
    for (let c = 0; c < 3; c++) {
      positions[v * 3 + c] = shel.positions[k * 3 + c];
      const w = Math.round(shel.walls[k * 3 + c] / WALL_UV_UNIT_M);
      walls[v * 3 + c] = Math.max(-32768, Math.min(32767, w));
    }
    recs[v] = shel.recs[k]; wallKinds[v] = shel.wallKinds[k];
  }
  const indices = n <= 65536 ? new Uint16Array(shel.indices.length) : new Uint32Array(shel.indices.length);
  for (let k = 0; k < shel.indices.length; k++) indices[k] = remap[shel.indices[k]];
  const ranges: BakedRange[] = order.map((b, r) => ({ id: b === NO_BID ? '' : ids[b] ?? '', start: starts[r], count: counts[r] }));
  const q = quantised ? toGrid(positions) : null;
  return { positions: q ?? positions, positionUnit: q ? BAKED_GRID_M : 1, walls, wallUnit: WALL_UV_UNIT_M, recs, wallKinds, indices, ranges, triangles: shel.indices.length / 3 };
}

/** Metres on the SHEL grid as Int16 grid steps; null when a coordinate does not fit (it then stays Float32). */
function toGrid(positions: Float32Array): Int16Array | null {
  const out = new Int16Array(positions.length);
  for (let k = 0; k < positions.length; k++) {
    const v = Math.round(positions[k] / BAKED_GRID_M);
    if (v > 32767 || v < -32768) return null;
    out[k] = v;
  }
  return out;
}
