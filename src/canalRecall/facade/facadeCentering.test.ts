import assert from 'node:assert/strict';
import { columnEdgeProfile, detectFacadeBounds, centreOffset } from './facadeCentering.ts';

const make = (width: number, height: number, fill: (x: number, y: number) => number) => {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = fill(x, y);
  return { data, width, height };
};

// A building run (strong vertical edges) in the middle, flat background at the sides.
const offsetBuilding = make(120, 60, (x) => (x >= 40 && x < 80 ? (x % 8 < 3 ? 60 : 200) : 150));
const bounds = detectFacadeBounds(columnEdgeProfile(offsetBuilding));
assert.ok(bounds, 'expected a building run');
assert.ok(bounds!.coverage > 0.2 && bounds!.coverage < 0.6, `coverage ${bounds!.coverage}`);
assert.ok(Math.abs((bounds!.leftPx + bounds!.rightPx) / 2 - 59.5) <= 3, `centre ${bounds!.centrePx}`);

// Expected centre 60 -> the building is roughly centred.
const centred = centreOffset(offsetBuilding, 60);
assert.ok(centred && Math.abs(centred.offsetPx) <= 3, `offset ${centred?.offsetPx}`);

// Expected centre 30 -> the building reads as shifted right by ~30 px.
const shifted = centreOffset(offsetBuilding, 30);
assert.ok(shifted && shifted.offsetPx > 20, `offset ${shifted?.offsetPx}`);

// A flat image has no run: cannot tell, never "centred".
assert.equal(detectFacadeBounds(columnEdgeProfile(make(60, 40, () => 128))), null);
assert.equal(centreOffset(make(60, 40, () => 128), 30), null);
assert.equal(columnEdgeProfile({ data: new Uint8Array(0), width: 0, height: 0 }).length, 0);

console.log('facade centering: run detection, offset direction and flat-field abstention passed.');
