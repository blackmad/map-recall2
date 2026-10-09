// The game's facade chunks on a lit three.js material, for the shared frame.
//
// Same attributes and texture arrays as the unlit RawShaderMaterial in
// threeBuildingsBrowser.ts (and the renderer spike's facadeMaterial.ts), plus
// everything the game's version needs that the spike's did not:
// - `hidden`: 1 = suppressed (a landmark model replaces it), 2 = the answer,
//   drawn in the game's highlight yellow; suppressed walls also stay out of
//   the shadow map, or a replaced building would still cast its old shadow;
// - `cityFade`: the screen-door emergence after the overview;
// - `flatColour`: the untextured look.
// The baked per-wall shade (tint.a) is dropped: the sun and sky do it now.
// `bands` (the cartoon look's quantised shade) has no lit equivalent yet and
// is accepted but ignored.
//
// No normal attribute: chunk quads are flat, so `flatShading` derives the
// face normal from screen derivatives. The CPU copies of positions are freed
// after upload, so computing vertex normals is not an option anyway.
//
// THREE is injected (the page's shared copy) so bundles that use this do not
// carry their own three.js.

export type FacadeUniforms = {
  cells: { value: any };
  masks: { value: any };
  bands: { value: number };
  flatColour: { value: number };
  cityFade: { value: number };
};

export const HIGHLIGHT_LINEAR = [1.0, 0.637, 0.0137] as const; // #ffd21f in linear

const VERTEX_DECLS = /* glsl */ `
attribute float layer;
attribute vec4 tint;
attribute vec4 accent;
attribute float hidden;
varying vec2 vFacUv;
flat varying float vLayer;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;`;

const VERTEX_BODY = /* glsl */ `
vFacUv = uv; vLayer = layer; vTint = tint.rgb; vAccent = accent.rgb;
vHighlight = hidden > 1.5 ? 1.0 : 0.0;`;

/** Moves a suppressed vertex outside the clip volume (same trick as the unlit shader). */
const VERTEX_HIDE = /* glsl */ `
if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`;

export function createLitFacadeMaterial(THREE: any, uniforms?: Partial<FacadeUniforms>): any {
  const shared: FacadeUniforms = {
    cells: uniforms?.cells ?? { value: null },
    masks: uniforms?.masks ?? { value: null },
    bands: uniforms?.bands ?? { value: 0 },
    flatColour: uniforms?.flatColour ?? { value: 0 },
    cityFade: uniforms?.cityFade ?? { value: 1 },
  };
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.FrontSide, flatShading: true });
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.cells = shared.cells;
    shader.uniforms.masks = shared.masks;
    shader.uniforms.flatColour = shared.flatColour;
    shader.uniforms.cityFade = shared.cityFade;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERTEX_DECLS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${VERTEX_BODY}`)
      .replace('#include <project_vertex>', `#include <project_vertex>${VERTEX_HIDE}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
uniform float flatColour;
uniform float cityFade;
varying vec2 vFacUv;
flat varying float vLayer;
varying vec3 vTint;
varying vec3 vAccent;
flat varying float vHighlight;
float facadeLuma;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (cityFade < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= cityFade) discard;`)
      .replace('#include <map_fragment>', `
vec3 fp = vec3(vFacUv, vLayer);
vec3 fc = texture(cells, fp).rgb;
vec2 fm = texture(masks, fp).rg;
fc *= mix(vec3(1.0), vTint, fm.r) * mix(vec3(1.0), vAccent, fm.g);
if (flatColour > 0.5) fc = vTint;
facadeLuma = dot(fc, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= vHighlight > 0.5 ? vec3(${HIGHLIGHT_LINEAR.join(', ')}) : pow(fc, vec3(2.2));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(0.32, 0.92, smoothstep(0.06, 0.2, facadeLuma));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vHighlight > 0.5) totalEmissiveRadiance += vec3(${HIGHLIGHT_LINEAR.join(', ')}) * 0.45;`);
  };
  material.customProgramCacheKey = () => 'shared-frame-facade-v1';
  // The facade layer reads and writes these like a ShaderMaterial's uniforms.
  material.uniforms = shared;
  material.userData.litFacade = true;
  return material;
}

/** Shadow-pass material that honours `hidden` (suppressed walls cast nothing). */
export function createFacadeDepthMaterial(THREE: any): any {
  // Same settings as three's own shadow depth material (r185 shadow maps are depth textures).
  const material = new THREE.MeshDepthMaterial();
  material.onBeforeCompile = (shader: any) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float hidden;`)
      .replace('#include <project_vertex>', `#include <project_vertex>${VERTEX_HIDE}`);
  };
  material.customProgramCacheKey = () => 'shared-frame-facade-depth-v1';
  return material;
}
