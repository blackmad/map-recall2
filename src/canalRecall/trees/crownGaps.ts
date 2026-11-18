/**
 * realLook trees (round 2): gaps through a street tree's crown at no triangle cost. The crown lobe's fragments are cut
 * where a 3D value noise in lobe space falls under `CROWN_GAPS.cut`, and the lobe draws both sides, so a gap shows the
 * crown's darker inside or the sky behind it, as an elm or plane crown does from the saddle. Seeded per instance by its
 * translation, so neighbouring trees do not share a pattern. Only the realLook foliage material is patched.
 */
export const CROWN_GAPS = { freq: 2.6, cut: 0.34, insideShade: 0.55 } as const;

export const CROWN_GAPS_VERTEX = {
  head: 'varying vec3 vCrownGapP;',
  body: '#ifdef USE_INSTANCING\n  vCrownGapP = position + instanceMatrix[3].xyz * 0.173;\n#else\n  vCrownGapP = position;\n#endif',
};

export function crownGapsFragment(g = CROWN_GAPS): { head: string; cut: string; shade: string } {
  return {
    head: `varying vec3 vCrownGapP;
float crownGapHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float crownGapNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(crownGapHash(i), crownGapHash(i + vec3(1,0,0)), f.x), mix(crownGapHash(i + vec3(0,1,0)), crownGapHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(crownGapHash(i + vec3(0,0,1)), crownGapHash(i + vec3(1,0,1)), f.x), mix(crownGapHash(i + vec3(0,1,1)), crownGapHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`,
    cut: `if (crownGapNoise(vCrownGapP * ${g.freq.toFixed(3)}) < ${g.cut.toFixed(3)}) discard;`,
    shade: `if (!gl_FrontFacing) diffuseColor.rgb *= ${g.insideShade.toFixed(3)};`,
  };
}

/** Inject the gaps into a MeshStandardMaterial's shaders (three's chunk names). Returns the shaders unchanged when a chunk is missing. */
export function injectCrownGaps(vertexShader: string, fragmentShader: string, g = CROWN_GAPS): { vertexShader: string; fragmentShader: string } {
  if (!vertexShader.includes('#include <begin_vertex>') || !fragmentShader.includes('#include <clipping_planes_fragment>') || !fragmentShader.includes('#include <color_fragment>')) return { vertexShader, fragmentShader };
  const f = crownGapsFragment(g);
  return {
    vertexShader: `${CROWN_GAPS_VERTEX.head}\n${vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${CROWN_GAPS_VERTEX.body}`)}`,
    fragmentShader: `${f.head}\n${fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${f.cut}`).replace('#include <color_fragment>', `#include <color_fragment>\n${f.shade}`)}`,
  };
}

type Mat = { onBeforeCompile?: (shader: any, renderer?: any) => void; customProgramCacheKey?: () => string; userData: Record<string, unknown>; side: number; needsUpdate: boolean };

/** Patch `material` (both sides drawn, gaps cut); chains any earlier onBeforeCompile and program cache key. */
export function patchCrownGaps<M extends Mat>(material: M, doubleSide: number, g = CROWN_GAPS): M {
  if (material.userData.crownGaps) return material;
  material.userData.crownGaps = true;
  material.side = doubleSide;
  const before = material.onBeforeCompile;
  const key = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey') ? material.customProgramCacheKey : undefined;
  material.onBeforeCompile = function (this: unknown, shader: any, renderer?: any) {
    before?.call(this, shader, renderer);
    const s = injectCrownGaps(shader.vertexShader, shader.fragmentShader, g);
    shader.vertexShader = s.vertexShader; shader.fragmentShader = s.fragmentShader;
  };
  material.customProgramCacheKey = function (this: unknown) { return `${key ? key.call(this) : ''}|crownGaps`; };
  material.needsUpdate = true;
  return material;
}
