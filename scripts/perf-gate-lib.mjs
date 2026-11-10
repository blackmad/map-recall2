// Pure half of scripts/perf-gate.mjs: which budget row is read from which collector's JSON, and the pass/fail rule.
// A row is one of
//   measured  - a collector in this gate produced it (get() returns a value);
//   external  - budgets.json lists it but it is produced by a named spec/script this gate does not run
//               (printed as "external:<command>", never counted as measured, never silently n/a);
//   n/a       - the gate's own collector ran (or should have) and the value did not resolve: that FAILS the gate.
//   spec-enforced - a Playwright spec reads the number from budgets.json (tests/e2e/helpers/budget.ts) and fails itself;
//               printed as "enforced by <spec>" (not measured here, but not unowned either);
//   report-only - the budgets.json row carries `reportOnly: true`: printed under its own heading with the measurement
//               when one exists (collected.reported[key] or a ROWS collector), never over, never n/a, never fails.
//   aerial    - the aerial/farShell rows; produced by `node scripts/perf-gate.mjs --aerial` (one aerial-pan run),
//               external in a default run.
// A budgets.json key with no entry in ROWS also fails, so a new budget cannot be added and then ignored.

const first = (a) => (Array.isArray(a) ? a[0] : undefined);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export const ROWS = {
  draws: { collector: 'owners', get: c => num(c.owners?.gl?.drawCallsMedian) },
  programs: { collector: 'motion', get: c => num(first(c.motion?.results)?.gl?.programCount) },
  motionBudget: {
    collector: 'motion',
    get: c => {
      const f = first(c.motion?.results)?.motion?.frames;
      return f && [f.longestMs, f.over100, f.over50].every(v => num(v) !== undefined) ? [f.longestMs, f.over100, f.over50] : undefined;
    },
    over: (m, b) => m[0] > b[0] || m[1] > b[1] || m[2] > b[2],
  },
  desktopMotionP99Ms: { collector: 'motion', get: c => num(first(c.motion?.results)?.motion?.frames?.p99) },
  // ThreeBuildings stats().textureMB at the end of the DPR 2 own-engine motion ride (crisp-textures.spec.ts reads the same).
  desktopTextureMB: { collector: 'motion', get: c => num(first(c.motion?.results)?.gl?.facadeTextureMB) },
  // Published world-v1 cells on disk (each cell file is already gzip): worldCellsGzipBytes() below, in MB of 1e6 bytes.
  worldCellsCityMB: { collector: 'files', get: c => { const b = num(c.files?.worldCellsGzipBytes); return b === undefined ? undefined : Math.round(b / 1e4) / 100; } },
};

/** Sum of public/data/extracts/amsterdam/world-v1/cells/*.bin, gzipping any cell that is not already gzip. */
export async function worldCellsGzipBytes(dir = 'public/data/extracts/amsterdam/world-v1/cells') {
  const fs = await import('node:fs'), zlib = await import('node:zlib');
  if (!fs.existsSync(dir)) return null;
  let bytes = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.bin')) continue;
    const b = fs.readFileSync(`${dir}/${f}`);
    bytes += b[0] === 0x1f && b[1] === 0x8b ? b.length : zlib.gzipSync(b).length;
  }
  return bytes;
}

const E2E = (spec, env = '') => `${env}npx playwright test ${spec}`;
export const EXTERNAL = {
  timeToRideS: 'node scripts/time-to-ride-device.mjs',
  iphoneHeapMB: 'node scripts/heap-ride.mjs --device iphone (forced GC)',
  iphoneArrayBuffersMB: 'node scripts/heap-ride.mjs --device iphone',
  iphoneGlBuffersMB: 'node scripts/heap-ride.mjs --device iphone --gl',
  iphoneMapLibreWorkersMB: 'node scripts/heap-ride.mjs --device iphone',
  roadGraphMB: 'node scripts/heap-ride.mjs (claimed owners)',
  worldRideDownloadMB: 'tests/e2e/world-v1-bytes.spec.ts with WORLD_BYTES=1 (gzip fetched)',
  desktopRideHeapGrowthPct: 'node scripts/heap-ride.mjs --ride 10 min',
  iphoneMotionP99Ms: 'node scripts/motion-stutter.mjs --device iphone --throttle 4 --warmup 10 --measure 60',
  popInSwapsNear: E2E('tests/e2e/swap-gate.spec.ts', 'PERF_SWAPS=1 '),
  iphoneRideStartOver200Ms: 'node scripts/motion-stutter.mjs --device iphone --throttle 4 --starts default,change,next,free',
  desktopRideStartOver100MsWarm: 'node scripts/motion-stutter.mjs --runs warm --starts change,free,next',
  desktopColdStartOver200Ms: 'node scripts/motion-stutter.mjs --runs cold --seconds 0 --starts default',
  iphoneColdStartOver100Ms: 'node scripts/motion-stutter.mjs --device iphone --throttle 4 --runs cold --starts default',
  popInSwapsMid: E2E('tests/e2e/swap-gate.spec.ts', 'PERF_SWAPS=1 SWAP_GATE_MID=1 '),
};
// Rows a spec enforces itself against the same budgets.json value (spec path relative to the repo root).
export const SPEC_ENFORCED = {
  cameraParityPx: 'tests/e2e/engine-parity.spec.ts',
  iphoneTextureMB: 'tests/e2e/city-startup-lod.spec.ts',
  skyTransparentClears: 'tests/e2e/sky-flicker.spec.ts',
  coverBumpHidden: 'tests/e2e/rider-cover-bump.spec.ts',
};
// Everything else in budgets.json that is not an aerial-pan row is unknown; aerial rows come from one script.
const AERIAL = /^(aerial|farShell)/;

// One aerial row -> a key of the `summary` object scripts/aerial-pan.mjs writes (the row name where it is the same).
// A device-keyed budget ({desktop, iphone}) is compared at the run's device.
const S = k => c => num(c.aerial?.summary?.[k]);
export const AERIAL_ROWS = {
  aerialHeapGrowthPct: S('aerialHeapGrowthPct'),
  aerialLandmarksMax: S('aerialLandmarksMax'),
  aerialGlMaxMB: S('aerialGlMaxMB'),
  aerialGeometriesMax: S('aerialGeometriesMax'),
  aerialTexturesGrowthPct: S('aerialTexturesGrowthPct'),
  aerialP99Ms: S('aerialP99Ms'),
  aerialFramesOver250Ms: S('aerialFramesOver250Ms'),
  aerialDrawsMax: S('aerialDrawsMax'),
  farShellCellsMax: S('farShellCellsMax'),
  farShellMBMax: S('farShellMBMax'),
  aerialCoarseFadeIns: S('coarseFadeIns'),
  // Sum of the `game frame` phase over every window's worst frames (framePhases=1), from the timeline rows.
  aerialGameFrameWorstSumMs: c => {
    const t = c.aerial?.timeline;
    if (!Array.isArray(t) || !t.length) return undefined;
    let sum = 0;
    for (const r of t) for (const w of r.worst ?? []) sum += num(w.phases?.['game frame']) ?? 0;
    return sum;
  },
  // aerialLabelChurnPerSec has no summary key (labelStats.churn is per placement); it stays external under --aerial.
};

const forDevice = (v, device) => (v && typeof v === 'object' && !Array.isArray(v) ? v[device] : v);

export function evaluate(budgets, collected, { aerial = false, device = 'desktop' } = {}) {
  const rows = [];
  for (const [key, b] of Object.entries(budgets)) {
    const budget = forDevice(b.value, device);
    const def = ROWS[key] ?? (aerial && AERIAL_ROWS[key] ? { get: AERIAL_ROWS[key] } : undefined);
    if (b.reportOnly) {
      // Never over, never n/a: the measurement (if any) is printed, the budget is the reference line.
      const m = def ? def.get(collected) : collected.reported?.[key];
      rows.push({ key, status: 'report', measured: m ?? null, budget: b.value, over: null, via: EXTERNAL[key] ?? (AERIAL.test(key) ? 'node scripts/perf-gate.mjs --aerial' : undefined) });
    } else if (def) {
      const m = def.get(collected);
      const over = m === undefined ? null : def.over ? def.over(m, budget) : typeof budget === 'number' ? m > budget : null;
      rows.push({ key, status: m === undefined ? 'n/a' : 'measured', measured: m ?? null, budget: b.value, over });
    } else if (SPEC_ENFORCED[key]) {
      rows.push({ key, status: 'spec-enforced', measured: null, budget: b.value, via: SPEC_ENFORCED[key] });
    } else if (EXTERNAL[key] || AERIAL.test(key)) {
      rows.push({ key, status: 'external', measured: null, budget: b.value, via: EXTERNAL[key] ?? (AERIAL.test(key) ? 'node scripts/perf-gate.mjs --aerial (one aerial-pan run)' : '') });
    } else {
      rows.push({ key, status: 'n/a', measured: null, budget: b.value, why: 'no collector or external source registered in scripts/perf-gate-lib.mjs' });
    }
  }
  const na = rows.filter(r => r.status === 'n/a');
  return { rows, naKeys: na.map(r => r.key), over: rows.filter(r => r.over).map(r => r.key), exitCode: na.length ? 1 : 0 };
}

export const format = (r) =>
  r.status === 'external' ? `${r.key}=external/${JSON.stringify(r.budget)} (${r.via})`
  : r.status === 'spec-enforced' ? `${r.key}=${JSON.stringify(r.budget)} (enforced by ${r.via})`
  : r.status === 'report' ? `${r.key}=${r.measured === null ? 'not measured' : JSON.stringify(r.measured)}/${JSON.stringify(r.budget)}${r.via ? ` (${r.via})` : ''}`
  : `${r.key}=${r.status === 'n/a' ? 'n/a' : JSON.stringify(r.measured)}/${JSON.stringify(r.budget)}${r.over ? ' OVER' : ''}`;

/** The printed gate: measured/external/spec-enforced rows on one line, report-only rows under their own heading. */
export function formatGate(verdict) {
  const main = verdict.rows.filter(r => r.status !== 'report').map(format).join('  ');
  const rep = verdict.rows.filter(r => r.status === 'report');
  return rep.length ? `${main}\nreport only (never fails the gate): ${rep.map(format).join('  ')}` : main;
}
