/**
 * Per-wall review sheet: photo of each side next to a camera-matched render of the GLB, a 50 % overlay, and an in-game shot.
 *
 *   PORT=4401 npm run dev                      # only for the in-game shot (skip with --no-game)
 *   node --import tsx scripts/landmarks/review-sheet.ts --id=nassaukerk [--bag=0363100012237328] [--glb=...]
 *        [--out=artifacts/review/<id>] [--port=4401] [--walls=6] [--no-game]
 *
 * For every exposed wall of the BAG footprint (party walls are dropped by the pand-reference selector) the nearest
 * Gemeente Amsterdam panorama (5-35 m from the wall, obliquity <= 55 deg) is aimed at the wall centre through the public
 * thumbnail endpoint. The GLB is rendered with a pinhole camera at the panorama's position, heading, pitch and field of
 * view (camera 2.44 m above the model's y = 0 ground), so a wrong window rhythm, a missing wall of windows or an invented
 * setback shows up as a mismatch tile by tile. Walls with no panorama are labelled "inferred" and rendered from 18 m out.
 *
 * Model placement: surveyed models are native east/south metres from `surveyed.anchor` (x east, z south), north-up.
 * Everything geographic reuses scripts/pand-reference (cached in .cache/pand-reference). Panoramas are CC BY 4.0, Gemeente Amsterdam.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {chromium, type Page} from '@playwright/test';
import {findPands, neighbourhood, normId, rdToLngLat} from '../pand-reference/core.ts';
import {exposedWalls, listPanos, rankPanos, type PanoPick, type Wall} from '../pand-reference/select.ts';
import {loadPano, wallHeight} from '../pand-reference/rectify.ts';
import {directionToPixel, sampleEquirectangular, type EquirectangularImage} from '../../src/canalRecall/facade/rectify.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const flag = (k: string) => process.argv.includes(`--${k}`);
const id = arg('id');
if (!id) { console.error('--id=<model id> required'); process.exit(2); }

interface CatalogueEntry {id: string; modelUrl: string; suppressOsmIds?: string[]; surveyed?: {anchor: [number, number]; northOffsetDegrees: number}; footprint?: {centre: [number, number]}}
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as CatalogueEntry[];
const entry = catalogue.find(c => c.id === id);
if (!entry) { console.error(`${id} not in manualCatalogue.json`); process.exit(2); }
const glb = arg('glb') ?? path.join(ROOT, 'public/canal-drive/models', entry.modelUrl.replace(/^\.\/models\//, ''));
const bag = normId(arg('bag') ?? entry.suppressOsmIds?.find(s => s.includes('IMBAG.Pand')) ?? '');
if (!bag) { console.error('--bag=<BAG pand id> required (no suppressOsmIds pand id in the catalogue)'); process.exit(2); }
const anchor = entry.surveyed?.anchor ?? entry.footprint?.centre;
if (!anchor) { console.error('model has no surveyed anchor / footprint centre'); process.exit(2); }
const out = path.resolve(ROOT, arg('out') ?? `artifacts/review/${id}`);
fs.mkdirSync(out, {recursive: true});
const TILE = 520;

/** Local metres east/north of the anchor (the same equirectangular approximation the thumbnail aiming uses). */
const local = (lng: number, lat: number) => [(lng - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), (lat - anchor[1]) * 110540] as const;
const bearingOf = (w: Wall) => Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360);

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
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(bytes.buffer,'',g=>{g.scene.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.side=T.DoubleSide;}});s.add(g.scene);res(true);},rej);});
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

async function gameShot(centre: [number, number], bearing: number, file: string): Promise<boolean> {
  const port = arg('port') ?? process.env.PW_PORT ?? '4401';
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
    await page.evaluate(({c, b}) => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c, zoom: 18.6, pitch: 62, bearing: b}), {c: centre, b: bearing});
    await page.waitForFunction(i => (window as any).canalRecallGame.vectorMap._signatureLandmarks.shown.has(i), id, {timeout: 60000});
    await page.waitForTimeout(6000);
    await page.screenshot({path: file});
    return true;
  } catch (e) {
    console.log('in-game shot failed:', String(e).split('\n')[0]);
    return false;
  } finally { await br.close(); }
}

async function main() {
  const found = await findPands([bag]);
  const fp = found.get(bag);
  if (!fp) throw new Error(`BAG pand ${bag} not in the building tiles`);
  const centre = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
  const walls = exposedWalls(fp, await neighbourhood(centre)).sort((a, b) => b.len - a.len).slice(0, Number(arg('walls') ?? 6));
  const gh = wallHeight(fp.height);
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
        meta.push({bearing, lengthM: w.len, photo: true, panoId: pick.panoId, year: pick.missionYear, camera: cam});
      } else {
        const d = 18, nx = w.nx, ny = w.ny;
        const [mlng, mlat] = rdToLngLat(w.mid);
        const [mx, my] = local(mlng, mlat);
        const cam: Cam = {pos: [mx + nx * d, 2.44, -(my + ny * d)], headingDeg: (bearing + 180) % 360, pitchDeg: Math.round(Math.atan((gh / 2 - 2.4) / d) * 180 / Math.PI), fovDeg: 70};
        const render = await r.shot(cam);
        const blank = await sharp({create: {width: TILE, height: TILE, channels: 3, background: '#e8e4dc'}}).png().toBuffer();
        tiles = [await label(blank, `INFERRED - no panorama of this side (${head})`, '#b00'), await label(render, 'MODEL (inferred side, 18 m out)', '#b00'), await label(blank, 'no overlay', '#888')];
        meta.push({bearing, lengthM: w.len, photo: false, camera: cam});
      }
      const row = await sharp({create: {width: TILE * 3, height: TILE + 24, channels: 3, background: '#fff'}}).composite(tiles.map((input, i) => ({input, left: i * TILE, top: 0}))).png().toBuffer();
      await sharp(row).toFile(path.join(out, `wall-${bearing}.png`));
      rows.push(row);
      console.log(`  ${head}: ${pick ? 'photo ' + pick.missionYear : 'inferred'}`);
    }
  } finally { await r.close(); }

  if (!flag('no-game') && walls.length) {
    const main = walls[0];
    const file = path.join(out, 'game.png');
    if (await gameShot(anchor as [number, number], (bearingOf(main) + 180) % 360, file)) {
      rows.push(await sharp(file).resize({width: TILE * 3}).png().toBuffer());
    }
  }
  const heights = await Promise.all(rows.map(async b => (await sharp(b).metadata()).height!));
  let y = 0;
  const comp = rows.map((input, i) => { const c = {input, left: 0, top: y}; y += heights[i]; return c; });
  await sharp({create: {width: TILE * 3, height: Math.max(1, y), channels: 3, background: '#fff'}}).composite(comp).png().toFile(path.join(out, 'sheet.png'));
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({id, bag, glb: path.relative(ROOT, glb), walls: meta, attribution: 'Gemeente Amsterdam Panoramabeelden, CC BY 4.0'}, null, 1));
  console.log(`sheet: ${path.join(out, 'sheet.png')}`);
}
await main();
