// Route C completer (houseSpec/complete.ts): a D1 part completed into a canal-house intent, every unstated field filled from a
// twin, a geometry-corroborated reading, the structure prior or the family default, each fill with its source; gates clamp
// or drop what the geometry cannot hold. Fixtures are the real staged parts of the Weteringschans bake-off row.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { completeSpec, cOnlyFields, cEligible, familyOf, drawFrom, scaleBucket, type CompleteInput, type Geometry, type FamilyTable } from './complete.ts';
import FAMILY_TABLE from './family-defaults.json' with { type: 'json' };
import type { HouseSpec } from './spec.ts';

const STAGED = path.resolve(import.meta.dirname, '../../../artifacts/describer-d1/staged-ah07');
const spec = (id: string): HouseSpec => JSON.parse(fs.readFileSync(path.join(STAGED, `03631000121${id}.json`), 'utf8'));
// 168094: 1870, Weteringschans, eaves 16.4 m, 6.8 m wide, a 4.2 m crown over the eaves (3DBAG), describer crown `point`.
const G168094: Geometry = { year: 1870, lng: 4.89494, lat: 52.35957, eavesM: 16.4, widthM: 6.82, crownRiseM: 4.2 };
const run = (over: Partial<CompleteInput> & { spec: HouseSpec }) => completeSpec({ street: 'Weteringschans', geometry: G168094, ...over });
const fillOf = (c: ReturnType<typeof completeSpec>, p: string) => c.fills.filter(f => f.path === p).at(-1);

test('families: PR1 build-year buckets', () => {
  assert.equal(familyOf(1870), '1800-1879');
  assert.equal(familyOf(1880), '1880-1919');
  assert.equal(familyOf(1650), 'before-1800');
  assert.equal(familyOf(null), 'unknown');
});

test('168094: the read point gable survives when 3DBAG shows a crown (the prototype drew a cornice)', () => {
  const c = run({ spec: spec('68094'), answer: { crown: 'point' } });
  assert.ok(c.intent, c.error ?? '');
  assert.equal(c.intent!.fronts[0].gable, 'point');
  assert.equal(fillOf(c, 'fronts/0/gable')!.source, 'reading+geometry');
  // Without the crown in 3DBAG the reading is not enough: the family's level crown.
  const flat = run({ spec: spec('68094'), answer: { crown: 'point' }, geometry: { ...G168094, crownRiseM: 0.4 } });
  assert.equal(flat.intent!.fronts[0].gable, 'cornice');
  assert.equal(fillOf(flat, 'fronts/0/gable')!.source, 'family');
});

test('every field the part does not state carries a source; stated fields keep their receipt', () => {
  const c = run({ spec: spec('68094'), answer: { crown: 'point' } });
  const stated = c.fills.filter(f => f.source === 'stated').map(f => f.path);
  for (const p of ['fronts/0/storeys', 'fronts/0/bays', 'fronts/0/souterrain', 'palette/brick']) assert.ok(stated.includes(p), p);
  for (const p of ['fronts/0/windows', 'fronts/0/hoist', 'fronts/0/basement', 'roof/material', 'palette/frame', 'palette/door']) {
    const f = fillOf(c, p);
    assert.ok(f && f.source !== 'stated' && f.ref, p);
  }
  // A souterrain needs a basement: the family's souterrain basement, not `none`.
  assert.equal(c.intent!.fronts[0].basement, 'stoop-and-windows');
});

test('speklagen: the spacing is the measured family median, not the prototype\'s fixed 7 courses', () => {
  const s = spec('71218');
  s.provenance['fronts/0/bands'] = { ...s.provenance['fronts/0/bands'], confidence: 0.7 };
  const c = run({ spec: s, geometry: { ...G168094, year: 1882 } });
  assert.ok(c.intent, c.error ?? '');
  assert.equal(c.intent!.fronts[0].bands, 'speklagen');
  assert.ok(c.intent!.fronts[0].speklagen!.spacing >= 10, `spacing ${c.intent!.fronts[0].speklagen!.spacing}`);
  assert.equal(fillOf(c, 'fronts/0/speklagen')!.source, 'family');
});

test('a whole-wall pattern read at low confidence is dropped and logged; the rest compiles', () => {
  const s = spec('71218');
  s.provenance['fronts/0/bands'] = { ...s.provenance['fronts/0/bands'], confidence: 0.35 };
  const c = run({ spec: s, geometry: { ...G168094, year: 1882 } });
  assert.ok(c.intent);
  assert.equal(c.intent!.fronts[0].bands, undefined);
  assert.equal(c.intent!.fronts[0].speklagen, undefined);
  assert.ok(c.drops.some(d => d.gate === 'pattern-confidence' && d.path === 'fronts/0/bands'));
});

test('facts.pui shop becomes a shopfront (the prototype ignored facts)', () => {
  const s = spec('68094');
  s.facts = { ...s.facts, pui: 'shop' };
  const c = run({ spec: s });
  assert.ok(c.intent!.fronts[0].shopfront);
  assert.match(fillOf(c, 'fronts/0/shopfront')!.ref, /facts\/pui shop/);
  assert.ok(cOnlyFields(s).includes('shop'));
});

test('gates: storeys the eaves cannot hold are clamped, bays the width cannot hold are clamped', () => {
  const s = spec('68094');
  s.design.fronts![0].storeys = 9;
  s.design.fronts![0].bays = 9;
  const c = run({ spec: s, answer: { crown: 'point' } });
  assert.ok(c.intent);
  const st = c.drops.find(d => d.path === 'fronts/0/storeys');
  assert.equal(st?.gate, 'storey-pitch');
  const pitch = 16.4 / ((c.intent!.fronts[0].storeys) + 0.6);
  assert.ok(pitch >= 2.3 && pitch <= 5.2, `pitch ${pitch}`);
  assert.equal(c.drops.find(d => d.path === 'fronts/0/bays')?.gate, 'bay-pitch');
  assert.ok(6.82 / (c.intent!.fronts[0].bays as number) >= 1.1);
});

test('a raised gable with no crown in 3DBAG is clamped to a cornice', () => {
  const s = spec('68094');
  s.design.fronts![0].gable = 'step';
  s.provenance['fronts/0/gable'] = { source: 'vision-judge', confidence: 0.7, ref: 'x', at: '2026-11-13' };
  const c = run({ spec: s, geometry: { ...G168094, crownRiseM: 0.3 } });
  assert.equal(c.intent!.fronts[0].gable, 'cornice');
  assert.equal(c.drops.find(d => d.path === 'fronts/0/gable')?.gate, 'crown-room');
});

test('twin: unstated fields come from the twin\'s stated ones, the door mirrored', () => {
  const me = spec('68094'), twin = spec('68095');
  delete me.design.fronts![0].storeys; delete me.provenance['fronts/0/storeys'];
  twin.design.fronts![0].doorBay = 0;
  twin.provenance['fronts/0/doorBay'] = { source: 'vision-judge', confidence: 0.7, ref: 'x', at: '2026-11-13' };
  const c = run({ spec: me, answer: { crown: 'point' }, twin: { pandId: twin.pandId, spec: twin, mirrored: true } });
  assert.equal(fillOf(c, 'fronts/0/storeys')!.source, 'twin');
  assert.equal(c.intent!.fronts[0].storeys, twin.design.fronts![0].storeys);
  assert.equal(c.intent!.fronts[0].doorBay, (me.design.fronts![0].bays as number) - 1);
});

test('no reading, no twin: storeys and bays from the structure prior', () => {
  const s = spec('68094');
  delete s.design.fronts![0].storeys; delete s.design.fronts![0].bays;
  const c = run({ spec: s });
  assert.equal(fillOf(c, 'fronts/0/storeys')!.source, 'prior');
  assert.equal(fillOf(c, 'fronts/0/bays')!.source, 'prior');
});

test('C eligibility counts the fields A ignores', () => {
  const s = spec('68094');
  // 168094's courses were read low (confidence 0.35): only the souterrain counts, so it is not C-eligible on its staged part.
  assert.deepEqual(cOnlyFields(s), ['souterrain']);
  assert.equal(cEligible(s), false);
  assert.deepEqual(cOnlyFields(spec('71218')), ['bands', 'souterrain']);
  assert.equal(cEligible(spec('71218')), true);
  const plain: HouseSpec = { schemaVersion: 1, pandId: s.pandId, design: { fronts: [{ storeys: 3, bays: 3 }] }, provenance: {} };
  assert.equal(cEligible(plain), false);
});

test('a level crown read (mansard) or a level 3DBAG profile never gets a family raised gable', () => {
  const s = spec('71218');
  const g = { ...G168094, year: 1882, crownRiseM: 2.8 };
  assert.equal(completeSpec({ spec: s, street: 'Weteringschans', geometry: g, answer: { crown: 'mansard' } }).intent!.fronts[0].gable, 'cornice');
  assert.equal(completeSpec({ spec: s, street: 'Weteringschans', geometry: { ...g, crownPeaked: false } }).intent!.fronts[0].gable, 'cornice');
  const c = completeSpec({ spec: s, street: 'Weteringschans', geometry: { ...g, crownPeaked: true } });
  assert.ok(['spout', 'neck', 'raised-neck', 'bell', 'step', 'point', 'shouldered'].includes(c.intent!.fronts[0].gable as string));
  assert.ok(completeSpec({ spec: s, street: 'Weteringschans', geometry: g, answer: { crown: 'mansard' } }).limits.some(l => l.component === 'roof'));
});

test('street template: dressings fill with the template house id, structure never, a read `none` band is kept', () => {
  const T = { v: 2, rows: [{ p: '0000000000000007', x: G168094.lng, y: G168094.lat + 0.0003, yr: 1872, st: 'Weteringschans', src: 'author',
    f: { 'fronts/0/windowSurround': 'stone-lintel', 'fronts/0/bands': 'storey', 'fronts/0/cornice': 'bracketed', 'palette/frame': 'white' } }] };
  const s = spec('68043');
  const c = run({ spec: s, templates: T, answer: { crown: 'cornice' } });
  assert.equal(c.intent!.fronts[0].windowSurround, 'stone-lintel');
  assert.match(fillOf(c, 'fronts/0/windowSurround')!.ref, /^template:0000000000000007/);
  assert.equal(fillOf(c, 'fronts/0/cornice')!.source, 'template');
  assert.equal(fillOf(c, 'fronts/0/storeys')!.source, 'stated');
  assert.ok(!c.fills.some(f => f.source === 'template' && /storeys|bays|gable|souterrain|basement|roof\//.test(f.path)));
  const none = run({ spec: s, templates: T, answer: { crown: 'cornice', bands: 'none' } });
  assert.equal(none.intent!.fronts[0].bands, undefined);
  assert.equal(run({ spec: s, templates: null }).fills.filter(f => f.source === 'template').length, 0);
});

// Round 3 ruling, rule 2: the family dressing is a DRAW per group of similar adjoining fronts, never the mode; a split cell
// (band x class x scale, band x class) once it holds n >= 20; a main-street front with no template keeps today's look until then.
const draws = (over: Record<string, Record<string, { n: number; dist: [unknown, number][] }>>) =>
  ({ table: (FAMILY_TABLE as unknown as FamilyTable).table, draws: over }) as FamilyTable;
const SURR = { n: 100, dist: [['sill', 50], ['keystone', 30], ['stone-lintel', 20]] as [unknown, number][] };

test('rule 2: one draw per group (a row stays coherent), different groups differ, never only the mode', () => {
  const fam = draws({ '1800-1879': { windowSurround: SURR }, '1800-1879|side': { windowSurround: SURR } });
  const s = spec('68043');
  const a = run({ spec: s, families: fam, templates: null, street: 'Den Texstraat', group: 'row-A' });
  const b = run({ spec: { ...s, pandId: '0363100012999998' }, families: fam, templates: null, street: 'Den Texstraat', group: 'row-A' });
  assert.equal(a.intent!.fronts[0].windowSurround, b.intent!.fronts[0].windowSurround);
  assert.match(fillOf(a, 'fronts/0/windowSurround')!.ref, /^family draw 1800-1879\|side \(n 100/);
  const seen = new Set<unknown>();
  for (let i = 0; i < 40; i++) seen.add(run({ spec: s, families: fam, templates: null, street: 'Den Texstraat', group: `g${i}` }).intent!.fronts[0].windowSurround);
  assert.ok(seen.size >= 3, [...seen].join());
  assert.equal(drawFrom([['x', 1]], 'anything'), 'x');
});

test('rule 2: a main-street front with no template keeps today\'s look while its cell holds n < 20; a full cell draws', () => {
  const s = spec('68043');
  const small = draws({ '1800-1879': { windowSurround: SURR }, '1800-1879|main': { windowSurround: { n: 12, dist: [['keystone', 12]] } } });
  const kept = run({ spec: s, families: small, templates: null, streetClass: 'main', scale: { heightM: 16.6, widthM: 6.8 } });
  assert.equal(kept.intent!.fronts[0].windowSurround, undefined);
  assert.equal(fillOf(kept, 'fronts/0/windowSurround')!.source, 'today');
  // The required cornice is never left to today: it draws from the band.
  assert.equal(fillOf(kept, 'fronts/0/cornice')!.source, 'family');
  const full = draws({ '1800-1879|main|h13-17': { windowSurround: { n: 25, dist: [['stone-lintel', 25]] } } });
  const drawn = run({ spec: s, families: full, templates: null, streetClass: 'main', scale: { heightM: 16.6, widthM: 6.8 } });
  assert.equal(drawn.intent!.fronts[0].windowSurround, 'stone-lintel');
  assert.match(fillOf(drawn, 'fronts/0/windowSurround')!.ref, /1800-1879\|main\|h13-17/);
  assert.equal(scaleBucket(16.6), 'h13-17');
  assert.equal(scaleBucket(null), null);
  // A side-street front with a small cell draws from the band.
  const side = run({ spec: s, families: small, templates: null, streetClass: 'side' });
  assert.equal(fillOf(side, 'fronts/0/windowSurround')!.ref.startsWith('family draw 1800-1879 '), true);
});

test('rule 1 in the completer: the pinned Weteringschans front takes no template from the low Den Texstraat houses', () => {
  const T = { v: 2, rows: [{ p: '0000000000000011', x: G168094.lng + 0.001, y: G168094.lat, yr: 1876, st: 'Den Texstraat', c: 'side' as const, h: 11, w: 6.1, src: 'streetlevel-measured', f: { 'fronts/0/windowSurround': 'sill' } }] };
  const c = run({ spec: spec('68043'), templates: T, streetClass: 'main', scale: { heightM: 16.6, widthM: 6.8 } });
  assert.ok(!c.fills.some(f => f.source === 'template'));
});
