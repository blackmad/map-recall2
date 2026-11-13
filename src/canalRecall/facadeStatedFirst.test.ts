import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExtraSink, EXTRA_BUDGET, buildingWallExtras, extraUsage, type ExtraContext } from './facadeExtras.js';

// Weteringschans 0363100012171192 (lane WG step 3): four door-allowed walls; two short ones dressed first and spent the
// building budget, so the stated bands never reached the 6.3 m front. Stated parts now dress on every wall first.
const wall = (key: string, len: number, over: Partial<ExtraContext> = {}): ExtraContext => ({
  id: 'NL.IMBAG.Pand.0363100012171192', style: 'c19', period: 'c19', wallKey: key, f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len }, base: 0, top: 14.6,
  layout: { bays: Math.max(1, Math.round(len / 2.1)), bayWidthM: len / Math.max(1, Math.round(len / 2.1)), groundM: 5.28, storeys: 2, storeyM: 4.09, doorBays: [0] },
  wallHex: '#3e3632', accentHex: '#ffffff', groundLevel: true, streetSide: true, ...over,
});
const run = (contexts: ExtraContext[]) => {
  const used = new Map<string, readonly string[]>(), prev = extraUsage.record;
  try { extraUsage.record = (c, u) => { used.set(c.wallKey, u); }; const sink = new ExtraSink(EXTRA_BUDGET.building); buildingWallExtras(contexts, sink); return { used, tris: sink.tris.length }; }
  finally { extraUsage.record = prev; }
};

test('stated parts reach every wall before the dice trim spends the building budget', () => {
  const force = ['floor-cornices', 'string-courses'];
  const walls = (stated: boolean) => ['a:3.4', 'b:2.9', 'c:8.0', 'front:6.3'].map(s => { const [k, l] = s.split(':'); return wall(k, Number(l), { registerForce: force, bandM: 0.16, ...(stated ? { statedFirst: force } : {}) }); });
  const before = run(walls(false)), after = run(walls(true));
  assert.ok(!before.used.get('front')!.includes('floor-cornices'), 'the fixture reproduces the starved front');
  for (const k of ['a', 'b', 'c', 'front']) for (const id of force) assert.ok(after.used.get(k)!.includes(id), `${k}: ${id}`);
  assert.ok(after.tris <= EXTRA_BUDGET.building, 'within the unchanged building budget');
  for (const [, u] of after.used) assert.equal(new Set(u).size, u.length, 'never drawn twice');
});
