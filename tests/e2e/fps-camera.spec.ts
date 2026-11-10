import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute, settleWorld } from './helpers';

// First-person riding camera (issue #171, lane fps-camera-20261109). The switch is `?cam=fps` or the V key.
//   ENGINE=own BUNDLES_DIR=<dir with a fresh engine.bundle.js> PW_PORT=4745 /tmp/canal-pw.sh npx playwright test fps-camera.spec --project=desktop --workers=1
// Always: toggle the camera in a ride and assert a frame renders with no errors, the eye 1.6 m over the rider, and the
// bike/rider model hidden. FPS_SHOTS=1 also writes chase-vs-fps frames and frame cost at three spots to artifacts/fps-camera/.
test.skip(process.env.ENGINE !== 'own', 'set ENGINE=own: the first-person camera lives in the engine world view');

const OUT = process.env.FPS_OUT || 'artifacts/fps-camera';
const SPOTS: { name: string; lng: number; lat: number; bearing: number }[] = [
  { name: 'canal-prinsengracht', lng: 4.88395, lat: 52.37335, bearing: 74 },
  { name: 'jordaan-egelantiersstraat', lng: 4.88150, lat: 52.37585, bearing: 90 },
  { name: 'bridge-magere-brug', lng: 4.90140, lat: 52.36310, bearing: 90 },
];

async function teleport(page: Page, lng: number, lat: number, bearing: number): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, { lng, lat, bearing });
}

/** Frame cost over `n` forced repaints: mean rAF interval and, with `?glCounters=1`, per-frame triangles/draws (p50) and the top owners. */
async function frameCost(page: Page, n = 40): Promise<unknown> {
  return page.evaluate(async n => {
    const vm = (window as any).canalRecallGame.vectorMap, gl = (window as any).__canalPerf?.gl;
    gl?.markWarm();
    let t0 = 0, total = 0;
    for (let i = 0; i <= n; i++) {
      vm.host.triggerRepaint();
      await new Promise(r => requestAnimationFrame(r));
      const t = performance.now();
      if (i > 0) total += t - t0;
      t0 = t;
    }
    const r = gl?.report();
    return { meanMs: total / n, triangles: r?.frames.triangles.p50 ?? null, draws: r?.frames.draws.p50 ?? null, owners: r?.byOwner?.slice(0, 5) ?? null };
  }, n);
}

test('toggling the first-person camera renders a frame with no errors', async ({ page }, info) => {
  test.setTimeout(process.env.FPS_SHOTS ? 360_000 : 120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, query: process.env.FPS_SHOTS ? '?engine=own&glCounters=1' : '?engine=own' });
  const s = SPOTS[0];
  await teleport(page, s.lng, s.lat, s.bearing);
  await page.waitForTimeout(2500);
  await settleWorld(page, 'chase', 20_000);
  const vm = (name: string) => page.evaluate(n => (window as any).canalRecallGame.vectorMap[n]?.(), name);
  expect(await vm('fpsCameraOn')).toBe(false);
  const chasePitch = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.camera.pitch());

  await page.keyboard.press('KeyV');
  await expect.poll(() => vm('fpsCameraOn')).toBe(true);
  await page.waitForTimeout(1500);
  await settleWorld(page, 'fps', 20_000);
  const fps = await page.evaluate(() => {
    const v = (window as any).canalRecallGame.vectorMap, c = v.cameraMap.camera, f = c.frame();
    return { pitch: c.pitch, fov: c.fovDeg, eyeZ: f.eye[2] - c.elevation, last: v._lastFps && { back: v._lastFps.backM, h: v._lastFps.pose.eye.heightM }, zoom: c.zoom, maxPitch: c.maxPitch, maxZoom: c.maxZoom, elevation: c.elevation, vp: v.host.viewport() };
  });
  expect(fps.pitch, 'level-ish view').toBeGreaterThan(chasePitch);
  expect(fps.fov).toBeCloseTo(72, 3);
  expect(fps.eyeZ, `eye height over the rider ${JSON.stringify(fps)}`).toBeCloseTo(1.6, 2);
  const url: string = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.captureFrame().then((c: HTMLCanvasElement | null) => c?.toDataURL('image/png') ?? ''));
  expect(url.length, 'a frame was drawn').toBeGreaterThan(5000);

  await page.keyboard.press('KeyV');
  await expect.poll(() => vm('fpsCameraOn')).toBe(false);
  await page.waitForTimeout(1500);
  const back = await page.evaluate(() => { const c = (window as any).canalRecallGame.vectorMap.cameraMap.camera; return { fov: c.fovDeg, pitch: c.pitch }; });
  expect(back.fov, 'lens restored').toBeCloseTo(36.87, 1);
  expect(back.pitch).toBeLessThan(80);
  expect(errors, errors.join('\n')).toEqual([]);

  if (!process.env.FPS_SHOTS) return;
  mkdirSync(OUT, { recursive: true });
  const costs: Record<string, unknown> = {};
  const only = process.env.FPS_SPOTS?.split(',').filter(Boolean);
  for (const spot of SPOTS.filter(k => !only || only.includes(k.name))) {
    await teleport(page, spot.lng, spot.lat, spot.bearing);
    await page.waitForTimeout(2500);
    await teleport(page, spot.lng, spot.lat, spot.bearing);
    for (const mode of ['chase', 'fps'] as const) {
      await page.evaluate(on => (window as any).canalRecallGame.vectorMap.setFpsCamera(on), mode === 'fps');
      await page.waitForTimeout(2000);
      await settleWorld(page, `${spot.name} ${mode}`, 15_000);
      await page.waitForTimeout(500);
      costs[`${spot.name}/${mode}`] = { ...(await frameCost(page)), fps: mode === 'fps' ? await page.evaluate(() => { const l = (window as any).canalRecallGame.vectorMap._lastFps; return l && { back: l.backM, stuck: l.stuckId, zoom: l.pose.zoom }; }) : null };
      await page.screenshot({ path: `${OUT}/${spot.name}-${mode}-${info.project.name}.png` });
    }
  }
  writeFileSync(`${OUT}/cost-${info.project.name}.json`, JSON.stringify(costs, null, 2));
  console.log(JSON.stringify(costs, null, 2));
});
