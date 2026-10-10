// No-MapLibre proof page (2026-10-10): the map views the game still needs
// MapLibre for — city overview, route preview, minimap, labels, camera and
// gestures — drawn by three.js + a 2D canvas from our own extracts, with no
// third-party tiles at runtime. See docs/research/drop-maplibre-20261010.md.
//
// Build: npx esbuild src/canalRecall/ownMap/main.ts --bundle --format=esm --minify \
//          --outfile=public/canal-drive/js/no-maplibre.bundle.js
//        npx esbuild src/canalRecall/ownMap/footprintWorker.ts --bundle --format=iife --minify \
//          --outfile=public/canal-drive/js/own-map-footprints.worker.js
// Page:  /canal-drive/no-maplibre.html
// Params: view=city|district|street|route, cam=lng,lat,zoom,pitch,bearing[,fov] (a MapLibre camera, exact),
//         route=<fixture> (own-map-fixtures/route-<fixture>.json), rider=lng,lat,bearingDeg,
//         learned=<comma names> (street/water names already earned), ask=<name under question>,
//         labels=all (debug: treat every name as earned, except `ask`), quiet=1 (quiz-quiet map),
//         transit=1 (the transit corridor overlay), answered=<name>[&answeredOk=0] (road lettering),
//         path=1 (fixed camera path, for timing), near=0, mini=0, hud=0, worker=0, dpr.

import * as THREE from 'three';
import { fromLocal, toLocal, type Vec2 } from './frame';
import { decodeOverview, type OverviewData, type OverviewFile } from './overviewFormat';
import { cameraFrame, cameraForPoints, easeCamera, project, unproject, visibleBounds, type CameraState, type Viewport } from './mapCamera';
import { bindGestures, clampCamera, type CameraLimits } from './gestures';
import { footprintGeometry, footprintGeometryFromArrays, handover, rasterMaterial, tileQuadGeometry, z14TilesFor, type FootprintFeature } from './layers';
import { BUILDING_RASTER_FADE, FOOTPRINT_MIN_ZOOM, NEAR_FIELD_FADE, PALETTE, fade } from './style';
import type { LabelKind } from './labels';
import { streetLabelVisible, type LabelContext } from './labelPolicy';
import { buildSpoilerIndex } from '../orientationPois';
import type { OrientationPoiFile } from '../ownPois';
import { Minimap } from './minimap';
import { boxFor, buildNearField, waterFromCells } from './nearField';
import { cellsNear, lngLatToLocal, validateIndex, type WaterCell } from '../elevation/elevationData';
import type { OsmGroundExtract } from '../ownGround/osmGround';
import { lineLength } from './geometry';
import { OwnMapScene } from './ownMapScene';
import { OwnMapLabels, brandDisc, ferryPin } from './ownMapLabels';
import { BRAND_ICON_URLS, answeredStreetPlacement, ferryOverlay, transitOverlay, type BrandedPoi } from './overlays';
import type { TransitNetwork } from '../transit/network';
import type { FootprintReply, FootprintRequest } from './footprintWorker';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
const EXTRACT = '../data/extracts/amsterdam';
const q = new URLSearchParams(location.search);
const flag = (k: string, d: boolean) => (q.get(k) === null ? d : q.get(k) !== '0');
const coarse = matchMedia('(pointer: coarse)').matches;
const opts = {
  view: q.get('view') ?? 'city',
  route: q.get('route') ?? 'game-desktop',
  path: flag('path', false), near: flag('near', true), mini: flag('mini', true), hud: flag('hud', true), worker: flag('worker', true),
  dpr: Number(q.get('dpr')) || Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2),
  labelsAll: q.get('labels') === 'all', quiet: flag('quiet', false), transit: flag('transit', false),
  ask: q.get('ask') ?? 'Kinkerstraat',
  answered: q.get('answered') ?? '', answeredOk: flag('answeredOk', true),
};
const DEMO_LEARNED = ['Nassaukade', 'Bilderdijkstraat', 'Kinkerstraat', 'Singelgracht', 'Prinsengracht', 'Herengracht', 'Keizersgracht', 'Singel',
  'Leidsestraat', 'Overtoom', 'Marnixstraat', 'Rozengracht', 'Raadhuisstraat', 'Damrak', 'Rokin', 'Stadhouderskade', 'Amstel', 'Kostverlorenvaart',
  'Da Costakade', 'Jan Pieter Heijestraat', 'Bilderdijkkade', 'Hugo de Grootkade', 'Leidsegracht', 'Vijzelstraat', 'Weteringschans', 'Wibautstraat'];
const learned = new Set((q.get('learned') ?? DEMO_LEARNED.join(',')).split(',').map(s => s.trim()).filter(Boolean));

const status: Record<string, unknown> = { bytes: {} as Record<string, number>, ms: {} as Record<string, number> };
const bytes = status.bytes as Record<string, number>, ms = status.ms as Record<string, number>;
const S = {
  ready: false, status, frames: [] as number[], renderMs: [] as number[], labelMs: [] as number[], labelCounts: [] as number[],
  info: { calls: 0, triangles: 0 }, labelWorst: null as null | { ms: number; candidates: number; zoom: number; pitch: number }, labelCount: 0,
  everPlaced: new Set<string>(), everPlacedKinds: {} as Record<string, string[]>, placed: [] as Array<{ text: string; kind: LabelKind; icon?: boolean }>,
  cam: null as CameraState | null, setCamera: (c: CameraState) => { cam = c; }, setView: (v: string) => applyView(v),
  project: (lng: number, lat: number) => project(cameraFrame(cam, viewport()), toLocal(lng, lat)),
  unproject: (x: number, y: number) => { const p = unproject(cameraFrame(cam, viewport()), x, y); return p ? fromLocal(p[0], p[1]) : null; },
  opts,
};
(window as unknown as { __ownMap: typeof S }).__ownMap = S;

// --- DOM -------------------------------------------------------------------
const gl = document.getElementById('gl') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLCanvasElement;
const mini = document.getElementById('minimap') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const octx = overlay.getContext('2d')!;
const mctx = mini.getContext('2d')!;
if (!opts.hud) hud.hidden = true;
if (!opts.mini) mini.hidden = true;
const viewport = (): Viewport => ({ width: gl.clientWidth || innerWidth, height: gl.clientHeight || innerHeight });

const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
renderer.setPixelRatio(opts.dpr);
renderer.setClearColor(PALETTE.land);
renderer.info.autoReset = false;
const scene = new THREE.Scene();
const camera3 = new THREE.PerspectiveCamera(36.87, 1, 1, 1e5);
scene.add(new THREE.HemisphereLight('#ffffff', '#b8b0a4', 1.4));
const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-300, -400, 700); scene.add(sun);

let cam: CameraState = { center: toLocal(4.8936, 52.3702), zoom: 11.5, bearing: 0, pitch: 0 };
const LIMITS: CameraLimits = { minZoom: 9.5, maxZoom: 20, maxPitch: 70 };

// --- Data --------------------------------------------------------------------
/** Bytes on the wire (resource timing), falling back to the body size. A dev
 *  server may gzip-encode a .gz on the fly and the browser hands back the inner
 *  bytes, so the body length is not the transfer size. */
async function fetchBytes(url: string, key: string, type?: RegExp): Promise<Uint8Array> {
  const r = await fetch(url);
  // A history fallback answers a missing file with index.html and 200.
  if (!r.ok || (type && !type.test(r.headers.get('content-type') ?? ''))) throw new Error(`${url}: ${r.status} ${r.headers.get('content-type')}`);
  const b = new Uint8Array(await r.arrayBuffer());
  countBytes(url, key, b.length);
  return b;
}
function countBytes(url: string, key: string, decoded: number, transfer?: number): void {
  const entry = transfer === undefined ? performance.getEntriesByName(new URL(url, location.href).href).pop() as PerformanceResourceTiming | undefined : undefined;
  bytes[key] = (bytes[key] ?? 0) + (transfer ?? (entry && entry.transferSize > 0 ? entry.transferSize : decoded));
  bytes[`${key}Decoded`] = (bytes[`${key}Decoded`] ?? 0) + decoded;
}
async function gunzipJson<T>(b: Uint8Array): Promise<T> {
  const text = b[0] === 0x1f && b[1] === 0x8b
    ? await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(b);
  return JSON.parse(text) as T;
}
const timed = async <T>(key: string, f: () => T | Promise<T>): Promise<T> => { const t = performance.now(); const v = await f(); ms[key] = Math.round(performance.now() - t); return v; };
const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error(url)); i.src = url; });

let data: OverviewData;
let flat: OwnMapScene;
let labels: OwnMapLabels;
let routeLocal: Vec2[] = [];
let rider: { at: Vec2; bearing: number } = { at: toLocal(4.8745, 52.3729), bearing: 40 };
const rasterTiles: THREE.Mesh[] = [];
let minimap: Minimap | null = null;

async function loadOverview(): Promise<void> {
  const t0 = performance.now();
  const raw = await timed('fetchOverview', () => fetchBytes(`${EXTRACT}/own-map-v1/overview.json.gz`, 'overview'));
  const file = await timed('inflateParse', () => gunzipJson<OverviewFile>(raw));
  data = await timed('decode', () => decodeOverview(file));
  await timed('buildMeshes', () => { flat = new OwnMapScene(data); scene.add(flat.group); });
  ms.overviewTotal = Math.round(performance.now() - t0);
  status.overview = { version: file.version, water: data.water.length, parks: data.parks.length, streets: data.streets.length, landuse: data.landuse.length, rail: data.rail.length, piers: data.piers.length + data.pierLines.length, hoodRings: data.hoodRings.length };
}

async function loadBuildingRaster(): Promise<void> {
  const t0 = performance.now();
  const index = await (await fetch(`${EXTRACT}/building-overview/index.json`)).json() as { zoom: number; bounds: [number, number, number, number] };
  const z = index.zoom;
  const tx = (lng: number) => Math.floor((lng + 180) / 360 * 2 ** z);
  const ty = (lat: number) => Math.floor((1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 * 2 ** z);
  const [w, s, e, n] = index.bounds;
  const jobs: Promise<void>[] = [];
  for (let x = tx(w); x <= tx(e - 1e-9); x++) for (let y = ty(n); y <= ty(s + 1e-9); y++) {
    jobs.push((async () => {
      let bmp: ImageBitmap;
      try {
        const b = await fetchBytes(`${EXTRACT}/building-overview/${z}/${x}/${y}.png`, 'buildingRaster', /image/);
        bmp = await createImageBitmap(new Blob([b as BlobPart], { type: 'image/png' }), { imageOrientation: 'flipY' });
      } catch { return; }
      const tex = new THREE.Texture(bmp as unknown as HTMLImageElement);
      tex.flipY = false; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
      const m = new THREE.Mesh(tileQuadGeometry(z, x, y, toLocal), rasterMaterial(tex, PALETTE.building, 0));
      m.renderOrder = 5; m.frustumCulled = false;
      rasterTiles.push(m); scene.add(m);
    })());
  }
  await Promise.all(jobs);
  ms.buildingRaster = Math.round(performance.now() - t0);
  status.buildingRasterTiles = rasterTiles.length;
}

async function loadRoute(): Promise<void> {
  let fixture: { path: [number, number][]; rider?: [number, number, number] } | null = null;
  try { const r = await fetch(`own-map-fixtures/route-${opts.route}.json`); if (r.ok) fixture = await r.json(); } catch { /* none */ }
  // Fallback: Westermarkt → Leidseplein along nothing in particular (only when no fixture).
  const path = fixture?.path ?? [[4.8837, 52.3747], [4.8833, 52.3693], [4.8826, 52.3641]];
  routeLocal = path.map(([lng, lat]) => toLocal(lng, lat));
  const rq = q.get('rider')?.split(',').map(Number);
  if (rq && rq.length >= 2) rider = { at: toLocal(rq[0], rq[1]), bearing: rq[2] ?? 0 };
  else {
    const [a, b] = routeLocal;
    rider = { at: a, bearing: b ? (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360 : 0 };
  }
  status.route = { points: routeLocal.length, lengthM: Math.round(lineLength(routeLocal)), fixture: !!fixture };
}

// --- Transit network: ferry lines + terminals always, corridors with transit=1 ---------
async function loadTransit(): Promise<void> {
  const network = await gunzipJson<TransitNetwork>(await fetchBytes(`${EXTRACT}/transit-network.json`, 'transit'));
  const ferry = ferryOverlay(network);
  flat.setFerryLines(ferry.lines);
  labels.setFerryTerminals(ferry.terminals, ferryPin());
  if (opts.transit) flat.setTransit(transitOverlay(network));
  status.overlays = { ...(status.overlays as object), ferryLines: ferry.lines.length, ferryTerminals: ferry.terminals.length, transitLines: flat.stats.transitLines ?? 0 };
}

// --- Answered-street lettering (only after an answer; never the asked name) --------
function applyAnswered(): void {
  const name = opts.answered;
  if (!name) return;
  // The game fills its source only after the answer; a name still under question is never painted.
  const asked = !streetLabelVisible({ ...labelCtx, isLabelled: () => true }, name, 0, 0);
  if (asked) { flat.setAnswered(null, [], true); status.answered = { name, placed: 0, withheld: true }; return; }
  const chains = data.streets.filter(s => s.name === name).map(s => s.points);
  const placements = answeredStreetPlacement(chains, rider);
  flat.setAnswered(name, placements, opts.answeredOk, fromLocal(rider.at[0], rider.at[1])[1]);
  status.answered = { name, placed: placements.length, at: placements[0] && fromLocal(...placements[0].at), bearing: placements[0]?.bearing };
}

// --- Vector footprints (z14 building tiles), built in a worker -----------------
const footprintTiles = new Map<string, THREE.Mesh | null>();
const footprintGroup = new THREE.Group(); scene.add(footprintGroup);
const FOOT_TOP = '#e3dcd2', FOOT_WALL = '#cbbfb2';
let worker: Worker | null = null;
const pending = new Map<number, (r: FootprintReply) => void>();
let nextJob = 1;
if (opts.worker) {
  try {
    worker = new Worker(new URL('js/own-map-footprints.worker.js', location.href));
    worker.onmessage = (e: MessageEvent<FootprintReply>) => { pending.get(e.data.id)?.(e.data); pending.delete(e.data.id); };
  } catch { worker = null; }
}
status.footprintWorker = !!worker;
async function footprintTile(key: string): Promise<THREE.BufferGeometry> {
  const url = new URL(`${EXTRACT}/building-tiles/14/${key}.geojson.gz`, location.href).href;
  if (worker) {
    const id = nextJob++;
    const reply = await new Promise<FootprintReply>(resolve => { pending.set(id, resolve); worker!.postMessage({ id, url, top: FOOT_TOP, wall: FOOT_WALL } satisfies FootprintRequest); });
    if (!reply.ok) throw new Error(reply.error);
    countBytes(url, 'buildingTiles', reply.decoded, reply.bytes);
    ms.footprintWorkerBuild = (ms.footprintWorkerBuild ?? 0) + Math.round(reply.buildMs);
    const t = performance.now();
    const g = footprintGeometryFromArrays(reply);
    ms.footprintBuild = (ms.footprintBuild ?? 0) + Math.round(performance.now() - t);
    return g;
  }
  const fc = await gunzipJson<{ features: FootprintFeature[] }>(await fetchBytes(url, 'buildingTiles'));
  const t = performance.now();
  const g = footprintGeometry(fc.features, toLocal, FOOT_TOP, FOOT_WALL);
  ms.footprintBuild = (ms.footprintBuild ?? 0) + Math.round(performance.now() - t);
  return g;
}
function updateFootprints(bounds: [number, number, number, number]): void {
  if (cam.zoom < FOOTPRINT_MIN_ZOOM) { footprintGroup.visible = false; return; }
  footprintGroup.visible = true;
  for (const key of z14TilesFor(bounds).slice(0, 16)) {
    if (footprintTiles.has(key)) continue;
    footprintTiles.set(key, null);
    void footprintTile(key).then(g => {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
      m.renderOrder = 50;
      footprintTiles.set(key, m); footprintGroup.add(m);
    }, () => { /* tile outside the extract */ });
  }
}

// --- Near field (own-ground modules) -----------------------------------------
const NEAR_RADIUS = 550;
let nearGroup: THREE.Group | null = null, nearLoading = false;
async function ensureNearField(): Promise<void> {
  if (nearGroup || nearLoading || !opts.near) return;
  const box = boxFor(rider.at);
  if (!box) { status.nearField = 'no own-ground extract here'; return; }
  nearLoading = true;
  const t0 = performance.now();
  const osm = await gunzipJson<OsmGroundExtract>(await fetchBytes(`${EXTRACT}/own-ground-osm-v1/${box.id}.json`, 'nearField'));
  const index = validateIndex(await (await fetch(`${EXTRACT}/elevation-v1/index.json`)).json());
  const [lng, lat] = fromLocal(rider.at[0], rider.at[1]);
  const [ex, ey] = lngLatToLocal(index, lng, lat);
  const cells = (await Promise.all(cellsNear(index, ex, ey, NEAR_RADIUS + 200).map(async k => {
    try { return await gunzipJson<WaterCell>(await fetchBytes(`${EXTRACT}/elevation-v1/cells/${k}.json`, 'nearField')); } catch { return null; }
  }))).filter(Boolean) as WaterCell[];
  const built = buildNearField(osm, waterFromCells(index, cells), rider.at, NEAR_RADIUS);
  nearGroup = built.group; scene.add(nearGroup);
  status.nearField = { ...built.stats, loadMs: Math.round(performance.now() - t0) };
  nearLoading = false;
}

// --- Labels ------------------------------------------------------------------
const labelCtx: LabelContext = {
  isLabelled: opts.labelsAll ? () => true : (text) => learned.has(text),
  hiddenName: opts.ask,
  spoilerIndex: buildSpoilerIndex([...learned, opts.ask]),
  quizQuiet: opts.quiet,
};
let poisLoaded = false;
async function loadPois(): Promise<void> {
  if (poisLoaded) return; poisLoaded = true;
  const [file, branded, logo] = await Promise.all([
    fetchBytes(`${EXTRACT}/orientation-pois.json`, 'pois').then(b => gunzipJson<OrientationPoiFile>(b)),
    fetchBytes(`${EXTRACT}/branded-pois.json`, 'pois').then(b => gunzipJson<BrandedPoi[]>(b)).catch(() => [] as BrandedPoi[]),
    loadImage(BRAND_ICON_URLS['albert-heijn']).then(brandDisc).catch(() => null),
  ]);
  labels.setPois(file);
  labels.setBranded(branded, logo ? { 'albert-heijn': logo } : {});
  status.labels = labels.stats;
}

function updateLabels(frame: ReturnType<typeof cameraFrame>, bounds: [number, number, number, number]): void {
  const t = performance.now();
  const vp = frame.viewport;
  // The pins and the rider marker (drawn after the labels) keep their ground clear.
  const blocked: Array<[number, number, number, number]> = [];
  const pin = (p: Vec2, label: number) => { const s = project(frame, p); if (s.depth > 0) blocked.push([s.x - label / 2, s.y - 50, s.x + label / 2, s.y]); };
  if (routeLocal.length > 1) { pin(routeLocal[routeLocal.length - 1], 84); if (cam.zoom < 16) pin(routeLocal[0], 44); }
  const r = project(frame, rider.at); if (r.depth > 0) blocked.push([r.x - 11, r.y - 11, r.x + 11, r.y + 11]);
  const placed = labels.place(p => project(frame, p), vp.width, vp.height, cam.zoom, bounds, frame.distance * 4, blocked);
  labels.draw(octx, placed);
  const dt = performance.now() - t;
  if (dt > (S.labelWorst?.ms ?? 0)) S.labelWorst = { ms: Math.round(dt), candidates: placed.length, zoom: +cam.zoom.toFixed(2), pitch: Math.round(cam.pitch) };
  S.labelCount = placed.length;
  S.placed = placed.map(p => ({ text: p.text, kind: p.kind, ...(p.icon ? { icon: true } : {}) }));
  for (const p of placed) {
    if (!p.text) continue;
    if (!S.everPlaced.has(p.text)) (S.everPlacedKinds[p.kind] ??= []).push(p.text);
    S.everPlaced.add(p.text);
  }
  S.labelMs.push(performance.now() - t);
  S.labelCounts.push(placed.length);
}

// --- Overlay: pins, rider, attribution --------------------------------------
const FONT = '"Helvetica Neue", Arial, sans-serif';
function drawPin(x: number, y: number, colour: string, label: string): void {
  octx.save();
  octx.translate(x, y);
  octx.fillStyle = colour; octx.strokeStyle = '#fff'; octx.lineWidth = 2.5;
  octx.beginPath(); octx.moveTo(0, 0); octx.bezierCurveTo(-12, -16, -12, -32, 0, -32); octx.bezierCurveTo(12, -32, 12, -16, 0, 0); octx.fill(); octx.stroke();
  octx.fillStyle = '#fff'; octx.beginPath(); octx.arc(0, -21, 4.5, 0, Math.PI * 2); octx.fill();
  octx.font = `700 11px ${FONT}`; octx.textAlign = 'center'; octx.textBaseline = 'bottom';
  octx.lineWidth = 3; octx.strokeStyle = 'rgba(7,30,43,.85)'; octx.strokeText(label, 0, -36); octx.fillStyle = '#fff'; octx.fillText(label, 0, -36);
  octx.restore();
}
function drawOverlay(frame: ReturnType<typeof cameraFrame>): void {
  if (routeLocal.length > 1) {
    const a = project(frame, routeLocal[0]), b = project(frame, routeLocal[routeLocal.length - 1]);
    if (b.depth > 0) drawPin(b.x, b.y, '#E11D48', 'DESTINATION');
    if (a.depth > 0 && cam.zoom < 16) drawPin(a.x, a.y, '#16A34A', 'START');
  }
  const r = project(frame, rider.at);
  if (r.depth > 0) {
    octx.save(); octx.translate(r.x, r.y); octx.rotate((rider.bearing - cam.bearing) * Math.PI / 180);
    octx.fillStyle = '#0f172a'; octx.strokeStyle = '#fff'; octx.lineWidth = 2;
    octx.beginPath(); octx.moveTo(0, -10); octx.lineTo(7, 8); octx.lineTo(0, 4); octx.lineTo(-7, 8); octx.closePath(); octx.fill(); octx.stroke();
    octx.restore();
  }
  octx.font = `400 10px ${FONT}`; octx.textAlign = 'right'; octx.textBaseline = 'bottom'; octx.fillStyle = 'rgba(30,41,59,.7)';
  octx.fillText('© OpenStreetMap contributors · BAG · GVB · own renderer', frame.viewport.width - 6, frame.viewport.height - 4);
}

// --- Views -------------------------------------------------------------------
function cityCamera(): CameraState {
  const [x0, y0, x1, y1] = data?.bounds ?? [-15000, -12000, 12000, 9000];
  // Amsterdam proper, not the whole extract box (which reaches Zaandam and the Bos).
  const pts: Vec2[] = [[Math.max(x0, -9000), Math.max(y0, -8000)], [Math.min(x1, 9500), Math.min(y1, 6500)]];
  return cameraForPoints(pts, viewport(), { padding: { top: 30, bottom: 30, left: 20, right: 20 } });
}
function routeCamera(): CameraState {
  const vp = viewport();
  const pts = routeLocal.length > 1 ? routeLocal : [rider.at];
  // The game's intro framing: start+destination with room for pins and the top HUD (introFlight.ts).
  return cameraForPoints(pts, vp, { padding: { top: Math.min(140, vp.height * 0.18), bottom: Math.min(120, vp.height * 0.15), left: 56, right: 56 }, maxZoom: 16 });
}
function districtCamera(): CameraState { const r = routeCamera(); return { ...r, zoom: Math.max(13.6, Math.min(14.6, r.zoom + 1)) }; }
function streetCamera(): CameraState { return { center: rider.at, zoom: 17.6, bearing: rider.bearing, pitch: 55 }; }
function applyView(v: string): void {
  const camQ = q.get('cam')?.split(',').map(Number);
  if (v === 'cam' && camQ && camQ.length >= 3) { cam = { center: toLocal(camQ[0], camQ[1]), zoom: camQ[2], pitch: camQ[3] ?? 0, bearing: camQ[4] ?? 0, fovDeg: camQ[5] }; return; }
  cam = v === 'route' ? routeCamera() : v === 'district' ? districtCamera() : v === 'street' ? streetCamera() : cityCamera();
  pathStart = null;
}

// Fixed camera path (timing): city hold → route preview → street (handover) → orbit.
let pathStart: number | null = null;
function pathCamera(t: number): CameraState {
  const city = cityCamera(), route = routeCamera(), street = streetCamera();
  if (t < 2) return city;
  if (t < 7) return easeCamera(city, route, (t - 2) / 5);
  if (t < 9) return route;
  if (t < 15) return easeCamera(route, street, (t - 9) / 6);
  return { ...street, bearing: street.bearing + (t - 15) * 8 };
}

// --- Frame ---------------------------------------------------------------------
let last = performance.now();
let lastBoundsKey = '';
function frameLoop(now: number): void {
  requestAnimationFrame(frameLoop);
  S.frames.push(now - last); last = now;
  if (!S.ready) return;
  const t0 = performance.now();
  if (opts.path) { pathStart ??= now; cam = pathCamera((now - pathStart) / 1000); }
  cam = clampCamera(cam, { ...LIMITS, maxPitch: Math.max(LIMITS.maxPitch, cam.pitch) });
  S.cam = cam;
  const vp = viewport();
  const frame = cameraFrame(cam, vp);
  // three camera from our camera model (the same numbers project() uses).
  camera3.fov = cam.fovDeg ?? 36.86989764584402; camera3.aspect = vp.width / vp.height;
  camera3.near = Math.max(0.5, frame.distance * 0.02); camera3.far = frame.distance * 40;
  camera3.position.set(...frame.eye); camera3.up.set(...frame.up); camera3.lookAt(...frame.target);
  camera3.updateProjectionMatrix();
  // Zoom-dependent cartography: MapLibre-style px widths → metres at the centre.
  flat.update(cam.zoom, frame.mpp);
  const rasterOpacity = 1 - fade(cam.zoom, BUILDING_RASTER_FADE);
  for (const m of rasterTiles) { m.visible = rasterOpacity > 0.01; (m.material as THREE.ShaderMaterial).uniforms.uOpacity.value = rasterOpacity; }
  const bounds = visibleBounds(frame, 6000);
  const key = bounds.map(v => Math.round(v / 200)).join(',') + Math.floor(cam.zoom * 2);
  if (key !== lastBoundsKey) { lastBoundsKey = key; updateFootprints(bounds); }
  // Handover: overview → own-ground near field round the rider.
  const nearBlend = fade(cam.zoom, NEAR_FIELD_FADE);
  if (nearBlend > 0) void ensureNearField();
  if (cam.zoom >= 15.5) void loadPois();
  handover.uRider.value.set(rider.at[0], rider.at[1]);
  handover.uNearR.value = NEAR_RADIUS;
  handover.uNear.value = nearGroup ? nearBlend : 0;
  if (nearGroup) nearGroup.visible = nearBlend > 0;
  renderer.info.reset();
  renderer.render(scene, camera3);
  S.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  // 2D overlay: labels, pins, rider.
  const dpr = opts.dpr;
  if (overlay.width !== Math.round(vp.width * dpr) || overlay.height !== Math.round(vp.height * dpr)) { overlay.width = Math.round(vp.width * dpr); overlay.height = Math.round(vp.height * dpr); }
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.clearRect(0, 0, vp.width, vp.height);
  updateLabels(frame, visibleBounds(frame, Math.min(6000, frame.distance * 4)));
  drawOverlay(frame);
  const size = mini.clientWidth;
  if (opts.mini && minimap && size >= 16) {
    if (mini.width !== Math.round(size * dpr)) { mini.width = mini.height = Math.round(size * dpr); }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, size, size);
    minimap.draw(mctx, size, rider.at, rider.bearing, routeLocal);
  }
  S.renderMs.push(performance.now() - t0);
  if (opts.hud) hudText();
}

function hudText(): void {
  const el = document.getElementById('stats');
  if (!el || S.frames.length % 15) return;
  const tail = S.renderMs.slice(-60).sort((a, b) => a - b);
  el.textContent = `z ${cam.zoom.toFixed(2)} · pitch ${cam.pitch.toFixed(0)}° · ${S.labelCount} labels · ${S.info.calls} calls · cpu ${(tail[tail.length >> 1] ?? 0).toFixed(1)} ms`;
}

function resize(): void {
  const vp = viewport();
  renderer.setSize(vp.width, vp.height, false);
}
addEventListener('resize', resize);

async function main(): Promise<void> {
  const t0 = performance.now();
  resize();
  requestAnimationFrame(frameLoop);
  try {
    await Promise.all([loadOverview(), loadRoute()]);
    flat.setRoute(routeLocal);
    labels = await timed('labelCandidates', () => new OwnMapLabels(data, labelCtx, octx));
    status.labels = labels.stats;
    applyAnswered();
    minimap = new Minimap(data);
    applyView(q.get('cam') ? 'cam' : opts.view);
    S.ready = true;
    ms.firstFrameReady = Math.round(performance.now() - t0);
    await Promise.all([loadBuildingRaster(), loadTransit()]);
    status.labels = labels.stats;
    ms.allLoaded = Math.round(performance.now() - t0);
    if (cam.zoom >= 15.5) await loadPois();
    if (cam.zoom >= 16) await ensureNearField();
    status.loaded = true;
  } catch (e) {
    status.error = String((e as Error)?.stack ?? e);
    console.error(e);
  }
  bindGestures(gl, () => cam, c => { cam = c; pathStart = null; opts.path = false; }, LIMITS);
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-view]')) b.onclick = () => { opts.path = b.dataset.view === 'path'; pathStart = null; if (!opts.path) applyView(b.dataset.view!); };
}
void main();
