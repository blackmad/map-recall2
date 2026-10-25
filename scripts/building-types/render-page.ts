// Browser page script for the building-type renders (bundled by camera-sheets.ts with esbuild, loaded into a blank page).
// window.bt.load(base64Glb, opts) decode a staged GLB (baked or instanced), dress `materialSlot` materials with procedural textures;
//                                 opts.look 'game' (#78) dresses them with the game's lit recipe look under the sunny rig instead
// window.bt.camera(opts)         street camera matched to a panorama: x, z (east/south m), y (eye height NAP), heading, pitch, hfov, w, h -> PNG data URL
// window.bt.aerial(opts)         oblique/top view of the area with context buildings and streets -> PNG data URL
// window.bt.bounds()             world bounds of the loaded models
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {cityTint, type MaterialSlot as RecipeSlot} from '../../src/canalRecall/look/palette.ts';
import {createRecipeLook, materialMottle, type RecipeLook} from '../../src/canalRecall/buildingRecipe/recipeLook.ts';
import {SUNNY_LIGHT_RIG} from '../../src/canalRecall/rendererShared/lightRig.ts';
import {assignBrickTones, mottleGain, mottleKey, mottleRatios, type Mottle} from '../../src/canalRecall/buildingTypes/mottle.ts';

/** Review-render brightness of the brick slot, tuned so a sunlit-photo tint renders about as dark as the photo (the game: lifted tint x neutral brick texture x wall shade). */
const BRICK_GAIN = 1.12;

type Ctx = {buildings: {ring: [number, number][]; heightM: number}[]; streets: {highway: string; path: [number, number][]}[]};

const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd4ea');
const sky = new THREE.HemisphereLight('#ffffff', '#8a8576', 1.5); scene.add(sky);
const sun = new THREE.DirectionalLight('#fff4e0', 2.0); sun.position.set(-40, 80, 55); scene.add(sun);
/**
 * 'review' (default): the review renderer's own textures, brick gain and lights. 'game' (#78, camera-sheets default): the
 * game's shared-frame look, so a sheet shows what ships: the recipe look's lit slot materials (cityTint, the same cells,
 * Bricks057 brick) under the sunny rig's colours and intensities (rendererShared/lightRig.ts SUNNY_LIGHT_RIG; no shadows).
 * The review lights draw a sun-facing wall at ~0.72 and a shade wall at ~0.30 of its tint, the game at 1.0 and 0.55, so the
 * review look could not draw white above ~180 sRGB on a shade wall.
 */
let look: 'review' | 'game' = 'review', recipeLook: RecipeLook | null = null;
/** Sun direction (x east, y up, z south) for an azimuth from north clockwise and an elevation, in degrees. */
const sunAt = (azDeg: number, elDeg: number, r = 100): [number, number, number] => {
  const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, -Math.cos(az) * Math.cos(el) * r];
};
async function setLook(next: 'review' | 'game', brickDataUrl?: string) {
  look = next;
  if (look === 'game') {
    sky.color.set(SUNNY_LIGHT_RIG.skyColour); sky.groundColor.set(SUNNY_LIGHT_RIG.groundColour); sky.intensity = SUNNY_LIGHT_RIG.skyIntensity;
    sun.color.set(SUNNY_LIGHT_RIG.sunColour); sun.intensity = SUNNY_LIGHT_RIG.sunIntensity; sun.position.set(...sunAt(SUNNY_LIGHT_RIG.sunAzimuthDeg, SUNNY_LIGHT_RIG.sunElevationDeg));
    let brick: HTMLImageElement | null = null;
    if (brickDataUrl) { brick = new Image(); brick.src = brickDataUrl; await brick.decode().catch(() => { brick = null; }); }
    recipeLook = createRecipeLook(THREE, {document, brick, lit: true, cityLook: false});
  }
}
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

/** Mottled brick (#77): the review brick bond with each brick multiplied by its tone's ratio (and the clip gain, returned for the tint). */
const mottled = new Map<string, {t: THREE.CanvasTexture; gain: number}>();
function mottledBrick(m: Mottle): {t: THREE.CanvasTexture; gain: number} {
  const key = mottleKey(m);
  let e = mottled.get(key);
  if (!e) {
    const ratios = mottleRatios(m), gain = mottleGain(ratios, 0.83 * 255), tones = assignBrickTones(m, 12, 7, 3);
    let sd = 11; const r2 = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const t = canvasTexture((g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); const bh = s / 12, bw = s * 0.215 / 0.5 / 2; for (let r = 0; r < 12; r++) for (let k = -1; k < 6; k++) { const x = k * bw + (r % 2 ? bw / 2 : 0); const v = (0.74 + r2() * 0.18) * gain, q = ratios[tones[r][k + 1]]; g.fillStyle = `rgb(${v * 255 * q[0]},${v * 250 * q[1]},${v * 245 * q[2]})`; g.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2); } }, 256, 0.5);
    e = {t, gain}; mottled.set(key, e);
  }
  return e;
}

function dress(root: THREE.Object3D) {
  if (look === 'game' && recipeLook) { recipeLook.apply(root); return; }
  root.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !('isMeshStandardMaterial' in m) || (m.userData as {dressed?: boolean}).dressed) return;
    const slot = (m.userData as {materialSlot?: string}).materialSlot;
    (m.userData as {dressed?: boolean}).dressed = true;
    m.metalness = 0; m.roughness = 0.92;
    // The game's recipe look maps every authored tint through cityTint (brick: photo-sampled colour -> city lightness range), so the
    // review render does the same; the authored `tint` is therefore the colour sampled from the sunlit photo.
    const tint = (m.userData as {tint?: string}).tint;
    if (slot && tint && slot !== 'glass' && textures[slot]) m.color.set(cityTint(slot as RecipeSlot, tint, (m.userData as {tintSource?: 'measured'}).tintSource));
    const mottle = materialMottle(slot, (m.userData as {mottle?: unknown}).mottle);
    if (mottle) { const e = mottledBrick(mottle); m.map = e.t; m.color.multiplyScalar(BRICK_GAIN * e.gain ** -2.2); m.needsUpdate = true; }
    else if (slot && textures[slot]) { m.map = textures[slot]; m.color.multiplyScalar(slot === 'brick' ? BRICK_GAIN : 1.05); m.needsUpdate = true; }
    if (slot === 'glass') { m.roughness = 0.15; m.metalness = 0.35; m.color.multiplyScalar(1.2); }
  });
}

/** `offsetsX`: shift file i east by offsetsX[i] metres (the design gallery lines several units up as a short row); none = all at the origin. */
async function load(files: string[], opts: {look?: 'review' | 'game'; brick?: string; offsetsX?: number[]} = {}) {
  if (opts.look && opts.look !== look) await setLook(opts.look, opts.brick);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder as never);
  world.clear();
  let tris = 0, meshes = 0;
  for (const [fi, b64] of files.entries()) {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const gltf = await loader.parseAsync(bin.buffer, '');
  if (opts.offsetsX) gltf.scene.position.x = opts.offsetsX[fi] ?? 0;
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

/** `sun`: [azimuth from north clockwise, elevation] in degrees (the panorama's own sun, camera-sheets --sun=photo); default the fixed review sun. Below the horizon: sky light only. */
function camera(o: {x: number; z: number; y: number; heading: number; pitch: number; hfov: number; w: number; h: number; groundY: number; sun?: [number, number]}) {
  extra.clear(); extra.add(ground(o.groundY));
  if (o.sun) {
    const az = o.sun[0] * Math.PI / 180, el = Math.max(2, o.sun[1]) * Math.PI / 180;
    sun.position.set(Math.sin(az) * Math.cos(el) * 100, Math.sin(el) * 100, -Math.cos(az) * Math.cos(el) * 100); // x east, z south
    sun.intensity = o.sun[1] > 0 ? (look === 'game' ? SUNNY_LIGHT_RIG.sunIntensity : 2.0) : 0;
  } else if (look === 'game') { sun.position.set(...sunAt(SUNNY_LIGHT_RIG.sunAzimuthDeg, SUNNY_LIGHT_RIG.sunElevationDeg)); sun.intensity = SUNNY_LIGHT_RIG.sunIntensity; }
  else { sun.position.set(-40, 80, 55); sun.intensity = 2.0; }
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

/** World bounds of the loaded models: {min: [x, y, z], max: [x, y, z]} (coverage look thumbs frame on it). */
function bounds() { const b = new THREE.Box3().setFromObject(world); return {min: b.min.toArray(), max: b.max.toArray()}; }

(window as unknown as {bt: unknown}).bt = {load, camera, aerial, bounds};
