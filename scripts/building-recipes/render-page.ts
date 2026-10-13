/** Browser side of render.ts: load GLBs into one scene and render named views. Bundled by esbuild at run time. */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createRecipeLook, SOUTH_Z_ENU, type RecipeLook} from '../../src/canalRecall/buildingRecipe/recipeLook.ts';

interface Model { base64: string; position?: number[]; rotationY?: number; scale?: number[] }
interface View { eye: number[]; target: number[]; fov: number; width: number; height: number; ortho?: [number, number, number, number]; background?: string; noGround?: boolean }

const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = T.SRGBColorSpace;

let look: RecipeLook | null = null;
/** The game's recipe look (recipeLook.ts): same textures, palette mapping and fixed-light shade as the city layer. */
async function cityLook(brickUrl?: string): Promise<RecipeLook> {
  if (look) return look;
  let brick: HTMLImageElement | null = null;
  if (brickUrl) { brick = new Image(); brick.src = brickUrl; try { await brick.decode(); } catch { brick = null; } }
  look = createRecipeLook(T, {brick, anisotropy: 8});
  look.enuFromWorld.value.set(...SOUTH_Z_ENU);
  return look;
}

async function render(models: Model[], views: View[], textures?: Record<string, string>, brickUrl?: string | null): Promise<string[]> {
  const scene = new T.Scene();
  scene.background = new T.Color('#c9d6e0');
  scene.add(new T.HemisphereLight('#eef3f8', '#6b6458', 1.6));
  const sun = new T.DirectionalLight('#fff4e2', 2.2); sun.position.set(-30, 60, -40); scene.add(sun);
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({color: '#8d8b86', roughness: 1}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), texLoader = new T.TextureLoader();
  const maps: Record<string, T.Texture> = {};
  for (const [slot, url] of Object.entries(textures ?? {})) {
    const t = await texLoader.loadAsync(url); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; maps[slot] = t;
  }
  for (const m of models) {
    const bytes = Uint8Array.from(atob(m.base64), c => c.charCodeAt(0));
    const gltf = await loader.parseAsync(bytes.buffer, '');
    const root = gltf.scene;
    if (m.position) root.position.fromArray(m.position);
    if (m.rotationY) root.rotation.y = m.rotationY;
    if (m.scale) root.scale.fromArray(m.scale);
    root.traverse(o => {
      if (!(o instanceof T.Mesh)) return;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        const slot = mat.userData?.materialSlot;
        if (slot && maps[slot] && o.geometry.getAttribute('uv')) { mat.map = maps[slot]; mat.needsUpdate = true; }
        mat.side = T.DoubleSide;
      }
    });
    if (brickUrl !== null && !textures) (await cityLook(brickUrl)).apply(root);
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
