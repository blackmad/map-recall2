import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoadSnapIndex, snapToRoad, projectToWorld } from './roadProjection.ts';

test('indexed snaps exactly match full scans, including ties, no limit and long spans', () => {
  const centre = { lat: 52.37, lon: 4.89 }, offset = { x: 100, y: -230 };
  const segments: Array<{points: Array<{x:number;y:number}>}> = [];
  let seed = 12345;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2**32; };
  for (let n = 0; n < 450; n++) {
    const x = random()*30000-15000, y = random()*30000-15000;
    segments.push({ points: [{ x, y }, { x: x+random()*800-400, y: y+random()*800-400 }] });
  }
  segments.push({ points: [{x:-30000,y:30},{x:30000,y:30}] }, { points: [{x:0,y:0},{x:0,y:0}] });
  const index = new RoadSnapIndex(segments);
  for (let n = 0; n < 500; n++) {
    const point = { lat: centre.lat + (random()-.5)*.14, lon: centre.lon+(random()-.5)*.24 };
    for (const limit of [false, 0, 240, 800, Infinity] as const)
      assert.deepEqual(snapToRoad(point,centre,offset,segments,limit,index), snapToRoad(point,centre,offset,segments,limit));
  }
  const tie = [{points:[{x:-10,y:-1},{x:10,y:-1}]},{points:[{x:-10,y:1},{x:10,y:1}]}];
  assert.deepEqual(new RoadSnapIndex(tie).nearest({x:0,y:0}), {x:0,y:-1,distance:1});
  assert.equal(new RoadSnapIndex([]).nearest(projectToWorld(centre,centre)), null);
});
