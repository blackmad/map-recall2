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
