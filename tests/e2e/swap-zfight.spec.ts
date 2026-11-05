import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { useEngine } from './helpers';
import { SWAP_SPOTS } from '../../scripts/world/abSpots';

// The swap z-fight pin (lane R1-A, #223): the user's S3 shot (map-recall2-screenshots engine/2026-11-06-user-shots,
// the 1962 slab on Weesperstraat, ~150 m) showed moving stripes over the window grid while the camera moved. Here the
// slab's detail chunk is evicted and re-arrives, so it dissolves in over the coarse shell (the swap), and the fade is
// stepped by hand (the clock of every fading chunk set to each step) while the camera pans sub-pixel between steps.
// Per step: the area on the slab whose colour moves by ΔE > 20 from the step before (CIE76 in Lab). A still frame
// has none; a dissolve that draws shell and detail over each other z-fights there. Gate: 0 px during the swap with
// the complementary dissolve (the default); `?swapComplement=0` reports the old overlap.
//   PW_PORT=4640 BUNDLES_DIR=<scratch> /tmp/canal-pw.sh npx playwright test swap-zfight --project=desktop --workers=1
// ZFIGHT_QS adds query flags; ZFIGHT_REPORT_ONLY=1 reports without failing; ZFIGHT_SPOT picks a spot (default s3-slab);
// ZFIGHT_STEPS (24) and ZFIGHT_PAN_PX (0.35 CSS px per step) shape the pan. Output: artifacts/swap-zfight/<project><label>.
const QS = process.env.ZFIGHT_QS ?? '';
const LABEL = process.env.ZFIGHT_LABEL ? `-${process.env.ZFIGHT_LABEL}` : '';
const SPOT = SWAP_SPOTS.find(s => s.name === (process.env.ZFIGHT_SPOT ?? 's3-slab'))!;
const STEPS = Number(process.env.ZFIGHT_STEPS ?? 24);
const PAN_PX = Number(process.env.ZFIGHT_PAN_PX ?? 0.35);
const OUT = 'artifacts/swap-zfight';
if (Number(process.env.ZFIGHT_DPR) > 0) test.use({ deviceScaleFactor: Number(process.env.ZFIGHT_DPR) });

async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings, g = vm._ownGround;
      const groundFading = [...(g?.resident?.values?.() ?? [])].filter((r: any) => r.fade).length;
      vm.host?.triggerRepaint?.();
      return JSON.stringify([s?.inFlight, s?.queued, s?.tiles, s?.features, t?.chunks?.size, t?.pending?.length ?? 0, t?.inflight?.size ?? 0, t?.staged?.length ?? 0, t?.fading?.size ?? 0, t?.leaving?.size ?? 0, g?.loadingCells ?? 0, groundFading]);
    });
    const v = JSON.parse(now), ok = now === last && v[0] === 0 && v[1] === 0 && v.slice(5).every((n: number) => n === 0);
    last = now;
    return ok;
  }, { timeout: 240_000, intervals: [1500] }).toBe(true);
}

/** sRGB bytes → CIE Lab (D65). */
function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
async function rgba(url: string) {
  const { data, info } = await sharp(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
/** Pixels inside `mask` whose colour moved by ΔE > 20 between two frames. */
function deltaArea(a: Buffer, b: Buffer, mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = i * 4, A = lab(a[p], a[p + 1], a[p + 2]), B = lab(b[p], b[p + 1], b[p + 2]);
    if (Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) > 20) n++;
  }
  return n;
}

test('swap z-fight: no moving stripes on the Weesperstraat slab while its detail dissolves in over the shell', async ({ page }, info) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e.stack || e.message).split('\n').slice(0, 6).join(' | ')));
  await page.addInitScript(() => { let seed = 0x5eed1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }; });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await useEngine(page);
  const [lng, lat] = SPOT.rider;
  await page.goto(`/canal-drive/?engine=own&travel=car&governor=0${QS}#race=${lat},${lng},${lat},${lng},${SPOT.face[1]},${SPOT.face[0]}`);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.state = 4; g._quizFreezesRide = () => false; g.player.handleInput = () => {}; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.engine === 'own' && !!vm._threeBuildings?.ready; }), { timeout: 180_000 }).toBe(true);
  await settle(page);
  // Hold the world camera at the spot's pose (the game no longer drives it), with the player's vehicle off every layer.
  const pose = { center: SPOT.camera, zoom: SPOT.zoom, bearing: SPOT.bearing, pitch: SPOT.pitch };
  await page.evaluate((pose) => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm.sync = () => {}; vm.aimAtWorld = () => {};
    for (const top of vm._sharedFrame?.scene?.children ?? []) if (/(^|\/)player-/.test(`${top.userData?.participant ?? ''} ${top.name ?? ''}`)) top.traverse((o: any) => o.layers?.disableAll?.());
    const g = vm._ownGround;
    vm.jumpToLngLat({ ...pose, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
  }, pose);
  await settle(page);
  if (process.env.ZFIGHT_FIND) {
    // Diagnosis: the buildings on a screen grid at the pose (id, year, height, chunk kinds), and the frame.
    const found = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, vp = vm.host.viewport(), out: Record<string, any> = {};
      for (let gy = 1; gy < 36; gy++) for (let gx = 1; gx < 48; gx++) {
        const x = gx * innerWidth / 48, y = gy * innerHeight / 36;
        const hit = tb.inspectAtScreen?.(x * vp.width / innerWidth, y * vp.height / innerHeight, vp.width, vp.height);
        if (!hit || out[hit.id]) continue;
        const keys: string[] = []; let props: any = null;
        for (const [key, e] of tb.chunks) if (e.ranges?.has(hit.id)) { keys.push(key); const f = e.source?.find?.((f: any) => String(f.properties?.id) === hit.id); if (f && !props) props = { h: f.properties.height, y: f.properties.constructionYear, roof: f.properties.roofShape, planned: !!f.properties.roofPlanned }; }
        out[hit.id] = { at: [Math.round(x), Math.round(y)], lngLat: hit.lngLat, keys, ...props };
      }
      return out;
    });
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/find-${SPOT.name}-${info.project.name}.json`, JSON.stringify(found, null, 1));
    const url = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
    writeFileSync(`${OUT}/find-${SPOT.name}-${info.project.name}.png`, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    return;
  }
  // The slab: the pand under the spot's pick point, and the detail chunk that holds it.
  const target = await page.evaluate((pand) => {
    const tb = (window as any).canalRecallGame.vectorMap._threeBuildings;
    const ids = new Set<string>(); let near: string | null = null, nearCount = 0, props: any = null;
    for (const [key, e] of tb.chunks) for (const [id, r] of e.ranges ?? []) {
      if (!String(id).includes(pand)) continue;
      ids.add(String(id));
      if (String(key).startsWith('near:') && r.count > nearCount) { near = key; nearCount = r.count; }
      const f = e.source?.find?.((f: any) => String(f.properties?.id) === String(id));
      if (f && !props) props = { id, height: f.properties.height, year: f.properties.constructionYear, roof: f.properties.roofShape, planned: !!f.properties.roofPlanned };
    }
    return { id: [...ids][0], ids: [...ids], near, props, detailZoom: tb.detailZoom };
  }, SPOT.pand);
  console.log('swap-zfight target', JSON.stringify(target));
  expect(target?.id, 'a building under the pick point').toBeTruthy();
  expect(target?.near, 'the slab has a detail chunk at this pose').toBeTruthy();
  const grab = () => page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
  // The slab's pixels: the frame with it hidden (every chunk's copy) against the frame with it.
  const shown = await rgba(await grab());
  await page.evaluate((ids) => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; tb.setHidden('swap-zfight', ids); }, target!.ids);
  await page.waitForTimeout(300);
  const hidden = await rgba(await grab());
  await page.evaluate(() => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; tb.setHidden('swap-zfight', []); });
  const mask = new Uint8Array(shown.width * shown.height);
  for (let i = 0; i < mask.length; i++) { const p = i * 4; if (Math.abs(shown.data[p] - hidden.data[p]) + Math.abs(shown.data[p + 1] - hidden.data[p + 1]) + Math.abs(shown.data[p + 2] - hidden.data[p + 2]) > 30) mask[i] = 1; }
  // Erode by one pixel: a sub-pixel pan moves the silhouette edge, which is not the façade.
  const inner = new Uint8Array(mask.length);
  for (let y = 1; y < shown.height - 1; y++) for (let x = 1; x < shown.width - 1; x++) { const i = y * shown.width + x; if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - shown.width] && mask[i + shown.width]) inner[i] = 1; }
  const maskPx = inner.reduce((s, v) => s + v, 0);
  console.log('slab mask px', maskPx);
  expect(maskPx, 'the slab is on screen').toBeGreaterThan(500);
  // Steps: the camera pans PAN_PX CSS px per step across the view (about the slab, at its distance); `fade` holds the
  // swap's dissolve at t = step / STEPS. Run once with the detail solid (the still floor), once through the swap.
  const run = async (swap: boolean) => {
    await page.evaluate(([pose, key]) => {
      const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, g = vm._ownGround;
      vm.jumpToLngLat({ ...pose, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
      (window as any).__zf = { key };
    }, [pose, target!.near] as const);
    await page.waitForTimeout(200);
    if (swap) {
      // Evict the detail chunk (the shells show its buildings again) and let it re-arrive: it dissolves in over them.
      await page.evaluate((key) => {
        const tb = (window as any).canalRecallGame.vectorMap._threeBuildings, e = tb.chunks.get(key);
        (window as any).__zf.source = e.source;
        tb.dropChunk(key);
        tb.pending.push(key, () => tb.rebuild(key, e.source));
        tb.pump();
      }, target!.near);
      await expect.poll(() => page.evaluate((key) => (window as any).canalRecallGame.vectorMap._threeBuildings.fading.has(key), target!.near), { timeout: 60_000, intervals: [16] }).toBe(true);
    }
    const frames: { data: Buffer }[] = [], areas: number[] = [], under: number[] = [];
    for (let step = 0; step <= STEPS; step++) {
      await page.evaluate(([pose, step, panPx, steps, swap]) => {
        const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, g = vm._ownGround;
        // Hold every fading chunk at t = step / STEPS of its dissolve (CHUNK_FADE_MS 700), whatever the wall clock.
        if (swap) for (const f of tb.fading.values()) f.start = performance.now() - 700 * Math.min(0.999, step / steps);
        const mPerPx = 156543.03 * Math.cos(pose.center[1] * Math.PI / 180) / 2 ** pose.zoom;
        const along = step * panPx * mPerPx, b = pose.bearing * Math.PI / 180;
        const dLng = along * Math.cos(b) / (111320 * Math.cos(pose.center[1] * Math.PI / 180)), dLat = -along * Math.sin(b) / 110540;
        const center = [pose.center[0] + dLng, pose.center[1] + dLat];
        vm.jumpToLngLat({ ...pose, center, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
      }, [pose, step, PAN_PX, STEPS, swap] as const);
      const shot = await rgba(await grab());
      under.push(await page.evaluate(() => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; return tb.fading.size; }));
      if (frames.length) areas.push(deltaArea(frames[frames.length - 1].data, shot.data, inner));
      frames.push({ data: shot.data });
      if (step === Math.round(STEPS / 2)) {
        mkdirSync(OUT, { recursive: true });
        await sharp(shot.data, { raw: { width: shot.width, height: shot.height, channels: 4 } }).png().toFile(`${OUT}/${info.project.name}${LABEL}-${swap ? 'swap' : 'still'}-mid.png`);
      }
    }
    if (swap) await settle(page);
    return { areas, fadingSteps: under.filter(n => n > 0).length };
  };
  const still = await run(false);
  const swap = await run(true);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const report = { when: new Date().toISOString(), spot: SPOT.name, qs: QS, target, maskPx, steps: STEPS, panPx: PAN_PX,
    still: { total: sum(still.areas), max: Math.max(...still.areas), areas: still.areas },
    swap: { total: sum(swap.areas), max: Math.max(...swap.areas), areas: swap.areas, fadingSteps: swap.fadingSteps },
    // What the swap adds over the still pan, per step: the stripes.
    excess: swap.areas.map((v, i) => Math.max(0, v - still.areas[i])), errors };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${info.project.name}${LABEL}.json`, JSON.stringify(report, null, 1));
  console.log('swap-zfight', JSON.stringify({ spot: SPOT.name, qs: QS, maskPx, still: report.still.total, swap: report.swap.total, excess: sum(report.excess), excessMax: Math.max(...report.excess), fadingSteps: swap.fadingSteps }));
  expect(errors, 'page errors').toEqual([]);
  expect(swap.fadingSteps, 'the swap was dissolving through the steps').toBeGreaterThan(STEPS * 0.8);
  if (!process.env.ZFIGHT_REPORT_ONLY) expect(sum(report.excess), 'ΔE>20 px on the slab beyond the still pan, during the swap').toBe(0);
});
