import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';

// Sculptures in the shared frame (`?sculptures=1`, docs/sculptures.md).
// Named location: De Dokwerker, Jonas Daniël Meijerplein (OSM node 34051159,
// landmark extract_landmarks_1098130181, hand model `de-dokwerker`).
//   SCULPTURES=1 PW_PORT=4459 npx playwright test sculptures --project=desktop
// Needs the GPU and the network basemap; shots and numbers go to artifacts/sculptures/.
test.skip(!process.env.SCULPTURES, 'set SCULPTURES=1');

const OUT = 'artifacts/sculptures';
const ANCHOR: [number, number] = [4.9050146, 52.3671957];
/** The figure faces WSW (manifest facingDeg). */
const FACING = 252;
const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch', 'panTo', 'setFreeCameraOptions'];

async function boot(page: Page, sculptures: boolean): Promise<{ errors: string[]; sculptureRequests: string[] }> {
  const errors: string[] = [], sculptureRequests: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (/\/canal-drive\/sculptures\//.test(r.url())) sculptureRequests.push(r.url()); });
  await page.addInitScript((on: boolean) => { (window as any).__canalRecallSharedFrame = true; (window as any).__canalRecallSculptures = on; }, sculptures);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  // Freeze the game's camera; the test drives MapLibre directly.
  await page.evaluate((cam) => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
    for (const k of cam) if (map[k]) { map['__' + k] = map[k]; map[k] = () => map; }
    map.setMaxPitch(85); map.setMaxZoom(24);
    vm._signatureLandmarks?.setSuspended?.(false);
  }, CAM);
  return { errors, sculptureRequests };
}

/**
 * Put the eye `distM` from the statue at camera azimuth `azDeg` (0 = in front
 * of the figure, + toward its left hand), `eyeM` above the ground, looking at
 * the statue's middle.
 */
async function view(page: Page, azDeg: number, distM: number, eyeM: number): Promise<void> {
  await page.evaluate(({ anchor, facing, azDeg, distM, eyeM }) => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    // Compass bearing from the statue to the eye: facing turned by −az (az + is toward the figure's left = counter-clockwise).
    const toEye = (facing - azDeg) * Math.PI / 180;
    // Aim at the figure's middle (~2.6 m up); MapLibre pitches at most 85°, so
    // at eye height the centre ray meets the ground a little beyond the statue.
    const lookAtH = 2.6;
    const p = Math.min(84, Math.max(30, 90 + Math.atan2(lookAtH - eyeM, distM) * 180 / Math.PI));
    // Centre: the ground point the camera ray through the screen centre hits.
    const groundDist = eyeM * Math.tan(p * Math.PI / 180);
    const mPerDegLat = 111320, mPerDegLng = 111320 * Math.cos(anchor[1] * Math.PI / 180);
    const eyeE = Math.sin(toEye) * distM, eyeN = Math.cos(toEye) * distM;
    const look = toEye + Math.PI; // bearing from eye to statue
    const cE = eyeE + Math.sin(look) * groundDist, cN = eyeN + Math.cos(look) * groundDist;
    const center = [anchor[0] + cE / mPerDegLng, anchor[1] + cN / mPerDegLat];
    const bearing = ((look * 180 / Math.PI) % 360 + 360) % 360;
    // Zoom so the camera sits `hyp` metres from the centre point.
    const hyp = Math.hypot(groundDist, eyeM);
    let zoom = 20;
    for (let i = 0; i < 6; i++) {
      map.__jumpTo.call(map, { center, zoom, pitch: p, bearing });
      const t = map.transform, cur = t.cameraToCenterDistance / t.pixelsPerMeter;
      zoom += Math.log2(cur / hyp);
    }
    map.__jumpTo.call(map, { center, zoom, pitch: p, bearing });
  }, { anchor: ANCHOR, facing: FACING, azDeg, distM, eyeM });
}

async function waitHandModel(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
    return !!l?._entries?.some((e: any) => e.spec.id === 'de-dokwerker') && !l._pending?.size;
  }), { timeout: 120_000, intervals: [1000] }).toBe(true);
}

/** Two frames apart, so a just-made change has been drawn. */
async function frames(page: Page, n = 3): Promise<void> {
  await page.evaluate((count) => new Promise<void>(resolve => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    let left = count;
    const tick = () => { map.triggerRepaint(); if (--left <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), n);
}

async function measure(page: Page, ms = 5000): Promise<{ frameMedian: number; frameP95: number; mainPassMedian: number; mainPassP95: number; sculptureUpdateMedian: number; n: number }> {
  return page.evaluate((dur) => new Promise<any>(resolve => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map, f = vm._sharedFrame;
    const frame: number[] = [], main: number[] = [], upd: number[] = [];
    let last = performance.now(), mainFrames = f.stats.main.frames;
    const end = last + dur;
    const tick = (now: number) => {
      frame.push(now - last); last = now;
      if (f.stats.main.frames !== mainFrames) { mainFrames = f.stats.main.frames; main.push(f.stats.main.ms); if (vm._sculptures) upd.push(vm._sculptures.stats.updateMs); }
      map.triggerRepaint();
      if (now < end) requestAnimationFrame(tick);
      else {
        const q = (a: number[], p: number) => { const s = a.slice(5).sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) : 0; };
        resolve({ frameMedian: q(frame, 0.5), frameP95: q(frame, 0.95), mainPassMedian: q(main, 0.5), mainPassP95: q(main, 0.95), sculptureUpdateMedian: q(upd, 0.5), n: frame.length });
      }
    };
    requestAnimationFrame(tick);
  }), ms);
}

/** Differing pixels between two PNG screenshots, and their bounding box. */
async function pixelDiff(a: Buffer, b: Buffer): Promise<{ count: number; box: number[] | null }> {
  const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer({ resolveWithObject: true }), sharp(b).raw().toBuffer({ resolveWithObject: true })]);
  const { width, channels } = ra.info;
  let count = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0; i < ra.data.length; i += channels) {
    if (ra.data[i] === rb.data[i] && ra.data[i + 1] === rb.data[i + 1] && ra.data[i + 2] === rb.data[i + 2]) continue;
    count++;
    const p = i / channels, x = p % width, y = Math.floor(p / width);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { count, box: count ? [x0, y0, x1, y1] : null };
}

async function gallery(path: string, out: string): Promise<void> {
  await sharp(path).resize({ width: 360 }).toFile(out);
}

test('flag off: no sculpture code, and a mounted-but-disabled layer leaves the square pixel-identical', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const { errors, sculptureRequests } = await boot(page, false);
  await view(page, 0, 14, 1.7);
  await waitHandModel(page);
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => typeof (window as any).CanalRecallSculptures)).toBe('undefined');
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap._sharedFrame.registry.has('sculptures'))).toBe(false);
  expect(sculptureRequests).toEqual([]);
  await frames(page);
  await page.screenshot({ path: `${OUT}/${info.project.name}-flag-off.png` });
  // Compare the map canvas only: HUD cards come and go on their own timers.
  await page.addStyleTag({ content: '* { visibility: hidden !important; } .maplibregl-canvas { visibility: visible !important; }' });
  await frames(page);
  const a = await page.screenshot();
  await frames(page);
  const a2 = await page.screenshot();
  const stable = a.equals(a2);
  // Mount the layer far away, disable it, come back: the frame must be byte-identical.
  await view(page, 0, 400, 30);
  await page.evaluate(async () => {
    const vm = (window as any).canalRecallGame.vectorMap;
    vm._sculpturesEnabled = true;
    await vm._ensureSculptures();
    vm._sculptures.enabled = false;
  });
  await view(page, 0, 14, 1.7);
  await page.waitForTimeout(1500);
  await frames(page);
  const b = await page.screenshot({ path: `${OUT}/${info.project.name}-mounted-disabled.png` });
  const noise = await pixelDiff(a, a2), disabled = await pixelDiff(a, b);
  writeFileSync(`${OUT}/${info.project.name}-flag-off.json`, JSON.stringify({ stableBetweenFrames: stable, identicalWhenDisabled: a.equals(b), noise, disabled, errors }, null, 1));
  expect(stable, 'the frozen square is not deterministic between frames; the comparison would mean nothing').toBe(true);
  expect(disabled.count, 'disabled sculptures change pixels').toBe(0);
  expect(errors).toEqual([]);
});

test('flag on: De Dokwerker drawn as the photo impostor near, hand model far; shots and desktop numbers', async ({ page }, info) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  const { errors } = await boot(page, true);
  await view(page, 0, 14, 1.7);
  await waitHandModel(page);
  await expect.poll(() => page.evaluate(() => {
    const s = (window as any).canalRecallGame.vectorMap._sculptures;
    return !!s?.entries?.[0]?.near && s.entries[0].root.visible;
  }), { timeout: 60_000, intervals: [500] }).toBe(true);
  const handHidden = await page.evaluate(() => {
    const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
    return l._entries.find((e: any) => e.spec.id === 'de-dokwerker').holder.visible === false;
  });
  expect(handHidden).toBe(true);
  const report: Record<string, unknown> = { project: info.project.name };
  // The look at eye height (1.7 m) around the statue, plus gallery-size copies.
  for (const az of [0, 45, 90, 135, 180, -135, -90, -45]) {
    await view(page, az, 14, 1.7);
    await page.waitForTimeout(600);
    await frames(page);
    const p = `${OUT}/${info.project.name}-eye-az${az}.png`;
    await page.screenshot({ path: p });
    await gallery(p, `${OUT}/${info.project.name}-gallery-az${az}.png`);
    report[`azimuth${az}`] = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._sculptures.entries[0].azimuthDeg);
  }
  // Picking: the statue at the screen centre answers with its landmark id (via the hidden hand model).
  await view(page, 0, 14, 1.7);
  await frames(page);
  const vp = page.viewportSize()!;
  report.pick = await page.evaluate(({ w, h }) => {
    const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
    let hit = null;
    for (let y = 0.25; y <= 0.6 && !hit; y += 0.05) hit = l.inspectAtScreen(w / 2, h * y, w, h);
    return hit && { landmarkId: hit.landmarkId, name: hit.name };
  }, { w: vp.width, h: vp.height });
  expect((report.pick as any)?.landmarkId).toBe('extract_landmarks_1098130181');
  // Perf at the statue, desktop: impostor near vs the hand model (layer disabled), same camera.
  await view(page, 30, 14, 1.7);
  await page.waitForTimeout(1000);
  report.perfImpostor = await measure(page);
  await page.evaluate(() => { (window as any).canalRecallGame.vectorMap._sculptures.enabled = false; });
  await frames(page);
  report.perfHandModel = await measure(page);
  await page.evaluate(() => { (window as any).canalRecallGame.vectorMap._sculptures.enabled = true; });
  // Far: past 55 m the hand model is back and the impostor is not drawn.
  await view(page, 0, 80, 1.7);
  await frames(page, 5);
  report.far = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, s = vm._sculptures;
    const hand = vm._signatureLandmarks._entries.find((e: any) => e.spec.id === 'de-dokwerker');
    return { impostorVisible: s.entries[0].root.visible, handVisible: hand.holder.visible, level: s.entries[0].lod.level };
  });
  expect((report.far as any).impostorVisible).toBe(false);
  await page.screenshot({ path: `${OUT}/${info.project.name}-far-80m.png` });
  // Gallery card view: a higher, wider look (the landmark gallery's angle).
  await view(page, 20, 18, 9);
  await frames(page);
  await page.screenshot({ path: `${OUT}/${info.project.name}-card.png` });
  await gallery(`${OUT}/${info.project.name}-card.png`, `${OUT}/${info.project.name}-card-gallery.png`);
  report.errors = errors;
  writeFileSync(`${OUT}/${info.project.name}-report.json`, JSON.stringify(report, null, 1));
  expect(errors).toEqual([]);
});
