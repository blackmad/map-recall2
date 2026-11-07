// GL work counters for the P4 counters gate (#129): draws and triangles per frame, shader compiles and program
// links, and texture/buffer uploads, counted on the one WebGL context every three.js participant shares.
//
// Opt-in (`?glCounters=1` or `window.__canalRecallGlCounters = true`, engine/ownWorldView.ts): the hooks wrap the
// context's own methods, so a page without the flag runs the context untouched. `window.__canalPerf.gl` exposes
// `markWarm()` (start the after-warm-up window) and `report()`. Uploads of at least `largeBytes` and every compile or
// link are kept with an owner (the first stack frame outside this file and three.js), so a miss names who did it.

export interface GlTotals {
  draws: number;
  triangles: number;
  compiles: number;
  links: number;
  uploads: number;
  uploadBytes: number;
}

export interface GlEvent { kind: 'upload' | 'compile' | 'link'; fn: string; bytes: number; at: number; owner: string }

export interface GlFrameStats { n: number; p50: number; p95: number; max: number }

export interface GlReport {
  total: GlTotals;
  /** Totals since `markWarm()`, or since install when it was never called. */
  sinceWarm: GlTotals;
  warmAt: number | null;
  /** Uploads of at least `largeBytes` since warm-up, with owners. */
  largeUploads: GlEvent[];
  /** Compiles and links since warm-up, with owners. */
  programs: GlEvent[];
  /** Programs three.js holds now that it did not hold at warm-up (`programNames` option). */
  newPrograms: string[];
  /** Per-frame draws and triangles over the frames since warm-up (every pass, shadow included). */
  frames: { draws: GlFrameStats; triangles: GlFrameStats };
  /** GPU memory the context holds now (buffers, textures, renderbuffers), estimated from the allocation calls. */
  resident: GlResidentReport;
  /** Mean draws and triangles per frame by `drawOwner` since warm-up, largest triangle share first. */
  byOwner: { owner: string; draws: number; triangles: number }[];
  /** Draws by `drawOwner` in the last closed frame. */
  lastFrameByOwner: Record<string, number>;
}

export interface GlCounterOptions {
  /** An upload at least this large is kept as an event (default 1 MiB). */
  largeBytes?: number;
  now?: () => number;
  /** Who made the call; default: the GL call's caller, past three.js frames. */
  owner?: () => string;
  /** What is being drawn when the call happens (`objectLabel` of the renderer's current object), appended to the owner. */
  context?: () => string;
  /** Who a draw belongs to (e.g. the shared-frame participant); draws and triangles are then also kept per owner. */
  drawOwner?: () => string;
  /** The renderer's program names (renderer.info.programs), to name the programs created after warm-up. */
  programNames?: () => string[];
  /** Frames kept for the per-frame statistics (default 3600, a minute at 60 fps). */
  keepFrames?: number;
  /** Events kept (default 200). */
  keepEvents?: number;
}

const zero = (): GlTotals => ({ draws: 0, triangles: 0, compiles: 0, links: 0, uploads: 0, uploadBytes: 0 });

/** Triangles a draw call rasterises (TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN; points and lines count none). */
export function trianglesOf(mode: number, count: number, instances = 1): number {
  const per = mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  return per * Math.max(1, instances);
}

const BYTES_PER_TEXEL = 4;
/** Bytes a texture upload carries: the typed array if there is one, else an image source's size, else width x height. */
export function textureBytes(args: readonly unknown[]): number {
  for (const a of args) if (ArrayBuffer.isView(a)) return a.byteLength;
  for (const a of args) {
    if (a && typeof a === 'object' && 'width' in a && 'height' in a) {
      const { width, height } = a as { width: unknown; height: unknown };
      if (typeof width === 'number' && typeof height === 'number') return width * height * BYTES_PER_TEXEL;
    }
  }
  const nums = args.filter((a): a is number => typeof a === 'number');
  // texImage2D(target, level, internalformat, width, height, border, format, type, ...)
  return nums.length >= 5 ? nums[3] * nums[4] * BYTES_PER_TEXEL : 0;
}

/** Bytes a buffer upload carries (bufferData size-only allocations count their size: the driver clears that much). */
export function bufferBytes(fn: string, args: readonly unknown[]): number {
  const v = args[fn === 'bufferSubData' ? 2 : 1];
  if (ArrayBuffer.isView(v)) {
    // bufferData(target, src, usage, srcOffset, length) / bufferSubData(target, offset, src, srcOffset, length)
    const length = args[fn === 'bufferSubData' ? 4 : 4];
    if (typeof length === 'number' && length > 0) return length * ((v as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 1);
    return v.byteLength;
  }
  if (v instanceof ArrayBuffer) return v.byteLength;
  return typeof v === 'number' && fn === 'bufferData' ? v : 0;
}

export interface GlResidentReport {
  buffers: number; bufferMB: number; textures: number; textureMB: number; renderbuffers: number; renderbufferMB: number; totalMB: number;
  /** With a tagger (`tagWith`): resident MB by who allocated each object, largest first. */
  byOwner?: { owner: string; MB: number; objects: number }[];
}

export type GlObjectKind = 'buffer' | 'texture' | 'renderbuffer';
const TEXTURE_CUBE_MAP = 0x8513;
const isCubeFace = (target: number) => target >= 0x8515 && target <= 0x851a;
const MB = (b: number) => Math.round(b / 1048576 * 10) / 10;
/**
 * Resident GPU bytes of one context (lane E2, #215): what `bufferData`, `texImage*`/`texStorage*`/`compressedTexImage*`
 * and `renderbufferStorage*` allocated, less what `delete*` freed, tracked per object through the bind calls. Texels
 * count 4 bytes (formats are not decoded); a texStorage chain counts every level. An estimate, but one that grows
 * exactly when the context keeps objects alive, which is the question a long ride asks.
 */
export class GlResident {
  private readonly bound = new Map<string, object | null>();
  private unit = 0;
  private readonly sizes = { buffer: new Map<object, number>(), texture: new Map<object, Map<string, number>>(), renderbuffer: new Map<object, number>() };
  private bytes = { buffer: 0, texture: 0, renderbuffer: 0 };
  /**
   * Who allocated each object (lane R3-F #241: the aerial pan's GL peak by owner). `tag()` runs at an object's first
   * allocation and may return a cheap token; `name(token)` turns it into an owner at report time.
   */
  private tagger: { tag: (kind: GlObjectKind) => unknown; name: () => (token: unknown) => string } | null = null;
  private readonly tags = new Map<object, unknown>();
  tagWith(tag: (kind: GlObjectKind) => unknown, name: () => (token: unknown) => string = () => token => String(token)): void { this.tagger = { tag, name }; }
  private tagObject(obj: object, kind: GlObjectKind): void {
    if (!this.tagger || this.tags.has(obj)) return;
    let token: unknown = '?';
    try { token = this.tagger.tag(kind); } catch { /* counting never breaks GL */ }
    this.tags.set(obj, token);
  }

  bindBuffer(target: number, buffer: object | null): void { this.bound.set(`b${target}`, buffer); }
  activeTexture(unit: number): void { this.unit = unit; }
  bindTexture(target: number, texture: object | null): void { this.bound.set(`t${this.unit}:${target}`, texture); }
  bindRenderbuffer(_target: number, rb: object | null): void { this.bound.set('r', rb); }

  bufferData(target: number, bytes: number): void {
    const b = this.bound.get(`b${target}`);
    if (!b) return;
    this.tagObject(b, 'buffer');
    this.bytes.buffer += bytes - (this.sizes.buffer.get(b) ?? 0);
    this.sizes.buffer.set(b, bytes);
  }
  /** A level (or a whole storage chain, `level` 'storage') of the texture bound to `target` on the active unit. */
  textureLevel(target: number, level: number | 'storage', bytes: number): void {
    const t = this.bound.get(`t${this.unit}:${isCubeFace(target) ? TEXTURE_CUBE_MAP : target}`);
    if (!t) return;
    this.tagObject(t, 'texture');
    const levels = this.sizes.texture.get(t) ?? new Map<string, number>();
    const key = level === 'storage' ? 'storage' : `${target}:${level}`;
    this.bytes.texture += bytes - (levels.get(key) ?? 0);
    levels.set(key, bytes);
    this.sizes.texture.set(t, levels);
  }
  renderbufferStorage(bytes: number): void {
    const r = this.bound.get('r');
    if (!r) return;
    this.tagObject(r, 'renderbuffer');
    this.bytes.renderbuffer += bytes - (this.sizes.renderbuffer.get(r) ?? 0);
    this.sizes.renderbuffer.set(r, bytes);
  }
  delete(kind: 'buffer' | 'texture' | 'renderbuffer', obj: object | null): void {
    if (!obj) return;
    this.tags.delete(obj);
    if (kind === 'texture') {
      const levels = this.sizes.texture.get(obj);
      if (levels) for (const v of levels.values()) this.bytes.texture -= v;
      this.sizes.texture.delete(obj);
    } else {
      this.bytes[kind] -= this.sizes[kind].get(obj) ?? 0;
      this.sizes[kind].delete(obj);
    }
  }

  /** Wrap the context's allocation calls (after the originals run); returns the undo. */
  install(gl: Record<string, any>): () => void {
    const undo: (() => void)[] = [];
    const wrap = (fn: string, after: (args: any[]) => void) => {
      const original = gl[fn];
      if (typeof original !== 'function') return;
      const had = Object.prototype.hasOwnProperty.call(gl, fn);
      gl[fn] = function (this: unknown, ...args: any[]) { const r = original.apply(gl, args); try { after(args); } catch { /* counting never breaks GL */ } return r; };
      undo.push(() => { if (had) gl[fn] = original; else delete gl[fn]; });
    };
    wrap('bindBuffer', a => this.bindBuffer(a[0], a[1]));
    wrap('activeTexture', a => this.activeTexture(a[0]));
    wrap('bindTexture', a => this.bindTexture(a[0], a[1]));
    wrap('bindRenderbuffer', a => this.bindRenderbuffer(a[0], a[1]));
    wrap('bufferData', a => this.bufferData(a[0], bufferBytes('bufferData', a)));
    wrap('texImage2D', a => this.textureLevel(a[0], a[1], textureBytes(a)));
    wrap('compressedTexImage2D', a => this.textureLevel(a[0], a[1], ArrayBuffer.isView(a[6]) ? a[6].byteLength : (typeof a[6] === 'number' ? a[6] : 0)));
    // texImage3D(target, level, internalformat, width, height, depth, border, format, type, source)
    wrap('texImage3D', a => this.textureLevel(a[0], a[1], ArrayBuffer.isView(a[9]) ? a[9].byteLength : a[3] * a[4] * a[5] * BYTES_PER_TEXEL));
    // texStorage2D(target, levels, internalformat, width, height): the whole mip chain at once.
    wrap('texStorage2D', a => this.textureLevel(a[0], 'storage', chainBytes(a[3], a[4], 1, a[1])));
    wrap('texStorage3D', a => this.textureLevel(a[0], 'storage', chainBytes(a[3], a[4], a[5], a[1])));
    wrap('renderbufferStorage', a => this.renderbufferStorage(a[2] * a[3] * BYTES_PER_TEXEL));
    wrap('renderbufferStorageMultisample', a => this.renderbufferStorage(a[3] * a[4] * BYTES_PER_TEXEL * Math.max(1, a[1])));
    wrap('deleteBuffer', a => this.delete('buffer', a[0]));
    wrap('deleteTexture', a => this.delete('texture', a[0]));
    wrap('deleteRenderbuffer', a => this.delete('renderbuffer', a[0]));
    return () => { for (const u of undo.reverse()) u(); };
  }

  report(): GlResidentReport {
    const { buffer, texture, renderbuffer } = this.bytes;
    const out: GlResidentReport = { buffers: this.sizes.buffer.size, bufferMB: MB(buffer), textures: this.sizes.texture.size, textureMB: MB(texture),
      renderbuffers: this.sizes.renderbuffer.size, renderbufferMB: MB(renderbuffer), totalMB: MB(buffer + texture + renderbuffer) };
    if (this.tagger) out.byOwner = this.ownerBytes(this.tagger.name());
    return out;
  }
  private ownerBytes(name: (token: unknown) => string): { owner: string; MB: number; objects: number }[] {
    const by = new Map<string, { bytes: number; objects: number }>();
    const add = (obj: object, kind: string, bytes: number) => {
      let owner = '?';
      try { owner = this.tags.has(obj) ? name(this.tags.get(obj)) : 'untagged'; } catch { /* keep '?' */ }
      const key = `${kind} ${owner}`, o = by.get(key) ?? { bytes: 0, objects: 0 };
      o.bytes += bytes; o.objects++; by.set(key, o);
    };
    for (const [b, bytes] of this.sizes.buffer) add(b, 'buffer', bytes);
    for (const [t, levels] of this.sizes.texture) { let bytes = 0; for (const v of levels.values()) bytes += v; add(t, 'texture', bytes); }
    for (const [r, bytes] of this.sizes.renderbuffer) add(r, 'renderbuffer', bytes);
    return [...by].map(([owner, o]) => ({ owner, MB: MB(o.bytes), objects: o.objects })).sort((a, b) => b.MB - a.MB);
  }
}

/** Bytes of a `levels`-deep mip chain of a w x h x depth texture (depth not halved: array textures). */
export function chainBytes(width: number, height: number, depth: number, levels: number): number {
  let bytes = 0, w = width, h = height;
  for (let l = 0; l < Math.max(1, levels); l++) { bytes += w * h * depth * BYTES_PER_TEXEL; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
  return bytes;
}

const THREE_FRAME = /three(\.bundle|\.module|\.core)?\.js|node_modules\/three\//;
/**
 * The first stack frame past the counter's own `skip` frames and outside three.js, shortened to `function file:line`.
 * Frame-counted rather than matched by file name: in the browser this module is bundled into engine.bundle.js with
 * the world view, so its frames carry no name of their own (esbuild does not inline functions, so the depth holds).
 */
export function stackOwner(stack: string, skip: number): string {
  const frames = stack.split('\n').filter(l => /^\s*at\s/.test(l)).slice(skip);
  for (const line of frames) {
    const l = line.trim();
    if (THREE_FRAME.test(l)) continue;
    return l.replace(/^at\s+/, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '').slice(0, 160);
  }
  return '?';
}
/** Frames between `new Error()` in the default owner and the GL call's caller: owner, ownerNow, upload/program, count, wrapper. */
const OWN_FRAMES = 5;
/** Stack depth for an owner: three.js alone is 10+ frames deep under a render (the default limit is 10). */
const OWNER_STACK_FRAMES = 60;
function deepStackOwner(): string {
  const E = Error as { stackTraceLimit?: number };
  const limit = E.stackTraceLimit;
  E.stackTraceLimit = OWNER_STACK_FRAMES;
  try { return stackOwner(new Error().stack ?? '', OWN_FRAMES); } finally { E.stackTraceLimit = limit; }
}

const WRAPPER = 'shared-frame/';
/** A three.js object as `participant:nearest name` (the shared frame's wrapper names each participant's root). */
export function objectLabel(object: { name?: string; type?: string; parent?: unknown } | null | undefined): string {
  let near = '';
  for (let p: any = object; p; p = p.parent) {
    const name: string = typeof p.name === 'string' ? p.name : '';
    if (name.startsWith(WRAPPER)) {
      const part = name.slice(WRAPPER.length);
      return near ? `${part}:${near}` : part;
    }
    if (!near && name) near = name;
  }
  return near || object?.type || '';
}

function stats(values: number[]): GlFrameStats {
  if (!values.length) return { n: 0, p50: 0, p95: 0, max: 0 };
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return { n: s.length, p50: at(0.5), p95: at(0.95), max: s[s.length - 1] };
}

const DRAWS: Record<string, (a: any[]) => number> = {
  drawArrays: a => trianglesOf(a[0], a[2]),
  drawElements: a => trianglesOf(a[0], a[1]),
  drawArraysInstanced: a => trianglesOf(a[0], a[2], a[3]),
  drawElementsInstanced: a => trianglesOf(a[0], a[1], a[4]),
  drawRangeElements: a => trianglesOf(a[0], a[3]),
};
const TEXTURES = ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'compressedTexImage3D', 'compressedTexSubImage3D'];
const BUFFERS = ['bufferData', 'bufferSubData'];

export class GlCounters {
  readonly total: GlTotals = zero();
  private base: GlTotals = zero();
  private warmAt: number | null = null;
  private frame = { draws: 0, triangles: 0 };
  private frames: { draws: number; triangles: number }[] = [];
  private events: GlEvent[] = [];
  private warmPrograms = new Set<string>();
  private owners = new Map<string, { draws: number; triangles: number }>();
  /** Draws by owner in the frame under way, and in the last closed frame (lane R3-F #241: draws per kind at a sample). */
  private frameOwners = new Map<string, number>();
  private lastFrameOwners = new Map<string, number>();
  private framesSinceWarm = 0;
  readonly resident = new GlResident();
  private readonly o: Required<Omit<GlCounterOptions, 'programNames' | 'context' | 'drawOwner'>> & { programNames?: () => string[]; context?: () => string; drawOwner?: () => string };

  constructor(options: GlCounterOptions = {}) {
    this.o = {
      largeBytes: 1 << 20,
      now: () => performance.now(),
      owner: deepStackOwner,
      keepFrames: 3600,
      keepEvents: 200,
      ...options,
    };
  }

  /** Wrap the context's methods; returns the undo. */
  install(gl: Record<string, any>): () => void {
    // The resident tracker wraps innermost (undone last), so the owner's frame depth below is unchanged.
    const undo: (() => void)[] = [this.resident.install(gl)];
    const wrap = (fn: string, count: (args: any[]) => void) => {
      const original = gl[fn];
      if (typeof original !== 'function') return;
      const had = Object.prototype.hasOwnProperty.call(gl, fn);
      gl[fn] = function (this: unknown, ...args: any[]) { count(args); return original.apply(gl, args); };
      undo.push(() => { if (had) gl[fn] = original; else delete gl[fn]; });
    };
    for (const [fn, tris] of Object.entries(DRAWS)) wrap(fn, a => this.draw(tris(a)));
    for (const fn of TEXTURES) wrap(fn, a => this.upload(fn, textureBytes(a)));
    for (const fn of BUFFERS) wrap(fn, a => this.upload(fn, bufferBytes(fn, a)));
    wrap('compileShader', () => this.program('compile', 'compileShader'));
    wrap('linkProgram', () => this.program('link', 'linkProgram'));
    return () => { for (const u of undo.reverse()) u(); };
  }

  draw(triangles: number): void {
    this.total.draws++; this.total.triangles += triangles;
    this.frame.draws++; this.frame.triangles += triangles;
    if (this.o.drawOwner) {
      const key = this.o.drawOwner();
      const o = this.owners.get(key) ?? { draws: 0, triangles: 0 };
      o.draws++; o.triangles += triangles;
      this.owners.set(key, o);
      this.frameOwners.set(key, (this.frameOwners.get(key) ?? 0) + 1);
    }
  }

  upload(fn: string, bytes: number): void {
    this.total.uploads++; this.total.uploadBytes += bytes;
    if (bytes >= this.o.largeBytes) this.event({ kind: 'upload', fn, bytes, at: this.o.now(), owner: this.ownerNow() });
  }

  program(kind: 'compile' | 'link', fn: string): void {
    if (kind === 'compile') this.total.compiles++; else this.total.links++;
    this.event({ kind, fn, bytes: 0, at: this.o.now(), owner: this.ownerNow() });
  }

  /** Close the frame: its draws and triangles join the per-frame statistics. */
  endFrame(): void {
    this.framesSinceWarm++;
    this.frames.push(this.frame);
    if (this.frames.length > this.o.keepFrames) this.frames.shift();
    this.frame = { draws: 0, triangles: 0 };
    this.lastFrameOwners = this.frameOwners;
    this.frameOwners = new Map();
  }

  /** Start the after-warm-up window: totals, events and frame statistics count from here. */
  markWarm(): void {
    this.base = { ...this.total };
    this.warmAt = this.o.now();
    this.events = [];
    this.frames = [];
    this.owners.clear();
    this.framesSinceWarm = 0;
    this.warmPrograms = new Set(this.o.programNames?.() ?? []);
  }

  report(): GlReport {
    const sinceWarm = Object.fromEntries(Object.entries(this.total).map(([k, v]) => [k, v - this.base[k as keyof GlTotals]])) as unknown as GlTotals;
    return {
      total: { ...this.total },
      sinceWarm,
      warmAt: this.warmAt,
      largeUploads: this.events.filter(e => e.kind === 'upload'),
      programs: this.events.filter(e => e.kind !== 'upload'),
      newPrograms: this.warmAt == null ? [] : (this.o.programNames?.() ?? []).filter(n => !this.warmPrograms.has(n)),
      frames: { draws: stats(this.frames.map(f => f.draws)), triangles: stats(this.frames.map(f => f.triangles)) },
      byOwner: [...this.owners].map(([owner, o]) => ({ owner, draws: +(o.draws / Math.max(1, this.framesSinceWarm)).toFixed(1), triangles: Math.round(o.triangles / Math.max(1, this.framesSinceWarm)) }))
        .sort((a, b) => b.triangles - a.triangles),
      resident: this.resident.report(),
      lastFrameByOwner: Object.fromEntries([...this.lastFrameOwners].sort((a, b) => b[1] - a[1])),
    };
  }

  private ownerNow(): string {
    const what = this.o.context?.() ?? '';
    return what ? `${this.o.owner()} @ ${what}` : this.o.owner();
  }

  private event(e: GlEvent): void {
    this.events.push(e);
    if (this.events.length > this.o.keepEvents) this.events.shift();
  }
}
