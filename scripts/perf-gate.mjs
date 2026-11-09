// Perf gate skeleton (engine programme P0, lane L2).
// Usage: node scripts/perf-gate.mjs [variant] [--aerial] [--device desktop|iphone] [--pop-in] [--report <json>]
//   (variant "" = default game)
//   --aerial   also runs scripts/aerial-pan.mjs once (default 3-min pan, ~5 min) and evaluates the aerial*/farShell* rows
//              from its summary against the budget for --device (default desktop); without it those rows print external.
//   --pop-in   also runs scripts/pop-in.mjs (feeds no budget row; costs minutes); off by default.
//   --report <json>  {rowKey: measurement} for reportOnly rows measured elsewhere (heap-ride, time-to-ride-device, ...).
// Runs ride-perf-owners and motion-stutter for one variant string,
// collects their JSON into artifacts/perf/gate-<variant>-<date>.json and prints
// one line per budget from tests/perf/budgets.json. Budgets are never changed here.
// Row -> collector mapping and the pass/fail rule live in perf-gate-lib.mjs. Exits 1 when a collector failed or any
// row it owns is n/a (a gate that cannot measure must fail loudly). Needs PORT=<dev server port> in the environment.
// Dry run: PERF_GATE_FIXTURE=<collected.json> skips the browsers and evaluates a saved gate JSON.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { evaluate, formatGate, worldCellsGzipBytes } from './perf-gate-lib.mjs';

const args = process.argv.slice(2);
const flag = k => args.includes(`--${k}`);
const flagValue = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const valueIdx = new Set(['device', 'report'].map(k => args.indexOf(`--${k}`) + 1).filter(i => i > 0));
const positional = args.filter((a, i) => !a.startsWith('--') && !valueIdx.has(i));
const variant = positional[0] ?? '';
const withAerial = flag('aerial'), withPopIn = flag('pop-in');
const device = flagValue('device') ?? 'desktop';
const date = new Date().toISOString().slice(0, 10);
const tag = variant || 'default';
const dir = 'artifacts/perf';
fs.mkdirSync(dir, { recursive: true });
const budgets = JSON.parse(fs.readFileSync('tests/perf/budgets.json', 'utf8')).entries;

function run(script, args, env = {}) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [script, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  console.error(`collector ${path.basename(script)} took ${Math.round((Date.now() - t0) / 1000)} s`);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const fixture = process.env.PERF_GATE_FIXTURE;
const readJson = f => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
let collected;
if (fixture) collected = JSON.parse(fs.readFileSync(fixture, 'utf8'));
else {
  // Owners: its last stdout line is only a summary; the full result is artifacts/perf-owners/<label>.json (gl.drawCallsMedian).
  const owners = run('scripts/ride-perf-owners.mjs', [tag, variant]);
  const ownersFile = `artifacts/perf-owners/${tag}.json`;
  // Motion: ride mode (warm-up 10 s, 60 s measured, warm run, unthrottled) with GL counters for the program count.
  const motionOut = path.join(dir, `gate-${tag}-${date}-motion.json`);
  // The P4 counters-gate route (landmark to landmark, see the header of motion-stutter.mjs); DPR 2 is the 14-inch MacBook
  // desktop. The default Anne Frank -> Rijksmuseum picker route is not offered under ?engine=own, so it cannot be used here.
  const LM_A = 'lm-extract_landmarks_433737872', LM_B = 'lm-extract_landmarks_1632187034';
  const motion = run('scripts/motion-stutter.mjs', [motionOut, '--runs', 'warm', '--throttle', '1', '--seconds', '10', '--qs', variant || '?engine=own', '--start', LM_A, '--dest', LM_B, '--via', LM_B, '--warmup', '10', '--measure', '60'], { GL_COUNTERS: '1', DPR: '2' });
  const popOut = path.join(dir, `gate-${tag}-${date}-popin.json`);
  const popin = withPopIn ? run('scripts/pop-in.mjs', [popOut, ...(variant ? ['--qs', variant] : [])]) : null;
  const aerialOut = path.join(dir, `gate-${tag}-${date}-aerial.json`);
  const aerial = withAerial ? run('scripts/aerial-pan.mjs', [aerialOut, '--device', device, ...(variant ? ['--qs', variant] : [])]) : null;
  for (const [name, r] of [['ride-perf-owners', owners], ['motion-stutter', motion], ['pop-in', popin], ['aerial-pan', aerial]]) if (r && r.status !== 0) console.error(`collector ${name} exited ${r.status}\n${r.stderr.slice(-800)}`);
  collected = {
    variant, date,
    ownersStatus: owners.status, owners: fs.existsSync(ownersFile) && owners.status === 0 ? readJson(ownersFile) : null,
    motionStatus: motion.status, motion: readJson(motionOut),
    ...(popin ? { popInStatus: popin.status, popIn: readJson(popOut) } : {}),
    ...(aerial ? { aerialStatus: aerial.status, aerial: aerial.status === 0 ? readJson(aerialOut) : null } : {}),
  };
}
// In-process rows (no browser): measured from the checkout, also when a fixture lacks them.
if (flag('report')) collected.reported = readJson(flagValue('report'));
collected.files ??= { worldCellsGzipBytes: await worldCellsGzipBytes() };
const outFile = path.join(dir, `gate-${tag}-${date}.json`);
fs.writeFileSync(outFile, JSON.stringify(collected, null, 1));

const verdict = evaluate(budgets, collected, { aerial: withAerial, device });
console.log(`gate ${tag} ${date}: ${formatGate(verdict)}  -> ${outFile}`);
if (verdict.over.length) console.log(`OVER BUDGET (findings, budgets unchanged): ${verdict.over.join(', ')}`);
if (verdict.naKeys.length) { console.error(`perf gate FAILED: not measured: ${verdict.naKeys.join(', ')}`); process.exitCode = 1; }
