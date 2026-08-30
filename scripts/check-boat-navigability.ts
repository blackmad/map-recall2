// Can the boat actually get through?
//
// Reported from play: the boat stuck in the Stadionsluis. The routing graph was
// innocent — the lock shares exact vertices with Stadiongracht at both ends, so
// the router plans straight through it. What blocked the boat was the hull
// corridor: at a lock the basemap draws the structure over the water fill, so
// every hull point falls back to a distance-from-centreline test, and that test
// was narrower than the boat.
//
// These checks drive a boat along real extract geometry with the basemap
// reporting dry land — the worst case, and the actual case at a lock — and
// assert that a vessel following the centreline is never pinned.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  BEAM_CLEARANCE,
  boatFitsWater,
  corridorTolerance,
  hullHalfBeam,
  hullSamples,
  type BoatHull,
  type CorridorProbes,
  type NearestCentreline,
} from '../src/canalRecall/game/boatCorridor';
import type { WorldPoint } from '../src/canalRecall/game/worldTypes';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

// The game's actual numbers; see constants.js.
const PIXELS_PER_METER = 3;
const CANAL_WIDTH = 32;
const BOAT = { length: 56, width: 24 };
const HALF_BEAM = hullHalfBeam(BOAT);

// ---- The rule itself ----

check('the corridor admits the boat the game asks you to steer', () => {
  const tolerance = corridorTolerance(CANAL_WIDTH, HALF_BEAM);
  assert.ok(tolerance >= HALF_BEAM + BEAM_CLEARANCE,
    `a canal corridor of ${tolerance.toFixed(2)} px cannot fit a ${HALF_BEAM.toFixed(2)} px half-beam`);
  // The regression, stated in the numbers that caused it: the old rule was
  // min(width * 0.28, 13) = 8.96 px against an 8.16 px half-beam.
  const previous = Math.min(CANAL_WIDTH * 0.28, 13);
  assert.ok(previous - HALF_BEAM < 1,
    'sanity: the old rule really did leave under a pixel of margin');
  assert.ok(tolerance - HALF_BEAM > 5,
    `expected real steering margin, got ${(tolerance - HALF_BEAM).toFixed(2)} px`);
});

check('the corridor still stays inside the mapped water', () => {
  // It must never authorize roaming onto a quay or an adjacent block.
  for (const width of [32, 46, 50]) {
    const tolerance = corridorTolerance(width, HALF_BEAM);
    assert.ok(tolerance < width / 2,
      `a ${width} px way must not permit ${tolerance.toFixed(2)} px from its centreline`);
  }
});

check('a boat over a block is still refused', () => {
  // A straight canal running along y = 0, so distance from the centreline is
  // simply |y| — the bow and stern stay on it however long the hull is.
  const probes: CorridorProbes = {
    isWater: () => false,
    nearestCentreline: (_x, y) => ({ dist: Math.abs(y), width: CANAL_WIDTH }),
  };
  const onCentreline: BoatHull = { x: 0, y: 0, angle: 0, ...BOAT };
  assert.equal(boatFitsWater(onCentreline, probes), true);

  const overTheQuay: BoatHull = { x: 0, y: 30, angle: 0, ...BOAT };
  assert.equal(boatFitsWater(overTheQuay, probes), false,
    '30 px from any centreline is a building, not a canal');
});

check('unmapped water is refused rather than assumed', () => {
  const probes: CorridorProbes = { isWater: () => false, nearestCentreline: () => null };
  assert.equal(boatFitsWater({ x: 0, y: 0, angle: 0, ...BOAT }, probes), false);
});

check('the basemap outranks the fallback', () => {
  const probes: CorridorProbes = { isWater: () => true, nearestCentreline: () => null };
  assert.equal(boatFitsWater({ x: 9999, y: 9999, angle: 1, ...BOAT }, probes), true,
    'rendered water is water, wherever the centrelines are');
});

// ---- Driving real geometry ----

type LatLng = [number, number];
interface WaterFeature { name?: string; type?: string; path?: LatLng[]; paths?: LatLng[][] }

const extractPath = path.resolve('public/data/extracts/amsterdam/water.json');
const water: WaterFeature[] = fs.existsSync(extractPath)
  ? JSON.parse(fs.readFileSync(extractPath, 'utf8'))
  : [];

const CENTRE: LatLng = [52.3676, 4.9041];
function toWorld([lat, lng]: LatLng): WorldPoint {
  const metersPerLat = 111320, metersPerLng = 111320 * Math.cos(CENTRE[0] * Math.PI / 180);
  return {
    x: (lng - CENTRE[1]) * metersPerLng * PIXELS_PER_METER,
    y: -(lat - CENTRE[0]) * metersPerLat * PIXELS_PER_METER,
  };
}
const pathsOf = (f: WaterFeature): LatLng[][] => f.paths || (f.path ? [f.path] : []);

/** Every segment of every named way, in world pixels. */
function centrelines(features: WaterFeature[]): WorldPoint[][] {
  const lines: WorldPoint[][] = [];
  for (const feature of features) {
    for (const p of pathsOf(feature)) {
      if (p.length >= 2) lines.push(p.map(toWorld));
    }
  }
  return lines;
}

function nearestOn(lines: WorldPoint[][], x: number, y: number): NearestCentreline | null {
  let best = Infinity;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0
        : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
      const distance = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
      if (distance < best) best = distance;
    }
  }
  return Number.isFinite(best) ? { dist: best, width: CANAL_WIDTH } : null;
}

/**
 * How badly a real player steers. A boat held exactly on the centreline at
 * exactly the channel's bearing is not a test of anything: the old rule left
 * such a boat 0.80 px of margin, so it passed, while every actual player was
 * pinned. These are small errors — under two degrees of yaw and under a metre
 * of drift — and the corridor has to tolerate them.
 */
const STEERING_YAW = 0.03;      // radians, ~1.7 degrees
const STEERING_DRIFT = 2.5;     // px, ~0.8 m off the centreline

/** Every pose a boat might hold while following a channel: on line, drifting
 *  to either side, yawed either way. */
function poses(x: number, y: number, angle: number): BoatHull[] {
  const rightX = -Math.sin(angle), rightY = Math.cos(angle);
  const out: BoatHull[] = [];
  for (const drift of [0, STEERING_DRIFT, -STEERING_DRIFT]) {
    for (const yaw of [0, STEERING_YAW, -STEERING_YAW]) {
      out.push({
        x: x + rightX * drift, y: y + rightY * drift, angle: angle + yaw, ...BOAT,
      });
    }
  }
  return out;
}

/**
 * Drive a boat along a centreline, nose-first, sampling every few pixels and
 * every plausible steering pose. `isWater` returns false throughout: that is
 * what the basemap reports inside a lock or under a bridge deck, and it is the
 * case that stranded the player.
 */
function drive(
  line: WorldPoint[],
  lines: WorldPoint[][],
  fits: (boat: BoatHull, probes: CorridorProbes) => boolean = boatFitsWater,
  stepPixels = 6,
): { steps: number; blocked: number; firstFailureAt: WorldPoint | null } {
  const probes: CorridorProbes = {
    isWater: () => false,
    nearestCentreline: (x, y) => nearestOn(lines, x, y),
  };
  let steps = 0, blocked = 0;
  let firstFailureAt: WorldPoint | null = null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    for (let travelled = 0; travelled <= span; travelled += stepPixels) {
      const t = span === 0 ? 0 : travelled / span;
      for (const boat of poses(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, angle)) {
        steps++;
        if (!fits(boat, probes)) {
          blocked++;
          if (!firstFailureAt) firstFailureAt = { x: boat.x, y: boat.y };
        }
      }
    }
  }
  return { steps, blocked, firstFailureAt };
}

/** The rule the game used to apply: every hull point within
 *  min(width * 0.28, 13) px of a centreline. */
function fitsUnderOldRule(boat: BoatHull, probes: CorridorProbes): boolean {
  const tolerance = Math.min(CANAL_WIDTH * 0.28, 13);
  return hullSamples(boat).every(point => {
    if (probes.isWater(point.x, point.y)) return true;
    const near = probes.nearestCentreline(point.x, point.y);
    return !!near && near.dist <= tolerance;
  });
}

if (water.length === 0) {
  console.log('Boat navigability SKIPPED: water.json is not present.');
} else {
  const byName = (pattern: RegExp) => water.filter(f => pattern.test(f.name || ''));

  check('the Stadionsluis is navigable end to end', () => {
    // The reported strand. The lock and the gracht either side of it are one
    // continuous passage; a boat following it must never be pinned.
    const passage = [...byName(/^Stadionsluis$/), ...byName(/^Stadiongracht$/)];
    assert.ok(passage.length >= 2, 'the reported location is present in the extract');
    const lines = centrelines(passage);
    const lock = centrelines(byName(/^Stadionsluis$/));
    assert.ok(lock.length > 0, 'the lock has geometry');

    let steps = 0, blocked = 0;
    let firstFailureAt: WorldPoint | null = null;
    for (const line of lock) {
      const result = drive(line, lines);
      steps += result.steps;
      blocked += result.blocked;
      firstFailureAt = firstFailureAt || result.firstFailureAt;
    }
    assert.equal(blocked, 0,
      `boat pinned at ${blocked}/${steps} steps through the Stadionsluis`
      + (firstFailureAt ? ` (first at ${firstFailureAt.x.toFixed(0)},${firstFailureAt.y.toFixed(0)})` : ''));
  });

  check('every named lock in the extract is navigable', () => {
    // Locks are where the basemap most reliably hides the water, so they are
    // the systematic version of the reported bug.
    const locks = byName(/sluis/i);
    assert.ok(locks.length >= 10, `expected the extract's locks, found ${locks.length}`);
    const lines = centrelines(water);

    const stranded: string[] = [];
    for (const lock of locks) {
      for (const line of centrelines([lock])) {
        const result = drive(line, lines);
        if (result.blocked > 0) {
          stranded.push(`${lock.name} (${result.blocked}/${result.steps} steps)`);
          break;
        }
      }
    }
    assert.deepEqual(stranded, [], `boats are stranded in: ${stranded.join(', ')}`);
  });

  check('the old corridor really did strand the boat, so this is a regression test', () => {
    // If this ever stops failing under the old rule, the checks above have
    // stopped testing anything.
    const lines = centrelines([...byName(/^Stadionsluis$/), ...byName(/^Stadiongracht$/)]);
    let blocked = 0, steps = 0;
    for (const line of centrelines(byName(/^Stadionsluis$/))) {
      const result = drive(line, lines, fitsUnderOldRule);
      blocked += result.blocked;
      steps += result.steps;
    }
    assert.ok(blocked > 0,
      `the old corridor should strand the boat somewhere in ${steps} steps, but it did not`);
    console.log(`    (the old rule pinned the boat at ${blocked} of ${steps} poses through the Stadionsluis)`);
  });
}

console.log(`Boat navigability OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
