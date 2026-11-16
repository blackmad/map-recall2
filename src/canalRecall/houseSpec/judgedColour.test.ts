// Judged wall colour (lane d1-colour-judged, 2026-11-14): the palette draws through the game's real wall chain (never held
// by the pale-warm guard, never swapped for a family tone, the right family), the per-front rules, the row rules, the
// variation, and the spec writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JUDGED_FAMILIES, JUDGED_PALETTE, brickFromSample, withoutSampledWall, describerColourWord, judgeFront, judgeRow, lchOf, variedTone, withJudgedWall, type JudgedInput } from './judgedColour.ts';
import { specWallColour } from './decorate.ts';
import { specView } from './view.ts';
import { validateSpec, type HouseSpec } from './spec.ts';
import { hexToOklab, nearestWallFamily, wallColourFamily } from './wallColour.ts';

const IDS = Array.from({ length: 60 }, (_, i) => `03631000121${String(60000 + i * 137).padStart(5, '0')}`);
const MATERIAL: Record<string, 'brick' | 'stucco' | 'painted-brick' | 'stone'> = {
  'red-brown-brick': 'brick', 'brown-brick': 'brick', 'purple-brown-brick': 'brick', 'orange-red-brick': 'brick', 'buff-brick': 'brick',
  'painted-white': 'painted-brick', 'cream-render': 'stucco', 'pale-grey-stucco': 'stucco', 'grey-stone': 'stone', 'painted-dark': 'painted-brick', sandstone: 'stone',
};
const base = (pandId: string, wallMaterial: string): HouseSpec => ({
  schemaVersion: 1, pandId, design: { fronts: [{ storeys: 4, bays: 3 }], palette: { wallMaterial } as never },
  provenance: { 'fronts/0/storeys': { source: 'vision-judge', confidence: 0.7, ref: 'cut', at: '2026-11-14' }, 'fronts/0/bays': { source: 'vision-judge', confidence: 0.7, ref: 'cut', at: '2026-11-14' }, 'palette/wallMaterial': { source: 'vision-judge', confidence: 0.7, ref: 'cut', at: '2026-11-14' } },
  facts: { wallSample: { v: 2 } as never },
});

test('every family, every variation, draws through the game wall chain unheld and in its family', () => {
  for (const fam of JUDGED_FAMILIES) {
    const t = JUDGED_PALETTE[fam];
    for (const id of IDS) {
      const spec = withJudgedWall(base(id, MATERIAL[fam]), { pandId: id, family: fam, by: 'finish', why: 't' }, { ref: 'cut', at: '2026-11-14' });
      const hex = spec.design.palette!.brick as string, view = specView(spec);
      assert.equal(view.wallHex, hex);
      const drawn = specWallColour(view, {});
      assert.ok(drawn, `${fam} ${hex} is held by the guard`);
      // the reading is not swapped for the family tone: the drawn colour follows the tone (lightness never below it)
      assert.ok(hexToOklab(drawn!)[0] >= hexToOklab(hex)[0] - 1e-3, `${fam} ${hex} drew darker ${drawn}`);
      assert.equal(nearestWallFamily(hex), fam === 'painted-dark' ? 'dark' : nearestWallFamily(hex));
      const L = lchOf(hex).L;
      assert.ok(Math.abs(L - t.L) <= t.dL + 0.01 && L <= t.maxL + 0.01, `${fam} ${hex} L ${L} outside its family`);
      if (t.pale) assert.ok(hexToOklab(drawn!)[0] > 0.6, `${fam} pale family drew dark ${drawn}`);
    }
  }
  // the families read apart in the likeness gate's terms
  assert.equal(wallColourFamily(variedTone('painted-white', IDS[0])), 'neutral-light');
  assert.equal(wallColourFamily(variedTone('painted-dark', IDS[0])), 'neutral-dark');
  assert.equal(wallColourFamily(variedTone('purple-brown-brick', IDS[0])), 'brick-dark');
  assert.match(wallColourFamily(variedTone('buff-brick', IDS[0])), /brick-pale|brick-brown/);
});

test('variation: stable per pand, different across a row, small', () => {
  assert.equal(variedTone('red-brown-brick', IDS[3]), variedTone('red-brown-brick', IDS[3]));
  const row = IDS.slice(0, 12).map(id => variedTone('red-brown-brick', id));
  assert.ok(new Set(row).size >= 10, 'a row is not one flat tint');
  const Ls = row.map(h => lchOf(h).L);
  assert.ok(Math.max(...Ls) - Math.min(...Ls) <= 0.06);
});

test('the reader\'s colour words about the described front (D1 notes)', () => {
  const A = (notes: string) => ({ readable: true, notes });
  assert.match(describerColourWord(A('The outline cuts off the left door bay of the white front; described the whole white front.'))!, /white front/); // ring
  assert.match(describerColourWord(A('Yellow brick front with red brick bands over the windows.'))!, /Yellow brick/i);
  assert.equal(describerColourWord(A('Tree branches cross the right bay; bicycles hide the basement.')), null);
  assert.equal(describerColourWord(A('A white moulded band at the first floor.')), null, 'a white band is trim');
  assert.equal(describerColourWord(A('Branches cross the white cornice and frames.')), null, 'trim');
  assert.equal(describerColourWord(A('The outline also takes the white stucco front beside it.')), null, 'a neighbour');
});

test('per front: words, then finish, then sample against the row, then era', () => {
  const j = (i: Partial<JudgedInput>, med: number | null = null) => judgeFront({ pandId: IDS[0], readable: true, ...i }, med);
  assert.equal(j({ finish: 'painted-brick', pale: false, notes: 'A corner building painted black; scaffold stands at the left.' }).family, 'painted-dark');
  assert.equal(j({ finish: 'painted-brick', pale: false, notes: '' }).family, 'painted-dark');
  assert.equal(j({ finish: 'painted-brick', pale: true, notes: '' }).family, 'painted-white');
  assert.equal(j({ finish: 'stucco', pale: true, sample: '#2e2c2a' }, 0.4).family, 'pale-grey-stucco', 'a dark sample never makes pale stucco dark');
  assert.equal(j({ finish: 'stucco', pale: true, sample: '#9a8a6a' }, 0.4).family, 'cream-render');
  assert.equal(j({ finish: 'stone', pale: true, sample: '#9a8a6a' }).family, 'sandstone');
  assert.equal(j({ finish: 'stone', pale: false }).family, 'grey-stone');
  assert.equal(j({ finish: 'brick', pale: true, sample: '#202020' }, 0.5).family, 'buff-brick', 'pale brick stays buff whatever the sample');
  assert.equal(j({ finish: 'brick', pale: false }).family, 'red-brown-brick', 'no sample, no year: red-brown');
  assert.equal(j({ finish: 'brick', pale: false, year: 1885 }).family, 'brown-brick', 'the ring default: mid brown');
  assert.equal(j({ finish: 'brick', pale: false, year: 1680 }).family, 'red-brown-brick', 'the canal belt default');
  // relative to the row: darker steps to purple-brown, lighter-and-red to orange-red (earlier from 1905), lighter-and-yellow to buff
  const red = '#8a4a3c', redL = lchOf(red).L;
  assert.equal(j({ finish: 'brick', pale: false, sample: red, year: 1680 }, redL + 0.1).family, 'purple-brown-brick');
  assert.equal(j({ finish: 'brick', pale: false, sample: red, year: 1680 }, redL - 0.06).family, 'red-brown-brick');
  assert.equal(j({ finish: 'brick', pale: false, sample: red, year: 1925 }, redL - 0.06).family, 'orange-red-brick');
  assert.equal(j({ finish: 'brick', pale: false, sample: '#b49a6a', year: 1890 }, lchOf('#b49a6a').L - 0.15).family, 'buff-brick');
  assert.equal(j({ finish: 'brick', pale: false, notes: 'Red brick front with white bands.' }).family, 'red-brown-brick');
  assert.equal(j({ finish: 'stucco', pale: false, notes: 'The white stucco front.' }).family, 'grey-stone', 'a word against the reader\'s own pale flag is not taken');
});

test('per row: unread fronts take the row brick; a lone dark sample between pale fronts is not believed', () => {
  const r = (pandId: string, finish: string, pale: boolean | null, sample?: string): JudgedInput => ({ pandId, readable: true, finish, pale, sample, year: 1885 });
  const row = [
    r(IDS[0], 'stucco', true, '#c8c4bc'),
    r(IDS[1], 'brick', false, '#3a3230'), // dark by sample alone
    r(IDS[2], 'stucco', true, '#cfcac0'),
    r(IDS[3], 'brick', false, '#8a6a5a'),
    r(IDS[4], 'not-visible', null),
    r(IDS[5], 'brick', false, '#7a5a4a'),
  ];
  const out = judgeRow(row);
  assert.equal(out[1].by, 'neighbours');
  assert.notEqual(out[1].family, 'purple-brown-brick');
  assert.equal(out[4].by, 'neighbours');
  assert.ok(['red-brown-brick', 'brown-brick', 'orange-red-brick', 'purple-brown-brick', 'buff-brick'].includes(out[4].family));
  assert.equal(out[0].family, 'painted-white', 'a neutral pale stucco lighter than its row reads white');
});

test('spec writer: judged palette, family and receipt; measured receipts dropped; other fields kept; validates', () => {
  const s0 = base(IDS[7], 'brick');
  s0.provenance['facts/wallSample'] = { source: 'streetlevel-measured', confidence: 0.6, ref: 'cut', at: '2026-11-14' };
  const s = withJudgedWall(s0, { pandId: IDS[7], family: 'buff-brick', by: 'finish', why: 'pale brick' }, { ref: 'cut.jpg', at: '2026-11-14', sample: '#403a34', year: 1890 });
  assert.equal(s.facts!.wallFamily, 'buff');
  assert.equal(s.facts!.wallSample, undefined);
  assert.equal(s.provenance['facts/wallSample'], undefined);
  assert.equal(s.facts!.wallJudged!.source, 'judged');
  assert.equal(s.facts!.wallJudged!.hex, s.design.palette!.brick);
  assert.equal(s.design.fronts![0].storeys, 4);
  assert.equal(s.design.palette!.wallMaterial, 'brick');
  assert.equal(s0.facts!.wallFamily, undefined, 'the input is not mutated');
  validateSpec(s);
  assert.throws(() => validateSpec({ ...s, facts: { ...s.facts, wallJudged: { v: 1, source: 'judged', family: 'mauve', hex: '#000000', by: 'x', why: 'y' } } }));
});

test('deferring to a stronger wall source drops only the sampled wall', () => {
  const s0 = base(IDS[8], 'brick');
  s0.design.palette = { ...s0.design.palette, brick: '#353331' } as never;
  s0.provenance['palette/brick'] = { source: 'streetlevel-measured', confidence: 0.6, ref: 'cut', at: '2026-11-14' };
  const s = withoutSampledWall(s0);
  assert.equal(s.design.palette!.brick, undefined);
  assert.equal(s.design.palette!.wallMaterial, 'brick');
  assert.equal(s.provenance['palette/brick'], undefined);
  assert.equal(s.facts, undefined);
  validateSpec(s);
});

test('dark-grey-brick: Herengracht canal brick reads dark and nearly grey (55, 63, 65 cuts), not purple-brown maroon', () => {
  assert.ok((JUDGED_FAMILIES as readonly string[]).includes('dark-grey-brick'));
  for (const id of ['herengracht-51-73:dark-grey-brick', '0363100012168207', 'x']) {
    const t = lchOf(variedTone('dark-grey-brick', id))!;
    assert.ok(t.L > 0.37 && t.L <= 0.44, `L ${t.L}`);
    assert.ok(t.C < 0.016, `C ${t.C}`);
    assert.ok(t.C < lchOf(variedTone('purple-brown-brick', id))!.C - 0.025);
  }
});

test('brickFromSample: dark brick bins by chroma (Herengracht 51-73 cuts)', () => {
  // 55 #4f4c4d, 63 #4a423b, 65 #433b33: dark and nearly grey -> dark-grey-brick; dark with colour stays purple-brown.
  assert.equal(brickFromSample({ L: 0.419, C: 0.004, h: 347 }), 'dark-grey-brick');
  assert.equal(brickFromSample({ L: 0.385, C: 0.017, h: 64 }), 'dark-grey-brick');
  assert.equal(brickFromSample({ L: 0.40, C: 0.03, h: 30 }), 'purple-brown-brick');
  assert.equal(brickFromSample({ L: 0.50, C: 0.006, h: 50 }), 'brown-brick');
  assert.equal(brickFromSample({ L: 0.48, C: 0.06, h: 35 }), 'red-brown-brick');
  // Herengracht 20 #57544e: just over the dark line, no colour -> dark grey-brown, not the warm mid brown.
  assert.equal(brickFromSample({ L: 0.447, C: 0.010, h: 85 }), 'dark-grey-brick');
  assert.equal(brickFromSample({ L: 0.447, C: 0.03, h: 50 }), 'brown-brick');
});

test('judgeFront: a dark painted front with a neutral cut sample is black paint, not green-black (Herengracht 53, 71)', () => {
  const base = { pandId: 'x', readable: true, finish: 'painted-brick', pale: false, notes: null, year: 1650, absolute: true } as JudgedInput;
  assert.equal(judgeFront({ ...base, sample: '#343230' }).family, 'painted-black');
  assert.equal(judgeFront({ ...base, sample: '#2a3a30' }).family, 'painted-dark');
  assert.equal(judgeFront({ ...base, absolute: false, sample: '#343230' }).family, 'painted-dark');
});

test('dark-brown-brick (round 12): a dark brick at brown\'s hue, darker than brown-brick, browner than purple-brown', async () => {
  const { JUDGED_PALETTE: P, JUDGED_FAMILIES: F, variedTone } = await import('./judgedColour.ts');
  assert.equal(F[F.length - 1], 'dark-brown-brick', 'appended: no family moves');
  const d = P['dark-brown-brick'];
  assert.ok(d.L < P['brown-brick'].L && Math.abs(d.L - P['purple-brown-brick'].L) < 0.02 && d.h > P['purple-brown-brick'].h + 15 && !d.pale);
  assert.match(variedTone('dark-brown-brick', 'rubensstraat-133237'), /^#[0-9a-f]{6}$/);
});
