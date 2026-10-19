import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addBays, type Wall} from './worship-walls';
import {archWindow, wallBetween} from './worship-kit';

/**
 * Pins the z-fight standoffs of the shared worship window helpers. A wall whose outward normal is +z is built, the helper
 * draws onto it through a recording BuildingTools, and each emitted solid's front/back plane (along the wall normal, i.e.
 * world z) is checked. Before 2026-10-19 `addBays` put its glass and glazing bars 2 cm proud of the wall and its sills flush
 * on it, and `archWindow` stacked the glass, mullion and transom backs on one plane (0.10) with their fronts 2 cm proud of
 * the glass — all of which the landmark coplanar-overlap audit flagged. After the fix every visible front stands >= 6 cm off
 * and no two overlapping layers share a back plane.
 */

function record() {
  const solids: {min: T.Vector3; max: T.Vector3; colour: string}[] = [];
  const add: BuildingTools['add'] = (g, c, x = 0, y = 0, z = 0, a = 0) => {
    g.rotateY(a); g.translate(x, y, z); g.computeBoundingBox();
    solids.push({min: g.boundingBox!.min.clone(), max: g.boundingBox!.max.clone(), colour: c});
  };
  const no = () => { throw new Error('unused primitive'); };
  const b: BuildingTools = {add, box: (x, y, z, w, h, d, c, a = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, a), prism: no, gableRoof: no, hip: no, window: no, clock: no, sign: no};
  return {b, solids};
}

/** A wall running +x with outward normal +z (so the kit's `out` becomes world +z, the wall plane z = 0). */
function plusZWall(length: number, h: number): Wall {
  return wallBetween([0, 0], [length, 0], h, [0, 1]);
}

const fronts = (s: {min: T.Vector3; max: T.Vector3; colour: string}[]) => s.map(x => x.max.z);
const backs = (s: {min: T.Vector3; max: T.Vector3; colour: string}[]) => s.map(x => x.min.z);

test('addBays stands every sill, lintel, pane and bar >= 6 cm proud and sinks every back behind the wall', () => {
  const {b, solids} = record();
  const placed = addBays(b, plusZWall(12, 11), {y: 0, h: 2.5, wd: 2.5, pitch: 3.4, margin: 0.9, trim: 'frame', frame: 'frame'});
  assert.equal(placed, 3, 'three bays on a 12 m wall');
  for (const s of solids) {
    assert.ok(s.max.z >= 0.06, `front ${s.max.z.toFixed(3)} < 6 cm proud`);
    assert.ok(s.min.z <= -0.04, `${s.colour} back ${s.min.z.toFixed(3)} is not sunk behind the wall`);
  }
  const glass = solids.filter(s => s.colour === 'glass');
  assert.ok(glass.length > 0, 'draws glass panes');
  for (const g of glass) assert.ok(g.max.z >= 0.10 - 1e-6, `glass front ${g.max.z.toFixed(3)} < 10 cm (was 2 cm before the fix)`);
  // The sill/lintel fronts stay at their legacy 16 cm; nothing regressed to the old 2 cm proud glass/frame.
  assert.ok(fronts(solids).every(f => f <= 0.17), 'no part grows past its legacy front height');
});

test('archWindow separates the surround, glass and glazing bars so no layer shares a plane', () => {
  const {b, solids} = record();
  archWindow(b, plusZWall(10, 12), 5, 2, 1.6, 3.2, {trim: 'stone', mullions: 1});
  const glass = solids.find(s => s.colour === 'glass')!;
  const trim = solids.filter(s => s.colour === 'stone');
  const bars = solids.filter(s => s.colour === 'frame');
  assert.ok(glass, 'draws a glass pane');
  assert.ok(trim.length && bars.length, 'draws a surround and glazing bars');
  // Every layer stands >= 6 cm proud of the wall.
  for (const s of solids) assert.ok(s.max.z >= 0.06, `front ${s.max.z.toFixed(3)} < 6 cm`);
  // The glass no longer shares its back plane with the bars (the old flush frame/glass z-fight): the glass back sits well
  // inside the surround reveal and the bars sink behind it, each at a distinct depth.
  const glassBack = glass.min.z;
  for (const bar of bars) assert.ok(Math.abs(bar.min.z - glassBack) > 0.02, `bar back ${bar.min.z.toFixed(3)} shares the glass back plane ${glassBack.toFixed(3)}`);
});
