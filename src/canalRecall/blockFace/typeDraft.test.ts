/**
 * Type drafter (typeDraft.ts): clustering, refusal, storey profile, and the self-test on two hand-authored library types.
 *   node --import tsx --test src/canalRecall/blockFace/typeDraft.test.ts
 *
 * The self-test drafts from the pands an authored type is placed on (measures dumped by
 * `scripts/block-face/draft-type.ts --self-type=<id> --dump=<fixture>`, so the test needs no strips) and compares with the
 * authored numbers. The tolerances are fixed here, from what a strip can resolve (a front's colour moves with the
 * exposure of the capture day, BAG widths include merged pands), and the deltas are printed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {clusterFamilies, DRAFT, draftType, DraftRefused, inFamily, parseFamilyId, stat, storeyProfile, widthBand, type PandMeasure, type PandRecord} from './typeDraft.ts';
import {typeProblems, resolvePlacement} from './houseType.ts';
import {fileTypeLoader} from './typeLibrary.ts';

const fixture = (n: string): PandMeasure[] => JSON.parse(fs.readFileSync(`src/canalRecall/blockFace/fixtures/${n}`, 'utf8')).measures;
const authored = (id: string): any => fileTypeLoader()(id);
const rgbDist = (a: string, b: string) => { const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

const rec = (i: number, face: string, year: number, w = 5.5, st = 5): PandRecord => ({pandId: `0363${String(i).padStart(12, '0')}`, face, builtYear: year, storeys3dbag: st, frontWidthM: w, eavesM: 13});
const sample = (i: number, face: string, over: Partial<PandMeasure> = {}): PandMeasure => ({pandId: `0363${String(i).padStart(12, '0')}`, face, builtYear: 1912, storeys: 5, storeys3dbag: 5, widthM: 5.5, eavesM: 13, skylineEavesM: 13.1, crown: null, windowCols: 3, pitchColumns: 3, windowWidthM: 1.1, storey: null, glazing: 0.3,
  palette: {wall: '#80604a', accent: '#c8c4b4', frame: '#d4d0c0', band: null, cornice: '#a09a88', stucco: false}, bandRunsM: [], roofType: 'slanted', ...over});

test('width bands and family keys', () => {
  assert.equal(widthBand(4.2), '<4.9'); assert.equal(widthBand(5.5), '4.9-6.4'); assert.equal(widthBand(7), '6.4-8'); assert.equal(widthBand(9), '8+');
  const k = parseFamilyId('1910-1914:5:4.9-6.4');
  assert.ok(inFamily({builtYear: 1912, storeys3dbag: 5, frontWidthM: 5.5}, k));
  assert.ok(!inFamily({builtYear: 1915, storeys3dbag: 5, frontWidthM: 5.5}, k));
  assert.ok(!inFamily({builtYear: 1912, storeys3dbag: 4, frontWidthM: 5.5}, k));
  assert.throws(() => parseFamilyId('1910:5'), /expected/);
});

test('clusterFamilies groups by year bin x storeys x width band and drops pands without a face', () => {
  const ps = [...Array(9).keys()].map(i => rec(i, `f${i % 3}`, 1910 + (i % 5))).concat([rec(20, `f0`, 1920), rec(21, 'f1', 1912, 7.2), {...rec(22, 'x', 1912), face: null}]);
  const fams = clusterFamilies(ps);
  assert.equal(fams[0].id, '1910-1914:5:4.9-6.4');
  assert.equal(fams[0].pands.length, 9); assert.equal(fams[0].faces.length, 3);
  assert.ok(fams.every(f => !f.pands.some(p => p.face === null)));
  assert.equal(clusterFamilies(ps, {before: 1915}).some(f => f.key.yearFrom >= 1915), false);
});

test('refuses a family under 8 pands or on fewer than 3 faces', () => {
  const key = parseFamilyId('1910-1914:5:4.9-6.4'), o = {id: 'x', district: 'd', buurt: 'b', family: key};
  const seven = [...Array(7).keys()].map(i => sample(i, `f${i % 3}`));
  assert.throws(() => draftType(seven, o), (e: any) => e instanceof DraftRefused && /7 measured pands < 8/.test(e.message));
  const oneFace = [...Array(12).keys()].map(i => sample(i, 'f0'));
  assert.throws(() => draftType(oneFace, o), (e: any) => e instanceof DraftRefused && /1 block faces < 3/.test(e.message));
  assert.doesNotThrow(() => draftType([...Array(9).keys()].map(i => sample(i, `f${i % 3}`)), o));
});

test('a draft carries n and spread for the numbers it writes, lists what it did not measure, and validates as a type', () => {
  const key = parseFamilyId('1910-1914:5:4.9-6.4');
  const ss = [...Array(12).keys()].map(i => sample(i, `f${i % 4}`, {windowCols: i % 6 === 0 ? 2 : 3, widthM: 5 + (i % 3) * 0.3, builtYear: 1910 + (i % 5)}));
  const t = draftType(ss, {id: 'timor-test', district: 'd', buurt: 'B', family: key});
  assert.equal(t.draft.n, 12);
  assert.deepEqual(Object.keys(t.draft.faces).sort(), ['f0', 'f1', 'f2', 'f3']);
  for (const k of ['body.storeys', 'body.bays', 'match.years', 'fit.widthM', 'match.eavesM']) assert.ok(t.draft.fields[k]?.stat?.n, k);
  for (const k of ['palettes.measured.brick', 'palettes.measured.frame']) assert.ok(t.draft.fields[k]?.colour?.n, k);
  assert.equal(t.body.bays, 3);
  assert.ok(t.draft.unmeasured.some(u => /pane layout/.test(u)));
  assert.deepEqual(typeProblems(t), []);
  assert.doesNotThrow(() => resolvePlacement(t, {type: 'timor-test'}, 'Teststraat', 5.5));
});

test('storeyProfile reads window storeys from an opening mask, and returns null without contrast', () => {
  // 5.0 m wide (50 cells), 0.1 m cells, row 0 at 15 m: windows at 4.8-6.6, 7.6-9.4, 10.4-12.2 (floor lines 7.1, 10.0), blank above
  const cols = 50, rows = 150, mask = new Uint8Array(cols * rows);
  const win = (s: number, h: number) => { for (let j = 0; j < rows; j++) { const v = 15 - (j + 0.5) * 0.1; if (v >= s && v <= h) for (let i = 5; i < 45; i++) if (i % 12 < 6) mask[j * cols + i] = 1; } };
  win(4.8, 6.6); win(7.6, 9.4); win(10.4, 12.2);
  const p = storeyProfile({mask, cols, rows, cell: 0.1, topM: 15, eavesM: 14, isOpen: v => v === 1})!;
  assert.ok(p, 'profile');
  assert.equal(p.sillM.length, 3);
  assert.ok(Math.abs(p.sillM[1] - 7.6) < 0.2 && Math.abs(p.headM[2] - 12.2) < 0.2, JSON.stringify(p));
  assert.ok(Math.abs(p.floorM[1] - 7.0) < 0.2 && Math.abs(p.floorM[2] - 10.0) < 0.2, JSON.stringify(p.floorM));
  assert.ok(Math.abs(p.windowShare[1] - 0.6) < 0.05, JSON.stringify(p.windowShare));
  assert.equal(storeyProfile({mask: new Uint8Array(cols * rows), cols, rows, cell: 0.1, topM: 15, eavesM: 14, isOpen: v => v === 1}), null);
});

/** One self-test: the deltas between a draft and the authored type, asserted within the stated tolerances and printed. */
function selfTest(name: string, fixtureFile: string, authoredId: string, family: string, tol: {years: number; eaves: number; width: number; wall: number; frame: number; cornice: number; windowH: number}) {
  test(`self-test ${name}: drafting from the pands of ${authoredId} lands within tolerance of its authored numbers`, () => {
    const ss = fixture(fixtureFile), a = authored(authoredId), d = draftType(ss, {id: 'self', district: a.district, buurt: name, family: parseFamilyId(family), generatedAt: 'test'});
    const palA = Object.values<any>(a.palettes)[0], palD = d.palettes.measured as any, near = (x?: string, y?: string) => x && y ? `${x} vs ${y} (d ${rgbDist(x, y).toFixed(0)})` : `${x ?? 'omitted'} vs ${y ?? 'absent'}`;
    const mA = a.match ?? {}, deltas: Record<string, string> = {
      storeys: `${d.body.storeys} vs ${a.body.storeys}`, bays: `${d.body.bays} vs ${a.body.bays}`,
      years: `${d.match.years} vs ${mA.years ?? 'absent'}`, eavesM: `${d.match.eavesM} vs ${mA.eavesM ?? 'absent'}`, widthM: `${d.fit!.widthM} vs ${a.fit?.widthM ?? 'absent'}`,
      brick: near(palD.brick, palA.brick), frame: near(palD.frame, palA.frame), cornice: near(palD.cornice, palA.cornice),
      windowHeights: `${JSON.stringify(d.body.windowHeights)} vs ${JSON.stringify(a.body.windowHeights)}`, headLines: `${JSON.stringify(d.body.headLines)} vs ${JSON.stringify((a.body as any).headLines)}`,
      omitted: Object.entries(d.draft.omitted).map(([k, v]) => `${k} (${String(v).slice(0, 90)})`).join('; ') || 'none',
    };
    console.log(`  deltas ${name} (n=${d.draft.n}, ${Object.keys(d.draft.faces).length} faces): ${JSON.stringify(deltas)}`);
    const within = (x: number[], y: number[] | undefined, t: number, what: string) => { if (y) assert.ok(Math.abs(x[0] - y[0]) <= t && Math.abs(x[1] - y[1]) <= t, `${what} ${x} vs ${y}`); };
    assert.equal(d.body.storeys, a.body.storeys);
    assert.equal(d.body.bays, a.body.bays);
    within(d.match.years!, mA.years, tol.years, 'years');
    within(d.match.eavesM!, mA.eavesM, tol.eaves, 'eaves');
    within(d.fit!.widthM!, a.fit?.widthM, tol.width, 'width');
    assert.ok(rgbDist(palD.brick, palA.brick) <= tol.wall, `brick ${deltas.brick}`);
    if (palD.frame && palA.frame) assert.ok(rgbDist(palD.frame, palA.frame) <= tol.frame, `frame ${deltas.frame}`);
    // a colour the pands disagree on is omitted, not written (Kinkerstraat cornice: the measured cornice colour is the shaded underside on some pands)
    if (palD.cornice && palA.cornice) assert.ok(rgbDist(palD.cornice, palA.cornice) <= tol.cornice, `cornice ${deltas.cornice}`);
    else assert.ok(d.draft.omitted['palettes.measured.cornice'] || !palA.cornice, 'cornice omitted with a reason');
    const wh = a.body.windowHeights as number[] | undefined, dh = d.body.windowHeights as number[] | undefined;
    if (dh && wh) for (let i = 1; i < Math.min(wh.length, dh.length) - 1; i++) assert.ok(Math.abs(dh[i] - wh[i]) <= tol.windowH, `windowHeights[${i}] ${deltas.windowHeights}`);
    assert.deepEqual(typeProblems(d), []);
  });
}

// Kinkerstraat: 75 placements on 15 faces, 3DBAG storeys 4-5 (the authored type is 4 window storeys); its palettes are the
// median of 22 exemplar pands on two mixed-exposure capture days, so its wall is held to a wide colour tolerance.
selfTest('kinkerstraat', 'type-draft-kinker-1890.measures.json', 'kinker-1890-plain-brick', '1883-1902:4:4.9-6.4', {years: 6, eaves: 1.5, width: 2.5, wall: 90, frame: 40, cornice: 40, windowH: 0.12});
// Jan Evertsenstraat 1926: 20 placements on 3 faces, one capture day.
selfTest('evertsen', 'type-draft-evertsen-ladder.measures.json', 'evertsen-1926-ladder-plain', '1925-1929:4:4.9-6.4', {years: 3, eaves: 2.5, width: 2.5, wall: 25, frame: 25, cornice: 25, windowH: 0.12});

test('the one-face authored type is refused (never tune for one face)', () => {
  assert.equal(DRAFT.minFaces, 3);
  const ss = [...Array(16).keys()].map(i => sample(i, 'evertsen-7-41'));
  assert.throws(() => draftType(ss, {id: 'x', district: 'd', buurt: 'b', family: parseFamilyId('1925-1929:5:4.9-6.4')}), DraftRefused);
  assert.equal(stat([]), null);
});
