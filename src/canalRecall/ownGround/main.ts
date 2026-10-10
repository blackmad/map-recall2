// Own-ground prototype (2026-10-09): three.js draws the whole riding-view
// ground on AHN relief — streets by OSM cross-section, parks and squares, the
// canal water at canal level, quay walls, and bridge decks that join the
// roads — plus the route ribbon and a question-street highlight draped on it,
// and buildings/trees/landmarks/bike standing on it. Not wired into the game.
// See docs/research/own-ground-20261009.md.
//
// Build: npx esbuild src/canalRecall/ownGround/main.ts --bundle --format=esm \
//          --loader:.json=json --minify --outfile=public/canal-drive/js/own-ground.bundle.js
// Page:  /canal-drive/own-ground.html?box=nassaukade   (or box=leidsegracht, or lat=&lng=)
// Params: r (radius m), cam=chase|map, mapcam=lng,lat,zoom,pitch,bearing[,fov],
//         cam=free&eye=lng,lat,z&look=lng,lat,z (scene z; water is −1.77), rider=lng,lat,bearingDeg, auto=0|1, route=0|1, highlight=<street name>,
//         buildings=0|1, relief=1|0 (0 = flat z=0 everywhere, for A/B), exag=<relief exaggeration>,
//         hide=<label prefixes, e.g. street:,land,area:> (debug), fx=0, shadows, ao, dpr, hud=0, land=<grid step m>.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import earcut from 'earcut';
import { fromLocal, gameDecorator, loadGameData, loadTile, tilesAround, toLocal, type Feature } from '../galleryPipeline.js';
import { setShopfronts } from '../shopfronts.js';
import { asPolygons, buildFeatureChunk, type BuildingLook } from '../threeBuildingFeatures.js';
import { buildLookTextures } from '../threeBuildingsBrowser.js';
import { streetSegments } from '../streetFronts.js';
import { validateIndex, localToLngLat, cellsNear, type WaterCell, type BridgeExtract } from '../elevation/elevationData.js';
import { decodeProfile, decodeFallback } from '../elevation/bridgeDeck.js';
import { MANUAL_LANDMARKS } from '../landmarks/manualModels.js';
import { placementFor } from '../landmarks/signaturePlacement.js';
import { lngLatToRd } from '../facade/rdNew.js';
import { chunkGeometry, facadeMaterial } from '../rendererSpike/facadeMaterial.js';
import { mapLibreEye } from '../rendererSpike/ride.js';
import { fitLocalToRd, GroundField, readGroundTile, type GroundIndex } from './heightField.js';
import { GroundSurface, riderPose, type Vec2 } from './surface.js';
import { boxById } from './boxes.js';
import type { OsmGroundExtract } from './osmGround.js';
import { buildStreets, isBridgeWay, prepareWays, routeRibbon, streetTriangles, LIFT, type LocalWay } from './streets.js';
import { drapeTriangles, emptyMesh, reliefGrid, merge, triangleCount, type MeshArrays } from './drape.js';
import { buildWaterMask, maskDistance, maskTexels, quayWallMesh, waterSurfaceMesh, type WaterGeometry } from './water.js';
import { flatDeckBody, measuredDeckBody } from './decks.js';
import { footprintBase, liftRanges } from './placement.js';
import { routeAhead } from './route.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.get(k) !== null && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
const flag = (k: string, d: boolean) => (q.get(k) === null ? d : q.get(k) === '1');
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const fxOff = q.get('fx') === '0';
const box = boxById(q.get('box') ?? 'nassaukade') ?? boxById('nassaukade')!;
const opts = {
  lat: num('lat', box.lat), lng: num('lng', box.lng), radius: num('r', box.halfM),
  cam: (q.get('cam') ?? 'chase') as 'chase' | 'map' | 'free',
  auto: flag('auto', true), hud: flag('hud', true), route: flag('route', true), buildings: flag('buildings', true),
  relief: flag('relief', true), exag: num('exag', 1), highlight: q.get('highlight') ?? '',
  shadows: !fxOff && flag('shadows', true), ao: !fxOff && flag('ao', !coarsePointer),
  sky: !fxOff, fog: !fxOff, tone: !fxOff,
  dpr: num('dpr', coarsePointer ? Math.min(window.devicePixelRatio || 1, 1.5) : window.devicePixelRatio || 1),
  look: (q.get('look') ?? 'photo') as BuildingLook,
  shadowSize: num('shadowmap', coarsePointer ? 1024 : 2048),
  detailM: num('detail', 380), landStep: num('land', 5),
};
const EXTRACT = '../data/extracts/amsterdam';
const [cx, cy] = toLocal(opts.lng, opts.lat);
const status: Record<string, unknown> = {};
const proto: any = { ready: false, status, frames: [] as number[], renderMs: [] as number[], opts, build: {} as Record<string, number> };
(window as any).__ownGround = proto;
const log = (k: string, v: unknown) => { status[k] = v; };
const timed = async <T>(label: string, f: () => T | Promise<T>): Promise<T> => { const t = performance.now(); const r = await f(); proto.build[label] = Math.round(performance.now() - t); return r; };

// ---------------------------------------------------------------- renderer (as the spike)
const renderer = new THREE.WebGLRenderer({ antialias: !opts.tone, powerPreference: 'high-performance' });
renderer.setPixelRatio(opts.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = opts.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = opts.tone ? THREE.NeutralToneMapping : THREE.NoToneMapping;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(opts.cam === 'map' ? 36.87 : 55, innerWidth / innerHeight, 0.5, 4000);
camera.up.set(0, 0, 1);
const SUN_AZ = 225 * Math.PI / 180, SUN_EL = 34 * Math.PI / 180;
const sunDir = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.cos(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL)).normalize();
if (opts.sky) {
  const sky = new Sky();
  sky.scale.setScalar(1000);
  const u = (sky.material as THREE.ShaderMaterial).uniforms;
  u.up.value.set(0, 0, 1); u.sunPosition.value.copy(sunDir);
  u.turbidity.value = 6; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.8;
  const skyScene = new THREE.Scene(); skyScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(skyScene, 0, 1, 2000).texture;
  scene.environment = env; scene.background = env; scene.backgroundBlurriness = 0.15; scene.environmentIntensity = 0.22;
  pmrem.dispose();
} else scene.background = new THREE.Color('#d9e4ec');
if (opts.fog) scene.fog = new THREE.Fog('#c4d0d8', 260, 1300);
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
proto.three = { THREE, scene, sun, renderer, camera };
let composer: EffectComposer | null = null, gtao: GTAOPass | null = null;
if (opts.tone) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: true, samples: coarsePointer ? 0 : 4 });
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
const pavers = (base: [number, number, number], joint: string, metres: number, w: number, h: number) => canvasTexture(512, metres, (g, s) => {
  g.fillStyle = joint; g.fillRect(0, 0, s, s);
  const pw = s * w / metres, ph = s * h / metres;
  for (let row = 0, y = 0; y < s; row++, y += ph) for (let x = row % 2 ? -pw / 2 : 0; x < s; x += pw) {
    const v = (rnd() - 0.5) * 26;
    g.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.9},${base[2] + v * 0.8})`;
    g.fillRect(x + 1.5, y + 1.5, pw - 3, ph - 3);
  }
});
const maskUniforms = { waterMask: { value: null as THREE.Texture | null }, maskOrigin: { value: new THREE.Vector2() }, maskSize: { value: new THREE.Vector2(1, 1) } };
/** Ground materials discard over water (the signed-distance mask), so canals open without a stencil. */
/** Channel r cuts by water (land, parks); g by water minus bridge decks (street bands). */
function cutByWater<T extends THREE.Material>(m: T, channel: 'r' | 'g' = 'r'): T {
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, maskUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMaskXY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMaskXY = (modelMatrix * vec4(transformed, 1.0)).xy;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMaskXY;\nuniform sampler2D waterMask;\nuniform vec2 maskOrigin;\nuniform vec2 maskSize;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (texture2D(waterMask, (vMaskXY - maskOrigin) / maskSize).${channel} < 0.5) discard;`);
  };
  m.customProgramCacheKey = () => `cutByWater-${channel}`;
  return m;
}
const surfaceMaterial = (map: THREE.Texture, roughness = 0.95) => new THREE.MeshStandardMaterial({ map, roughness, metalness: 0 });
const M = {
  land: cutByWater(surfaceMaterial(pavers([150, 142, 130], '#6f675d', 3, 0.3, 0.3))),
  klinker: surfaceMaterial(pavers([128, 82, 66], '#5a463d', 2, 0.2, 0.1), 0.9),
  asphalt: surfaceMaterial(canvasTexture(256, 4, (g, s) => noise(g, s, [72, 74, 78], 18))),
  cycle: surfaceMaterial(canvasTexture(256, 4, (g, s) => noise(g, s, [146, 70, 62], 18)), 0.85),
  paving: surfaceMaterial(pavers([168, 160, 148], '#7d756a', 3, 0.3, 0.3)),
  gravel: surfaceMaterial(canvasTexture(256, 4, (g, s) => noise(g, s, [170, 156, 128], 30, 2))),
  kerb: new THREE.MeshStandardMaterial({ color: '#9b958b', roughness: 0.9 }),
  paint: new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.6 }),
  park: cutByWater(new THREE.MeshStandardMaterial({ map: canvasTexture(256, 6, (g, s) => noise(g, s, [92, 122, 66], 30, 3)), roughness: 1 })),
  wood: cutByWater(new THREE.MeshStandardMaterial({ map: canvasTexture(256, 6, (g, s) => noise(g, s, [70, 96, 52], 34, 3)), roughness: 1 })),
  square: cutByWater(surfaceMaterial(pavers([176, 166, 150], '#857c70', 4, 0.6, 0.6))),
  parking: cutByWater(surfaceMaterial(canvasTexture(256, 4, (g, s) => noise(g, s, [92, 92, 96], 16)))),
  quay: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  deck: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  water: new THREE.MeshStandardMaterial({ color: '#304b4d', roughness: 0.1, metalness: 0, envMapIntensity: 2.2 }),
  route: new THREE.MeshStandardMaterial({ color: '#2f7cf6', emissive: '#1d4fb0', emissiveIntensity: 0.5, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  highlight: new THREE.MeshStandardMaterial({ color: '#ffc531', emissive: '#7a5600', emissiveIntensity: 0.5, roughness: 0.6, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#4a3b2f', roughness: 1 }),
  crown: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }),
};
// Coplanar ground layers: a few millimetres of lift plus a polygon offset per layer, so a
// coarse park triangle never pokes through a finely sampled street on a slope.
const layerOffset: [THREE.Material, number][] = [[M.park, 1], [M.wood, 1], [M.square, 1], [M.parking, 1], [M.klinker, 2], [M.asphalt, 2], [M.gravel, 3], [M.cycle, 3], [M.paving, 3], [M.paint, 4], [M.highlight, 5], [M.route, 6]];
for (const [m, k] of layerOffset) Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -2 * k });
// Street bands: discarded over water except on bridge decks (mask channel g).
for (const k of ['paving', 'klinker', 'asphalt', 'cycle', 'gravel', 'kerb', 'paint'] as const) cutByWater(M[k], 'g');
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

const stats = { triangles: {} as Record<string, number>, vertices: {} as Record<string, number>, geometryBytes: 0 };
const hidden = (q.get('hide') ?? '').split(',').filter(Boolean);
function meshFrom(label: string, data: MeshArrays, material: THREE.Material, o: { cast?: boolean; receive?: boolean; order?: number } = {}): THREE.Mesh | null {
  if (!data.indices.length || hidden.some(h => label.startsWith(h))) return null;
  const g = new THREE.BufferGeometry();
  const pos = Float32Array.from(data.positions), uv = Float32Array.from(data.uvs), idx = Uint32Array.from(data.indices);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // Vertex colours are authored in sRGB; three treats them as linear.
  if (data.colors) g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(data.colors, c => Math.pow(c, 2.2)), 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  stats.triangles[label] = (stats.triangles[label] ?? 0) + idx.length / 3;
  stats.vertices[label] = (stats.vertices[label] ?? 0) + pos.length / 3;
  stats.geometryBytes += pos.byteLength * 2 + uv.byteLength + idx.byteLength + (data.colors ? pos.byteLength : 0);
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = !!o.cast; mesh.receiveShadow = o.receive ?? true;
  if (o.order !== undefined) mesh.renderOrder = o.order;
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- data
const near = (x: number, y: number, r = opts.radius) => Math.abs(x - cx) <= r && Math.abs(y - cy) <= r;
async function fetchBytes(path: string): Promise<Uint8Array> {
  const r = await fetch(`${EXTRACT}/${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return bytes;
}
const json = async (path: string) => JSON.parse(new TextDecoder().decode(await fetchBytes(path)));

const pad = 250; // build the ground this far beyond the box so the horizon is not a cliff
const X0 = cx - opts.radius - pad, Y0 = cy - opts.radius - pad, X1 = cx + opts.radius + pad, Y1 = cy + opts.radius + pad;

async function loadSurface(): Promise<GroundSurface> {
  const index = await json('ground-height-v1/index.json') as GroundIndex;
  const toRd = (x: number, y: number): [number, number] => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; };
  const { map: localToRd, maxResidualM } = fitLocalToRd(toRd, cx, cy, opts.radius + pad);
  const field = new GroundField(index.stepM, index.tileSizeM);
  const corners = [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]].map(([x, y]) => toRd(x, y));
  const tx0 = Math.floor(Math.min(...corners.map(c => c[0])) / index.tileSizeM), tx1 = Math.floor(Math.max(...corners.map(c => c[0])) / index.tileSizeM);
  const ty0 = Math.floor(Math.min(...corners.map(c => c[1])) / index.tileSizeM), ty1 = Math.floor(Math.max(...corners.map(c => c[1])) / index.tileSizeM);
  const wanted = index.tiles.filter(([tx, ty]) => tx >= tx0 && tx <= tx1 && ty >= ty0 && ty <= ty1);
  let bytes = 0;
  await Promise.all(wanted.map(async entry => {
    const [tx, ty] = entry;
    const raw = await fetchBytes(`ground-height-v1/tiles/${tx}_${ty}.bin`);
    bytes += raw.byteLength;
    const h = readGroundTile(index, entry, raw);
    if (opts.exag !== 1) for (let i = 0; i < h.length; i++) h[i] = index.sceneDatumNAP + (h[i] - index.sceneDatumNAP) * opts.exag;
    field.addTile(tx, ty, h);
  }));
  const surface = new GroundSurface(field, localToRd, index.sceneDatumNAP);
  if (!opts.relief) surface.ground = () => 0;
  log('relief', { tiles: field.tileCount, decodedMB: +(bytes / 1048576).toFixed(1), rdFitResidualM: +maxResidualM.toFixed(4), datumNAP: index.sceneDatumNAP, exag: opts.exag });
  proto.surface = surface;
  return surface;
}

const WATER_Z = -1.77;
async function loadWater(surface: GroundSurface): Promise<{ geo: WaterGeometry; overWater: (x: number, y: number) => boolean }> {
  const index = validateIndex(await json('elevation-v1/index.json'));
  const bridges = await json('elevation-v1/bridges.json') as BridgeExtract;
  const toScene = (x: number, y: number): Vec2 => { const [lng, lat] = localToLngLat(index, x, y); return toLocal(lng, lat); };
  const [sx, sy] = [(opts.lng - index.origin[0]) * index.metresPerDegree[0], (opts.lat - index.origin[1]) * index.metresPerDegree[1]];
  const keys = cellsNear(index, sx, sy, (opts.radius + pad) * 1.5);
  const quant = index.quantization.xy;
  const cells = (await Promise.all(keys.map(k => json(`elevation-v1/cells/${k}.json`).catch(() => null)))).filter(Boolean) as WaterCell[];
  const geo: WaterGeometry = { polygons: [], shores: [] };
  for (const cell of cells) {
    const ox = cell.cell[0] * index.cellSizeM, oy = cell.cell[1] * index.cellSizeM;
    const ring = (r: number[]) => { const out: Vec2[] = []; for (let i = 0; i < r.length; i += 2) out.push(toScene(ox + r[i] * quant, oy + r[i + 1] * quant)); return out; };
    for (const poly of cell.water) geo.polygons.push(poly.map(ring));
    for (const line of cell.shore) geo.shores.push(ring(line));
  }
  // Decks first (the street mask needs their footprints): every measured profile in the area placed on the relief.
  const inArea = (x: number, y: number) => { const [px, py] = toScene(x * quant, y * quant); return near(px, py, opts.radius + pad); };
  const measured = bridges.measured.filter(b => inArea(b.p[0], b.p[1]));
  let endError = 0;
  for (const b of measured) {
    surface.addDeck(decodeProfile(b, quant, toScene));
    // Validation: our relief at the profile's raw approach ends vs the AHN height the bridge pipeline recorded there.
    const raw: { s: number; x: number; y: number }[] = [];
    for (let i = 0; i + 3 < b.p.length; i += 4) { const [x, y] = toScene(b.p[i] * quant, b.p[i + 1] * quant); raw.push({ s: b.p[i + 2], x, y }); }
    raw.sort((a, c) => a.s - c.s);
    const e0 = raw[0], e1 = raw[raw.length - 1];
    endError = Math.max(endError, Math.abs(surface.ground(e0.x, e0.y) + surface.datumNAP - b.endpointNAP[0]), Math.abs(surface.ground(e1.x, e1.y) + surface.datumNAP - b.endpointNAP[1]));
  }
  const flatRings: Vec2[][] = [];
  for (const b of bridges.fallback.filter(f => inArea(f.ring[0], f.ring[1]))) {
    const ring = decodeFallback(b, quant, toScene).ring, pts: Vec2[] = [];
    for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
    flatRings.push(pts);
  }
  const deckRings = [...surface.decks.map(d => GroundSurface.footprint(d)), ...flatRings];
  const mask = await timed('waterMaskMs', () => buildWaterMask(geo, X0, Y0, X1, Y1, 1, 4, deckRings));
  const tex = new THREE.DataTexture(maskTexels(mask), mask.width, mask.height, THREE.RGFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.unpackAlignment = 2; tex.needsUpdate = true;
  maskUniforms.waterMask.value = tex; maskUniforms.maskOrigin.value.set(X0, Y0); maskUniforms.maskSize.value.set(mask.width * mask.res, mask.height * mask.res);
  const overWater = (x: number, y: number) => maskDistance(mask, x, y) < 0;
  proto.mask = mask; proto.maskDistance = (x: number, y: number) => maskDistance(mask, x, y);
  const deckBodies = surface.decks.map(deck => measuredDeckBody(deck, surface.ground, overWater, WATER_Z));
  const flatTops: MeshArrays[] = [], flatBodies: MeshArrays[] = [];
  for (const pts of flatRings) {
    const { top, body } = flatDeckBody(pts, surface.height, overWater);
    flatTops.push(top); flatBodies.push(body);
  }
  meshFrom('water', waterSurfaceMesh(geo, WATER_Z), M.water);
  // Wall tops follow the full riding surface, so they rise with a bridge's approach ramps and abutments.
  // Only the shores inside the built area (the cells reach further), 4 m wall segments.
  const inBuilt = (p: Vec2) => p[0] >= X0 && p[0] <= X1 && p[1] >= Y0 && p[1] <= Y1;
  const shores = geo.shores.map(line => line.filter(inBuilt)).filter(line => line.length > 1);
  meshFrom('quay', quayWallMesh({ polygons: [], shores }, surface.height, WATER_Z, 4, 0.35), M.quay);
  meshFrom('decks', merge([...deckBodies, ...flatBodies]), M.deck, { cast: true });
  meshFrom('decks', merge(flatTops), M.deck);
  log('water', { cells: cells.length, measuredDecks: measured.length, flatDecks: flatTops.length, maxDeckEndErrorM: +endError.toFixed(2), mask: `${mask.width}x${mask.height}` });
  return { geo, overWater };
}

async function loadGround(surface: GroundSurface): Promise<LocalWay[]> {
  const osm = await json(`own-ground-osm-v1/${box.id}.json`) as OsmGroundExtract;
  const project = (p: [number, number]) => toLocal(p[0], p[1]) as Vec2;
  // Relief grid; quads deep inside a canal are skipped (the mask cuts the rest).
  const keepLand = (x: number, y: number) => !proto.maskDistance || proto.maskDistance(x, y) > -(opts.landStep * 0.71 + 0.2);
  const land = await timed('landMs', () => reliefGrid(X0, Y0, X1, Y1, opts.landStep, surface.ground, keepLand));
  meshFrom('land', land, M.land, { order: 0 });
  const areas: Record<string, MeshArrays> = { park: emptyMesh(), wood: emptyMesh(), square: emptyMesh(), parking: emptyMesh() };
  await timed('areasMs', () => {
    for (const a of osm.areas) {
      const target = a.kind === 'grass' ? areas.park : a.kind === 'paved' ? areas.square : areas[a.kind];
      if (!target) continue;
      for (const r of a.rings) {
        const pts = r.slice(0, -1).map(project);
        if (pts.length < 3 || !pts.some(p => near(p[0], p[1], opts.radius + pad))) continue;
        const flat = pts.flatMap(p => [p[0], p[1]]);
        drapeTriangles(target, flat, earcut(flat), surface.height, LIFT.area + (a.kind === 'square' || a.kind === 'paved' ? 0.004 : 0), 8);
      }
    }
  });
  for (const k of Object.keys(areas)) meshFrom(`area:${k}`, areas[k], (M as any)[k], { order: 1 });
  const ways = prepareWays(osm.ways, project).filter(w => w.points.some(p => near(p[0], p[1], opts.radius + pad)));
  // All street bands are cut by the water-minus-decks mask channel: a sidewalk never overhangs a quay,
  // and over water a band survives only on a bridge deck. Bridge ways are sampled finer (decks hump over metres).
  const streets = await timed('streetsMs', () => buildStreets(ways, surface.height, { step: 3, only: w => !isBridgeWay(w) }));
  const onBridges = await timed('bridgeStreetsMs', () => buildStreets(ways, surface.height, { step: 1.5, only: isBridgeWay }));
  for (const s of ['paving', 'klinker', 'asphalt', 'cycle', 'gravel', 'kerb', 'paint'] as const) meshFrom(`street:${s}`, merge([streets[s], onBridges[s]]), M[s], { order: 2 });
  log('streets', { ...streets.stats, bridgeWays: onBridges.stats.ways, metres: Math.round(streets.stats.metres + onBridges.stats.metres), triangles: streetTriangles(streets) + streetTriangles(onBridges) });
  if (opts.highlight) {
    const lines = ways.filter(w => w.tags.name === opts.highlight && w.section.bands[0]?.kind === 'carriageway');
    const m = merge(lines.map(w => routeRibbon(w.points, surface.height, w.section.coreHalfWidth * 2 + 0.6, LIFT.route - 0.01)));
    meshFrom('highlight', m, M.highlight, { order: 4, receive: false });
    log('highlight', { name: opts.highlight, ways: lines.length });
  }
  return ways;
}

async function loadTrees(surface: GroundSurface): Promise<void> {
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
  { const pos = crownGeo.getAttribute('position'); for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z2 = pos.getZ(i); const k = 0.86 + 0.18 * Math.abs(Math.sin(x * 7.1 + y * 3.7 + z2 * 5.3)); pos.setXYZ(i, x * k, y * k, z2 * k * 0.85); } crownGeo.computeVertexNormals(); }
  const trunks = new THREE.InstancedMesh(trunkGeo, M.trunk, trees.length), crowns = new THREE.InstancedMesh(crownGeo, M.crown, trees.length);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), colour = new THREE.Color(), greens = ['#3f5a2a', '#4b6830', '#384f26', '#566f35'];
  trees.forEach((t, i) => {
    const base = surface.ground(t.p[0], t.p[1]) - 0.05; // trees stand on the relief
    const h = Math.max(5, Math.min(27, t.h)), r = Math.max(1.8, h * 0.3), trunkH = h * 0.45;
    m4.compose(new THREE.Vector3(t.p[0], t.p[1], base), q4.identity(), new THREE.Vector3(1 + h / 30, 1 + h / 30, trunkH)); trunks.setMatrixAt(i, m4);
    q4.setFromAxisAngle(new THREE.Vector3(0, 0, 1), i * 2.399);
    m4.compose(new THREE.Vector3(t.p[0], t.p[1], base + trunkH + r * 0.8), q4, new THREE.Vector3(r, r, r * 0.95)); crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, colour.set(greens[i % greens.length]));
  });
  for (const mesh of [trunks, crowns]) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh); }
  log('trees', trees.length);
}

const gltf = new GLTFLoader();
gltf.setMeshoptDecoder(MeshoptDecoder);
async function loadLandmarks(surface: GroundSurface): Promise<Set<string>> {
  const suppressed = new Set<string>();
  const specs = MANUAL_LANDMARKS.filter(s => { const a = s.surveyed?.anchor ?? s.footprint?.centre; if (!a) return false; const [x, y] = toLocal(a[0], a[1]); return near(x, y); });
  for (const s of specs) for (const id of s.suppressOsmIds) suppressed.add(id);
  const placed: Record<string, number> = {};
  await Promise.all(specs.map(async spec => {
    try {
      const model = await gltf.loadAsync(new URL(spec.modelUrl, location.href).href);
      const imported = model.scene, b = new THREE.Box3().setFromObject(imported);
      const placement = placementFor(spec, { min: b.min.toArray(), max: b.max.toArray() });
      if (spec.surveyed) imported.position.set(0, -b.min.y, 0); else { const c = b.getCenter(new THREE.Vector3()); imported.position.set(-c.x, -b.min.y, -c.z); }
      const inner = new THREE.Group(); inner.add(imported); inner.scale.setScalar(placement.scale);
      const outer = new THREE.Group(); outer.add(inner); outer.matrixAutoUpdate = false;
      const [ax, ay] = toLocal(placement.anchor[0], placement.anchor[1]);
      // Base on the relief: the lowest ground in a 6 m square around the anchor.
      let base = Infinity;
      for (const dx of [-3, 0, 3]) for (const dy of [-3, 0, 3]) base = Math.min(base, surface.ground(ax + dx, ay + dy));
      placed[spec.id] = +base.toFixed(2);
      const alt = placement.altitudeMetres + base;
      if (placement.horizontalBasis) { const { x, y } = placement.horizontalBasis; outer.matrix.set(x[0], 0, -y[0], ax, -x[1], 0, y[1], ay, 0, 1, 0, alt, 0, 0, 0, 1); }
      else outer.matrix.makeTranslation(ax, ay, alt).multiply(new THREE.Matrix4().makeRotationZ((90 - placement.modelRotationDegrees) * Math.PI / 180)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      imported.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(outer);
    } catch (e) { console.warn('landmark failed', spec.id, e); }
  }));
  log('landmarks', { candidates: specs.length, bases: placed });
  return suppressed;
}

async function loadBuildings(surface: GroundSurface, suppressed: Set<string>, ways: LocalWay[]): Promise<void> {
  const t0 = performance.now();
  const [game, textures] = await Promise.all([loadGameData(EXTRACT), buildLookTextures(THREE, opts.look === 'untextured' || opts.look === 'procedural' ? 'procedural' : opts.look as any, renderer.capabilities.getMaxAnisotropy())]);
  setShopfronts(game.shopfronts);
  const decorate = gameDecorator({ gables: game.gables, landmarkIds: game.landmarkIds, listed: game.listed });
  const tiles = await Promise.all(tilesAround(cx, cy, opts.radius * 1.42).map(k => loadTile(k, EXTRACT)));
  const material = facadeMaterial(textures.colour, textures.mask);
  const hwClass = (w: LocalWay) => (w.section.bands[0]?.kind === 'carriageway' ? w.tags.highway : w.tags.highway);
  const streets = streetSegments(ways.map(w => ({ highway: hwClass(w), points: w.points.map(([x, y]) => fromLocal(x, y) as unknown as readonly [number, number]) })), { lng: 4.9, lat: 52.37 });
  const cells = new Map<string, { detail: Feature[]; coarse: Feature[] }>();
  const bases = new Map<string, number>();
  let count = 0, spread = 0;
  for (const f of tiles.flat()) {
    const id = String(f.properties.id ?? '');
    if (suppressed.has(id)) continue;
    const ring = asPolygons(f.geometry)[0]?.[0];
    if (!ring?.length) continue;
    const local = ring.map(([lng, lat]) => toLocal(lng, lat) as Vec2);
    const [x, y] = local[0];
    if (!near(x, y)) continue;
    const b = footprintBase(local, surface.ground);
    bases.set(id, b.base); spread = Math.max(spread, b.max - b.base);
    const key = `${Math.floor(x / 200)}:${Math.floor(y / 200)}`;
    const cell = cells.get(key) ?? cells.set(key, { detail: [], coarse: [] }).get(key)!;
    // Full detail (roofs, relief) near the rider; coarse shells beyond.
    (Math.hypot(x - riderPos[0], y - riderPos[1]) <= opts.detailM ? cell.detail : cell.coarse).push(decorate(f));
    count++;
  }
  let chunks = 0, vertices = 0, lifted = 0;
  const chunkErrors: string[] = [];
  for (const cell of cells.values()) {
    // A detail chunk can throw on an odd feature in the game's decorator chain (seen once near the
    // Leidsegracht: "reading 'c19'"); fall back to the coarse shell for that cell instead of failing the page.
    const build = (features: Feature[], mode: 'walls' | 'extras' | 'coarse'): ReturnType<typeof buildFeatureChunk>[] => { try { return [buildFeatureChunk(features, opts.look, mode, streets)]; } catch (e) { chunkErrors.push(String(e)); return mode === 'extras' ? [] : mode === 'walls' ? build(features, 'coarse') : []; } };
    const parts = [
      ...(cell.detail.length ? [...build(cell.detail, 'walls'), ...build(cell.detail, 'extras')] : []),
      ...(cell.coarse.length ? build(cell.coarse, 'coarse') : []),
    ];
    for (const chunk of parts) {
      if (!chunk.vertexCount) continue;
      // Every building stands on its own footprint's lowest relief.
      lifted += liftRanges(chunk.positions, chunk.ranges, id => bases.get(id));
      const mesh = new THREE.Mesh(chunkGeometry(chunk), material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh); chunks++; vertices += chunk.vertexCount;
      stats.triangles.buildings = (stats.triangles.buildings ?? 0) + chunk.indices.length / 3;
      await new Promise(r => setTimeout(r, 0));
    }
  }
  const sample = [...bases.entries()].slice(0, 5).map(([id, z]) => `${id}:${z.toFixed(2)}`);
  log('buildings', { features: count, chunks, vertices, liftedRanges: lifted, chunkErrors: chunkErrors.slice(0, 3), maxFootprintSpreadM: +spread.toFixed(2), sample, buildMs: Math.round(performance.now() - t0) });
  proto.buildingBases = Object.fromEntries(bases);
}

// ---------------------------------------------------------------- rider + camera
const rider = new THREE.Group();
scene.add(rider);
async function loadBike(): Promise<void> {
  const model = await gltf.loadAsync(new URL('omafiets-runtime.glb', location.href).href);
  const s = model.scene;
  s.traverse((o: any) => { if (/baby|child|kinder/i.test(o.name ?? '')) o.visible = false; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const b = new THREE.Box3().setFromObject(s), size = b.getSize(new THREE.Vector3());
  s.scale.setScalar((opts.cam === 'map' ? 4.5 : 1.9) / Math.max(size.x, size.z));
  const b2 = new THREE.Box3().setFromObject(s), c = b2.getCenter(new THREE.Vector3());
  s.position.set(-c.x, -b2.min.y, -c.z);
  const upright = new THREE.Group(); upright.rotation.x = Math.PI / 2; upright.add(s);
  const pitch = new THREE.Group(); pitch.name = 'pitch'; pitch.add(upright);
  rider.add(pitch);
}

let path: Vec2[] = [], cumulative: number[] = [];
let distance = 0, riderPos: Vec2 = [cx, cy], riderDir: Vec2 = [0, 1];
const riderParam = q.get('rider')?.split(',').map(Number);
if (riderParam && riderParam.length >= 3) { riderPos = toLocal(riderParam[0], riderParam[1]); const b = riderParam[2] * Math.PI / 180; riderDir = [Math.sin(b), Math.cos(b)]; }
const mapcam = q.get('mapcam')?.split(',').map(Number);
const freeEye = q.get('eye')?.split(',').map(Number), freeLook = q.get('look')?.split(',').map(Number);
const SPEED = 5.5;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camInit = false, surfaceRef: GroundSurface | null = null;

function sampleAlong(d: number): { p: Vec2; dir: Vec2 } {
  const total = cumulative[cumulative.length - 1] || 1, cycle = d % (2 * total), fwd = cycle <= total, t = fwd ? cycle : 2 * total - cycle;
  let i = 1; while (i < cumulative.length - 1 && cumulative[i] < t) i++;
  const a = path[i - 1], b = path[i], seg = cumulative[i] - cumulative[i - 1] || 1, u = (t - cumulative[i - 1]) / seg;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return { p: [a[0] + dx * u, a[1] + dy * u], dir: fwd ? [dx / len, dy / len] : [-dx / len, -dy / len] };
}

function updateCamera(dt: number): void {
  if (opts.auto && path.length > 1) {
    distance += SPEED * dt;
    const s = sampleAlong(distance);
    riderPos = s.p;
    const k = 1 - Math.exp(-dt * 4), nx = riderDir[0] + (s.dir[0] - riderDir[0]) * k, ny = riderDir[1] + (s.dir[1] - riderDir[1]) * k, l = Math.hypot(nx, ny) || 1;
    riderDir = [nx / l, ny / l];
  }
  const H = surfaceRef ? surfaceRef.height : () => 0;
  const pose = riderPose(H, riderPos[0], riderPos[1], riderDir);
  rider.position.set(riderPos[0], riderPos[1], pose.z + LIFT.carriageway);
  rider.rotation.z = Math.atan2(riderDir[1], riderDir[0]);
  const pg = rider.getObjectByName('pitch'); if (pg) pg.rotation.y = -pose.pitch;
  let eye: THREE.Vector3, look: THREE.Vector3;
  if (opts.cam === 'free' && freeEye && freeLook) {
    // eye/look = lng,lat,scene z (inspection shots: a bridge from the water at z ≈ −1, etc.).
    const at = (v: number[]) => { const [x, y] = toLocal(v[0], v[1]); return new THREE.Vector3(x, y, v[2]); };
    eye = at(freeEye); look = at(freeLook);
  } else if (opts.cam === 'map') {
    const bearing = mapcam ? mapcam[4] : Math.atan2(riderDir[0], riderDir[1]) * 180 / Math.PI;
    const centre: Vec2 = mapcam ? toLocal(mapcam[0], mapcam[1]) : [riderPos[0] + riderDir[0] * 14, riderPos[1] + riderDir[1] * 14];
    const fov = mapcam?.[5] ?? 36.87; camera.fov = fov;
    const r = mapLibreEye({ centre, zoom: mapcam?.[2] ?? 18.3, pitchDeg: mapcam?.[3] ?? 48, bearingDeg: bearing, fovDeg: fov, lat: opts.lat }, innerHeight);
    // MapLibre's ground is z = 0 at street level; ours follows the relief, so lift the camera by the ground under its centre.
    const hz = H(centre[0], centre[1]);
    eye = new THREE.Vector3(r.eye[0], r.eye[1], r.eye[2] + hz); look = new THREE.Vector3(r.target[0], r.target[1], hz);
  } else {
    eye = new THREE.Vector3(riderPos[0] - riderDir[0] * 7.5, riderPos[1] - riderDir[1] * 7.5, pose.z + 3.4);
    look = new THREE.Vector3(riderPos[0] + riderDir[0] * 10, riderPos[1] + riderDir[1] * 10, H(riderPos[0] + riderDir[0] * 10, riderPos[1] + riderDir[1] * 10) + 1.4);
  }
  const k = camInit ? 1 - Math.exp(-dt * 6) : 1; camInit = true;
  camPos.lerp(eye, k); camLook.lerp(look, k);
  camera.position.copy(camPos); camera.lookAt(camLook); camera.updateProjectionMatrix();
  const focus = opts.cam === 'map' ? camLook.clone() : new THREE.Vector3(riderPos[0] + riderDir[0] * 60, riderPos[1] + riderDir[1] * 60, pose.z);
  const texel = (2 * SHADOW_HALF) / opts.shadowSize;
  focus.x = Math.round(focus.x / texel) * texel; focus.y = Math.round(focus.y / texel) * texel;
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 400); sun.target.updateMatrixWorld();
  if (M.water.normalMap) M.water.normalMap.offset.set(performance.now() * 0.00002, performance.now() * 0.000013);
}

const hud = document.createElement('pre');
hud.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.55);border-radius:4px;pointer-events:none;max-width:calc(100vw - 32px);white-space:pre-wrap';
if (opts.hud) document.body.appendChild(hud);
let last = performance.now(), hudAt = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  proto.frames.push(now - last); last = now;
  if (proto.frames.length > 4000) proto.frames.splice(0, 2000);
  updateCamera(dt);
  renderer.info.reset();
  const t0 = performance.now();
  if (composer) composer.render(dt); else renderer.render(scene, camera);
  proto.renderMs.push(performance.now() - t0);
  if (proto.renderMs.length > 4000) proto.renderMs.splice(0, 2000);
  proto.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  if (opts.hud && now - hudAt > 500) {
    hudAt = now;
    const recent = proto.frames.slice(-60).sort((a: number, b: number) => a - b);
    hud.textContent = `own ground — ${box.label} ${proto.ready ? '' : 'loading…'}\nframe ${recent[recent.length >> 1]?.toFixed(1)} ms  calls ${proto.info.calls}  tris ${(proto.info.triangles / 1e6).toFixed(2)}M\n${JSON.stringify(status)}`;
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
  requestAnimationFrame(frame);
  const heap0 = (performance as any).memory?.usedJSHeapSize ?? 0;
  const surface = await timed('reliefMs', loadSurface);
  surfaceRef = surface;
  await timed('waterMs', () => loadWater(surface));
  const ways = await timed('groundMs', () => loadGround(surface));
  if (opts.route) {
    const start = riderPos, dir = riderDir;
    const route = routeAhead(ways, start, dir, opts.auto ? 2500 : 450, q.get('prefer') ?? undefined);
    meshFrom('route', routeRibbon(route, surface.height), M.route, { order: 3, receive: false });
    log('route', { points: route.length });
    if (opts.auto && !riderParam && route.length > 1) {
      path = route.slice(1);
      cumulative = [0]; for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    }
  }
  proto.groundBuildMs = Math.round(performance.now() - t0);
  proto.groundHeapMB = Math.round((((performance as any).memory?.usedJSHeapSize ?? 0) - heap0) / 1048576);
  const groundTris = Object.entries(stats.triangles).reduce((s, [, n]) => s + n, 0);
  log('ground', { triangles: groundTris, byLayer: stats.triangles, geometryMB: +(stats.geometryBytes / 1048576).toFixed(1), buildMs: proto.groundBuildMs });
  await Promise.all([
    loadTrees(surface), loadBike(),
    opts.buildings ? loadLandmarks(surface).then(s => loadBuildings(surface, s, ways)) : Promise.resolve(),
  ]);
  proto.stats = stats;
  log('loadMs', Math.round(performance.now() - t0));
  proto.ready = true;
}
main().catch(e => { log('error', String(e?.stack ?? e)); console.error(e); });
