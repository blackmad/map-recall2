/**
 * The facade atlas's level 0 leaves the GPU from the air (lane R4-J #254, `?atlasAerial=1`, default off).
 *
 * The facade colour (RGBA8) and tint-mask (R8) arrays are immutable `texStorage3D` storage with a full mip chain
 * (threeBuildingsBrowser.ts lookTexturesOf): 256 × 256 × 208 layers on desktop, 86.7 MB decoded, resident at every pose.
 * From 3 km up nothing samples level 0. `TEXTURE_BASE_LEVEL` frees nothing, so "dropping level 0" is a second pair:
 * 128 × 128 with the full pair's levels 1..n as its 0..n−1, filled on the GPU (framebuffer layer copies, no CPU
 * bytes), bound in place of the full pair, which is then deleted. Sampling it with the same UVs reads exactly what the
 * full pair would at every level ≥ 1: the hardware level is computed in the bound texture's texels, so it is one lower
 * on a texture half the size and lands on the same data. The facade tier (roofTier.ts) measures texels per pixel with
 * `textureSize(cells, 0)`, so its band is halved while the half pair is bound (threeBuildingsBrowser.ts cellTierValue).
 *
 * The trigger is facade density, not `isAerialView` (the user's S2 Da Costakade pose is aerial by that predicate):
 * `facadeLodFloor` is a guaranteed lower bound on the finest mip any atlas sample can ask for this frame: the nearest
 * facade is at least (eye height − the tallest building) away, every atlas mapping spends at least
 * cellPx / ATLAS_CELL_M_MAX texels per metre, and foreshortening and anisotropy only raise the level. The half pair is
 * bound only while that floor (and its value a lead time ahead at the camera's current descent) stays ≥ DROP_LOD; the
 * full pair is rebuilt (level 0 by layer bands from the CPU copy kept in Cache Storage, levels 1.. copied back on the
 * GPU) when it falls under RESTORE_LOD, sliced at SLICE_MS a frame, and bound before the floor reaches 1.
 *
 * Pure parts (the floor, the trigger with its hysteresis, the slice runner, the band plan) are tested in
 * atlasAerial.test.ts; `AtlasAerialSwitch` is the GL side.
 */

export const ATLAS_AERIAL_PARAM = 'atlasAerial';
/** Off until the integrator flips it on measured pans (lane R4-J). */
export const ATLAS_AERIAL_DEFAULT = false;

/** `?atlasAerial=1|0` (or `window.__canalRecallAtlasAerial = true | false`); unasked ATLAS_AERIAL_DEFAULT. */
export function atlasAerialEnabled(search?: string): boolean {
  const g = globalThis as { location?: { search?: string }; __canalRecallAtlasAerial?: boolean };
  if (typeof g.__canalRecallAtlasAerial === 'boolean') return g.__canalRecallAtlasAerial;
  const v = new URLSearchParams(search ?? g.location?.search ?? '').get(ATLAS_AERIAL_PARAM);
  if (v === '1' || v === 'true' || v === 'measure') return true;
  if (v === '0' || v === 'false') return false;
  return ATLAS_AERIAL_DEFAULT;
}

/** `?atlasAerial=measure`: the floor and the curve are recorded, the pair never changes (the measure-first runs). */
export function atlasAerialMeasureOnly(search?: string): boolean {
  const g = globalThis as { location?: { search?: string } };
  return new URLSearchParams(search ?? g.location?.search ?? '').get(ATLAS_AERIAL_PARAM) === 'measure';
}

/** Tallest building top in the extracts, metres above the ground datum, with room (Rembrandttoren 135 m). */
export const ATLAS_TALLEST_M = 175;
/**
 * The most metres one atlas cell spans anywhere (the sparsest texel density): facade bays 3–6 m, storeys 3–5 m,
 * roofs 5 m, lids 4 m, slot layers 1–3.4 m (palette.ts SLOT_TILE_M); 12 m covers the large tier's civic storeys and
 * glTF-uv slot meshes with margin.
 */
export const ATLAS_CELL_M_MAX = 12;
/** Bind the half pair only while the floor stays at or above this level (1 = level 0 is never read). */
export const DROP_LOD = 2.5;
/** Start the restore when the floor (now or a lead ahead) falls under this level. */
export const RESTORE_LOD = 2;
/** Frames the floor must stay ≥ DROP_LOD before the drop starts. */
export const DROP_CALM_FRAMES = 60;
/** How far ahead the descent is extrapolated (ms): a restore takes ~0.3–0.6 s of frames. */
export const LEAD_MS = 1500;
/** Main-thread budget per frame for the copies and uploads. */
export const SLICE_MS = 4;

export type FloorInput = {
  /** Eye height above the ground datum, metres. */
  eyeM: number;
  /** Device pixels per unit of tan(angle) (drawing-buffer height / 2 / tan(fovY / 2)). */
  focalPx: number;
  /** Atlas cell side, texels (256 desktop, 128 touch). */
  cellPx: number;
  /** The facade sample's mip bias (−0.6 with the window SDF, 0 without; positive biases count as 0). */
  lodBias?: number;
  tallestM?: number;
  cellMetresMax?: number;
};

/** A lower bound on the finest mip level any atlas sample can read this frame (−Infinity when a facade may be at the eye). */
export function facadeLodFloor(i: FloorInput): number {
  const d = i.eyeM - (i.tallestM ?? ATLAS_TALLEST_M);
  if (!(d > 0) || !(i.focalPx > 0) || !(i.cellPx > 0)) return -Infinity;
  const texelsPerPixel = (i.cellPx / (i.cellMetresMax ?? ATLAS_CELL_M_MAX)) * d / i.focalPx;
  return Math.log2(texelsPerPixel) + Math.min(0, i.lodBias ?? 0);
}

/**
 * The same estimate at the nearest drawn facade chunk (its bounding sphere's nearest point): what the GPU is actually
 * near this frame, for the curve (not used by the trigger: slot meshes and landmarks sample the atlas too).
 */
export function chunkLodEstimate(nearestM: number, focalPx: number, cellPx: number, lodBias = 0, cellMetresMax = ATLAS_CELL_M_MAX): number {
  if (!(nearestM > 0)) return -Infinity;
  return Math.log2((cellPx / cellMetresMax) * nearestM / focalPx) + Math.min(0, lodBias);
}

/** Device pixels per unit tan from a clip ← world matrix (column-major, world in metres) and the buffer height. */
export function focalPxOf(clipFromWorld: ArrayLike<number>, heightPx: number): number {
  const m = clipFromWorld;
  // Row 1 (clip y) and row 3 (clip w) of the 3×3 part: |y row| / |w row| = 1 / tan(fovY / 2) for a rigid view.
  const ry = Math.hypot(m[1], m[5], m[9]), rw = Math.hypot(m[3], m[7], m[11]);
  return rw > 0 ? ry / rw * heightPx / 2 : 0;
}

/** Eye height extrapolated `leadMs` ahead at the current vertical speed (descents only; climbing keeps `eyeM`). */
export function eyeAhead(eyeM: number, prevEyeM: number | null, dtMs: number, leadMs = LEAD_MS): number {
  if (prevEyeM == null || !(dtMs > 0)) return eyeM;
  const rate = (eyeM - prevEyeM) / dtMs;
  return rate < 0 ? eyeM + rate * leadMs : eyeM;
}

export type AtlasMode = 'full' | 'dropping' | 'half' | 'restoring';
export type TriggerState = { mode: AtlasMode; calm: number };
export type TriggerAction = 'drop' | 'restore' | 'cancel-drop' | null;
export type TriggerConfig = { dropLod: number; restoreLod: number; calmFrames: number };
export const TRIGGER_DEFAULTS: TriggerConfig = { dropLod: DROP_LOD, restoreLod: RESTORE_LOD, calmFrames: DROP_CALM_FRAMES };

/**
 * One frame of the trigger. `floor` is the level floor now, `ahead` the floor a lead ahead (≤ floor while descending).
 * full → dropping after `calmFrames` frames with both ≥ dropLod; dropping is cancelled (the half pair discarded, the
 * full pair never left) as soon as either falls under restoreLod; half → restoring under restoreLod. The caller moves
 * dropping → half and restoring → full when the GPU work is done (`settle`).
 */
export function stepTrigger(state: TriggerState, floor: number, ahead: number, cfg: TriggerConfig = TRIGGER_DEFAULTS): { state: TriggerState; action: TriggerAction } {
  const low = Math.min(floor, ahead);
  switch (state.mode) {
    case 'full': {
      const calm = low >= cfg.dropLod ? state.calm + 1 : 0;
      if (calm >= cfg.calmFrames) return { state: { mode: 'dropping', calm: 0 }, action: 'drop' };
      return { state: { mode: 'full', calm }, action: null };
    }
    case 'dropping':
      return low < cfg.restoreLod ? { state: { mode: 'full', calm: 0 }, action: 'cancel-drop' } : { state, action: null };
    case 'half':
      return low < cfg.restoreLod ? { state: { mode: 'restoring', calm: 0 }, action: 'restore' } : { state, action: null };
    case 'restoring':
      return { state, action: null };
  }
}

/** The GPU work is done: dropping → half, restoring → full. */
export function settle(state: TriggerState): TriggerState {
  return state.mode === 'dropping' ? { mode: 'half', calm: 0 } : state.mode === 'restoring' ? { mode: 'full', calm: 0 } : state;
}

/** Layer bands for the level-0 upload: `[first, count]` with at most `layersPerBand` layers each. */
export function layerBands(depth: number, layersPerBand: number): [number, number][] {
  const n = Math.max(1, Math.floor(layersPerBand)), out: [number, number][] = [];
  for (let z = 0; z < depth; z += n) out.push([z, Math.min(n, depth - z)]);
  return out;
}

/**
 * Run queued steps until `budgetMs` has passed (at least one step per call, so the work always advances). Returns
 * the number run and the time spent. `now` is injectable for tests.
 */
export function runSlice(queue: (() => void)[], budgetMs: number, now: () => number = () => performance.now()): { ran: number; ms: number } {
  const t0 = now();
  let ran = 0;
  while (queue.length) {
    queue.shift()!();
    ran++;
    if (now() - t0 >= budgetMs) break;
  }
  return { ran, ms: now() - t0 };
}

/** Mip levels of a square side (256 → 9: 256..1). */
export const mipLevels = (size: number) => Math.floor(Math.log2(Math.max(1, size))) + 1;

// ---------------------------------------------------------------------------------------------------------------- GL

type Pair = { colour: any; mask: any };
export type AtlasAerialStats = {
  mode: AtlasMode; floor: number; ahead: number; eyeM: number; chunkLod: number | null; drops: number; restores: number; cancels: number;
  /** Frames drawn with the half pair bound while the floor was under 1 (a facade may have read soft): must stay 0. */
  softFrames: number;
  /** Longest single slice of GPU work in a frame, ms; and the last drop / restore from start to bind, ms and frames. */
  maxSliceMs: number; lastDropMs: number | null; lastDropFrames: number | null; lastRestoreMs: number | null; lastRestoreFrames: number | null;
  /** Why the switch is off for this page (custom mips, footprint taps, no WebGL2, no level-0 store), or null. */
  disabled: string | null;
  /** Bytes the full and the half pair hold on the GPU (decoded, with mips), MB. */
  fullMB: number; halfMB: number;
  /** Every 6th frame: [t ms, eye m, floor, chunk estimate, mode index, aerial 0/1]. */
  curve: [number, number, number, number | null, number, number][];
};

export type AtlasAerialHost = {
  THREE: any;
  renderer: () => any;
  /** Bind a pair to every facade material (and the city look's slot meshes); `half` halves the tier band. */
  bind: (pair: Pair, half: boolean) => void;
  repaint: () => void;
};

const MODE_INDEX: Record<AtlasMode, number> = { full: 0, dropping: 1, half: 2, restoring: 3 };
const CACHE_NAME = 'canal-recall-atlas-aerial-v1';

/** The GL side for one bound atlas pair. Create it before the pair's first upload (it keeps level 0 for the restore). */
export class AtlasAerialSwitch {
  private state: TriggerState = { mode: 'full', calm: 0 };
  private queue: (() => void)[] = [];
  private pending: Pair | null = null;
  private half: Pair | null = null;
  private store: { key: string; ready: Promise<boolean>; blob: Blob | null } | null = null;
  private prevEye: number | null = null;
  private prevT: number | null = null;
  private workT0 = 0;
  private workFrames = 0;
  private frameNo = 0;
  private fbo: any = null;
  private epoch = 0;
  /** Set by `force`: the trigger is not consulted (probes). */
  private pinned = false;
  readonly stats: AtlasAerialStats;

  constructor(private host: AtlasAerialHost, public full: Pair, readonly size: number, readonly depth: number, disabled: string | null = null) {
    const fullMB = this.pairMB(size), halfMB = this.pairMB(size >> 1);
    this.stats = { mode: 'full', floor: NaN, ahead: NaN, eyeM: NaN, chunkLod: null, drops: 0, restores: 0, cancels: 0, softFrames: 0, maxSliceMs: 0, lastDropMs: null, lastDropFrames: null, lastRestoreMs: null, lastRestoreFrames: null, disabled, fullMB, halfMB, curve: [] };
    if (!disabled) this.keepLevel0();
  }

  private pairMB(side: number): number {
    let texels = 0;
    for (let s = side; s >= 1; s >>= 1) texels += s * s;
    return +(texels * this.depth * 5 / 1048576).toFixed(1); // RGBA8 + R8
  }

  /** The packed level-0 bytes (colour then mask) into Cache Storage (disk), or a Blob when there is none. */
  private keepLevel0(): void {
    const colour: Uint8Array | null = this.full.colour?.image?.data ?? null, mask: Uint8Array | null = this.full.mask?.image?.data ?? null;
    const s = this.size, n = s * s * this.depth;
    if (!colour || !mask || colour.length !== n * 4 || mask.length !== n) { this.stats.disabled = 'no level-0 bytes (mask not R8, or already uploaded)'; return; }
    let blob: Blob;
    try { blob = new Blob([colour as BlobPart, mask as BlobPart], { type: 'application/octet-stream' }); } catch { this.stats.disabled = 'no Blob'; return; }
    const key = `${new URL('/', (globalThis as any).location?.href ?? 'http://localhost/').href}__atlas-aerial/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: { key: string; ready: Promise<boolean>; blob: Blob | null } = { key, blob, ready: Promise.resolve(true) };
    if (typeof caches !== 'undefined') {
      entry.ready = (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          for (const old of await cache.keys()) await cache.delete(old); // one page's copy at a time
          await cache.put(key, new Response(blob, { headers: { 'content-length': String(blob.size) } }));
          entry.blob = null; // on disk now
          return true;
        } catch { return true; } // keep the Blob
      })();
    }
    this.store = entry;
  }

  private async level0(): Promise<Uint8Array | null> {
    const st = this.store;
    if (!st) return null;
    try {
      if (st.blob) return new Uint8Array(await st.blob.arrayBuffer());
      const hit = await (await caches.open(CACHE_NAME)).match(st.key);
      return hit ? new Uint8Array(await hit.arrayBuffer()) : null;
    } catch { return null; }
  }

  /**
   * One frame: the floor from the eye, the trigger, then at most SLICE_MS of queued GPU work. `aerial` and `chunkLod`
   * are only recorded (the curve).
   */
  frame(input: { eyeM: number; focalPx: number; lodBias: number; t: number; aerial?: boolean; chunkLod?: number | null }): void {
    const s = this.stats;
    const floor = facadeLodFloor({ eyeM: input.eyeM, focalPx: input.focalPx, cellPx: this.size, lodBias: input.lodBias });
    const ahead = facadeLodFloor({ eyeM: eyeAhead(input.eyeM, this.prevEye, this.prevT == null ? 0 : input.t - this.prevT), focalPx: input.focalPx, cellPx: this.size, lodBias: input.lodBias });
    this.prevEye = input.eyeM; this.prevT = input.t;
    s.floor = +floor.toFixed(2); s.ahead = +ahead.toFixed(2); s.eyeM = Math.round(input.eyeM); s.chunkLod = input.chunkLod == null || !Number.isFinite(input.chunkLod) ? null : +input.chunkLod.toFixed(2);
    if ((this.frameNo++ % 6) === 0 && s.curve.length < 20000) s.curve.push([Math.round(input.t), Math.round(input.eyeM), s.floor, s.chunkLod, MODE_INDEX[this.state.mode], input.aerial ? 1 : 0]);
    if (this.state.mode === 'half' && floor < 1) s.softFrames++;
    if (s.disabled) return;
    if (!this.pinned) {
    const { state, action } = stepTrigger(this.state, floor, ahead);
    this.state = state;
    if (action === 'drop') this.beginDrop();
    else if (action === 'cancel-drop') this.cancelDrop();
    else if (action === 'restore') void this.beginRestore();
    }
    s.mode = this.state.mode;
    if (this.queue.length) {
      this.workFrames++;
      const r = runSlice(this.queue, SLICE_MS);
      if (r.ms > s.maxSliceMs) s.maxSliceMs = +r.ms.toFixed(2);
      this.host.repaint();
    }
  }

  private gl(): any { return this.host.renderer()?.getContext?.(); }
  private handle(t: any): any { return this.host.renderer()?.properties?.get?.(t)?.__webglTexture; }

  /** An empty array texture like `like`, `side` texels, allocated (texStorage3D, full chain) but never filled by three. */
  private emptyLike(like: any, side: number): any {
    const { THREE } = this.host;
    const t = new THREE.DataArrayTexture(null, side, side, this.depth);
    t.format = like.format; t.type = like.type; t.internalFormat = like.internalFormat ?? null;
    t.wrapS = like.wrapS; t.wrapT = like.wrapT; t.minFilter = like.minFilter; t.magFilter = like.magFilter;
    t.anisotropy = like.anisotropy; t.unpackAlignment = 1; t.generateMipmaps = true; // the level count; three's generateMipmap runs on empty storage once
    t.userData = { ...(like.userData ?? {}), bytes: side * side * this.depth * (like.format === THREE.RGBAFormat ? 4 : like.format === THREE.RGFormat ? 2 : 1), atlasAerial: side === this.size ? 'full' : 'half' };
    t.source.dataReady = false;
    t.needsUpdate = true;
    this.host.renderer().initTexture(t);
    return t;
  }

  private framebuffer(gl: any): any { return this.fbo ??= gl.createFramebuffer(); }

  /** Queue the GPU copies src level (l + srcOffset) → dst level (l + dstOffset), per layer. */
  private queueCopies(src: any, dst: any, srcSide: number, srcOffset: number, dstOffset: number, epoch: number): void {
    const levels = mipLevels(srcSide) - srcOffset;
    for (let l = 0; l < levels; l++) {
      const side = Math.max(1, srcSide >> (l + srcOffset));
      // A few layers a step: one copy per layer and level is ~1,900 calls for a pair.
      const per = Math.max(1, Math.min(this.depth, Math.floor(65536 / (side * side)) || 1));
      for (const [z0, n] of layerBands(this.depth, per)) this.queue.push(() => { if (epoch === this.epoch) this.copyLayers(src, dst, l + srcOffset, l + dstOffset, side, z0, n); });
    }
  }

  private copyLayers(src: any, dst: any, srcLevel: number, dstLevel: number, side: number, z0: number, n: number): void {
    const gl = this.gl(), r = this.host.renderer(), from = this.handle(src), to = this.handle(dst);
    if (!gl || !from || !to) return;
    const prevRead = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer(gl));
    r.state.bindTexture(gl.TEXTURE_2D_ARRAY, to);
    for (let z = z0; z < z0 + n; z++) {
      gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, from, srcLevel, z);
      gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, dstLevel, 0, 0, z, 0, 0, side, side);
    }
    gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, null, 0, 0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prevRead);
  }

  private beginDrop(): void {
    const epoch = ++this.epoch;
    this.workT0 = performance.now(); this.workFrames = 0;
    const half = { colour: this.emptyLike(this.full.colour, this.size >> 1), mask: this.emptyLike(this.full.mask, this.size >> 1) };
    this.pending = half;
    this.queueCopies(this.full.colour, half.colour, this.size, 1, 0, epoch);
    this.queueCopies(this.full.mask, half.mask, this.size, 1, 0, epoch);
    this.queue.push(() => {
      if (epoch !== this.epoch || this.state.mode !== 'dropping') return;
      const old = this.full;
      this.half = half; this.pending = null;
      this.host.bind(half, true);
      old.colour.dispose(); old.mask.dispose();
      this.state = settle(this.state); this.stats.mode = this.state.mode; this.stats.drops++;
      this.stats.lastDropMs = Math.round(performance.now() - this.workT0); this.stats.lastDropFrames = this.workFrames;
    });
  }

  private cancelDrop(): void {
    this.epoch++;
    this.queue.length = 0;
    if (this.pending) { this.pending.colour.dispose(); this.pending.mask.dispose(); this.pending = null; }
    this.stats.cancels++;
  }

  private async beginRestore(): Promise<void> {
    const epoch = ++this.epoch, half = this.half!;
    this.workT0 = performance.now(); this.workFrames = 0;
    const full = { colour: this.emptyLike(half.colour, this.size), mask: this.emptyLike(half.mask, this.size) };
    // Levels 1.. come back from the half pair on the GPU while level 0 is read from the store.
    this.queueCopies(half.colour, full.colour, this.size >> 1, 0, 1, epoch);
    this.queueCopies(half.mask, full.mask, this.size >> 1, 0, 1, epoch);
    const bytes = await this.level0();
    if (epoch !== this.epoch) return;
    const s = this.size, layerColour = s * s * 4, layerMask = s * s;
    if (bytes && bytes.length === (layerColour + layerMask) * this.depth) {
      const colour = bytes.subarray(0, layerColour * this.depth), mask = bytes.subarray(layerColour * this.depth);
      for (const [z0, n] of layerBands(this.depth, 8)) {
        this.queue.push(() => { if (epoch === this.epoch) this.uploadLevel0(full.colour, colour.subarray(z0 * layerColour, (z0 + n) * layerColour), z0, n, 4); });
        this.queue.push(() => { if (epoch === this.epoch) this.uploadLevel0(full.mask, mask.subarray(z0 * layerMask, (z0 + n) * layerMask), z0, n, 1); });
      }
    } else {
      // No store (should not happen: the switch is disabled without one): level 0 from level 1, soft but never black.
      this.stats.disabled = 'level-0 store lost';
    }
    this.queue.push(() => {
      if (epoch !== this.epoch) return;
      this.full = full; this.half = null;
      this.host.bind(full, false);
      half.colour.dispose(); half.mask.dispose();
      this.state = settle(this.state); this.stats.mode = this.state.mode; this.stats.restores++;
      this.stats.lastRestoreMs = Math.round(performance.now() - this.workT0); this.stats.lastRestoreFrames = this.workFrames;
    });
    this.host.repaint();
  }

  private uploadLevel0(t: any, data: Uint8Array, z0: number, n: number, channels: 1 | 4): void {
    const gl = this.gl(), r = this.host.renderer(), h = this.handle(t);
    if (!gl || !h) return;
    r.state.bindTexture(gl.TEXTURE_2D_ARRAY, h);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const p of ['UNPACK_ROW_LENGTH', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS', 'UNPACK_SKIP_IMAGES']) gl.pixelStorei(gl[p], 0);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, z0, this.size, this.size, n, channels === 4 ? gl.RGBA : gl.RED, gl.UNSIGNED_BYTE, data);
  }

  /** Probe hook: force a drop or a restore now (tests and the A/B strip), ignoring the floor. */
  force(mode: 'half' | 'full' | null): void {
    this.pinned = mode != null;
    if (this.stats.disabled || mode == null) return;
    if (mode === 'half' && this.state.mode === 'full') { this.state = { mode: 'dropping', calm: 0 }; this.beginDrop(); }
    else if (mode === 'full' && this.state.mode === 'half') { this.state = { mode: 'restoring', calm: 0 }; void this.beginRestore(); }
  }

  get mode(): AtlasMode { return this.state.mode; }
  get bound(): Pair { return this.half ?? this.full; }
}
