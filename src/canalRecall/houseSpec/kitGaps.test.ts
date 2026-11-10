// The kit-gap queue and its generated doc (house line H6, docs/house-line.md §5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKitGapQueue, KIT_GAP_THRESHOLD, normalizeGap, notesOf, QUEUE_TABLE_ROWS, renderKitGapsDoc, tableEntries, type GapSighting, type QueueEntry } from './kitGaps.ts';

const sight = (pandId: string, what: string, extra: Partial<GapSighting> = {}): GapSighting => ({
  pandId, limit: { component: 'facade', what }, source: 'spec', intentPath: `scripts/block-face/faces/f/intent.json`, cropPath: `staging/block-face/f/strip.jpg`, date: '2024-12-11', ...extra,
});
const none = () => false;

test('normalizeGap lower-cases, collapses whitespace, drops trailing stops and folds the synonym table', () => {
  assert.equal(normalizeGap('  Brick  Flat-arch lintels. '), 'brick flat-arch lintels');
  assert.equal(normalizeGap('Iron wall anchors between the windows'), 'iron wall anchors');
  assert.equal(normalizeGap('The balcony depth is assumed (0.5 m)'), 'the balcony depth (0.5 m) is not measurable on the ortho strip');
});

test('a pand counts once per gap however many sources state it; the weight is 3 inside a ride-priority gebied', () => {
  const priority = new Set(['0363100000000001']);
  const q = buildKitGapQueue([
    sight('0363100000000001', 'iron wall anchors'),
    sight('0363100000000001', 'iron wall anchors between the windows', { source: 'type' }),
    sight('0363100000000002', 'iron wall anchors'),
  ], p => priority.has(p));
  assert.equal(q.length, 1);
  assert.equal(q[0].pandCount, 2);
  assert.equal(q[0].priorityPandCount, 1);
  assert.equal(q[0].weightedCount, 3 + 1);
  assert.deepEqual(q[0].pands, ['0363100000000001', '0363100000000002']);
});

test('the queue sorts by weighted count, then pand count, then text; component is the most common', () => {
  const q = buildKitGapQueue([
    sight('1', 'gap b'), sight('2', 'gap b'),
    sight('3', 'gap a', { limit: { component: 'dormer', what: 'gap a' } }), sight('4', 'gap a', { limit: { component: 'dormer', what: 'gap a' } }),
    sight('5', 'gap a', { limit: { component: 'gable', what: 'gap a' } }),
    sight('6', 'gap c'),
  ], none);
  assert.deepEqual(q.map(e => e.gap), ['gap a', 'gap b', 'gap c']);
  assert.equal(q[0].component, 'dormer');
  assert.equal(q[0].weightedCount, 3);
});

test('examples are at most three pands, ride-priority first, then pands with a crop', () => {
  const priority = new Set(['9']);
  const q = buildKitGapQueue([
    sight('1', 'g', { cropPath: null }), sight('2', 'g'), sight('3', 'g'), sight('4', 'g'), sight('9', 'g', { cropPath: null }),
  ], p => priority.has(p));
  assert.deepEqual(q[0].examples.map(e => e.pandId), ['9', '2', '3']);
  assert.equal(q[0].examples.length, 3);
});

test('firstSeen and lastSeen are the earliest and latest evidence dates', () => {
  const q = buildKitGapQueue([sight('1', 'g', { date: '2023-05-01' }), sight('2', 'g', { date: '2024-02-02' }), sight('3', 'g', { date: null })], none);
  assert.equal(q[0].firstSeen, '2023-05-01');
  assert.equal(q[0].lastSeen, '2024-02-02');
});

/** A queue of `n` one-pand gaps, the first `hot` of them at the threshold. */
function fakeQueue(n: number, hot: number): QueueEntry[] {
  return Array.from({ length: n }, (_, i) => {
    const weightedCount = i < hot ? KIT_GAP_THRESHOLD + (hot - i) : Math.max(1, 40 - i);
    return { gap: `gap ${String(i).padStart(3, '0')}`, component: 'facade', weightedCount, pandCount: weightedCount, priorityPandCount: 0, pands: [], examples: [], firstSeen: null, lastSeen: null };
  }).sort((a, b) => b.weightedCount - a.weightedCount);
}

test('the generated doc lists every entry over the threshold, even past the top 30', () => {
  const queue = fakeQueue(QUEUE_TABLE_ROWS + 12, QUEUE_TABLE_ROWS + 5);
  const doc = renderKitGapsDoc(queue, { generated: '2026-11-10', notes: '' });
  for (const e of queue.filter(x => x.weightedCount >= KIT_GAP_THRESHOLD)) assert.ok(doc.includes(`| ${e.gap} |`), `missing ${e.gap}`);
  assert.equal(tableEntries(queue).length, QUEUE_TABLE_ROWS + 5);
});

test('the table is the top 30 when nothing is over the threshold, and the Notes section survives a regeneration', () => {
  const queue = fakeQueue(40, 0);
  assert.equal(tableEntries(queue).length, QUEUE_TABLE_ROWS);
  const notes = '## Notes\n\n### Factory batch 1\n\nHand-kept prose.\n';
  const doc = renderKitGapsDoc(queue, { generated: '2026-11-10', notes });
  assert.equal(notesOf(doc), notes.trim() + '\n');
  assert.equal(notesOf(renderKitGapsDoc(queue, { generated: '2026-11-11', notes: notesOf(doc) })), notesOf(doc));
});

test('a gap with a pipe in its text does not break the table', () => {
  const doc = renderKitGapsDoc(buildKitGapQueue([sight('1', 'a | b')], none), { generated: '2026-11-10', notes: '' });
  assert.ok(doc.includes('| a \\| b |'));
});
