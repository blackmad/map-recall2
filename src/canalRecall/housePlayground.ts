// House playground page: a generator for a house or short terrace, and a real-building viewer,
// both through the game's own decoration chain, chunk builders and facade shader
// (housePlaygroundModel.ts, galleryPipeline.ts, galleryGl.ts). Page: `house-playground.html`,
// not linked from the app. The URL holds every setting, so a link reproduces a house.

import { setShopfronts } from './shopfronts.js';
import { shortBuildingId } from './buildingFacts.js';
import {
  DEFAULT_PARAMS, FACADE_STYLES, GABLE_SHAPES, ROOF_KINDS, SHOP_KINDS, STYLE_YEAR, SUPERMARKET_CHAINS, buildRealScene, buildTerrace, buildTerraceChunks, describeHouse,
  effectiveStyle, heightForStoreys, normaliseBuildingId, pickBuilding, storeysForHeight, type PlaygroundChunks, type PlaygroundParams, type RealBuilding, type RealScene,
} from './housePlaygroundModel.js';
import { fitDistance, fromLocal, gameDecorator, loadGameData, loadTile, tileKeyAt, tilesAround, toLocal, type Feature, type Vec2 } from './galleryPipeline.js';
import { GalleryGL, LOOKS, LOOK_LABEL, disposeGroup } from './galleryGl.js';
import { attachOrbit, clamp, type Orbit } from './galleryOrbit.js';
import type { BuildingLook } from './threeBuildingFeatures.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SHOP_LABEL: Record<string, string> = { groundShop: 'ground-floor shop', shopCafe: 'cafe or restaurant', shopWindow: 'shop window', shopBar: 'bar', shopDeli: 'deli or bakery', shopFlorist: 'florist', shopBike: 'bike shop' };
const PLACES: Array<[string, number, number]> = [
  ['Jordaan (canal and c19 houses)', 4.8815, 52.3763], ['Westerkerk and Prinsengracht', 4.8836, 52.3743], ['Dam square', 4.8926, 52.3731], ['De Pijp (Albert Cuyp)', 4.8942, 52.3556],
  ['Oud-West (Kinkerstraat)', 4.8690, 52.3640], ['Spaarndammerbuurt (Amsterdam School)', 4.8830, 52.3910], ['Museumplein', 4.8810, 52.3580], ['Plantage', 4.9120, 52.3660],
];

// --- Parameters <-> URL ---------------------------------------------------------
const KEYS: Record<keyof PlaygroundParams, string> = { style: 'style', year: 'year', width: 'w', depth: 'd', storeys: 's', height: 'h', houses: 'n', look: 'look', gable: 'gable', roof: 'roof', shop: 'shop', chain: 'chain', named: 'named', shopsOn: 'on', extras: 'extras', seed: 'seed' };
function paramsFromQuery(q: URLSearchParams): PlaygroundParams {
  const p: any = { ...DEFAULT_PARAMS };
  for (const [key, short] of Object.entries(KEYS)) {
    const raw = q.get(short);
    if (raw === null) continue;
    p[key] = typeof (DEFAULT_PARAMS as any)[key] === 'number' ? (Number.isFinite(Number(raw)) ? Number(raw) : p[key]) : typeof (DEFAULT_PARAMS as any)[key] === 'boolean' ? raw === '1' : raw;
  }
  if (!(LOOKS as readonly string[]).includes(p.look)) p.look = DEFAULT_PARAMS.look;
  return p;
}
function queryOf(p: PlaygroundParams, mode: 'gen' | 'real', real?: { id: string | null; at: [number, number] | null; radius: number }): URLSearchParams {
  const q = new URLSearchParams();
  if (mode === 'real') {
    q.set('mode', 'real'); q.set('look', p.look); if (!p.extras) q.set('extras', '0');
    if (real?.id) q.set('id', real.id); else if (real?.at) q.set('at', `${real.at[0].toFixed(5)},${real.at[1].toFixed(5)}`);
    if (real) q.set('r', String(real.radius));
    return q;
  }
  for (const [key, short] of Object.entries(KEYS)) {
    const v = (p as any)[key], d = (DEFAULT_PARAMS as any)[key];
    if (v !== d) q.set(short, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return q;
}

async function main() {
  const gl = new GalleryGL(), THREE = gl.THREE;
  const canvas = $<HTMLCanvasElement>('view');
  const query = new URLSearchParams(location.search);
  const params = paramsFromQuery(query);
  let mode: 'gen' | 'real' = query.get('mode') === 'real' ? 'real' : 'gen';
  const game = await loadGameData();

  // --- Fill selects
  const fill = (id: string, options: Array<[string, string]>, value: string) => { const s = $<HTMLSelectElement>(id); for (const [v, label] of options) s.append(new Option(label, v, false, v === value)); s.value = value; };
  fill('look', LOOKS.map(l => [l, LOOK_LABEL[l]]), params.look);
  fill('style', [['auto', 'Auto (from year)'], ...FACADE_STYLES.map(s => [s, s] as [string, string])], params.style);
  fill('roof', [['auto', 'Auto (planner)'], ['flat', 'Flat'], ...ROOF_KINDS.map(r => [r, r] as [string, string])], params.roof);
  fill('gable', [['auto', 'Auto (by year)'], ...GABLE_SHAPES.map(g => [g, g] as [string, string])], params.gable);
  fill('shop', [['none', 'None'], ...SHOP_KINDS.map(k => [k, SHOP_LABEL[k]] as [string, string])], params.shop);
  fill('chain', [['none', 'None'], ...Object.entries(SUPERMARKET_CHAINS).map(([k, c]) => [k, c.name] as [string, string])], params.chain);
  fill('shopsOn', [['first', 'first house'], ['alternate', 'every other house'], ['all', 'every house']], params.shopsOn);
  fill('place', PLACES.map(([name], i) => [String(i), name] as [string, string]), '0');

  // --- Scene state
  let group: any = null, scene: any = null, outline: any = null;
  const orbit: Orbit = { yaw: 18, pitch: 20, dist: 40, target: [0, 0, 5], minDist: 6, maxDist: 900 };
  let drawQueued = false;
  const draw = () => { if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; if (scene) gl.draw(scene, orbit, canvas); }); };
  attachOrbit(canvas, orbit, draw);
  new ResizeObserver(draw).observe(canvas);

  const setStatus = (text: string) => { $('tris').textContent = text; };
  async function show(chunks: PlaygroundChunks, offset: Vec2, ground: { x: number; y: number; size: number }, street: boolean) {
    const [mat] = await Promise.all([gl.material(look())]);
    const g = new THREE.Group(), s = new THREE.Scene();
    g.position.set(-offset[0], -offset[1], 0);
    gl.mesh(chunks.walls, mat, g); gl.mesh(chunks.extras, mat, g); gl.mesh(chunks.kit ?? null, mat, g);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(ground.size, ground.size), new THREE.MeshBasicMaterial({ color: '#d9d3c1' }));
    plane.position.set(ground.x, ground.y, -0.12); g.add(plane);
    if (street) { const road = new THREE.Mesh(new THREE.PlaneGeometry(ground.size, 6.5), new THREE.MeshBasicMaterial({ color: '#8f8c86' })); road.position.set(ground.x, -8, -0.1); g.add(road); }
    s.add(g);
    if (group) disposeGroup(group);
    group = g; scene = s; outline = null;
    draw();
  }
  const look = () => params.look as BuildingLook;

  // --- Generator
  let genToken = 0;
  const infoOf = (t: ReturnType<typeof buildTerrace>) => t.features.map((f, i) => {
    const d = describeHouse(f, t.plans[i]);
    return `${i + 1}. ${d.facadeStyle}, ${d.year ?? 'no year'}, ${d.heightM} m; roof ${d.roof ? `${d.roof.kind}${d.roof.gable ? ` (${d.roof.gable} gable)` : ''}, ${d.roof.material}, rise ${d.roof.riseM} m` : 'flat'}; shop ${d.shop}${d.chain ? ` (${SUPERMARKET_CHAINS[d.chain]?.name ?? d.chain})` : ''}`;
  });
  let firstFrame = true;
  async function rebuildGen(reframe = false) {
    const token = ++genToken;
    setShopfronts(null);
    const t = buildTerrace(params);
    const chunks = buildTerraceChunks(t, look(), params.extras);
    if (token !== genToken) return;
    const f = t.frame;
    await show(chunks, [0, 0], { x: 0, y: 0, size: 1200 }, true);
    if (reframe || firstFrame) {
      firstFrame = false;
      orbit.target = [0, f.cy, Math.max(4, f.top * 0.45)];
      orbit.dist = fitDistance(f.halfDiag, f.top) * 1.55; orbit.yaw = 18; orbit.pitch = 18;
      draw();
    }
    $('notes').textContent = t.notes.join(' ');
    $('houses-info').replaceChildren(...infoOf(t).map(line => { const c = document.createElement('code'); c.textContent = line; return c; }));
    setStatus(`${Math.round(chunks.triangles).toLocaleString('en')} triangles; ${t.styleUsed} style${params.style === 'auto' ? ' (from year and size)' : ''}`);
    syncUrl();
  }
  let timer = 0;
  const changed = (reframe = false) => { clearTimeout(timer); timer = window.setTimeout(() => { if (mode === 'gen') void rebuildGen(reframe); else void rebuildReal(); }, 50); };

  // Number controls: a range and a number box per parameter.
  const num = (key: 'year' | 'houses' | 'width' | 'depth' | 'storeys' | 'height', after: () => void) => {
    const n = $<HTMLInputElement>(key), r = $<HTMLInputElement>(`${key}R`);
    const set = (v: number) => { (params as any)[key] = v; n.value = String(v); r.value = String(v); };
    set((params as any)[key]);
    const on = (src: HTMLInputElement) => () => { const v = Number(src.value); if (!Number.isFinite(v)) return; set(clamp(v, Number(n.min), Number(n.max))); after(); changed(key === 'houses'); };
    n.addEventListener('input', on(n)); r.addEventListener('input', on(r));
    return set;
  };
  const setters = {
    year: num('year', () => {}), houses: num('houses', () => {}), width: num('width', () => {}), depth: num('depth', () => {}),
    storeys: num('storeys', () => { setters.height(heightForStoreys(effectiveStyle(params), params.storeys)); }),
    height: num('height', () => { setters.storeys(storeysForHeight(effectiveStyle(params), params.height)); }),
  };
  const sel = (id: string, key: keyof PlaygroundParams, after?: () => void) => $<HTMLSelectElement>(id).addEventListener('change', e => { (params as any)[key] = (e.target as HTMLSelectElement).value; after?.(); changed(); });
  sel('look', 'look'); sel('roof', 'roof'); sel('gable', 'gable'); sel('shop', 'shop'); sel('chain', 'chain'); sel('shopsOn', 'shopsOn');
  sel('style', 'style', () => {
    if (params.style !== 'auto') { setters.year(STYLE_YEAR[params.style]); if (params.style === 'tower' && params.storeys < 9) setters.storeys(12); }
    setters.height(heightForStoreys(effectiveStyle(params), params.storeys));
  });
  $<HTMLInputElement>('named').checked = params.named;
  $<HTMLInputElement>('named').addEventListener('change', e => { params.named = (e.target as HTMLInputElement).checked; changed(); });
  $<HTMLInputElement>('extras').checked = params.extras;
  $<HTMLInputElement>('extras').addEventListener('change', e => { params.extras = (e.target as HTMLInputElement).checked; changed(); });
  const seedBox = $<HTMLInputElement>('seed'); seedBox.value = String(params.seed);
  seedBox.addEventListener('input', () => { params.seed = Math.max(0, Math.floor(Number(seedBox.value) || 0)); changed(); });
  $('reroll').addEventListener('click', () => { params.seed = Math.floor(Math.random() * 100000); seedBox.value = String(params.seed); changed(); });
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Link copied'; } catch { $('copy').textContent = 'Copy the address bar'; } setTimeout(() => { $('copy').textContent = 'Copy link to this house'; }, 1800); });

  // --- Real buildings
  const real: { centre: Vec2 | null; id: string | null; at: [number, number] | null; radius: number; scene: RealScene | null; selected: string | null; factsTiles: string[] | null } = { centre: null, id: query.get('id'), at: null, radius: Number(query.get('r')) || 60, scene: null, selected: null, factsTiles: null };
  $<HTMLInputElement>('radius').value = String(real.radius);
  const decorateReal = () => { setShopfronts(game.shopfronts); return gameDecorator({ gables: game.gables, landmarkIds: game.landmarkIds, listed: game.listed }); };
  let realToken = 0;
  async function rebuildReal(reframe = false) {
    if (!real.centre) return;
    const token = ++realToken, [cx, cy] = real.centre;
    $('real-notes').textContent = 'Loading tiles...';
    const tiles = tilesAround(cx, cy, real.radius + 30);
    const features = (await Promise.all(tiles.map(t => loadTile(t)))).flat();
    if (token !== realToken) return;
    const rs = buildRealScene(features, real.centre, real.radius, look(), params.extras, decorateReal());
    real.scene = rs;
    await show(rs.chunks, real.centre, { x: cx, y: cy, size: real.radius * 2 + 400 }, false);
    if (token !== realToken) return;
    if (reframe) { orbit.target = [0, 0, 8]; orbit.dist = Math.max(60, real.radius * 2.2); orbit.yaw = 20; orbit.pitch = 30; }
    $('real-notes').textContent = `${rs.buildings.length} buildings within ${real.radius} m.`;
    setStatus(`${Math.round(rs.chunks.triangles).toLocaleString('en')} triangles; ${rs.buildings.length} buildings`);
    select(real.selected);
    syncUrl();
  }
  function select(id: string | null) {
    real.selected = id;
    if (outline && group) { group.remove(outline); outline.geometry.dispose(); outline = null; }
    const rs = real.scene, b = rs?.buildings.find(x => x.id === id), f = rs?.features.find(x => String(x.properties.id) === id);
    if (!b || !f || !group) { $('real-info').replaceChildren(); draw(); return; }
    outline = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(b.ring.slice(1).flatMap(([x, y], i) => [new THREE.Vector3(b.ring[i][0], b.ring[i][1], b.heightM + 0.2), new THREE.Vector3(x, y, b.heightM + 0.2)])), new THREE.LineBasicMaterial({ color: 0xff7a00 }));
    group.add(outline);
    const d = describeHouse(f, null);
    const lines = [`id ${d.id}`, `year ${d.year ?? 'unknown'}, height ${b.heightM} m, style ${d.facadeStyle}`, `roof ${f.properties.roofPlanned ? String(f.properties.roofShape) : f.properties.kitRoof ? `kit roof, eaves ${Number(f.properties.roofEavesHeightM).toFixed(1)} m` : 'flat lid'}${f.properties.monumentGable ? `, ${f.properties.monumentGable} gable (monuments register)` : ''}`, `shop ${d.shop}${d.chain ? ` (${d.chain})` : ''}`];
    if (d.landmark) lines.push('part of a hand-modelled landmark kit');
    if (d.frontCarrier) lines.push(`carries the measured front "${d.frontCarrier}"`);
    $('real-info').replaceChildren(...lines.map(l => { const c = document.createElement('code'); c.textContent = l; return c; }));
    draw();
  }
  async function goTo(lng: number, lat: number, id: string | null = null) {
    real.centre = toLocal(lng, lat); real.at = [lng, lat]; real.id = id; real.selected = id;
    await rebuildReal(true);
  }
  async function findById(text: string) {
    const id = normaliseBuildingId(text);
    if (!id) { $('real-notes').textContent = 'That is not a building id. Use w123456, NL.IMBAG.Pand.0363..., or the 16-digit number.'; return; }
    $('real-notes').textContent = 'Searching the fact tiles...';
    if (!real.factsTiles) {
      const index = await (await fetch('../data/extracts/amsterdam/building-tiles/index-z14.json')).json();
      real.factsTiles = (index.tileList as string[]).map(t => t.replace(/^14\//, ''));
    }
    const key = shortBuildingId(id), tiles = [...real.factsTiles];
    let hit: string | null = null;
    for (let i = 0; i < tiles.length && !hit; i += 8) {
      const batch = tiles.slice(i, i + 8);
      await Promise.all(batch.map(async t => {
        try {
          const r = await fetch(`../data/extracts/amsterdam/building-facts/14/${t}.json.gz`);
          if (!r.ok) return;
          const bytes = new Uint8Array(await r.arrayBuffer());
          const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
          if (JSON.parse(text).buildings?.[key]) hit = hit ?? t;
        } catch { /* skip */ }
      }));
    }
    if (!hit) { $('real-notes').textContent = `${id} is not in the fact tiles. Try its coordinates instead.`; return; }
    const features = await loadTile(hit);
    const f = features.find(x => String(x.properties.id) === id);
    const ring = f && (f.geometry as any)?.coordinates?.[0]?.[0] ? (f.geometry as any).type === 'Polygon' ? (f.geometry as any).coordinates[0] : (f.geometry as any).coordinates[0][0] : null;
    if (!ring) { $('real-notes').textContent = `${id} is in tile ${hit}, but has no footprint there.`; return; }
    const lng = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, lat = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
    await goTo(lng, lat, id);
  }
  $('find').addEventListener('click', () => void findById($<HTMLInputElement>('bid').value));
  $<HTMLInputElement>('bid').addEventListener('keydown', e => { if (e.key === 'Enter') void findById($<HTMLInputElement>('bid').value); });
  const goLL = () => { const m = $<HTMLInputElement>('ll').value.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/); if (!m) { $('real-notes').textContent = 'Enter latitude, longitude, for example 52.3743, 4.8836.'; return; } void goTo(Number(m[2]), Number(m[1])); };
  $('go').addEventListener('click', goLL);
  $<HTMLInputElement>('ll').addEventListener('keydown', e => { if (e.key === 'Enter') goLL(); });
  $<HTMLSelectElement>('place').addEventListener('change', e => { const [, lng, lat] = PLACES[Number((e.target as HTMLSelectElement).value)]; void goTo(lng, lat); });
  $<HTMLInputElement>('radius').addEventListener('input', e => { real.radius = Number((e.target as HTMLInputElement).value); changed(); });

  // Click a building in the real view: cast the camera ray against the footprints.
  let downAt: [number, number] | null = null;
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (mode !== 'real' || !real.scene || !real.centre || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const rect = canvas.getBoundingClientRect(), nx = ((e.clientX - rect.left) / rect.width) * 2 - 1, ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const cam = gl.camera(orbit, rect.width / rect.height), from = cam.position.clone(), to = new THREE.Vector3(nx, ny, 0.5).unproject(cam), dir = to.sub(from).normalize();
    const hit = pickBuilding([from.x + real.centre[0], from.y + real.centre[1], from.z], [dir.x, dir.y, dir.z], real.scene.buildings as RealBuilding[]);
    if (hit) { real.id = hit.id; select(hit.id); syncUrl(); }
  });

  // --- Tabs, reset, URL
  function setMode(next: 'gen' | 'real') {
    mode = next;
    $('gen').hidden = next !== 'gen'; $('real').hidden = next !== 'real';
    $('tab-gen').setAttribute('aria-selected', String(next === 'gen')); $('tab-real').setAttribute('aria-selected', String(next === 'real'));
    if (next === 'gen') void rebuildGen(true);
    else if (real.centre) void rebuildReal(true);
    else if (real.id) void findById(real.id);
    else if (real.at) void goTo(real.at[0], real.at[1]);
    else { const [, lng, lat] = PLACES[0]; void goTo(lng, lat); }
  }
  $('tab-gen').addEventListener('click', () => setMode('gen'));
  $('tab-real').addEventListener('click', () => setMode('real'));
  $('reset').addEventListener('click', () => { if (mode === 'gen') void rebuildGen(true); else void rebuildReal(true); });
  function syncUrl() {
    const url = new URL(location.href);
    url.search = queryOf(params, mode, { id: real.selected ?? real.id, at: real.at, radius: real.radius }).toString();
    history.replaceState(null, '', url);
  }
  const at = query.get('at')?.split(',').map(Number);
  if (at && at.length === 2 && at.every(Number.isFinite)) real.at = [at[0], at[1]];
  setMode(mode);
  (window as any).__playground = { params, orbit, real, get scene() { return scene; }, fromLocal, tileKeyAt };
}

main().catch(e => { console.error(e); const t = document.getElementById('tris'); if (t) t.textContent = `Could not start: ${e?.message ?? e}`; });
