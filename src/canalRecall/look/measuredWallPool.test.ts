// The measured wall pool (look/measuredWallPool.ts, lane W1): an unmeasured pre-1945 pand draws a measured neighbour's wall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MeasuredWallPool, POOL, PERIOD_LIST_MIN_N, lightnessDeciles, measuredPeriodList, measuredPoolWall, resetWallPoolFlag, wallPoolEnabled, wallPoolOn } from './measuredWallPool.ts';
import { hexToOklab } from '../houseSpec/wallColour.ts';
import { bayLookFor } from '../bayLook.ts';
import { buurtProfileAt } from '../buurtProfiles/data.ts';
import TABLE from './measured-wall-pool.json' with { type: 'json' };

const withFlag = <T>(v: string | undefined, f: () => T): T => {
  const prev = process.env.WALL_POOL;
  if (v === undefined) delete process.env.WALL_POOL; else process.env.WALL_POOL = v;
  resetWallPoolFlag();
  try { return f(); } finally { if (prev === undefined) delete process.env.WALL_POOL; else process.env.WALL_POOL = prev; resetWallPoolFlag(); }
};
// A row of measured walls 20 m apart along a street at Kinkerstraat's latitude (1e-5 deg lng ~ 0.68 m).
const row = (hexes: string[], arch = 1, lng0 = 486000, lat0 = 5236600) => hexes.map((h, i) => [lng0 + i * 30, lat0, h, arch] as const);

test('the flag: on by default; ?wallPool=0 or WALL_POOL=0 turns it off; the query wins', () => {
  assert.equal(wallPoolEnabled(null, null), true);
  assert.equal(wallPoolEnabled('?world=live&wallPool=0', null), false);
  assert.equal(wallPoolEnabled(null, '0'), false);
  assert.equal(wallPoolEnabled('?wallPool=1', '0'), true);
  assert.equal(withFlag('0', wallPoolOn), false);
  assert.equal(withFlag(undefined, wallPoolOn), true);
});

test('too few measured neighbours: null (the pand keeps its profile or period colour)', () => {
  const pool = new MeasuredWallPool({ points: row(['#4b3b32', '#47403a', '#423934']) });
  assert.equal(pool.wallFor(4.861, 52.366, 'c19', 7), null);
  assert.equal(pool.wallFor(4.861, 52.366, 'modern', 7), null, 'post-1945 is not pooled');
});

test('the pick comes from the walls nearest the pool median, never a painted outlier', () => {
  const browns = ['#4b3b32', '#47403a', '#423934', '#5a4436', '#503c30', '#4d4038', '#55453b', '#4a3a31', '#584236', '#46382f'];
  const pool = new MeasuredWallPool({ points: row([...browns, '#f0ece4', '#1c1c1c']) });
  const picks = new Set<string>();
  for (let s = 0; s < 64; s++) { const w = pool.wallFor(4.8603, 52.366, 'c19', s); assert.ok(w); picks.add(w!); }
  assert.ok(!picks.has('#f0ece4') && !picks.has('#1c1c1c'), 'white and black fronts stay with their own pands');
  const Ls = browns.map(h => hexToOklab(h)[0]).sort((a, b) => a - b);
  for (const p of picks) { const L = hexToOklab(p)[0]; assert.ok(L >= Ls[1] - 1e-9 && L <= Ls[Ls.length - 2] + 1e-9, p); }
  assert.ok(picks.size >= 2, 'neighbours do not all draw one colour');
});

test('a measured pand is not its own neighbour; another archetype fills in only when its own is short', () => {
  const pts = [...row(['#4b3b32', '#47403a', '#423934', '#5a4436', '#503c30', '#4d4038'], 0), ...row(['#a35042', '#ae6037', '#a35042', '#ae6037', '#a35042', '#ae6037'], 2, 486005)];
  const pool = new MeasuredWallPool({ points: pts });
  assert.ok(pool.near(4.86, 52.366).every(p => p.d > 0.5));
  const canal = pool.wallFor(4.8601, 52.366, 'canal', 3)!;
  assert.ok(['#4b3b32', '#47403a', '#423934', '#5a4436', '#503c30', '#4d4038'].includes(canal), 'own archetype first');
  assert.ok(pool.wallFor(4.8601, 52.366, 'c19', 3), 'c19 has no measured walls here: the pre-1945 neighbours of any archetype');
  assert.equal(POOL.minN <= 6, true);
});

test('the published table: measured period lists by OKLab lightness, no authored orange terracotta or slate grey', () => {
  withFlag(undefined, () => {
    for (const a of ['canal', 'c19', 'school'] as const) {
      const n = (TABLE as any).points.filter((p: any) => p[2] !== undefined && p[3] === ['canal', 'c19', 'school'].indexOf(a)).length;
      const list = measuredPeriodList(a);
      if (n < PERIOD_LIST_MIN_N) { assert.equal(list, null); continue; }
      assert.equal(list!.length, 10);
      const Ls = list!.map(h => hexToOklab(h)[0]);
      assert.deepEqual(Ls, [...Ls].sort((x, y) => x - y), `${a} ascending`);
      for (const h of ['#b05a40', '#bd6a45', '#3e4a40', '#5d605a']) assert.ok(!list!.includes(h), `${a} ${h}`);
    }
    assert.equal(measuredPeriodList('modern'), null);
  });
  withFlag('0', () => assert.equal(measuredPeriodList('c19'), null));
  assert.deepEqual(lightnessDeciles(['#000000', '#ffffff']).slice(0, 5), ['#000000', '#000000', '#000000', '#000000', '#000000']);
});

test('flag off: bayLookFor with a location is byte-identical to bayLookFor without one', () => {
  withFlag('0', () => {
    const at = [4.8667, 52.3662] as const, profile = buurtProfileAt(...at);
    for (const [id, year] of [['NL.IMBAG.Pand.0363100012172584', 1900], ['NL.IMBAG.Pand.0363100012176005', 1644], ['x1', 1925], ['x2', null]] as const) {
      const a = bayLookFor(id, year, 14, 'photo', 'quiet', undefined, undefined, profile), b = bayLookFor(id, year, 14, 'photo', 'quiet', undefined, undefined, profile, undefined, undefined, at);
      assert.deepEqual(b, a, id);
    }
  });
});

test('flag on: an unmeasured c19 pand among measured walls draws one of them, as a profile wall', () => {
  withFlag(undefined, () => {
    const at = [4.8667, 52.3662] as const; // Kinkerstraat: Oud-West spec readings all around
    const b = bayLookFor('NL.IMBAG.Pand.x-test', 1900, 14, 'photo', 'quiet', undefined, undefined, buurtProfileAt(...at), undefined, undefined, at);
    const w = measuredPoolWall(at[0], at[1], 'c19', 0);
    assert.ok(w, 'measured neighbours here');
    assert.equal(b.profileWall, b.wallHex);
    assert.ok((TABLE as any).points.some((p: any) => p[2] === b.wallHex), 'a measured wall');
    assert.equal(bayLookFor('NL.IMBAG.Pand.x-test', 1900, 14, 'storybook', 'quiet', undefined, undefined, null, undefined, undefined, at).wallHex,
      bayLookFor('NL.IMBAG.Pand.x-test', 1900, 14, 'storybook', 'quiet', undefined, undefined, null).wallHex, 'photo look only');
  });
});
