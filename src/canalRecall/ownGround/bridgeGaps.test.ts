import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HitIndex, histogram, probeWay, stations, summarise, topClass } from './bridgeGaps.js';
import type { BuiltCell, GroundLayer, PackedMesh } from './groundCell.js';

/** A flat quad [x0, x1] × [y0, y1] at z as a packed mesh. */
function quad(x0: number, x1: number, y0: number, y1: number, z: number): PackedMesh {
  const positions = new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z]);
  return { positions, normals: new Float32Array(12), uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
}
function cell(layers: Partial<Record<GroundLayer, PackedMesh>>): BuiltCell {
  return { key: '0_0', lod: 0, detail: 'full', rect: [-100, -100, 100, 100], layers, mask: null, stats: {} as BuiltCell['stats'] };
}

test('stations run past both ends of the way', () => {
  const st = stations([[0, 0], [10, 0]], 0.5, 2);
  assert.equal(st[0].s, -2);
  assert.ok(Math.abs(st[st.length - 1].s - 12) < 1e-9);
  assert.equal(st.filter(p => p.inWay).length, 21);
  assert.deepEqual([st[0].nx, st[0].ny], [-0, 1]);
});

test('a road the deck top covers reads as a buried gap; a missing stretch as missing', () => {
  // Asphalt from x = -5 to 4 and 6 to 15 at z 1; the deck top over 3..7 at z 1.5; land everywhere at z 0.9.
  const c = cell({ land: quad(-20, 30, -10, 10, 0.9), asphalt: { ...quad(-5, 4, -3, 3, 1) }, deckTop: quad(3, 7, -3, 3, 1.5) });
  const c2 = cell({ asphalt: quad(6, 15, -3, 3, 1) });
  const index = new HitIndex([c, c2], 2);
  assert.equal(index.at(5, 0)[0].layer, 'deckTop');
  assert.equal(topClass('deckTop'), 'deck');
  assert.equal(topClass(null), 'hole');
  const { samples } = probeWay(index, [[0, 0], [10, 0]], 2, () => 1, (x) => (x >= 3 && x <= 7 ? 'BRU0001' : null), { approachM: 2, stepM: 0.5, lateral: [0] });
  const sum = summarise(samples, 2, 0.5, [0]);
  // x in [3, 7] shows the deck (9 samples: 3.0 .. 7.0); 3..4 and 6..7 bury asphalt (edges inclusive), 4.5..5.5 has none.
  assert.equal(sum.shows.deck, 9);
  assert.equal(sum.causes.buried, 6);
  assert.equal(sum.causes.missing, 3);
  assert.equal(sum.onDeck, 9);
  assert.equal(sum.centreGapM, 4.5);
  assert.ok(Math.abs(sum.maxStepM - 0.5) < 1e-6);
});

test('histogram bins are half-open with an open last bin', () => {
  assert.deepEqual(histogram([0, 0.4, 1, 5, 100], [0, 1, 4]).map(b => b.count), [2, 1, 2]);
});
