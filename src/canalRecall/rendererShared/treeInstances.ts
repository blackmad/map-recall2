/**
 * Incremental inventory-tree instances (lane R4-F, #249; `?treesIncremental=1`).
 *
 * `InventoryTrees.rebuild()` (public/canal-drive/js/inventory-trees-source.js) rebuilt every resident instance on any
 * input: a tree tile arriving, a ground re-base, the view leaving its built bounds. Each rebuild walked every tree of
 * the up to twelve resident z15 tiles, made a JS object per trunk, lobe and fork (~80 k from the air), composed each
 * through a three.js Object3D and copied it into a fresh InstancedMesh: 70-235 ms a rebuild from the air on the
 * desktop pan (R4-E #248), the largest script in every remaining long frame.
 *
 * Here a tile's instances are compiled once (per tile tree array and per allotment-canopy variant) into typed arrays:
 * per instance group (wood, each crown geometry and tone) the 4x4 matrices with the ground lift left out, the colours,
 * the tree each instance belongs to and its emission order. A rebuild then only assembles: for each source in the
 * layer's order, the instances of its trees inside the built bounds, the translation's z set to the compiled height
 * plus the tree's ground lift (`z0`, cached per tree per ground revision). A source wholly inside the bounds is a
 * block copy. The output is the legacy path's: the same groups in the same order, the same instances in the same
 * order, the same matrices (compose is three.js Matrix4.compose, evaluated in doubles like it, signed zeros included)
 * and colours, to the bit (a fork, whose matrix depends on the lift through float rounding, is recomposed from its lifted ends).
 * Pure: no THREE, no DOM. Unit-tested in treeInstances.test.ts against three's own Object3D path.
 */

/** One instance as the layer emits it (the legacy `append(key, item)` record), the ground lift left out. */
export type TreeInstanceItem = {
  p: ArrayLike<number>;
  s: ArrayLike<number>;
  /** A yaw about z (three Euler (0, 0, rotation)); ignored when `q` is given. */
  rotation?: number;
  q?: { x: number; y: number; z: number; w: number };
  /** Linear RGB, as three's Color holds it. */
  color: { r: number; g: number; b: number };
  /**
   * A segment between two points (a fork: from, to, x y z each, ground lift 0), drawn `s[0]` wide: with a ground lift
   * its matrix is recomposed from the lifted ends as the legacy path does, so it matches to the bit.
   */
  seg?: readonly number[];
};

export type TreeRecord = { lng: number; lat: number };

/** What a compile learns of one tree: null skips it (no typology); else its archetype and whether it is authored. */
export type TreeEmit<T extends TreeRecord> = (tree: T, push: (key: string, item: TreeInstanceItem) => void) => { archetype: string; authored: boolean } | null;

export type Bounds = { west: number; south: number; east: number; north: number };

type Group = { key: string; count: number; matrices: Float32Array; baseZ: Float64Array; colours: Float32Array; tree: Uint32Array; seq: Uint32Array; segAt: Int32Array; segs: Float64Array };

/** A source's compiled instances: one tile (or the allotment canopy) at one canopy variant. */
export class TreeInstanceSource {
  /** Kept trees (finite position, a typology), in the tile's order. */
  readonly lng: Float64Array;
  readonly lat: Float64Array;
  readonly authored: Uint8Array;
  readonly archetype: Uint16Array;
  readonly archetypes: string[];
  readonly groups: Group[];
  /** The kept trees' extent. */
  readonly bbox: Bounds;
  /** Per kept tree: its ground lift and the ground revision it was read at (0: never). */
  readonly z0: Float64Array;
  readonly z0Rev: Float64Array;
  constructor(readonly records: readonly TreeRecord[], lng: number[], lat: number[], authored: number[], archetype: number[], archetypes: string[], groups: Group[]) {
    this.lng = Float64Array.from(lng); this.lat = Float64Array.from(lat);
    this.authored = Uint8Array.from(authored); this.archetype = Uint16Array.from(archetype); this.archetypes = archetypes;
    this.groups = groups;
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    for (let i = 0; i < lng.length; i++) { west = Math.min(west, lng[i]); east = Math.max(east, lng[i]); south = Math.min(south, lat[i]); north = Math.max(north, lat[i]); }
    this.bbox = { west, south, east, north };
    this.z0 = new Float64Array(lng.length); this.z0Rev = new Float64Array(lng.length);
  }
  get trees(): number { return this.lng.length; }
  get instances(): number { return this.groups.reduce((a, g) => a + g.count, 0); }
}

/** three.js Matrix4.compose(position, quaternion, scale) into `out` at `o` (column-major), in doubles like three. */
export function composeInto(out: Float32Array, o: number, item: TreeInstanceItem): void {
  let x = 0, y = 0, z = 0, w = 1;
  if (item.q) ({ x, y, z, w } = item.q);
  else if (item.rotation) {
    // The legacy path sets `dummy.rotation.z` after `quaternion.identity()`, whose Euler is (-0, 0, -0): three's
    // Quaternion.setFromEuler for XYZ, written out with those signed zeros so the bits (signed zeros too) match.
    const c1 = 1, s1 = -0, c2 = 1, s2 = 0, c3 = Math.cos(item.rotation / 2), s3 = Math.sin(item.rotation / 2);
    x = s1 * c2 * c3 + c1 * s2 * s3; y = c1 * s2 * c3 - s1 * c2 * s3; z = c1 * c2 * s3 + s1 * s2 * c3; w = c1 * c2 * c3 - s1 * s2 * s3;
  }
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = item.s[0], sy = item.s[1], sz = item.s[2];
  out[o] = (1 - (yy + zz)) * sx; out[o + 1] = (xy + wz) * sx; out[o + 2] = (xz - wy) * sx; out[o + 3] = 0;
  out[o + 4] = (xy - wz) * sy; out[o + 5] = (1 - (xx + zz)) * sy; out[o + 6] = (yz + wx) * sy; out[o + 7] = 0;
  out[o + 8] = (xz + wy) * sz; out[o + 9] = (yz - wx) * sz; out[o + 10] = (1 - (xx + yy)) * sz; out[o + 11] = 0;
  out[o + 12] = item.p[0]; out[o + 13] = item.p[1]; out[o + 14] = item.p[2]; out[o + 15] = 1;
}

/**
 * A segment's instance (three's path: `delta = to - from`, `length`, the midpoint, `Quaternion.setFromUnitVectors(+z,
 * delta / length)`, then compose with scale (w, w, length)), from ends `seg` lifted by `z0`.
 */
export function segmentInto(out: Float32Array, o: number, seg: ArrayLike<number>, width: number, z0: number): void {
  const fx = seg[0], fy = seg[1], fz = z0 + seg[2], tx = seg[3], ty = seg[4], tz = z0 + seg[5];
  let dx = tx - fx, dy = ty - fy, dz = tz - fz;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz), inv = 1 / length;
  dx *= inv; dy *= inv; dz *= inv;
  let r = 0 * dx + 0 * dy + 1 * dz + 1, qx: number, qy: number, qz: number;
  if (r < 1e-8) { r = 0; qx = 0; qy = -1; qz = 0; } // vFrom (0, 0, 1): |x| > |z| is false
  else { qx = 0 * dz - 1 * dy; qy = 1 * dx - 0 * dz; qz = 0 * dy - 0 * dx; }
  let l = Math.sqrt(qx * qx + qy * qy + qz * qz + r * r), q: { x: number; y: number; z: number; w: number };
  if (l === 0) q = { x: 0, y: 0, z: 0, w: 1 };
  else { l = 1 / l; q = { x: qx * l, y: qy * l, z: qz * l, w: r * l }; }
  composeInto(out, o, { p: [(fx + tx) * 0.5, (fy + ty) * 0.5, (fz + tz) * 0.5], s: [width, width, length], q, color: { r: 0, g: 0, b: 0 } });
}

/** Compile one source's trees: `emit` pushes each tree's instances (ground lift 0) as the legacy loop appends them. */
export function compileTreeSource<T extends TreeRecord>(trees: readonly T[], emit: TreeEmit<T>): TreeInstanceSource {
  const lng: number[] = [], lat: number[] = [], authored: number[] = [], archetype: number[] = [], archetypes: string[] = [], archIndex = new Map<string, number>();
  const pending = new Map<string, { items: TreeInstanceItem[]; tree: number[]; seq: number[] }>();
  let seq = 0, kept = 0;
  const push = (key: string, item: TreeInstanceItem) => {
    let g = pending.get(key);
    if (!g) pending.set(key, g = { items: [], tree: [], seq: [] });
    g.items.push(item); g.tree.push(kept); g.seq.push(seq++);
  };
  for (const tree of trees) {
    if (!Number.isFinite(tree.lng) || !Number.isFinite(tree.lat)) continue;
    const mark = seq;
    const info = emit(tree, push);
    if (!info) { if (seq !== mark) throw Error('treeInstances: a skipped tree emitted instances'); continue; }
    let a = archIndex.get(info.archetype);
    if (a === undefined) { archIndex.set(info.archetype, a = archetypes.length); archetypes.push(info.archetype); }
    lng.push(tree.lng); lat.push(tree.lat); authored.push(info.authored ? 1 : 0); archetype.push(a);
    kept++;
  }
  const groups: Group[] = [];
  for (const [key, g] of pending) {
    const n = g.items.length, matrices = new Float32Array(16 * n), baseZ = new Float64Array(n), colours = new Float32Array(3 * n), segAt = new Int32Array(n).fill(-1), segList: number[] = [];
    for (let i = 0; i < n; i++) {
      const it = g.items[i];
      composeInto(matrices, 16 * i, it);
      if (it.seg) { segAt[i] = segList.length / 7; segList.push(it.seg[0], it.seg[1], it.seg[2], it.seg[3], it.seg[4], it.seg[5], it.s[0]); }
      baseZ[i] = it.p[2];
      colours[3 * i] = it.color.r; colours[3 * i + 1] = it.color.g; colours[3 * i + 2] = it.color.b;
    }
    groups.push({ key, count: n, matrices, baseZ, colours, tree: Uint32Array.from(g.tree), seq: Uint32Array.from(g.seq), segAt, segs: Float64Array.from(segList) });
  }
  return new TreeInstanceSource(trees, lng, lat, authored, archetype, archetypes, groups);
}

export type AssembledGroup = { key: string; count: number; matrices: Float32Array; colours: Float32Array };
export type Assembled = { groups: AssembledGroup[]; trees: number; authoredTrees: number; archetypes: string[]; stats: { sources: number; compiled: number; whole: number; z0Reads: number } };

/**
 * The tree-instance cache the layer holds: compiled sources by tree array (a tile's `data.trees`, the allotment
 * canopy) and variant, dropped with their array (WeakMap).
 */
export class TreeInstanceCache<T extends TreeRecord> {
  private readonly compiled = new WeakMap<readonly T[], Map<string, TreeInstanceSource>>();
  /** Sources compiled so far (diagnostics). */
  compiles = 0;

  source(trees: readonly T[], variant: string, emit: TreeEmit<T>): { source: TreeInstanceSource; fresh: boolean } {
    let byVariant = this.compiled.get(trees);
    if (!byVariant) this.compiled.set(trees, byVariant = new Map());
    const hit = byVariant.get(variant);
    if (hit) return { source: hit, fresh: false };
    const source = compileTreeSource(trees, emit);
    byVariant.set(variant, source);
    this.compiles++;
    return { source, fresh: true };
  }

  /**
   * The legacy rebuild's instances: every source (in order) at `variant`, its trees inside `b` (inclusive edges, as
   * the legacy test), the ground lift `z0(lng, lat)` read at most once per tree per `groundRev`. `extra` groups (the
   * rose bushes, bounds-dependent) follow, as the legacy loop appended them after the trees.
   */
  assemble(sources: readonly (readonly T[])[], variant: string, emit: TreeEmit<T>, b: Bounds, z0: ((lng: number, lat: number) => number) | null, groundRev: number, extra: readonly AssembledGroup[] = []): Assembled {
    const stats = { sources: sources.length, compiled: 0, whole: 0, z0Reads: 0 };
    const picked: { src: TreeInstanceSource; inB: Uint8Array | null }[] = [];
    let trees = 0, authoredTrees = 0;
    const archetypes = new Set<string>();
    const totals = new Map<string, number>(), order: string[] = [];
    // A z0 revision of 0 would read as "never read"; revisions start at 1.
    const rev = groundRev + 1;
    for (const list of sources) {
      const { source: src, fresh } = this.source(list, variant, emit);
      if (fresh) stats.compiled++;
      const bb = src.bbox, whole = bb.west >= b.west && bb.east <= b.east && bb.south >= b.south && bb.north <= b.north;
      let inB: Uint8Array | null = null;
      if (!whole) {
        inB = new Uint8Array(src.trees);
        for (let i = 0; i < src.trees; i++) { const x = src.lng[i], y = src.lat[i]; inB[i] = x < b.west || x > b.east || y < b.south || y > b.north ? 0 : 1; }
      } else stats.whole++;
      let any = false;
      for (let i = 0; i < src.trees; i++) {
        if (inB && !inB[i]) continue;
        any = true; trees++; if (src.authored[i]) authoredTrees++; archetypes.add(src.archetypes[src.archetype[i]]);
        if (z0) {
          if (src.z0Rev[i] !== rev) { src.z0[i] = z0(src.lng[i], src.lat[i]); src.z0Rev[i] = rev; stats.z0Reads++; }
        } else { src.z0[i] = 0; src.z0Rev[i] = 0; }
      }
      if (!any) continue;
      picked.push({ src, inB });
      // Group order: the legacy Map's insertion order, the first in-bounds instance of each group in emission order.
      const firsts: { key: string; seq: number; count: number }[] = [];
      for (const g of src.groups) {
        let first = -1, count = 0;
        for (let k = 0; k < g.count; k++) if (!inB || inB[g.tree[k]]) { if (first < 0) first = g.seq[k]; count++; }
        if (count) firsts.push({ key: g.key, seq: first, count });
      }
      firsts.sort((a, c) => a.seq - c.seq);
      for (const f of firsts) {
        if (!totals.has(f.key)) { totals.set(f.key, 0); order.push(f.key); }
        totals.set(f.key, totals.get(f.key)! + f.count);
      }
    }
    for (const e of extra) if (e.count && !totals.has(e.key)) { totals.set(e.key, 0); order.push(e.key); }
    for (const e of extra) if (e.count) totals.set(e.key, totals.get(e.key)! + e.count);
    const out = new Map<string, AssembledGroup & { at: number }>();
    for (const key of order) { const n = totals.get(key)!; out.set(key, { key, count: n, matrices: new Float32Array(16 * n), colours: new Float32Array(3 * n), at: 0 }); }
    for (const { src, inB } of picked) for (const g of src.groups) {
      const o = out.get(g.key);
      if (!o) continue;
      if (!inB) {
        o.matrices.set(g.matrices, 16 * o.at); o.colours.set(g.colours, 3 * o.at);
        for (let k = 0; k < g.count; k++) lift(o.matrices, 16 * (o.at + k), g, k, src.z0[g.tree[k]]);
        o.at += g.count;
        continue;
      }
      for (let k = 0; k < g.count; k++) {
        if (!inB[g.tree[k]]) continue;
        o.matrices.set(g.matrices.subarray(16 * k, 16 * k + 16), 16 * o.at);
        lift(o.matrices, 16 * o.at, g, k, src.z0[g.tree[k]]);
        o.colours.set(g.colours.subarray(3 * k, 3 * k + 3), 3 * o.at);
        o.at++;
      }
    }
    for (const e of extra) {
      const o = out.get(e.key);
      if (!o || !e.count) continue;
      o.matrices.set(e.matrices.subarray(0, 16 * e.count), 16 * o.at); o.colours.set(e.colours.subarray(0, 3 * e.count), 3 * o.at); o.at += e.count;
    }
    return { groups: [...out.values()].map(({ key, count, matrices, colours }) => ({ key, count, matrices, colours })), trees, authoredTrees, archetypes: [...archetypes], stats };
  }
}

/** Instance `k` of `g`, written at `o`, lifted by `z0`: the translation's z, or a segment recomposed from its ends. */
function lift(out: Float32Array, o: number, g: Group, k: number, z0: number): void {
  const at = g.segAt[k];
  if (at >= 0 && z0 !== 0) segmentInto(out, o, g.segs.subarray(7 * at, 7 * at + 6), g.segs[7 * at + 6], z0);
  else out[o + 14] = g.baseZ[k] + z0;
}

/** Items (the rose bushes) as one assembled group, composed like the compiled sources. */
export function groupOf(key: string, items: readonly TreeInstanceItem[]): AssembledGroup {
  const n = items.length, matrices = new Float32Array(16 * n), colours = new Float32Array(3 * n);
  items.forEach((it, i) => { composeInto(matrices, 16 * i, it); colours[3 * i] = it.color.r; colours[3 * i + 1] = it.color.g; colours[3 * i + 2] = it.color.b; });
  return { key, count: n, matrices, colours };
}

/**
 * `?treesIncremental=1` (or `window.__canalRecallTreesIncremental = true`): from the air the inventory trees assemble
 * their instances from per-tile compiled arrays ('air'). At street level the legacy rebuild stays: it walks only the
 * few hundred trees in the view, while a first compile walks a whole tile (measured: 549 trees in view of 12 tiles,
 * legacy 14 ms, first compile 157 ms). `?treesIncremental=all` assembles everywhere (the parity checks). `=0`: the
 * legacy rebuild, unchanged. Absent: the device default, TREES_INCREMENTAL_DESKTOP_DEFAULT on a fine pointer and
 * TREES_INCREMENTAL_TOUCH_DEFAULT on a coarse one (integrator 2026-11-08, #249: with the ring footprint
 * (world/worldRing.ts) both aerial gates met in all four runs, median rebuild from the air 46-50 -> 12-24 ms; the
 * iPhone pan is not measured). Tolerates a non-browser global (the structure gate has no `location`).
 */
export type TreesIncremental = 'off' | 'air' | 'all';
export const TREES_INCREMENTAL_DESKTOP_DEFAULT: TreesIncremental = 'air';
export const TREES_INCREMENTAL_TOUCH_DEFAULT: TreesIncremental = 'off';
export function treesIncrementalFlag(search?: string, w: any = globalThis): TreesIncremental {
  try {
    const g = w as { __canalRecallTreesIncremental?: boolean | string; location?: { search?: string }; matchMedia?: (q: string) => { matches: boolean } };
    let v: string | null = null;
    try { v = new URLSearchParams(search ?? g.location?.search ?? '').get('treesIncremental'); } catch { /* no URLSearchParams */ }
    if (v === null && g.__canalRecallTreesIncremental !== undefined) v = String(g.__canalRecallTreesIncremental);
    if (v === null) {
      let touch = false;
      try { touch = !!g.matchMedia?.('(pointer: coarse)')?.matches; } catch { /* no matchMedia */ }
      return touch ? TREES_INCREMENTAL_TOUCH_DEFAULT : TREES_INCREMENTAL_DESKTOP_DEFAULT;
    }
    if (v === 'all') return 'all';
    return v === '1' || v === 'on' || v === 'true' || v === 'air' ? 'air' : 'off';
  } catch { return 'off'; }
}
