/**
 * house:frames browser driver (lane H10, #358). Not part of check:canal: `npm run house:frames` writes a job file and
 * runs this spec through /tmp/canal-pw.sh; it is not meant to be run alone.
 *
 * One page for the whole job: open the route once, then for each pose teleport the rider to the panorama's position,
 * hand the engine's first-person camera the pose (heading, look-down, vertical FOV, eye height), let the world settle
 * (helpers.ts settleWorld, never a fixed wait), hide the HUD, screenshot the frame and pick the surfaces under the
 * projected wall (ownWorldView.inspectBuilding, the click card's own pick). The page is re-opened after
 * `reopenEvery` poses or when it crashes.
 *
 * The camera is set from outside: the spec replaces the view's `solveFps` on the live instance (the first-person solve,
 * engine/fpsCamera.ts) with one that returns the job's pose. Nothing in src/ changes and no global is added to the game.
 */
import { test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute, settleWorld } from './helpers';

type JobPose = {
  key: string;
  lngLat: [number, number];
  headingDeg: number;
  /** engine/fpsCamera.ts FpsPose for the pose (center, zoom, bearing, pitch, fovDeg, distanceM, eye) */
  fps: Record<string, unknown>;
  /** image px to pick (ownWorldView.inspectBuilding) */
  picks: Array<[number, number]>;
};
type Job = { out: string; query: string; width: number; height: number; reopenEvery: number; settleMs: number; poses: JobPose[] };

const JOB = process.env.HOUSE_FRAMES_JOB;

async function openPage(page: Page, job: Job): Promise<void> {
  // The first-person camera is the own engine's (engine/fpsCamera.ts): `engine=own` unless the job's query names an engine.
  const q = job.query.replace(/^\?/, '');
  const engine = /(^|&)engine=/.test(q) ? '' : 'engine=own&';
  await openRoute(page, { travelMode: 'car', query: `?${engine}cam=fps${q ? `&${q}` : ''}`, abortHeavyTiles: true });
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    g.player.handleInput = () => {};
    if (typeof vm.setFpsCamera !== 'function') throw new Error(`no first-person camera on this world view (engine ${vm.engine}): house:frames needs the own engine`);
    if (!vm.fpsCameraOn()) vm.setFpsCamera(true);
    // The job's pose replaces the first-person solve (no eye clearance, no yaw smoothing): exactly the pose asked for.
    vm.solveFps = function solveFpsHouseFrames(this: any) {
      const p = (window as any).__houseFramesPose;
      this._lastFps = { pose: p, backM: 0, stuckId: null, elevation: 0 };
      return p;
    };
  });
  // HUD off: the legacy canvas (route line, pins, readouts) and every DOM layer over the map.
  await page.addStyleTag({ content: `body > *:not(#vector-map) { visibility: hidden !important; } .maplibregl-control-container { display: none !important; }` });
}

async function setPose(page: Page, pose: JobPose): Promise<void> {
  await page.evaluate(({ lngLat, headingDeg, fps }) => {
    const w = window as any, g = w.canalRecallGame, l = g.osmLoader;
    const mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180), ppm = 3;
    g.player.x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * mLng * ppm;
    g.player.y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = (headingDeg - 90) * Math.PI / 180;
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    w.__houseFramesPose = fps;
    g.state = 4;
  }, pose);
}

test('house frames', async ({ page }) => {
  test.skip(!JOB, 'run through npm run house:frames');
  const job: Job = JSON.parse(readFileSync(JOB!, 'utf8'));
  test.setTimeout(240_000 + job.poses.length * 90_000);
  await page.setViewportSize({ width: job.width, height: job.height });
  let opened = 0, sinceOpen = Infinity;
  const timings: Array<Record<string, number | string>> = [];
  const t0 = Date.now();
  for (const pose of job.poses) {
    const dir = join(job.out, pose.key);
    mkdirSync(dir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ts = Date.now();
        if (sinceOpen >= job.reopenEvery) {
          if (opened) { await page.goto('about:blank'); }
          await openPage(page, job); opened++; sinceOpen = 0;
        }
        const tOpen = Date.now();
        await setPose(page, pose);
        // The game re-routes after a jump; pin the rider again once it has, then let the world land.
        await page.waitForTimeout(job.settleMs);
        await setPose(page, pose);
        const settle = await settleWorld(page, pose.key, 60_000);
        await setPose(page, pose);
        const tSettled = Date.now();
        const shot = await page.screenshot({ type: 'png' });
        writeFileSync(join(dir, 'game.png'), shot);
        const picks = await page.evaluate((pts) => {
          const vm = (window as any).canalRecallGame.vectorMap;
          const rect = document.querySelector('#gameCanvas')!.getBoundingClientRect();
          const fps = vm._lastFps?.pose ?? null, engine = vm.engine ?? null, fpsDrawn = !!vm.fpsDrawn;
          return {
            fps, engine, fpsDrawn, rect: { w: rect.width, h: rect.height },
            hits: pts.map(([x, y]: [number, number]) => {
              const h = vm.inspectBuilding(x, y, rect);
              if (!h) return null;
              const p = h.properties ?? h.feature?.properties ?? {};
              return { id: String(p.id ?? h.id ?? h.landmarkId ?? h.modelId ?? ''), kind: String(h.kind ?? h.source ?? p.source ?? ''), model: String(h.model ?? h.modelId ?? p.model ?? h.landmark?.id ?? ''), depth: Number(h.depth), keys: Object.keys(h).slice(0, 12).join(',') };
            }),
          };
        }, pose.picks);
        writeFileSync(join(dir, 'game.json'), JSON.stringify({ key: pose.key, settle, picks, opened, ms: { open: tOpen - ts, settle: tSettled - tOpen, total: Date.now() - ts } }, null, 1));
        timings.push({ key: pose.key, open: tOpen - ts, settle: tSettled - tOpen, total: Date.now() - ts });
        sinceOpen++;
        break;
      } catch (e) {
        console.warn(`house-frames: ${pose.key} attempt ${attempt + 1} failed: ${(e as Error).message.slice(0, 300)}`);
        sinceOpen = Infinity;
        if (page.isClosed()) throw e;
      }
    }
  }
  writeFileSync(join(job.out, 'browser-timings.json'), JSON.stringify({ poses: job.poses.length, wallMs: Date.now() - t0, opened, timings }, null, 1));
});
