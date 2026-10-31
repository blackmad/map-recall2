/**
 * The own ground's shader edits, one program per material kind (lane materials 2026-10-31, #129 programs budget).
 *
 * Every ground material compiles the same edits, and the per-cell variants (the dissolve of an arriving cell, the water
 * cut by the cell's water mask) differ only in their uniforms, so they share the base material's program instead of compiling a twin. Before
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

/**
 * The water cut every ground program carries: a fragment inside the cell's mask extent whose channel
 * (`dot(texel, maskChannel)`, R = water, G = water minus decks) is under 0.5 is discarded. A material that is not cut
 * keeps these defaults: an extent nowhere near the city (`vMaskUV` is never inside 0..1), so the mask is never sampled.
 */
export const NO_CUT: Readonly<CutUniforms> = Object.freeze({
  waterMask: Object.freeze({ value: null }),
  maskOrigin: Object.freeze({ value: Object.freeze([1e7, 1e7]) }),
  maskSize: Object.freeze({ value: Object.freeze([1, 1]) }),
  maskChannel: Object.freeze({ value: Object.freeze([0, 0, 0, 0]) }),
});

/** A cell's cut: its mask texture and extent (scene metres), and the channel as a vec4 selector. */
export interface CutUniforms {
  waterMask: Uniform<unknown>;
  maskOrigin: Uniform<unknown>;
  maskSize: Uniform<unknown>;
  maskChannel: Uniform<unknown>;
}

/** The `maskChannel` selector of a mask channel. */
export const MASK_CHANNEL: Readonly<Record<'r' | 'g', readonly number[]>> = Object.freeze({ r: Object.freeze([1, 0, 0, 0]), g: Object.freeze([0, 1, 0, 0]) });

/** The screen-door dissolve (`ownFade` 0 → 1); a compare and no hash when `ownFade` is 1. */
const FADE_GLSL = 'if (ownFade < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > ownFade) discard;';

/**
 * Outside the mask's extent the ground is land (no cut). The discard edge is per pixel (MSAA does not smooth it); at
 * quays it is covered by the walls' coping cap (water.ts quayWallMesh, QUAY_CAP_M), which is what fixed the
 * stair-stepped, see-through seam on phones (DPR 1.5).
 */
const CUT_GLSL = 'if (vMaskUV.x > 0.0 && vMaskUV.y > 0.0 && vMaskUV.x < 1.0 && vMaskUV.y < 1.0 && dot(texture2D(waterMask, vMaskUV), maskChannel) < 0.5) discard;';

/**
 * The overview crossfade: from the flat tone (`ownFlat`, or with `ownFlatFromVertex` = 1 the vertex colour in sRGB) to
 * the lit ground by `ownBlend`; alpha is `ownPresence`. The flat/vertex choice is a uniform (mix by exactly 0 or 1,
 * so either side is bit-identical to the old per-kind expression), one program for both.
 */
const BLEND_GLSL = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
vec3 ownFlatTone = mix(ownFlat, pow(max(vColor.rgb, vec3(0.0)), vec3(1.0 / 2.2)), ownFlatFromVertex);
#else
vec3 ownFlatTone = ownFlat;
#endif
if (ownBlend < 1.0) gl_FragColor.rgb = mix(ownFlatTone, gl_FragColor.rgb, ownBlend);
gl_FragColor.a = ownPresence;`;

/** The overview → city blend a ground material takes (OwnGround.blendMaterial). */
export interface GroundBlend {
  blend: Uniform<number>;
  presence: Uniform<number>;
  /** The flat palette tone (sRGB 0..1), or 'vertex' for the material's own vertex colour. */
  flat: readonly number[] | 'vertex';
}

/**
 * Install the ground's shader edits on a base material: the water cut (uniforms, off by default), the dissolve
 * (uniform `ownFade`, 1 by default) and, with
 * `blend`, the overview crossfade. Sets `customProgramCacheKey` to one key per kind.
 */
export function groundProgram(m: GroundShaderMaterial, blend: GroundBlend | null): void {
  const vertex = blend?.flat === 'vertex';
  const tone = blend ? { value: vertex ? [0, 0, 0] : [...(blend.flat as readonly number[])] } : null;
  const fromVertex = { value: vertex ? 1 : 0 };
  m.onBeforeCompile = (shader: ShaderSource) => {
    shader.uniforms.ownFade = OPAQUE_FADE as Uniform;
    Object.assign(shader.uniforms, NO_CUT);
    // The mask UV is formed per vertex (0..1, highp): scene metres reach ±15 km city-wide, too coarse for a mediump
    // varying on a phone GPU.
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying highp vec2 vMaskUV;\nuniform vec2 maskOrigin;\nuniform vec2 maskSize;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMaskUV = (transformed.xy - maskOrigin) / maskSize;');
    let common = '#include <common>\nuniform float ownFade;\nvarying highp vec2 vMaskUV;\nuniform sampler2D waterMask;\nuniform vec4 maskChannel;';
    let fragment = shader.fragmentShader;
    if (blend && tone) {
      shader.uniforms.ownBlend = blend.blend;
      shader.uniforms.ownPresence = blend.presence;
      shader.uniforms.ownFlat = tone;
      shader.uniforms.ownFlatFromVertex = fromVertex;
      common += '\nuniform float ownBlend;\nuniform float ownPresence;\nuniform vec3 ownFlat;\nuniform float ownFlatFromVertex;';
      fragment = fragment.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${BLEND_GLSL}`);
    }
    shader.fragmentShader = fragment.replace('#include <common>', common)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT_GLSL}\n${FADE_GLSL}`);
  };
  const key = `ownGround-ground4-${m.type}${blend ? '-blend' : ''}`;
  m.customProgramCacheKey = () => key;
}

/**
 * A per-cell clone of `source` cut by the cell's water mask (`cut`, with the layer's channel). Same program as the
 * source; only the mask uniforms differ.
 */
export function cutClone<M extends GroundShaderMaterial>(source: M, cut: Omit<CutUniforms, 'maskChannel'>, channel: 'r' | 'g'): M {
  const m = source.clone() as M;
  const maskChannel = { value: MASK_CHANNEL[channel] };
  m.onBeforeCompile = (shader: ShaderSource, renderer: unknown) => {
    source.onBeforeCompile(shader, renderer);
    Object.assign(shader.uniforms, cut, { maskChannel });
  };
  m.customProgramCacheKey = () => source.customProgramCacheKey();
  return m;
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
