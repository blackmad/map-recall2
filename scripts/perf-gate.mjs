// Perf gate skeleton (engine programme P0, lane L2).
// Usage: node scripts/perf-gate.mjs [variant]   (variant "" = default game)
// Runs ride-perf-owners, motion-stutter and pop-in for one variant string,
// collects their JSON into artifacts/perf/gate-<variant>-<date>.json and prints
// one line per budget from tests/perf/budgets.json. Budgets are never changed here.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const variant = process.argv[2] ?? '';
const date = new Date().toISOString().slice(0, 10);
const tag = variant || 'default';
const dir = 'artifacts/perf';
fs.mkdirSync(dir, { recursive: true });
const budgets = JSON.parse(fs.readFileSync('tests/perf/budgets.json', 'utf8')).entries;

function run(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function lastJson(text) {
  const line = text.trim().split('\n').reverse().find(l => l.startsWith('{'));
  try { return line ? JSON.parse(line) : null; } catch { return null; }
}

const owners = run('scripts/ride-perf-owners.mjs', [tag, variant]);
const motionOut = path.join(dir, `gate-${tag}-${date}-motion.json`);
const motion = run('scripts/motion-stutter.mjs', [motionOut]);
const popOut = path.join(dir, `gate-${tag}-${date}-popin.json`);
const popin = run('scripts/pop-in.mjs', [popOut]);

const collected = {
  variant, date,
  ownersStatus: owners.status, owners: lastJson(owners.stdout),
  motionStatus: motion.status, motion: fs.existsSync(motionOut) ? JSON.parse(fs.readFileSync(motionOut, 'utf8')) : null,
  popInStatus: popin.status, popIn: fs.existsSync(popOut) ? JSON.parse(fs.readFileSync(popOut, 'utf8')) : null,
};
const outFile = path.join(dir, `gate-${tag}-${date}.json`);
fs.writeFileSync(outFile, JSON.stringify(collected, null, 1));

// Measured values are read from the scripts' JSON. A path that does not resolve prints n/a.
const measured = {
  draws: collected.owners?.draws,
  programs: collected.owners?.programs,
  timeToRideS: collected.owners?.timeToRideS,
};
const cells = Object.entries(budgets).map(([key, b]) => {
  const m = measured[key];
  return `${key}=${m ?? 'n/a'}/${JSON.stringify(b.value)}`;
});
console.log(`gate ${tag} ${date}: ${cells.join('  ')}  -> ${outFile}`);
