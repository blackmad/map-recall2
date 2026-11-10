// Landmark level dissolve (lane P3, #328, follow-up of P2 #325). From the air a landmark swaps lod2 <-> full as it
// crosses LOD2_AERIAL_M of the view centre, which puts the swap 600-1200 m from the eye; landmarks take no depth fade,
// so the swap showed as a one-frame change of shape (P2: 42 pops a minute in that band, the largest class left).
//
// With the dissolve the incoming level draws where the screen-door hash < t and the outgoing one where hash >= t, the
// same hash as the chunks' `cityFade` (look/cityLook.ts), so no pixel is drawn by both (no coplanar depth fight) and
// none by neither; t runs 0 -> 1 over LEVEL_DISSOLVE_MS, then the outgoing level leaves and the incoming keeps its own
// materials again. The clones share the source's uniforms, defines and shader hooks; their program is the source's
// plus two uniforms and one discard, keyed `|lodDissolve`, so all clones of one source variant share a program.
//
// A program that has never been compiled would link inside the frame of the first swap that needs it. `DissolveWarmth`
// tracks which program variants are compiled: a swap needing a cold variant goes instantly (the old path) and has the
// variant compiled off the frame (compileAsync), so the next swap with it dissolves.
//
// `?landmarkDissolve=0` (or `window.__canalRecallLandmarkDissolve = false`) restores the instant swap; it is also off
// with `?popFade=0`.
import { popFadeFlag } from './popFade.js';

export const LANDMARK_DISSOLVE_DEFAULT = true;
/** The swap's dissolve, the far tiers' length class (POP_FADE_MS). */
export const LEVEL_DISSOLVE_MS = 600;

export function landmarkDissolveFlag(): boolean {
  if (!popFadeFlag()) return false;
  const g = globalThis as { __canalRecallLandmarkDissolve?: boolean | string; location?: { search?: string } };
  // A regex, not URLSearchParams: bundles are also evaluated in Node checks without it.
  const m = /[?&]landmarkDissolve=([^&]*)/.exec(g.location?.search ?? '');
  const asked = g.__canalRecallLandmarkDissolve ?? (m ? m[1] : null);
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return LANDMARK_DISSOLVE_DEFAULT;
}

const DECLS = 'uniform float lodDissolveLo;\nuniform float lodDissolveHi;\n';
const DISCARD = '\n{ float lodDissolveHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));'
  + ' if (lodDissolveHash < lodDissolveLo || lodDissolveHash >= lodDissolveHi) discard; }\n';
const MAIN = /void\s+main\s*\(\s*(?:void\s*)?\)\s*\{/;

/** The fragment shader with the band discard first in `main` (declarations ahead of it). Unchanged without a main. */
export function injectDissolve(fragmentShader: string): string {
  const m = MAIN.exec(fragmentShader);
  if (!m) return fragmentShader;
  return fragmentShader.slice(0, m.index) + DECLS + m[0] + DISCARD + fragmentShader.slice(m.index + m[0].length);
}

export type Band = { lo: { value: number }; hi: { value: number } };
type Mat = {
  clone(): Mat; uniforms?: Record<string, unknown>; defines?: Record<string, unknown>; defaultAttributeValues?: unknown;
  onBeforeCompile?: (shader: any, renderer: any) => void; customProgramCacheKey?: () => string; userData?: Record<string, unknown>;
  type?: string; [k: string]: unknown;
};

/** A clone of `source` that draws only where lo <= hash < hi. Shares the source's uniforms (not copies), defines and hooks. */
export function dissolveClone<M extends Mat>(source: M, band: Band): M {
  const clone = source.clone() as M;
  // Material.copy carries neither `defines` (only ShaderMaterial's) nor shared uniform objects (ShaderMaterial deep-copies).
  if (source.defines) clone.defines = source.defines;
  if (source.uniforms) clone.uniforms = { ...source.uniforms, lodDissolveLo: band.lo, lodDissolveHi: band.hi };
  if (source.defaultAttributeValues) clone.defaultAttributeValues = source.defaultAttributeValues;
  clone.userData = { ...(source.userData ?? {}), lodDissolve: true };
  const hook = source.onBeforeCompile, key = programKeyOf(source);
  clone.onBeforeCompile = (shader: any, renderer: any) => {
    hook?.call(source, shader, renderer);
    shader.uniforms.lodDissolveLo = band.lo;
    shader.uniforms.lodDissolveHi = band.hi;
    shader.fragmentShader = injectDissolve(shader.fragmentShader);
  };
  clone.customProgramCacheKey = () => `${key}|lodDissolve`;
  return clone;
}

function programKeyOf(m: Mat): string {
  try { return m.customProgramCacheKey ? m.customProgramCacheKey() : ''; } catch { return ''; }
}

/**
 * An approximation of what keys three's program for a dissolve clone of `m` on a mesh (receiveShadow): if two
 * materials give the same string their clones share one program. A miss costs one in-frame compile, never a wrong draw.
 */
export function warmKey(m: Mat, receiveShadow: boolean): string {
  const f = (k: string) => { const v = m[k]; return v === undefined || v === null ? '' : typeof v === 'object' ? (v as { isTexture?: boolean }).isTexture ? 'T' : '' : String(v); };
  return [m.type, programKeyOf(m), JSON.stringify(m.defines ?? {}), f('map'), f('vertexColors'), f('side'), f('transparent'), f('alphaTest'), f('fog'),
    f('flatShading'), f('emissiveMap'), f('normalMap'), f('alphaMap'), f('aoMap'), f('lightMap'), f('envMap'), f('premultipliedAlpha'), f('dithering'), receiveShadow ? 'rs' : ''].join('|');
}

type MeshLike = { isMesh?: boolean; material: any; receiveShadow?: boolean; geometry?: unknown };
type Root = { traverse(fn: (o: any) => void): void };
const meshesOf = (root: Root): MeshLike[] => { const out: MeshLike[] = []; root.traverse(o => { if (o.isMesh && o.material) out.push(o); }); return out; };
const materialsOf = (mesh: MeshLike): Mat[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** Which dissolve program variants are compiled. */
export class DissolveWarmth {
  readonly warm = new Set<string>();
  private readonly pending = new Set<string>();
  /** Keep the warming clones: a program is freed when its last material is disposed. */
  private readonly keep: unknown[] = [];
  /** Keys of `roots`' materials not yet compiled (or compiling). */
  cold(roots: readonly Root[]): Map<string, { mesh: MeshLike; material: Mat }> {
    const out = new Map<string, { mesh: MeshLike; material: Mat }>();
    for (const root of roots) for (const mesh of meshesOf(root)) for (const material of materialsOf(mesh)) {
      const key = warmKey(material, !!mesh.receiveShadow);
      if (!this.warm.has(key) && !out.has(key)) out.set(key, { mesh, material });
    }
    return out;
  }
  /**
   * Compile `cold`'s dissolve variants off the frame: `makeMesh(geometry, clone, receiveShadow)` builds a stand-in
   * mesh, `compile(group)` compiles it (sharedFrame.compileAsync). Keys already compiling are skipped.
   */
  warmUp(cold: Map<string, { mesh: MeshLike; material: Mat }>, makeGroup: (items: { geometry: unknown; material: Mat; receiveShadow: boolean }[]) => unknown, compile: (group: unknown) => Promise<void>): Promise<void> {
    const items: { geometry: unknown; material: Mat; receiveShadow: boolean }[] = [], keys: string[] = [];
    const band: Band = { lo: { value: 0 }, hi: { value: 2 } };
    for (const [key, { mesh, material }] of cold) {
      if (this.pending.has(key)) continue;
      this.pending.add(key); keys.push(key);
      const clone = dissolveClone(material, band);
      this.keep.push(clone);
      items.push({ geometry: mesh.geometry, material: clone, receiveShadow: !!mesh.receiveShadow });
    }
    if (!items.length) return Promise.resolve();
    const done = () => { for (const key of keys) { this.pending.delete(key); this.warm.add(key); } };
    return compile(makeGroup(items)).then(done, done);
  }
}

type Fade = { incoming: Root; outgoing: Root; start: number; band: { in: Band; out: Band }; swapped: [MeshLike, unknown][]; done: () => void };

/**
 * The running level dissolves, keyed by owner (a landmark entry). `start` puts dissolve clones on both levels' meshes;
 * `step` advances them and, at the end, gives every mesh still wearing a clone its own material back and calls `done`
 * (the owner removes the outgoing level). `finish` ends one at once (a new swap, a drop), `flush` all.
 */
export class LevelDissolves<K> {
  private readonly fades = new Map<K, Fade>();
  constructor(private readonly ms = LEVEL_DISSOLVE_MS) {}
  has(key: K): boolean { return this.fades.has(key); }
  get size(): number { return this.fades.size; }
  start(key: K, incoming: Root, outgoing: Root, done: () => void, now = performance.now()): void {
    this.finish(key);
    const band = { in: { lo: { value: 0 }, hi: { value: 0 } }, out: { lo: { value: 0 }, hi: { value: 2 } } };
    const swapped: [MeshLike, unknown][] = [];
    const dress = (root: Root, b: Band) => {
      const cache = new Map<unknown, Mat>();
      const one = (m: Mat) => { let c = cache.get(m); if (!c) { c = dissolveClone(m, b); cache.set(m, c); } return c; };
      for (const mesh of meshesOf(root)) {
        swapped.push([mesh, mesh.material]);
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(one) : one(mesh.material);
      }
    };
    dress(incoming, band.in); dress(outgoing, band.out);
    this.fades.set(key, { incoming, outgoing, start: now, band, swapped, done });
  }
  /** Advance every dissolve; true while any is running. */
  step(now = performance.now()): boolean {
    for (const [key, f] of this.fades) {
      const t = (now - f.start) / this.ms;
      if (t < 1) { const v = Math.max(0, t); f.band.in.hi.value = v; f.band.out.lo.value = v; continue; }
      this.finish(key);
    }
    return this.fades.size > 0;
  }
  /** End `key`'s dissolve now: originals back on, `done` called. */
  finish(key: K): void {
    const f = this.fades.get(key);
    if (!f) return;
    this.fades.delete(key);
    for (const [mesh, original] of f.swapped) {
      const was = mesh.material;
      const ours = Array.isArray(was) ? was.every((m: Mat) => m?.userData?.lodDissolve) : was?.userData?.lodDissolve;
      // A material changed under the dissolve (a highlight) is the owner's: keep it.
      if (ours) mesh.material = original;
    }
    f.done();
  }
  flush(): void { for (const key of [...this.fades.keys()]) this.finish(key); }
}
