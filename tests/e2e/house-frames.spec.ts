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
import { test, type Browser, type BrowserContext, type Page } from '@playwright/test';
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
  /** rule 10 (--likeness): first person 72 deg in a `width` x `height` css viewport, the top `windowH` rows kept */
  likeness?: { fps: Record<string, unknown>; width: number; height: number; windowH: number; lngLat: [number, number]; headingDeg: number };
};
/** rule 10 (scripts/house-frames/rule10Frames.ts Rule10Job): absent on an old run, which then runs exactly as before. */
type Rule10Job = { dpr: number; likenessQuery: string; asPlayedQuery?: string; asPlayed: Array<{ out: string; lngLat: [number, number]; headingDeg: number }> };
type Job = { out: string; query: string; width: number; height: number; reopenEvery: number; settleMs: number; poses: JobPose[]; rule10?: Rule10Job };

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

/**
 * `BUNDLES_DIR=<dir>`: every `*.bundle.js` the context asks for, the building worker's script included, from <dir> when
 * it is there (else the committed one; frames.ts warns when <dir> has three-buildings.bundle.js without its worker).
 * `served` collects the names fulfilled from <dir> (game.json `bundlesDir`), so a run that drew a committed worker
 * shows it.
 */
async function routeBundles(ctx: BrowserContext, bundles: string, served: Set<string>): Promise<void> {
  if (!bundles) return;
  await ctx.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  // Counted from the context's requests, not in the handler: helpers.ts useBundlesDir's page route (openRoute) answers
  // the page's and its workers' bundle requests first, from the same dir.
  ctx.on('request', r => {
    const name = /\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/.exec(r.url())?.[1];
    if (name && existsSync(join(bundles, name))) served.add(name);
  });
}

async function setPose(page: Page, pose: Pick<JobPose, 'lngLat' | 'headingDeg' | 'fps'>): Promise<void> {
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

/**
 * Rule 10 (lane TF): likeness frames (first person 72 deg at the job's pixel ratio, trees hidden when asked, the window
 * the top `windowH` rows of a taller viewport) and one as-played frame per list (the default engine and chase camera).
 * Each in its own browser context, so the pixel ratio is the device's, as on the user's Mac.
 */
async function rule10Frames(browser: Browser, job: Job, routeContext: (ctx: BrowserContext) => Promise<void>): Promise<void> {
  const r10 = job.rule10!, size = { width: job.width, height: job.height };
  const likeness = job.poses.filter(p => p.likeness);
  if (likeness.length) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: r10.dpr });
    await routeContext(ctx);
    const page = await ctx.newPage();
    try {
      await openPage(page, { ...job, query: [job.query.replace(/^\?/, ''), r10.likenessQuery].filter(Boolean).join('&') });
      for (const pose of likeness) {
        const l = pose.likeness!, dir = join(pose.out ?? job.out, pose.key);
        try {
          await page.setViewportSize({ width: l.width, height: l.height });
          const at = { lngLat: l.lngLat, headingDeg: l.headingDeg, fps: l.fps };
          await setPose(page, at); await page.waitForTimeout(job.settleMs); await setPose(page, at);
          const settle = await settleWorld(page, `${pose.key} likeness`, 60_000);
          await setPose(page, at);
          writeFileSync(join(dir, 'likeness.png'), await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: l.width, height: l.windowH } }));
          const drawn = await page.evaluate(() => { const c = document.querySelector('#vector-map canvas') as HTMLCanvasElement | null; return { tier: (window as any).__canalPerf?.tier ?? null, dpr: devicePixelRatio, buffer: c ? [c.width, c.height] : null, css: c ? [c.clientWidth, c.clientHeight] : null, search: location.search }; });
          writeFileSync(join(dir, 'likeness.json'), JSON.stringify({ key: pose.key, ...drawn, dpr: drawn.buffer && drawn.css ? +(drawn.buffer[1] / drawn.css[1]).toFixed(3) : drawn.dpr, viewport: [l.width, l.height], windowH: l.windowH, settle }, null, 1));
        } catch (e) { console.warn(`house-frames: likeness ${pose.key} failed: ${(e as Error).message.slice(0, 300)}`); }
      }
    } finally { await ctx.close(); }
  }
  for (const a of r10.asPlayed) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: r10.dpr });
    await routeContext(ctx);
    const page = await ctx.newPage();
    try {
      // The default engine and camera: the job's query only (no engine=own, no cam=fps unless the query asks).
      // 'relative' steering keeps the rider's heading: 'street' mode turns a parked rider onto the nearest street.
      // r10.asPlayedQuery pins the pixel ratio, governor and tier (rule10Frames.ts rule10Pins), as the likeness pages.
      const q = [job.query.replace(/^\?/, ''), r10.asPlayedQuery ?? ''].filter(Boolean).join('&');
      await openRoute(page, { travelMode: 'car', query: q ? `?${q}` : '', abortHeavyTiles: true, controlMode: 'relative' });
      await page.evaluate(() => { (window as any).canalRecallGame.player.handleInput = () => {}; });
      await page.addStyleTag({ content: `body > *:not(#vector-map) { visibility: hidden !important; } .maplibregl-control-container { display: none !important; }` });
      const at = { lngLat: a.lngLat, headingDeg: a.headingDeg, fps: {} };
      await setPose(page, at); await page.waitForTimeout(job.settleMs); await setPose(page, at);
      const own = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.engine === 'own');
      const settle = own ? await settleWorld(page, 'as-played', 60_000) : null;
      // MapLibre has no worldSettled(): the chase camera eases in and its tiles stream for a few seconds.
      if (!own) await page.waitForTimeout(8000);
      await setPose(page, at); await page.waitForTimeout(800);
      mkdirSync(a.out, { recursive: true });
      writeFileSync(join(a.out, 'as-played.png'), await page.screenshot({ type: 'png' }));
      const drawn = await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap, c = (vm.map?.getCanvas?.() ?? document.querySelector('#vector-map canvas')) as HTMLCanvasElement | null; return { engine: vm.engine ?? 'maplibre', buffer: c ? [c.width, c.height] : null, css: c ? [c.clientWidth, c.clientHeight] : null, search: location.search }; });
      writeFileSync(join(a.out, 'as-played.json'), JSON.stringify({ ...a, ...drawn, dpr: drawn.buffer && drawn.css ? +(drawn.buffer[1] / drawn.css[1]).toFixed(3) : null, settle }, null, 1));
    } catch (e) { console.warn(`house-frames: as-played ${a.out} failed: ${(e as Error).message.slice(0, 300)}`); }
    finally { await ctx.close(); }
  }
}

test('house frames', async ({ page, browser }) => {
  test.skip(!JOB, 'run through npm run house:frames');
  const job: Job = JSON.parse(readFileSync(JOB!, 'utf8'));
  test.setTimeout(240_000 + job.poses.length * 90_000);
  await page.setViewportSize({ width: job.width, height: job.height });
  // BUNDLES_DIR=<dir> serves *.bundle.js from a scratch build (lane W1, as scripts/perf-frozen-frames.mjs): a before/after
  // of a source change without touching the committed bundles. On the context, so the building worker's script is routed too.
  const bundles = process.env.BUNDLES_DIR ? resolve(process.env.BUNDLES_DIR) : '';
  const served = new Set<string>(), workers = new Set<string>();
  await routeBundles(page.context(), bundles, served);
  if (bundles) page.on('worker', w => { if (/\.js(\?|$)/.test(w.url())) workers.add(new URL(w.url()).pathname.split('/').pop()!); });
  /*TMPVERIFY*/ page.on('console', m => { if (m.text().includes('BUNDLES_DIR_MARKER')) console.log('TMPVERIFY console', m.text()); }); page.on('worker', w => { setTimeout(() => w.evaluate('self.__bundlesDirMarker').then(v => console.log('TMPVERIFY worker', w.url().slice(0, 140), v)).catch(e => console.log('TMPVERIFY err', String(e).slice(0, 100))), 2000); });
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
        writeFileSync(join(dir, 'game.json'), JSON.stringify({ key: pose.key, settle, picks, drawn, ...(specsDir ? { stagedSpecs: { on: specsOn, served: specsServed } } : {}), ...(bundles ? { bundlesDir: { dir: bundles, served: [...served].sort(), workers: [...workers].sort() } } : {}), opened, ms: { open: tOpen - ts, settle: tSettled - tOpen, total: Date.now() - ts } }, null, 1));
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
  if (job.rule10) await rule10Frames(browser, job, async ctx => {
    await routeBundles(ctx, bundles, served);
    if (specsDir) await ctx.route(/\/data\/extracts\/amsterdam\/house-specs\/14\/\d+\/\d+\.json\.gz(\?.*)?$/, route => {
      const file = join(specsDir, /\/house-specs\/(14\/\d+\/\d+\.json\.gz)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/octet-stream' }) : route.continue();
    });
  });
  const wallMs = Date.now() - t0, outs = [...new Set(job.poses.map(p => p.out ?? job.out))];
  if (outs.length === 1) writeFileSync(join(outs[0], 'browser-timings.json'), JSON.stringify({ poses: job.poses.length, wallMs, opened, timings }, null, 1));
  else for (const out of outs) {
    // A batch: each out dir gets its own poses' timings; wallMs is their share (the sum of their per-pose totals).
    const mine = timings.filter(t => t.out === out);
    writeFileSync(join(out, 'browser-timings.json'), JSON.stringify({ poses: job.poses.filter(p => (p.out ?? job.out) === out).length, wallMs: mine.reduce((a, t) => a + Number(t.total), 0), opened, timings: mine, batch: { poses: job.poses.length, lists: outs.length, wallMs } }, null, 1));
  }
});
