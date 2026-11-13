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
 * Batched runs (`house:frames -- --lists a.json:outA,b.json:outB`): one job holds every list's poses, each pose naming its
 * own `out`; the page is re-opened where the batch moves to another list, and the frames and a browser-timings.json per
 * out dir are written as a separate run would write them (the
 * timings file's `batch` field gives the whole session's wall time).
 *
 * The camera is set from outside: the spec replaces the view's `solveFps` on the live instance (the first-person solve,
 * engine/fpsCamera.ts) with one that returns the job's pose. Nothing in src/ changes and no global is added to the game.
 */
import { test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openRoute, settleWorld } from './helpers';

type JobPose = {
  key: string;
  /** the target pand (bare BAG id): its styled feature's wall inputs go into game.json `drawn` */
  pandId?: string;
  /** this pose's out dir (a batch job); else the job's */
  out?: string;
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
  // BUNDLES_DIR=<dir> serves *.bundle.js from a scratch build (lane W1, as scripts/perf-frozen-frames.mjs): a before/after
  // of a source change without touching the committed bundles. On the context, so the building worker's script is routed too.
  const bundles = process.env.BUNDLES_DIR ? resolve(process.env.BUNDLES_DIR) : '';
  if (bundles) await page.context().route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  // HOUSE_FRAMES_SPECS_DIR=<dir> (lane D1 pixel-check): the house-specs extract tiles are served from a staged extract
  // (build-house-specs' public/data/extracts/amsterdam/staging/house-specs) instead of the published one, so a
  // `?world=live` frame draws staged specs without a publish (the live tile streamer decorates in the page). Only for
  // the lists whose out dir contains HOUSE_FRAMES_SPECS_FOR (default: every list), so one --lists batch takes today and
  // the staged spec side by side. A tile missing from the staged dir falls through to the published one.
  const specsDir = process.env.HOUSE_FRAMES_SPECS_DIR ? resolve(process.env.HOUSE_FRAMES_SPECS_DIR) : '';
  const specsFor = process.env.HOUSE_FRAMES_SPECS_FOR ?? '';
  let specsOn = false, specsServed = 0;
  if (specsDir) await page.context().route(/\/data\/extracts\/amsterdam\/house-specs\/14\/\d+\/\d+\.json\.gz(\?.*)?$/, route => {
    const file = join(specsDir, /\/house-specs\/(14\/\d+\/\d+\.json\.gz)/.exec(route.request().url())![1]);
    if (!specsOn || !existsSync(file)) return route.continue();
    specsServed++;
    return route.fulfill({ path: file, contentType: 'application/octet-stream' });
  });
  let opened = 0, sinceOpen = Infinity, lastOut = '';
  const timings: Array<Record<string, number | string>> = [];
  const t0 = Date.now();
  for (const pose of job.poses) {
    const dir = join(pose.out ?? job.out, pose.key);
    // A batch re-opens the page where it moves to another list, so each list's frames start from a fresh page as in a
    // separate run (measured: carried-over page state moved water shadows and a POI label on 3-8 % of the pixels).
    if (lastOut && (pose.out ?? job.out) !== lastOut) sinceOpen = Infinity;
    lastOut = pose.out ?? job.out;
    mkdirSync(dir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ts = Date.now();
        specsOn = !!specsDir && (!specsFor || (pose.out ?? job.out).includes(specsFor));
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
              return { id: String(p.id ?? h.id ?? h.landmarkId ?? h.modelId ?? ''), kind: String(h.kind ?? h.source ?? p.source ?? ''), model: String(h.landmarkId ?? h.model ?? h.modelId ?? p.model ?? ''), depth: Number(h.depth), keys: Object.keys(h).slice(0, 12).join(',') };
            }),
          };
        }, pose.picks);
        // What the page decorated the target pand with (the wall inputs the mesher reads) and the query it ran with, so a
        // before/after whose flag never reached the decorator is visible in game.json, not only in the pixels.
        const drawn = await page.evaluate((pandId) => {
          const vm = (window as any).canalRecallGame.vectorMap, city = vm._completeCity;
          const out: Record<string, unknown> = { search: location.search, worldCells: !!city?.usingWorldCells };
          if (!pandId || !city?.featuresById) return out;
          const f = city.featuresById([`NL.IMBAG.Pand.${pandId}`, pandId])[0];
          if (!f) return { ...out, found: false };
          const p = f.properties ?? {};
          return { ...out, found: true, constructionYear: p.constructionYear ?? null, facadeStyle: p.facadeStyle ?? null, registerFinish: p.registerFinish ?? null,
            specReading: p.houseSpec?.wallHex ?? null, specRecipeWall: p.specRecipe?.wallHex ?? null, specRecipe: p.specRecipe ?? null, specShop: p.specShop ?? null, heldBrick: !!p.specRecipe?.heldBrick,
            facadeMappedColour: p.facadeMappedColour ?? null, sideColour: p.sideColour ?? null, sideColourSource: p.sideColourSource ?? null, periodWallHex: p.periodWallHex ?? null };
        }, pose.pandId ?? null).catch(e => ({ error: String(e).slice(0, 200) }));
        writeFileSync(join(dir, 'game.json'), JSON.stringify({ key: pose.key, settle, picks, drawn, ...(specsDir ? { stagedSpecs: { on: specsOn, served: specsServed } } : {}), opened, ms: { open: tOpen - ts, settle: tSettled - tOpen, total: Date.now() - ts } }, null, 1));
        timings.push({ key: pose.key, out: pose.out ?? job.out, open: tOpen - ts, settle: tSettled - tOpen, total: Date.now() - ts });
        sinceOpen++;
        break;
      } catch (e) {
        console.warn(`house-frames: ${pose.key} attempt ${attempt + 1} failed: ${(e as Error).message.slice(0, 300)}`);
        sinceOpen = Infinity;
        if (page.isClosed()) throw e;
      }
    }
  }
  const wallMs = Date.now() - t0, outs = [...new Set(job.poses.map(p => p.out ?? job.out))];
  if (outs.length === 1) writeFileSync(join(outs[0], 'browser-timings.json'), JSON.stringify({ poses: job.poses.length, wallMs, opened, timings }, null, 1));
  else for (const out of outs) {
    // A batch: each out dir gets its own poses' timings; wallMs is their share (the sum of their per-pose totals).
    const mine = timings.filter(t => t.out === out);
    writeFileSync(join(out, 'browser-timings.json'), JSON.stringify({ poses: job.poses.filter(p => (p.out ?? job.out) === out).length, wallMs: mine.reduce((a, t) => a + Number(t.total), 0), opened, timings: mine, batch: { poses: job.poses.length, lists: outs.length, wallMs } }, null, 1));
  }
});
