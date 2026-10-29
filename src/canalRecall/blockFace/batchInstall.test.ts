import test from 'node:test';
import assert from 'node:assert/strict';
import {coveredElsewhere, installVerdict, restripDates, sampleShare, trimShared} from './batchInstall.ts';

test('Kinkerstraat 49-63: the corner owned by face-bilder-133467-159649 is trimmed, never taken', () => {
  const members = ['0363100012133467', '0363100012150001', '0363100012150002'];
  const chunks = [{id: 'chunk-face-bilder-133467-159649', suppress: ['NL.IMBAG.Pand.0363100012133467', 'NL.IMBAG.Pand.0363100012153782', 'NL.IMBAG.Pand.0363100012159649']}];
  const shared = coveredElsewhere(members, chunks, new Set(['chunk-face-kinker-49-63']));
  assert.deepEqual([...shared], [['0363100012133467', 'chunk-face-bilder-133467-159649']]);
  assert.deepEqual(trimShared(members, new Set(shared.keys())), {keep: members.slice(1), dropped: [members[0]]});
  // its own chunk (a re-install) is not a cover
  assert.equal(coveredElsewhere(members, chunks, new Set(['chunk-face-bilder-133467-159649'])).size, 0);
});

test('a shared pand inside the face, or too few left, is not installed', () => {
  assert.match((trimShared(['a', 'b', 'c'], new Set(['b'])) as {error: string}).error, /inside the face/);
  assert.match((trimShared(['a', 'b', 'c'], new Set(['a', 'b'])) as {error: string}).error, /1 pand/);
});

test('fallback strip dates: full coverage, leaf-off, newest first', () => {
  const c = {'2024-11-29': 5, '2023-01-10': 5, '2022-06-01': 5, '2019-01-09': 5, '2025-07-31': 0, '2021-03-25': 3};
  assert.deepEqual(restripDates(c, 5, '2024-11-29'), ['2023-01-10', '2019-01-09', '2022-06-01']);
  assert.deepEqual(restripDates(c, 5, '2024-11-29', ['2023-01-10'], 1), ['2019-01-09']);
});

test('install verdict: everything must pass', () => {
  const ok = {strip: {bad: false, reasons: []}, compile: {gatesFailed: [], auditPassed: true}, likeness: [{pandId: 'p1', ncc: 0.3}, {pandId: 'p2', ncc: null}], stripOverDrawn: 1.0, brickPands: 2};
  assert.deepEqual(installVerdict(ok), {install: true, reasons: []});
  assert.match(installVerdict({...ok, stripOverDrawn: 0.705}).reasons[0], /^strip-over-drawn-low/);
  assert.match(installVerdict({...ok, stripOverDrawn: 1.3}).reasons[0], /^strip-over-drawn-high/);
  assert.equal(installVerdict({...ok, stripOverDrawn: null, brickPands: 0}).install, true); // all-stucco face: no brick tone to judge
  assert.match(installVerdict({...ok, likeness: [{pandId: 'p1', ncc: 0.1}, {pandId: 'p2', ncc: 0.3}]}).reasons[0], /^likeness: 1 pand/);
  assert.match(installVerdict({...ok, likeness: [{pandId: 'p1', ncc: null}, {pandId: 'p2', ncc: null}, {pandId: 'p3', ncc: 0.4}]}).reasons[0], /^likeness-no-evidence/);
  assert.match(installVerdict({...ok, compile: {gatesFailed: [], auditPassed: false}}).reasons[0], /^glb-audit/);
  assert.match(installVerdict({...ok, strip: {bad: true, reasons: ['cyan cast gm']}}).reasons[0], /^strip-quality/);
  assert.deepEqual(installVerdict({...ok, compile: {error: 'boom', gatesFailed: [], auditPassed: false}}).reasons, ['compile-error: boom']);
});

test('the spot-review sample is deterministic and at least one', () => {
  const xs = Array.from({length: 35}, (_, i) => i);
  assert.equal(sampleShare(xs).length, 4);
  assert.deepEqual(sampleShare(xs), sampleShare(xs));
  assert.equal(sampleShare([1, 2]).length, 1);
  assert.deepEqual(sampleShare([]), []);
});

test('front palette facings move to the house palette (Kinkerstraat 65-87 door/brick z-fight)', async () => {
  const {facingsToHousePalette} = await import('./batchInstall.ts');
  const intent = {houses: [
    {pandId: 'a', type: {overrides: {bays: 3, palette: {brick: '#714a2d'}}}},
    {pandId: 'b', type: {overrides: {palette: {band: '#7a4a30'}}, paletteOverrides: {brick: '#74705e', wallTint: 'measured'}}},
    {pandId: 'c', type: {overrides: {bays: 2}}},
    {pandId: 'd'},
  ]};
  assert.deepEqual(facingsToHousePalette(intent as any), ['a', 'b']);
  assert.deepEqual(intent.houses[0].type, {overrides: {bays: 3}, paletteOverrides: {brick: '#714a2d'}});
  assert.deepEqual(intent.houses[1].type, {paletteOverrides: {brick: '#74705e', wallTint: 'measured', band: '#7a4a30'}});
  assert.deepEqual(intent.houses[2].type, {overrides: {bays: 2}});
});

test('library year prefilter', async () => {
  const {libraryYearMatches} = await import('./batchInstall.ts');
  const types = [{match: {years: [1893, 1893] as [number, number]}}, {match: {years: [1909, 1912] as [number, number], yearSlack: 0}}, {}];
  assert.equal(libraryYearMatches([1895, 1896, 1913, 1908, null, 1910], types), 2);
});

test('brick for the strip wall luma: stripOverDrawn 1 by construction, clamp reported', async () => {
  const {brickForDrawnLuma} = await import('./batchInstall.ts');
  const {drawnWallLuma} = await import('../look/drawnWall.ts');
  const target = drawnWallLuma({brick: '#7a4a30'}) * 1.4;
  const r = brickForDrawnLuma('#7a4a30', target);
  assert.equal(r.reached, true);
  assert.ok(Math.abs(drawnWallLuma({brick: r.brick}) - target) <= Math.max(1, target * 0.03));
  assert.equal(brickForDrawnLuma('#7a4a30', 250).reached, false);
});
