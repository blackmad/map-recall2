// Buurt generator (docs/handoffs/buurt-generators-20261115.md): party-wall rows on one street, series by year and eaves
// with the lone-outlier clamp, described pands only break a row, deterministic output, and the kit flag that leaves the
// bay table unchanged when off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { districtRows, type GenPand, type GenStreet } from './rows.js';
import { baysFor, generateDistrict, pitchedVariantOf, seriesSlot, storeysFor, type DistrictLibrary } from './generate.js';
import { BAY_STYLES, PLAN_ZUID_CASEMENT } from '../bayLook.js';

// A straight east-west street at lat 52.345; pands 7 m wide and 10 m deep on its north side, party walls touching.
const LAT0 = 52.345, LNG0 = 4.9, M_LAT = 1 / 111_320, M_LNG = 1 / (111_320 * Math.cos(LAT0 * Math.PI / 180));
const at = (x: number, y: number) => [LNG0 + x * M_LNG, LAT0 + y * M_LAT] as const;
const pand = (i: number, year: number, eavesM: number): GenPand => {
  const x0 = i * 7, y0 = 6;
  return { id: `NL.IMBAG.Pand.03631000120000${String(i).padStart(2, '0')}`, ring: [at(x0, y0), at(x0 + 7, y0), at(x0 + 7, y0 + 10), at(x0, y0 + 10), at(x0, y0)], year, eavesM, ridgeM: eavesM + 4 };
};
const streets: GenStreet[] = [{ name: 'Teststraat', path: [at(-20, 0), at(120, 0)] }];
const lib = JSON.parse(fs.readFileSync(new URL('./districts/rivierenbuurt.json', import.meta.url), 'utf8')) as DistrictLibrary;

test('one row on the street, split into series at a year step; a lone eaves outlier is clamped, not split', () => {
  const pands = [pand(0, 1929, 12.4), pand(1, 1929, 12.5), pand(2, 1929, 13.9), pand(3, 1929, 12.3), pand(4, 1933, 12.4), pand(5, 1933, 12.6)];
  const { rows } = districtRows(pands, streets);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.street, 'Teststraat');
  assert.deepEqual(row.members.map(m => m.pand.id.slice(-2)), ['00', '01', '02', '03', '04', '05'], 'street order, left to right');
  assert.deepEqual(row.series.map(s => s.members.length), [4, 2]);
  assert.deepEqual(row.series[0].clamped, [pands[2].id]);
  assert.equal(row.series[0].eavesM, 12.45);
});

test('storeys and bays from the district cell', () => {
  assert.equal(storeysFor(12.4, lib.design), 4);
  assert.equal(storeysFor(9.2, lib.design), 3);
  assert.equal(baysFor(8.1, lib.design), 4);
  assert.equal(baysFor(2.5, lib.design), 2);
});

test('described pands never enter a row and only break it; output is deterministic', () => {
  const pands = Array.from({ length: 7 }, (_, i) => pand(i, 1929, 12.4));
  const described = new Set([pands[3].id.replace(/^NL\.IMBAG\.Pand\./, '')]);
  const a = generateDistrict(lib, pands, streets, described, '2026-11-15');
  const b = generateDistrict(lib, [...pands].reverse(), streets, described, '2026-11-15');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.rows.length, 2);
  assert.ok(a.rows.every(r => !r.members.some(m => described.has(m.pandId))));
  assert.deepEqual(a.skipped, [{ id: [...described][0], reason: 'described' }]);
  // Every stated field is the district's period default with its ref; one design per series.
  const d = a.rows[0].series[0].design;
  assert.equal(d.storeys.value, 4);
  assert.equal(d.windows.value, 'casement-toplight');
  assert.ok(Object.values(d).every(f => (f as { source: string }).source === 'period-default'));
  assert.equal(a.records.length, 6);
  assert.equal(new Set(a.records.filter(r => a.rows[0].members.some(m => m.pandId === r.pandId)).map(r => JSON.stringify(r.series))).size, 1);
});

test('kit flag off: the school bay presets are unchanged; on: the Plan Zuid casement and its paired variant are appended', () => {
  assert.ok(!BAY_STYLES.school.includes(PLAN_ZUID_CASEMENT));
  const probe = `import { BAY_STYLES, PLAN_ZUID_CASEMENT } from './src/canalRecall/bayLook.ts'; console.log(JSON.stringify([BAY_STYLES.school.length, BAY_STYLES.school.at(-2) === PLAN_ZUID_CASEMENT]));`;
  const run = (env: Record<string, string>) => JSON.parse(spawnSync('node', ['--import', 'tsx', '--input-type=module', '-e', probe], { encoding: 'utf8', env: { ...process.env, BUURT_KIT: '', ...env } }).stdout.trim());
  const off = run({}), on = run({ BUURT_KIT: '1' });
  assert.deepEqual(off, [BAY_STYLES.school.length, false]);
  assert.deepEqual(on, [BAY_STYLES.school.length + 2, true]);
});

test('the orthophoto slot picks the pitched variant: slate the Rooseveltlaan eaves, tile or unread the Plan Zuid tiles', () => {
  const withSlot = (slots: Array<string | null>) => districtRows(slots.map((sl, i) => ({ ...pand(i, 1929, 12.4), roofSlot: sl })), streets).rows[0].series[0];
  const slate = withSlot(['slate', 'slate', 'pantile-red']);
  assert.equal(seriesSlot(slate), 'slate');
  assert.equal(pitchedVariantOf(lib, slate), lib.pitchedEaves);
  assert.equal(pitchedVariantOf(lib, withSlot(['pantile-red', 'pantile-red', 'slate'])), lib.pitched);
  const unread = withSlot([null, null, null]);
  assert.equal(seriesSlot(unread), null);
  assert.equal(pitchedVariantOf(lib, unread), lib.pitched);
});

test('the front runs on to its own corner where the neighbour overlaps a strip of it (Rooseveltlaan 080196)', () => {
  // Pand 0's front is split at x = 6.36; its last 0.64 m is also the neighbour's front (the neighbour's outline takes a
  // 0.64 x 0.5 m corner of it, so that strip of front edge is shared and the walk along the front stops there).
  const p0: GenPand = { id: 'NL.IMBAG.Pand.0363100012000000', ring: [at(0, 6), at(6.36, 6), at(7, 6), at(7, 16), at(0, 16), at(0, 6)], year: 1929, eavesM: 12.4, ridgeM: 16.4 };
  const p1: GenPand = { id: 'NL.IMBAG.Pand.0363100012000001', ring: [at(6.36, 6), at(14, 6), at(14, 16), at(7, 16), at(7, 6.5), at(6.36, 6.5), at(6.36, 6)], year: 1929, eavesM: 12.4, ridgeM: 16.4 };
  const p2: GenPand = { ...pand(2, 1929, 12.4) };
  const { rows } = districtRows([p0, p1, p2], streets);
  assert.equal(rows.length, 1, JSON.stringify(rows.map(r => r.members.length)));
  const m0 = rows[0].members.find(m => m.pand.id === p0.id)!;
  assert.equal(m0.front.lengthM, 7, 'the whole front, not 6.36 m');
});
