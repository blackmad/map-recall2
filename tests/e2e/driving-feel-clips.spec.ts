/**
 * Driving-feel before/after clips (lane E, docs/handoffs/lane-driving-feel-20261029.md, Acceptance).
 * Opt-in, not a gate: a 30 s ride from Molenpad into its T-junction with the Keizersgracht, right onto the
 * ring and along it past the Leidsestraat and Vijzelstraat, recorded as a Playwright video with a metrics JSON.
 *
 *   DRIVE_CLIPS=1 DRIVE_CLIP_LABEL=after DRIVE_JS_DIR=artifacts/driving-feel/after-js \
 *     PW_PORT=4527 /tmp/canal-pw.sh npx playwright test driving-feel-clips --project=desktop
 *
 * DRIVE_JS_DIR serves any /canal-drive/js/<name>.js that exists there (the before set: the base commit's
 * car.js, camera.js, ...; the after set: locally built bundles). Desktop rides relative keyboard steering
 * (an autopilot presses the arrows, as a rider would); the iphone project rides the street-follow pad, the
 * phone default, with one queued right turn for the T-junction.
 */
import { test, expect } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute } from './helpers';

test.skip(!process.env.DRIVE_CLIPS, 'set DRIVE_CLIPS=1 to record the driving-feel clips');
test.use({ video: { mode: 'on', size: { width: 960, height: 600 } } });

const OUT = process.env.DRIVE_CLIPS_OUT || 'artifacts/driving-feel';
const LABEL = process.env.DRIVE_CLIP_LABEL || 'after';
// [lat, lng]: Molenpad north-east to the Keizersgracht (a T: Molenpad ends on the quay), right, then the ring.
const ROUTE: [number, number][] = [
  [52.366790, 4.882950], [52.367211, 4.884224], [52.367007, 4.884384], [52.366899, 4.884482],
  [52.366703, 4.884677], [52.366278, 4.88544], [52.365933, 4.886061], [52.365757, 4.886385],
  [52.365282, 4.88719], [52.364151, 4.889162], [52.364094, 4.889273], [52.364059, 4.889483],
  [52.363695, 4.892261], [52.36368, 4.892354], [52.363212, 4.895801],
];

test('driving-feel clip: Molenpad T-junction and the Keizersgracht ring', async ({ page }, info) => {
  test.setTimeout(240_000);
  const jsDir = process.env.DRIVE_JS_DIR;
  if (jsDir) {
    await page.route(/\/canal-drive\/js\/([\w.-]+\.js)(\?.*)?$/, route => {
      const file = join(jsDir, /\/canal-drive\/js\/([\w.-]+\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
  }
  const phone = info.project.name === 'iphone';
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', controlMode: phone ? 'street' : 'relative' });
  await page.waitForFunction(() => !(window as any).canalRecallGame._intro, null, { timeout: 60_000 }).catch(() => {});
  const place = () => page.evaluate((route) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const toWorld = ([lat, lng]: [number, number]) => ({
      x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm,
      y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm,
    });
    const pts = route.map(toWorld);
    g.player.x = pts[0].x; g.player.y = pts[0].y;
    g.player.angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0, _streetState: null, _headingTarget: null });
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.camera.resetForRide(g.player);
    (window as any).__clipRoute = pts;
  }, ROUTE);
  await place();
  await page.waitForTimeout(6000);
  await place();
  await page.waitForTimeout(4000);

  // The autopilot presses keys inside the game's own input poll, once per rendered frame.
  await page.evaluate((phoneRide) => {
    const g = (window as any).canalRecallGame;
    const pts = (window as any).__clipRoute as { x: number; y: number }[];
    const keys = g.input.keys;
    const log: any[] = [];
    (window as any).__clipLog = log;
    let next = 1, t0 = performance.now(), lastCam = g.camera.rotation, lastT = t0;
    const original = g.player.handleInput.bind(g.player);
    g.player.handleInput = (input: any) => {
      const p = g.player, now = performance.now(), t = (now - t0) / 1000;
      while (next < pts.length - 1 && Math.hypot(pts[next].x - p.x, pts[next].y - p.y) < 60) next++;
      const aim = pts[next];
      const wanted = Math.atan2(aim.y - p.y, aim.x - p.x);
      const err = Math.atan2(Math.sin(wanted - p.angle), Math.cos(wanted - p.angle));
      for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) keys[k] = false;
      const done = next >= pts.length - 1 && Math.hypot(aim.x - p.x, aim.y - p.y) < 40;
      if (phoneRide) {
        // Street follow: set off, queue the right turn on the approach to the T, then hands off.
        if (t < 0.4) keys.ArrowUp = true;
        const toT = Math.hypot(pts[1].x - p.x, pts[1].y - p.y);
        if (next <= 1 && toT < 200 && toT > 60) keys.ArrowRight = true;
      } else if (!done) {
        const target = Math.abs(err) > 0.5 ? 70 : 140;
        if (p.speed < target) keys.ArrowUp = true;
        else if (p.speed > target + 60) keys.ArrowDown = true;
        if (err > 0.06) keys.ArrowRight = true;
        if (err < -0.06) keys.ArrowLeft = true;
      }
      original(input);
      const dt = (now - lastT) / 1000;
      // The yaw rate over the dt the camera itself stepped with (the rAF delta), not this poll's wall clock.
      const camDt = g._cameraDt || dt;
      const camRate = camDt > 0 ? Math.abs(Math.atan2(Math.sin(g.camera.rotation - lastCam), Math.cos(g.camera.rotation - lastCam))) / camDt : 0;
      lastCam = g.camera.rotation; lastT = now;
      log.push({ t: +t.toFixed(3), x: +p.x.toFixed(1), y: +p.y.toFixed(1), angle: +p.angle.toFixed(4), speed: +p.speed.toFixed(1),
        camX: +g.camera.x.toFixed(1), camY: +g.camera.y.toFixed(1), camRot: +g.camera.rotation.toFixed(4), camRateDeg: +(camRate * 180 / Math.PI).toFixed(1),
        dtMs: +(camDt * 1000).toFixed(1), steer: p.steerInput, zoomScale: g.camera.speedZoomScale ?? 1 });
    };
  }, phone);
  await page.waitForTimeout(30_000);
  const log = await page.evaluate(() => (window as any).__clipLog as any[]);
  expect(log.length).toBeGreaterThan(100);
  // Summary: yaw-rate (steady frames only: dt within 25 ms, as a long frame inflates nothing real),
  // camera-centre offset from the bike in the bike's frame (how much the view trails or surges).
  const steady = log.filter(r => r.dtMs > 4 && r.dtMs < 25);
  const offsets = log.map(r => {
    const dx = r.camX - r.x, dy = r.camY - r.y, c = Math.cos(r.angle), s = Math.sin(r.angle);
    return { along: dx * c + dy * s, across: -dx * s + dy * c };
  });
  const sd = (v: number[]) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
  const frameDt = log.map(r => r.dtMs).sort((a, b) => a - b);
  const summary = {
    label: LABEL, project: info.project.name, frames: log.length,
    distanceM: +(Math.hypot(log.at(-1).x - log[0].x, log.at(-1).y - log[0].y) / 3).toFixed(0),
    frameDtMedianMs: frameDt[Math.floor(frameDt.length / 2)], frameDtP95Ms: frameDt[Math.floor(frameDt.length * 0.95)],
    camYawMaxDegPerS: Math.max(...steady.map(r => r.camRateDeg)),
    offsetAlongSdPx: +sd(offsets.map(o => o.along)).toFixed(1), offsetAcrossSdPx: +sd(offsets.map(o => o.across)).toFixed(1),
    offsetAlongMeanPx: +(offsets.reduce((a, o) => a + o.along, 0) / offsets.length).toFixed(1),
  };
  mkdirSync(OUT, { recursive: true });
  const base = join(OUT, `${LABEL}-${info.project.name}`);
  writeFileSync(`${base}.json`, JSON.stringify({ summary, log }, null, 1));
  console.log(JSON.stringify(summary));
  const video = page.video();
  await page.close();
  if (video) copyFileSync(await video.path(), `${base}.webm`);
});
