import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';

// BAG-keyed base tiles + covers (docs/handoffs/lane-bag-base-tiles-20261013.md).
// `?bagTiles=1` streams `bag-tiles/` and hides the pands covers.json lists for
// each drawn model instead of its hand-kept suppressOsmIds. With the flag off
// nothing changes. The spec loads the same two spots with and without the flag
// and requires (1) the flag really switches the tile set and loads covers,
// (2) the ids hidden with the flag include every id the legacy lists hide
// *in the tiles*, and (3) the fixed-camera shots differ by almost no pixels.
//
// Skips when the BAG tiles / covers.json are not published yet.
//   LOOK_BUNDLES_DIR=<dir> serves a freshly built building-tiles.bundle.js (as look-consistency does).
//   BAG_SHOTS_OUT=<dir> keeps the PNGs for review.
const OUT = process.env.BAG_SHOTS_OUT || 'artifacts/bag-tiles/e2e';
// Fraction of pixels allowed to differ (streaming order and shadow-map noise exist even flag-off).
const SKYLINE_CROP = 0.35;
const MAX_DIFF = Number(process.env.BAG_MAX_DIFF || 0.004);

type View = { name: string; target: [number, number]; bearing: number; distM: number; altM: number; targetAltM: number };
const VIEWS: View[] = [
  { name: 'westerkerk', target: [4.88390, 52.37450], bearing: 200, distM: 140, altM: 45, targetAltM: 15 },
  { name: 'rijksmuseum', target: [4.88520, 52.36000], bearing: 20, distM: 150, altM: 50, targetAltM: 12 },
  // Dam: Royal Palace and the Bijenkorf front kits; the spot where covers first differed from suppressOsmIds.
  { name: 'dam', target: [4.89260, 52.37300], bearing: 250, distM: 170, altM: 60, targetAltM: 12 },
];

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number): [number, number] => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

async function load(page: Page, query: string): Promise<void> {
  const bundles = process.env.LOOK_BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
}

async function settleAt(page: Page, view: View): Promise<void> {
  const eye = ahead(view.target, view.bearing, view.distM);
  await page.evaluate(({ eye, view }) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(50); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    (window as any).__bagCamera = map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, view.altM, { lng: view.target[0], lat: view.target[1] }, view.targetAltM);
    map.jumpTo((window as any).__bagCamera);
    (window as any).__bagIdle = 0;
  }, { eye, view });
  await page.waitForFunction(() => {
    const vm = (window as any).canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks, w = window as any;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}`;
    w.__bagIdle = idle && landmarksIdle && key === w.__bagKey ? (w.__bagIdle || 0) + 1 : 0;
    w.__bagKey = key;
    return w.__bagIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  await page.evaluate(() => { const w = window as any; w.canalRecallGame.vectorMap.map.jumpTo(w.__bagCamera); });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
    const canvas = map.getCanvas() as HTMLCanvasElement;
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
  await page.waitForTimeout(1500);
}

type Run = { using: boolean; covers: boolean; hidden: string[]; legacyHidden: string[]; tileIds: string[]; shots: Record<string, Buffer>; near: Record<string, string[]> };

async function run(page: Page, query: string): Promise<Run> {
  await load(page, query);
  const shots: Record<string, Buffer> = {};
  const hidden = new Set<string>(), legacy = new Set<string>(), tileIds = new Set<string>(), near: Record<string, string[]> = {};
  let using = false, covers = false;
  for (const view of VIEWS) {
    await settleAt(page, view);
    const state = await page.evaluate((target) => {
      const vm = (window as any).canalRecallGame.vectorMap, l = vm._signatureLandmarks;
      // Models resident within 500 m of the view: which landmarks have streamed in varies run to run, and a model
      // present in one page and not the other is a pixel difference that has nothing to do with the tiles.
      const anchorOf = (e: any) => e.placement?.anchor ?? e.spec.surveyed?.anchor ?? e.spec.footprint?.centre;
      const near = [...(l?._entries ?? [])].filter((e: any) => l.shown?.has(e.spec.id) && anchorOf(e)
        && Math.hypot((anchorOf(e)[0] - target[0]) * 68000, (anchorOf(e)[1] - target[1]) * 111320) < 500).map((e: any) => e.spec.id).sort() as string[];
      const features = vm._completeCity?.cache?.collection?.().features ?? [];
      return {
        using: !!vm._completeCity?.usingBagTiles, covers: !!vm._bagCovers,
        shown: [...(l?.shown ?? [])] as string[], hidden: vm._signatureSuppressOsmIds() as string[], legacy: (l?.shownSuppressOsmIds?.() ?? []) as string[],
        tileIds: features.map((f: any) => String(f.properties.id)) as string[], near,
      };
    }, view.target);
    near[view.name] = state.near;
    using = state.using; covers = state.covers;
    state.hidden.forEach(id => hidden.add(id)); state.legacy.forEach(id => legacy.add(id)); state.tileIds.forEach(id => tileIds.add(id));
    shots[view.name] = await page.locator('canvas.maplibregl-canvas').first().screenshot();
  }
  return { using, covers, hidden: [...hidden], legacyHidden: [...legacy], tileIds: [...tileIds], shots, near };
}

test('?bagTiles=1 draws the same city: BAG tiles, covers instead of suppressOsmIds', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for a pixel comparison');
  test.setTimeout(900_000);
  const published = await fetch(`${info.project.use.baseURL ?? 'http://127.0.0.1:' + (process.env.PW_PORT || '4173')}/data/extracts/amsterdam/bag-tiles/index-z14.json`).then(r => r.ok && (r.headers.get('content-type') ?? '').includes('json'), () => false);
  test.skip(!published, 'BAG tiles are not published into the extract yet');
  mkdirSync(OUT, { recursive: true });

  // Warm the dev server and the HTTP cache first, then measure: the first page load is slower and loads fewer
  // landmarks within the same settle window, which looks like a flag effect when the flag is always second.
  await load(await (await browser.newContext()).newPage(), '');
  const offFirst = process.env.BAG_ON_FIRST !== '1';
  const first = await run(await (await browser.newContext()).newPage(), offFirst ? '' : '?bagTiles=1');
  const second = await run(await (await browser.newContext()).newPage(), offFirst ? '?bagTiles=1' : '');
  const off = offFirst ? first : second, on = offFirst ? second : first;

  expect(off.using, 'flag off reads the legacy tiles').toBe(false);
  expect(off.covers, 'flag off loads no covers').toBe(false);
  expect(on.using, 'flag on reads bag-tiles').toBe(true);
  expect(on.covers, 'flag on loads covers.json').toBe(true);

  // Every id the legacy lists hide that actually names a feature in the tiles must still be hidden.
  const tiles = new Set(on.tileIds);
  // Compared inside one page: which models are registered varies with load timing between pages.
  const lost = on.legacyHidden.filter(id => tiles.has(id) && !on.hidden.includes(id));
  info.annotations.push({ type: 'lost', description: JSON.stringify(lost) });
  expect(lost, 'legacy-effective hides lost by covers').toEqual([]);
  expect(on.hidden.length, 'covers hide something').toBeGreaterThan(0);

  for (const view of VIEWS) {
    const a = await sharp(off.shots[view.name]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(on.shots[view.name]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([a.info.width, a.info.height]).toEqual([b.info.width, b.info.height]);
    // The far skyline (coarse tiles streaming in and out) differs run to run even flag-off; compare below it.
    const top = Math.floor(a.info.height * SKYLINE_CROP) * a.info.width * 4;
    let differing = 0;
    for (let i = top; i < a.data.length; i += 4) {
      if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) > 8) differing++;
    }
    const share = differing / (a.info.width * a.info.height * (1 - SKYLINE_CROP));
    await sharp(off.shots[view.name]).toFile(`${OUT}/${view.name}-off.png`);
    await sharp(on.shots[view.name]).toFile(`${OUT}/${view.name}-on.png`);
    info.annotations.push({ type: view.name, description: `${differing} px differ (${(share * 100).toFixed(3)}%)` });
    const sameModels = JSON.stringify(off.near[view.name]) === JSON.stringify(on.near[view.name]);
    info.annotations.push({ type: `${view.name}-models`, description: sameModels ? 'same resident models near the view' : `resident models differ: off ${off.near[view.name].length}, on ${on.near[view.name].length}` });
    if (sameModels) expect(share, `${view.name}: share of pixels differing`).toBeLessThan(MAX_DIFF);
  }
});
