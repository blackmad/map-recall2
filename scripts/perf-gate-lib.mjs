// Pure half of scripts/perf-gate.mjs: which budget row is read from which collector's JSON, and the pass/fail rule.
// A row is one of
//   measured  - a collector in this gate produced it (get() returns a value);
//   external  - budgets.json lists it but it is produced by a named spec/script this gate does not run
//               (printed as "external:<command>", never counted as measured, never silently n/a);
//   n/a       - the gate's own collector ran (or should have) and the value did not resolve: that FAILS the gate.
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
};

const E2E = (spec, env = '') => `${env}npx playwright test ${spec}`;
export const EXTERNAL = {
  timeToRideS: 'node scripts/time-to-ride-device.mjs',
  iphoneHeapMB: 'node scripts/heap-ride.mjs --device iphone (forced GC)',
  iphoneArrayBuffersMB: 'node scripts/heap-ride.mjs --device iphone',
  iphoneGlBuffersMB: 'node scripts/heap-ride.mjs --device iphone --gl',
  iphoneMapLibreWorkersMB: 'node scripts/heap-ride.mjs --device iphone',
  cameraParityPx: E2E('tests/e2e/engine-own.spec.ts', 'parity test: '),
  worldCellsCityMB: 'node scripts/check-world-cells (gzip sum of world-v1/cells)',
  roadGraphMB: 'node scripts/heap-ride.mjs (claimed owners)',
  iphoneTextureMB: E2E('tests/e2e/city-startup-lod.spec.ts', '--project=iphone: '),
  worldRideDownloadMB: 'node scripts/pop-in.mjs / ride with ?world=v1 (gzip fetched)',
  desktopRideHeapGrowthPct: 'node scripts/heap-ride.mjs --ride 10 min',
  iphoneMotionP99Ms: 'node scripts/motion-stutter.mjs --device iphone --throttle 4 --warmup 10 --measure 60',
  skyTransparentClears: E2E('tests/e2e/sky-flicker.spec.ts'),
  popInSwapsNear: E2E('tests/e2e/swap-gate.spec.ts', 'PERF_SWAPS=1 '),
  coverBumpHidden: E2E('tests/e2e/rider-cover-bump.spec.ts'),
  iphoneRideStartOver200Ms: 'node scripts/motion-stutter.mjs --device iphone --throttle 4 --starts default,change,next,free',
  desktopRideStartOver100MsWarm: 'node scripts/motion-stutter.mjs --runs warm --starts change,free,next',
  desktopColdStartOver200Ms: 'node scripts/motion-stutter.mjs --runs cold --seconds 0 --starts default',
  iphoneColdStartOver100Ms: 'node scripts/motion-stutter.mjs --device iphone --throttle 4 --runs cold --starts default',
  popInSwapsMid: E2E('tests/e2e/swap-gate.spec.ts', 'PERF_SWAPS=1 SWAP_GATE_MID=1 '),
  desktopTextureMB: 'node scripts/aerial-pan.mjs (ThreeBuildings stats().textureMB)',
};
// Everything else in budgets.json that is not an aerial-pan row is unknown; aerial rows come from one script.
const AERIAL = /^(aerial|farShell)/;

export function evaluate(budgets, collected) {
  const rows = [];
  for (const [key, b] of Object.entries(budgets)) {
    const def = ROWS[key];
    if (def) {
      const m = def.get(collected);
      const over = m === undefined ? null : def.over ? def.over(m, b.value) : typeof b.value === 'number' ? m > b.value : null;
      rows.push({ key, status: m === undefined ? 'n/a' : 'measured', measured: m ?? null, budget: b.value, over });
    } else if (EXTERNAL[key] || AERIAL.test(key)) {
      rows.push({ key, status: 'external', measured: null, budget: b.value, via: EXTERNAL[key] ?? 'node scripts/aerial-pan.mjs (summary row)' });
    } else {
      rows.push({ key, status: 'n/a', measured: null, budget: b.value, why: 'no collector or external source registered in scripts/perf-gate-lib.mjs' });
    }
  }
  const na = rows.filter(r => r.status === 'n/a');
  return { rows, naKeys: na.map(r => r.key), over: rows.filter(r => r.over).map(r => r.key), exitCode: na.length ? 1 : 0 };
}

export const format = (r) =>
  r.status === 'external' ? `${r.key}=external/${JSON.stringify(r.budget)} (${r.via})`
  : `${r.key}=${r.status === 'n/a' ? 'n/a' : JSON.stringify(r.measured)}/${JSON.stringify(r.budget)}${r.over ? ' OVER' : ''}`;
