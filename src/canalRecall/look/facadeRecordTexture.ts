/**
 * The city-wide facade-record texture (F1 S4, #380; docs/plans/facade-f1-design-20261112.md §1.4): one RGBA32UI
 * texture, 256 texels wide (64 records a row, 4 texels a record), `rows` high (4096 = 16.8 MB, allocated once), and a
 * row allocator: a resident cell (or runtime chunk) takes ceil(records / 64) consecutive rows and frees them when it
 * leaves. A mesh draws its records at `recBase` (its first row), set per mesh before it draws; one program for all.
 * Only the rows a cell takes are uploaded (Texture.addUpdateRange), not the whole texture.
 */
import { FACADE_RECORD_BYTES, FACADE_RECORDS_PER_ROW } from './facadeRecord.ts';
import type { FacadeRecordSet } from '../world/facadeStreams.ts';

export const FACADE_TEXTURE_WIDTH = FACADE_RECORDS_PER_ROW * 4;
export const FACADE_TEXTURE_ROWS = 4096;
const ROW_BYTES = FACADE_RECORDS_PER_ROW * FACADE_RECORD_BYTES;

/** First-fit allocation of `need` consecutive rows in a free-row map; -1 when none fits. */
export function firstFitRows(used: Uint8Array, need: number): number {
  let run = 0;
  for (let r = 0; r < used.length; r++) {
    run = used[r] ? 0 : run + 1;
    if (run === need) return r - need + 1;
  }
  return -1;
}

export class FacadeRecordTexture {
  readonly texture: any;
  private readonly bytes: Uint8Array;
  private readonly used: Uint8Array;
  private readonly owners = new Map<string, { base: number; rows: number }>();
  constructor(THREE: any, readonly rows = FACADE_TEXTURE_ROWS) {
    const data = new Uint32Array(FACADE_TEXTURE_WIDTH * rows * 4);
    this.bytes = new Uint8Array(data.buffer);
    this.used = new Uint8Array(rows);
    const t = new THREE.DataTexture(data, FACADE_TEXTURE_WIDTH, rows, THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
    t.internalFormat = 'RGBA32UI';
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.needsUpdate = true;
    this.texture = t;
  }
  /** Rows in use (the allocator's load, for the HUD and tests). */
  get rowsUsed(): number { let n = 0; for (const u of this.used) n += u; return n; }
  /** The first row of `key`'s records, or undefined when it holds none. */
  base(key: string): number | undefined { return this.owners.get(key)?.base; }
  /**
   * Upload a cell's records; returns its first row (the meshes' `recBase`), or null when the texture is full (the caller
   * then draws the cell's legacy shell). Re-allocating a key frees its old rows first.
   */
  alloc(key: string, set: FacadeRecordSet): number | null {
    this.free(key);
    const need = Math.max(1, Math.ceil(set.count / FACADE_RECORDS_PER_ROW));
    const base = firstFitRows(this.used, need);
    if (base < 0) return null;
    this.used.fill(1, base, base + need);
    this.owners.set(key, { base, rows: need });
    this.bytes.fill(0, base * ROW_BYTES, (base + need) * ROW_BYTES);
    this.bytes.set(set.bytes.subarray(0, set.count * FACADE_RECORD_BYTES), base * ROW_BYTES);
    // three uploads each range as one texel row (WebGLTextures: height 1, start/count in components), so one range a row.
    const rowComponents = FACADE_TEXTURE_WIDTH * 4;
    for (let r = base; r < base + need; r++) this.texture.addUpdateRange?.(r * rowComponents, rowComponents);
    this.texture.needsUpdate = true;
    return base;
  }
  free(key: string): void {
    const o = this.owners.get(key);
    if (!o) return;
    this.used.fill(0, o.base, o.base + o.rows);
    this.owners.delete(key);
  }
  dispose(): void { this.texture.dispose?.(); this.owners.clear(); this.used.fill(0); }
}
