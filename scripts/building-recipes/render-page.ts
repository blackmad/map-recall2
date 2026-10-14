/** Browser side of render.ts: load GLBs into one scene and render named views. Bundled by esbuild at run time. */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createRecipeLook, SOUTH_Z_ENU, type RecipeLook} from '../../src/canalRecall/buildingRecipe/recipeLook.ts';
import {createCityLook, type CityLook as CityLookInstance} from '../../src/canalRecall/look/cityLook.ts';

interface Model { base64: string; position?: number[]; rotationY?: number; scale?: number[] }
/** Which game look dresses the models: the default recipe look, or the city look (`?cityLook=1`) with the BAG year's brick. */
interface Look { city?: boolean; year?: number | null }
interface View { eye: number[]; target: number[]; fov: number; width: number; height: number; ortho?: [number, number, number, number]; background?: string; noGround?: boolean }

const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = T.SRGBColorSpace;

let look: RecipeLook | null = null, city: CityLookInstance | null = null;
let brick: Promise<HTMLImageElement | null> | null = null;
const loadBrick = (url?: string) => brick ??= (async () => {
  if (!url) return null;
  const image = new Image(); image.src = url;
  try { await image.decode(); return image; } catch { return null; }
})();
/** The game's recipe look (recipeLook.ts, `cityLook: false`): same textures, palette mapping and fixed-light shade as the city layer. */
async function recipeLook(brickUrl?: string): Promise<RecipeLook> {
  if (look) return look;
  look = createRecipeLook(T, {brick: await loadBrick(brickUrl), anisotropy: 8, cityLook: false});
  look.enuFromWorld.value.set(...SOUTH_Z_ENU);
  return look;
}
/** The game's city look (`?cityLook=1`, look/cityLook.ts): one atlas, the BAG year's brick, the unlit baked shade. */
async function cityLook(brickUrl?: string): Promise<CityLookInstance> {
  if (city) return city;
  city = createCityLook(T, {brick: await loadBrick(brickUrl), size: 256, anisotropy: 8});
  await city.ready;
  city.uniforms.enuFromWorld.value.set(...SOUTH_Z_ENU);
  return city;
}

/**
 * Every sheet draws through a game look: there is no raw-material path any more. Until 2026-10-14 a `textures` map
 * (make-textures.ts trial tiles) skipped the look and drew the GLB's own lit PBR colours x a grey tile under a
 * hemisphere + sun, which the kit-vocabulary sheet labelled "city-look tints": dark measured walls went near-black
 * (Waagdragerhof #4a302b at 36,21,19), the pale Apollohal base dark brown, and the glass took its raw colour, so that
 * column disagreed with the game in both directions. `brickUrl === null` (render.ts `--flat`) keeps flat lit materials.
 */
async function render(models: Model[], views: View[], options?: Look, brickUrl?: string | null): Promise<string[]> {
  const scene = new T.Scene();
  scene.background = new T.Color('#c9d6e0');
  scene.add(new T.HemisphereLight('#eef3f8', '#6b6458', 1.6));
  const sun = new T.DirectionalLight('#fff4e2', 2.2); sun.position.set(-30, 60, -40); scene.add(sun);
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({color: '#8d8b86', roughness: 1}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const m of models) {
    const bytes = Uint8Array.from(atob(m.base64), c => c.charCodeAt(0));
    const gltf = await loader.parseAsync(bytes.buffer, '');
    const root = gltf.scene;
    if (m.position) root.position.fromArray(m.position);
    if (m.rotationY) root.rotation.y = m.rotationY;
    if (m.scale) root.scale.fromArray(m.scale);
    root.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) mat.side = T.DoubleSide;
    });
    if (brickUrl !== null) {
      if (options?.city) (await cityLook(brickUrl)).dress(root, {lit: false, year: options.year ?? null});
      else (await recipeLook(brickUrl)).apply(root);
    }
    scene.add(root);
  }
  const out: string[] = [];
  for (const v of views) {
    renderer.setSize(v.width, v.height, false);
    // Orthographic [left, right, top, bottom] in camera units: elevations at a fixed metre scale (block-face strip review).
    const camera = v.ortho ? new T.OrthographicCamera(v.ortho[0], v.ortho[1], v.ortho[2], v.ortho[3], 0.1, 2000) : new T.PerspectiveCamera(v.fov, v.width / v.height, 0.5, 2000);
    scene.background = new T.Color(v.background ?? '#c9d6e0'); ground.visible = !v.noGround;
    camera.position.fromArray(v.eye); camera.lookAt(new T.Vector3().fromArray(v.target));
    renderer.render(scene, camera);
    out.push(renderer.domElement.toDataURL('image/png'));
  }
  return out;
}
(window as any).renderGlbs = render;
