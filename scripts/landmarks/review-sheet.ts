/**
 * Per-wall review sheet: photo of each side next to a camera-matched render of the GLB, a 50 % overlay, and an in-game
 * frame of the same wall (the game draws every model, so one standing on the same ground shows there).
 *
 *   PORT=4401 npm run dev                      # only for the in-game shot (skip with --no-game)
 *   node --import tsx scripts/landmarks/review-sheet.ts --id=nassaukerk [--bag=0363100012237328] [--glb=...]
 *        [--out=artifacts/review/<id>] [--port=4401] [--walls=6] [--no-game] [--inventory] [--ring=<n> for a MultiPolygon footprint]
 *
 * For every exposed wall of the BAG footprint (party walls are dropped by the pand-reference selector) the nearest
 * Gemeente Amsterdam panorama (5-35 m from the wall, obliquity <= 55 deg) is aimed at the wall centre through the public
 * thumbnail endpoint. The GLB is rendered with a pinhole camera at the panorama's position, heading, pitch and field of
 * view (camera 2.44 m above the model's y = 0 ground), so a wrong window rhythm, a missing wall of windows or an invented
 * setback shows up as a mismatch tile by tile. Walls with no panorama are labelled "inferred" and rendered from 18 m out.
 *
 * --inventory adds a fourth column from scripts/landmarks/<id>-inventory.json (src/canalRecall/landmarks/ornamentInventory.ts):
 * for the inventory wall matching each sheet wall (bearing within 15 deg, nearest centre), every `modelled` / `simplified`
 * item as a photo crop next to the same crop of the camera-matched render (the item's `sheetBox`, else the whole view), so
 * each ornament is proven by its own pair, not by an aerial strip. It also widens --walls to every inventory wall with a
 * photo, so a short wall with the signature (the Hoofdbureau's 13.9 m end wall) is never cut by the longest-6 default.
 *
 * Model placement: surveyed models are native east/south metres from `surveyed.anchor` (x east, z south), north-up.
 * Everything geographic reuses scripts/pand-reference (cached in .cache/pand-reference). Panoramas are CC BY 4.0, Gemeente Amsterdam.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {chromium, type Page} from '@playwright/test';
import {cachedJson, findPands, lngLatToRd, neighbourhood, normId, rdToLngLat, type Footprint} from '../pand-reference/core.ts';
import {exposedWalls, listPanos, rankPanos, type PanoPick, type Wall} from '../pand-reference/select.ts';
import {loadPano, wallHeight} from '../pand-reference/rectify.ts';
import {directionToPixel, sampleEquirectangular, type EquirectangularImage} from '../../src/canalRecall/facade/rectify.ts';
import {matchWall, type InventoryItem, type InventoryWall, type LandmarkInventory} from '../../src/canalRecall/landmarks/ornamentInventory.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const flag = (k: string) => process.argv.includes(`--${k}`);
const id = arg('id');
if (!id) { console.error('--id=<model id> required'); process.exit(2); }

interface CatalogueEntry {id: string; modelUrl: string; suppressOsmIds?: string[]; surveyed?: {anchor: [number, number]; northOffsetDegrees: number}; footprint?: {centre: [number, number]}; buildingFootprint?: {type: string; coordinates: number[][][] | number[][][][]}}
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as CatalogueEntry[];
// Entries written inline in manualModels.ts (Centraal, Muziekgebouw, the OLVG sites) are not in the JSON catalogue.
const entry = catalogue.find(c => c.id === id) ?? (await import('../../src/canalRecall/landmarks/manualModels.ts')).ALL_MANUAL_LANDMARKS.find(c => c.id === id) as unknown as CatalogueEntry | undefined;
if (!entry) { console.error(`${id} not in manualCatalogue.json or manualModels.ts`); process.exit(2); }
// The runtime turns the mesh so its +X axis lands on bearing 90 + northOffsetDegrees (signaturePlacement.ts); the sheet
// renders north-up, so it turns the loaded scene by the same offset (clockwise from above = negative three.js y rotation).
const northOffsetRad = (entry.surveyed?.northOffsetDegrees ?? 0) * Math.PI / 180;
const glb = arg('glb') ?? path.join(ROOT, 'public/canal-drive/models', entry.modelUrl.replace(/^\.\/models\//, ''));
const bag = normId(arg('bag') ?? entry.suppressOsmIds?.find(s => s.includes('IMBAG.Pand')) ?? '');
if (!bag) { console.error('--bag=<BAG pand id> required (no suppressOsmIds pand id in the catalogue)'); process.exit(2); }
const anchor = entry.surveyed?.anchor ?? entry.footprint?.centre;
if (!anchor) { console.error('model has no surveyed anchor / footprint centre'); process.exit(2); }
const out = path.resolve(ROOT, arg('out') ?? `artifacts/review/${id}`);
fs.mkdirSync(out, {recursive: true});
const TILE = 520;
const inventoryFile = path.join(ROOT, 'scripts/landmarks', `${id}-inventory.json`);
const inventory: LandmarkInventory | null = flag('inventory') ? (fs.existsSync(inventoryFile) ? JSON.parse(fs.readFileSync(inventoryFile, 'utf8')) : null) : null;
if (flag('inventory') && !inventory) { console.error(`--inventory: no ${path.relative(ROOT, inventoryFile)} (run scripts/landmarks/landmark-brief.ts)`); process.exit(2); }
const GAME = !flag('no-game');
// The in-game column: the game draws every model and the city around this one, so a second model on the same ground
// (Wereldmuseum under the Tropenmuseum, 2026-10-16) or a neighbour through the wall shows here and nowhere else.
const COLS = (inventory ? 4 : 3) + (GAME ? 1 : 0);

/** Inventory column: per modelled/simplified item, photo crop | render crop (same camera, so the same box), labelled. */
async function inventoryTile(wall: InventoryWall | undefined, photo: Buffer | null, render: Buffer): Promise<Buffer> {
  const bg = () => sharp({create: {width: TILE, height: TILE + 24, channels: 3, background: '#fff'}});
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = (lines: string[], colour = '#111') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${16 * lines.length + 8}">${lines.map((l, i) => `<text x="6" y="${16 * i + 15}" font-family="Helvetica,Arial,sans-serif" font-size="12" fill="${colour}">${esc(l.slice(0, 80))}</text>`).join('')}</svg>`);
  if (!wall) return bg().composite([{input: text(['INVENTORY: no inventory wall matches this side'], '#b00'), top: 0, left: 0}]).png().toBuffer();
  const shown = wall.items.filter(i => i.plan === 'modelled' || i.plan === 'simplified').slice(0, 6);
  const rest = wall.items.filter(i => !shown.includes(i));
  const comps: import("sharp").OverlayOptions[] = [{input: text([`INVENTORY ${wall.tag}: ${wall.items.length} items${rest.length ? `; not shown: ${rest.map(i => `${i.id} (${i.plan})`).join(', ')}` : ''}`], rest.some(i => i.plan === 'open') ? '#b00' : '#111'), top: 0, left: 0}];
  const rowH = shown.length ? Math.floor(TILE / shown.length) : 0, half = TILE / 2;
  for (const [k, it] of shown.entries()) {
    const top = 24 + k * rowH, imgH = rowH - 18;
    const cut = async (img: Buffer | null, item: InventoryItem) => {
      if (!img) return sharp({create: {width: half - 2, height: imgH, channels: 3, background: '#e8e4dc'}}).png().toBuffer();
      const [x0, y0, x1, y1] = item.sheetBox ?? [0, 0, 1, 1];
      const base = sharp(img).resize(TILE, TILE, {fit: 'cover'});
      const region = {left: Math.round(x0 * TILE), top: Math.round(y0 * TILE), width: Math.max(4, Math.round((x1 - x0) * TILE)), height: Math.max(4, Math.round((y1 - y0) * TILE))};
      return sharp(await base.extract(region).png().toBuffer()).resize(half - 2, imgH, {fit: 'contain', background: '#fff'}).png().toBuffer();
    };
    comps.push({input: text([`${it.plan.toUpperCase()} ${it.kind} ${it.id}${it.sheetBox ? '' : ' (no sheetBox: whole view)'}`], it.plan === 'modelled' ? '#060' : '#a60'), top, left: 0});
    comps.push({input: await cut(photo, it), top: top + 18, left: 0}, {input: await cut(render, it), top: top + 18, left: half + 2});
  }
  return bg().composite(comps).png().toBuffer();
}

/** Local metres east/north of the anchor (the same equirectangular approximation the thumbnail aiming uses). */
const local = (lng: number, lat: number) => [(lng - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), (lat - anchor[1]) * 110540] as const;
const bearingOf = (w: Wall) => Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360);
/** File tag `<bearing>-<length>m`, with the wall's index appended when another reviewed wall has the same tag (Centraal has
 *  three 11.9 m Stationsplein walls; they overwrote each other's row and in-game frame). */
const wallTag = (w: Wall, all: Wall[]) => {
  const tag = (v: Wall) => `${bearingOf(v)}-${Math.round(v.len)}m`, t = tag(w);
  return all.filter(v => tag(v) === t).length > 1 ? `${t}-${all.indexOf(w)}` : t;
};

type Cam = {pos: [number, number, number]; headingDeg: number; pitchDeg: number; fovDeg: number};

async function renderer() {
  const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  const page = await br.newPage({viewport: {width: TILE, height: TILE}});
  page.on('pageerror', e => console.log('pageerror', e.message));
  const threeDir = path.resolve(path.dirname(createRequire(import.meta.url).resolve('three')), '..');
  await page.route('http://local/**', route => {
    const p = new URL(route.request().url()).pathname.replace(/^\//, '');
    route.fulfill({body: fs.readFileSync(path.join(threeDir, p)), contentType: 'text/javascript'});
  });
  await page.setContent(`<html><body style="margin:0;background:#c9d6e0"><script type="importmap">{"imports":{"three":"http://local/build/three.module.js","three/addons/":"http://local/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});document.body.appendChild(r.domElement);
const cam=new T.PerspectiveCamera(60,1,.1,2000);const s=new T.Scene();s.background=new T.Color('#c9d6e0');
s.add(new T.HemisphereLight(0xdfe8f0,0x6b6458,1.7));const sun=new T.DirectionalLight(0xfff1dd,2.2);sun.position.set(-30,40,25);s.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(900,900),new T.MeshLambertMaterial({color:0x8f8478}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;s.add(ground);
window.load=b64=>new Promise((res,rej)=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(bytes.buffer,'',g=>{g.scene.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.side=T.DoubleSide;}});g.scene.rotation.y=-${northOffsetRad};s.add(g.scene);res(true);},rej);});
window.shot=(c)=>{r.setSize(${TILE},${TILE});cam.fov=c.fovDeg;cam.aspect=1;cam.updateProjectionMatrix();cam.position.set(...c.pos);
  const h=c.headingDeg*Math.PI/180,p=c.pitchDeg*Math.PI/180;
  // heading clockwise from north; north = -z, east = +x
  cam.lookAt(c.pos[0]+Math.sin(h)*Math.cos(p),c.pos[1]+Math.sin(p),c.pos[2]-Math.cos(h)*Math.cos(p));r.render(s,cam);};
document.title='ready';
</script></body></html>`);
  await page.waitForFunction(() => document.title === 'ready', null, {timeout: 60000});
  await page.evaluate(b => (window as any).load(b), fs.readFileSync(glb).toString('base64'));
  return {
    close: () => br.close(),
    shot: async (cam: Cam): Promise<Buffer> => {
      await page.evaluate(c => (window as any).shot(c), cam);
      return page.locator('canvas').screenshot();
    },
  };
}

/**
 * Rectilinear (pinhole) view out of an Amsterdam world-aligned equirectangular panorama: geographic north at the image
 * centre (AMSTERDAM_WORLD_ALIGNED), so no vehicle heading/pitch/roll is applied. Square output, `fovDeg` on both axes.
 */
function perspectiveFromPano(img: EquirectangularImage, headingDeg: number, pitchDeg: number, fovDeg: number, size: number): Promise<Buffer> {
  const h = headingDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180, t = Math.tan(fovDeg * Math.PI / 360);
  const f = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
  const r = [Math.cos(h), -Math.sin(h), 0];
  const u = [-Math.sin(h) * Math.sin(p), -Math.cos(h) * Math.sin(p), Math.cos(p)];
  const outBuf = Buffer.alloc(size * size * 3), rgb = [0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = ((x + 0.5) / size * 2 - 1) * t, b = -((y + 0.5) / size * 2 - 1) * t;
    const d: [number, number, number] = [f[0] + r[0] * a + u[0] * b, f[1] + r[1] * a + u[1] * b, f[2] + r[2] * a + u[2] * b];
    const [pu, pv] = directionToPixel(d, img, 'centre');
    sampleEquirectangular(img, pu, pv, rgb);
    const o = (y * size + x) * 3;
    outBuf[o] = rgb[0]; outBuf[o + 1] = rgb[1]; outBuf[o + 2] = rgb[2];
  }
  return sharp(outBuf, {raw: {width: size, height: size, channels: 3}}).png().toBuffer();
}

async function label(buf: Buffer, text: string, colour = '#111'): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="24"><rect width="100%" height="100%" fill="#fff"/><text x="6" y="17" font-family="Helvetica,Arial,sans-serif" font-size="13" fill="${colour}">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
  return sharp(buf).resize(TILE, TILE, {fit: 'cover'}).extend({top: 24, background: '#fff'}).composite([{input: Buffer.from(svg), top: 0, left: 0}]).png().toBuffer();
}

/** One in-game frame per wall, looking at the wall from the street side (one browser for all of them). */
async function gameShots(walls: Wall[], dir: string): Promise<Map<Wall, string>> {
  const port = arg('port') ?? process.env.PW_PORT ?? '4401';
  const shots = new Map<Wall, string>();
  const br = await chromium.launch({headless: true});
  try {
    const page: Page = await br.newPage({viewport: {width: 1100, height: 800}});
    await page.goto(`http://127.0.0.1:${port}/canal-drive/`);
    await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._signatureLandmarks, null, {timeout: 90000});
    const poi = await page.evaluate(() => (window as any).canalRecallGame.routePois[0]?.id);
    await page.selectOption('#poi-destination', poi);
    await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && (window as any).canalRecallGame.camera?.introOverview === 0, null, {timeout: 90000});
    await page.evaluate(() => { (window as any).canalRecallGame.vectorMap.sync = () => {}; });
    for (const w of walls) {
      const bearing = bearingOf(w), file = path.join(dir, `game-${wallTag(w, walls)}.png`);
      try {
        await page.evaluate(({c, b}) => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c, zoom: 19.2, pitch: 70, bearing: b}), {c: rdToLngLat(w.mid), b: (bearing + 180) % 360});
        await page.waitForFunction(i => (window as any).canalRecallGame.vectorMap._signatureLandmarks.shown.has(i), id, {timeout: 60000});
        await page.waitForTimeout(5000);
        await page.screenshot({path: file});
        shots.set(w, file);
      } catch (e) { console.log(`in-game shot of wall ${bearing} failed:`, String(e).split('\n')[0]); }
    }
  } catch (e) {
    console.log('in-game shots failed:', String(e).split('\n')[0]);
  } finally { await br.close(); }
  return shots;
}

async function main() {
  const found = await findPands([bag]);
  let fp: Footprint | undefined = found.get(bag);
  // A pand the landmark replaces can be missing from the building tiles (Zuiderkerk, Waag): use the catalogue footprint
  // and the GLB's height from the manifest instead.
  // A MultiPolygon footprint (Noorderkerk: the church and its three corner houses) is reviewed one polygon at a time: --ring=<n>.
  const outer = entry.buildingFootprint?.type === 'Polygon' ? (entry.buildingFootprint.coordinates as number[][][])[0]
    : entry.buildingFootprint?.type === 'MultiPolygon' ? (entry.buildingFootprint.coordinates as number[][][][])[Number(arg('ring') ?? 0)]?.[0] : undefined;
  if (!fp && outer) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/models/signature-landmarks.json'), 'utf8')).models?.[id];
    const height = manifest?.bounds ? manifest.bounds.max[1] - manifest.bounds.min[1] : 15;
    fp = {id: bag, ring: outer.map(p => lngLatToRd([p[0], p[1]])), height};
    console.log(`${bag} not in the building tiles: catalogue buildingFootprint, height ${height.toFixed(1)} m from the manifest`);
  }
  if (!fp) {
    // Same fallback as landmark-brief.ts: the BAG outline from PDOK WFS (CC0). Centraal's 287-vertex station pand is not in the tiles.
    const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${bag.replace('NL.IMBAG.Pand.', '')}</Literal></PropertyIsEqualTo></Filter>`)}`).catch(() => null);
    const g = wfs?.features?.[0]?.geometry;
    if (g) {
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/models/signature-landmarks.json'), 'utf8')).models?.[id];
      fp = {id: bag, ring: (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((p: number[]) => ({x: p[0], y: p[1]})), height: manifest?.bounds ? manifest.bounds.max[1] - manifest.bounds.min[1] : 20};
      console.log(`${bag} not in the building tiles: PDOK WFS outline (${fp.ring.length - 1} vertices)`);
    }
  }
  if (!fp) throw new Error(`BAG pand ${bag} not in the building tiles, PDOK or the catalogue buildingFootprint`);
  const centre = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
  const exposed = exposedWalls(fp, await neighbourhood(centre)).sort((a, b) => b.len - a.len);
  let walls = exposed.slice(0, Number(arg('walls') ?? 6));
  if (inventory) for (const iw of inventory.walls.filter(w => w.evidence === 'photo' && w.items.length)) {
    const hit = exposed.find(w => matchWall([iw], bearingOf(w), rdToLngLat(w.mid) as [number, number]) && Math.abs(w.len - iw.lengthM) < 0.6);
    if (hit && !walls.includes(hit)) walls.push(hit);
  }
  const gh = wallHeight(fp.height);
  const game = GAME && walls.length ? await gameShots(walls, out) : new Map<Wall, string>();
  console.log(`${id}: ${walls.length} exposed walls, tile height ${fp.height} m`);
  const r = await renderer();
  const rows: Buffer[] = [];
  const meta: unknown[] = [];
  try {
    for (const w of walls) {
      const bearing = bearingOf(w);
      const head = `wall ${bearing} deg (${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8]}), ${w.len.toFixed(1)} m`;
      let pick: PanoPick | undefined;
      try { pick = rankPanos(w, await listPanos(w.mid))[0]; } catch (e) { console.log('panorama lookup failed', String(e).split('\n')[0]); }
      const pano = pick ? await loadPano(pick) : null;
      let tiles: Buffer[];
      if (pick && pano) {
        const [lng, lat] = pick.record.geometry.coordinates as [number, number];
        const [e, n] = local(lng, lat);
        const [wl, wa] = rdToLngLat(w.mid);
        const [we, wn] = local(wl, wa);
        const dist = Math.max(pick.distM, 4);
        const headingDeg = (Math.atan2(we - e, wn - n) * 180 / Math.PI + 360) % 360;
        const need = Math.max(w.len / 2 + 1.5, gh / 2 + 1);
        const fovDeg = Math.round(Math.min(100, Math.max(40, 2 * Math.atan(need / dist) * 180 / Math.PI)));
        const pitchDeg = Math.max(0, Math.min(55, Math.round(Math.atan((gh / 2 - 2.4) / dist) * 180 / Math.PI)));
        const thumb = {jpeg: await perspectiveFromPano(pano.img, headingDeg, pitchDeg, fovDeg, TILE), fovDeg};
        const cam: Cam = {pos: [e, 2.44, -n], headingDeg, pitchDeg, fovDeg};
        const render = await r.shot(cam);
        const photo = thumb.jpeg;
        const overlay = await sharp(photo).composite([{input: await sharp(render).resize(TILE, TILE).ensureAlpha(0.5).png().toBuffer(), blend: 'over'}]).png().toBuffer();
        const info = `${pick.missionYear} pano ${pick.distM.toFixed(0)} m, obliq ${pick.obliquityDeg.toFixed(0)} deg, fov ${thumb.fovDeg}`;
        tiles = [await label(photo, `PHOTO ${head} - ${info}`), await label(render, 'MODEL (camera-matched)'), await label(overlay, 'OVERLAY 50 %')];
        if (inventory) tiles.push(await inventoryTile(matchWall(inventory.walls, bearing, rdToLngLat(w.mid) as [number, number]), photo, render));
        meta.push({bearing, lengthM: w.len, photo: true, panoId: pick.panoId, year: pick.missionYear, camera: cam});
      } else {
        const d = 18, nx = w.nx, ny = w.ny;
        const [mlng, mlat] = rdToLngLat(w.mid);
        const [mx, my] = local(mlng, mlat);
        const cam: Cam = {pos: [mx + nx * d, 2.44, -(my + ny * d)], headingDeg: (bearing + 180) % 360, pitchDeg: Math.round(Math.atan((gh / 2 - 2.4) / d) * 180 / Math.PI), fovDeg: 70};
        const render = await r.shot(cam);
        const blank = await sharp({create: {width: TILE, height: TILE, channels: 3, background: '#e8e4dc'}}).png().toBuffer();
        tiles = [await label(blank, `INFERRED - no panorama of this side (${head})`, '#b00'), await label(render, 'MODEL (inferred side, 18 m out)', '#b00'), await label(blank, 'no overlay', '#888')];
        if (inventory) tiles.push(await inventoryTile(matchWall(inventory.walls, bearing, rdToLngLat(w.mid) as [number, number]), null, render));
        meta.push({bearing, lengthM: w.len, photo: false, camera: cam});
      }
      if (GAME) { const shot = game.get(w); tiles.push(shot ? await label(fs.readFileSync(shot), 'IN GAME (every drawn model)') : await label(await sharp({create: {width: TILE, height: TILE, channels: 3, background: '#e8e4dc'}}).png().toBuffer(), 'in-game shot failed', '#b00')); }
      const row = await sharp({create: {width: TILE * COLS, height: TILE + 24, channels: 3, background: '#fff'}}).composite(tiles.map((input, i) => ({input, left: i * TILE, top: 0}))).png().toBuffer();
      await sharp(row).toFile(path.join(out, `wall-${wallTag(w, walls)}.png`));
      rows.push(row);
      console.log(`  ${head}: ${pick ? 'photo ' + pick.missionYear : 'inferred'}`);
    }
  } finally { await r.close(); }

  const heights = await Promise.all(rows.map(async b => (await sharp(b).metadata()).height!));
  let y = 0;
  const comp = rows.map((input, i) => { const c = {input, left: 0, top: y}; y += heights[i]; return c; });
  await sharp({create: {width: TILE * COLS, height: Math.max(1, y), channels: 3, background: '#fff'}}).composite(comp).png().toFile(path.join(out, 'sheet.png'));
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({id, bag, glb: path.relative(ROOT, glb), walls: meta, attribution: 'Gemeente Amsterdam Panoramabeelden, CC BY 4.0'}, null, 1));
  console.log(`sheet: ${path.join(out, 'sheet.png')}`);
}
await main();
