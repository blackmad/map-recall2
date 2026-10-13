/**
 * City look gallery review: every landmark GLB at gallery-card size, flag off
 * beside flag on, under the shared frame's one rig (docs/LOOK.md "City look").
 *
 *  - flag off (`?sharedFrame=1`): the GLB's own flat materials, diffuse-only
 *    (`normaliseLandmarkMaterials`, as signature-landmarks-source.js `_shade`);
 *  - flag on (`?cityLook=1&sharedFrame=1`): `createCityLook().dress(…, { lit,
 *    infer, year })`, the game path: slots inferred from material names, box
 *    UVs, the slot layers, the BAG year's brick.
 *
 * Two views per side: from the sun (south-west, lit faces) and from the
 * north-east (shade faces), so a review sees every side at card size. Returns
 * PNG data URLs (transparent background) and per-model numbers: mean sRGB luma
 * of the model's pixels per view and pipeline, and the material table (name,
 * authored colour, slot, rule, confidence, city tint, layer).
 *
 * Browser only. Driven by `scripts/landmarks/citylook-gallery-review.mjs`,
 * which bundles this file, serves `public/canal-drive/` and writes the sheets.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createLightRig } from '../rendererShared/lightRig.js';
import { normaliseLandmarkMaterials } from '../landmarks/landmarkShading.js';
import { cityLookTint, createCityLook, slotIneligible, SLOT_LAYERS, type CityLook } from './cityLook.js';
import { inferMaterialSlot } from './materialSlotInference.js';

export type ReviewView = 'sun' | 'shade';
export type ReviewMaterial = { name: string; hex: string; slot: string | null; rule: string; confidence: string | null; cityTint: string | null; cell: string | null; skipped: string | null; meshes: number };
export type ReviewModel = {
  id: string;
  year: number | null;
  images: Record<`${'legacy' | 'city'}-${ReviewView}`, string>;
  luma: Record<`${'legacy' | 'city'}-${ReviewView}`, number>;
  /** Mean sRGB colour of model pixels (r, g, b) per pipeline and view. */
  rgb: Record<`${'legacy' | 'city'}-${ReviewView}`, [number, number, number]>;
  materials: ReviewMaterial[];
};

let renderer: THREE.WebGLRenderer | null = null;
let city: CityLook | null = null;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

async function setup(width: number, height: number, brickUrl: string): Promise<void> {
  if (renderer) return;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  document.body.appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.NoToneMapping;
  const brick = new Image(); brick.src = brickUrl;
  let decoded: HTMLImageElement | null = brick;
  try { await brick.decode(); } catch { decoded = null; }
  city = createCityLook(THREE, { brick: decoded, size: 256, anisotropy: 4 });
  await city.ready;
  city.uniforms.enuFromWorld.value.identity();
}

function materialTable(root: THREE.Object3D): ReviewMaterial[] {
  const byKey = new Map<string, ReviewMaterial>();
  root.traverse((o: any) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const hex = m?.color ? '#' + m.color.getHexString(THREE.SRGBColorSpace) : '';
      const key = `${m?.name}|${hex}`;
      let row = byKey.get(key);
      if (!row) {
        const skipped = Array.isArray(o.material) ? 'multi-material mesh' : slotIneligible(m);
        const declared = m?.userData?.materialSlot;
        const inf = !skipped && hex ? inferMaterialSlot(m.name, hex) : null;
        const slot = declared ?? inf?.slot ?? null;
        row = { name: m?.name ?? '', hex, slot, rule: declared ? 'declared' : inf?.rule ?? '', confidence: declared ? 'declared' : inf?.confidence ?? null,
          cityTint: slot && hex ? cityLookTint(slot, m.userData?.tint ?? hex) : null, cell: null, skipped, meshes: 0 };
        byKey.set(key, row);
      }
      row.meshes++;
    }
  });
  return [...byKey.values()];
}

function frame(root: THREE.Object3D, view: ReviewView, camera: THREE.PerspectiveCamera): void {
  const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const radius = Math.max(s.length() / 2, 4);
  // ENU, z up. Sun at azimuth 215° (docs/LOOK.md): the sun view looks from 205°, the shade view from 25°.
  const az = (view === 'sun' ? 205 : 25) * Math.PI / 180, el = 28 * Math.PI / 180;
  const dist = radius / Math.sin((camera.fov / 2) * Math.PI / 180) * 0.8;
  camera.up.set(0, 0, 1);
  camera.position.set(c.x + Math.sin(az) * Math.cos(el) * dist, c.y + Math.cos(az) * Math.cos(el) * dist, c.z + Math.sin(el) * dist);
  camera.near = dist / 50; camera.far = dist * 4;
  camera.lookAt(c);
  camera.updateProjectionMatrix();
}

function stats(width: number, height: number): { luma: number; rgb: [number, number, number] } {
  const gl = renderer!.getContext(), px = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 250) { n++; r += px[i]; g += px[i + 1]; b += px[i + 2]; }
  if (!n) return { luma: 0, rgb: [0, 0, 0] };
  r /= n; g /= n; b /= n;
  return { luma: +(0.299 * r + 0.587 * g + 0.114 * b).toFixed(1), rgb: [Math.round(r), Math.round(g), Math.round(b)] };
}

/** Render one model both ways. `url` relative to the page. */
export async function reviewModel(options: { id: string; url: string; year?: number | null; width?: number; height?: number; brickUrl: string }): Promise<ReviewModel> {
  const width = options.width ?? 320, height = options.height ?? 240;
  await setup(width, height, options.brickUrl);
  const year = options.year ?? null;
  const out: ReviewModel = { id: options.id, year, images: {} as any, luma: {} as any, rgb: {} as any, materials: [] };
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 5000);
  for (const pipeline of ['legacy', 'city'] as const) {
    const gltf = await loader.loadAsync(options.url);
    const holder = new THREE.Group();
    holder.rotation.x = Math.PI / 2; // glTF Y-up → ENU Z-up, as the game places it
    holder.add(gltf.scene);
    if (pipeline === 'legacy') {
      out.materials = materialTable(gltf.scene);
      normaliseLandmarkMaterials(THREE, gltf.scene);
    } else {
      city!.dress(gltf.scene, { lit: true, infer: true, year });
      const cells = new Map<string, string>();
      gltf.scene.traverse((o: any) => { if (o.userData?.citySlot) cells.set(`${o.userData.citySlot.from}|${o.userData.citySlot.tint}`, SLOT_LAYERS[o.userData.citySlot.layer]?.cell ?? ''); });
      for (const row of out.materials) row.cell = cells.get(`${row.name}|${row.hex}`) ?? null;
      normaliseLandmarkMaterials(THREE, gltf.scene); // what the game's `_shade` does after `_dress`
    }
    const scene = new THREE.Scene();
    for (const o of createLightRig(THREE, { shadows: false }).objects) scene.add(o);
    scene.add(holder);
    holder.updateMatrixWorld(true);
    for (const view of ['sun', 'shade'] as const) {
      frame(holder, view, camera);
      renderer!.setClearColor(0x000000, 0);
      renderer!.render(scene, camera);
      const s = stats(width, height);
      out.luma[`${pipeline}-${view}`] = s.luma;
      out.rgb[`${pipeline}-${view}`] = s.rgb;
      out.images[`${pipeline}-${view}`] = renderer!.domElement.toDataURL('image/png');
    }
    gltf.scene.traverse((o: any) => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!m?.userData?.cityLook) { for (const k of Object.keys(m ?? {})) if ((m as any)[k]?.isTexture) (m as any)[k].dispose(); m?.dispose?.(); }
    });
  }
  return out;
}
