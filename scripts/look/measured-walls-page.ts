/**
 * Browser side of measured-walls.ts: one recipe GLB through a named render path, with the mean rendered sRGB of each
 * named GLB material (an id pass picks the pixels each material owns, after occlusion). Bundled by esbuild at run time.
 *
 * Paths:
 *  - `city`: the game's city look (`?cityLook=1`; look/cityLook.ts `dress`, unlit baked shade, the BAG year's brick);
 *  - `legacy`: the game's default recipe look (buildingRecipe/recipeLook.ts, unlit);
 *  - `raw`: the GLB's own lit PBR materials x the make-textures.ts trial tiles under a hemisphere + sun: what the
 *    kit-vocabulary sheet's "city-look tints" column drew through render-page.ts before 2026-10-14 (the before column).
 */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createCityLook} from '../../src/canalRecall/look/cityLook.ts';
import {createRecipeLook, SOUTH_Z_ENU} from '../../src/canalRecall/buildingRecipe/recipeLook.ts';

export type WallPath = 'city' | 'legacy' | 'raw';
export interface WallView { eye: number[]; target: number[]; fov: number; width: number; height: number }
/** `unmeasured`: drop every `tintSource` extra before dressing, so measured materials draw as the stock look did (the "game before" column). */
export interface WallRequest { base64: string; year: number | null; path: WallPath; views: WallView[]; targets: string[]; brickUrl: string; rawMaps?: Record<string, string>; unmeasured?: boolean }
export interface WallResult { png: string; means: Record<string, {rgb: number[]; pixels: number}> }

const renderer = new T.WebGLRenderer({antialias: false, preserveDrawingBuffer: true});
renderer.outputColorSpace = T.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

let brick: HTMLImageElement | null | undefined;
async function loadBrick(url: string) {
  if (brick !== undefined) return brick;
  const image = new Image(); image.src = url;
  try { await image.decode(); brick = image; } catch { brick = null; }
  return brick;
}

async function renderWalls(req: WallRequest): Promise<WallResult[]> {
  const b = await loadBrick(req.brickUrl);
  const bytes = Uint8Array.from(atob(req.base64), c => c.charCodeAt(0));
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer, '');
  const root = gltf.scene, scene = new T.Scene();
  scene.background = new T.Color('#c9d6e0');
  const meshes: {mesh: T.Mesh; name: string}[] = [];
  root.traverse(o => { if (o instanceof T.Mesh) { meshes.push({mesh: o, name: (o.material as T.Material).name}); (o.material as T.Material).side = T.DoubleSide; if (req.unmeasured) delete (o.material as T.Material).userData.tintSource; } });
  if (req.path === 'city') {
    const city = createCityLook(T, {brick: b, size: 256});
    await city.ready;
    city.uniforms.enuFromWorld.value.set(...SOUTH_Z_ENU);
    city.dress(root, {lit: false, year: req.year});
  } else if (req.path === 'legacy') {
    const look = createRecipeLook(T, {brick: b, anisotropy: 8, cityLook: false});
    look.enuFromWorld.value.set(...SOUTH_Z_ENU);
    look.apply(root);
  } else {
    const maps: Record<string, T.Texture> = {};
    for (const [slot, url] of Object.entries(req.rawMaps ?? {})) {
      const t = await new T.TextureLoader().loadAsync(url); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; maps[slot] = t;
    }
    for (const {mesh} of meshes) {
      const mat = mesh.material as T.MeshStandardMaterial, slot = mat.userData?.materialSlot;
      if (slot && maps[slot] && mesh.geometry.getAttribute('uv')) { mat.map = maps[slot]; mat.needsUpdate = true; }
    }
    scene.add(new T.HemisphereLight('#eef3f8', '#6b6458', 1.6));
    const sun = new T.DirectionalLight('#fff4e2', 2.2); sun.position.set(-30, 60, -40); scene.add(sun);
  }
  scene.add(root);
  const beauty = meshes.map(m => m.mesh.material);
  // Id pass: target k draws (k + 1) * 16 in red into an unconverted target; everything else draws 0 (occluders).
  const idMaterials = meshes.map(m => {
    const t = req.targets.indexOf(m.name), v = t < 0 ? 0 : (t + 1) * 16;
    return new T.ShaderMaterial({vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: `void main(){gl_FragColor=vec4(${(v / 255).toFixed(6)},0.0,0.0,1.0);}`, side: T.DoubleSide});
  });
  const out: WallResult[] = [];
  for (const v of req.views) {
    renderer.setSize(v.width, v.height, false);
    const camera = new T.PerspectiveCamera(v.fov, v.width / v.height, 0.5, 2000);
    camera.position.fromArray(v.eye); camera.lookAt(new T.Vector3().fromArray(v.target));
    const rt = new T.WebGLRenderTarget(v.width, v.height);
    meshes.forEach((m, i) => { m.mesh.material = idMaterials[i]; });
    const bg = scene.background; scene.background = new T.Color(0, 0, 0);
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    const idPx = new Uint8Array(v.width * v.height * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, v.width, v.height, idPx);
    renderer.setRenderTarget(null); rt.dispose();
    meshes.forEach((m, i) => { m.mesh.material = beauty[i]; });
    scene.background = bg;
    renderer.render(scene, camera);
    const gl = renderer.getContext(), px = new Uint8Array(v.width * v.height * 4);
    gl.readPixels(0, 0, v.width, v.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const sums = req.targets.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < idPx.length; i += 4) {
      const t = Math.round(idPx[i] / 16) - 1;
      if (t < 0 || t >= sums.length) continue;
      const s = sums[t]; s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; s[3]++;
    }
    out.push({png: renderer.domElement.toDataURL('image/png'), means: Object.fromEntries(req.targets.map((name, t) => [name, {rgb: sums[t].slice(0, 3).map(x => x / Math.max(1, sums[t][3])), pixels: sums[t][3]}]))});
  }
  return out;
}
(window as any).renderWalls = renderWalls;
