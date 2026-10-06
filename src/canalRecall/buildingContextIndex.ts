/** Spatial lookup for neighboring footprints; preserves resident source order. */
export type FootprintBox = readonly [number, number, number, number];
const CELL_LNG = .001, CELL_LAT = .0006;
const PAD = .00000005;
const overlaps = (a: FootprintBox, b: FootprintBox) =>
  a[2] >= b[0] - PAD && a[0] <= b[2] + PAD && a[3] >= b[1] - PAD && a[1] <= b[3] + PAD;

export class BuildingContextIndex<T> {
  private readonly cells = new Map<string, T[]>();
  private readonly order = new Map<T, number>();
  constructor(features: readonly T[], private readonly bounds: (feature: T) => FootprintBox) {
    features.forEach((feature, index) => {
      this.order.set(feature, index);
      for (const key of this.keys(bounds(feature))) {
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(feature); else this.cells.set(key, [feature]);
      }
    });
  }
  private *keys(box: FootprintBox): Generator<string> {
    if (!box.every(Number.isFinite)) return;
    for (let x = Math.floor((box[0] - PAD) / CELL_LNG); x <= Math.floor((box[2] + PAD) / CELL_LNG); x++)
      for (let y = Math.floor((box[1] - PAD) / CELL_LAT); y <= Math.floor((box[3] + PAD) / CELL_LAT); y++) yield `${x}/${y}`;
  }
  neighbors(source: readonly T[], excluded: (feature: T) => boolean): T[] {
    if (!source.length) return [];
    const candidates = new Set<T>(), rejected = new Set<T>();
    for (const own of source) {
      const box = this.bounds(own);
      for (const key of this.keys(box)) for (const feature of this.cells.get(key) ?? []) {
        if (candidates.has(feature) || rejected.has(feature)) continue;
        if (excluded(feature)) { rejected.add(feature); continue; }
        if (overlaps(this.bounds(feature), box)) candidates.add(feature);
      }
    }
    return [...candidates].sort((a, b) => this.order.get(a)! - this.order.get(b)!);
  }
}
