import type { Document } from '@gltf-transform/core';
import { compactPrimitive, prune } from '@gltf-transform/functions';

// A street chunk without one pand's wall on another street (house rows, lane D 2026-11-14). Pure.
//
// Why: a face chunk owns a corner pand whole (its roof, its other street), but the row on the cross street draws that
// pand's wall in the row's series dress (scripts/house-specs/rows/wall-only.json, RowMember.wallOnly). The rowFront
// variant of the chunk is the same GLB with the triangles of that wall taken out: everything of the pand whose centroid
// lies in a box on the edge (along the edge, a band across the wall plane, below the eaves) - the wall, its openings,
// frames, ground storey and shopfront, sills and cornice - while the roof, its dormers, the other street's front and the
// other pands stay byte for byte. The row's wall slab closes the face.

/** The chunk's local frame (streetChunk extras `frame`): x along uRD, z along nRD, both from midRD, y up. */
export interface ChunkFrame { midRD: readonly number[]; uRD: readonly number[]; nRD: readonly number[] }

/** RD New metres to the chunk's local [x, z]. */
export function rdToChunk(frame: ChunkFrame, p: readonly number[]): [number, number] {
  const dx = p[0] - frame.midRD[0], dy = p[1] - frame.midRD[1];
  return [dx * frame.uRD[0] + dy * frame.uRD[1], dx * frame.nRD[0] + dy * frame.nRD[1]];
}

/** The box of the wall to cut, in the chunk's frame. */
export interface WallZone {
  /** Edge ends [x, z]. */
  a: readonly [number, number];
  b: readonly [number, number];
  /** Unit normal of the edge pointing out of the pand, [x, z]. */
  out: readonly [number, number];
  /** Reach out of the wall plane (sills, cornice, shopfront, sign) and into it (window reveals, recessed doors), m. */
  outM: number;
  inM: number;
  /** Centroids at or above this height stay (the roof storey and its dormers). */
  yMaxM: number;
  /** Margin past the edge ends that still counts as the wall (0: the end walls and the corner stay). */
  endM: number;
}

/** Default reach: the Corner Inn sign and the heavy cornice stand ~1.1 m proud; reveals ~0.3 m deep. */
export const WALL_ZONE_DEFAULTS = { outM: 1.6, inM: 0.35, endM: 0 } as const;

/**
 * The zone of an edge given a point inside the pand (its vertex mean): the outward normal is the edge normal facing
 * away from that point.
 */
export function wallZone(a: readonly [number, number], b: readonly [number, number], inside: readonly [number, number], yMaxM: number, reach: Partial<Pick<WallZone, 'outM' | 'inM' | 'endM'>> = {}): WallZone {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(L > 0.5)) throw new Error(`wallZone: edge too short (${L.toFixed(2)} m)`);
  const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  let n: [number, number] = [t[1], -t[0]];
  if ((inside[0] - a[0]) * n[0] + (inside[1] - a[1]) * n[1] > 0) n = [-n[0], -n[1]];
  return { a, b, out: n, yMaxM, ...WALL_ZONE_DEFAULTS, ...reach };
}

/** Whether a triangle centroid [x, y, z] lies in the zone. */
export function inZone(z: WallZone, c: readonly number[]): boolean {
  const L = Math.hypot(z.b[0] - z.a[0], z.b[1] - z.a[1]), t = [(z.b[0] - z.a[0]) / L, (z.b[1] - z.a[1]) / L];
  const rx = c[0] - z.a[0], rz = c[2] - z.a[1];
  const along = rx * t[0] + rz * t[1], off = rx * z.out[0] + rz * z.out[1];
  return c[1] < z.yMaxM && along >= -z.endM && along <= L + z.endM && off <= z.outM && off >= -z.inM;
}

export type PandRangeTuple = [pand: number, firstTriangle: number, triangleCount: number];

/** One primitive's triangles: its index buffer and positions, and its pand ranges ([pand, first, count]). */
export interface CutPrimitive { indices: ArrayLike<number>; positions: ArrayLike<number>; ranges: readonly (readonly number[])[] }

/**
 * The primitive without the zone's triangles of `pand`: a new index buffer (other triangles in order) and the ranges
 * re-based (the pand's count shrinks, later ranges shift down). `removed` counts the triangles taken out.
 */
export function cutPrimitive(p: CutPrimitive, pand: number, zone: WallZone): { indices: number[]; ranges: PandRangeTuple[]; removed: number } {
  const tris = Math.floor(p.indices.length / 3), drop = new Uint8Array(tris);
  for (const [pd, first, count] of p.ranges) {
    if (pd !== pand) continue;
    for (let k = first; k < Math.min(first + count, tris); k++) {
      const c = [0, 0, 0];
      for (let j = 0; j < 3; j++) { const v = p.indices[3 * k + j]; c[0] += p.positions[3 * v] / 3; c[1] += p.positions[3 * v + 1] / 3; c[2] += p.positions[3 * v + 2] / 3; }
      if (inZone(zone, c)) drop[k] = 1;
    }
  }
  const indices: number[] = [];
  for (let k = 0; k < tris; k++) if (!drop[k]) indices.push(p.indices[3 * k], p.indices[3 * k + 1], p.indices[3 * k + 2]);
  // Removed triangles before each triangle index, for re-basing the ranges.
  const before = new Uint32Array(tris + 1);
  for (let k = 0; k < tris; k++) before[k + 1] = before[k] + drop[k];
  const ranges: PandRangeTuple[] = p.ranges.map(([pd, first, count]) => {
    const end = Math.min(first + count, tris);
    return [pd, first - before[first], end - first - (before[end] - before[first])];
  });
  return { indices, ranges, removed: before[tris] };
}

type PandMeta = { pandId: string; triangles: number; ranges: { primitive: number; firstTriangle: number; triangleCount: number }[] };
/** A wall to cut: the pand, its edge in RD (left to right as seen), and the compile's fronts (the edge's front gives the eaves). */
export interface WallToCut { pandId: string; edgeRD: readonly (readonly number[])[]; fronts: readonly { id: string; widthM: number; eavesM: number }[] }
export interface WallCut { pandId: string; front: string; edgeM: number; eavesM: number; zone: unknown; removed: number; perMaterial: Record<string, number> }

/**
 * Cuts each wall from a chunk document in place (one node, one mesh, streetChunk extras): the triangles go, the
 * primitives' pandRanges and the streetChunk pands' ranges follow, an emptied primitive is removed (the meshopt
 * encoder asserts on it), a cut primitive is compacted, unused accessors are pruned. Returns the cuts and the triangles left.
 */
export async function cutChunkWalls(doc: Document, walls: readonly WallToCut[]): Promise<{ cuts: WallCut[]; triangles: number }> {
  const node = doc.getRoot().listNodes()[0], extras = node.getExtras() as { streetChunk: { frame: ChunkFrame; pands: PandMeta[] } };
  const sc = extras.streetChunk, prims = node.getMesh()!.listPrimitives();
  const cuts: WallCut[] = [], cutPrims = new Set<number>();
  for (const w of walls) {
    const pand = sc.pands.findIndex(p => p.pandId === w.pandId);
    if (pand < 0) throw new Error(`${w.pandId} not in the chunk`);
    const a = rdToChunk(sc.frame, w.edgeRD[0]), b = rdToChunk(sc.frame, w.edgeRD[1]), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // The front on this edge (the compile's per-front eaves): the one whose width matches the edge.
    if (!w.fronts.length) throw new Error(`${w.pandId}: no compiled fronts`);
    const fr = w.fronts.reduce((x, y) => (Math.abs(y.widthM - L) < Math.abs(x.widthM - L) ? y : x));
    if (Math.abs(fr.widthM - L) > 0.3) throw new Error(`${w.pandId}: no front of the compile matches the ${L.toFixed(2)} m edge (closest ${fr.id} ${fr.widthM} m)`);
    // A point inside the pand: its vertex mean.
    let sx = 0, sz = 0, nv = 0;
    for (const r of sc.pands[pand].ranges) {
      const p = prims[r.primitive], pos = p.getAttribute('POSITION')!.getArray()!, idx = p.getIndices()!.getArray()!;
      for (let k = 3 * r.firstTriangle; k < 3 * (r.firstTriangle + r.triangleCount); k++) { sx += pos[3 * idx[k]]; sz += pos[3 * idx[k] + 2]; nv++; }
    }
    const zone = wallZone(a, b, [sx / nv, sz / nv], fr.eavesM - 0.02);
    const perMaterial: Record<string, number> = {};
    let removed = 0;
    prims.forEach((p, i) => {
      const ranges = ((p.getExtras() as { pandRanges?: number[][] }).pandRanges ?? []);
      if (!ranges.some(r => r[0] === pand)) return;
      const idxAcc = p.getIndices()!, res = cutPrimitive({ indices: idxAcc.getArray()!, positions: p.getAttribute('POSITION')!.getArray()!, ranges }, pand, zone);
      if (!res.removed) return;
      const Arr = idxAcc.getArray()!.constructor as Uint16ArrayConstructor | Uint32ArrayConstructor;
      idxAcc.setArray(new Arr(res.indices));
      p.setExtras({ ...p.getExtras(), pandRanges: res.ranges });
      for (const pm of sc.pands) for (const r of pm.ranges) if (r.primitive === i) {
        const t = res.ranges.find(x => x[0] === sc.pands.indexOf(pm))!;
        pm.triangles += t[2] - r.triangleCount; r.firstTriangle = t[1]; r.triangleCount = t[2];
      }
      perMaterial[p.getMaterial()?.getName() ?? `#${i}`] = res.removed; removed += res.removed; cutPrims.add(i);
    });
    cuts.push({ pandId: w.pandId, front: fr.id, edgeM: +L.toFixed(3), eavesM: fr.eavesM, zone: { ...zone, a: zone.a.map(v => +v.toFixed(3)), b: zone.b.map(v => +v.toFixed(3)), out: zone.out.map(v => +v.toFixed(4)) }, removed, perMaterial });
  }
  // A primitive the cut emptied (a material only that wall used: Kinkerstraat 86-88's black glazing) is dropped, and the
  // pands' primitive numbers follow; a cut primitive drops the vertices it no longer uses. An empty primitive failed the
  // meshopt encoder on install (assert size % 4 == 0, integrator 2026-11-14).
  const mesh = node.getMesh()!;
  const renumber = new Map<number, number>();
  let kept = 0;
  prims.forEach((p, i) => {
    if (p.getIndices()!.getCount() === 0) { mesh.removePrimitive(p); p.dispose(); return; }
    if (cutPrims.has(i)) compactPrimitive(p);
    renumber.set(i, kept++);
  });
  for (const pm of sc.pands) pm.ranges = pm.ranges.filter(r => renumber.has(r.primitive) && r.triangleCount > 0).map(r => ({ ...r, primitive: renumber.get(r.primitive)! }));
  node.setExtras(extras);
  await doc.transform(prune());
  return { cuts, triangles: mesh.listPrimitives().reduce((t, p) => t + p.getIndices()!.getCount() / 3, 0) };
}
