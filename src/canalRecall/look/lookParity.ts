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
import { LOOK_VARIANTS, hexToRgb } from './palette.js';
import { faceNormal, lumaSpread, meanLuma, PARITY_FACES, type ParityFace, type ParityResult } from './lookParityMath.js';

export { lumaSpread, PARITY_FACES };
export type { ParityFace, ParityResult };

export type ParityPipeline = 'generic' | 'recipe' | 'landmark' | 'generic-unlit' | 'recipe-unlit';
export const SHARED_PIPELINES: readonly ParityPipeline[] = ['generic', 'recipe', 'landmark'];

const SIZE = 96;
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

export type ParityOptions = { hex?: string; brickUrl?: string; pipelines?: readonly ParityPipeline[] };

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

  let brick: HTMLImageElement | null = null;
  if (options.brickUrl) {
    brick = new Image(); brick.src = options.brickUrl;
    try { await brick.decode(); } catch { brick = null; }
  }
  const cells = await buildLookTextures(THREE, 'photo', 1);
  const plainLayer = bayLayer('canal', 0, 'plain');
  const recipeLit = createRecipeLook(THREE, { brick, lit: true, anisotropy: 1 });
  const recipeUnlit = createRecipeLook(THREE, { brick, lit: false, anisotropy: 1 });
  recipeUnlit.enuFromWorld.value.identity();

  const out: ParityResult = { hex, rig: { ...DEFAULT_LIGHT_RIG, shadows: false }, walls: {} };
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  for (const face of PARITY_FACES) {
    const normal = faceNormal(face);
    for (const pipeline of pipelines) {
      const scene = new THREE.Scene();
      const rig = createLightRig(THREE, { shadows: false });
      for (const o of rig.objects) scene.add(o);
      let mesh: THREE.Mesh;
      if (pipeline === 'generic' || pipeline === 'generic-unlit') {
        // Chunk UVs: one cell per 5 m along, one per storey up; the plain brick cell, the city tint, its baked shade.
        const g = wallGeometry(normal, 1);
        const uv = g.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * WALL_M / 5, uv.getY(i) * WALL_M / 3.2);
        facadeAttributes(g, hex, plainLayer, wallShade(normal[0], normal[1]));
        const material = pipeline === 'generic'
          ? createLitFacadeMaterial(THREE, { cells: { value: cells.colour }, masks: { value: cells.mask }, wallGain: { value: LOOK_VARIANTS.photo.litWallGain } })
          : new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FACADE_VERTEX, fragmentShader: FACADE_FRAGMENT, side: THREE.FrontSide,
            uniforms: { cells: { value: cells.colour }, masks: { value: cells.mask }, bands: { value: 0 }, flatColour: { value: 0 }, cityFade: { value: 1 } } });
        mesh = new THREE.Mesh(g, material);
      } else if (pipeline === 'recipe' || pipeline === 'recipe-unlit') {
        // Recipe GLB: UVs in metres, a `materialSlot: brick` material carrying the authored tint.
        const source = new THREE.MeshStandardMaterial({ color: hex });
        source.userData = { materialSlot: 'brick', tint: hex };
        mesh = new THREE.Mesh(wallGeometry(normal, WALL_M), source);
        (pipeline === 'recipe' ? recipeLit : recipeUnlit).apply(mesh);
      } else {
        // Landmark GLB: flat authored colour, normalised to diffuse-only like the game does.
        mesh = new THREE.Mesh(wallGeometry(normal, 1), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 }));
        normaliseLandmarkMaterials(THREE, mesh);
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
