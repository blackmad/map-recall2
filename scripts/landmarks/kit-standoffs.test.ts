import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archWindows, frameOf, sashWindows} from './nearbar-kit';
import {curtainOnWall, punchedFacade, windowRow} from './modern-kit';
import {edgeWindow, type Edge} from './civic-kit';
import {wallBetween} from './worship-kit';
import type {Wall} from './worship-walls';
import {archedPane, edgeFrame, windowPane} from './historic-shared';
import {VENUE_WINDOW} from './venue-builders';

/**
 * Pins the z-fight standoffs of the shared window/band helpers. Every helper is drawn on an axis-aligned wall whose outward
 * normal is +z, through a recording BuildingTools; each emitted solid's front (max z) and back (min z) plane is checked.
 *
 * The coplanar-overlap audit counts two parallel same-facing faces of different materials when they are 0-3 cm apart
 * (0-2 cm `zfight-m2`, 2-3 cm `zfight-tight-m2`). Before 2026-10-20 these helpers stacked their frame, glass and glazing bars
 * 2-3 cm apart (nearbar archWindows 8/11/14, sashWindows 7/10/13, modern-kit curtain spandrel 9.6/12 and punched stripe
 * 14/17, civic-kit bars 11/9, historic-shared panes 3/5/6.5, venue sill 20/18.5), which is the survey's
 * `window/frame 2-3 cm proud of an unholed wall` cause on every model that uses them.
 */

type Solid = {min: T.Vector3; max: T.Vector3; colour: string};

function record() {
  const solids: Solid[] = [];
  const add: BuildingTools['add'] = (g, c, x = 0, y = 0, z = 0, a = 0) => {
    g.rotateY(a); g.translate(x, y, z); g.computeBoundingBox();
    solids.push({min: g.boundingBox!.min.clone(), max: g.boundingBox!.max.clone(), colour: c});
  };
  const no = () => { throw new Error('unused primitive'); };
  const b: BuildingTools = {add, box: (x, y, z, w, h, d, c, a = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, a), prism: no, gableRoof: no, hip: no, window: no, clock: no, sign: no};
  return {b, solids};
}

/** A wall running +x with outward normal +z, so every helper's `out` becomes world +z and the wall plane is z = 0. */
const plusZWall = (length: number, h: number): Wall => wallBetween([0, 0], [length, 0], h, [0, 1]);

/** Footprint overlap (both helpers build boxes; a plane has zero depth). */
const overlaps = (a: Solid, b: Solid) =>
  Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.01 && Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.01;

/**
 * Rules the shared helpers must satisfy (they match the coplanar-overlap audit's 3 cm tight band and its same-material
 * exemption):
 *  1. no visible back plane may stop in the 0-3 cm band over the wall: a sheet that does not reach the wall (min z <= 0)
 *     must start at least 4.5 cm out, so it cannot pair with the wall;
 *  2. every visible front stands at least 6 cm off the wall;
 *  3. two different materials whose faces overlap in the wall plane keep their fronts at least 3 cm apart.
 */
function check(solids: Solid[], what: string) {
  const sunk = solids.filter(s => s.min.z > 1e-6 && s.min.z < 0.045).map(s => `${s.colour} back ${(s.min.z * 100).toFixed(1)} cm`);
  assert.deepEqual(sunk, [], `${what}: a back plane stops inside the 3 cm band`);
  const low = solids.filter(s => s.max.z > 0 && s.max.z < 0.06).map(s => `${s.colour} front ${(s.max.z * 100).toFixed(1)} cm`);
  assert.deepEqual(low, [], `${what}: a visible front stands under 6 cm off the wall`);
  const tight: string[] = [];
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    const a = solids[i], b = solids[j];
    if (a.colour === b.colour || !overlaps(a, b)) continue; // same material cannot show
    const gap = Math.abs(a.max.z - b.max.z);
    if (gap < 0.03) tight.push(`${a.colour}/${b.colour} fronts ${(gap * 100).toFixed(1)} cm apart`);
  }
  assert.deepEqual(tight, [], `${what}: faces inside the 3 cm band`);
}

test('nearbar archWindows: frame 8 cm, glass 13 cm, bars 18 cm, sill 20 cm', () => {
  const {b, solids} = record();
  archWindows(b, frameOf(plusZWall(12, 8)), [2, 5, 8], {y: 1.2, w: 1.6, h: 2.4, bars: 1, rows: 2, sill: 'stone'});
  check(solids, 'archWindows');
  const front = (c: string) => Math.max(...solids.filter(s => s.colour === c).map(s => s.max.z));
  assert.ok(Math.abs(front('glass') - 0.13) < 1e-6, `glass ${front('glass')}`);
  assert.ok(Math.abs(front('white') - 0.18) < 1e-6, `bars ${front('white')}`);
});

test('nearbar sashWindows: frame 7 cm, glass 12 cm, bars 17 cm', () => {
  for (const lean of [false, true]) {
    const {b, solids} = record();
    sashWindows(b, frameOf(plusZWall(10, 7)), [2, 5, 8], {y: 1, w: 1.4, h: 2, cols: 2, rows: 3, sill: 'stone', lintel: 'stone', lean});
    check(solids, `sashWindows${lean ? ' (lean)' : ''}`);
    const front = (c: string) => Math.max(...solids.filter(s => s.colour === 'glass').map(s => s.max.z));
    assert.ok(Math.abs(front('glass') - 0.12) < 1e-6, `glass ${front('glass')}`);
  }
});

test('modern-kit punchedFacade: glass 9 cm, band 15 cm, stripe 20 cm', () => {
  const {b, solids} = record();
  punchedFacade(b, plusZWall(24, 20), {y0: 4, pitch: 3.4, colPitch: 2.6, winW: 1.4, winBottom: 0.9, winH: 2.1, band: 'brick', stripe: 'red', glass: 'glass'});
  check(solids, 'punchedFacade');
  const front = (c: string) => Math.max(...solids.filter(s => s.colour === c).map(s => s.max.z));
  assert.ok(Math.abs(front('glass') - 0.09) < 1e-6, `glass ${front('glass')}`);
  assert.ok(Math.abs(front('brick') - 0.15) < 1e-6, `band ${front('brick')}`);
  assert.ok(Math.abs(front('red') - 0.2) < 1e-6, `stripe ${front('red')}`);
});

test('modern-kit curtainOnWall: spandrel 5.5 cm behind the mullion face, coping 10 cm over the roof', () => {
  const {b, solids} = record();
  curtainOnWall(b, plusZWall(20, 18), {bayW: 2.5, floorH: 3.4, spandrelH: 1.1, y0: 4, spandrel: 'brick', mullion: 'frame', depth: 0.12, cap: 'stone'});
  check(solids, 'curtainOnWall');
  const cap = solids.filter(s => s.colour === 'stone').sort((a, c) => c.max.y - a.max.y)[0];
  assert.ok(cap, 'draws the coping band');
  assert.ok(cap.max.y - 18 >= 0.1 - 1e-6, `coping top ${cap.max.y.toFixed(3)} is under 10 cm above the 18 m roof`);
});

test('modern-kit windowRow keeps its frame/glass layers (10 / 16 cm)', () => {
  const {b, solids} = record();
  windowRow(b, plusZWall(14, 9), {n: 4, y: 4, h: 1.8, wd: 1.2, glass: 'glass', frame: 'frame'});
  check(solids, 'windowRow');
});

test('civic-kit edgeWindow: glazing bars 5.5 cm in front of the glass', () => {
  const {b, solids} = record();
  // A wall edge running +x with its outward normal +z, so `off` is world +z and `angle` is 0.
  const edge: Edge = {p: new T.Vector2(0, 0), q: new T.Vector2(10, 0), u: new T.Vector2(1, 0), out: new T.Vector2(0, 1), len: 10, angle: 0, mid: new T.Vector2(5, 0)};
  edgeWindow(b, edge, 5, 1, 1.4, 2, {mullions: 2});
  check(solids, 'edgeWindow');
  const front = (c: string) => Math.max(...solids.filter(s => s.colour === c).map(s => s.max.z));
  assert.ok(Math.abs(front('glass') - 0.12) < 1e-6, `glass ${front('glass')}`);
  assert.ok(front('white') - front('glass') >= 0.04, `bars ${front('white')} vs glass ${front('glass')}`);
});

test('venue-builders win: the sill stands 4.5 cm in front of the pane', () => {
  assert.ok(VENUE_WINDOW.sillDepth / 2 - VENUE_WINDOW.paneFront >= 0.04, `sill front ${VENUE_WINDOW.sillDepth / 2} vs pane ${VENUE_WINDOW.paneFront}`);
  assert.ok(VENUE_WINDOW.paneFront >= 0.06, 'the pane itself stands >= 6 cm off the wall');
});

test('historic-shared windowPane / archedPane: frame 8 cm, glass 12.5 cm, bars 17 cm', () => {
  for (const arched of [false, true]) {
    const {b, solids} = record();
    // Wound so edge 0's outward side is +z (a building on the -z side): edgeFrame flips a frame whose outward probe
    // lands inside the ring, and a flipped frame mirrors `out` onto world -z, where this recorder's front test would
    // read the solid's back face instead.
    const f = edgeFrame(b, [[0, 0], [12, 0], [12, -8], [0, -8], [0, 0]], 0);
    if (arched) archedPane(b, f, 6, 1.5, 1.2, 2.4); else windowPane(b, f, 6, 1.5, 1.2, 2.4, {sill: 'stone'});
    check(solids, arched ? 'archedPane' : 'windowPane');
  }
});
