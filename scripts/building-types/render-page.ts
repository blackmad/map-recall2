// Browser page script for the building-type renders (bundled by camera-sheets.ts with esbuild, loaded into a blank page).
// window.bt.load(base64Glb)      decode a staged GLB (baked or instanced), dress `materialSlot` materials with procedural textures
// window.bt.camera(opts)         street camera matched to a panorama: x, z (east/south m), y (eye height NAP), heading, pitch, hfov, w, h -> PNG data URL
// window.bt.aerial(opts)         oblique/top view of the area with context buildings and streets -> PNG data URL
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

type Ctx = {buildings: {ring: [number, number][]; heightM: number}[]; streets: {highway: string; path: [number, number][]}[]};

const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd4ea');
scene.add(new THREE.HemisphereLight('#ffffff', '#8a8576', 1.5));
const sun = new THREE.DirectionalLight('#fff4e0', 2.0); sun.position.set(-40, 80, 55); scene.add(sun);
const world = new THREE.Group(); scene.add(world);
const extra = new THREE.Group(); scene.add(extra);

function canvasTexture(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 256, repeatM = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set(1 / repeatM, 1 / repeatM);
  return t;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const textures: Record<string, THREE.Texture> = {
  brick: canvasTexture((g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); const bh = s / 12, bw = s * 0.215 / 0.5 / 2; for (let r = 0; r < 12; r++) for (let k = -1; k < 6; k++) { const x = k * bw + (r % 2 ? bw / 2 : 0); const v = 0.74 + rnd() * 0.18; g.fillStyle = `rgb(${v * 255},${v * 250},${v * 245})`; g.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2); } }, 256, 0.5),
  stucco: canvasTexture((g, s) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s); for (let i = 0; i < 400; i++) { const v = 215 + rnd() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * s, rnd() * s, 2, 2); } }, 128, 1),
  stone: canvasTexture((g, s) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { const v = 150 + rnd() * 105; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; const r = 1 + rnd() * 2; g.beginPath(); g.arc(rnd() * s, rnd() * s, r, 0, 7); g.fill(); } }, 256, 1),
  roofTile: canvasTexture((g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); const th = s / 8; for (let r = 0; r < 8; r++) { g.fillStyle = r % 2 ? '#d9d9d9' : '#eeeeee'; g.fillRect(0, r * th, s, th - 2); g.fillStyle = '#c4c4c4'; g.fillRect(0, r * th + th - 2, s, 2); for (let k = 0; k < 10; k++) { g.fillRect(k * s / 10 + (r % 2) * s / 20, r * th, 1.5, th - 2); } } }, 256, 0.6),
  bitumen: canvasTexture((g, s) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, s, s); for (let i = 0; i < 300; i++) { const v = 200 + rnd() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * s, rnd() * s, 3, 3); } }, 128, 1),
};

function dress(root: THREE.Object3D) {
  root.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !('isMeshStandardMaterial' in m) || (m.userData as {dressed?: boolean}).dressed) return;
    const slot = (m.userData as {materialSlot?: string}).materialSlot;
    (m.userData as {dressed?: boolean}).dressed = true;
    m.metalness = 0; m.roughness = 0.92;
    if (slot && textures[slot]) { m.map = textures[slot]; m.color.multiplyScalar(slot === 'brick' ? 1.25 : 1.05); m.needsUpdate = true; }
    if (slot === 'glass') { m.roughness = 0.15; m.metalness = 0.35; m.color.multiplyScalar(1.2); }
  });
}

async function load(files: string[]) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder as never);
  world.clear();
  let tris = 0, meshes = 0;
  for (const b64 of files) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const gltf = await loader.parseAsync(bin.buffer, '');
  world.add(gltf.scene); dress(gltf.scene);
  gltf.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { meshes++; const n = m.geometry.index ? m.geometry.index.count / 3 : m.geometry.getAttribute('position').count / 3; tris += n * ((m as THREE.InstancedMesh).count ?? 1); } });
  }
  return {tris, meshes};
}

function ground(y: number, size = 4000, colour = '#8c9a85') {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({color: colour}));
  f.rotation.x = -Math.PI / 2; f.position.y = y - 0.03; return f;
}

function shot(cam: THREE.PerspectiveCamera, w: number, h: number): string {
  renderer.setSize(w, h); renderer.render(scene, cam); return renderer.domElement.toDataURL('image/png');
}

function camera(o: {x: number; z: number; y: number; heading: number; pitch: number; hfov: number; w: number; h: number; groundY: number}) {
  extra.clear(); extra.add(ground(o.groundY));
  const hf = o.hfov * Math.PI / 180, vfov = 2 * Math.atan(Math.tan(hf / 2) * o.h / o.w) * 180 / Math.PI;
  const cam = new THREE.PerspectiveCamera(vfov, o.w / o.h, 0.3, 3000);
  cam.position.set(o.x, o.y, o.z);
  const hd = o.heading * Math.PI / 180, p = o.pitch * Math.PI / 180;
  cam.lookAt(cam.position.x + Math.sin(hd) * Math.cos(p), cam.position.y + Math.sin(p), cam.position.z - Math.cos(hd) * Math.cos(p));
  return shot(cam, o.w, o.h);
}

function aerial(o: {cx: number; cz: number; groundY: number; distance: number; heading: number; pitch: number; fov: number; w: number; h: number; ctx: Ctx; highlight?: [number, number][]}) {
  extra.clear(); extra.add(ground(o.groundY, 6000, '#9aa890'));
  const wall = new THREE.MeshLambertMaterial({color: '#cfcac0'}), roof = new THREE.MeshLambertMaterial({color: '#a9a49b'});
  for (const b of o.ctx.buildings) {
    const shape = new THREE.Shape(b.ring.map(p => new THREE.Vector2(p[0], -p[1])));
    const g = new THREE.ExtrudeGeometry(shape, {depth: b.heightM, bevelEnabled: false}); // shape in (x, -z), extruded along +z
    g.rotateX(-Math.PI / 2); // (x, y, z) -> (x, z, -y): extrusion becomes +y, shape y (= -z) becomes +z... shape y holds -z so z = z
    const mesh = new THREE.Mesh(g, [roof, wall]); mesh.position.y = o.groundY; extra.add(mesh);
  }
  const roadColour: Record<string, string> = {footway: '#d8d2c4', cycleway: '#c9a6a0', path: '#d8d2c4', service: '#b8b4aa'};
  for (const s of o.ctx.streets) {
    const width = ['footway', 'path', 'cycleway', 'steps', 'pedestrian'].includes(s.highway) ? 1.6 : s.highway === 'service' ? 3 : 6;
    for (let i = 0; i + 1 < s.path.length; i++) {
      const a = s.path[i], b = s.path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.1) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), new THREE.MeshBasicMaterial({color: roadColour[s.highway] ?? '#9c9a96'}));
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      m.position.set((a[0] + b[0]) / 2, o.groundY - 0.01, (a[1] + b[1]) / 2); extra.add(m);
    }
  }
  const cam = new THREE.PerspectiveCamera(o.fov, o.w / o.h, 5, 8000);
  const hd = o.heading * Math.PI / 180, p = o.pitch * Math.PI / 180; // camera sits behind the target, looking along heading, pitched down
  cam.position.set(o.cx - Math.sin(hd) * Math.cos(p) * o.distance, o.groundY + Math.sin(p) * o.distance, o.cz + Math.cos(hd) * Math.cos(p) * o.distance);
  cam.lookAt(o.cx, o.groundY + 5, o.cz);
  return shot(cam, o.w, o.h);
}

(window as unknown as {bt: unknown}).bt = {load, camera, aerial};
