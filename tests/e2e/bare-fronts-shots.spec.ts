import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { useEngine } from './helpers';
import { BARE_SPOTS } from '../../scripts/large-tier/bareSpots';

// Lane R5-D (#264): the user's three "bare block" shots of 2026-11-08 (map-recall2-screenshots
// engine/2026-11-08-user-shots/bare-block-*.png), re-taken at the same aerial pose. The rider stays where the user's
// was (Nieuwe Vaart, Marineterrein), so the blocks are drawn by the aerial tiers (baked shells), as in the shots.
// Per spot and variant: the frame, and which chunks hold the spot's pand (detail / coarse / baked) with its state.
//   PW_PORT=4684 BUNDLES_DIR=<scratch> /tmp/canal-pw.sh npx playwright test tests/e2e/bare-fronts-shots.spec.ts --project=desktop --workers=1
// BARE_VARIANTS='main=;off=&bareFronts=0' (label=query suffix, default one variant 'main'); BARE_SPOT=vob picks one
// spot. Output: artifacts/bare-fronts/<spot>-<label>.png and .json.
const VARIANTS = (process.env.BARE_VARIANTS ?? 'main=').split(';').filter(Boolean).map(v => ({ label: v.slice(0, v.indexOf('=')), qs: v.slice(v.indexOf('=') + 1) }));
// BARE_SPOTS_FILE=artifacts/large-tier/audit-spots.json: the audit's spot list (scripts/large-tier/audit-spots.ts, same
// shape) in place of the user's three; BARE_OUT moves the output directory.
const ALL_SPOTS: ReadonlyArray<{ name: string; camera: readonly number[]; zoom: number; bearing: number; pitch: number; pands: readonly string[] }> = process.env.BARE_SPOTS_FILE ? JSON.parse(readFileSync(process.env.BARE_SPOTS_FILE, 'utf8')) : BARE_SPOTS;
const SPOTS = ALL_SPOTS.filter(s => !process.env.BARE_SPOT || process.env.BARE_SPOT.split(',').includes(s.name));
const OUT = process.env.BARE_OUT ?? 'artifacts/bare-fronts';
const RIDER = [4.9152, 52.3727], FACE = [4.9165, 52.3730];
test.use({ viewport: { width: 1260, height: 730 } });

async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings, g = vm._ownGround;
      vm.host?.triggerRepaint?.();
      return JSON.stringify([s?.inFlight, s?.queued, s?.tiles, s?.features, t?.chunks?.size, t?.pending?.length ?? 0, t?.inflight?.size ?? 0, t?.staged?.length ?? 0, t?.fading?.size ?? 0, t?.leaving?.size ?? 0, g?.loadingCells ?? 0]);
    });
    const v = JSON.parse(now), ok = now === last && !v[0] && !v[1] && v.slice(5).every((n: number) => n === 0);
    last = now;
    return ok;
  }, { timeout: 240_000, intervals: [2000] }).toBe(true);
}

for (const variant of VARIANTS) test(`bare fronts at the user's spots (${variant.label})`, async ({ page }) => {
  test.setTimeout(900_000 + SPOTS.length * 90_000);
  await page.addInitScript(() => { let seed = 0x5eed1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }; });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  // BUNDLES_DIR: serve the lane's scratch-built bundles in place of the committed ones (never build into the served tree).
  if (process.env.BUNDLES_DIR) await page.route(/\/js\/[^/?]+\.bundle\.js(\?|$)/, route => {
    const file = `${process.env.BUNDLES_DIR}/${new URL(route.request().url()).pathname.split('/').pop()}`;
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
  await useEngine(page);
  await page.goto(`/canal-drive/?engine=own&travel=car&governor=0${variant.qs}#race=${RIDER[1]},${RIDER[0]},${RIDER[1]},${RIDER[0]},${FACE[1]},${FACE[0]}`);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.state = 4; g._quizFreezesRide = () => false; g.player.handleInput = () => {}; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.engine === 'own' && !!vm._threeBuildings?.ready; }), { timeout: 180_000 }).toBe(true);
  await settle(page);
  mkdirSync(OUT, { recursive: true });
  // BARE_LAYERS=126,159: the painted facade cells' mean colour and dark (glass) share, read back from the texture array.
  if (process.env.BARE_LAYERS) console.log('bare-fronts layers', JSON.stringify(await page.evaluate((layers) => {
    const tb = (window as any).canalRecallGame.vectorMap._threeBuildings, tex = tb.material?.uniforms?.cells?.value, img = tex?.image ?? tex?.source?.data;
    const data: Uint8Array | undefined = img?.data, w = img?.width, h = img?.height, out: Record<string, unknown> = { depth: img?.depth, w, h, hasData: !!data };
    if (!data) return out;
    for (const l of layers) {
      let r = 0, g = 0, b = 0, dark = 0; const px = w * h, o = l * px * 4;
      for (let i = 0; i < px; i++) { const R = data[o + i * 4], G = data[o + i * 4 + 1], B = data[o + i * 4 + 2]; r += R; g += G; b += B; if (R + G + B < 240) dark++; }
      out[l] = { mean: [r / px, g / px, b / px].map(Math.round), dark: +(dark / px).toFixed(3) };
    }
    return out;
  }, process.env.BARE_LAYERS.split(',').map(Number))));
  for (const spot of SPOTS) {
    await page.evaluate((spot: any) => {
      const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
      vm.sync = () => {}; vm.aimAtWorld = () => {};
      vm.jumpToLngLat({ center: spot.camera, zoom: spot.zoom + spot.zoomAdd, bearing: spot.bearing, pitch: spot.pitch, elevation: g?.ready ? g.heightAt(spot.camera) : 0 });
    }, { ...spot, zoomAdd: Number(process.env.BARE_ZOOM_ADD ?? 0) } as any);
    await page.waitForTimeout(1500);
    await settle(page);
    const where = await page.evaluate((pands) => {
      const tb = (window as any).canalRecallGame.vectorMap._threeBuildings, out: Record<string, string[]> = {};
      for (const pand of pands) {
        out[pand] = [];
        for (const [key, e] of tb.chunks) for (const [id] of e.ranges ?? []) if (String(id).includes(pand)) {
          // The feature as the runtime decorated it (the uploaded arrays are released after upload).
          const f = e.source?.find?.((x: any) => String(x.properties?.id) === String(id)), q = f?.properties ?? {};
          const keep = ['facade', 'facadeStyle', 'largeTier', 'kitWall', 'sideColour', 'colour', 'facadeMappedColour', 'facadeMaterialColourPrior', 'periodWallHex', 'shopKind', 'shopColour', 'constructionYear', 'height', 'frontCarrier'];
          out[pand].push(`${key}${e.mesh?.visible === false ? ' (not visible)' : ''} ${JSON.stringify(Object.fromEntries(keep.filter(k => q[k] !== undefined).map(k => [k, q[k]])))}`);
        }
        for (const [key, e] of tb.bakedEntries ?? []) for (const [id, r] of e.ranges ?? []) if (String(id).includes(pand)) {
          // The per-vertex state the facade layer wrote (0 drawn, 1 hidden, 2 highlighted, 3 dimmed, 4 ghosted) and the program's highlight define.
          const h = e.mesh?.geometry?.getAttribute?.('hidden'), seen = new Set<number>();
          if (h) for (let i = r.start; i < r.start + r.count; i++) seen.add(h.getX(i));
          const m = Array.isArray(e.mesh?.material) ? e.mesh.material[0] : e.mesh?.material;
          out[pand].push(`baked ${key} hidden ${[...seen].join('/')} HL_KEEP ${m?.defines ? 'HL_KEEP' in m.defines : '?'}`);
        }
      }
      return out;
    }, [...spot.pands]);
    const url = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
    writeFileSync(`${OUT}/${spot.name}-${variant.label}${process.env.BARE_ZOOM_ADD ? '-z' + process.env.BARE_ZOOM_ADD : ''}.png`, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    writeFileSync(`${OUT}/${spot.name}-${variant.label}${process.env.BARE_ZOOM_ADD ? '-z' + process.env.BARE_ZOOM_ADD : ''}.json`, JSON.stringify({ spot, where }, null, 1));
    console.log('bare-fronts', spot.name, variant.label, JSON.stringify(where));
  }
});
