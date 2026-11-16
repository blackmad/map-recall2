// Buurt generator (docs/handoffs/buurt-generators-20261115.md): party-wall rows on one street, series by year and eaves
// with the lone-outlier clamp, described pands only break a row, deterministic output, and the kit flag that leaves the
// bay table unchanged when off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { districtRows, type GenPand, type GenStreet } from './rows.js';
import { baysFor, blockLines, generateDistrict, measuredRoofOf, pitchGate, pitchedRiseOf, streetPhotoWallOf, paintedPandOf, photoGableOf, pitchedVariantOf, seriesSlot, storeysFor, wallHexOf, warmWall, WALL_WARM, type DistrictLibrary } from './generate.js';
import { oklab } from '../retailPuiPaint.js';

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

test('kit flag off (BUURT_KIT=0): the school bay presets are the base set; default on: the Plan Zuid casement and its paired variant are appended', () => {
  const probe = `import { BAY_STYLES, PLAN_ZUID_CASEMENT } from './src/canalRecall/bayLook.ts'; console.log(JSON.stringify([BAY_STYLES.school.length, BAY_STYLES.school.includes(PLAN_ZUID_CASEMENT), BAY_STYLES.school.at(-2) === PLAN_ZUID_CASEMENT]));`;
  const run = (env: Record<string, string>) => JSON.parse(spawnSync('node', ['--import', 'tsx', '--input-type=module', '-e', probe], { encoding: 'utf8', env: { ...process.env, ...env } }).stdout.trim());
  const off = run({ BUURT_KIT: '0' }), on = run({ BUURT_KIT: '' });
  assert.equal(off[1], false);
  assert.deepEqual(on, [off[0] + 2, true, true]);
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
  assert.equal(wallHexOf(lib, fam, 'teststraat-000000').hex, warmWall((fam.design?.wall?.hex ?? lib.design.wall.hex)!));
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
  assert.equal(wallHexOf(m, fam, 'other-000000').hex, warmWall((fam.design?.wall?.hex ?? lib.design.wall.hex)!), 'unmeasured, no measured row on its street: the pool, warmed');
  assert.equal(wallHexOf(m, fam, 'teststraat-111111').hex, '#8a7465', 'unmeasured: its street\'s measured rows');
  assert.match(wallHexOf(m, fam, 'teststraat-111111').evidence!, /street's measured rows \(teststraat-000000\)/);
  // Round 11: a family the row's photo states beats the measured brick (Stadionkade 063989).
  const st: DistrictLibrary = { ...m, rowNotes: { ...m.rowNotes, 'teststraat-000000': { wallFamily: { family: 'dark-brown-brick', evidence: 'test' }, evidence: 'test' } } };
  assert.equal(wallHexOf(st, fam, 'teststraat-000000').family, 'dark-brown-brick');
  assert.notEqual(wallHexOf(st, fam, 'teststraat-000000').hex, '#8a7465');
  const pands = [0, 1, 2].map(i => ({ ...pand(i, 1929, 12.4), roofCode: 3 }));
  const s = districtRows(pands, streets).rows[0].series[0];
  const roofs = (form: 'flat' | 'pitched' | 'unclear') => Object.fromEntries(pands.map(p => [p.id.replace(/^NL\.IMBAG\.Pand\./, ''), { form, frontRiseM: 2, why: 'test' }]));
  const only: DistrictLibrary = { ...lib, pitched: { ...lib.pitched!, streetNoteOnly: true } };
  assert.equal(pitchedRiseOf(only, s), null, 'note-only, unmeasured: flat');
  assert.ok(pitchedRiseOf({ ...only, measured: { roofs: roofs('pitched') } }, s) !== null, 'AHN pitched: pitched without a note');
  assert.match(pitchGate({ ...lib, measured: { roofs: roofs('flat') } }, s)!, /AHN4 measures a flat top/);
  assert.equal(pitchGate({ ...lib, measured: { roofs: roofs('unclear') } }, s), null, 'unclear: 3DBAG decides');
  assert.equal(pitchGate({ ...lib, measured: { roofs: roofs('flat') }, streetNotes: { Teststraat: { roof: 'pitched', evidence: 'test' } } }, s), null, 'the street note wins');
  // The disagreement is logged (Achillesstraat: noted flat, AHN4 pitched).
  const res = generateDistrict({ ...lib, measured: { roofs: roofs('pitched') }, streetNotes: { Teststraat: { roof: 'flat', evidence: 'test' } } }, pands, streets, new Set(), 'test');
  assert.ok(res.rows[0].readNotDrawn.some(r => r.field === 'ahn-roof-form' && /street note's flat/.test(r.reason)), JSON.stringify(res.rows[0].readNotDrawn));
});

test('block lines: a 3DBAG step AHN does not see is one line (Hunzestraat 120343); a step AHN confirms stands', () => {
  // Five pands at 12.1 m, then two whose 3DBAG eaves read 6.2 m (a low rear part); AHN reads all seven 12.1 m at the front.
  const pands = [0, 1, 2, 3, 4].map(i => pand(i, 1934, 12.1)).concat([pand(5, 1934, 6.2), pand(6, 1934, 6.3)]);
  const { rows } = districtRows(pands, streets);
  assert.deepEqual(rows[0].series.map(s => s.eavesM), [12.1, 6.25], '3DBAG alone splits the block');
  const roofs = (front: (i: number) => number) => Object.fromEntries(pands.map((p, i) => [p.id.slice(-16), { form: 'flat' as const, frontRiseM: 0, eavesM: front(i), why: '' }]));
  const flat = { ...lib, measured: { roofs: roofs(() => 12.12) } };
  const { rows: fixed, clamped } = blockLines(flat, rows);
  assert.deepEqual(fixed[0].series.map(s => s.eavesM), [12.1, 12.1]);
  assert.deepEqual([...clamped.keys()], [pands[5].id.slice(-16), pands[6].id.slice(-16)]);
  // AHN reads a step too: it stands, at AHN's flat front (round 11 AHN_RAISE: 3DBAG's 6.25 m is a storey under it).
  const stepped = { ...lib, measured: { roofs: roofs(i => (i < 5 ? 12.12 : 9.3)) } };
  assert.deepEqual(blockLines(stepped, rows).rows[0].series.map(s => s.eavesM), [12.1, 9.3]);
  // A raise to a storey count the district has no family for keeps 3DBAG's line (no series dropped off-storeys).
  const tall = { ...lib, measured: { roofs: roofs(i => (i < 5 ? 12.12 : 30)) } };
  assert.deepEqual(blockLines(tall, rows).rows[0].series.map(s => s.eavesM), [12.1, 6.25]);
  // Round 11 (Pieter Lastmankade 115143): a small AHN step that agrees with 3DBAG's in sign, every read of the higher
  // series over the lower's median, is real: no clamp. The same step with an overlapping read is clamped.
  const two = [0, 1, 2, 3, 4].map(i => pand(i, 1922, 8.7)).concat([pand(5, 1922, 9.95), pand(6, 1922, 9.95)]);
  const r2 = districtRows(two, streets).rows;
  const roofs2 = (front: (i: number) => number) => Object.fromEntries(two.map((p, i) => [p.id.slice(-16), { form: 'flat' as const, frontRiseM: 0, eavesM: front(i), why: '' }]));
  assert.deepEqual(blockLines({ ...lib, measured: { roofs: roofs2(i => (i < 5 ? 8.77 : 9.17)) } }, r2).rows[0].series.map(s => s.eavesM), [8.7, 9.95]);
  assert.deepEqual(blockLines({ ...lib, measured: { roofs: roofs2(i => (i < 5 ? 8.77 : i === 5 ? 8.6 : 9.4)) } }, r2).rows[0].series.map(s => s.eavesM), [8.7, 8.7]);
  // No AHN: unchanged.
  assert.deepEqual(blockLines(lib, rows).rows[0].series.map(s => s.eavesM), [12.1, 6.25]);
});

test('De Pijp (round 14): a district that lists hidden-pitch fronts lifts the line to AHN, past one outlier read (Eerste Jacob van Campenstraat 157140)', () => {
  const pands = [0, 1, 2, 3, 4, 5, 6, 7].map(i => pand(i, 1934, 9.3));
  const { rows } = districtRows(pands, streets);
  const fronts = [9.3, 9.25, 9.35, 10.9, 9.3, 9.2, 9.3, 9.25];
  const roofs = Object.fromEntries(pands.map((p, i) => [p.id.slice(-16), { form: 'hidden-pitch' as const, frontRiseM: 3, eavesM: fronts[i] + 3, why: '' }]));
  const off = { ...lib, measured: { roofs } };
  assert.deepEqual(blockLines(off, rows).rows[0].series.map(s => s.eavesM), [9.3], 'unlisted: hidden pitch is not a front read (round 11)');
  const on = { ...off, design: { ...lib.design, ahnFrontForms: { forms: ['flat', 'hidden-pitch'] as Array<'flat' | 'hidden-pitch'>, evidence: 'test' } } };
  const { rows: lifted, clamped } = blockLines(on, rows);
  assert.deepEqual(lifted[0].series.map(s => s.eavesM), [12.3]);
  assert.match([...clamped.values()][0].why, /flat or hidden-pitch front at 12\.30 m on 8 of 8 members \(spread 0\.10 m\)/);
});

test('round 13: an unstated brick wall is never drawn grey; a warm one and a stated one are untouched', () => {
  const lch = (hex: string) => { const n = parseInt(hex.slice(1), 16), [L, a, b] = oklab(n >> 16, (n >> 8) & 255, n & 255); return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360]; };
  assert.equal(warmWall('#a2694f'), '#a2694f', 'Rooseveltlaan, warm already');
  for (const grey of ['#5b504a', '#5b4e47', '#6a6362', '#484a4c']) {
    const [L0] = lch(grey), [L, C, h] = lch(warmWall(grey));
    assert.ok(Math.abs(L - L0) < 0.01, `${grey} keeps its lightness`);
    assert.ok(C >= WALL_WARM.C - 0.002 && h >= WALL_WARM.h0 - 1 && h <= WALL_WARM.h1 + 1, `${grey} -> ${warmWall(grey)} (C ${C.toFixed(3)}, h ${h.toFixed(0)})`);
  }
  // A stated wall is drawn as stated.
  const st: DistrictLibrary = { ...lib, rowNotes: { ...lib.rowNotes, 'teststraat-000000': { wall: { hex: '#6a6362', evidence: 'test' }, evidence: 'test' } } };
  assert.equal(wallHexOf(st, null, 'teststraat-000000').hex, '#6a6362');
});

test('De Pijp (round 14): hidden pitches draw the roof storey where the library says so; a wide flat corner draws none (Eerste Jan Steenstraat 152914)', () => {
  const pands = [0, 1, 2, 3].map(i => pand(i, 1929, 12.4));
  const s = districtRows(pands, streets).rows[0].series[0];
  const roofs = (form: (i: number) => 'hidden-pitch' | 'pitched' | 'flat') => Object.fromEntries(pands.map((p, i) => [p.id.slice(-16), { form: form(i), frontRiseM: 1.5, why: '' }]));
  const hidden = { ...lib, measured: { roofs: roofs(() => 'hidden-pitch') } };
  assert.equal(measuredRoofOf(hidden, s), 'flat', 'unlisted: a hidden pitch is a flat top (round 9)');
  const on: DistrictLibrary = { ...hidden, pitched: { ...lib.pitched!, capRiseM: 1.2, hiddenPitch: { draws: 'roof-storey', evidence: 'test' } } };
  assert.equal(measuredRoofOf(on, s), 'pitched');
  assert.equal(pitchedRiseOf(on, s), 1.2);
  // The corner: the row's last member, 7 m wide here, reads hidden-pitch; with cornerFlat at 6 m it draws no roof storey.
  const corner: DistrictLibrary = { ...on, pitched: { ...on.pitched!, cornerFlat: { minWidthM: 6, evidence: 'test' } } };
  const recs = (l: DistrictLibrary) => generateDistrict(l, pands, streets, new Set(), 'test').records as Array<{ pandId: string; buurtKit?: { roof?: unknown }; series?: { roofStorey?: { kind: string } } }>;
  const a = recs(on), b = recs(corner);
  assert.ok(a.every(r => r.buurtKit?.roof && r.series?.roofStorey?.kind === 'mansard'));
  assert.deepEqual(b.map(r => r.series?.roofStorey?.kind), ['none', 'mansard', 'mansard', 'none']);
  assert.ok(!b[0].buurtKit?.roof && b[1].buurtKit?.roof);
  // A corner AHN reads pitched keeps it.
  const pitchedEnds: DistrictLibrary = { ...corner, measured: { roofs: roofs(i => (i === 0 || i === 3 ? 'pitched' : 'hidden-pitch')) } };
  assert.ok(recs(pitchedEnds).every(r => r.series?.roofStorey?.kind === 'mansard'));
});

test('De Pijp (round 14): the photo reader\'s family beats the pixel samples; a street agreeing on it fills its unread rows', () => {
  const fam = lib.families[0];
  const m: DistrictLibrary = { ...lib, rowNotes: {}, measured: { walls: { 'teststraat-111111': { hex: '#2e2d2c', n: 2, of: 2, dates: 2, reads: [] } },
    photoWalls: { 'teststraat-111111': { finish: 'brick', family: 'buff-brick', confidence: 0.85, pandId: '0363100012111111' }, 'teststraat-222222': { finish: 'brick', family: 'buff-brick', confidence: 0.8, pandId: '0363100012222222' }, 'teststraat-333333': { finish: 'brick', family: 'red-brown-brick', confidence: 0.5, pandId: '0363100012333333' } } } };
  const w = wallHexOf(m, fam, 'teststraat-111111');
  assert.equal(w.family, 'buff-brick'); assert.equal(w.material, 'brick'); assert.match(w.evidence!, /photo reader: brick buff-brick 0.85/);
  assert.equal(wallHexOf(m, fam, 'teststraat-333333').family, 'buff-brick', 'a low-confidence read takes the street');
  assert.deepEqual(streetPhotoWallOf(m, 'teststraat-444444')?.rows, ['teststraat-111111', 'teststraat-222222']);
  assert.equal(streetPhotoWallOf(m, 'anderestraat-111111'), null);
  // No reads: the pixel sample, warmed (round 13).
  assert.equal(wallHexOf({ ...m, measured: { walls: m.measured!.walls } }, fam, 'teststraat-111111').hex, warmWall('#2e2d2c'));
});

test('De Pijp (round 15) records: the painted house alone, the gable on its series without a mansard, the pitched AHN raise (Stadhouderskade 166429)', () => {
  const pands = [0, 1, 2, 3].map(i => pand(i, 1929, 12.4));
  const id = (i: number) => pands[i].id.slice(-16);
  const on: DistrictLibrary = { ...lib, pitched: { ...lib.pitched!, capRiseM: 1.2, hiddenPitch: { draws: 'roof-storey', evidence: 'test' } },
    measured: { roofs: Object.fromEntries(pands.map(p => [p.id.slice(-16), { form: 'hidden-pitch' as const, frontRiseM: 1.5, why: '' }])),
      photoReads: { [id(1)]: { finish: 'paint', family: 'white-paint', confidence: 0.8 } } } };
  type R = { pandId: string; wall: { hex: string }; crown: { family: string; riseM?: number }; topM: number; eavesM: number; series?: { roofStorey?: { kind: string } } };
  const recs = (l: DistrictLibrary) => generateDistrict(l, pands, streets, new Set(), 'test').records as R[];
  const a = recs(on);
  assert.ok(a[1].wall.hex !== a[0].wall.hex && a[0].wall.hex === a[2].wall.hex, 'only the read house is painted');
  const g = recs({ ...on, measured: { ...on.measured!, photoReads: { [id(2)]: { finish: 'brick', family: 'brown-brick', confidence: 0.8, crown: 'step', cornice: 'none', cc: 0.8 } } } });
  assert.ok(g.every(r => r.crown.family === 'step' && r.series?.roofStorey?.kind === 'none' && r.topM > r.eavesM + 2), 'one series: every member steps');
  // AHN reads the pitched roof's foot 2 m over the 3DBAG line: drawn there with pitchedRaiseM, not without.
  const pitched = { roofs: Object.fromEntries(pands.map(p => [p.id.slice(-16), { form: 'pitched' as const, frontRiseM: 4, eavesM: 14.4, why: '' }])) };
  const lo = recs({ ...lib, measured: pitched }), hi = recs({ ...lib, design: { ...lib.design, ahnFrontForms: { forms: ['flat'], evidence: 'test', pitchedRaiseM: 1.5 } }, measured: pitched });
  assert.ok(hi[0].eavesM - lo[0].eavesM > 1.5, `${lo[0].eavesM} -> ${hi[0].eavesM}`);
});

test('De Pijp (round 15): a painted read colours its own house, not the row (Stadhouderskade 158460); purple-brown draws dark brown; a confident gable read beats the mansard', () => {
  const fam = lib.families[0];
  const m: DistrictLibrary = { ...lib, rowNotes: {}, measured: { walls: {},
    photoWalls: { 'teststraat-111111': { finish: 'paint', family: 'dark-paint', confidence: 0.8, pandId: '0363100012098788' }, 'teststraat-222222': { finish: 'brick', family: 'purple-brown-brick', confidence: 0.7, pandId: '0363100012153112' } },
    photoReads: { '0363100012098788': { finish: 'paint', family: 'dark-paint', confidence: 0.8, crown: 'cornice', cornice: 'heavy', cc: 0.8 },
      '0363100012159333': { finish: 'brick', family: 'brown-brick', confidence: 0.7, crown: 'step', cornice: 'none', cc: 0.75 },
      '0363100012165460': { finish: 'brick', family: 'brown-brick', confidence: 0.75, crown: 'point', cornice: 'none', cc: 0.7 } } } };
  assert.notEqual(wallHexOf(m, fam, 'teststraat-111111').family, 'painted-dark', 'the row does not take a painted read');
  assert.equal(paintedPandOf(m, '0363100012098788')?.family, 'painted-dark');
  assert.equal(paintedPandOf(m, '0363100012159333'), null);
  assert.equal(wallHexOf(m, fam, 'teststraat-222222').family, 'dark-brown-brick');
  assert.equal(photoGableOf(m, '0363100012159333')?.family, 'step');
  assert.equal(photoGableOf(m, '0363100012165460'), null, 'under the crown bar');
});
