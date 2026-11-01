/** Spatial lookup for neighboring footprints; preserves resident source order. */
export type FootprintBox = readonly [number, number, number, number];
const CELL_LNG = .001, CELL_LAT = .0006;
const PAD = .00000005;
const overlaps = (a: FootprintBox, b: FootprintBox) =>
  a[2] >= b[0] - PAD && a[0] <= b[2] + PAD && a[3] >= b[1] - PAD && a[1] <= b[3] + PAD;
// A grid cell as one number (|x|, |y| < 2^20 cells, ±1000° of longitude): no key strings while riding.
const OFFSET = 2 ** 20, cellKey = (x: number, y: number) => (x + OFFSET) * 2 ** 21 + (y + OFFSET);

/**
 * Features are held by their position in the resident list (the last one, should a feature repeat), with the box read
 * once at build: `setFeatures` asks for every group's neighbours on a tile flush (#129, 4x profile: the string cell keys,
 * their generator and the per-candidate box lookups were most of `neighbors`). Same cells, same test, same order.
 */
export class BuildingContextIndex<T> {
  private readonly cells = new Map<number, number[]>();
  private readonly features: T[] = [];
  private readonly boxes: FootprintBox[] = [];
  /** Per feature slot: the stamp of the query that last met it, and whether it was a candidate (1) or rejected (2). */
  private seenAt = new Uint32Array(0);
  private seenAs = new Uint8Array(0);
  private stamp = 0;
  constructor(features: readonly T[], private readonly bounds: (feature: T) => FootprintBox) {
    const last = new Map<T, number>();
    features.forEach((feature, index) => last.set(feature, index));
    features.forEach((feature, index) => {
      if (last.get(feature) !== index) return;
      const box = bounds(feature);
      this.features[index] = feature; this.boxes[index] = box;
      this.eachCell(box, key => {
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(index); else this.cells.set(key, [index]);
      });
    });
    this.seenAt = new Uint32Array(features.length);
    this.seenAs = new Uint8Array(features.length);
  }
  private eachCell(box: FootprintBox, visit: (key: number) => void): void {
    if (!(Number.isFinite(box[0]) && Number.isFinite(box[1]) && Number.isFinite(box[2]) && Number.isFinite(box[3]))) return;
    const xb = Math.floor((box[2] + PAD) / CELL_LNG), yb = Math.floor((box[3] + PAD) / CELL_LAT), y0 = Math.floor((box[1] - PAD) / CELL_LAT);
    for (let x = Math.floor((box[0] - PAD) / CELL_LNG); x <= xb; x++)
      for (let y = y0; y <= yb; y++) visit(cellKey(x, y));
  }
  neighbors(source: readonly T[], excluded: (feature: T) => boolean): T[] {
    if (!source.length) return [];
    if (++this.stamp === 0xffffffff) { this.seenAt.fill(0); this.stamp = 1; }
    const stamp = this.stamp, seenAt = this.seenAt, seenAs = this.seenAs, found: number[] = [];
    for (const own of source) {
      const box = this.bounds(own);
      this.eachCell(box, key => {
        const bucket = this.cells.get(key);
        if (!bucket) return;
        for (const i of bucket) {
          if (seenAt[i] === stamp && seenAs[i]) continue;
          const feature = this.features[i];
          if (excluded(feature)) { seenAt[i] = stamp; seenAs[i] = 2; continue; }
          if (overlaps(this.boxes[i], box)) { seenAt[i] = stamp; seenAs[i] = 1; found.push(i); }
        }
      });
    }
    found.sort((a, b) => a - b);
    return found.map(i => this.features[i]);
  }
}
