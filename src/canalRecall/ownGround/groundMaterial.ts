/**
 * The own ground's shader edits, one program per material kind (lane materials 2026-10-31, #129 programs budget).
 *
 * Every ground material compiles the same edits, and the per-cell variants (the dissolve of an arriving cell, the water
 * cut) differ only in their uniforms, so they share the base material's program instead of compiling a twin. Before
 * this, `-ownFade` and `cut3-<channel>` were part of `customProgramCacheKey`: 20 own-ground programs on a ride, where
 * the base kinds need 10.
 *
 * three.js (r185) keys a program by `customProgramCacheKey()` plus the material's parameters, and calls each
 * material's own `onBeforeCompile` once, keeping the uniforms it sets per material: a clone that sets other uniform
 * objects with an identical shader source and key reuses the program and draws with its own values.
 */

/** A uniform the shader edits read. */
export interface Uniform<T = unknown> { value: T }

/** The shader object `onBeforeCompile` receives (the parts the edits touch). */
export interface ShaderSource { vertexShader: string; fragmentShader: string; uniforms: Record<string, Uniform> }

/** The material surface the edits use (a three.js Material). */
export interface GroundShaderMaterial {
  type: string;
  onBeforeCompile: (shader: any, renderer: any) => void;
  customProgramCacheKey: () => string;
  clone(): any;
}

/** The dissolve of a material that is not fading: fully present. Never written. */
export const OPAQUE_FADE: Readonly<Uniform<number>> = Object.freeze({ value: 1 });

/** The screen-door dissolve (`ownFade` 0 → 1); a compare and no hash when `ownFade` is 1. */
const FADE_GLSL = 'if (ownFade < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > ownFade) discard;';

/** The overview → city blend a ground material takes (OwnGround.blendMaterial). */
export interface GroundBlend {
  blend: Uniform<number>;
  presence: Uniform<number>;
  /** The flat palette tone (sRGB 0..1), or 'vertex' for the material's own vertex colour. */
  flat: readonly number[] | 'vertex';
}

/**
 * Install the ground's shader edits on a base material: the dissolve (uniform `ownFade`, 1 by default) and, with
 * `blend`, the overview crossfade. Sets `customProgramCacheKey` to one key per kind.
 */
export function groundProgram(m: GroundShaderMaterial, blend: GroundBlend | null): void {
  const vertex = blend?.flat === 'vertex';
  const tone = blend ? { value: vertex ? [0, 0, 0] : [...(blend.flat as readonly number[])] } : null;
  m.onBeforeCompile = (shader: ShaderSource) => {
    shader.uniforms.ownFade = OPAQUE_FADE as Uniform;
    let common = '#include <common>\nuniform float ownFade;';
    let fragment = shader.fragmentShader;
    if (blend && tone) {
      shader.uniforms.ownBlend = blend.blend;
      shader.uniforms.ownPresence = blend.presence;
      shader.uniforms.ownFlat = tone;
      common += '\nuniform float ownBlend;\nuniform float ownPresence;\nuniform vec3 ownFlat;';
      const flatExpr = vertex ? 'pow(max(vColor.rgb, vec3(0.0)), vec3(1.0 / 2.2))' : 'ownFlat';
      fragment = fragment.replace('#include <dithering_fragment>', `#include <dithering_fragment>\nif (ownBlend < 1.0) gl_FragColor.rgb = mix(${flatExpr}, gl_FragColor.rgb, ownBlend);\ngl_FragColor.a = ownPresence;`);
    }
    shader.fragmentShader = fragment.replace('#include <common>', common)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FADE_GLSL}`);
  };
  const key = blend ? `ownGround-blend3-${m.type}-${vertex ? 'vc' : 'flat'}` : `ownGround-fade-${m.type}`;
  m.customProgramCacheKey = () => key;
}

/**
 * A per-cell clone of `source` that dissolves by `fade.value` (0 → 1). Same program as the source (the dissolve is
 * compiled into every ground program); only the `ownFade` uniform differs.
 */
export function fadeClone<M extends GroundShaderMaterial>(source: M, fade: Uniform<number>): M {
  const m = source.clone() as M;
  m.onBeforeCompile = (shader: ShaderSource, renderer: unknown) => {
    source.onBeforeCompile(shader, renderer);
    shader.uniforms.ownFade = fade as Uniform;
  };
  m.customProgramCacheKey = () => source.customProgramCacheKey();
  return m;
}
