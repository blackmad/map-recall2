import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';
import { jump, lab, zoomWarp, VIEW_REGION, GROUND_REGION, type Frame, type JumpStats } from '../../src/canalRecall/overviewTransition/frameMetrics';

// The flat overview → shaded city transition (src/canalRecall/overviewTransition/). A plan-view zoom sweep over the
// Westerstraat through the blend window in 0.1-zoom steps; each frame is compared with the previous one magnified
// about the map centre, so camera motion cancels and what is left is the change the transition made. Before the
// blend (`?transition=0`) one step at zoom 15 moved ~70 % of the view by more than ΔE 20 (ΔL ≈ −80).
//   PW_PORT=4546 npx playwright test tests/e2e/overview-transition.spec.ts --project=desktop
// Bound (desktop): no step moves more than 5 % of the view's pixels by more than ΔE 20, and no step shifts the
// mean luma by more than 10 (the median is reported too; it flips between the modes of a two-tone view). The iphone project measures and reports without asserting (information only).
// TRANSITION_AB=1 also runs `?transition=0` and asserts that the old hard switch breaks the bound.

const PLACE = { lng: 4.88262, lat: 52.37713, bearing: 95 };
const FROM = 13.8, TO = 16.0, STEP = 0.1;
const MAX_OVER_DE = 0.05, MAX_DL = 10;

/** Open the game, hide the HUD and hold the rider at `place` in plan view at its play zoom, own ground settled. */
async function holdAt(page: Page, query: string, place: { lng: number; lat: number; bearing: number }) {
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query });
  await page.waitForFunction(() => (window as any).canalRecallGame.camera.introOverview === 0, null, { timeout: 120_000 });
  await page.addStyleTag({ content: 'body > *:not(#vector-map):not(#gameCanvas), body > *:not(#vector-map):not(#gameCanvas) * { visibility: hidden !important; }' });
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    const pose = {
      x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm,
      y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm,
      angle: Math.atan2(-Math.cos(b), Math.sin(b)),
    };
    const w = window as any;
    w.__tz = null;
    const hold = () => {
      Object.assign(g.player, pose, { speed: 0, vx: 0, vy: 0 });
      if (w.__tz) { g.camera.zoom = w.__tz.zoom; g.camera.introOverview = 1; }
      // The "Entering quarter" postcard is canvas-drawn (no CSS hides it) and fades out on a timer: when the teleport
      // into the Jordaan raised it, its fade landed in the sweep's first steps (7.5 % of the view at 13.8 → 13.9).
      g._neighborhoodNoticeTimer = 0;
      requestAnimationFrame(hold);
    };
    hold();
  }, place);
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const og = (window as any).canalRecallGame.vectorMap._ownGround;
    if (!og) return true;
    const s = og.status();
    return s.ready && !s.queued && !Object.keys(s.pending).length;
  }, null, { timeout: 120_000 }).catch(() => {});
  const playZoom = await page.evaluate(() => (window as any).canalRecallGame.camera.zoom as number);
  await page.evaluate(z => { (window as any).__tz = { zoom: z }; }, playZoom * 0.15);
  await page.waitForTimeout(500);
}

/** Move the held plan view to map zoom `t` and wait for its tiles. */
async function planZoom(page: Page, t: number, settleMs = 2500) {
  await page.evaluate(t => { const g = (window as any).canalRecallGame, m = g.vectorMap.map; (window as any).__tz = { zoom: g.camera.zoom * 2 ** (t - m.getZoom()) }; }, t);
  await page.waitForTimeout(settleMs);
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap.map.areTilesLoaded(), null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function sweep(page: Page, query: string, info0: TestInfo) {
  await holdAt(page, query, PLACE);
  // Start the sweep from a settled view at its first zoom (its tiles loaded), not from the jump to it.
  await planZoom(page, FROM);
  const frames: { z: number; frame: Frame; cx: number; cy: number }[] = [];
  for (let target = FROM; target <= TO + 1e-9; target += STEP) {
    await page.evaluate(t => {
      const g = (window as any).canalRecallGame, m = g.vectorMap.map;
      (window as any).__tz = { zoom: g.camera.zoom * 2 ** (t - m.getZoom()) };
    }, target);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(250);
    await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap.map.areTilesLoaded(), null, { timeout: 5000 }).catch(() => {});
    const st = await page.evaluate(() => { const m = (window as any).canalRecallGame.vectorMap.map, c = m.project(m.getCenter()); return { z: m.getZoom() as number, cx: c.x as number, cy: c.y as number, cssW: window.innerWidth }; });
    const shot = await page.screenshot();
    // TRANSITION_SHOTS=<dir>: keep the sweep's frames for inspection.
    if (process.env.TRANSITION_SHOTS) writeFileSync(`${process.env.TRANSITION_SHOTS}/${info0.project.name}${query ? '-ab' : ''}-${st.z.toFixed(1)}.png`, shot);
    const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // The screenshot is in device pixels (a phone's DPR 3); the map centre is in CSS pixels.
    const dpr = info.width / st.cssW;
    frames.push({ z: st.z, cx: st.cx * dpr, cy: st.cy * dpr, frame: { data, width: info.width, height: info.height, channels: 3 } });
  }
  const steps: { from: number; to: number; view: JumpStats; ground: JumpStats }[] = [];
  for (let i = 0; i + 1 < frames.length; i++) {
    const a = frames[i], b = frames[i + 1], warped = zoomWarp(a.frame, 2 ** (b.z - a.z), b.cx, b.cy);
    steps.push({ from: +a.z.toFixed(2), to: +b.z.toFixed(2), view: jump(warped, b.frame, VIEW_REGION), ground: jump(warped, b.frame, GROUND_REGION) });
  }
  const worstDE = steps.reduce((w, s) => (s.view.overDE > w.view.overDE ? s : w), steps[0]);
  const worstDL = steps.reduce((w, s) => (Math.abs(s.view.dMeanLuma) > Math.abs(w.view.dMeanLuma) ? s : w), steps[0]);
  const worstMedian = steps.reduce((w, s) => (Math.abs(s.view.dLuma) > Math.abs(w.view.dLuma) ? s : w), steps[0]);
  return { steps, worstDE, worstDL, worstMedian };
}

const summary = (r: Awaited<ReturnType<typeof sweep>>) =>
  `worst ΔE>20 share ${(100 * r.worstDE.view.overDE).toFixed(1)} % at ${r.worstDE.from}→${r.worstDE.to} (ground ${(100 * r.worstDE.ground.overDE).toFixed(1)} %), worst Δ mean luma ${r.worstDL.view.dMeanLuma.toFixed(1)} at ${r.worstDL.from}→${r.worstDL.to}, worst Δ median luma ${r.worstMedian.view.dLuma.toFixed(1)} at ${r.worstMedian.from}→${r.worstMedian.to}`;

test('overview → city: no step of the zoom sweep jumps', async ({ page }, info) => {
  test.setTimeout(300_000);
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1280, height: 800 });
  if (process.env.TRANSITION_SHOTS) mkdirSync(process.env.TRANSITION_SHOTS, { recursive: true });
  const r = await sweep(page, '', info);
  info.annotations.push({ type: 'transition', description: summary(r) });
  for (const st of r.steps) if (st.view.overDE > MAX_OVER_DE / 2) console.log(`  [${info.project.name}] ${st.from}→${st.to}: ΔE>20 ${(100 * st.view.overDE).toFixed(1)} %, Δ mean luma ${st.view.dMeanLuma.toFixed(1)}`);
  console.log(`[${info.project.name}] transition: ${summary(r)}`);
  if (info.project.name !== 'desktop') return; // phone: information only
  expect(r.worstDE.view.overDE, summary(r)).toBeLessThanOrEqual(MAX_OVER_DE);
  expect(Math.abs(r.worstDL.view.dMeanLuma), summary(r)).toBeLessThanOrEqual(MAX_DL);
});

test('A/B: the old hard switch (?transition=0) breaks the bound', async ({ page }, info) => {
  test.skip(!process.env.TRANSITION_AB, 'set TRANSITION_AB=1');
  test.setTimeout(300_000);
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1280, height: 800 });
  const r = await sweep(page, '?transition=0', info);
  console.log(`[${info.project.name}] transition=0: ${summary(r)}`);
  expect(r.worstDE.view.overDE).toBeGreaterThan(MAX_OVER_DE);
});

// Vondelpark lawn probe (2026-10-17): from z13 the game's park landscape (park-landscape.js, painted the park token by
// basemapPalette's `/^park/`) drew over the overview tiles, so the park stayed 96,140,70 while the tiles' lawn is
// 110,154,74 and the ride's ~117,158,81, then jumped as the own ground blended in. Below the blend (13.5, 14) nothing
// flat may sit over the tiles at the lawn, and the pixel there is the tiles' lawn.
const LAWN = { lng: 4.868106, lat: 52.357296 }, PARK_RIDER = { lng: 4.8689, lat: 52.3579, bearing: 0 };
const MAX_LAWN_DE = 8;

test('overview tiles: the Vondelpark lawn is the tiles\' lawn below the blend, nothing flat over it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop probe');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await holdAt(page, '', PARK_RIDER);
  const lawn = await page.evaluate(async () => {
    const vm = (window as any).canalRecallGame.vectorMap;
    const root = vm._extractPath || '/data/extracts/amsterdam';
    return (await (await fetch(`${root.replace(/\/$/, '')}/overview-tiles-v1/manifest.json`)).json()).colours.lawn as number[];
  });
  for (const z of [13.5, 14]) {
    await planZoom(page, z);
    const at = await page.evaluate(({ lng, lat }) => {
      const m = (window as any).canalRecallGame.vectorMap.map, p = m.project([lng, lat]);
      const order = m.getStyle().layers as { id: string; type: string }[];
      const tiles = order.findIndex(l => l.id === 'canal-overview-ground');
      const over = [...new Set((m.queryRenderedFeatures([p.x, p.y]) as { layer: { id: string; type: string } }[])
        .filter(f => (f.layer.type === 'fill' || f.layer.type === 'line') && order.findIndex(l => l.id === f.layer.id) > tiles).map(f => f.layer.id))];
      return { x: p.x, y: p.y, tiles, over, zoom: m.getZoom() as number, cssW: window.innerWidth };
    }, LAWN);
    expect(at.tiles, 'overview tiles layer present').toBeGreaterThanOrEqual(0);
    const { data, info: im } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const dpr = im.width / at.cssW, box: number[][] = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const i = ((Math.round(at.y * dpr) + dy) * im.width + Math.round(at.x * dpr) + dx) * 3;
      box.push([data[i], data[i + 1], data[i + 2]]);
    }
    const px = [0, 1, 2].map(c => box.map(b => b[c]).sort((a, b) => a - b)[box.length >> 1]);
    const a = lab(px[0], px[1], px[2]), b = lab(lawn[0], lawn[1], lawn[2]), dE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    console.log(`[desktop] Vondelpark lawn z${at.zoom.toFixed(2)}: rgb(${px.join(',')}) vs tiles' lawn rgb(${lawn.join(',')}) ΔE ${dE.toFixed(1)}; flat over tiles: ${at.over.join(',') || 'none'}`);
    expect(at.over, `flat layers over the tiles at z${z}`).toEqual([]);
    expect(dE, `lawn ΔE at z${z}`).toBeLessThanOrEqual(MAX_LAWN_DE);
  }
});
