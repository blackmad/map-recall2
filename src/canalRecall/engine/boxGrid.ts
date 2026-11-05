// Point → items whose box holds it, through a lng/lat grid (#129: the rider-cover query scanned every resident
// building, ~36,000, eight times a second). Each item sits in every cell its box touches, in the list's order, and
// a point is looked up in its own cell only: floor is monotonic, so a box that holds the point always touches the
// point's cell. The answer is the linear scan's, in the same order.

export type Box = readonly [number, number, number, number];

const CELL_LNG = 0.0006, CELL_LAT = 0.0004; // ~40 × 45 m in Amsterdam
const key = (x: number, y: number) => x * 1_000_003 + y;

export class BoxGrid<T> {
  private readonly cells = new Map<number, T[]>();
  /** `deferred`: leave the grid empty; the caller drains `insertSteps()` (IdleBoxGrid: a slice per idle period). */
  constructor(private readonly items: readonly T[], private readonly boxOf: (item: T) => Box | null, deferred = false) {
    if (!deferred) { const steps = this.insertSteps(Infinity); while (!steps.next().done) { /* one task */ } }
  }

  /** Insert the items, yielding after every `step` of them. Same cells, same order as the constructor. Runs once. */
  *insertSteps(step: number): Generator<void, void, void> {
    const items = this.items, boxOf = this.boxOf;
    let n = 0;
    for (const item of items) {
      if (++n % step === 0) yield;
      const b = boxOf(item);
      if (!b) continue;
      const x0 = Math.floor(b[0] / CELL_LNG), x1 = Math.floor(b[2] / CELL_LNG), y0 = Math.floor(b[1] / CELL_LAT), y1 = Math.floor(b[3] / CELL_LAT);
      // A degenerate or enormous box (bad data) goes in every cell it spans; past ~1 km it would be thousands.
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) { this.wide.push(item); continue; }
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const k = key(x, y), l = this.cells.get(k);
        if (l) l.push(item); else this.cells.set(k, [item]);
      }
    }
  }
  /** Boxes too big to bucket: tested at every lookup, merged back in list order. */
  private readonly wide: T[] = [];
  private order: Map<T, number> | null = null;

  /** Items whose box holds (lng, lat), in the list's order. */
  at(lng: number, lat: number, items: readonly T[]): T[] {
    const hit = (t: T) => { const b = this.boxOf(t); return !!b && lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]; };
    const out = (this.cells.get(key(Math.floor(lng / CELL_LNG), Math.floor(lat / CELL_LAT))) ?? []).filter(hit);
    if (!this.wide.length) return out;
    const extra = this.wide.filter(hit);
    if (!extra.length) return out;
    const order = this.order ??= new Map(items.map((t, i) => [t, i] as const));
    return [...out, ...extra].sort((a, b) => order.get(a)! - order.get(b)!);
  }
}
