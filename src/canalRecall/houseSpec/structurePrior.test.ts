// Structure prior (houseSpec/structurePrior.ts, lane PR1): a generic pre-war pand with no stated count guesses its street
// run's window columns (by default) and storeys (`=storeys|all`) from the read houses around it; `=0` nothing changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURE_PRIOR_TABLE, resetStructurePriorFlag, structureGuess, structurePriorMode, structurePriorOn, structurePriorStoreys, type PriorRow, type StructurePriorTable } from './structurePrior.ts';
import { meshBuildingFor, buildFeatureChunk } from '../threeBuildingFeatures.ts';
import { layoutProbe, type LayoutProbeRun } from '../threeBuildingMesh.ts';

const withFlag = <T>(v: string | undefined, f: () => T): T => {
  const prev = process.env.STRUCTURE_PRIOR;
  if (v === undefined) delete process.env.STRUCTURE_PRIOR; else process.env.STRUCTURE_PRIOR = v;
  resetStructurePriorFlag();
  try { return f(); } finally { if (prev === undefined) delete process.env.STRUCTURE_PRIOR; else process.env.STRUCTURE_PRIOR = prev; resetStructurePriorFlag(); }
};

test('the flag: columns by default; =storeys|all|1 adds storeys; =0 turns it off; the query wins', () => {
  assert.equal(structurePriorMode(null, null), 'columns');
  assert.equal(structurePriorMode('?world=live&structurePrior=storeys', null), 'all');
  assert.equal(structurePriorMode(null, 'all'), 'all');
  assert.equal(structurePriorMode(null, '1'), 'all');
  assert.equal(structurePriorMode(null, '0'), 'off');
  assert.equal(structurePriorMode('?structurePrior=0', 'all'), 'off');
  assert.equal(structurePriorMode('?structurePrior=columns', '0'), 'columns');
  assert.equal(withFlag(undefined, structurePriorOn), true);
  assert.equal(withFlag(undefined, structurePriorStoreys), false);
  assert.equal(withFlag('0', structurePriorOn), false);
  assert.equal(withFlag('all', structurePriorStoreys), true);
});

const P = { k: 3, yearScale: 25, sizeScale: 0.5, distanceScale: 0 };
const table = (rows: PriorRow[]): StructurePriorTable => ({ v: 1, maxYear: 1945, storeys: P, columns: P, rows });

test('the guess is the most common count of the nearest read houses in year and size', () => {
  const t = table([
    [4.89, 52.36, 1877, 14.3, 6.5, 4, 3], [4.89, 52.36, 1878, 14.6, 6.4, 4, 3], [4.89, 52.36, 1875, 14.0, 6.6, 5, 2],
    [4.89, 52.36, 1880, 9.0, 12.0, 3, 6], [4.89, 52.36, 1700, 14.3, 6.5, 5, 2],
  ]);
  assert.deepEqual(structureGuess({ lng: 4.89, lat: 52.36, year: 1877, exposedM: 14.3, widthM: 6.5 }, t), { storeys: 4, columns: 3 });
  assert.equal(structureGuess({ lng: 4.89, lat: 52.36, year: 1960, exposedM: 14.3, widthM: 6.5 }, t), null, 'post-war keeps its own grid');
  assert.equal(structureGuess({ lng: 4.89, lat: 52.36, year: null, exposedM: 14.3, widthM: 6.5 }, t), null, 'no year, no guess');
});

test('the published table: Weteringschans 0363100012171218 (1877, 14.3 m wall, 6.5 m run, its row held out) guesses 4 x 3', () => {
  assert.ok(STRUCTURE_PRIOR_TABLE.rows.length > 1000);
  assert.deepEqual(structureGuess({ lng: 4.8955059, lat: 52.3595446, year: 1877, exposedM: 14.32, widthM: 6.49 }), { storeys: 4, columns: 3 });
});

// One 1877 house, 6.5 m by 12 m, 16.65 m tall, on its own.
const kx = 111_320 * Math.cos(52.36 * Math.PI / 180), ky = 110_540;
const box = (w: number, d: number) => [[4.8955, 52.3595], [4.8955 + w / kx, 52.3595], [4.8955 + w / kx, 52.3595 + d / ky], [4.8955, 52.3595 + d / ky], [4.8955, 52.3595]];
const house = () => ({ type: 'Feature', properties: { id: 'NL.IMBAG.Pand.0363100099999999', height: 16.65, minHeight: 0, constructionYear: 1877, facade: 'c19-prior', facadeStyle: 'c19', sideColour: '#5a4436' }, geometry: { type: 'Polygon', coordinates: [box(6.5, 12)] } });

test('off: meshBuildingFor sets no prior; default: columns only; all: columns and storeys', () => {
  const off = withFlag('0', () => meshBuildingFor(house() as never, 'photo'));
  assert.equal(off?.structurePrior, undefined);
  const on = withFlag(undefined, () => meshBuildingFor(house() as never, 'photo'));
  assert.ok(on?.structurePrior && on.structurePrior.year === 1877);
  const probe = (flag: string | undefined) => {
    const runs: LayoutProbeRun[] = [];
    layoutProbe.sink = (_id, r) => runs.push(r);
    try { withFlag(flag, () => buildFeatureChunk([house()] as never, 'photo', 'walls')); } finally { layoutProbe.sink = undefined; }
    return runs;
  };
  assert.ok(!probe('0').some(r => r.fit === 'prior'), 'off: no run drew the prior');
  // With no street grid every wall is a door wall; the longest ground-level run carries the prior's fit.
  const cols = probe(undefined).filter(r => r.fit === 'prior'), all = probe('all').filter(r => r.fit === 'prior');
  assert.ok(cols.length && all.length, 'a run drew the prior');
  assert.deepEqual(cols.map(r => r.bays), all.map(r => r.bays), 'the same columns either way');
  assert.notDeepEqual(cols.map(r => r.storeys), all.map(r => r.storeys), 'storeys only with =all');
});

test('a stated count outranks the prior', () => {
  const spec = { ...house(), properties: { ...house().properties, specRecipe: { storeys: 6 } } };
  assert.equal(withFlag('all', () => meshBuildingFor(spec as never, 'photo'))?.structurePrior, undefined);
});

test('the indexed search finds what a full scan finds (published table, 400 random queries)', () => {
  const t = STRUCTURE_PRIOR_TABLE, KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
  const brute = (field: 5 | 6, size: 3 | 4, q: { lng: number; lat: number; year: number; size: number }, p: typeof t.storeys) => {
    const rows = t.rows.filter(r => r[field]);
    if (!rows.some(r => Math.abs(r[size] - q.size) <= 1.5)) return null;
    const best = rows.map(r => ({ v: r[field], d: Math.hypot((r[2] - q.year) / p.yearScale, (r[size] - q.size) / p.sizeScale) + (p.distanceScale > 0 ? Math.hypot((r[0] - q.lng) * KX, (r[1] - q.lat) * KY) / p.distanceScale : 0) }))
      .sort((a, b) => a.d - b.d).slice(0, p.k);
    const c = new Map<number, number>(); let mode = best[0].v, n = 0;
    for (const { v } of best) { const m = (c.get(v) ?? 0) + 1; c.set(v, m); if (m > n) { n = m; mode = v; } }
    return mode;
  };
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) {
    const q = { lng: 4.84 + rnd() * 0.1, lat: 52.34 + rnd() * 0.05, year: Math.floor(1600 + rnd() * 340), exposedM: 4 + rnd() * 20, widthM: 3 + rnd() * 25 };
    const g = structureGuess(q)!;
    assert.equal(g.storeys, brute(5, 3, { ...q, size: q.exposedM }, t.storeys), `storeys ${JSON.stringify(q)}`);
    assert.equal(g.columns, brute(6, 4, { ...q, size: q.widthM }, t.columns), `columns ${JSON.stringify(q)}`);
  }
});
