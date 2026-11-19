/**
 * The city look's shader window grid on a raw GLB in a building-page gallery (feedback 13fa7f, "Why not all parts
 * textured?", Politiepost IJburg on manual-ordinary-buildings.html).
 *
 * A large recipe's unphotographed walls stay one blank quad per panel in the GLB; their material carries the
 * `windowGrid` extra and the ride's slot shader paints a window per 3.0 m bay and 3.2 m storey (cityLook.ts,
 * otherWalls.ts). The galleries load the GLB with a plain GLTFLoader, so those walls drew as bare brick there: the
 * page showed less than the ride. This patches each such material (GLTFLoader puts the extras in `userData`) to mix
 * the same window into its diffuse colour from the GLB's metre UVs. No three import: it works on duck-typed
 * materials so the page's own three build compiles it.
 */
import { SLOT_CELL, type MaterialSlot } from './palette.ts';
import { WINDOW_GRID_GLSL } from './windowGridGlsl.ts';

/** The cells the city shader paints the grid on (cityLook.ts, glbRaster/windowGrid.ts GRID_CELLS). */
const GRID_CELLS: ReadonlySet<string> = new Set(['brick', 'stucco', 'stone']);

/** True when the ride paints the window grid on a material with these glTF extras. */
export function wantsWindowGrid(extras: unknown): boolean {
  if (!extras || typeof extras !== 'object') return false;
  const e = extras as Record<string, unknown>, slot = e.materialSlot;
  return e.windowGrid === true && typeof slot === 'string' && GRID_CELLS.has(SLOT_CELL[slot as MaterialSlot]);
}

type Shader = { vertexShader: string; fragmentShader: string };
type GridMaterial = {
  userData?: Record<string, unknown>;
  onBeforeCompile?: (shader: Shader, renderer?: unknown) => void;
  customProgramCacheKey?: () => string;
  needsUpdate?: boolean;
};

const VERTEX_DECL = 'varying vec2 vGridM;\n';
/** The gallery fragment: the wall colour in sRGB, the grid mixed in, back to linear (the city shader's pow 2.2). */
const FRAGMENT_APPLY = /* glsl */ `
{
  vec3 gridC = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  vec2 gridMk = vec2(1.0);
  cityWindowGrid(vGridM, gridC, gridMk);
  diffuseColor.rgb = pow(gridC, vec3(2.2));
}`;

/** Patch one shader in place (exported for the test). Returns false when a hook it needs is missing. */
export function patchWindowGridShader(shader: Shader): boolean {
  const v = shader.vertexShader, f = shader.fragmentShader;
  if (!v.includes('#include <common>') || !v.includes('#include <begin_vertex>') || !f.includes('#include <common>') || !f.includes('#include <color_fragment>')) return false;
  shader.vertexShader = v.replace('#include <common>', `#include <common>\n${VERTEX_DECL}`).replace('#include <begin_vertex>', '#include <begin_vertex>\nvGridM = uv;');
  shader.fragmentShader = f.replace('#include <common>', `#include <common>\n${VERTEX_DECL}${WINDOW_GRID_GLSL}\n`).replace('#include <color_fragment>', `#include <color_fragment>${FRAGMENT_APPLY}`);
  return true;
}

/** Give one material the grid when its extras ask for it; true when patched. Idempotent. */
export function applyWindowGrid(material: GridMaterial): boolean {
  if (!wantsWindowGrid(material.userData) || material.userData?.galleryWindowGrid) return false;
  const prior = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => { prior?.call(material, shader, renderer); patchWindowGridShader(shader); };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}|windowGrid`;
  material.userData!.galleryWindowGrid = true;
  material.needsUpdate = true;
  return true;
}

type Node = { material?: GridMaterial | GridMaterial[]; traverse?: (fn: (o: Node) => void) => void };

/** Walk a loaded GLB scene and patch every window-grid wall; returns how many materials were patched. */
export function applyWindowGrids(root: Node): number {
  let n = 0;
  root.traverse?.(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (applyWindowGrid(m)) n++; });
  return n;
}
