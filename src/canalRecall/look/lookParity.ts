/**
 * Look parity: do a landmark, a recipe house and a generic extrusion with the
 * same mid-grey brick land at the same brightness under the shared light rig?
 *
 * The complaint class this guards ("is this building really this dark?",
 * "unlit against the shaded city", 2026-10) came from three pipelines each
 * lighting brick its own way: the streamed city bakes a fixed shade into
 * vertex colour, recipe houses had their own baked shader, landmarks their own
 * three-light rig. Under `?sharedFrame=1` all three are meant to answer to one
 * sun and one sky (rendererShared/lightRig.ts). This renders one wall per
 * pipeline per orientation with the real materials and the real rig, and
 * reports the mean sRGB luma of each (docs/LOOK.md, "Parity").
 *
 * Browser only (WebGL2). `tests/e2e/look-parity.spec.ts` bundles this file,
 * runs it in Chrome and asserts the spread; the pure helpers are unit-tested
 * in `lookParity.test.ts`.
 */
import * as THREE from 'three';
import { createLightRig, DEFAULT_LIGHT_RIG } from '../rendererShared/lightRig.js';
import { createLitFacadeMaterial } from '../rendererShared/litFacadeMaterial.js';
import { createRecipeLook } from '../buildingRecipe/recipeLook.js';
import { normaliseLandmarkMaterials } from '../landmarks/landmarkShading.js';
import { buildLookTextures, VERTEX as FACADE_VERTEX, FRAGMENT as FACADE_FRAGMENT } from '../threeBuildingsBrowser.js';
import { bayLayer } from '../bayLook.js';
import { wallShade } from '../threeBuildingMesh.js';
import { BRICK_CELL_MEAN, LOOK_VARIANTS, cityTint, hexToRgb } from './palette.js';
import { litFacadeWallGain, srgbToLinear } from './sunny.js';
import type { WallExposure } from './chunkWallExposure.js';
import { createCityLook, createCityLookMaterial, createCityUniforms, paintSlotLayers } from './cityLook.js';
import { faceNormal, lumaSpread, meanLuma, PARITY_FACES, type ParityFace, type ParityResult } from './lookParityMath.js';

export { lumaSpread, PARITY_FACES };
export type { ParityFace, ParityResult };

export type ParityPipeline = 'generic' | 'recipe' | 'landmark' | 'generic-unlit' | 'recipe-unlit'
  | 'city-generic' | 'city-recipe' | 'city-landmark' | 'city-generic-unlit' | 'city-recipe-unlit' | 'city-landmark-unlit'
  | 'landmark-highlight' | 'city-landmark-highlight' | 'city-landmark-highlight-unlit'
  | 'chunk' | 'recipe-measured';
export const SHARED_PIPELINES: readonly ParityPipeline[] = ['generic', 'recipe', 'landmark'];
/**
 * `?cityLook=1` (look/cityLook.ts): the same three pipelines through the one
 * city-look shader and one texture array. The landmark is an untagged GLB
 * material named `brick` with no UVs, as every legacy landmark is: its slot is
 * inferred and its UVs box-projected, exactly the game path.
 */
export const CITY_PIPELINES: readonly ParityPipeline[] = ['city-generic', 'city-recipe', 'city-landmark'];
export const CITY_UNLIT_PIPELINES: readonly ParityPipeline[] = ['city-generic-unlit', 'city-recipe-unlit', 'city-landmark-unlit'];
/**
 * The active-landmark highlight: the default one (the model's own material plus a
 * yellow glow, signature-landmarks-source.js `setActiveLandmark`) and the city
 * look's highlight variant, lit and unlit. Their sun/shade ratio says whether the
 * yellow keeps the shading (docs/LOOK.md "City look").
 */
export const HIGHLIGHT_PIPELINES: readonly ParityPipeline[] = ['landmark-highlight', 'city-landmark-highlight', 'city-landmark-highlight-unlit'];
/** signature-landmarks-source.js HIGHLIGHT_COLOUR. */
const HIGHLIGHT_HEX = 0xffd21f;

const SIZE = 96;

/** The exposure record of a chunk whose strip wall measured `hex` under no recorded white (build-chunk-wall-exposure.ts). */
export function chunkExposureForMeasured(hex: string): WallExposure {
  const lin = (c: readonly number[]) => srgbToLinear(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
  return { white: null, stripOverDrawn: lin(hexToRgb(hex)) / lin(hexToRgb(cityTint('brick', hex)).map(v => v * BRICK_CELL_MEAN)) };
}
const WALL_M = 10;

/** One quad, WALL_M square, centred on the origin, facing `normal` (ENU, horizontal). */
function wallGeometry(normal: [number, number, number], uvScale: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(WALL_M, WALL_M);
  // Plane faces +z; rotateX(+90°) stands it up facing -y (south), then turn it to the normal azimuth.
  g.rotateX(Math.PI / 2);
  g.rotateZ(Math.atan2(normal[1], normal[0]) + Math.PI / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  return g;
}

function facadeAttributes(g: THREE.BufferGeometry, hex: string, layer: number, shade: number): void {
  const n = g.getAttribute('position').count, [r, gg, b] = hexToRgb(hex);
  const tint = new Uint8Array(n * 4), accent = new Uint8Array(n * 4).fill(255);
  for (let i = 0; i < n; i++) tint.set([r, gg, b, Math.round(shade * 255)], i * 4);
  g.setAttribute('layer', new THREE.BufferAttribute(new Float32Array(n).fill(layer), 1));
  g.setAttribute('tint', new THREE.BufferAttribute(tint, 4, true));
  g.setAttribute('accent', new THREE.BufferAttribute(accent, 4, true));
  g.setAttribute('hidden', new THREE.BufferAttribute(new Uint8Array(n), 1, false));
}

export type ParityOptions = {
  hex?: string; brickUrl?: string; pipelines?: readonly ParityPipeline[];
  /**
   * Shadows on (docs/LOOK.md §Light "Shadow fill"): the rig's sun casts, and
   * with `caster` an invisible slab between the wall and the sun puts the
   * whole wall in cast shadow. `shadowIntensity` overrides the rig's.
   * Chunk walls (generic, city-generic) lose their normal attribute, as the
   * game's facade chunks have none.
   */
  shadow?: { caster: boolean; shadowIntensity?: number };
};

/** Render each pipeline's wall for each face under the shared rig; mean sRGB luma (0..255) of the wall. */
export async function runLookParity(options: ParityOptions = {}): Promise<ParityResult> {
  const hex = options.hex ?? '#808080';
  const pipelines = options.pipelines ?? [...SHARED_PIPELINES, 'generic-unlit', 'recipe-unlit'];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  // Same output as the shared frame's renderer: sRGB, no tone mapping.
  renderer.toneMapping = THREE.NoToneMapping;
  if (options.shadow) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; }

  let brick: HTMLImageElement | null = null;
  if (options.brickUrl) {
    brick = new Image(); brick.src = options.brickUrl;
    try { await brick.decode(); } catch { brick = null; }
  }
  const cells = await buildLookTextures(THREE, 'photo', 1);
  const plainLayer = bayLayer('canal', 0, 'plain');
  const recipeLit = createRecipeLook(THREE, { brick, lit: true, anisotropy: 1, cityLook: false });
  const recipeUnlit = createRecipeLook(THREE, { brick, lit: false, anisotropy: 1, cityLook: false });
  recipeUnlit.enuFromWorld.value.identity();
  // City look: the facades' photo array with the slot layers appended, bound for slot meshes too (shared frame: one texture).
  const wantsCity = pipelines.some(p => p.startsWith('city-'));
  const city = wantsCity ? createCityLook(THREE, { brick, size: 256, anisotropy: 1 }) : null;
  let cityCells: { colour: any; mask: any; slotBase: number } | null = null;
  if (city) {
    await city.ready;
    cityCells = await buildLookTextures(THREE, 'photo', 1, 256, { slotLayers: paintSlotLayers(document, brick, 256) });
    city.bindAtlas(cityCells);
    city.uniforms.enuFromWorld.value.identity();
  }

  const shadow = options.shadow;
  const out: ParityResult = { hex, rig: { ...DEFAULT_LIGHT_RIG, shadows: !!shadow, ...(shadow?.shadowIntensity !== undefined ? { shadowIntensity: shadow.shadowIntensity } : {}) }, walls: {} };
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  for (const face of PARITY_FACES) {
    const normal = faceNormal(face);
    for (const pipeline of pipelines) {
      const scene = new THREE.Scene();
      const rig = createLightRig(THREE, shadow ? { shadows: true, ...(shadow.shadowIntensity !== undefined ? { shadowIntensity: shadow.shadowIntensity } : {}) } : { shadows: false });
      for (const o of rig.objects) scene.add(o);
      if (shadow) {
        rig.follow([0, 0, 0], 18, abs => abs);
        if (shadow.caster) {
          // A 40 m slab across the sun's ray, 20 m out from the wall: it writes only to the shadow map.
          const caster = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
          const toSun = new THREE.Vector3(...rig.toSun);
          caster.position.copy(toSun).multiplyScalar(20);
          caster.lookAt(toSun.clone().multiplyScalar(40));
          caster.castShadow = true;
          scene.add(caster);
        }
      }
      let mesh: THREE.Mesh;
      if (pipeline === 'generic' || pipeline === 'generic-unlit') {
        // Chunk UVs: one cell per 5 m along, one per storey up; the plain brick cell, the city tint, its baked shade.
        const g = wallGeometry(normal, 1);
        const uv = g.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * WALL_M / 5, uv.getY(i) * WALL_M / 3.2);
        facadeAttributes(g, hex, plainLayer, wallShade(normal[0], normal[1]));
        const material = pipeline === 'generic'
          ? createLitFacadeMaterial(THREE, { cells: { value: cells.colour }, masks: { value: cells.mask }, wallGain: { value: litFacadeWallGain(LOOK_VARIANTS.photo.litWallGain) } })
          : new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FACADE_VERTEX, fragmentShader: FACADE_FRAGMENT, side: THREE.FrontSide,
            uniforms: { cells: { value: cells.colour }, masks: { value: cells.mask }, bands: { value: 0 }, flatColour: { value: 0 }, cityFade: { value: 1 } } });
        mesh = new THREE.Mesh(g, material);
      } else if (pipeline === 'recipe' || pipeline === 'recipe-unlit') {
        // Recipe GLB: UVs in metres, a `materialSlot: brick` material carrying the authored tint.
        const source = new THREE.MeshStandardMaterial({ color: hex });
        source.userData = { materialSlot: 'brick', tint: hex };
        mesh = new THREE.Mesh(wallGeometry(normal, WALL_M), source);
        (pipeline === 'recipe' ? recipeLit : recipeUnlit).apply(mesh);
      } else if (pipeline === 'chunk' || pipeline === 'recipe-measured') {
        // The same measured wall colour as a street chunk and as a per-house recipe (`tintSource: measured`): what each
        // draws is that colour at the look's exposure. A chunk's measured colour is its strip's (look/chunkWallExposure.ts):
        // the exposure record says the strip wall is `hex`, i.e. stripOverDrawn = lin(hex) / lin(the chunk's drawn wall).
        const source = new THREE.MeshStandardMaterial({ color: hex });
        source.userData = { materialSlot: 'brick', tint: hex, ...(pipeline === 'recipe-measured' ? { tintSource: 'measured' } : {}) };
        mesh = new THREE.Mesh(wallGeometry(normal, WALL_M), source);
        recipeLit.apply(mesh, pipeline === 'chunk' ? { wallExposure: chunkExposureForMeasured(hex) } : undefined);
      } else if (pipeline === 'city-generic' || pipeline === 'city-generic-unlit') {
        // Generic extrusion in the city look: the plain bay cell, with the tint the city gives this brick.
        const g = wallGeometry(normal, 1);
        const uv = g.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * WALL_M / 5, uv.getY(i) * WALL_M / 3.2);
        facadeAttributes(g, cityTint('brick', hex), plainLayer, wallShade(normal[0], normal[1]));
        const lit = pipeline === 'city-generic';
        const material = createCityLookMaterial(THREE, { lit, kind: 'chunk' }, createCityUniforms(THREE, {
          cells: { value: cityCells!.colour }, masks: { value: cityCells!.mask }, wallGain: { value: LOOK_VARIANTS.photo.litWallGain } }));
        mesh = new THREE.Mesh(g, material);
      } else if (pipeline === 'city-recipe' || pipeline === 'city-recipe-unlit') {
        // Recipe GLB in the city look: UVs in metres, `materialSlot: brick`.
        const source = new THREE.MeshStandardMaterial({ color: hex });
        source.userData = { materialSlot: 'brick', tint: hex };
        mesh = new THREE.Mesh(wallGeometry(normal, WALL_M), source);
        city!.dress(mesh, { lit: pipeline === 'city-recipe' });
      } else if (pipeline === 'city-landmark' || pipeline === 'city-landmark-unlit' || pipeline === 'city-landmark-highlight' || pipeline === 'city-landmark-highlight-unlit') {
        // Legacy landmark GLB in the city look: glTF Y-up, no UVs, a material named for its palette entry; placed Z-up.
        const g = wallGeometry(normal, 1);
        g.deleteAttribute('uv');
        g.rotateX(-Math.PI / 2);
        const source = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 });
        source.name = 'brick';
        mesh = new THREE.Mesh(g, source);
        mesh.rotation.x = Math.PI / 2;
        city!.dress(mesh, { lit: pipeline === 'city-landmark' || pipeline === 'city-landmark-highlight', infer: true });
        if (pipeline.includes('highlight')) mesh.material = city!.highlighted(mesh.material, true);
      } else if (pipeline === 'landmark-highlight') {
        // The game's default highlight: own colour, diffuse-only, plus half the highlight yellow as emissive.
        const material = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 });
        mesh = new THREE.Mesh(wallGeometry(normal, 1), material);
        normaliseLandmarkMaterials(THREE, mesh);
        const m = mesh.material as any;
        m.emissive?.setHex(HIGHLIGHT_HEX).multiplyScalar(0.5);
      } else {
        // Landmark GLB: flat authored colour, normalised to diffuse-only like the game does.
        mesh = new THREE.Mesh(wallGeometry(normal, 1), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 }));
        normaliseLandmarkMaterials(THREE, mesh);
      }
      if (shadow) {
        mesh.receiveShadow = true;
        if (pipeline.endsWith('generic') || pipeline.endsWith('generic-unlit')) mesh.geometry.deleteAttribute('normal');
      }
      scene.add(mesh);
      // Straight-on orthographic view from outside the wall.
      const camera = new THREE.OrthographicCamera(-WALL_M / 2, WALL_M / 2, WALL_M / 2, -WALL_M / 2, 0.1, 100);
      camera.up.set(0, 0, 1);
      camera.position.set(normal[0] * 20, normal[1] * 20, 0);
      camera.lookAt(0, 0, 0);
      renderer.setClearColor(0xff00ff, 1);
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      out.walls[`${pipeline}/${face}`] = meanLuma(pixels, SIZE, 0.15);
      mesh.geometry.dispose();
    }
  }
  renderer.dispose();
  return out;
}
