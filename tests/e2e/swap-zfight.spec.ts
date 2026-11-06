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
const SPOT: any = SWAP_SPOTS.find(s => s.name === (process.env.ZFIGHT_SPOT ?? 's3-slab'))!;
const STEPS = Number(process.env.ZFIGHT_STEPS ?? 24);
const PAN_PX = Number(process.env.ZFIGHT_PAN_PX ?? 0.35);
const OUT = 'artifacts/swap-zfight';
// ZFIGHT_SS=4 (lane R2-A #228): also pan once at SS x the pixel ratio, each frame box-reduced in the page to the base
// size: the supersampled reference. A sharp, correctly filtered edge that moves 0.35 px changes its pixels by ΔE > 20
// in both; aliasing (moiré) changes them in the base frames only. `aliasPx` counts, per step, the slab pixels whose
// step change is ΔE > 20 at the base ratio but not in the reference: the still-pan area that is not true motion.
const SS = Number(process.env.ZFIGHT_SS ?? 0);
if (Number(process.env.ZFIGHT_DPR) > 0) test.use({ deviceScaleFactor: Number(process.env.ZFIGHT_DPR) });
// Lane R3-A (#230): a spot with `viewport` runs in that window (s3-slab-user: the user's 1448 × 657 CSS px), one with
// `eye` holds the camera at that eye (lng, lat, metres over the ground) looking `bearing` at `pitch`, one with
// `pitch: null` at the chase pitch. A spot without `pand` (or ZFIGHT_MASK=frame) counts over the whole frame and runs
// the still pan and the alias reference only (no building to swap). ZFIGHT_OWNER=1 reloads with `?thinDebug=owner`
// after the pans and buckets every alias pixel by the owner class drawn there (look/thinFade.ts THIN_OWNER_CLASSES).
if (SPOT.viewport && !process.env.ZFIGHT_NO_VIEWPORT) test.use({ viewport: { width: SPOT.viewport[0], height: SPOT.viewport[1] } });
const FRAME_MASK = !SPOT.pand || process.env.ZFIGHT_MASK === 'frame';

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
  const pose = await page.evaluate((spot) => {
    const vm = (window as any).canalRecallGame.vectorMap, cm = vm.cameraMap, g = vm._ownGround;
    if (!spot.eye) return { center: spot.camera, zoom: spot.zoom, bearing: spot.bearing, pitch: spot.pitch ?? vm.pitchForViewMode('chase') };
    const [lng, lat, alt] = spot.eye, ground = g?.ready ? g.heightAt([lng, lat]) : 0;
    const run = alt * Math.tan(spot.pitch * Math.PI / 180), b = spot.bearing * Math.PI / 180;
    const to = [lng + run * Math.sin(b) / (111320 * Math.cos(lat * Math.PI / 180)), lat + run * Math.cos(b) / 111132];
    const o = cm.calculateCameraOptionsFromTo([lng, lat], alt + ground, to, ground);
    return { center: o.center, zoom: o.zoom, bearing: o.bearing, pitch: o.pitch };
  }, SPOT);
  console.log('swap-zfight pose', JSON.stringify(pose));
  // ZFIGHT_EVAL (lane R3-A, diagnosis): page code run once at the pose before measuring (e.g. flat colour, extras off).
  if (process.env.ZFIGHT_EVAL) { await page.evaluate(process.env.ZFIGHT_EVAL); await page.waitForTimeout(300); }
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
      for (let gy = 1; gy < 12; gy++) for (let gx = 1; gx < 16; gx++) {
        const x = gx * innerWidth / 16, y = gy * innerHeight / 12;
        const hit = tb.inspectAtScreen?.(x * vp.width / innerWidth, y * vp.height / innerHeight, vp.width, vp.height);
        if (!hit || out[hit.id]) continue;
        const keys: string[] = []; let props: any = null;
        for (const [key, e] of tb.chunks) if (e.ranges?.has(hit.id)) { keys.push(key); const f = e.source?.find?.((f: any) => String(f.properties?.id) === hit.id); if (f && !props) props = { h: f.properties.height, y: f.properties.constructionYear, roof: f.properties.roofShape, planned: !!f.properties.roofPlanned }; }
        out[hit.id] = { at: [Math.round(x), Math.round(y)], lngLat: hit.lngLat, keys, ...props };
      }
      return out;
    });
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/find-${SPOT.name}-${info.project.name}${LABEL}.json`, JSON.stringify(found, null, 1));
    const url = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
    writeFileSync(`${OUT}/find-${SPOT.name}-${info.project.name}${LABEL}.png`, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    return;
  }
  // The slab: the pand under the spot's pick point, and the detail chunk that holds it.
  const target = FRAME_MASK ? null : await page.evaluate((pand) => {
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
  if (!FRAME_MASK) {
  console.log('swap-zfight build', JSON.stringify(await page.evaluate(() => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; return { complement: tb.complement, swapUniform: !!tb.material?.uniforms?.citySwapUnder, defines: Object.keys(tb.material?.defines ?? {}), name: tb.material?.name, slots: tb.swapSlots?.used ?? null }; })));
  expect(target?.id, 'a building under the pick point').toBeTruthy();
  expect(target?.near, 'the slab has a detail chunk at this pose').toBeTruthy();
  }
  const grab = () => page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
  // The slab's pixels: the frame with it hidden (every chunk's copy) against the frame with it.
  const shown = await rgba(await grab());
  if (!FRAME_MASK) await page.evaluate((ids) => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; tb.setHidden('swap-zfight', ids); }, target!.ids);
  await page.waitForTimeout(300);
  const hidden = FRAME_MASK ? shown : await rgba(await grab());
  await page.evaluate(() => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; tb.setHidden('swap-zfight', []); });
  const mask = new Uint8Array(shown.width * shown.height);
  for (let i = 0; i < mask.length; i++) { const p = i * 4; if (FRAME_MASK || Math.abs(shown.data[p] - hidden.data[p]) + Math.abs(shown.data[p + 1] - hidden.data[p + 1]) + Math.abs(shown.data[p + 2] - hidden.data[p + 2]) > 30) mask[i] = 1; }
  // Erode by one pixel: a sub-pixel pan moves the silhouette edge, which is not the façade.
  const inner = new Uint8Array(mask.length);
  for (let y = 1; y < shown.height - 1; y++) for (let x = 1; x < shown.width - 1; x++) { const i = y * shown.width + x; if (mask[i] && mask[i - 1] && mask[i + 1] && mask[i - shown.width] && mask[i + shown.width]) inner[i] = 1; }
  const maskPx = inner.reduce((s, v) => s + v, 0), maskShare = maskPx / (shown.width * shown.height);
  console.log('slab mask px', maskPx, 'share', maskShare.toFixed(4), 'frame', shown.width, shown.height);
  expect(maskPx, 'the slab is on screen').toBeGreaterThan(500);
  // s3-slab-user: the slab covers what it covers in the user's window (measured 2026-11-06 at DPR 2, see abSpots.ts).
  if (SPOT.minMaskShare) expect(maskShare, 'the slab fills its share of the user\'s frame').toBeGreaterThan(SPOT.minMaskShare);
  // Steps: the camera pans PAN_PX CSS px per step across the view (about the slab, at its distance); `fade` holds the
  // swap's dissolve at t = step / STEPS. Run once with the detail solid (the still floor), once through the swap.
  const run = async (swap: boolean, capture: () => Promise<string> = grab) => {
    await page.evaluate(([pose, key]) => {
      const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, g = vm._ownGround;
      vm.jumpToLngLat({ ...pose, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
      (window as any).__zf = { key };
    }, [pose, target?.near ?? null] as const);
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
      const shot = await rgba(await capture());
      under.push(await page.evaluate(() => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; return tb.fading.size; }));
      if (frames.length) areas.push(deltaArea(frames[frames.length - 1].data, shot.data, inner));
      // ZFIGHT_DUMP=1 (lane R2-A #228): the step after mid as a ΔE>20 map over the slab (white), the slab mask (grey).
      if (process.env.ZFIGHT_DUMP && frames.length && step === Math.round(STEPS / 2) + 1) {
        const prev = frames[frames.length - 1].data, map = Buffer.alloc(shot.width * shot.height * 3);
        for (let i = 0; i < inner.length; i++) {
          if (!inner[i]) continue;
          const p = i * 4, A = lab(prev[p], prev[p + 1], prev[p + 2]), B = lab(shot.data[p], shot.data[p + 1], shot.data[p + 2]);
          map.fill(Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) > 20 ? 255 : 60, i * 3, i * 3 + 3);
        }
        mkdirSync(OUT, { recursive: true });
        await sharp(map, { raw: { width: shot.width, height: shot.height, channels: 3 } }).png().toFile(`${OUT}/${info.project.name}${LABEL}-${swap ? 'swap' : 'still'}-delta.png`);
        await sharp(shot.data, { raw: { width: shot.width, height: shot.height, channels: 4 } }).png().toFile(`${OUT}/${info.project.name}${LABEL}-${swap ? 'swap' : 'still'}-mid1.png`);
      }
      frames.push({ data: shot.data });
      if (step === Math.round(STEPS / 2)) {
        mkdirSync(OUT, { recursive: true });
        await sharp(shot.data, { raw: { width: shot.width, height: shot.height, channels: 4 } }).png().toFile(`${OUT}/${info.project.name}${LABEL}-${swap ? 'swap' : 'still'}-mid.png`);
      }
    }
    if (swap) await settle(page);
    return { areas, fadingSteps: under.filter(n => n > 0).length, frames };
  };
  const still = await run(false);
  let alias: { refTotal: number; aliasPx: number; aliasSteps: number[]; refAreas: number[] } | null = null;
  let aliasCount: Uint8Array | null = null;
  if (SS > 1) {
    const base = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.host.getPixelRatio());
    await page.evaluate((r) => (window as any).canalRecallGame.vectorMap.host.setPixelRatio(r), base * SS);
    await page.waitForTimeout(1500);
    // The facade tier follows the ratio (lane R1-B); hold it at the base ratio so the reference draws the same detail.
    await page.evaluate((r) => (window as any).canalRecallGame.vectorMap._threeBuildings.setCellTierPixelRatio(r), base);
    await page.waitForTimeout(300);
    const reduced = () => page.evaluate((k) => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => {
      if (!c) return '';
      // Box reduction in halves (each 2:1 bilinear step is an exact 2x2 box), down to the base size.
      let src: HTMLCanvasElement = c;
      for (let f = k; f > 1; f /= 2) {
        const d = document.createElement('canvas'); d.width = Math.round(src.width / 2); d.height = Math.round(src.height / 2);
        const ctx = d.getContext('2d')!; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low'; ctx.drawImage(src, 0, 0, d.width, d.height); src = d;
      }
      return src.toDataURL('image/png');
    }), SS);
    const ref = await run(false, reduced);
    await page.evaluate((r) => (window as any).canalRecallGame.vectorMap.host.setPixelRatio(r), base);
    await page.waitForTimeout(1500);
    const aliasSteps: number[] = [];
    aliasCount = new Uint8Array(inner.length);
    for (let k = 1; k < still.frames.length; k++) {
      let n = 0;
      const a0 = still.frames[k - 1].data, a1 = still.frames[k].data, r0 = ref.frames[k - 1].data, r1 = ref.frames[k].data;
      for (let i = 0; i < inner.length; i++) {
        if (!inner[i]) continue;
        const p = i * 4, A = lab(a0[p], a0[p + 1], a0[p + 2]), B = lab(a1[p], a1[p + 1], a1[p + 2]);
        if (Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) <= 20) continue;
        const C = lab(r0[p], r0[p + 1], r0[p + 2]), D = lab(r1[p], r1[p + 1], r1[p + 2]);
        if (Math.hypot(C[0] - D[0], C[1] - D[1], C[2] - D[2]) <= 20) { n++; aliasCount[i]++; }
      }
      aliasSteps.push(n);
    }
    alias = { refTotal: ref.areas.reduce((s, v) => s + v, 0), aliasPx: aliasSteps.reduce((s, v) => s + v, 0), aliasSteps, refAreas: ref.areas };
    console.log('swap-zfight alias', JSON.stringify({ ss: SS, stillBase: still.areas.reduce((s, v) => s + v, 0), stillRef: alias.refTotal, aliasPx: alias.aliasPx }));
    if (process.env.ZFIGHT_DUMP) {
      // The alias map (lane R3-A): red = a pixel that aliased in at least one step (brighter = more steps), over the mid frame.
      const mid = still.frames[Math.round(STEPS / 2)].data, map = Buffer.alloc(shown.width * shown.height * 3);
      for (let i = 0; i < inner.length; i++) {
        const p = i * 4, g = Math.round((mid[p] + mid[p + 1] + mid[p + 2]) / 6);
        if (aliasCount[i]) map.set([Math.min(255, 120 + aliasCount[i] * 20), 0, 0], i * 3); else map.set([g, g, g], i * 3);
      }
      mkdirSync(OUT, { recursive: true });
      await sharp(map, { raw: { width: shown.width, height: shown.height, channels: 3 } }).png().toFile(`${OUT}/${info.project.name}${LABEL}-alias-map.png`);
    }
  }
  let owners: Record<string, number> | null = null;
  // The shell's yield at mid-swap: the detail chunk held at t = 0.5 and taken off screen, the share of the slab's
  // pixels where the shell under it draws nothing (the background shows, as in the slab-hidden frame). With the
  // complementary dissolve that is the detail's own coverage (~0.5); with the old overlap 0 (the shell stays solid).
  const yieldShare = FRAME_MASK ? NaN : await (async () => {
    await page.evaluate(([pose, key]) => {
      const vm = (window as any).canalRecallGame.vectorMap, tb = vm._threeBuildings, g = vm._ownGround, e = tb.chunks.get(key);
      vm.jumpToLngLat({ ...pose, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
      (window as any).__zfSource = e.source;
      tb.dropChunk(key);
      tb.pending.push(key, () => tb.rebuild(key, e.source));
      tb.pump();
    }, [pose, target!.near] as const);
    await expect.poll(() => page.evaluate((key) => (window as any).canalRecallGame.vectorMap._threeBuildings.fading.has(key), target!.near), { timeout: 60_000, intervals: [16] }).toBe(true);
    // Pause the dissolve at 0.5 for the capture (the clock is re-set right before it, and the capture is one frame).
    await page.evaluate((key) => {
      const tb = (window as any).canalRecallGame.vectorMap._threeBuildings, f = tb.fading.get(key);
      const now = performance.now.bind(performance), t0 = now();
      f.start = t0 - 350; (window as any).__zfNow = now;
      performance.now = () => t0 + (now() - t0) * 0; // the fade clock stands still until restored
      for (const ff of tb.fading.values()) ff.start = t0 - 350;
      f.mesh.visible = false;
    }, target!.near);
    const shot = await rgba(await grab());
    await page.evaluate((key) => { const tb = (window as any).canalRecallGame.vectorMap._threeBuildings; performance.now = (window as any).__zfNow; tb.chunks.get(key).mesh.visible = true; }, target!.near);
    let open = 0;
    for (let i = 0; i < inner.length; i++) {
      if (!inner[i]) continue;
      const p = i * 4;
      if (Math.abs(shot.data[p] - hidden.data[p]) + Math.abs(shot.data[p + 1] - hidden.data[p + 1]) + Math.abs(shot.data[p + 2] - hidden.data[p + 2]) <= 30) open++;
    }
    mkdirSync(OUT, { recursive: true });
    await sharp(shot.data, { raw: { width: shot.width, height: shot.height, channels: 4 } }).png().toFile(`${OUT}/${info.project.name}${LABEL}-shell-at-half.png`);
    await settle(page);
    return open / maskPx;
  })();
  console.log('shell yield at mid-swap', yieldShare.toFixed(3));
  const swap = FRAME_MASK || process.env.ZFIGHT_ALIAS_ONLY ? { areas: still.areas.map(() => 0), fadingSteps: STEPS + 1, frames: [] } : await run(true);
  if (process.env.ZFIGHT_OWNER && aliasCount) {
    // The owner view: the same pose with every chunk painted by its owner class, then each alias pixel's class.
    const url = new URL(page.url());
    url.searchParams.set('thinDebug', 'owner');
    await page.goto(url.toString());
    await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
    await page.evaluate(() => { const g = (window as any).canalRecallGame; g.state = 4; g._quizFreezesRide = () => false; g.player.handleInput = () => {}; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
    await expect.poll(() => page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; return vm.engine === 'own' && !!vm._threeBuildings?.ready; }), { timeout: 180_000 }).toBe(true);
    await settle(page);
    await page.evaluate((pose) => {
      const vm = (window as any).canalRecallGame.vectorMap;
      vm.sync = () => {}; vm.aimAtWorld = () => {};
      for (const top of vm._sharedFrame?.scene?.children ?? []) if (/(^|\/)player-/.test(`${top.userData?.participant ?? ''} ${top.name ?? ''}`)) top.traverse((o: any) => o.layers?.disableAll?.());
      const g = vm._ownGround;
      vm.jumpToLngLat({ ...pose, elevation: g?.ready ? g.heightAt(pose.center) : 0 });
    }, pose);
    await settle(page);
    const ownerShot = await rgba(await grab());
    mkdirSync(OUT, { recursive: true });
    await sharp(ownerShot.data, { raw: { width: ownerShot.width, height: ownerShot.height, channels: 4 } }).png().toFile(`${OUT}/${info.project.name}${LABEL}-owner.png`);
    const classes = await page.evaluate(() => (window as any).CanalRecallThreeBuildings?.THIN_OWNER_CLASSES ?? null);
    expect(classes, 'the three-buildings bundle exports THIN_OWNER_CLASSES (lane R3-A)').toBeTruthy();
    owners = {};
    for (let i = 0; i < aliasCount.length; i++) {
      if (!aliasCount[i] || !inner[i]) continue;
      const p = i * 4, r = ownerShot.data[p], g = ownerShot.data[p + 1], b = ownerShot.data[p + 2];
      let best = 'other', d = 90;
      for (const c of classes) { const e = Math.abs(c.rgb[0] - r) + Math.abs(c.rgb[1] - g) + Math.abs(c.rgb[2] - b); if (e < d) { d = e; best = c.name; } }
      owners[best] = (owners[best] ?? 0) + aliasCount[i];
    }
    console.log('swap-zfight owners', JSON.stringify(owners));
  }
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const report = { when: new Date().toISOString(), spot: SPOT.name, qs: QS, pose, target, maskPx, maskShare, frame: [shown.width, shown.height], steps: STEPS, panPx: PAN_PX, shellYieldAtHalf: yieldShare,
    still: { total: sum(still.areas), max: Math.max(...still.areas), areas: still.areas }, ...(alias ? { alias } : {}), ...(owners ? { owners } : {}),
    swap: { total: sum(swap.areas), max: Math.max(...swap.areas), areas: swap.areas, fadingSteps: swap.fadingSteps },
    // What the swap adds over the still pan, per step: the stripes.
    excess: swap.areas.map((v, i) => Math.max(0, v - still.areas[i])), errors };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${info.project.name}${LABEL}.json`, JSON.stringify(report, null, 1));
  console.log('swap-zfight', JSON.stringify({ spot: SPOT.name, qs: QS, maskPx, shellYield: +yieldShare.toFixed(3), still: report.still.total, aliasPx: alias?.aliasPx ?? null, swap: report.swap.total, excess: sum(report.excess), excessMax: Math.max(...report.excess), fadingSteps: swap.fadingSteps }));
  expect(errors, 'page errors').toEqual([]);
  if (!process.env.ZFIGHT_REPORT_ONLY) expect(swap.fadingSteps, 'the swap was dissolving through the steps').toBeGreaterThan(STEPS * 0.8);
  // Complementary (the default): the shell yields the detail's share of the slab at mid-swap (0.5 ± 0.1).
  if (!process.env.ZFIGHT_REPORT_ONLY && !FRAME_MASK && !process.env.ZFIGHT_ALIAS_ONLY && !/swapComplement=0|chunkFade=0/.test(QS)) expect(Math.abs(yieldShare - 0.5), `shell yield ${yieldShare.toFixed(3)} at t = 0.5`).toBeLessThan(0.1);
  if (!process.env.ZFIGHT_REPORT_ONLY) expect(sum(report.excess), 'ΔE>20 px on the slab beyond the still pan, during the swap').toBe(0);
});
