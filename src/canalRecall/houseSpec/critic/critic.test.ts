import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapIdOf, GAP_TERMS } from './vocabulary.ts';
import { gameSides, presentationOrder } from './shuffle.ts';
import { flatForTwoRounds, parseAnswers, scoreRound, type KeyEntry } from './score.ts';
import { bandLine, dilate, maskPair, MASK_GREY, SKY_FLAT, type Rgb8 } from './mask.ts';

test('every vocabulary term parses back to itself; free text does not', () => {
  for (const t of GAP_TERMS) assert.equal(gapIdOf(t.text), t.id);
  assert.equal(gapIdOf('Wall Color/Tone'), 'wall-colour');
  assert.equal(gapIdOf("None: can't tell"), 'none');
  assert.equal(gapIdOf('the windows look off'), null);
  assert.equal(GAP_TERMS.length, 17);
});

test('side shuffle is reproducible from the seed and roughly balanced', () => {
  const ids = Array.from({ length: 200 }, (_, i) => `P${String(i).padStart(3, '0')}`);
  assert.deepEqual(gameSides(ids, 42), gameSides(ids, 42));
  assert.notDeepEqual(gameSides(ids, 42), gameSides(ids, 43));
  const a = Object.values(gameSides(ids, 42)).filter(s => s === 'A').length;
  assert.ok(a > 80 && a < 120, `A on ${a} of 200`);
  assert.deepEqual([...presentationOrder(ids, 7)].sort(), ids);
});

test('parser keeps vocabulary answers and rejects the rest with a reason', () => {
  const { answers, rejected } = parseAnswers([
    'Some preamble the critic wrote.',
    'P001 | game: B | gap: window kind | severity: 2 | confidence: high | note: casements drawn as sashes',
    '- P002 | game: a | gap: none: can\'t tell | severity: - | confidence: low | note: ',
    'P003 | game: A | gap: ugly roof | severity: 2 | confidence: med | note: x',
    'P004 | game: C | gap: storey count | severity: 1 | confidence: med | note: x',
    'P005 | game: A | gap: storey count | severity: 4 | confidence: med | note: x',
    'P001 | game: A | gap: storey count | severity: 1 | confidence: med | note: dup',
  ].join('\n'));
  assert.deepEqual(answers.map(a => [a.pair, a.game, a.gap, a.severity]), [['P001', 'B', 'window-kind', 2], ['P002', 'A', 'none', null]]);
  assert.equal(rejected.length, 4);
});

test('score: fooled-rate counts the photo named as the game; histogram ranks by severity sum', () => {
  const key: KeyEntry[] = [
    { pair: 'P001', key: 'a', pandId: '1', group: 'g1', route: 'generic', game: 'B' },
    { pair: 'P002', key: 'b', pandId: '2', group: 'g1', route: 'generic', game: 'A' },
    { pair: 'P003', key: 'c', pandId: '3', group: 'g2', route: 'generic', game: 'A' },
    { pair: 'P004', key: 'd', pandId: '4', group: 'g2', route: 'generic', game: 'B' },
  ];
  const { answers } = parseAnswers([
    'P001 | game: B | gap: window kind | severity: 1 | confidence: high | note:',
    'P002 | game: B | gap: crown/gable type | severity: 3 | confidence: low | note:',
    'P003 | game: A | gap: window kind | severity: 1 | confidence: high | note:',
  ].join('\n'));
  const s = scoreRound(0, key, answers);
  assert.equal(s.answered, 3); assert.deepEqual(s.missing, ['P004']);
  assert.equal(s.fooled, 1); assert.equal(s.fooledRate, 0.333);
  assert.deepEqual(s.histogram.map(r => [r.gap, r.count, r.severitySum]), [['crown-gable', 1, 3], ['window-kind', 2, 2]]);
  assert.equal(s.fooledRateByGroup.g1.rate, 0.5);
});

test('stop rule: flat for two rounds', () => {
  assert.equal(flatForTwoRounds([0.02, 0.1, 0.11, 0.12]), true);
  assert.equal(flatForTwoRounds([0.02, 0.1, 0.2]), false);
  assert.equal(flatForTwoRounds([0.1, 0.1]), false);
});

test('mask: street band and leaf union grey on both halves, each sky flat on its own', () => {
  const W = 4, H = 4, mk = (fill: (x: number, y: number) => [number, number, number]): Rgb8 => {
    const d = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.set(fill(x, y), (y * W + x) * 3);
    return { width: W, height: H, data: d };
  };
  // a: sky in row 0, brick below, a leaf at (1,1). b: sky rows 0-1 in column 3 only, brick elsewhere.
  const a = mk((x, y) => y === 0 ? [180, 200, 230] : x === 1 && y === 1 ? [60, 140, 40] : [100, 50, 40]);
  const b = mk((x, y) => x === 3 && y <= 1 ? [180, 200, 230] : [100, 50, 40]);
  maskPair(a, b, { bandY: bandLine(W, [{ x: 0, y: 3 }, { x: 3, y: 3 }]), leafDilate: 0 });
  const px = (img: Rgb8, x: number, y: number) => [...img.data.slice((y * W + x) * 3, (y * W + x) * 3 + 3)];
  assert.deepEqual(px(a, 0, 3), MASK_GREY); assert.deepEqual(px(b, 0, 3), MASK_GREY); // band
  assert.deepEqual(px(a, 1, 1), MASK_GREY); assert.deepEqual(px(b, 1, 1), MASK_GREY); // leaf union
  assert.deepEqual(px(a, 0, 0), SKY_FLAT); assert.deepEqual(px(b, 0, 0), [100, 50, 40]); // sky is per half
  assert.deepEqual(px(b, 3, 1), SKY_FLAT);
  assert.deepEqual([...dilate(new Uint8Array([0, 0, 1, 0, 0]), 5, 1, 1)], [0, 1, 1, 1, 0]);
});

import { labelProblems } from './labels.ts';
test('benchmark labels: a complete record is valid; enum, storey and shopfront slips are named', () => {
  const ok = { storeys: 4, columns: [3, 3, 3, 3], windowKind: 'T-window', windowHead: 'flat', paneLayout: 'top-light', whiteAccents: { bands: true, surrounds: false, keystones: false, quoins: false, whiteFrames: true }, doorBay: 'left', doorReveal: 'inset', shopfront: false, shopfrontForm: 'none', crown: 'cornice', cornice: 'timber', roof: 'dormer', finish: 'brick', wallTone: { family: 'dark-brown', darkness: 'dark' }, oneFront: true, confidence: 'high' };
  assert.deepEqual(labelProblems(ok), []);
  assert.deepEqual(labelProblems({ ...ok, columns: [3, 3], crown: 'gable', shopfrontForm: 'full-glass' }), ['columns has 2 storeys, storeys is 4', 'crown "gable"', 'shopfrontForm without a shopfront']);
});
