// Tree dissolve (lane P5, #332). A tree rebuild (tile arrival, residency step, ground re-base) replaced every
// instanced draw in one frame: P2–P4 counted it as a whole-tree pop, ~29 a minute from the air, ~10 on the street.
// Trees present before and after a rebuild sit at the same place, so the swap itself is invisible; what changes on
// screen is the trees that enter (a tile arrives, the view steps) and the trees that leave. Those now dissolve over
// TREE_FADE_MS on the same screen-door hash as `cityFade` / the landmark level dissolve:
//  - each new mesh carries a per-instance `treeFade` (0 = drawn; +s = fading in since s; -s = fading out since s,
//    seconds on the fade clock);
//  - the trees a rebuild drops are drawn once more by a "leaving" mesh per group, fading out, removed at the end;
//  - instances are matched by group and trunk/lobe position (x, y to 0.1 m), so a ground re-base (z only) is no fade.
// The materials take one attribute, one varying, one uniform and a discard (program key `|treeFade`); the shadow
// twins and the depth pass keep the plain path (shadows of entering trees appear at once).
//
// `?treeFade=0` (or `window.__canalRecallTreeFade = false`) restores the one-frame rebuild; off with `?popFade=0`.
import { popFadeFlag } from '../engine/popFade.js';

export const TREE_FADE_DEFAULT = true;
export const TREE_FADE_MS = 600;

export function treeFadeFlag(): boolean {
  if (!popFadeFlag()) return false;
  const g = globalThis as { __canalRecallTreeFade?: boolean | string; location?: { search?: string } };
  // A regex, not URLSearchParams: bundles are also evaluated in Node checks without it.
  const m = /[?&]treeFade=([^&]*)/.exec(g.location?.search ?? '');
  const asked = g.__canalRecallTreeFade ?? (m ? m[1] : null);
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return TREE_FADE_DEFAULT;
}

/** One group's full instance arrays (before culling compacts them) and their fade values. */
export type GroupSnapshot = { matrices: Float32Array; colours: Float32Array | null; fades: Float32Array | null; count: number };

/** Instance identity: trunk/lobe position in the plane to 0.1 m (the lift is not part of it). */
export function instanceKey(matrices: ArrayLike<number>, i: number): string {
  return `${Math.round(matrices[16 * i + 12] * 10)},${Math.round(matrices[16 * i + 13] * 10)}`;
}

/** Whether a fade value is still running at clock `now` (seconds). */
export function fadeRunning(v: number, now: number, ms = TREE_FADE_MS): boolean {
  return v !== 0 && now - Math.abs(v) < ms / 1000;
}

export type FadeDiff = {
  /** Per new instance: its fade value (0 drawn, +now entering, or the old instance's running fade carried on). */
  fades: Float32Array;
  /** Old instance indices with no match in the new arrays (they leave). */
  leaving: number[];
  entered: number;
  kept: number;
};

/**
 * Match `next` against `prev` (null: the group is new). A matched instance keeps a running fade-in of its old self,
 * else is drawn; an unmatched one enters at `now`. Old instances still fading out are not carried as leaving again.
 */
export function diffGroup(prev: GroupSnapshot | null, next: Float32Array, count: number, now: number, ms = TREE_FADE_MS): FadeDiff {
  const fades = new Float32Array(count);
  const pool = new Map<string, number[]>();
  if (prev) for (let i = 0; i < prev.count; i++) {
    const v = prev.fades ? prev.fades[i] : 0;
    if (v < 0) continue; // already leaving
    const k = instanceKey(prev.matrices, i);
    const list = pool.get(k);
    if (list) list.push(i); else pool.set(k, [i]);
  }
  let entered = 0, kept = 0;
  for (let i = 0; i < count; i++) {
    const list = pool.get(instanceKey(next, i));
    const j = list?.pop();
    if (j === undefined) { fades[i] = now; entered++; continue; }
    const v = prev!.fades ? prev!.fades[j] : 0;
    fades[i] = v > 0 && fadeRunning(v, now, ms) ? v : 0;
    kept++;
  }
  const leaving: number[] = [];
  for (const list of pool.values()) for (const j of list) leaving.push(j);
  leaving.sort((a, b) => a - b);
  return { fades, leaving, entered, kept };
}

/** The leaving instances of `prev` as compact arrays (matrices, colours) with fade-out values from `now`. */
export function leavingArrays(prev: GroupSnapshot, leaving: readonly number[], now: number): { matrices: Float32Array; colours: Float32Array | null; fades: Float32Array } {
  const n = leaving.length, matrices = new Float32Array(16 * n), colours = prev.colours ? new Float32Array(3 * n) : null, fades = new Float32Array(n);
  leaving.forEach((j, k) => {
    matrices.set(prev.matrices.subarray(16 * j, 16 * j + 16), 16 * k);
    if (colours && prev.colours) colours.set(prev.colours.subarray(3 * j, 3 * j + 3), 3 * k);
    fades[k] = -now;
  });
  return { matrices, colours, fades };
}

/** The fade clock in seconds (offset so that 0 never means "now"). */
export function fadeClock(nowMs = performance.now()): number { return nowMs / 1000 + 1; }

const VERT_DECL = 'attribute float treeFade;\nvarying float vTreeFade;\n';
const FRAG_DECL = 'uniform float treeFadeNow;\nvarying float vTreeFade;\n';
const FRAG_DISCARD = '\n{ float tfStart = abs(vTreeFade); if (tfStart > 0.0) {'
  + ' float tfT = clamp((treeFadeNow - tfStart) * TREE_FADE_RATE, 0.0, 1.0);'
  + ' float tfHash = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296)));'
  + ' if (vTreeFade > 0.0 ? tfHash >= tfT : tfHash < tfT) discard; } }\n';
const MAIN = /void\s+main\s*\(\s*(?:void\s*)?\)\s*\{/;

function inject(src: string, decl: string, body: string): string {
  const m = MAIN.exec(src);
  if (!m) return src;
  return `${decl}${src.slice(0, m.index + m[0].length)}${body}${src.slice(m.index + m[0].length)}`;
}

/** Vertex and fragment sources with the fade added (exported for the shader-shape test). */
export function injectTreeFade(vertexShader: string, fragmentShader: string, ms = TREE_FADE_MS): { vertexShader: string; fragmentShader: string } {
  return {
    vertexShader: inject(vertexShader, VERT_DECL, '\nvTreeFade = treeFade;\n'),
    fragmentShader: inject(fragmentShader, `#define TREE_FADE_RATE ${(1000 / ms).toFixed(6)}\n${FRAG_DECL}`, FRAG_DISCARD),
  };
}

type Mat = { onBeforeCompile?: (shader: any, renderer?: any) => void; customProgramCacheKey?: () => string; userData: Record<string, unknown>; needsUpdate?: boolean };

/** Add the fade to `material` (chains its own hooks; idempotent). `now` is the shared clock uniform. */
export function patchTreeFadeMaterial<M extends Mat>(material: M, now: { value: number }, ms = TREE_FADE_MS): M {
  if (material.userData.treeFade) return material;
  material.userData.treeFade = true;
  const before = material.onBeforeCompile;
  // three's default key is onBeforeCompile's source; only a key the material set itself is kept.
  const key = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey') ? material.customProgramCacheKey : undefined;
  material.onBeforeCompile = function (this: unknown, shader: any, renderer?: any) {
    before?.call(this, shader, renderer);
    shader.uniforms.treeFadeNow = now;
    const s = injectTreeFade(shader.vertexShader, shader.fragmentShader, ms);
    shader.vertexShader = s.vertexShader; shader.fragmentShader = s.fragmentShader;
  };
  material.customProgramCacheKey = function (this: unknown) { return `${key ? key.call(this) : ''}|treeFade`; };
  material.needsUpdate = true;
  return material;
}

/**
 * A geometry sharing `shared`'s attributes and index (one GPU copy) with its own `treeFade` instanced attribute.
 * Free it with `releaseFadeGeometry`, never `dispose()` alone (that would free the shared buffers).
 */
export function fadeGeometry(THREE: any, shared: any, fades: Float32Array): any {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(shared.attributes)) g.setAttribute(name, attr);
  if (shared.index) g.setIndex(shared.index);
  g.boundingSphere = shared.boundingSphere; g.boundingBox = shared.boundingBox;
  if (!g.boundingSphere) { shared.computeBoundingSphere?.(); g.boundingSphere = shared.boundingSphere; }
  g.groups = shared.groups;
  g.setAttribute('treeFade', new THREE.InstancedBufferAttribute(fades, 1));
  g.userData.treeFadeShared = shared;
  return g;
}

/** Dispose only what `fadeGeometry` made: detach the shared attributes and index first. */
export function releaseFadeGeometry(g: any): void {
  const shared = g.userData?.treeFadeShared;
  if (shared) {
    for (const name of Object.keys(shared.attributes)) g.deleteAttribute(name);
    g.index = null;
  }
  g.dispose();
}
