/**
 * Complementary dissolve for the shell → detail swap (lane R1-A, issue #223; shader side in look/cityLook.ts
 * `CITY_SWAP`). While a detail chunk dissolves in over the coarse shells (or out, back to them), the shell's
 * buildings it covers carry a swap slot in a per-vertex byte (`swapSlot`, 0 = none); the slot's `under` value is
 * the detail chunk's own dissolve coverage, and the shell discards exactly where the detail draws. No pixel is drawn
 * twice, so the coplanar walls never depth-fight under the screen-locked dither, and the shell's lid and windows
 * dissolve out as the detail's roof and windows dissolve in (no one-frame pop when the fade ends).
 *
 * Pure bookkeeping (no three.js): the buildings layer owns the meshes and calls `paintSlot` / `clearSlot` on their
 * `swapSlot` arrays. `?swapComplement=0` (or `window.__canalRecallSwapComplement = false`) keeps the old overlap.
 */
export const SWAP_SLOT_COUNT = 16;

export function swapComplementEnabled(search?: string): boolean {
  try {
    const g = globalThis as { __canalRecallSwapComplement?: boolean; location?: { search?: string } };
    return g.__canalRecallSwapComplement !== false && new URLSearchParams(search ?? g.location?.search ?? '').get('swapComplement') !== '0';
  } catch { return true; }
}

type Ranges = ReadonlyMap<string, { start: number; count: number }>;

/** Which buildings each slot covers and the coverage the shell yields there (`under`, the shader's uniform array). */
export class SwapSlots {
  readonly under: Float32Array;
  private readonly ids: (ReadonlySet<string> | null)[];
  constructor(readonly count = SWAP_SLOT_COUNT) {
    this.under = new Float32Array(count);
    this.ids = new Array(count).fill(null);
  }
  /** A free slot for `ids` starting at `value`, or -1 when every slot is taken (that swap overlaps, as before). */
  claim(ids: ReadonlySet<string>, value: number): number {
    const slot = this.ids.indexOf(null);
    if (slot < 0 || !ids.size) return -1;
    this.ids[slot] = ids;
    this.under[slot] = value;
    return slot;
  }
  set(slot: number, value: number): void { if (slot >= 0 && this.ids[slot]) this.under[slot] = value; }
  /** Free `slot`; returns the ids it covered (to clear from the shells), null when it was free. */
  release(slot: number): ReadonlySet<string> | null {
    const ids = slot >= 0 ? this.ids[slot] : null;
    if (!ids) return null;
    this.ids[slot] = null;
    this.under[slot] = 0;
    return ids;
  }
  /** Every slot in use, for a shell that installs while swaps are under way. */
  *active(): Generator<[number, ReadonlySet<string>]> {
    for (let s = 0; s < this.count; s++) { const ids = this.ids[s]; if (ids) yield [s, ids]; }
  }
  get used(): number { return this.ids.filter(Boolean).length; }
  clear(): void { this.ids.fill(null); this.under.fill(0); }
}

/** Mark `ids`' vertices in a shell's `swapSlot` array with `slot` (stored as slot + 1). True when any changed. */
export function paintSlot(array: Uint8Array, ranges: Ranges, ids: Iterable<string>, slot: number): boolean {
  let touched = false;
  for (const id of ids) {
    const r = ranges.get(id);
    if (!r) continue;
    array.fill(slot + 1, r.start, r.start + r.count);
    touched = true;
  }
  return touched;
}

/** Clear `slot` from `ids`' vertices, leaving any a later swap has re-marked. True when any changed. */
export function clearSlot(array: Uint8Array, ranges: Ranges, ids: Iterable<string>, slot: number): boolean {
  let touched = false;
  for (const id of ids) {
    const r = ranges.get(id);
    if (!r || array[r.start] !== slot + 1) continue;
    array.fill(0, r.start, r.start + r.count);
    touched = true;
  }
  return touched;
}
