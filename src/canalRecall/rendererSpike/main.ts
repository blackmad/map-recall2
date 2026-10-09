// Own-renderer spike (2026-10-09): one neighbourhood drawn by three.js alone,
// from our own extracts, with the lighting MapLibre's custom-layer model makes
// awkward (sun shadows, sky light + IBL, fog, tone mapping, AO, water).
// Not wired into the game. See docs/research/own-renderer-spike-20261009.md.
//
// Build: npx esbuild src/canalRecall/rendererSpike/main.ts --bundle --format=esm \
//          --loader:.json=json --outfile=public/canal-drive/js/renderer-spike.bundle.js
// Page:  /canal-drive/renderer-spike.html?lat=52.3747&lng=4.8850
// Params: r (radius m, 700), cam=chase|map, mapcam=lng,lat,zoom,pitch,bearing[,fov],
//         rider=lng,lat,bearingDeg, auto=0|1, shadows, ao, fx=0 (all effects off),
//         dpr, hud=0, look (building look, photo).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import earcut from 'earcut';
import { gameDecorator, loadGameData, loadTile, tilesAround, toLocal, type Feature } from '../galleryPipeline.js';
import { setShopfronts } from '../shopfronts.js';
import { asPolygons, buildFeatureChunk, type BuildingLook } from '../threeBuildingFeatures.js';
import { buildLookTextures } from '../threeBuildingsBrowser.js';
import { streetSegments } from '../streetFronts.js';
import { validateIndex, localToLngLat, cellsNear, type WaterCell, type BridgeExtract } from '../elevation/elevationData.js';
import { waterSurface, quayWalls } from '../elevation/canalGeometry.js';
import { decodeProfile, measuredDeckMesh, decodeFallback, fallbackDeckTop, fallbackDeckUnderside, isFlatMeasured } from '../elevation/bridgeDeck.js';
import { mergeMeshes, type MeshData } from '../elevation/meshBuilder.js';
import { MANUAL_LANDMARKS } from '../landmarks/manualModels.js';
import { placementFor } from '../landmarks/signaturePlacement.js';
import { chunkGeometry, facadeMaterial } from './facadeMaterial.js';
import { buildStreetMeshes, type MeshArrays, type StreetWay, type Vec2 } from './streetMesh.js';
import { autopilotPath, cumulativeLengths, mapLibreEye, sampleAlong } from './ride.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.get(k) !== null && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
const flag = (k: string, d: boolean) => (q.get(k) === null ? d : q.get(k) === '1');
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const fxOff = q.get('fx') === '0';
const opts = {
  lat: num('lat', 52.3747), lng: num('lng', 4.8850), radius: num('r', 700),
  cam: (q.get('cam') ?? 'chase') as 'chase' | 'map',
  auto: flag('auto', true), hud: flag('hud', true),
  shadows: !fxOff && flag('shadows', true), ao: !fxOff && flag('ao', !coarsePointer),
  sky: !fxOff, fog: !fxOff, tone: !fxOff,
  dpr: num('dpr', Math.min(window.devicePixelRatio || 1, coarsePointer ? 2 : 1.5)),
  look: (q.get('look') ?? 'photo') as BuildingLook,
  shadowSize: num('shadowmap', coarsePointer ? 1024 : 2048),
  detailM: num('detail', 380),
};
const EXTRACT = '../data/extracts/amsterdam';
const [cx, cy] = toLocal(opts.lng, opts.lat);
const status: Record<string, unknown> = {};
const spike: any = { ready: false, status, frames: [] as number[], renderMs: [] as number[], opts };
(window as any).__spike = spike;
const log = (k: string, v: unknown) => { status[k] = v; };

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: !opts.tone, stencil: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(opts.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = opts.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = opts.tone ? THREE.NeutralToneMapping : THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(opts.cam === 'map' ? 36.87 : 55, innerWidth / innerHeight, 1, 4000);
camera.up.set(0, 0, 1);

// Sun from the south-west, mid-afternoon in October.
const SUN_AZ = 225 * Math.PI / 180, SUN_EL = 34 * Math.PI / 180;
const sunDir = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.cos(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL)).normalize();
const FOG = new THREE.Color('#c4d0d8');
if (opts.sky) {
  const sky = new Sky();
  sky.scale.setScalar(1000);
  const u = (sky.material as THREE.ShaderMaterial).uniforms;
  u.up.value.set(0, 0, 1); u.sunPosition.value.copy(sunDir);
  u.turbidity.value = 6; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.8;
  const skyScene = new THREE.Scene(); skyScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(skyScene, 0, 1, 2000).texture;
  scene.environment = env; scene.background = env; scene.backgroundBlurriness = 0.15;
  scene.environmentIntensity = 0.22;
  pmrem.dispose();
} else scene.background = new THREE.Color('#d9e4ec');
if (opts.fog) scene.fog = new THREE.Fog(FOG, 260, 1300);
const hemi = new THREE.HemisphereLight('#dbe8ff', '#8d8270', opts.sky ? 0.45 : 1.6);
hemi.position.set(0, 0, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', opts.sky ? 3.6 : 1.8);
sun.castShadow = opts.shadows;
const SHADOW_HALF = 140;
sun.shadow.mapSize.set(opts.shadowSize, opts.shadowSize);
Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 900 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35;
scene.add(sun, sun.target);
spike.three = { THREE, scene, sun, renderer, camera };

let composer: EffectComposer | null = null;
let gtao: GTAOPass | null = null;
if (opts.tone) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, stencilBuffer: true, depthBuffer: true, samples: coarsePointer ? 0 : 4 });
  composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  if (opts.ao) {
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 12 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());
}

// ---------------------------------------------------------------- materials
function canvasTexture(size: number, metres: number, paint: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.repeat.set(1 / metres, 1 / metres);
  return t;
}
let seed = 99;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = (g: CanvasRenderingContext2D, s: number, base: [number, number, number], spread: number, grain = 2) => {
  for (let y = 0; y < s; y += grain) for (let x = 0; x < s; x += grain) {
    const v = (rnd() - 0.5) * spread;
    g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(x, y, grain, grain);
  }
};
/** Running-bond pavers: `w` x `h` metres per stone, `metres` per texture tile. */
const pavers = (base: [number, number, number], joint: string, metres: number, w: number, h: number) => canvasTexture(512, metres, (g, s) => {
  g.fillStyle = joint; g.fillRect(0, 0, s, s);
  const pw = s * w / metres, ph = s * h / metres;
  for (let row = 0, y = 0; y < s; row++, y += ph) for (let x = row % 2 ? -pw / 2 : 0; x < s; x += pw) {
    const v = (rnd() - 0.5) * 26;
    g.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.9},${base[2] + v * 0.8})`;
    g.fillRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
  }
});
const stencilKeep = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp, stencilWriteMask: 0 };
const surfaceMaterial = (map: THREE.Texture, roughness = 0.95) => new THREE.MeshStandardMaterial({ map, roughness, metalness: 0, ...stencilKeep });
const M = {
  ground: surfaceMaterial(pavers([150, 142, 130], '#6f675d', 3, 0.3, 0.3)),
  klinker: surfaceMaterial(pavers([128, 82, 66], '#5a463d', 2, 0.2, 0.1), 0.9),
  asphalt: surfaceMaterial(canvasTexture(256, 4, (g, s) => noise(g, s, [72, 74, 78], 18))),
  cycle: surfaceMaterial(canvasTexture(256, 4, (g, s) => noise(g, s, [146, 70, 62], 18)), 0.85),
  paving: surfaceMaterial(pavers([168, 160, 148], '#7d756a', 3, 0.3, 0.3)),
  paint: new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.6, ...stencilKeep }),
  park: new THREE.MeshStandardMaterial({ map: canvasTexture(256, 6, (g, s) => noise(g, s, [92, 122, 66], 30, 3)), roughness: 1, ...stencilKeep }),
  opening: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp }),
  openingCut: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide, stencilWrite: true, stencilRef: 0, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp }),
  quay: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  deck: new THREE.MeshStandardMaterial({ vertexColors: true, color: '#8f877c', roughness: 0.85 }),
  water: new THREE.MeshStandardMaterial({ color: '#304b4d', roughness: 0.1, metalness: 0, envMapIntensity: 2.2, side: THREE.DoubleSide }),
  trunk: new THREE.MeshStandardMaterial({ color: '#4a3b2f', roughness: 1 }),
  crown: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }),
};
// Ripples: a tiled normal map from a few summed sines, scrolled per frame.
{
  const s = 128, data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const t = (a: number, b: number) => Math.sin((x * a + y * b) * Math.PI * 2 / s);
    const dx = 0.5 * t(3, 1) + 0.3 * t(-2, 5) + 0.2 * t(7, -3), dy = 0.5 * t(1, 4) + 0.3 * t(5, 2) + 0.2 * t(-4, 6);
    const i = (y * s + x) * 4; data[i] = 128 + dx * 60; data[i + 1] = 128 + dy * 60; data[i + 2] = 255; data[i + 3] = 255;
  }
  const n = new THREE.DataTexture(data, s, s); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.needsUpdate = true; n.repeat.set(0.12, 0.12);
  n.generateMipmaps = true; n.minFilter = THREE.LinearMipmapLinearFilter; n.magFilter = THREE.LinearFilter;
  M.water.normalMap = n; M.water.normalScale.set(0.22, 0.22);
}

function meshFrom(data: MeshData | MeshArrays, material: THREE.Material, opts2: { cast?: boolean; receive?: boolean; order?: number } = {}): THREE.Mesh | null {
  if (!data.indices.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(data.positions as ArrayLike<number>), 3));
  if ('colors' in data) g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(data.colors), 3));
  if ('uvs' in data) g.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(data.uvs), 2));
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(data.indices as ArrayLike<number>), 1));
  if ('normals' in data) g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(data.normals), 3));
  else g.computeVertexNormals();
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = !!opts2.cast; mesh.receiveShadow = opts2.receive ?? true;
  if (opts2.order !== undefined) mesh.renderOrder = opts2.order;
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- data
const near = (x: number, y: number, r = opts.radius) => Math.hypot(x - cx, y - cy) <= r;
async function json(path: string): Promise<any> {
  const r = await fetch(`${EXTRACT}/${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  if (!path.endsWith('.gz')) return r.json();
  const bytes = new Uint8Array(await r.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function loadStreets(): Promise<StreetWay[]> {
  const all = await json('streets-routing.json') as Array<{ highway?: string; path: [number, number][] }>;
  const ways: StreetWay[] = [];
  for (const w of all) {
    if (!w.highway || !w.path?.length) continue;
    const points = w.path.map(([lat, lng]) => toLocal(lng, lat) as Vec2);
    if (points.some(p => near(p[0], p[1], opts.radius + 150))) ways.push({ highway: w.highway, points });
  }
  return ways;
}

async function loadWaterAndBridges(): Promise<void> {
  const index = validateIndex(await json('elevation-v1/index.json'));
  const bridges = await json('elevation-v1/bridges.json') as BridgeExtract;
  const toScene = (x: number, y: number): [number, number] => { const [lng, lat] = localToLngLat(index, x, y); return toLocal(lng, lat); };
  const [sx, sy] = (() => { const [lng, lat] = [opts.lng, opts.lat]; return [(lng - index.origin[0]) * index.metresPerDegree[0], (lat - index.origin[1]) * index.metresPerDegree[1]]; })();
  const keys = cellsNear(index, sx, sy, opts.radius + 200);
  const quant = index.quantization.xy, freeboard = index.quayFreeboardM;
  const cells = (await Promise.all(keys.map(k => json(`elevation-v1/cells/${k}.json`).catch(() => null)))).filter(Boolean) as WaterCell[];
  const openings: MeshData[] = [], surfaces: MeshData[] = [], walls: MeshData[] = [];
  for (const cell of cells) {
    if (!cell.water.length) continue;
    openings.push(waterSurface(cell, index.cellSizeM, quant, 0, [1, 1, 1], toScene));
    surfaces.push(waterSurface(cell, index.cellSizeM, quant, -freeboard, [1, 1, 1], toScene));
    if (cell.shore.length) walls.push(quayWalls(cell, index.cellSizeM, quant, freeboard, toScene));
  }
  const inArea = (x: number, y: number) => { const [px, py] = toScene(x * quant, y * quant); return near(px, py, opts.radius + 100); };
  const humped = bridges.measured.filter(b => !isFlatMeasured(b) && inArea(b.p[0], b.p[1]));
  const flat = [...bridges.fallback, ...bridges.measured.filter(isFlatMeasured).map(b => ({ id: b.id, name: b.name, type: 'measured-flat', ring: b.outline }))].filter(b => inArea(b.ring[0], b.ring[1]));
  const flatDecks = flat.map(b => decodeFallback(b, quant, toScene));
  const decks = humped.map(b => measuredDeckMesh(decodeProfile(b, quant, toScene), freeboard));
  meshFrom(mergeMeshes(openings), M.opening, { order: -10, receive: false });
  if (flatDecks.length) meshFrom(mergeMeshes(flatDecks.map(d => fallbackDeckTop(d))), M.openingCut, { order: -9, receive: false });
  meshFrom(mergeMeshes(surfaces), M.water);
  meshFrom(mergeMeshes([...walls, ...flatDecks.map(d => fallbackDeckUnderside(d))]), M.quay);
  if (decks.length) meshFrom(mergeMeshes(decks), M.deck, { cast: true });
  if (flatDecks.length) meshFrom(mergeMeshes(flatDecks.map(d => fallbackDeckTop(d))), M.deck);
  log('water', { cells: cells.length, humpedDecks: humped.length, flatDecks: flatDecks.length, freeboard });
}

async function loadParks(): Promise<void> {
  const parks = await json('parks.json') as Array<{ path?: [number, number][]; paths?: [number, number][][] }>;
  const m: MeshArrays = { positions: [], normals: [], uvs: [], indices: [] };
  for (const p of parks) for (const ring of p.paths ?? (p.path ? [p.path] : [])) {
    const pts = ring.map(([lat, lng]) => toLocal(lng, lat));
    if (pts.length < 3 || !pts.some(([x, y]) => near(x, y, opts.radius + 300))) continue;
    const flat = pts.flat(), base = m.positions.length / 3;
    for (const [x, y] of pts) { m.positions.push(x, y, 0.012); m.normals.push(0, 0, 1); m.uvs.push(x, y); }
    for (const i of earcut(flat)) m.indices.push(base + i);
  }
  meshFrom(m, M.park, { order: 1 });
}

async function loadTrees(): Promise<void> {
  const z = 15, n = 2 ** z;
  const tile = (lng: number, lat: number) => [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)];
  const dLng = opts.radius / (111_320 * Math.cos(opts.lat * Math.PI / 180)), dLat = opts.radius / 110_540;
  const [x0, y0] = tile(opts.lng - dLng, opts.lat + dLat), [x1, y1] = tile(opts.lng + dLng, opts.lat - dLat);
  const keys: string[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${z}-${x}-${y}`);
  const tiles = await Promise.all(keys.map(k => json(`municipal-trees/tiles/${k}.json.gz`).catch(() => null)));
  const trees = tiles.flatMap(t => (t?.trees ?? []) as Array<{ lng: number; lat: number; height: number | null }>)
    .map(t => ({ p: toLocal(t.lng, t.lat), h: t.height ?? 9 })).filter(t => near(t.p[0], t.p[1]));
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  { // lumpy crowns: displace each vertex once
    const pos = crownGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const k = 0.86 + 0.18 * Math.abs(Math.sin(x * 7.1 + y * 3.7 + z * 5.3)); pos.setXYZ(i, x * k, y * k, z * k * 0.85); }
    crownGeo.computeVertexNormals();
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, M.trunk, trees.length);
  const crowns = new THREE.InstancedMesh(crownGeo, M.crown, trees.length);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), colour = new THREE.Color();
  const greens = ['#4f6b33', '#5d7a3a', '#465f2e', '#6b8441'];
  trees.forEach((t, i) => {
    const h = Math.max(5, Math.min(27, t.h)), r = Math.max(1.8, h * 0.3), trunkH = h * 0.45;
    m4.compose(new THREE.Vector3(t.p[0], t.p[1], 0), q4.identity(), new THREE.Vector3(1 + h / 30, 1 + h / 30, trunkH));
    trunks.setMatrixAt(i, m4);
    q4.setFromAxisAngle(new THREE.Vector3(0, 0, 1), i * 2.399);
    m4.compose(new THREE.Vector3(t.p[0], t.p[1], trunkH + r * 0.8), q4, new THREE.Vector3(r, r, r * 0.95));
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, colour.set(greens[i % greens.length]));
  });
  for (const mesh of [trunks, crowns]) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh); }
  log('trees', trees.length);
}

const gltf = new GLTFLoader();
gltf.setMeshoptDecoder(MeshoptDecoder);
async function loadLandmarks(): Promise<Set<string>> {
  const suppressed = new Set<string>();
  const specs = MANUAL_LANDMARKS.filter(s => { const a = s.surveyed?.anchor ?? s.footprint?.centre; if (!a) return false; const [x, y] = toLocal(a[0], a[1]); return near(x, y); });
  for (const s of specs) for (const id of s.suppressOsmIds) suppressed.add(id);
  let shown = 0;
  await Promise.all(specs.map(async spec => {
    try {
      const model = await gltf.loadAsync(new URL(spec.modelUrl, location.href).href);
      const imported = model.scene;
      const box = new THREE.Box3().setFromObject(imported);
      const placement = placementFor(spec, { min: box.min.toArray(), max: box.max.toArray() });
      if (spec.surveyed) imported.position.set(0, -box.min.y, 0);
      else { const c = box.getCenter(new THREE.Vector3()); imported.position.set(-c.x, -box.min.y, -c.z); }
      const inner = new THREE.Group(); inner.add(imported); inner.scale.setScalar(placement.scale);
      const outer = new THREE.Group(); outer.add(inner); outer.matrixAutoUpdate = false;
      const [ax, ay] = toLocal(placement.anchor[0], placement.anchor[1]);
      if (placement.horizontalBasis) {
        const { x, y } = placement.horizontalBasis;
        outer.matrix.set(x[0], 0, -y[0], ax, -x[1], 0, y[1], ay, 0, 1, 0, placement.altitudeMetres, 0, 0, 0, 1);
      } else {
        outer.matrix.makeTranslation(ax, ay, placement.altitudeMetres)
          .multiply(new THREE.Matrix4().makeRotationZ((90 - placement.modelRotationDegrees) * Math.PI / 180))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      }
      imported.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(outer); shown++;
    } catch (e) { console.warn('landmark failed', spec.id, e); }
  }));
  log('landmarks', { candidates: specs.length, shown });
  return suppressed;
}

async function loadBuildings(suppressed: Set<string>, ways: StreetWay[]): Promise<void> {
  const t0 = performance.now();
  const [game, textures] = await Promise.all([loadGameData(EXTRACT), buildLookTextures(THREE, opts.look === 'untextured' || opts.look === 'procedural' ? 'procedural' : opts.look as any, renderer.capabilities.getMaxAnisotropy())]);
  setShopfronts(game.shopfronts);
  const decorate = gameDecorator({ gables: game.gables, landmarkIds: game.landmarkIds, listed: game.listed });
  const tiles = await Promise.all(tilesAround(cx, cy, opts.radius).map(k => loadTile(k, EXTRACT)));
  const material = facadeMaterial(textures.colour, textures.mask);
  const streets = streetSegments(ways.map(w => ({ highway: w.highway, points: w.points.map(([x, y]) => [4.9 + x / (111_320 * Math.cos(52.37 * Math.PI / 180)), 52.37 + y / 110_540] as const) })), { lng: 4.9, lat: 52.37 });
  // 200 m cells so frustum culling has something to cull.
  const cells = new Map<string, { detail: Feature[]; coarse: Feature[] }>();
  let count = 0;
  for (const f of tiles.flat()) {
    const id = String(f.properties.id ?? '');
    if (suppressed.has(id)) continue;
    const ring = asPolygons(f.geometry)[0]?.[0];
    if (!ring?.length) continue;
    const [x, y] = toLocal(ring[0][0], ring[0][1]);
    if (!near(x, y)) continue;
    const key = `${Math.floor(x / 200)}:${Math.floor(y / 200)}`;
    const cell = cells.get(key) ?? cells.set(key, { detail: [], coarse: [] }).get(key)!;
    (near(x, y, opts.detailM) ? cell.detail : cell.coarse).push(decorate(f));
    count++;
  }
  let chunks = 0, vertices = 0;
  for (const cell of cells.values()) {
    const parts = [
      ...(cell.detail.length ? [buildFeatureChunk(cell.detail, opts.look, 'walls', streets), buildFeatureChunk(cell.detail, opts.look, 'extras', streets)] : []),
      ...(cell.coarse.length ? [buildFeatureChunk(cell.coarse, opts.look, 'coarse', streets)] : []),
    ];
    for (const chunk of parts) {
      if (!chunk.vertexCount) continue;
      const mesh = new THREE.Mesh(chunkGeometry(chunk), material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh); chunks++; vertices += chunk.vertexCount;
      await new Promise(r => setTimeout(r, 0));
    }
  }
  log('buildings', { features: count, chunks, vertices, buildMs: Math.round(performance.now() - t0) });
}

// ---------------------------------------------------------------- rider + camera
const rider = new THREE.Group();
scene.add(rider);
async function loadBike(): Promise<void> {
  const model = await gltf.loadAsync(new URL('omafiets-runtime.glb', location.href).href);
  const s = model.scene;
  s.traverse((o: any) => { if (/baby|child|kinder/i.test(o.name ?? '')) o.visible = false; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(s), size = box.getSize(new THREE.Vector3());
  const k = (opts.cam === 'map' ? 4.5 : 1.9) / Math.max(size.x, size.z);
  s.scale.setScalar(k);
  const b2 = new THREE.Box3().setFromObject(s), c = b2.getCenter(new THREE.Vector3());
  s.position.set(-c.x, -b2.min.y, -c.z);
  const upright = new THREE.Group(); upright.rotation.x = Math.PI / 2; upright.add(s);
  rider.add(upright);
}

let path: Vec2[] = [], cumulative: number[] = [];
let distance = 0, riderPos: Vec2 = [cx, cy], riderDir: Vec2 = [0, 1];
const riderParam = q.get('rider')?.split(',').map(Number);
if (riderParam && riderParam.length >= 3) {
  riderPos = toLocal(riderParam[0], riderParam[1]);
  const b = riderParam[2] * Math.PI / 180; riderDir = [Math.sin(b), Math.cos(b)];
}
const mapcam = q.get('mapcam')?.split(',').map(Number);
const SPEED = 5.5; // m/s, a brisk omafiets
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camInit = false;

function updateCamera(dt: number): void {
  if (opts.auto && path.length > 1) {
    distance += SPEED * dt;
    const s = sampleAlong(path, cumulative, distance);
    riderPos = s.p;
    // Ease the heading so corners turn instead of snap.
    const k = 1 - Math.exp(-dt * 4);
    const nx = riderDir[0] + (s.dir[0] - riderDir[0]) * k, ny = riderDir[1] + (s.dir[1] - riderDir[1]) * k, l = Math.hypot(nx, ny) || 1;
    riderDir = [nx / l, ny / l];
  }
  rider.position.set(riderPos[0], riderPos[1], 0.02);
  rider.rotation.z = Math.atan2(riderDir[1], riderDir[0]);
  let eye: THREE.Vector3, look: THREE.Vector3;
  if (opts.cam === 'map') {
    const bearing = mapcam ? mapcam[4] : Math.atan2(riderDir[0], riderDir[1]) * 180 / Math.PI;
    const centre: Vec2 = mapcam ? toLocal(mapcam[0], mapcam[1]) : [riderPos[0] + riderDir[0] * 14, riderPos[1] + riderDir[1] * 14];
    const fov = mapcam?.[5] ?? 36.87;
    camera.fov = fov;
    const r = mapLibreEye({ centre, zoom: mapcam?.[2] ?? 18.3, pitchDeg: mapcam?.[3] ?? 48, bearingDeg: bearing, fovDeg: fov, lat: opts.lat }, innerHeight);
    eye = new THREE.Vector3(...r.eye); look = new THREE.Vector3(...r.target);
  } else {
    eye = new THREE.Vector3(riderPos[0] - riderDir[0] * 7.5, riderPos[1] - riderDir[1] * 7.5, 3.4);
    look = new THREE.Vector3(riderPos[0] + riderDir[0] * 10, riderPos[1] + riderDir[1] * 10, 1.4);
  }
  const k = camInit ? 1 - Math.exp(-dt * 6) : 1; camInit = true;
  camPos.lerp(eye, k); camLook.lerp(look, k);
  camera.position.copy(camPos); camera.lookAt(camLook); camera.updateProjectionMatrix();
  // One shadow map follows the view: centred ahead of the camera, snapped to texels.
  const focus = opts.cam === 'map' ? camLook.clone() : new THREE.Vector3(riderPos[0] + riderDir[0] * 60, riderPos[1] + riderDir[1] * 60, 0);
  const texel = (2 * SHADOW_HALF) / opts.shadowSize;
  focus.x = Math.round(focus.x / texel) * texel; focus.y = Math.round(focus.y / texel) * texel;
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 400);
  sun.target.updateMatrixWorld();
  if (M.water.normalMap) M.water.normalMap.offset.set(performance.now() * 0.00002, performance.now() * 0.000013);
}

// ---------------------------------------------------------------- HUD + loop
const hud = document.createElement('pre');
hud.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.55);border-radius:4px;pointer-events:none;max-width:calc(100vw - 32px);white-space:pre-wrap';
if (opts.hud) document.body.appendChild(hud);
let last = performance.now(), hudAt = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  spike.frames.push(now - last); last = now;
  if (spike.frames.length > 4000) spike.frames.splice(0, 2000);
  updateCamera(dt);
  renderer.info.reset();
  const t0 = performance.now();
  if (composer) composer.render(dt); else renderer.render(scene, camera);
  spike.renderMs.push(performance.now() - t0);
  if (spike.renderMs.length > 4000) spike.renderMs.splice(0, 2000);
  spike.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  if (opts.hud && now - hudAt > 500) {
    hudAt = now;
    const recent = spike.frames.slice(-60).sort((a: number, b: number) => a - b);
    hud.textContent = `own-renderer spike  ${spike.ready ? '' : 'loading…'}\nframe ${recent[recent.length >> 1]?.toFixed(1)} ms  calls ${spike.info.calls}  tris ${(spike.info.triangles / 1e6).toFixed(2)}M\nshadows ${opts.shadows} ao ${opts.ao} dpr ${opts.dpr}\n${JSON.stringify(status)}`;
  }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  composer?.setSize(innerWidth, innerHeight); gtao?.setSize(size.x, size.y);
});

async function main(): Promise<void> {
  const t0 = performance.now();
  // A big paved ground plane; the canal openings punch through it by stencil.
  const groundSize = 2 * opts.radius + 2400;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), M.ground);
  { const uv = ground.geometry.getAttribute('uv'), pos = ground.geometry.getAttribute('position'); for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + cx, pos.getY(i) + cy); }
  ground.position.set(cx, cy, 0); ground.receiveShadow = true; ground.renderOrder = 0; scene.add(ground);
  requestAnimationFrame(frame);
  const streetsP = loadStreets();
  const landmarksP = loadLandmarks();
  await Promise.all([
    loadWaterAndBridges(), loadParks(), loadTrees(), loadBike(),
    streetsP.then(ways => {
      const meshes = buildStreetMeshes(ways.filter(w => w.points.some(p => near(p[0], p[1], opts.radius + 50))));
      for (const s of ['paving', 'klinker', 'asphalt', 'cycle'] as const) meshFrom(meshes[s], M[s], { order: 2 });
      meshFrom(meshes.paint, M.paint, { order: 3 });
      log('streets', meshes.stats);
      if (opts.auto && !riderParam) {
        path = autopilotPath(ways, [cx, cy]); cumulative = cumulativeLengths(path);
        log('ride', { points: path.length, metres: Math.round(cumulative[cumulative.length - 1]) });
      }
    }),
    Promise.all([landmarksP, streetsP]).then(([suppressed, ways]) => loadBuildings(suppressed, ways)),
  ]);
  log('loadMs', Math.round(performance.now() - t0));
  spike.ready = true;
}
main().catch(e => { log('error', String(e)); console.error(e); });
