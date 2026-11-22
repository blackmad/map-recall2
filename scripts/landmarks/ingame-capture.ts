/**
 * In-game captures of one landmark at desktop and phone size, for its review and What's New note.
 *
 *   node --import tsx scripts/landmarks/ingame-capture.ts --id=de-roos --port=4484 --views=vondelpark:337,pc-hooftstraat:157
 *   ... --views=user:125:4.8796:52.3573[:zoom[:pitch]]   (a view may name its own look-at point, zoom and pitch)
 *   ... --query='buildings3d=storybook'   (appended to the game URL: a Building look, a flag A/B)
 *   ... --anchor=4.8928,52.3642   (look-at point for an id outside manualCatalogue.json, e.g. an ordinary-<pand> install)
 *   ... --underlay   (also a shot of each view with the model hidden: what else draws on its footprint; it fails when that shot
 *                    equals the model shot, capture-diff.ts)
 *
 * Each view looks at the model's anchor along the given bearing (degrees clockwise from north; the camera stands on the
 * opposite side) at `--zoom` (18.7) and `--pitch` (68). Writes artifacts/review/<id>/ingame-<view>-<desktop|phone>.png.
 * Same ride setup as review-sheet.ts's IN GAME column, with the fresh signature bundle (fresh-signature-bundle.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import {chromium, type Page} from '@playwright/test';
import catalogue from '../../src/canalRecall/landmarks/manualCatalogue.json' with {type: 'json'};
import {gameListsModel, routeFreshSignatureBundle, settleHeldWorld} from './fresh-signature-bundle.ts';
import {changedShareOfFiles} from './capture-diff.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const id = arg('id') ?? 'de-roos';
const port = arg('port') ?? process.env.PW_PORT ?? '4401';
const zoom = Number(arg('zoom') ?? 18.7), pitch = Number(arg('pitch') ?? 68);
const views = (arg('views') ?? 'north:180,south:0').split(',').map(v => {
  const [name, b, lng, lat, z, p] = v.split(':');
  return {name, bearing: Number(b), centre: lng && lat ? [Number(lng), Number(lat)] : undefined, zoom: z ? Number(z) : undefined, pitch: p ? Number(p) : undefined};
});
const spec = (catalogue as Array<{id: string; surveyed?: {anchor?: number[]}; footprint?: {centre?: number[]}}>).find(m => m.id === id);
// --anchor=lng,lat captures a model that is not in the manual catalogue (an ordinary install's id), for a today shot.
const anchorArg = arg('anchor')?.split(',').map(Number);
const anchor = anchorArg ?? spec?.surveyed?.anchor ?? spec?.footprint?.centre;
if (!anchor) throw new Error(`${id}: no anchor in manualCatalogue.json`);
const ROOT = path.resolve(import.meta.dirname, '../..');
const out = path.resolve(ROOT, arg('out') ?? `artifacts/review/${id}`);
const query = arg('query') ?? '';
const underlay = process.argv.includes('--underlay');
fs.mkdirSync(out, {recursive: true});

async function ride(page: Page) {
  await routeFreshSignatureBundle(page);
  await page.goto(`http://127.0.0.1:${port}/canal-drive/${query ? `?${query.replace(/^\?/, '')}` : ''}`);
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
      await page.evaluate(({c, z, p, b}) => ((window as any).canalRecallGame.vectorMap.map ?? (window as any).canalRecallGame.vectorMap.cameraMap).jumpTo({center: c, zoom: z, pitch: p, bearing: b}), {c: v.centre ?? anchor, z: v.zoom ?? zoom, p: v.pitch ?? pitch, b: v.bearing});
      // ride() stubs vectorMap.sync, so a landmark far from the route start was never requested after the jump (every
      // oost-zuid landmark timed out here, 2026-11-07): ask the layer to walk its candidates from the new view, and again
      // on every poll until the model is shown.
      await page.evaluate(() => (window as any).canalRecallGame.vectorMap._signatureLandmarks?._onMove?.());
      await page.waitForFunction(i => {
        const s = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
        if (!s.shown.has(i)) s._onMove?.();
        return s.shown.has(i);
      }, id, {timeout: 60000, polling: 1000});
      await settleHeldWorld(page);
      const file = path.join(out, `ingame-${v.name}-${size}.png`);
      await page.screenshot({path: file, timeout: 180000}); // a loaded machine (load 70-100) took over 30 s per frame
      console.log(file);
      if (underlay) {
        // The model hidden, its suppression kept: whatever still draws on the footprint is a second building. The layer's
        // beforeRender sets every holder's visibility from canShowModel each frame, so hiding the holder alone was undone
        // on the next frame (every underlay shot was the model shot, 2026-11-15): canShowModel itself says no for this id.
        await page.evaluate(i => {
          const s = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
          s.__canShowBeforeUnderlay = s.canShowModel;
          s.canShowModel = (spec: {id: string}) => spec.id !== i && s.__canShowBeforeUnderlay(spec);
          for (const e of s._entries) if (e.spec.id === i) { e.holder.visible = false; for (const b of e.batchIds ?? []) s._batch?.setVisible(b, false); }
          const m = (window as any).canalRecallGame.vectorMap; (m.map ?? m.cameraMap)?.triggerRepaint?.();
        }, id);
        await page.waitForTimeout(1500);
        await settleHeldWorld(page);
        const under = path.join(out, `ingame-${v.name}-${size}-underlay.png`);
        await page.screenshot({path: under, timeout: 180000});
        const share = await changedShareOfFiles(file, under);
        console.log(under, `${(share * 100).toFixed(1)} % of pixels changed`);
        if (share < 0.002) throw new Error(`${id} ${v.name} ${size}: the underlay shot equals the model shot (${(share * 100).toFixed(2)} % changed): the model was not hidden, or it is off screen`);
        await page.evaluate(i => {
          const s = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
          s.canShowModel = s.__canShowBeforeUnderlay; delete s.__canShowBeforeUnderlay;
          for (const e of s._entries) if (e.spec.id === i) { e.holder.visible = true; for (const b of e.batchIds ?? []) s._batch?.setVisible(b, true); }
        }, id);
      }
    }
    await page.close();
  }
} finally { await br.close(); }
