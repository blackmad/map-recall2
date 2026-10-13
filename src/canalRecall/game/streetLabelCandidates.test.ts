import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABEL_CELL_SIZE, StreetLabelCandidates, reachBucket, type StreetLabelAnchor } from './streetLabelCandidates.ts';

// Deterministic pseudo-city: anchors of a few dozen names over 20 km.
function city(n = 6000): StreetLabelAnchor[] {
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  return Array.from({ length: n }, () => ({ text: `Straat ${Math.floor(rnd() * 60)}`, x: rnd() * 20000 - 10000, y: rnd() * 20000 - 10000 }));
}

/** What drawLabels' walk admitted before: reach box + knowledge test, in order. */
function walk(labels: StreetLabelAnchor[], known: (t: string) => boolean, cx: number, cy: number, reach: number) {
  return labels.filter(l => Math.abs(l.x - cx) <= reach && Math.abs(l.y - cy) <= reach && known(l.text));
}

test('nothing to draw when the player knows no names: no walk at all', () => {
  const idx = new StreetLabelCandidates();
  const got = idx.candidates(city(), { mapLabelNames: new Set(), knownPlaces: new Map() }, 0, 0, 4000);
  assert.equal(got.length, 0);
  assert.equal(idx.rebuilds, 0);
});

test('names nobody has anchors for give an empty list', () => {
  const idx = new StreetLabelCandidates();
  assert.equal(idx.candidates(city(), { mapLabelNames: new Set(['Nowhere']), knownPlaces: new Map() }, 0, 0, 4000).length, 0);
});

test('candidates filtered by the per-frame tests equal the full walk, in order', () => {
  const labels = city();
  const mapLabelNames = new Set(['Straat 3', 'Straat 17', 'Straat 40']);
  const knownPlaces = new Map<string, unknown>([['Straat 17', []], ['Straat 22', []]]);
  const known = (t: string) => mapLabelNames.has(t) || knownPlaces.has(t);
  const idx = new StreetLabelCandidates();
  let s = 99;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  for (let k = 0; k < 400; k++) {
    const cx = rnd() * 16000 - 8000, cy = rnd() * 16000 - 8000, reach = 300 + rnd() * 6000;
    const fromIndex = idx.candidates(labels, { mapLabelNames, knownPlaces }, cx, cy, reach)
      .filter(l => Math.abs(l.x - cx) <= reach && Math.abs(l.y - cy) <= reach && known(l.text));
    assert.deepEqual(fromIndex, walk(labels, known, cx, cy, reach));
  }
});

test('the per-cell list is reused inside a cell and rebuilt on a new name', () => {
  const labels = city();
  const mapLabelNames = new Set(['Straat 3']);
  const knownPlaces = new Map<string, unknown>();
  const idx = new StreetLabelCandidates();
  const at = (x: number) => idx.candidates(labels, { mapLabelNames, knownPlaces }, x, 10, 2000);
  at(10); at(20); at(LABEL_CELL_SIZE - 1);
  assert.equal(idx.rebuilds, 1);
  at(LABEL_CELL_SIZE + 1);
  assert.equal(idx.rebuilds, 2);
  mapLabelNames.add('Straat 4');
  const after = at(LABEL_CELL_SIZE + 1);
  assert.equal(idx.rebuilds, 3);
  assert.ok(after.some(l => l.text === 'Straat 4'));
  knownPlaces.set('Straat 5', []);
  assert.ok(at(LABEL_CELL_SIZE + 1).some(l => l.text === 'Straat 5'));
});

test('a replaced anchor array is re-indexed', () => {
  const idx = new StreetLabelCandidates();
  const knowledge = { mapLabelNames: new Set(['A']), knownPlaces: new Map() };
  assert.equal(idx.candidates([{ text: 'A', x: 0, y: 0 }], knowledge, 0, 0, 100).length, 1);
  assert.equal(idx.candidates([{ text: 'B', x: 0, y: 0 }], knowledge, 0, 0, 100).length, 0);
});

test('reach buckets never fall below the reach', () => {
  for (const r of [1, 1.25, 1.5625, 100, 4000, 4096, 12345.6]) assert.ok(reachBucket(r) >= r && reachBucket(r) < r * 1.26, `${r}`);
});
