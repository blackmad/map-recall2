// The crossing register (crossings.ts, lane G3): schema validation, the register files, and what the game takes from
// a record (spans, cuts, portals), byte-identical where no record lies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CROSSINGS, crossingIndex, runtimeOf, floorCaps, gameDefaults, validateFile, validateRecord, type CrossingRecord, type LngLat } from './crossings';
import type { Cut } from './tunnels';
import { AUTHORED, CROSSING_FILES } from './crossingFiles';
import type { Vec2 } from './surface';

// A flat local frame: 1e-5 degrees = 1 m both ways around (4.85, 52.34).
const O: LngLat = [4.85, 52.34];
const ll = (x: number, y: number): LngLat => [O[0] + x * 1e-5, O[1] + y * 1e-5];
const project = (p: LngLat): Vec2 => [(p[0] - O[0]) * 1e5, (p[1] - O[1]) * 1e5];
const box = (x0: number, y0: number, x1: number, y1: number): LngLat[] => [ll(x0, y0), ll(x1, y0), ll(x1, y1), ll(x0, y1)];

function record(over: Partial<CrossingRecord> = {}): CrossingRecord {
  return {
    id: 'test-rail-over-path', label: 'a path under a rail deck', area: 'named', kind: 'rail-over-road', at: ll(0, 0),
    zone: box(-20, -20, 20, 20),
    plan: { decks: [{ ring: box(-15, -6, 15, 6), carries: 'rail', axisDeg: 90, bgt: ['L0004.test'] }] },
    heights: { streetUnder: 0.5, deckTop: 6.1, soffit: 5.0, soffitEstimated: true },
    binds: { over: [1], under: [2], bgt: ['L0004.test'] },
    evidence: { sources: ['BGT overbruggingsdeel L0004.test'], ortho: ['crop'], panoramas: ['TMX-test'], notes: '' },
    reviewed: { by: 'test', on: '2026-11-10', verdict: 'confirmed' },
    ...over,
  };
}

/** A straight cut along x from x0 to x1 at y, stations every 2 m, portals at the listed ends. */
function cut(x0: number, x1: number, y: number, portals: number[] = []): Cut {
  const x: number[] = [];
  for (let v = x0; v <= x1 + 1e-9; v += 2) x.push(v);
  const n = x.length, k = (v: number) => Array(n).fill(v);
  return {
    id: 'c', way: 7, kind: 'slot', motor: false, x, y: k(y), s: x.map(v => v - x0), floor: k(-2), left: k(3), right: k(3), wallL: k(1), wallR: k(1), rimL: k(1), rimR: k(1),
    portals: portals.map(at => ({ at: at < 0 ? n - 1 : at, dir: [1, 0] as Vec2, top: 1 })), bbox: [x0 - 10, y - 10, x1 + 10, y + 10],
  };
}

test('register files: every record validates, ids are unique across files', () => {
  const ids = new Set<string>();
  for (const f of CROSSING_FILES) {
    assert.deepEqual(validateFile(f), [], f.area);
    for (const r of f.records) { assert.ok(!ids.has(r.id), `duplicate ${r.id}`); ids.add(r.id); }
  }
  assert.equal(AUTHORED.length, ids.size);
});

test('the runtime extract is runtimeOf(the authored files) (regenerate: npx tsx scripts/crossings/compose.ts --runtime)', () => {
  assert.deepEqual(CROSSINGS, runtimeOf(AUTHORED).records);
  // Only what the game reads: no evidence, binds, piers or labels.
  for (const r of CROSSINGS) for (const k of ['evidence', 'binds', 'label', 'disagreements']) assert.ok(!(k in r), `${r.id}.${k}`);
  for (const r of CROSSINGS) assert.ok(!('piers' in r.plan) && !('walls' in r.plan) && !('tunnels' in r.plan), r.id);
});

test('validateRecord catches what a hand edit breaks', () => {
  assert.deepEqual(validateRecord(record()), []);
  assert.match(validateRecord(record({ id: 'Bad Id' })).join(), /kebab/);
  assert.match(validateRecord(record({ at: ll(100, 100) })).join(), /outside its zone/);
  assert.match(validateRecord(record({ plan: { decks: [{ ring: box(-15, -6, 15, 6), carries: 'road' }] } })).join(), /carries rail/);
  assert.match(validateRecord(record({ heights: { streetUnder: 7, soffit: 5, deckTop: 6 } })).join(), /soffit under the street/);
  assert.match(validateRecord(record({ evidence: { sources: ['x'], ortho: [], panoramas: [], notes: '' } })).join(), /without an orthophoto/);
  assert.match(validateRecord(record({ kind: 'bogus' as never })).join(), /unknown kind/);
});

test('an empty register changes nothing (byte-identical)', () => {
  const idx = crossingIndex([], project);
  assert.equal(idx.size, 0);
  const spans = [{ s0: 1, s1: 9, clear: 2, at: [0, 0] as Vec2 }];
  assert.deepEqual(idx.spans([[-50, 0], [50, 0]], spans, false), spans);
  const c = cut(-30, 30, 0, [0]);
  assert.deepEqual(idx.cuts([c]), [c]);
});

test('drafts act only when asked (an unreviewed record is a guess like the inference)', () => {
  assert.equal(crossingIndex([record({ reviewed: null })], project).size, 0);
  assert.equal(crossingIndex([record({ reviewed: null })], project, { drafts: true }).size, 1);
});

test('spans: a rail-over-road record replaces the inferred span with its rail deck', () => {
  const idx = crossingIndex([record()], project);
  const track: Vec2[] = [[-60, 0], [60, 0]];
  // The inference's false 73 m span triggered inside the zone goes; the deck (x -15..15) becomes the span.
  const out = idx.spans(track, [{ s0: 20, s1: 93, clear: 0.4, at: [0, 0] }], false);
  assert.equal(out.length, 1);
  assert.ok(Math.abs(out[0].s0 - 45) <= 1 && Math.abs(out[0].s1 - 75) <= 1, JSON.stringify(out));
  assert.equal(out[0].clear, 5.6);
  // A span outside every zone stays.
  const far = { s0: 0, s1: 4, clear: 2, at: [-58, 0] as Vec2 };
  assert.deepEqual(idx.spans(track, [far], false).filter(s => s.at === far.at), [far]);
  // A bridge way gets no record span (it is a deck already).
  assert.deepEqual(idx.spans(track, [], true), []);
  // A track beside the deck, not through it, gets none.
  assert.deepEqual(idx.spans([[-60, 9], [60, 9]], [], false), []);
  // A track crossing under the deck (the museum tram under the Kranenbergpad ring decks, north-south) gets none.
  assert.deepEqual(idx.spans([[0, -60], [0, 60]], [], false), []);
  assert.match(validateRecord(record({ plan: { decks: [{ ring: box(-15, -6, 15, 6), carries: 'rail' }] } })).join(), /axisDeg/);
});

test('spans: a track at street level under a rail deck gets no span (Kimpoweg tram under the Sloterdijk metro viaduct, #13)', () => {
  const idx = crossingIndex([record()], project);
  const track: Vec2[] = [[-60, 0], [60, 0]];
  // record(): street 0.5, deck top 6.1 NAP; midway 3.3 NAP = scene 1.93. A bed at scene -0.9 (0.47 NAP) is the street's.
  assert.deepEqual(idx.spans(track, [], false, () => -0.9), []);
  // A bed at the deck (scene 4.7 = 6.07 NAP) is on it.
  assert.equal(idx.spans(track, [], false, () => 4.7).length, 1);
  // No level given: the deck alone decides (as before).
  assert.equal(idx.spans(track, [], false).length, 1);
});

test('spans: a level record drops the inferred span and makes none', () => {
  const idx = crossingIndex([record({ kind: 'level', plan: { decks: [] } })], project);
  assert.deepEqual(idx.spans([[-60, 0], [60, 0]], [{ s0: 20, s1: 93, clear: 0.4, at: [0, 0] }], false), []);
});

test('cuts: a none record removes a cut inside its zone; a partial overlap is sliced; portals filtered', () => {
  const none = crossingIndex([record({ id: 'no-crossing', kind: 'none', plan: { decks: [] } })], project);
  const stats = { dropped: 0, sliced: 0, portalsDropped: 0 };
  assert.deepEqual(none.cuts([cut(-10, 10, 0, [0, -1])], stats), []);
  assert.equal(stats.dropped, 1);
  // A cut from x=-60 to 10: 15 of 36 stations lie in the zone (x >= -20): sliced to x <= -22, its far portal kept.
  const sliced = none.cuts([cut(-60, 10, 0, [0, -1])], stats);
  assert.equal(sliced.length, 1);
  assert.ok(Math.max(...sliced[0].x) < -20 && Math.min(...sliced[0].x) === -60);
  assert.equal(sliced[0].portals.length, 1);
  assert.equal(sliced[0].x.length, sliced[0].floor.length);
  // A cut outside the zone is the same object.
  const away = cut(100, 140, 0, [0]);
  assert.equal(none.cuts([away])[0], away);
});

test('cuts: a road-under record keeps the slot but only its listed portals', () => {
  const r = record({ id: 'slot', kind: 'road-under', plan: { decks: [], portals: [{ at: ll(-10, 0), headingDeg: 90 }] } });
  assert.deepEqual(gameDefaults('road-under'), { cuts: 'keep', portals: 'listed' });
  const idx = crossingIndex([r], project);
  const stats = { dropped: 0, sliced: 0, portalsDropped: 0 };
  const out = idx.cuts([cut(-10, 10, 0, [0, -1])], stats);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].portals.map(p => out[0].x[p.at]), [-10]);
  assert.equal(stats.portalsDropped, 1);
  // `game.portals: 'none'`: no mouth at all; 'keep': both.
  assert.equal(crossingIndex([{ ...r, game: { portals: 'none' } }], project).cuts([cut(-10, 10, 0, [0, -1])])[0].portals.length, 0);
  assert.equal(crossingIndex([{ ...r, game: { portals: 'keep' } }], project).cuts([cut(-10, 10, 0, [0, -1])])[0].portals.length, 2);
});

test('floorCaps: reviewed decks with a street level, never for level or none records', () => {
  const caps = floorCaps([record(), record({ id: 'lvl', kind: 'level' }), record({ id: 'draft', reviewed: null })], project);
  assert.deepEqual(caps.map(c => c.id), ['test-rail-over-path']);
  assert.equal(caps[0].streetNAP, 0.5);
  assert.equal(caps[0].rings[0].length, 4);
});
