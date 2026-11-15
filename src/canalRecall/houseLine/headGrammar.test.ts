import assert from 'node:assert/strict';
import test from 'node:test';
import { HEAD, headGrammarOf, headPieces, headRise } from './headGrammar.ts';

const span = (pieces: ReturnType<typeof headPieces>) => pieces.flatMap(p => p.pts.map(q => q[1]));

test('every head dressing D states maps onto the grammar; plain flat and block-course do not', () => {
  for (const d of ['keystone', 'jack-blocks', 'segmental-tympanum', 'arch-ring', 'stone-lintel']) assert.ok(headGrammarOf(d, undefined), d);
  // A plain arched window (round lane 4): the glass up into its arch, no ring; a plain flat head stays nothing.
  assert.deepEqual(headGrammarOf('none', 'round'), { shape: 'round' });
  assert.ok(headPieces(headGrammarOf('none', 'segmental')!, 0, 1.1, 10).every(p => p.tone === 'glass'));
  assert.equal(headGrammarOf('none', 'flat'), null);
  assert.equal(headGrammarOf('block-course', undefined), null);
  assert.equal(headGrammarOf(undefined, 'rect'), null);
});

test('jack-blocks: a flat white lintel wider than the opening, a block over each end and the tallest on the axis; no arch', () => {
  const g = headGrammarOf('jack-blocks', undefined)!, p = headPieces(g, 0, 1.1, 10);
  assert.equal(g.shape, 'flat');
  assert.equal(g.voussoirs, undefined);
  const [slab, ...crown] = p;
  assert.ok(slab.pts[0][0] < 0 && slab.pts[1][0] > 1.1);
  assert.equal(crown.length, 3);
  const hs = crown.map(x => x.pts[2][1] - x.pts[1][1]);
  assert.ok(hs[1] > hs[0] && hs[0] === hs[2]);
  assert.ok(p.every(x => x.tone === 'white'));
  assert.ok(Math.min(...span(p)) >= 10 - 1e-9);
  assert.ok(Math.abs(Math.max(...span(p)) - 10 - headRise(g, 1.1)) < 1e-9);
});

test('voussoirs: an odd count of blocks at the opening scale, alternating, the key on the axis', () => {
  const p = headPieces({ shape: 'flat', voussoirs: { alternate: 'white-brick', depth: 0.22 }, keystone: 'raised' }, 0, 1.1, 10);
  const vs = p.filter(x => x.out !== HEAD.keyOut), key = p.filter(x => x.out === HEAD.keyOut);
  assert.equal(vs.length % 2, 1);
  const w = 1.1 / vs.length;
  assert.ok(w >= 0.12 && w <= 0.2, `block ${w}`);
  assert.ok(vs.some(x => x.tone === 'white') && vs.some(x => x.tone === 'brick'));
  assert.equal(key.length, 1);
});

test('row scale: keys at least 0.26 m wide and 0.36 m tall in white; a 1.1 m segmental arch rises at least 0.2 m', () => {
  for (const d of ['keystone', 'segmental-tympanum']) {
    const g = headGrammarOf(d, d === 'keystone' ? undefined : 'segmental')!, key = headPieces(g, 0, 1.1, 5).filter(x => x.out === HEAD.keyOut);
    assert.equal(key.length, 1, d);
    const k = key[0].pts, wide = k[1][0] - k[0][0], tall = k[2][1] - k[1][1];
    assert.ok(wide >= 0.26 - 1e-9 && tall >= 0.36 - 1e-9 && key[0].tone === 'white', `${d} key ${wide} x ${tall}`);
  }
  const g = headGrammarOf('segmental-tympanum', undefined)!, fill = headPieces(g, 0, 1.1, 5).filter(x => x.tone === 'stone');
  assert.ok(Math.max(...fill.flatMap(x => x.pts.map(q => q[1]))) - 5 >= 0.2);
});

test('block surround: alternating long and short white quoins up both jambs, only with the sill known', () => {
  const g = headGrammarOf('block-surround', undefined)!, p = headPieces(g, 0, 1.1, 10, 8.4);
  const quoins = p.filter(x => x.out === HEAD.out && x.tone === 'white' && x.pts[1][1] <= 10 - 1e-9 + HEAD.quoinH && x.pts[0][1] < 10);
  assert.ok(quoins.length >= 8);
  const widths = new Set(quoins.map(x => +(x.pts[1][0] - x.pts[0][0]).toFixed(3)));
  assert.deepEqual([...widths].sort(), [HEAD.quoinShort, HEAD.quoinLong].sort());
  assert.equal(headPieces(g, 0, 1.1, 10).filter(x => x.pts[0][1] < 10 - HEAD.keyDown - 1e-9).length, 0);
});

test('segmental heads rise a sixth of the span; the glass or tympanum fills under the arch', () => {
  const g = headGrammarOf('segmental-tympanum', undefined)!, L = 1.2, p = headPieces(g, 0, L, 5);
  const fill = p.filter(x => x.tone === 'stone');
  assert.ok(fill.length >= 6);
  assert.ok(Math.abs(Math.max(...fill.flatMap(x => x.pts.map(q => q[1]))) - (5 + Math.max(L / 6, HEAD.minRise))) < 0.01);
  assert.ok(headRise(g, L) > L / 6);
  const glazed = headPieces({ ...g, tympanum: false }, 0, L, 5);
  assert.ok(glazed.some(x => x.tone === 'glass') && !glazed.some(x => x.tone === 'stone'));
});

test('arch-ring: a half-round ring with springers and a key over the round glass', () => {
  const g = headGrammarOf('arch-ring', 'round')!, L = 1.0, p = headPieces(g, 2, 2 + L, 0);
  assert.equal(g.shape, 'round');
  assert.ok(p.some(x => x.tone === 'glass'));
  const top = Math.max(...span(p));
  assert.ok(top > L / 2 + g.voussoirs!.depth && top <= headRise(g, L) + 1e-9);
  assert.equal(p.filter(x => x.out === HEAD.out + 0.01).length, 2);
});

test('a stone lintel is one slab', () => {
  const p = headPieces(headGrammarOf('stone-lintel', undefined)!, 0, 1, 3);
  assert.equal(p.length, 1);
  assert.equal(p[0].tone, 'white');
});

test('tablet (Herengracht 27, 0363100012175404): a white stone block on the axis over the head; relieving adds the brick arch', () => {
  const g = headGrammarOf('tablet', 'flat')!, p = headPieces(g, 0, 1.1, 10);
  assert.deepEqual(g, { shape: 'flat', tablet: true });
  assert.equal(p.length, 1);
  const t = p[0].pts;
  assert.equal(p[0].tone, 'white');
  assert.ok(Math.abs((t[0][0] + t[1][0]) / 2 - 0.55) < 1e-9 && t[0][1] > 10, 'centred, above the head');
  assert.ok(t[1][0] - t[0][0] >= 0.26 - 1e-9 && t[2][1] - t[1][1] >= 0.36 - 1e-9, 'at row scale');
  assert.ok(Math.abs(10 + headRise(g, 1.1) - t[2][1]) < 1e-9, 'headRise reaches its top');
  const r = headGrammarOf('tablet', 'relieving')!, pr = headPieces(r, 0, 1.1, 10);
  assert.ok(pr.filter(x => x.tone === 'brick').length >= HEAD.minBlocks, 'the relieving ring');
  const tab = pr.find(x => x.tone === 'white')!;
  // The tablet sits on the ring's crown as its key: its foot just inside the ring's top.
  const ringTop = Math.max(...pr.filter(x => x.tone !== 'white').flatMap(x => x.pts.map(q => q[1])));
  assert.ok(tab.pts[0][1] >= ringTop - 0.05 && tab.pts[0][1] < ringTop, 'the tablet keyed on the ring');
});

test('relieving arch springs over the window frame; an arched frame is a slim white ring with the glass in the arch', () => {
  const r = headPieces(headGrammarOf('tablet', 'relieving')!, 0, 1.1, 10);
  const ring = r.filter(x => x.tone !== 'white');
  assert.ok(Math.min(...ring.flatMap(x => x.pts.map(q => q[1]))) >= 10 + HEAD.relieve.lift - 1e-9);
  const a = headGrammarOf('arched-frame', 'segmental')!, p = headPieces(a, 0, 1.2, 10);
  assert.ok(p.some(x => x.tone === 'glass') && p.filter(x => x.tone === 'white').length >= HEAD.minBlocks);
  assert.equal(headGrammarOf('arched-frame', 'flat')!.shape, 'segmental');
});
