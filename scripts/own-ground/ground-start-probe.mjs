// The own ground's start, measured (lane R5-A #260): a Free Ride cold start, the ground's state every --every ms from
// the page's start until every wanted cell is installed (or --max s). Reports, relative to the game reaching state 4
// (the ride revealed): when the worker was ready, when the camera's cell (and its 8 neighbours) and the whole ring were
// installed, and where each cell's time went (worker queue wait / data in / build / tiles; main-thread queue / install).
//
//   PORT=4680 node scripts/own-ground/ground-start-probe.mjs <out.json> [--runs 3] [--every 500] [--max 60] [--qs 'a=1']
//     [--chrome] [--headed] [--device desktop|iphone] [--throttle 4]
// BUNDLES_DIR=<dir> serves *.bundle.js (and the ground worker) from a scratch build. The deploy:
// ORIGIN=https://rideamsterdam.nl PAGE_PATH=/ride (lane LS).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'artifacts/perf/ground-start.json';
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const runs = Number(opt('runs', '3')), every = Number(opt('every', '500')), maxS = Number(opt('max', '60'));
const extraQs = opt('qs', ''), device = opt('device', 'desktop');
const origin = process.env.ORIGIN || `http://127.0.0.1:${process.env.PORT || 4680}`;
const qs = `?ride=free&engine=own${extraQs ? `&${extraQs.replace(/^[?&]/, '')}` : ''}`;
const [vw, vh] = (process.env.VIEWPORT || '1512x982').split('x').map(Number);

const browser = await chromium.launch({
  headless: !argv.includes('--headed'),
  args: argv.includes('--chrome') ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : [],
  ...(argv.includes('--chrome') ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
});
const results = [];
for (let run = 0; run < runs; run++) {
  const context = await browser.newContext(device === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.DPR || 2) });
  if (process.env.BUNDLES_DIR) await context.route(/\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())[1]);
    return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
  await context.route(/ingest\.(us\.)?sentry\.io/, route => route.fulfill({ status: 200, body: '{}' }));
  const page = await context.newPage();
  // --throttle N: CPU slowed N times (the iPhone 13 4x check; the page's own thread, as the perf harnesses do).
  if (Number(opt('throttle', '0')) > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(opt('throttle', '0')) });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  // Sampled in the page from its first script on, so the poll does not depend on the harness's round trips.
  await page.addInitScript(([every, maxS]) => {
    const S = window.__groundStart = { rows: [], state4At: null };
    const tick = () => {
      const g = window.canalRecallGame, vm = g?.vectorMap, gr = vm?._ownGround;
      if (g?.state === 4 && S.state4At == null) S.state4At = performance.now();
      if (gr?.status) {
        const st = gr.status(), key = gr.cellKeyAt?.((() => { const c = vm.camera?.center?.(); return c ? [c.lng, c.lat] : null; })() ?? [0, 0]);
        const wanted = gr.wantedKeys ? [...gr.wantedKeys] : [];
        const block = key ? (() => { const [x, y] = key.split('_').map(Number); const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.push(`${x + dx}_${y + dy}`); return o.filter(k => wanted.includes(k)); })() : [];
        const resident = st.cells ?? {};
        S.rows.push({ t: Math.round(performance.now()), state: g?.state, zoom: +(+st.zoom).toFixed(2), visible: st.visible, blend: +(+st.blend).toFixed(2), ready: st.ready, workerReady: st.workerReady,
          centreKey: key, focusCell: st.focusCell ?? null, centreIn: key ? key in resident : false, blockIn: block.filter(k => k in resident).length, block: block.length,
          wanted: wanted.length, resident: Object.keys(resident).length, wantedIn: wanted.filter(k => k in resident).length, pending: Object.keys(st.pending ?? {}).length, queued: st.queued, built: st.built, errors: st.errors?.length ?? 0,
          workerPending: st.workerPending?.map(a => a.length) ?? null, camZoom: (() => { try { return +vm.camera.zoom().toFixed(2); } catch { return null; } })(), camPitch: (() => { try { return Math.round(vm.camera.pitch()); } catch { return null; } })(), farPending: st.far?.pending ?? null, farBuilt: st.far?.built ?? null, reliefTiles: st.reliefTiles });
      }
      if (performance.now() < maxS * 1000) setTimeout(tick, every);
    };
    setTimeout(tick, every);
  }, [every, maxS]);
  await page.goto(`${origin}${process.env.PAGE_PATH ?? '/canal-drive/'}${qs}`);
  // Until the ring is in (every wanted cell resident, nothing pending) for 2 s after state 4, or --max s.
  await page.waitForFunction(() => {
    const S = window.__groundStart, r = S.rows.at(-1);
    return S.state4At != null && r && r.wanted > 0 && r.wantedIn === r.wanted && r.pending === 0 && r.queued === 0 && r.t > S.state4At + 2000;
  }, null, { timeout: maxS * 1000, polling: 250 }).catch(() => {});
  const data = await page.evaluate(() => {
    const S = window.__groundStart, gr = canalRecallGame?.vectorMap?._ownGround;
    const res = performance.getEntriesByType('resource').filter(e => /own-ground|ground|elevation|osm-ground|roads|parks|water/.test(e.name)).map(e => ({ name: e.name.split('/').slice(-2).join('/').split('?')[0], start: Math.round(e.startTime), end: Math.round(e.responseEnd), kB: Math.round((e.transferSize || e.decodedBodySize || 0) / 1024) }));
    return { state4At: S.state4At, rows: S.rows, startup: gr?.startup ? JSON.parse(JSON.stringify(gr.startup)) : null, resources: res };
  });
  const s4 = data.state4At ?? 0, rel = t => (t == null ? null : Math.round(t - s4));
  const first = pred => data.rows.find(pred)?.t ?? null;
  const st = data.startup ?? {};
  const summary = {
    run, state4At: Math.round(s4), workers: st.workers ?? null, workerReady: (st.workerReady ?? []).map(rel),
    loadAt: rel(st.loadAt), storeReadyAt: rel(st.storeReadyAt), workerPostedAt: rel(st.workerPostedAt), prefetchAt: rel(st.prefetchAt), prefetchKey: st.prefetchKey ?? null, workerReadyAt: rel(st.workerReadyAt), workerInitMs: st.workerInitMs ?? null, firstInstallAt: rel(st.firstInstallAt),
    visibleAt: rel(first(r => r.visible)), centreAt: rel(first(r => r.centreIn)), blockAt: rel(first(r => r.block > 0 && r.blockIn === r.block)), ringAt: rel(first(r => r.wanted > 0 && r.wantedIn === r.wanted && r.pending === 0)),
    wanted: data.rows.at(-1)?.wanted ?? null,
    cells: (st.cells ?? []).map(c => ({ ...c, installedAt: rel(c.installedAt) })),
  };
  const med = k => { const a = summary.cells.map(c => c[k]).filter(v => v != null).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
  summary.medians = { waitMs: med('waitMs'), inputMs: med('inputMs'), buildMs: med('buildMs'), tileMs: med('tileMs'), queuedMs: med('queuedMs'), installMs: med('installMs'), latencyMs: med('latencyMs') };
  // Lane R5-A #260 step 1: the cells each worker built, in order, and the start's wait split over the first ring.
  summary.byWorker = {};
  for (const c of summary.cells) (summary.byWorker[c.worker ?? '?'] ??= []).push(`${c.key}@${c.lod}`);
  const sum = k => summary.cells.reduce((n, c) => n + (c.ahead?.[k] ?? 0), 0);
  summary.waitSplit = { cells: summary.cells.length, waitMs: summary.cells.reduce((n, c) => n + (c.waitMs ?? 0), 0), behindCellInputMs: sum('cellInputMs'), behindCellBuildMs: sum('cellBuildMs'), behindFarMs: sum('farMs'), behindInitMs: sum('initMs'), idleMs: sum('idleMs') };
  const fsum = k => summary.cells.reduce((n, c) => n + (c.fetch?.[k] ?? 0), 0);
  summary.inputSplit = { inputMs: summary.cells.reduce((n, c) => n + (c.inputMs ?? 0), 0), netMs: fsum('netMs'), gunzipMs: fsum('gunzipMs'), files: fsum('files'), kB: fsum('kB'), stallMaxMs: Math.max(0, ...summary.cells.map(c => c.fetch?.stallMaxMs ?? 0)) };
  const allPaths = summary.cells.flatMap(c => c.fetch?.paths ?? []), byDir = {};
  for (const c of summary.cells) for (const [d, [n, kB]] of Object.entries(c.fetch?.byDir ?? {})) { const e = (byDir[d] ??= [0, 0]); e[0] += n; e[1] += kB; }
  summary.inputSplit.distinctFiles = new Set(allPaths).size;
  summary.inputSplit.byDir = byDir;
  // Lane R5-A #260 step 3 (groundShare.ts): requests served by the share host without a new fetch, their kB, the host's fetch + gunzip they saved.
  summary.inputSplit.shared = fsum('shared'); summary.inputSplit.sharedKB = fsum('sharedKB'); summary.inputSplit.savedMs = fsum('savedMs'); summary.inputSplit.hostGunzipMs = fsum('hostGunzipMs');
  summary.inputSplit.networkFetches = summary.inputSplit.files - summary.inputSplit.shared;
  // Lane R5-A #260 step 4: the data-in CPU per phase (GroundStore.phaseHook) and the build's phases, for the block's LOD 0
  // cells and over all cells; the same plan (phase|key) computed more than once on this start (on several workers).
  const blockCentre = data.rows.find(r => r.t >= s4 && r.centreKey)?.centreKey ?? null;
  const blockKeys = blockCentre ? (() => { const [x, y] = blockCentre.split('_').map(Number), o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.push(`${x + dx}_${y + dy}`); return o; })() : [];
  const addTo = (o, rec) => { for (const [k, v] of Object.entries(rec ?? {})) o[k] = (o[k] ?? 0) + v; return o; };
  const blockL0 = summary.cells.filter(c => c.lod === 0 && blockKeys.includes(c.key));
  summary.phaseSplit = {
    blockCentre, blockL0: blockL0.length,
    blockL0Cells: blockL0.map(c => ({ key: c.key, worker: c.worker, inputMs: c.inputMs, buildMs: c.buildMs, input: c.phases?.input ?? null, build: c.phases?.build ?? null })),
    allInput: summary.cells.reduce((o, c) => addTo(o, c.phases?.input), {}), allBuild: summary.cells.reduce((o, c) => addTo(o, c.phases?.build), {}),
  };
  const seenPlan = new Map();
  for (const c of summary.cells) for (const e of c.phases?.events ?? []) { const [ph, k, ms] = e.split('|'); const id = `${ph}|${k}`; const r = seenPlan.get(id) ?? { n: 0, ms: 0, first: 0, workers: new Set() }; r.n++; r.ms += +ms; if (r.n === 1) r.first = +ms; r.workers.add(c.worker); seenPlan.set(id, r); }
  const dup = {};
  for (const [id, r] of seenPlan) { const ph = id.split('|')[0], d = (dup[ph] ??= { plans: 0, computed: 0, ms: 0, repeatedMs: 0 }); d.plans++; d.computed += r.n; d.ms += r.ms; d.repeatedMs += r.ms - r.first; }
  for (const d of Object.values(dup)) { d.ms = Math.round(d.ms); d.repeatedMs = Math.round(d.repeatedMs); }
  summary.phaseSplit.repeated = dup;
  summary.farPendingMax = Math.max(0, ...data.rows.map(r => r.farPending ?? 0));
  results.push({ ...summary, rows: data.rows.map(r => ({ ...r, t: rel(r.t) })), resources: data.resources.map(r => ({ ...r, start: rel(r.start), end: rel(r.end) })), errors });
  console.log(`run ${run}: worker posted ${summary.workerPostedAt} ready ${summary.workerReadyAt} (init ${summary.workerInitMs} ms) first install ${summary.firstInstallAt} | visible ${summary.visibleAt} centre ${summary.centreAt} block ${summary.blockAt} ring ${summary.ringAt} (${summary.wanted} cells) ms after state 4 | medians ${JSON.stringify(summary.medians)}`);
  console.log(`  prefetch ${summary.prefetchAt} (${summary.prefetchKey}) workers ${summary.workers} ready ${JSON.stringify(summary.workerReady)} byWorker ${JSON.stringify(summary.byWorker)}\n  waitSplit ${JSON.stringify(summary.waitSplit)}\n  inputSplit ${JSON.stringify(summary.inputSplit)} farPendingMax ${summary.farPendingMax}`);
  console.log(`  phases block ${summary.phaseSplit.blockCentre} L0 ${JSON.stringify(summary.phaseSplit.blockL0Cells)}\n  repeated ${JSON.stringify(summary.phaseSplit.repeated)}`);
  if (summary.prefetchAt == null) console.log('  WARNING: prefetchAt is null (stale bundles? groundPrefetch off?)');
  await context.close();
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ qs, device, runs: results }, null, 1));
await browser.close();
