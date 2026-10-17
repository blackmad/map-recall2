/**
 * In-game brick tone: frames of named walls under chosen suns, and the brick colour the screen shows there, measured with
 * the same classifier as the photo crops (look/brickTone.ts), so a photo and a frame are compared like for like.
 *
 *   PORT=4483 npm run dev
 *   node --import tsx scripts/look/brick-tone-frames.ts --views=<views.json> --out=<dir> [--port=4483] [--suns=215,40;61,30]
 *
 * views.json: [{ "name": "tropen-61", "pand": "0363100012237251", "bearing": 61, "box": [0.3, 0.2, 0.7, 0.6],
 *                "zoom": 19.2, "pitch": 70, "along": 0, "depth": 0 }]
 * The camera looks at the exposed wall of `pand` whose outward bearing is nearest `bearing` (pand-reference exposedWalls,
 * as review-sheet.ts), or the wall whose middle is `wallMid` [lng, lat] facing `bearing`, from the street, centred
 * `along` metres along the wall and `depth` metres behind it. `--query` is appended to the page URL (`?trees3d=0` keeps
 * trees out of the measured box). `box` (shares of the frame) is
 * where the brick is measured. Each sun is "azimuth,elevation" (default: the rig's own sun). Writes
 * <out>/<name>-sun<az>-<el>.png and <out>/frames.json (per frame the brick median, its Lab hue/chroma, the light class).
 * Run under the browser lock: bash /tmp/canal-pw.sh node --import tsx scripts/look/brick-tone-frames.ts ...
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {chromium} from '@playwright/test';
import {cachedJson, findPands, neighbourhood, normId, rdToLngLat, type Footprint} from '../pand-reference/core.ts';
import {exposedWalls, type Wall} from '../pand-reference/select.ts';
import {labHueChroma, measureBrickTone} from '../../src/canalRecall/look/brickTone.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
type View = {name: string; pand: string; bearing: number; box?: [number, number, number, number]; zoom?: number; pitch?: number; along?: number; depth?: number; wallMid?: [number, number]};
const views = JSON.parse(fs.readFileSync(arg('views') ?? '', 'utf8')) as View[];
const out = path.resolve(arg('out') ?? 'artifacts/brick-tone/frames');
fs.mkdirSync(out, {recursive: true});
const port = arg('port') ?? process.env.PW_PORT ?? '4483';
const suns = (arg('suns') ?? '').split(';').filter(Boolean).map(s => s.split(',').map(Number) as [number, number]);
const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const bearingOf = (w: Wall) => (Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360;
const angleGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

async function wallFor(v: View): Promise<{facing: number; centre: [number, number]}> {
  if (v.wallMid) {
    // A named wall middle (lng, lat) facing `bearing`: no footprint lookup.
    const b = v.bearing * Math.PI / 180, d = v.depth ?? 0, [lng, lat] = v.wallMid;
    return {facing: v.bearing, centre: [lng - d * Math.sin(b) / (111320 * Math.cos(lat * Math.PI / 180)), lat - d * Math.cos(b) / 110540]};
  }
  const id = normId(v.pand);
  let fp: Footprint | undefined = (await findPands([id])).get(id);
  if (!fp) {
    // A pand a landmark model replaces is not in the building tiles: the BAG outline from PDOK WFS (CC0), as review-sheet.ts.
    const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${id.replace('NL.IMBAG.Pand.', '')}</Literal></PropertyIsEqualTo></Filter>`)}`).catch(() => null);
    const g = wfs?.features?.[0]?.geometry;
    if (g) fp = {id, ring: (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((p: number[]) => ({x: p[0], y: p[1]})), height: 20};
  }
  if (!fp) throw new Error(`${v.name}: pand ${v.pand} not in the building tiles or PDOK`);
  const c = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
  const walls = exposedWalls(fp, await neighbourhood(c)).filter(w => angleGap(bearingOf(w), v.bearing) < 20).sort((a, b) => b.len - a.len);
  if (!walls.length) throw new Error(`${v.name}: no exposed wall facing ${v.bearing}`);
  const w = walls[0], along = v.along ?? 0, depth = v.depth ?? 0;
  // The wall runs perpendicular to its normal (nx east, ny north): shift the centre `along` metres to the wall's right and
  // `depth` metres behind it (MapLibre centres a ground point and the wall rises from it, so a centre behind the wall
  // brings the facade to the middle of the frame).
  const mid = {x: w.mid.x + along * w.ny - depth * w.nx, y: w.mid.y - along * w.nx - depth * w.ny};
  return {facing: bearingOf(w), centre: rdToLngLat(mid) as [number, number]};
}

const browser = await chromium.launch({headless: true});
const frames: unknown[] = [];
try {
  const page = await browser.newPage({viewport: {width: 1100, height: 800}});
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(`http://127.0.0.1:${port}/canal-drive/${arg("query") ?? ""}`);
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._signatureLandmarks, null, {timeout: 120000});
  const poi = await page.evaluate(() => (window as any).canalRecallGame.routePois[0]?.id);
  await page.selectOption('#poi-destination', poi);
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && (window as any).canalRecallGame.camera?.introOverview === 0, null, {timeout: 120000});
  await page.evaluate(() => { (window as any).canalRecallGame.vectorMap.sync = () => {}; });
  const rigSun = await page.evaluate(() => { const o = (window as any).canalRecallGame.vectorMap._sharedFrame?.rig?.options; return o ? [o.sunAzimuthDeg, o.sunElevationDeg] : null; });
  // Warm-up: the first jump after the route starts can land while the overview still draws flat.
  const first = await wallFor(views[0]);
  await page.evaluate(({c, b}) => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c, zoom: 19, pitch: 70, bearing: b}), {c: first.centre, b: (first.facing + 180) % 360});
  await page.waitForTimeout(25000);
  for (const v of views) {
    const {facing, centre} = await wallFor(v);
    // Visit the view first and let its cells stream in (the route can start kilometres away; until the detailed tiles
    // arrive, coarse fallback blocks stand in front of the model).
    await page.evaluate(({c, b, z, p}) => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c, zoom: z, pitch: p, bearing: b}), {c: centre, b: (facing + 180) % 360, z: v.zoom ?? 19.2, p: v.pitch ?? 70});
    await page.waitForTimeout(20000);
    for (const sun of suns.length ? suns : [rigSun ?? [215, 40]]) {
      await page.evaluate(([az, el]) => { const f = (window as any).canalRecallGame.vectorMap._sharedFrame; f?.rig?.setSun(az, el); }, sun);
      await page.evaluate(({c, b, z, p}) => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c, zoom: z, pitch: p, bearing: b}), {c: centre, b: (facing + 180) % 360, z: v.zoom ?? 19.2, p: v.pitch ?? 70});
      await page.waitForTimeout(10000);
      await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.triggerRepaint());
      await page.waitForTimeout(1500);
      const file = path.join(out, `${v.name}-sun${sun[0]}-${sun[1]}.png`);
      await page.screenshot({path: file});
      const [x0, y0, x1, y1] = v.box ?? [0.3, 0.2, 0.7, 0.6];
      const {data, info} = await sharp(file).extract({left: Math.round(x0 * 1100), top: Math.round(y0 * 800), width: Math.round((x1 - x0) * 1100), height: Math.round((y1 - y0) * 800)}).removeAlpha().raw().toBuffer({resolveWithObject: true});
      const t = measureBrickTone(data, info.channels);
      const lab = t ? labHueChroma(t.brick) : null;
      const sunOnWall = Math.cos((sun[1] * Math.PI) / 180) * Math.cos(((facing - sun[0]) * Math.PI) / 180);
      frames.push({view: v.name, facing: Math.round(facing), sun, sunOnWall: +sunOnWall.toFixed(3), file: path.relative(process.cwd(), file), brick: t && hex(t.brick), wall: t && hex(t.wall), lab: lab && {L: +lab.L.toFixed(1), hue: +lab.hue.toFixed(1), chroma: +lab.chroma.toFixed(1)}});
      console.log(v.name, `facing ${Math.round(facing)}`, `sun ${sun.join('/')}`, `n.l ${sunOnWall.toFixed(2)}`, t ? `${hex(t.brick)} L${lab!.L.toFixed(0)} h${lab!.hue.toFixed(0)} C${lab!.chroma.toFixed(1)}` : 'no brick');
    }
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify(frames, null, 1));
