// The legacy landmark layer's one scene (default configuration, no shared frame).
//
// Until 2026-10-14 the legacy layer gave every placed model its own
// THREE.Scene (with its own copies of the three lights) and drew each with its
// own `renderer.render`, baking the model's Mercator transform into the
// camera: projection = MapLibre's matrix × transform. That was 97 renders per
// frame in the aerial hold, each re-running three's light setup, render-list
// build and sort and a `resetState` (0.30 ms chase, 0.73 ms aerial).
//
// Now every model is a holder in one scene whose world is metres about a fixed
// anchor, laid out like a glTF scene (x east, y up, z south), so models keep
// the y-up convention the highlight passes and the recipe look were written
// for. The camera's projection is MapLibre's matrix × `mercatorFromWorld`, and
// a holder's matrix is `worldFromMercator × transform`: the product a vertex
// sees is the old projection × transform, computed in doubles on the CPU.
// The anchor is re-based when the view wanders far from it, so world
// coordinates stay small enough for float32 on the GPU.
//
// What can differ from one render per model, and why it is kept the same:
//   - draw order: three sorts the one opaque list by material and depth across
//     all models; `bySequence` sorts by model first (the old render order),
//     then three's own painter order inside a model, exactly as before;
//   - lights: one set, aimed with the same `enuDirectionInLocal` the old
//     per-model copies used (through the anchor frame instead of each model);
//   - recipe look: its `enuFromWorld` is the anchor frame's, the same rotation
//     the old per-model value applied to normals.
// Transparent draws of different models now all follow every model's opaque
// draws (before, model n's transparent draws preceded model n+1's opaque ones).

/** Column-major 4x4. */
export type Mat4 = ArrayLike<number>;

/** Re-base when the view centre is this far from the anchor (metres). */
export const LEGACY_FRAME_REBASE_M = 1500;

/**
 * Mercator ← world for an anchor at Mercator (`x`, `y`, 0) with `units` Mercator units per metre.
 * World axes: x east, y up, z south (Mercator +y runs south), metres.
 */
export function mercatorFromAnchorWorld(x: number, y: number, units: number): number[] {
  return [
    units, 0, 0, 0,
    0, 0, units, 0,
    0, units, 0, 0,
    x, y, 0, 1,
  ];
}

/** World ← Mercator, the exact inverse of `mercatorFromAnchorWorld`. */
export function anchorWorldFromMercator(x: number, y: number, units: number): number[] {
  const k = 1 / units;
  return [
    k, 0, 0, 0,
    0, 0, k, 0,
    0, k, 0, 0,
    -x * k, 0, -y * k, 1,
  ];
}

/** a × b, column-major, in doubles. */
export function multiplyMat4(a: Mat4, b: Mat4, out: number[] = new Array(16)): number[] {
  const r = new Array(16);
  for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
    r[c * 4 + row] = s;
  }
  for (let i = 0; i < 16; i++) out[i] = r[i];
  return out;
}

/** Whether the view centre (Mercator) has wandered past `limitM` metres from the anchor. */
export function needsRebase(anchor: readonly [number, number] | null, centre: readonly [number, number], units: number, limitM = LEGACY_FRAME_REBASE_M): boolean {
  if (!anchor) return true;
  return Math.hypot(centre[0] - anchor[0], centre[1] - anchor[1]) / units > limitM;
}

/** The property a holder carries: its model's place in the old one-render-per-model order. */
export const LANDMARK_SEQUENCE = '__landmarkSequence';

type Node = { parent?: Node | null; [key: string]: any };
type RenderItem = { object: Node; groupOrder: number; renderOrder: number; material: { id: number }; materialVariant?: number; z: number; id: number };

/** The sequence of the holder above `object` (cached on the object: a mesh never changes model). */
export function sequenceOf(object: Node): number {
  const cached = object[LANDMARK_SEQUENCE];
  if (cached !== undefined) return cached;
  let seq = 0;
  for (let node: Node | null | undefined = object.parent; node; node = node.parent) {
    if (node[LANDMARK_SEQUENCE] !== undefined) { seq = node[LANDMARK_SEQUENCE]; break; }
  }
  object[LANDMARK_SEQUENCE] = seq;
  return seq;
}

/** three's `painterSortStable` (r185), the opaque order inside one model. */
export function painterSortStable(a: RenderItem, b: RenderItem): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  if ((a.materialVariant ?? 0) !== (b.materialVariant ?? 0)) return (a.materialVariant ?? 0) - (b.materialVariant ?? 0);
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}

/** three's `reversePainterSortStable` (r185), the transparent order inside one model. */
export function reversePainterSortStable(a: RenderItem, b: RenderItem): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (a.z !== b.z) return b.z - a.z;
  return a.id - b.id;
}

/** Model order first (the old one render per model), then `within`. */
export function bySequence(within: (a: RenderItem, b: RenderItem) => number): (a: RenderItem, b: RenderItem) => number {
  return (a, b) => (sequenceOf(a.object) - sequenceOf(b.object)) || within(a, b);
}
