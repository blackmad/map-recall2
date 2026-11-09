import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, ROWS, EXTERNAL } from '../../scripts/perf-gate-lib.mjs';

const budgets = { draws: { value: 851 }, programs: { value: 32 }, motionBudget: { value: [200, 1, 4] }, desktopMotionP99Ms: { value: 33 }, timeToRideS: { value: 7.5 }, aerialP99Ms: { value: { desktop: 33 } } };
const good = {
  owners: { gl: { drawCallsMedian: 500 } },
  motion: { results: [{ gl: { programCount: 30 }, motion: { frames: { longestMs: 120, over100: 1, over50: 5, p99: 20 } } }] },
};

test('every collected row measured: exit 0, external rows do not count as n/a', () => {
  const v = evaluate(budgets, good);
  assert.equal(v.exitCode, 0);
  assert.deepEqual(v.naKeys, []);
  assert.deepEqual(v.over, ['motionBudget']);
  assert.equal(v.rows.find(r => r.key === 'timeToRideS').status, 'external');
  assert.equal(v.rows.find(r => r.key === 'aerialP99Ms').status, 'external');
});
test('an empty collection (every collector found nothing) exits 1 with every owned row n/a', () => {
  const v = evaluate(budgets, { owners: null, motion: null, popIn: null });
  assert.equal(v.exitCode, 1);
  assert.deepEqual(v.naKeys.sort(), ['desktopMotionP99Ms', 'draws', 'motionBudget', 'programs']);
});
test('one missing field is enough to fail', () => {
  const c = structuredClone(good); delete c.motion.results[0].gl;
  assert.deepEqual(evaluate(budgets, c).naKeys, ['programs']);
  assert.equal(evaluate(budgets, c).exitCode, 1);
});
test('a budget key nobody registered fails instead of being ignored', () => {
  const v = evaluate({ ...budgets, brandNewRow: { value: 1 } }, good);
  assert.deepEqual(v.naKeys, ['brandNewRow']);
  assert.equal(v.exitCode, 1);
});
test('every key in tests/perf/budgets.json is registered', async () => {
  const fs = await import('node:fs');
  const real = JSON.parse(fs.readFileSync(new URL('./budgets.json', import.meta.url), 'utf8')).entries;
  const v = evaluate(real, good);
  assert.deepEqual(v.rows.filter(r => r.why).map(r => r.key), []);
  assert.ok(Object.keys(ROWS).every(k => k in real) && Object.keys(EXTERNAL).every(k => k in real));
});
test('in-process rows: facade texture from the motion ride, world cells from the checkout', async () => {
  const { worldCellsGzipBytes } = await import('../../scripts/perf-gate-lib.mjs');
  const b = { desktopTextureMB: { value: 90 }, worldCellsCityMB: { value: 10 } };
  const c = structuredClone(good); c.motion.results[0].gl.facadeTextureMB = 86.7; c.files = { worldCellsGzipBytes: 10_500_000 };
  const v = evaluate(b, c);
  assert.deepEqual(v.rows.map(r => [r.key, r.status, r.measured, r.over]), [['desktopTextureMB', 'measured', 86.7, false], ['worldCellsCityMB', 'measured', 10.5, true]]);
  assert.deepEqual(evaluate(b, good).naKeys, ['desktopTextureMB', 'worldCellsCityMB']);
  assert.equal(await worldCellsGzipBytes('no/such/dir'), null);
  const fs = await import('node:fs'), os = await import('node:os'), zlib = await import('node:zlib');
  const dir = fs.mkdtempSync(`${os.tmpdir()}/cells-`);
  fs.writeFileSync(`${dir}/a.bin`, zlib.gzipSync(Buffer.alloc(1000)));
  fs.writeFileSync(`${dir}/b.bin`, Buffer.alloc(1000, 7));
  fs.writeFileSync(`${dir}/index.json`, '{}');
  assert.equal(await worldCellsGzipBytes(dir), zlib.gzipSync(Buffer.alloc(1000)).length + zlib.gzipSync(Buffer.alloc(1000, 7)).length);
});

// ---- lane R3-C (#309) ----
import { SPEC_ENFORCED, AERIAL_ROWS, formatGate } from '../../scripts/perf-gate-lib.mjs';

test('spec-enforced rows print "enforced by <spec>", are never n/a and never over', () => {
  const b = { cameraParityPx: { value: 3.2 }, iphoneTextureMB: { value: 22 }, skyTransparentClears: { value: 0 }, coverBumpHidden: { value: 0 } };
  const v = evaluate(b, good);
  assert.equal(v.exitCode, 0);
  assert.ok(v.rows.every(r => r.status === 'spec-enforced'));
  assert.match(formatGate(v), /cameraParityPx=3\.2 \(enforced by tests\/e2e\/engine-parity\.spec\.ts\)/);
  assert.ok(!/external/.test(formatGate(v)));
});
test('every spec-enforced spec exists and reads its row through the budget helper', async () => {
  const fs = await import('node:fs');
  for (const [key, spec] of Object.entries(SPEC_ENFORCED)) {
    const text = fs.readFileSync(new URL(`../../${spec}`, import.meta.url), 'utf8');
    assert.ok(text.includes(`budget('${key}')`), `${spec} must call budget('${key}')`);
    assert.ok(!(key in EXTERNAL), `${key} is both spec-enforced and external`);
  }
});
test('the budget helper reads budgets.json and rejects an unknown row', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../e2e/helpers/budget.ts', import.meta.url), 'utf8');
  assert.match(src, /tests\/perf\/budgets\.json/);
  assert.match(src, /has no row/);
});
test('reportOnly rows: printed with the measurement when there is one, never over, never n/a, never fail', () => {
  const b = { iphoneHeapMB: { value: 250, reportOnly: true }, timeToRideS: { value: 7.5, reportOnly: true }, draws: { value: 851, reportOnly: true }, programs: { value: 1, reportOnly: true } };
  const c = structuredClone(good); c.reported = { iphoneHeapMB: 400 };
  const v = evaluate(b, c);
  assert.equal(v.exitCode, 0); assert.deepEqual(v.over, []); assert.deepEqual(v.naKeys, []);
  assert.ok(v.rows.every(r => r.status === 'report' && r.over === null));
  assert.equal(v.rows.find(r => r.key === 'iphoneHeapMB').measured, 400);
  assert.equal(v.rows.find(r => r.key === 'timeToRideS').measured, null);
  // A collector-owned row flagged reportOnly still shows its measurement, and an unmeasurable one does not fail.
  assert.equal(v.rows.find(r => r.key === 'draws').measured, 500);
  assert.equal(evaluate(b, { owners: null, motion: null }).exitCode, 0);
  const out = formatGate(v);
  assert.match(out, /\nreport only \(never fails the gate\): iphoneHeapMB=400\/250/);
  assert.match(out, /timeToRideS=not measured\/7\.5/);
});
test('without reportOnly the same rows stay external (budgets.json untouched)', () => {
  assert.equal(evaluate({ iphoneHeapMB: { value: 250 } }, good).rows[0].status, 'external');
});
const aerialRun = {
  summary: { aerialHeapGrowthPct: 4, aerialLandmarksMax: 261, aerialGlMaxMB: 650, aerialGeometriesMax: 2000, aerialTexturesGrowthPct: 2, aerialP99Ms: 30, aerialFramesOver250Ms: 0, aerialDrawsMax: 380, farShellCellsMax: 100, farShellMBMax: 50, coarseFadeIns: 600 },
  timeline: [{ worst: [{ phases: { 'game frame': 40, x: 1 } }, { phases: { 'game frame': 60 } }] }, { worst: [{ phases: { 'game frame': 100 } }] }, { worst: null }],
};
const aerialBudgets = { aerialHeapGrowthPct: { value: 10 }, aerialLandmarksMax: { value: { desktop: 260, iphone: 130 } }, aerialP99Ms: { value: { desktop: 33, iphone: 50 } }, aerialFramesOver250Ms: { value: 0 }, aerialGameFrameWorstSumMs: { value: { desktop: 250, iphone: 250 } }, aerialCoarseFadeIns: { value: { desktop: 700, iphone: 750 } }, aerialLabelChurnPerSec: { value: { desktop: 25, iphone: 12 } }, farShellCellsMax: { value: { desktop: 160, iphone: 48 } } };
test('default run leaves every aerial row external, even when an aerial result is lying around', () => {
  const v = evaluate(aerialBudgets, { ...good, aerial: aerialRun });
  assert.ok(v.rows.every(r => r.status === 'external'));
  assert.match(v.rows[0].via, /--aerial/);
});
test('--aerial evaluates the rows from the aerial-pan summary at the run device; a device-keyed budget picks its side', () => {
  const v = evaluate(aerialBudgets, { ...good, aerial: aerialRun }, { aerial: true });
  const by = Object.fromEntries(v.rows.map(r => [r.key, r]));
  assert.equal(by.aerialLandmarksMax.over, true);
  assert.equal(by.aerialHeapGrowthPct.over, false);
  assert.equal(by.aerialCoarseFadeIns.measured, 600);
  assert.equal(by.aerialGameFrameWorstSumMs.measured, 200);
  assert.equal(by.aerialGameFrameWorstSumMs.over, false);
  assert.equal(by.aerialLabelChurnPerSec.status, 'external');
  assert.deepEqual(v.over, ['aerialLandmarksMax']);
  const iph = evaluate(aerialBudgets, { ...good, aerial: aerialRun }, { aerial: true, device: 'iphone' });
  assert.deepEqual(iph.over.sort(), ['aerialLandmarksMax', 'farShellCellsMax']);
});
test('--aerial with a missing summary key fails loudly instead of passing', () => {
  const run = structuredClone(aerialRun); delete run.summary.aerialP99Ms;
  const v = evaluate(aerialBudgets, { ...good, aerial: run }, { aerial: true });
  assert.deepEqual(v.naKeys, ['aerialP99Ms']); assert.equal(v.exitCode, 1);
  assert.deepEqual(evaluate(aerialBudgets, good, { aerial: true }).naKeys.sort(), Object.keys(AERIAL_ROWS).filter(k => k in aerialBudgets).sort());
});
test('every real aerial/farShell row is either an AERIAL_ROWS getter or the one named external', async () => {
  const fs = await import('node:fs');
  const real = JSON.parse(fs.readFileSync(new URL('./budgets.json', import.meta.url), 'utf8')).entries;
  const keys = Object.keys(real).filter(k => /^(aerial|farShell)/.test(k));
  assert.equal(keys.length, 13);
  assert.deepEqual(keys.filter(k => !(k in AERIAL_ROWS)), ['aerialLabelChurnPerSec']);
});
