/**
 * In-game captures of one landmark at desktop and phone size, for its review and What's New note.
 *
 *   node --import tsx scripts/landmarks/ingame-capture.ts --id=de-roos --port=4484 --views=vondelpark:337,pc-hooftstraat:157
 *
 * Each view looks at the model's anchor along the given bearing (degrees clockwise from north; the camera stands on the
 * opposite side) at `--zoom` (18.7) and `--pitch` (68). Writes artifacts/review/<id>/ingame-<view>-<desktop|phone>.png.
 * Same ride setup as review-sheet.ts's IN GAME column, with the fresh signature bundle (fresh-signature-bundle.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import {chromium, type Page} from '@playwright/test';
import catalogue from '../../src/canalRecall/landmarks/manualCatalogue.json' with {type: 'json'};
import {gameListsModel, routeFreshSignatureBundle} from './fresh-signature-bundle.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const id = arg('id') ?? 'de-roos';
const port = arg('port') ?? process.env.PW_PORT ?? '4401';
const zoom = Number(arg('zoom') ?? 18.7), pitch = Number(arg('pitch') ?? 68);
const views = (arg('views') ?? 'north:180,south:0').split(',').map(v => { const [name, b] = v.split(':'); return {name, bearing: Number(b)}; });
const spec = (catalogue as Array<{id: string; surveyed?: {anchor?: number[]}; footprint?: {centre?: number[]}}>).find(m => m.id === id);
const anchor = spec?.surveyed?.anchor ?? spec?.footprint?.centre;
if (!anchor) throw new Error(`${id}: no anchor in manualCatalogue.json`);
const ROOT = path.resolve(import.meta.dirname, '../..');
const out = path.resolve(ROOT, arg('out') ?? `artifacts/review/${id}`);
fs.mkdirSync(out, {recursive: true});

async function ride(page: Page) {
  await routeFreshSignatureBundle(page);
  await page.goto(`http://127.0.0.1:${port}/canal-drive/`);
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._signatureLandmarks, null, {timeout: 90000});
  if (!await gameListsModel(page, id)) throw new Error(`${id} is not in GAME_BUILDING_MODELS`);
  const poi = await page.evaluate(() => (window as any).canalRecallGame.routePois[0]?.id);
  await page.selectOption('#poi-destination', poi);
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && (window as any).canalRecallGame.camera?.introOverview === 0, null, {timeout: 90000});
  await page.evaluate(() => { (window as any).canalRecallGame.vectorMap.sync = () => {}; });
}

const br = await chromium.launch({headless: true});
try {
  for (const [size, viewport] of [['desktop', {width: 1280, height: 800}], ['phone', {width: 390, height: 844}]] as const) {
    const page = await br.newPage({viewport, deviceScaleFactor: size === 'phone' ? 2 : 1});
    await ride(page);
    for (const v of views) {
      await page.evaluate(({c, z, p, b}) => (window as any).canalRecallGame.vectorMap.map.jumpTo({center: c, zoom: z, pitch: p, bearing: b}), {c: anchor, z: zoom, p: pitch, b: v.bearing});
      await page.waitForFunction(i => (window as any).canalRecallGame.vectorMap._signatureLandmarks.shown.has(i), id, {timeout: 60000});
      await page.waitForTimeout(5000);
      const file = path.join(out, `ingame-${v.name}-${size}.png`);
      await page.screenshot({path: file});
      console.log(file);
    }
    await page.close();
  }
} finally { await br.close(); }
