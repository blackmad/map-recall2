/**
 * Skip hidden buildings in the baked coarse cells (lane cell-hidden-skip, 2026-11-27; `?cellSkip=0` off).
 *
 * A baked cell (engine/bakedCoarse.ts) is one mesh and one draw. A building the detail chunks replace (or a landmark,
 * or a boat) keeps its triangles in the cell; its `hidden` byte is set to HIDDEN.hide and the vertex shader moves every
 * vertex of it out of the clip volume (look/cityLook.ts VERTEX_HIDE). Under the rider 44–56 % of a cell's vertices
 * were hidden that way and still submitted every frame: 250–380 k triangles a frame (docs/perf/desktop-power-20261127.md,
 * "Triangles and draws by layer").
 *
 * Here the cell's index is kept on the CPU as a permutation of its building runs (world/bakedCellArrays.ts indexRuns):
 * the drawn runs first, in their original order, then the hidden runs. The draw range ends where the drawn runs end, so
 * a hidden building's triangles are no longer submitted. The drawn triangles keep their relative order, so the depth
 * test resolves exact ties as before: the frame is the same picture, pixel for pixel, as drawing the hidden triangles
 * and collapsing them.
 *
 * The state is read from the `hidden` attribute itself, just before the cell draws (`mesh.onBeforeRender`): whatever the
 * shader would collapse on that draw is skipped, and nothing else. A swap's complementary dissolve leaves the coarse
 * copy `drawn` (its `swapSlot` yields) until the dissolve ends, so the copy is drawn through the fade and skipped
 * after, with no extra bookkeeping. A change rewrites the index from the first changed run onwards and uploads only
 * the drawn part of that tail.
 */
import { HIDDEN } from '../look/highlight.js';

export type IndexArray = Uint16Array | Uint32Array;

/**
 * `?cellSkip=0` (or `window.__canalRecallCellSkip = false`): every triangle of a baked cell is submitted, as before (the
 * index is released after upload, no draw range).
 */
export function cellSkipEnabled(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): boolean {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('cellSkip'); } catch { /* no location */ }
  if (v === null && w.__canalRecallCellSkip !== undefined) v = String(w.__canalRecallCellSkip);
  return !(v === '0' || v === 'off' || v === 'false');
}

// One scratch per index type, shared by every cell (a sync is synchronous; it never outlives the call).
let scratch16 = new Uint16Array(0), scratch32 = new Uint32Array(0);
function scratchFor(index: IndexArray, length: number): IndexArray {
  if (index instanceof Uint16Array) { if (scratch16.length < length) scratch16 = new Uint16Array(length); return scratch16; }
  if (scratch32.length < length) scratch32 = new Uint32Array(length);
  return scratch32;
}

/** What a sync changed: rewrite [from, to) of the index on the GPU, draw [0, drawCount). */
export type SkipChange = { from: number; to: number; drawCount: number };

export class HiddenRunSkip {
  /** Indices drawn: the drawn runs, from 0. */
  drawCount: number;
  /** Indices skipped (hidden runs). */
  get skipped(): number { return this.index.length - this.drawCount; }
  private readonly start: Uint32Array;
  private readonly count: Uint32Array;
  private readonly range: Uint32Array;
  /** Where run r sits in `index` now. */
  private readonly pos: Uint32Array;
  /** Whether run r is skipped now. */
  private readonly off: Uint8Array;
  private readonly next: Uint8Array;
  private readonly rangeOff: Uint8Array;

  /**
   * `index`: the cell's index, permuted in place from now on (the GPU buffer must be uploaded from it). `runs`: indexRuns
   * triples in index order, covering it. `rangeCount`: the cell's building ranges.
   */
  constructor(readonly index: IndexArray, runs: Uint32Array, rangeCount: number) {
    const n = runs.length / 3;
    this.start = new Uint32Array(n); this.count = new Uint32Array(n); this.range = new Uint32Array(n);
    let at = 0;
    for (let r = 0; r < n; r++) {
      this.start[r] = runs[r * 3]; this.count[r] = runs[r * 3 + 1]; this.range[r] = runs[r * 3 + 2];
      if (this.start[r] !== at) throw Error(`cellSkip: run ${r} starts at ${this.start[r]}, expected ${at}`);
      at += this.count[r];
    }
    if (at !== index.length) throw Error(`cellSkip: runs cover ${at} of ${index.length} indices`);
    this.pos = this.start.slice();
    this.off = new Uint8Array(n); this.next = new Uint8Array(n); this.rangeOff = new Uint8Array(rangeCount);
    this.drawCount = index.length;
  }

  /**
   * Re-read the hidden state: `hiddenBytes[rangeStarts[i]]` is range i's `hidden` byte (a range is filled as one).
   * Returns null when no run changed.
   */
  syncHidden(hiddenBytes: ArrayLike<number>, rangeStarts: ArrayLike<number>): SkipChange | null {
    const ro = this.rangeOff;
    for (let i = 0; i < ro.length; i++) ro[i] = hiddenBytes[rangeStarts[i]] === HIDDEN.hide ? 1 : 0;
    return this.sync(ro);
  }

  /** `rangeOff[i]`: range i is skipped. Returns null when no run changed. */
  sync(rangeOff: ArrayLike<number>): SkipChange | null {
    const n = this.off.length, next = this.next, off = this.off, count = this.count, pos = this.pos;
    let first = -1;
    for (let r = 0; r < n; r++) { const g = this.range[r]; next[r] = g < rangeOff.length && rangeOff[g] ? 1 : 0; if (first < 0 && next[r] !== off[r]) first = r; }
    if (first < 0) return null;
    // The drawn runs before `first` are unchanged and sit at the front in order: they keep their places.
    let from = 0;
    for (let r = 0; r < first; r++) if (!off[r]) from += count[r];
    const total = this.index.length, tail = total - from, out = scratchFor(this.index, tail), index = this.index;
    let w = 0;
    // Copy run r (from its current place) to out[w..]; consecutive runs that sit side by side are copied as one.
    let cFrom = -1, cLen = 0;
    const flush = () => { if (cLen) { out.set(index.subarray(cFrom, cFrom + cLen), w - cLen); cLen = 0; } };
    const take = (r: number) => {
      const p = pos[r], c = count[r];
      if (cLen && cFrom + cLen === p) cLen += c; else { flush(); cFrom = p; cLen = c; }
      pos[r] = from + w; w += c;
    };
    for (let r = first; r < n; r++) if (!next[r]) take(r);
    flush();
    const drawCount = from + w;
    for (let r = 0; r < n; r++) if (next[r]) take(r);
    flush();
    index.set(out.subarray(0, tail), from);
    off.set(next);
    this.drawCount = drawCount;
    return { from, to: Math.max(from, drawCount), drawCount };
  }
}
