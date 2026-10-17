/**
 * In-game review frames of the Europarking model (the running game draws every model, the canal and the city around
 * it): across the Singelgracht at the drums and the Waterkant, from the Marnixstraat, the Lijnbaansgracht and above.
 *
 *   PORT=4499 npm run dev   # then
 *   bash /tmp/canal-pw.sh node --import tsx scripts/landmarks/europarking-game-shots.ts --port=4499 [--out=artifacts/landmark-lanes/europarking-marnixstraat/game]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {chromium} from '@playwright/test';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';
import plan from './europarking-marnixstraat-footprints.json';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const port = arg('port', process.env.PW_PORT ?? '4499'), out = arg('out', 'artifacts/landmark-lanes/europarking-marnixstraat/game');
fs.mkdirSync(out, {recursive: true});
const [ax, ay] = plan.anchorRD;
/** Local x-east / z-south metres -> [lng, lat]. */
const ll = (x: number, z: number) => rdToLngLat(ax + x, ay - z);
const views: {name: string; centre: [number, number]; zoom: number; pitch: number; bearing: number}[] = [
  {name: 'singelgracht-drums', centre: ll(-6, -2), zoom: 19.0, pitch: 82, bearing: 67},
  {name: 'singelgracht-wide', centre: ll(5, 5), zoom: 18.4, pitch: 72, bearing: 80},
  {name: 'waterkant-close', centre: ll(-9, 0), zoom: 20.3, pitch: 80, bearing: 67},
  {name: 'marnixstraat', centre: ll(55, 0), zoom: 18.8, pitch: 76, bearing: 230},
  {name: 'lijnbaansgracht', centre: ll(10, -15), zoom: 18.9, pitch: 76, bearing: 160},
  {name: 'aerial-sw', centre: ll(15, 10), zoom: 18.2, pitch: 55, bearing: 45},
];
const br = await chromium.launch({headless: true});
try {
  const page = await br.newPage({viewport: {width: 1100, height: 800}});
  await page.goto(`http://127.0.0.1:${port}/canal-drive/`);
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._signatureLandmarks, null, {timeout: 120000});
  const poi = await page.evaluate(() => (window as any).canalRecallGame.routePois[0]?.id);
  await page.selectOption('#poi-destination', poi);
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && (window as any).canalRecallGame.camera?.introOverview === 0, null, {timeout: 120000});
  await page.evaluate(() => { (window as any).canalRecallGame.vectorMap.sync = () => {}; });
  // Hide the HUD cards so the frame shows the city.
  await page.addStyleTag({content: '#poi-card, .poi-card, .neighborhood-card, .trivia-card, [class*="card"] { visibility: hidden !important; }'});
  // Warm-up: the first jump streams the district in; frames taken before it settles miss the model.
  await page.evaluate(c => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c.centre, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing}), views[0]);
  await page.waitForTimeout(15000);
  const files: string[] = [];
  for (const v of views) {
    await page.evaluate(c => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c.centre, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing}), v);
    await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._signatureLandmarks.shown.has('europarking-marnixstraat'), null, {timeout: 90000}).catch(() => console.log(v.name, 'model not shown'));
    await page.waitForTimeout(6000);
    const f = path.join(out, `${v.name}.png`);
    await page.screenshot({path: f});
    files.push(f);
    console.log('wrote', f);
  }
  const tiles = await Promise.all(files.map(f => sharp(f).resize(550, 400).png().toBuffer()));
  await sharp({create: {width: 1650, height: 800, channels: 3, background: '#fff'}})
    .composite(tiles.map((input, i) => ({input, left: (i % 3) * 550, top: Math.floor(i / 3) * 400}))).png().toFile(path.join(out, 'contact.png'));
} finally { await br.close(); }
