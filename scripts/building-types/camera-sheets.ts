/**
 * Panorama | camera-matched render | 50 % overlay contact sheets for the staged building types, plus aerials.
 *
 *   node --import tsx scripts/building-types/camera-sheets.ts --area=slotermeer-geuzenveld --survey            # photos only, all pands (to pick variants)
 *   node --import tsx scripts/building-types/camera-sheets.ts --area=... --sheets=nw-portiek-brick-pitched:2107311,...   # one sheet per type
 *   node --import tsx scripts/building-types/camera-sheets.ts --area=... --aerial
 *   node --import tsx scripts/building-types/camera-sheets.ts --area=... --sheets=<type>:<pand>:back,<type>:<pand>:right --dist=80 --radius=45 --tag=far
 *       a third field picks the facade (front | back | left | right, default front); --dist is the camera distance wanted from the
 *       facade (default 0.9 x its length, 14-32 m), --radius the panorama search radius around that point (default 32 m): tall
 *       slabs need 60-100 m to fit in one frame.
 *   --months=5,6,7,8,9 --scratch=.cache/building-types-summer: only panoramas of those months (sunlit re-shoot for colour sampling).
 *
 * The camera is the municipal panorama's own position, aimed at the front facade (heading, pitch and horizontal
 * FOV computed from the facade width and building height); the render uses the same numbers. No game server is needed:
 * the page script (render-page.ts) is bundled with esbuild and loaded into a blank Chromium page (SwiftShader).
 */
import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
import {chromium, type Page} from '@playwright/test';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
import {solarPosition} from './solar.ts';
import {lngLatToLocal, localToLngLat, bearingDeg, type Anchor, type Pt} from '../../src/canalRecall/buildingTypes/geometry.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const flag = (n: string) => process.argv.includes(`--${n}`);
const area = arg('area', 'slotermeer-geuzenveld'), dir = path.join('staging/building-types', area), SCRATCH = arg('scratch', '.cache/building-types');
const CAM_H = 2.4, W = 1000, H = 750;
// --months=5,6,7,8,9 keeps only panoramas of those months (with --scratch=<dir>: a sunlit re-shoot of a facade whose survey photo was overcast, for colour sampling)
const MONTHS = arg('months') ? new Set(arg('months').split(',').map(Number)) : null;
const input = JSON.parse(fs.readFileSync(path.join(dir, 'instances.json'), 'utf8')) as {anchor: Anchor; instances: any[]; streets: any[]};
const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')) as {instancesDetail: any[]};
const detail = new Map(report.instancesDetail.map(d => [d.pandId, d]));
const placements = JSON.parse(fs.readFileSync(path.join(dir, 'placements.json'), 'utf8')).placements as any[];
const placement = new Map(placements.map(p => [p.pand, p]));
const anchor = input.anchor;

async function bytes(url: string, file: string): Promise<Buffer> {
  if (fs.existsSync(file)) return fs.readFileSync(file);
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(60000)});
      if (!r.ok) throw new Error(String(r.status));
      const b = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, b);
      return b;
    } catch (e) { if (attempt >= 3) throw new Error(`${url}: ${(e as Error).message}`); await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
  }
}

type Side = 'front' | 'back' | 'left' | 'right';
interface View { side?: Side; pandId: string; cam: Pt; camLngLat: [number, number]; heading: number; pitch: number; hfov: number; panoId: string; timestamp: string; depth: number; lateral: number; frontSide: boolean }

const sideKey = (pandId: string, side: Side) => (side === 'front' && !arg('dist') ? pandId : `${pandId}-${side}${arg('dist') ? '-' + arg('dist') : ''}`);

async function pickView(pandId: string, side: Side = 'front'): Promise<View | null> {
  const d = detail.get(pandId), pl = placement.get(pandId), t = pl.transform;
  const [px, , pz] = t.positionChunk as number[];
  const yaw = t.yawRad as number, nF: Pt = [Math.sin(yaw), Math.cos(yaw)], tF: Pt = [Math.cos(yaw), -Math.sin(yaw)];
  // Facade normal/tangent and half-depth for the chosen side (front +z, back -z, right +x, left -x in the unit frame).
  const [n, tangent, half, len]: [Pt, Pt, number, number] = side === 'front' ? [nF, tF, t.widthM / 2, t.lengthM] : side === 'back' ? [[-nF[0], -nF[1]], [-tF[0], -tF[1]], t.widthM / 2, t.lengthM]
    : side === 'right' ? [tF, [-nF[0], -nF[1]], t.lengthM / 2, t.widthM] : [[-tF[0], -tF[1]], nF, t.lengthM / 2, t.widthM];
  const mid: Pt = [px + n[0] * half, pz + n[1] * half];
  const target = arg('dist') ? Number(arg('dist')) : Math.min(32, Math.max(14, len * 0.9)), want: Pt = [mid[0] + n[0] * target, mid[1] + n[1] * target];
  const [lng, lat] = localToLngLat(anchor, want);
  const file = `${SCRATCH}/pano-list/${sideKey(pandId, side)}.json`;
  const listing = JSON.parse((await bytes(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&radius=${arg('radius', '32')}&page_size=250&timestamp_after=2019-01-01`, file)).toString());
  const cands = (listing._embedded?.panoramas ?? []).map((p: any) => {
    const c = lngLatToLocal(anchor, p.geometry.coordinates[0], p.geometry.coordinates[1]), dx = c[0] - mid[0], dz = c[1] - mid[1];
    const depth = dx * n[0] + dz * n[1], lateral = Math.abs(dx * tangent[0] + dz * tangent[1]);
    const month = Number(String(p.timestamp).slice(5, 7)), leafOff = month <= 4 || month >= 11;
    return {p, c, depth, lateral, score: lateral + 0.35 * Math.abs(depth - target) - (leafOff ? 6 : 0) - (p.timestamp > '2023' ? 1 : 0)};
  }).filter((x: any) => x.depth > 5 && x.depth < Math.max(45, target * 1.5) && (!MONTHS || MONTHS.has(Number(String(x.p.timestamp).slice(5, 7))))).sort((a: any, b: any) => a.score - b.score);
  const best = cands[0];
  if (!best) return null;
  const dist = Math.hypot(best.c[0] - mid[0], best.c[1] - mid[1]);
  const heading = bearingDeg(mid[0] - best.c[0], mid[1] - best.c[1]);
  const top = (d.ridgeM ?? d.eavesM + 0.3), topAng = Math.atan((top - CAM_H) / dist) * 180 / Math.PI, botAng = -Math.atan(CAM_H / dist) * 180 / Math.PI;
  const pitch = (topAng + botAng) / 2, halfV = (topAng - botAng) / 2 + 3;
  const hNeeded = 2 * Math.atan((len / 2 + Number(arg('margin', '1.5'))) / dist) * 180 / Math.PI, vAsH = 2 * Math.atan(Math.tan(halfV * Math.PI / 180) * W / H) * 180 / Math.PI;
  return {side, pandId, cam: best.c, camLngLat: [best.p.geometry.coordinates[0], best.p.geometry.coordinates[1]], heading, pitch, hfov: Math.min(105, Math.max(hNeeded, vAsH)), panoId: best.p.pano_id, timestamp: best.p.timestamp, depth: best.depth, lateral: best.lateral, frontSide: true,
    // keep the pano url for the crop
    ...{url: best.p._links.equirectangular_medium.href}} as View & {url: string};
}

async function photo(v: View & {url?: string}): Promise<Buffer> {
  const file = `${SCRATCH}/crops/${sideKey(v.pandId, v.side ?? 'front')}.jpg`;
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const pano = await bytes(v.url!, `${SCRATCH}/pano/${v.panoId}.jpg`);
  const jpg = perspectiveCrop(pano, v.heading, W, H, v.hfov, v.pitch);
  fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, jpg);
  return jpg;
}

const label = (text: string, w: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><rect width="${w}" height="26" fill="#111"/><text x="8" y="18" font-family="Helvetica,Arial,sans-serif" font-size="14" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

async function pageWith(glbs: Buffer[]): Promise<{page: Page; close: () => Promise<void>; info: {tris: number; meshes: number}}> {
  const bundle = await build({entryPoints: ['scripts/building-types/render-page.ts'], bundle: true, format: 'iife', write: false, minify: false, logLevel: 'silent'});
  const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: W, height: H}});
  page.on('pageerror', e => console.error('page error', e.message));
  await page.setContent('<!doctype html><meta charset=utf-8><body></body>');
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  const info = await page.evaluate(async b64 => (window as any).bt.load(b64), glbs.map(g => g.toString('base64')));
  return {page, info, close: () => browser.close()};
}
const dataUrlToBuffer = (u: string) => Buffer.from(u.split(',')[1], 'base64');

async function survey() {
  const tiles: {img: Buffer; text: string}[] = [];
  // --ids=<last digits,...> surveys only those pands
  const ids = arg('ids').split(',').filter(Boolean);
  for (const inst of input.instances.filter(i => !ids.length || ids.some(id => i.pandId.endsWith(id)))) {
    const v = await pickView(inst.pandId) as (View & {url?: string}) | null, d = detail.get(inst.pandId);
    if (!v) { console.warn('no pano', inst.pandId); continue; }
    tiles.push({img: await sharp(await photo(v)).resize(400, 300).jpeg().toBuffer(), text: `${inst.pandId.slice(-7)} ${inst.type.slice(3, 9)} ${d.storeys}st ${d.frontStreet ?? ''} ${v.timestamp.slice(0, 7)}`});
  }
  const cols = 4, rows = Math.ceil(tiles.length / cols);
  for (const [name, subset] of Array.from({length: Math.ceil(tiles.length / 12)}, (_, i) => [String.fromCharCode(97 + i), tiles.slice(i * 12, i * 12 + 12)] as const)) {
    if (!subset.length) continue;
    const r = Math.ceil(subset.length / cols);
    const comp = await Promise.all(subset.map(async (t, i) => [
      {input: t.img, left: (i % cols) * 400, top: Math.floor(i / cols) * 326},
      {input: label(t.text, 400), left: (i % cols) * 400, top: Math.floor(i / cols) * 326 + 300},
    ]));
    const out = await sharp({create: {width: cols * 400, height: r * 326, channels: 3, background: '#000'}}).composite(comp.flat()).jpeg({quality: 82}).toBuffer();
    fs.mkdirSync(path.join(dir, 'sheets'), {recursive: true});
    fs.writeFileSync(`${SCRATCH}/survey-${area}-${name}.jpg`, out);
  }
  console.log('survey sheets in', SCRATCH, rows);
}

async function sheets(spec: string) {
  const bakedGlb = fs.readdirSync(dir).filter(n => /-baked-\d+\.glb$/.test(n)).sort().map(n => fs.readFileSync(path.join(dir, n)));
  const {page, info, close} = await pageWith(bakedGlb);
  console.log('page loaded', info);
  const byType = new Map<string, string[]>();
  for (const part of spec.split(',')) { const [t, id, side] = part.split(':'); byType.set(t, [...(byType.get(t) ?? []), side ? `${id}:${side}` : id]); }
  fs.mkdirSync(path.join(dir, 'sheets'), {recursive: true});
  for (const [type, ids] of byType) {
    const rowsImgs: sharp.OverlayOptions[] = [];
    let y = 0;
    for (const entry of ids) {
      const [id, side = 'front'] = entry.split(':') as [string, Side?];
      const v = await pickView(id, side) as (View & {url?: string}) | null, d = detail.get(id);
      if (!v) { console.warn('no pano for', id); continue; }
      const ph = await sharp(await photo(v)).resize(500, 375).jpeg().toBuffer();
      const pl = placement.get(id).transform, groundY = pl.positionChunk[1];
      // --sun=photo lights the render with the sun of the panorama's own timestamp (fair brightness comparison: a facade in shade in the photo is in shade in the render).
      const sunAt = arg('sun') === 'photo' ? solarPosition(new Date(v.timestamp), v.camLngLat[1], v.camLngLat[0]) : undefined;
      const url: string = await page.evaluate(o => (window as any).bt.camera(o), {x: v.cam[0], z: v.cam[1], y: groundY + CAM_H, heading: v.heading, pitch: v.pitch, hfov: v.hfov, w: W, h: H, groundY, ...(sunAt ? {sun: sunAt} : {})});
      const render = await sharp(dataUrlToBuffer(url)).resize(500, 375).png().toBuffer();
      const blend = await sharp(ph).composite([{input: await sharp(render).ensureAlpha().linear([1, 1, 1, 0.5], [0, 0, 0, 0]).png().toBuffer(), blend: 'over'}]).jpeg().toBuffer();
      fs.writeFileSync(path.join(dir, 'sheets', `${type}-${id.slice(-7)}${side === 'front' ? '' : '-' + side}-render.png`), dataUrlToBuffer(url));
      const text = `${id} ${side === 'front' ? '' : side + ' '} ${d.variant} ${d.storeys}st ${d.groundMode} roof ${d.roofUsed}/${d.ridge}  front ${d.frontBearingDeg}deg ${d.frontStreet ?? ''}  ${v.timestamp.slice(0, 10)}  cam ${v.depth.toFixed(0)} m out`;
      rowsImgs.push({input: label(text, 1500), left: 0, top: y}, {input: ph, left: 0, top: y + 26}, {input: render, left: 500, top: y + 26}, {input: blend, left: 1000, top: y + 26});
      y += 26 + 375;
    }
    const sheet = await sharp({create: {width: 1500, height: y, channels: 3, background: '#000'}}).composite(rowsImgs).jpeg({quality: 85}).toBuffer();
    fs.writeFileSync(path.join(dir, 'sheets', `${type}-contact${arg('tag') ? '-' + arg('tag') : ''}.jpg`), sheet);
    console.log('wrote', path.join(dir, 'sheets', `${type}-contact${arg('tag') ? '-' + arg('tag') : ''}.jpg`));
  }
  await close();
}

async function aerial() {
  const bakedGlb = fs.readdirSync(dir).filter(n => /-baked-\d+\.glb$/.test(n)).sort().map(n => fs.readFileSync(path.join(dir, n)));
  const ctxFile = JSON.parse(fs.readFileSync(path.join(dir, 'context.json'), 'utf8'));
  const {page, close} = await pageWith(bakedGlb);
  const ys = placements.map(p => p.transform.positionChunk as number[]);
  const cx = ys.reduce((s, p) => s + p[0], 0) / ys.length, cz = ys.reduce((s, p) => s + p[2], 0) / ys.length, groundY = ys.reduce((s, p) => s + p[1], 0) / ys.length;
  const ctx = {buildings: ctxFile.buildings.filter((b: any) => Math.hypot(b.ring[0][0] - cx, b.ring[0][1] - cz) < 650), streets: input.streets.filter((s: any) => s.path.some((p: Pt) => Math.hypot(p[0] - cx, p[1] - cz) < 650))};
  const views = [{name: 'aerial-oblique', heading: 20, pitch: 38, distance: 520, fov: 38}, {name: 'aerial-top', heading: 0, pitch: 88, distance: 700, fov: 32}, {name: 'aerial-close', heading: 335, pitch: 30, distance: 190, fov: 45}];
  for (const v of views) {
    const url: string = await page.evaluate(o => (window as any).bt.aerial(o), {...v, cx, cz, groundY, w: 1600, h: 1000, ctx});
    const out = path.join(dir, 'sheets', `${v.name}.jpg`);
    fs.mkdirSync(path.dirname(out), {recursive: true});
    fs.writeFileSync(out, await sharp(dataUrlToBuffer(url)).jpeg({quality: 86}).toBuffer());
    console.log('wrote', out);
  }
  await close();
}

if (flag('survey')) await survey();
if (arg('sheets')) await sheets(arg('sheets'));
if (flag('aerial')) await aerial();
