// iPhone start memory in the iOS Simulator (lane iphone-start-memory-20261127, Sentry CANAL-RECALL-V: iPhone tabs die
// while the ride starts). Real WebKit: Mobile Safari in a booted Simulator, driven by Safari's WebDriver
// (`safaridriver`, `safari:useSimulator`), while the Mac samples the Simulator's WebKit processes once a second with
// `footprint` (phys_footprint, the figure jetsam compares against the per-process limit on a device).
//
//   node_modules/.bin/tsx scripts/perf/iphone-sim-start-memory.ts --udid <booted sim udid> [--engine maplibre|own]
//     [--runs 3] [--origin http://localhost:4631] [--ride-s 40] [--qs 'a=1'] [--out artifacts/perf/iphone-sim]
//     [--driver-port 4632] [--max-mb 1400]
//
// Each run is a fresh WebDriver session (an ephemeral website data store: a cold HTTP cache and empty storage), with
// Mobile Safari terminated first so no other tab shares the WebContent pool. The page is the default ride at
// Geldersekade (the share-link path, scripts/perf/load-timeline.mjs), onboarding marked seen as for a returning rider;
// once racing and the intro flight is over the script holds ArrowUp. Every second it writes one row: the page's
// WebContent footprint (the largest WebContent process), the GPU process, the game's phase and the own engine's
// `__canalPerf.snapshot()`. --max-mb turns the run into a gate: exit 1 if any run's WebContent peak is above it.
//
// The Simulator runs on the Mac GPU with no jetsam limit and reports the Mac's core count (MapLibre and the worker
// pool size from navigator.hardwareConcurrency), so these are footprints to compare, not kill thresholds.
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const udid = opt('udid');
if (!udid) throw new Error('--udid <booted simulator udid> is required (xcrun simctl list devices booted)');
const engine = opt('engine', 'maplibre')!;
const runs = Number(opt('runs', '3'));
const origin = opt('origin', 'http://localhost:4631')!;
const rideS = Number(opt('ride-s', '40'));
const extraQs = opt('qs', '');
const outDir = opt('out', 'artifacts/perf/iphone-sim')!;
const driverPort = Number(opt('driver-port', '4632'));
const maxMb = opt('max-mb') ? Number(opt('max-mb')) : null;
const capS = Number(opt('cap-s', '150'));

const START = [52.37665, 4.90115], FINISH = [52.37265, 4.90035];
const hash = `#race=${START[0]},${START[1]},${START[0]},${START[1]},${FINISH[0]},${FINISH[1]}`;
const qs = ['travel=car', engine === 'own' ? 'engine=own' : '', extraQs].filter(Boolean).join('&');
const gameUrl = `${origin}/canal-drive/?${qs}${hash}`;

const wd = `http://127.0.0.1:${driverPort}`;
async function call(method: string, path: string, body?: unknown, timeoutMs = 60_000): Promise<any> {
  const res = await fetch(wd + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const json = await res.json() as { value: any };
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.value).slice(0, 300)}`);
  return json.value;
}

type Proc = { pid: number; kind: 'web' | 'gpu' | 'net' };
async function simProcs(): Promise<Proc[]> {
  const { stdout } = await run('ps', ['-axo', 'pid=,command=']);
  const out: Proc[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.includes('CoreSimulator') || !line.includes('/ExtensionKit/Extensions/')) continue;
    const pid = Number(line.trim().split(/\s+/, 1)[0]);
    if (/WebContent/.test(line)) out.push({ pid, kind: 'web' });
    else if (/GPUExtension|GPU\.appex|WebKit\.GPU/.test(line)) out.push({ pid, kind: 'gpu' });
    else if (/Networking/.test(line)) out.push({ pid, kind: 'net' });
  }
  return out;
}
type Footprint = { mb: number; peakMb: number; cats: Record<string, number> };
const toMb = (n: string, unit: string) => Number(n) * (unit === 'GB' ? 1024 : unit === 'MB' ? 1 : unit === 'KB' ? 1 / 1024 : 1 / 1048576);
/** `footprint <pids…>`: per process its phys_footprint, lifetime peak and its own dirty bytes by VM category (MB). */
async function footprints(procs: Proc[]): Promise<Map<number, Footprint>> {
  const map = new Map<number, Footprint>();
  if (!procs.length) return map;
  const { stdout } = await run('footprint', procs.map(p => String(p.pid)), { maxBuffer: 1 << 24 }).catch(e => ({ stdout: String(e.stdout ?? '') }));
  let cur: Footprint | null = null, own = false;
  for (const line of stdout.split('\n')) {
    const head = /^\S.*\[(\d+)\]: \d+-bit\s+Footprint/.exec(line);
    if (head) { cur = { mb: 0, peakMb: 0, cats: {} }; map.set(Number(head[1]), cur); own = true; continue; }
    if (!cur) continue;
    if (/^Shared with|^Auxiliary data/.test(line)) { own = false; }
    const fp = /^\s*phys_footprint(_peak)?:\s*([\d.]+)\s*(B|KB|MB|GB)/.exec(line);
    if (fp) { if (fp[1]) cur.peakMb = toMb(fp[2], fp[3]); else cur.mb = toMb(fp[2], fp[3]); continue; }
    const cat = own ? /^\s*([\d.]+)\s*(B|KB|MB|GB)\s+[\d.]+\s*(?:B|KB|MB|GB)\s+[\d.]+\s*(?:B|KB|MB|GB)\s+\d+\s+(.+?)\s*$/.exec(line) : null;
    if (cat && cat[3] !== 'TOTAL') cur.cats[cat[3]] = Math.round(toMb(cat[1], cat[2]) * 10) / 10;
  }
  return map;
}

// Racing, the probe also holds ArrowUp (Input.keys; the street-follow pad rides forward while it is down).
const PROBE = `const g = window.canalRecallGame, vm = g && g.vectorMap, perf = window.__canalPerf;
  if (g && g.state === 4 && !g._intro && g.input) g.input.keys.ArrowUp = true;
  let snap = null; try { snap = perf && perf.snapshot ? perf.snapshot() : null; } catch (e) {}
  let ml = null; try { const m = vm && (vm.map || (vm.host && vm.host.map)); if (m && m.style) { ml = {}; for (const [id, sc] of Object.entries(m.style.sourceCaches || m.style.tileManagers || {})) { const t = sc._tiles ? Object.keys(sc._tiles).length : null; const c = sc._cache ? sc._cache.order.length : null; ml[id] = [t, c]; } } } catch (e) {}
  const three = (() => { try { const r = vm && (vm.renderer || (vm._threeBuildings && vm._threeBuildings.renderer)); return r && r.info ? { geometries: r.info.memory.geometries, textures: r.info.memory.textures } : null; } catch (e) { return null; } })();
  return { state: g ? g.state : null, intro: !!(g && g._intro), engine: vm ? vm.engine : null, xy: g && g.player ? [Math.round(g.player.x), Math.round(g.player.y)] : null,
    loading: g ? g.loadingMessage : null, workers: window.__canalRecallWorkerPool ? window.__canalRecallWorkerPool.live : null,
    hc: navigator.hardwareConcurrency, dpr: devicePixelRatio, snap, ml, three, settle: g ? g._lastMapSettle || null : null };`;

const phaseOf = (p: any): string => !p ? 'boot' : p.state === 4 ? (p.intro ? 'intro' : 'racing') : p.state === 2 ? 'loading' : p.state === 0 || p.state === 1 ? 'menu' : p.state == null ? 'boot' : `state${p.state}`;

type Row = { t: number; riddenM: number; webMb: number; webPeakMb: number; webPid: number; gpuMb: number; netMb: number; phase: string; procMb: Record<string, number>; cats: Record<string, number>; probe: any };
async function oneRun(index: number): Promise<{ rows: Row[]; peakWebMb: number; peakSampledMb: number; peakAt: { t: number; phase: string; cats: Record<string, number> }; peakGpuMb: number; peakByPhase: Record<string, number>; crashed: boolean }> {
  await run('xcrun', ['simctl', 'terminate', udid!, 'com.apple.mobilesafari']).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  const session = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'Safari', platformName: 'iOS', 'safari:useSimulator': true, 'safari:deviceUDID': udid } } }, 120_000);
  const sid = session.sessionId as string;
  const rows: Row[] = [];
  let crashed = false;
  try {
    // Same origin first, to mark onboarding seen (a returning rider; the friend's iPhone had ridden before).
    await call('POST', `/session/${sid}/url`, { url: `${origin}/canal-drive/credits.html` });
    await call('POST', `/session/${sid}/execute/sync`, { script: "localStorage.setItem('canalRecall.onboarding.v1','done'); return 1", args: [] });
    const t0 = Date.now();
    call('POST', `/session/${sid}/url`, { url: gameUrl }, 120_000).catch(e => console.warn('navigate:', String(e).slice(0, 200)));
    let probe: any = null, racingAt: number | null = null, ridden = 0, lastXy: number[] | null = null;
    // Probe loop: as often as the page answers (a busy main thread delays executeScript, so it is decoupled).
    let stop = false;
    const prober = (async () => {
      while (!stop) {
        try { probe = await call('POST', `/session/${sid}/execute/sync`, { script: PROBE, args: [] }, 5000); }
        catch (e) { if (/no such window|session|terminated|crash/i.test(String(e))) crashed = /crash|terminated/i.test(String(e)) || crashed; }
        await new Promise(r => setTimeout(r, 500));
      }
    })();
    while (true) {
      const tick = Date.now();
      const procs = await simProcs();
      const fp = await footprints(procs);
      // The page is the WebContent that is largest now (Safari keeps a prewarmed spare and the credits page's).
      let web = 0, webPeak = 0, gpu = 0, net = 0, webPid = 0, cats: Record<string, number> = {};
      const procMb: Record<string, number> = {};
      for (const p of procs) {
        const f = fp.get(p.pid); if (!f) continue;
        procMb[`${p.kind}:${p.pid}`] = Math.round(f.mb);
        if (p.kind === 'web' && f.mb > web) { web = f.mb; webPeak = f.peakMb; webPid = p.pid; cats = f.cats; }
        if (p.kind === 'gpu') gpu = Math.max(gpu, f.mb);
        if (p.kind === 'net') net = Math.max(net, f.mb);
      }
      const phase = phaseOf(probe);
      const t = Math.round((tick - t0) / 100) / 10;
      rows.push({ t, riddenM: Math.round(ridden), webMb: Math.round(web), webPeakMb: Math.round(webPeak), webPid, gpuMb: Math.round(gpu), netMb: Math.round(net), phase, procMb, cats, probe });
      console.log(`run ${index} t=${String(t).padStart(5)} ${phase.padEnd(7)} web ${String(Math.round(web)).padStart(5)} MB (peak ${Math.round(webPeak)}) gpu ${Math.round(gpu)} MB ridden ${Math.round(ridden)} m`);
      if (phase === 'racing' && racingAt == null) racingAt = tick;
      if (probe?.xy && lastXy) ridden += Math.hypot(probe.xy[0] - lastXy[0], probe.xy[1] - lastXy[1]) / 3; // 3 px per metre
      if (probe?.xy) lastXy = probe.xy;
      if (racingAt != null && tick - racingAt > rideS * 1000) break;
      if (tick - t0 > capS * 1000) { console.warn(`run ${index}: cap ${capS} s reached in phase ${phase}`); break; }
      await new Promise(r => setTimeout(r, Math.max(0, 1000 - (Date.now() - tick))));
    }
    stop = true;
    await prober;
  } finally {
    await call('DELETE', `/session/${sid}`).catch(() => {});
  }
  const peakByPhase: Record<string, number> = {};
  for (const r of rows) peakByPhase[r.phase] = Math.max(peakByPhase[r.phase] ?? 0, r.webMb);
  // footprint's lifetime peak catches spikes between two samples; it is the page's process only if it was fresh.
  const peakRow = rows.reduce((a, b) => (b.webMb > a.webMb ? b : a), rows[0]);
  return { rows, peakWebMb: Math.max(...rows.map(r => r.webPeakMb || r.webMb)), peakSampledMb: peakRow.webMb, peakAt: { t: peakRow.t, phase: peakRow.phase, cats: peakRow.cats }, peakGpuMb: Math.max(...rows.map(r => r.gpuMb)), peakByPhase, crashed };
}

const results = [];
for (let i = 1; i <= runs; i++) results.push(await oneRun(i));
mkdirSync(outDir, { recursive: true });
const file = `${outDir}/iphone-sim-${engine}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify({ engine, gameUrl, udid, rideS, results }, null, 1));
for (const [i, r] of results.entries()) console.log(`run ${i + 1}: WebContent peak ${Math.round(r.peakWebMb)} MB (sampled ${r.peakSampledMb} at ${r.peakAt.t} s, ${r.peakAt.phase}), GPU ${r.peakGpuMb} MB, by phase ${JSON.stringify(r.peakByPhase)}`);
console.log(`wrote ${file}`);
if (maxMb != null && results.some(r => r.peakWebMb > maxMb)) { console.error(`FAIL: WebContent peak above ${maxMb} MB`); process.exit(1); }
