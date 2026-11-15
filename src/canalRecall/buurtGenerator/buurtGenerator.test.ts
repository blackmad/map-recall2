// Buurt generator (docs/handoffs/buurt-generators-20261115.md): party-wall rows on one street, series by year and eaves
// with the lone-outlier clamp, described pands only break a row, deterministic output, and the kit flag that leaves the
// bay table unchanged when off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { districtRows, type GenPand, type GenStreet } from './rows.js';
import { baysFor, generateDistrict, pitchGate, pitchedRiseOf, pitchedVariantOf, seriesSlot, storeysFor, wallHexOf, type DistrictLibrary } from './generate.js';
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

test('the eaves roof is drawn by a street note, not the slot; the slate slot draws the dark tile look', () => {
  const withSlot = (slots: Array<string | null>) => districtRows(slots.map((sl, i) => ({ ...pand(i, 1929, 12.4), roofSlot: sl })), streets).rows[0].series[0];
  const slate = withSlot(['slate', 'slate', 'pantile-red']);
  assert.equal(seriesSlot(slate), 'slate');
  // Slate alone (round 5 sample: dark tiles, dormers, cornice) is the pitched roof in the slate look, never the eaves.
  const pv = pitchedVariantOf(lib, slate)!;
  assert.deepEqual([pv.pitchDeg, pv.material, pv.roofHex, pv.eavesM], [lib.pitched!.pitchDeg, 'slate', lib.pitched!.slotLooks!.slate.roofHex, undefined]);
  assert.equal(pitchedVariantOf(lib, withSlot(['pantile-red', 'pantile-red', 'slate'])), lib.pitched);
  const unread = withSlot([null, null, null]);
  assert.equal(seriesSlot(unread), null);
  assert.equal(pitchedVariantOf(lib, unread), lib.pitched);
  // A street note measuring the eaves draws them whatever the slot.
  const noted: DistrictLibrary = { ...lib, streetNotes: { Teststraat: { eaves: true, evidence: 'test' } } };
  assert.equal(pitchedVariantOf(noted, withSlot(['pantile-red', null, null])), lib.pitchedEaves);
});

test("wall: the row's own photo wins over the family and the district (series photo > district pool)", () => {
  const fam = lib.families[0];
  assert.equal(wallHexOf(lib, fam, 'rooseveltlaan-146491').hex, lib.rowNotes!['rooseveltlaan-146491'].wall!.hex);
  assert.match(wallHexOf(lib, fam, 'rooseveltlaan-146491').evidence!, /row's own photo/);
  assert.equal(wallHexOf(lib, fam, 'teststraat-000000').hex, fam.design?.wall?.hex ?? lib.design.wall.hex);
  const res = generateDistrict({ ...lib, rowNotes: { 'teststraat-000000': { wall: { hex: '#a2694f', evidence: 'test' }, evidence: 'test' } } }, [0, 1, 2].map(i => pand(i, 1929, 12.4)), streets, new Set(), 'test');
  assert.deepEqual([...new Set(res.records.map(r => (r as { wall?: { hex?: string } }).wall?.hex))], ['#a2694f']);
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

test('round 7: the pitched roof needs a measured form: a flat note, a flat 3DBAG type or a note-only district draw flat', () => {
  const series = (code: number | null, street = 'Teststraat') => districtRows([0, 1, 2].map(i => ({ ...pand(i, 1929, 12.4), roofCode: code })), [{ ...streets[0], name: street }]).rows[0].series[0];
  assert.equal(pitchGate(lib, series(3)), null);
  assert.ok(pitchedRiseOf(lib, series(3)) !== null, 'slanted: pitched');
  assert.ok(pitchedRiseOf(lib, series(null)) !== null, 'unread: as before');
  assert.match(pitchGate(lib, series(1))!, /3DBAG roof type flat/);
  assert.equal(pitchedRiseOf(lib, series(1)), null);
  const noted: DistrictLibrary = { ...lib, streetNotes: { Teststraat: { roof: 'flat', evidence: 'test' } } };
  assert.equal(pitchedRiseOf(noted, series(3)), null);
  const only: DistrictLibrary = { ...lib, pitched: { ...lib.pitched!, streetNoteOnly: true } };
  assert.equal(pitchedRiseOf(only, series(3)), null);
  assert.ok(pitchedRiseOf({ ...only, streetNotes: { Teststraat: { roof: 'pitched', evidence: 'test' } } }, series(3)) !== null);
});

test('round 7: a row note sets the line and the entrances; a flat series under flatEaves draws the broad eaves', () => {
  const libF: DistrictLibrary = { ...lib, pitched: { ...lib.pitched!, streetNoteOnly: true }, flatEaves: { eavesM: 1, frieze: false, evidence: 'test' },
    rowNotes: { 'teststraat-000000': { topM: 15.4, entries: [{ a: 0.43, kind: 'gable-bay' }, { a: 0.4, kind: 'canopy' }], evidence: 'test' } } };
  const pands = [0, 1, 2].map(i => ({ ...pand(i, 1929, 12.4), roofCode: 3 }));
  const rid = districtRows(pands, streets).rows[0].id;
  const res = generateDistrict({ ...libF, rowNotes: { [rid]: libF.rowNotes!['teststraat-000000'] } }, pands, streets, new Set(), 'test');
  const kits = res.records.map(r => (r as { buurtKit?: { roof?: unknown; eaves?: unknown; entries?: Array<{ kind: string }> } }).buurtKit!);
  assert.deepEqual(kits.map(k => k.entries?.[0].kind), ['gable-bay', 'canopy', 'gable-bay']);
  assert.ok(kits.every(k => !k.roof && JSON.stringify(k.eaves) === JSON.stringify({ overhangM: 1, frieze: false })));
  assert.deepEqual([...new Set(res.rows[0].series.map(s => s.design.corniceTopM.value))], [15.4]);
});

test('round 8: the drawn rise is the seen rise (street note), else the cap; 3DBAG only gates it', () => {
  const series = (street = 'Teststraat') => districtRows([0, 1, 2].map(i => ({ ...pand(i, 1929, 12.4), roofCode: 3 })), [{ ...streets[0], name: street }]).rows[0].series[0];
  const bag = pitchedRiseOf({ ...lib, pitched: { ...lib.pitched!, capRiseM: undefined } }, series())!;
  assert.ok(bag > 2.5, 'uncapped: 3DBAG');
  assert.equal(pitchedRiseOf({ ...lib, pitched: { ...lib.pitched!, capRiseM: 1 } }, series()), 1);
  assert.equal(pitchedRiseOf({ ...lib, pitched: { ...lib.pitched!, capRiseM: 1 }, streetNotes: { Teststraat: { riseM: 1.3, evidence: 'test' } } }, series()), 1.3);
  // Under the gate it stays flat whatever the cap.
  assert.equal(pitchedRiseOf({ ...lib, pitched: { ...lib.pitched!, capRiseM: 1, minRiseM: 50 } }, series()), null);
});

test('round 9: the measured row brick sits under the row note and over the pool; AHN roof form gates the pitch', () => {
  const fam = lib.families[0];
  const read = { hex: '#8a7465', n: 2, of: 3, dates: 2, reads: [{ pano: 'p1', date: '2022-03-21', hex: '#8c7666' }, { pano: 'p2', date: '2021-04-28', hex: '#887264' }] };
  const m: DistrictLibrary = { ...lib, measured: { walls: { 'teststraat-000000': read, 'rooseveltlaan-146491': read } } };
  assert.equal(wallHexOf(m, fam, 'teststraat-000000').hex, '#8a7465');
  assert.match(wallHexOf(m, fam, 'teststraat-000000').evidence!, /2 of 3 reads agree \(2 capture dates/);
  assert.equal(wallHexOf(m, fam, 'rooseveltlaan-146491').hex, lib.rowNotes!['rooseveltlaan-146491'].wall!.hex, 'the row note wins');
  assert.equal(wallHexOf(m, fam, 'other-000000').hex, fam.design?.wall?.hex ?? lib.design.wall.hex, 'unmeasured: the pool');
  const pands = [0, 1, 2].map(i => ({ ...pand(i, 1929, 12.4), roofCode: 3 }));
  const s = districtRows(pands, streets).rows[0].series[0];
  const roofs = (form: 'flat' | 'pitched' | 'unclear') => Object.fromEntries(pands.map(p => [p.id.replace(/^NL\.IMBAG\.Pand\./, ''), { form, frontRiseM: 2, why: 'test' }]));
  const only: DistrictLibrary = { ...lib, pitched: { ...lib.pitched!, streetNoteOnly: true } };
  assert.equal(pitchedRiseOf(only, s), null, 'note-only, unmeasured: flat');
  assert.ok(pitchedRiseOf({ ...only, measured: { roofs: roofs('pitched') } }, s) !== null, 'AHN pitched: pitched without a note');
  assert.match(pitchGate({ ...lib, measured: { roofs: roofs('flat') } }, s)!, /AHN4 measures a flat top/);
  assert.equal(pitchGate({ ...lib, measured: { roofs: roofs('unclear') } }, s), null, 'unclear: 3DBAG decides');
  assert.equal(pitchGate({ ...lib, measured: { roofs: roofs('flat') }, streetNotes: { Teststraat: { roof: 'pitched', evidence: 'test' } } }, s), null, 'the street note wins');
});
