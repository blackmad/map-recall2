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

// ------------------------------------------------------------------ the fix (bridgeGaps)
import { edgesBox, surveyDeckCaps, surveyDeckEdges, EDGE_NO_OUTLINE_M } from './bridgeGaps.js';
import { GroundSurface, type DeckSurface } from './surface.js';
import { deckShare } from './roadSurfaces.js';
import type { DeckProfile } from '../elevation/bridgeDeck.js';

/** A straight deck along +x from 0 to 20 m (stations every 0.5 m), half-width 3, span 4..16, left = +y. */
function deck(sides?: [number, number]): DeckProfile {
  const n = 41, x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n), h = new Float64Array(n), hw = new Float64Array(n).fill(3);
  for (let i = 0; i < n; i++) { x[i] = i * 0.5; s[i] = i * 0.5; }
  return { id: 'BRU9999', name: 't', family: 'steel-deck', x, y, s, h, halfWidth: hw, water: [6, 14], deck: [4, 16], bbox: [0, -3, 20, 3], ...(sides ? { sides } : {}) };
}

test('survey edges: the deck reaches the deck-level polygons, capped by the outline, only over its span', () => {
  const onDeck = (x: number, y: number) => x >= 3 && x <= 17 && y >= -2 && y <= 7;
  const free = surveyDeckEdges(deck(), onDeck)!;
  assert.equal(free.left[20], 3 + EDGE_NO_OUTLINE_M, 'no outline side: at most half-width + 2 m');
  assert.equal(free.right[20], 3, 'never narrower than the half-width');
  assert.equal(free.left[0], 3, 'the approach keeps its half-width');
  const wide = surveyDeckEdges(deck([9, 3]), onDeck)!;
  assert.equal(wide.left[20], 7.25, 'the last deck-level point plus half a step');
  assert.equal(surveyDeckEdges(deck([9, 3]), (x, y) => Math.abs(y) <= 3), null, 'a survey no wider than the deck leaves it as it was');
  assert.deepEqual(edgesBox(deck(), wide), [-4.25, -7.25, 24.25, 7.25]);
});

test('the riding surface and the footprint read the edges on their side', () => {
  const p = deck([9, 3]), edges = surveyDeckEdges(p, (x, y) => y >= -2 && y <= 7)!;
  const d: DeckSurface = { profile: { ...p, edges }, z: new Float64Array(41).fill(1), ends: [0, 0], span: [4, 16], ease: [2.5, 2.5] };
  assert.equal(GroundSurface.locate(d, 10, 6).halfWidth, 7.25, 'left of the line: the left edge');
  assert.equal(GroundSurface.locate(d, 10, -5).halfWidth, 3, 'right of the line: the half-width');
  const ring = GroundSurface.footprint(d);
  assert.equal(Math.max(...ring.map(q => q[1])), 7.25);
  assert.equal(Math.min(...ring.map(q => q[1])), -3);
  const plain: DeckSurface = { ...d, profile: p };
  assert.equal(GroundSurface.locate(plain, 10, 6).halfWidth, 3, 'without edges: unchanged');
});

test('a deck polygon half on a deck is drawn, without its triangles over a ground polygon', () => {
  // Two triangles of a 10 x 10 square: the left one (centroid x < 5) on the deck, the right one over a ground polygon.
  const flat = [0, 0, 10, 0, 10, 10, 0, 10], tris = [0, 2, 3, 0, 1, 2];
  const onDeck = (x: number) => x < 5, overGround = (x: number) => x >= 5;
  assert.deepEqual(deckShare(flat, tris, onDeck, overGround), [0, 2, 3]);
  assert.equal(deckShare(flat, tris, () => false, () => false), null, 'off every deck: not drawn');
});

test('dryWayDeckProfile: a deck over the dry run, ends open, no water, a claim inside keeps it off', async () => {
  const { dryWayDeckProfile } = await import('./wayDecks.js');
  const w = { id: 1, name: 'busway', points: [[0, 0], [60, 0]] as [number, number][], halfWidth: 3 };
  const dry = (x: number) => x >= 10;
  const p = dryWayDeckProfile(w, dry, () => false);
  assert.ok(p, 'a deck');
  assert.equal(p!.id, 'OSM1');
  assert.equal(p!.water, null);
  // the run reaches the way's end (open end: a bus station deck carries on past it)
  assert.ok(p!.deck[1] >= 59, `deck to the end: ${p!.deck}`);
  assert.equal(dryWayDeckProfile(w, dry, (x) => x > 30 && x < 32), null);
});

test('survey edges stop at ground-level survey and reach farther with capM (dry way decks)', () => {
  const onDeck = (x: number, y: number) => x >= 3 && x <= 17 && y >= -2 && y <= 15;
  const stopped = surveyDeckEdges(deck([12, 3]), onDeck, (x, y) => y > 5)!;
  assert.equal(stopped.left[20], 5.25, 'the walk stops where the survey says ground');
  assert.equal(surveyDeckEdges(deck(), onDeck)!.left[20], 3 + EDGE_NO_OUTLINE_M, 'no outline: capped at half-width + 2 m');
  assert.equal(surveyDeckEdges(deck(), onDeck, undefined, 20)!.left[20], 15.25, 'capM: out to the polygon');
});

test('narrowDryDeck: a dry way deck keeps a core half-width so the survey polygon, not the OSM width, sets the sides (Ringweg-Zuid 7381715)', async () => {
  const { dryWayDeckProfile, narrowDryDeck, DRY_CORE_HALF_M } = await import('./wayDecks.js');
  const wide = dryWayDeckProfile({ id: 7, name: 'ring', points: [[0, 0], [60, 0]] as [number, number][], halfWidth: 10 }, () => true, () => false)!;
  narrowDryDeck(wide);
  assert.ok(wide.halfWidth.every(h => h === DRY_CORE_HALF_M), 'narrowed to the core');
  assert.equal(wide.sides, undefined);
  assert.ok(wide.bbox[3] - wide.bbox[1] <= 2 * DRY_CORE_HALF_M + 1e-9, 'the box shrinks with it');
  // surveyDeckEdges then walks out from the core: it stops at ground-level road (y > 5) instead of the OSM half-width of 10
  const edges = surveyDeckEdges(wide, (x, y) => y >= -2 && y <= 5, (x, y) => y > 5, 20)!;
  assert.ok(edges.left[40] > 4.5 && edges.left[40] <= 5.5, `left edge ${edges.left[40]}`);
  const narrow = dryWayDeckProfile({ id: 8, name: 'busway', points: [[0, 0], [60, 0]] as [number, number][], halfWidth: 1 }, () => true, () => false)!;
  narrowDryDeck(narrow);
  assert.ok(narrow.halfWidth.every(h => h === 1), 'a narrower way is left alone');
});

test('survey caps: a half-width far past the deck polygons over open water is capped there (Rijckerbrug BRU0167, 8b91c88c)', () => {
  const p = deck(), wide = { ...p, halfWidth: new Float64Array(41).fill(9) };
  // Deck polygons reach 3 m right of the line and 9 m left; nothing surveyed beyond on the right (water); a quay polygon
  // beyond 3 m at the span's last metre (s 15.5..16).
  const onDeck = (x: number, y: number) => y >= -3 && y <= 9;
  const surveyed = (x: number, y: number) => onDeck(x, y) || (x >= 15.5 && y < -3);
  const caps = surveyDeckCaps(wide, onDeck, surveyed)!;
  assert.equal(caps.right[20], 3.5, 'the last deck-level point plus a step');
  assert.equal(caps.left[20], Infinity, 'the left side reaches its half-width: no cap');
  assert.equal(caps.right[32], 3.5, 'a span end whose outside meets the quay takes the neighbours\' cap');
  assert.equal(caps.right[0], Infinity, 'off the span: no cap');
  assert.equal(surveyDeckCaps(wide, (x, y) => Math.abs(y) <= 8, (x, y) => Math.abs(y) <= 8), null, 'a survey within CAP_MIN_M of the half-width: no caps');
  assert.equal(surveyDeckCaps(wide, onDeck, () => true), null, 'surveyed beyond everywhere (no open water): no caps');
});

test('survey caps: no cap where deck-level survey lies farther out within the half-width (two bridges on one profile, BRU0420)', () => {
  const p = { ...deck(), halfWidth: new Float64Array(41).fill(12) };
  const onDeck = (x: number, y: number) => (y >= -3 && y <= 3) || (y <= -8 && y >= -11.5);
  const caps = surveyDeckCaps(p, onDeck, onDeck)!;
  assert.equal(caps.right[20], Infinity, 'the second bridge 5 m beyond the water gap: the right side keeps its half-width');
  assert.equal(caps.left[20], 3.5, 'nothing farther out on the left: capped');
});
