/** Browser side of render.ts: load GLBs into one scene and render named views. Bundled by esbuild at run time. */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Model { base64: string; position?: number[]; rotationY?: number; scale?: number[] }
interface View { eye: number[]; target: number[]; fov: number; width: number; height: number }

const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = T.SRGBColorSpace;

async function render(models: Model[], views: View[], textures?: Record<string, string>): Promise<string[]> {
  const scene = new T.Scene();
  scene.background = new T.Color('#c9d6e0');
  scene.add(new T.HemisphereLight('#eef3f8', '#6b6458', 1.6));
  const sun = new T.DirectionalLight('#fff4e2', 2.2); sun.position.set(-30, 60, -40); scene.add(sun);
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({color: '#8d8b86', roughness: 1}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  const loader = new GLTFLoader(), texLoader = new T.TextureLoader();
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
    scene.add(root);
  }
  const out: string[] = [];
  for (const v of views) {
    renderer.setSize(v.width, v.height, false);
    const camera = new T.PerspectiveCamera(v.fov, v.width / v.height, 0.5, 2000);
    camera.position.fromArray(v.eye); camera.lookAt(new T.Vector3().fromArray(v.target));
    renderer.render(scene, camera);
    out.push(renderer.domElement.toDataURL('image/png'));
  }
  return out;
}
(window as any).renderGlbs = render;
