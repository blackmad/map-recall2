import test from 'node:test';
import assert from 'node:assert/strict';
import {emitStoop, placedSink, planStoop, soupSink, stoopBlocks, stoopProblems, STOOP, type StoopPart} from './stoop.ts';
import {guardRun, slopedRun, type RailSink} from './ironRailing.ts';

const ctx = {doorLeftM: 2, doorWidthM: 1.1, sillM: 1.62, frontWidthM: 6};
const front = {basement: 'stoop', doorBay: 1};
const side = {...ctx, doorLeftM: 3.2};

test('intent problems: shape, ranges, basement and door', () => {
  assert.deepEqual(stoopProblems({}, front, 'f'), []);
  assert.deepEqual(stoopProblems({flight: 'double', steps: 9, riseM: 0.18, treadM: 0.28, widthM: 1, landing: {depth: 1.2, width: 2}, material: 'stone', rail: 'iron', railStyle: 'ornate', under: 'door', zone: 2.5}, front, 'f'), []);
  assert.match(stoopProblems({flight: 'up'}, front, 'f')[0], /flight/);
  assert.match(stoopProblems({steps: 1}, front, 'f')[0], /steps: 2..16/);
  assert.match(stoopProblems({riseM: 0.3}, front, 'f')[0], /riseM/);
  assert.match(stoopProblems({landing: {depth: 3, width: 2}}, front, 'f')[0], /landing/);
  assert.match(stoopProblems({rail: 'stone', railStyle: 'bars'}, front, 'f')[0], /only an iron rail/);
  assert.match(stoopProblems({flight: 'side-left', widthM: 1.5, landing: {depth: 1, width: 2}}, front, 'f')[0], /beside its landing/);
  assert.match(stoopProblems({}, {basement: 'none', doorBay: 1}, 'f')[0], /needs basement/);
  assert.match(stoopProblems({}, {basement: 'stoop', doorBay: null}, 'f')[0], /needs a door/);
  assert.match(stoopProblems({colour: 'red'}, front, 'f')[0], /\{flight\?/);
});

test('the landing meets the door sill: steps x rise', () => {
  const ok = planStoop({steps: 9}, ctx);
  assert.equal(ok.problems.length, 0);
  assert.equal(ok.plan!.riseM, 0.18);
  assert.equal(ok.plan!.landing.top, 1.62);
  // Default steps: the sill over the default riser, rounded.
  assert.equal(planStoop({}, ctx).plan!.steps, 9);
  // Both given and they miss the sill by more than the tolerance.
  assert.match(planStoop({steps: 6, riseM: 0.18}, ctx).problems[0], /misses the door sill/);
  // Rise out of range for the step count.
  assert.match(planStoop({steps: 4}, ctx).problems[0], /rise 0.405/);
  assert.match(planStoop({}, {...ctx, sillM: 0}).problems[0], /not raised/);
});

test('front flight: treads step out from the landing; projection checked against the zone', () => {
  const {plan} = planStoop({flight: 'front', steps: 9}, ctx);
  const treads = plan!.boxes.filter(b => b.part === 'body' && b.z0 >= plan!.landing.depth - 1e-9);
  assert.equal(treads.length, 8);
  // The lowest tread is the furthest out; each is one riser higher than the one outside it.
  const sorted = [...treads].sort((a, b) => b.z1 - a.z1);
  sorted.forEach((t, k) => assert.ok(Math.abs(t.y1 - (k + 1) * 0.18) < 1e-9));
  assert.equal(plan!.projectionM, Math.round((0.9 + 8 * 0.28) * 1000) / 1000);
  assert.match(planStoop({flight: 'front', steps: 9, zone: 2.5}, ctx).problems[0], /past the 2.5 m stoep zone/);
  // Two raking guards with newels, landing returns on both sides.
  assert.equal(plan!.rails.filter(r => r.kind === 'flight').length, 2);
});

test('side and double flights climb along the wall and stay on the front', () => {
  const left = planStoop({flight: 'side-left', steps: 9, landing: {depth: 1.2, width: 1.5}}, side).plan!;
  assert.equal(left.projectionM, 1.2);
  assert.ok(left.extent[0] < side.doorLeftM - 2, 'the flight runs to the viewer\'s left');
  assert.ok(left.boxes.every(b => b.z1 <= 1.2 + 1e-9));
  const right = planStoop({flight: 'side-right', steps: 9, landing: {depth: 1.2, width: 1.5}}, side);
  assert.match(right.problems[0], /right flight .* past the front's right end/);
  const dbl = planStoop({flight: 'double', steps: 6}, {...ctx, sillM: 1.08, doorLeftM: 2.45});
  assert.equal(dbl.problems.length, 0);
  assert.equal(dbl.plan!.rails.filter(r => r.kind === 'flight').length, 2);
  // A side flight fits a pavement a front flight does not.
  assert.equal(planStoop({flight: 'side-left', steps: 9, zone: 1.3}, side).problems.length, 0);
});

test('under the landing: piers and an opening, or a solid body; a door needs headroom', () => {
  const door = planStoop({flight: 'side-left', under: 'door'}, side).plan!;
  const u = door.boxes.find(b => b.part === 'under')!;
  assert.ok(u.y1 <= ctx.sillM - STOOP.slabM - STOOP.underDoor.headroomM + 1e-9 && u.z1 <= 0.02 + 1e-9);
  assert.equal(door.boxes.filter(b => b.part === 'body' && b.y1 < ctx.sillM && b.z0 === 0 && b.x1 - b.x0 <= STOOP.pierM + 1e-9).length, 2);
  assert.match(planStoop({under: 'door'}, {...ctx, sillM: 1.0}).problems[0], /door under a 1 m landing/);
  assert.equal(planStoop({under: 'window'}, {...ctx, sillM: 1.0}).problems.length, 0);
  assert.equal(planStoop({}, ctx).plan!.boxes.filter(b => b.part === 'under').length, 0);
});

test('basement lights under the flight are reported as blocked', () => {
  const plan = planStoop({flight: 'side-left', steps: 9}, side).plan!;
  assert.deepEqual(stoopBlocks(plan, [{id: 'basement-b0', leftM: 0.3, widthM: 0.8, bottomM: 0.12}, {id: 's1-b0', leftM: 0.3, widthM: 0.8, bottomM: 2.6}]), ['basement-b0']);
});

test('geometry: closed soups, mirrored placement keeps the winding outward, stream mode is cheaper', () => {
  const {plan} = planStoop({flight: 'double', steps: 6, railStyle: 'ornate', under: 'window'}, {...ctx, sillM: 1.08, doorLeftM: 2.45});
  const soups: Record<StoopPart, number[]> = {body: [], iron: [], under: []};
  const n = emitStoop(plan!, {body: soupSink(soups.body), iron: soupSink(soups.iron), under: soupSink(soups.under)});
  assert.ok(n.body > 5 && n.iron > 20 && n.under === 1);
  for (const v of Object.values(soups)) { assert.equal(v.length % 9, 0); assert.ok(v.every(Number.isFinite)); }
  // Mirrored: every x maps to 6 - x, the triangle count is unchanged and the front faces still point out (+z).
  const m: number[] = [];
  emitStoop(plan!, {body: placedSink(soupSink(m), -1, 6), iron: placedSink(soupSink([]), -1, 6), under: placedSink(soupSink([]), -1, 6)});
  assert.equal(m.length, soups.body.length);
  const outward = (v: number[]) => { let k = 0; for (let i = 0; i < v.length; i += 9) { const e1 = [v[i + 3] - v[i], v[i + 4] - v[i + 1], v[i + 5] - v[i + 2]], e2 = [v[i + 6] - v[i], v[i + 7] - v[i + 1], v[i + 8] - v[i + 2]]; if (e1[0] * e2[1] - e1[1] * e2[0] > 1e-9) k++; } return k; };
  assert.equal(outward(m), outward(soups.body));
  let full = 0, stream = 0;
  const counter = (inc: (n: number) => void): RailSink => ({box: () => inc(8), quad: () => inc(2)});
  emitStoop(plan!, {body: counter(n => full += n), iron: counter(n => full += n), under: counter(n => full += n)});
  emitStoop(plan!, {body: counter(n => stream += n), iron: counter(n => stream += n), under: counter(n => stream += n)}, {stream: true});
  assert.ok(stream < full * 0.6, `stream ${stream} vs full ${full}`);
});

test('shared iron railing: the balcony guard and the raking guard', () => {
  const boxes: number[][] = [];
  const bars = guardRun((...a) => boxes.push(a.slice(0, 6) as number[]), {along: 'x', a: 0, c: 1.4, at: 0.7}, 3, 4, 'iron', 1);
  assert.equal(bars, 8);
  assert.equal(boxes.length, 2 + 8);
  let quads = 0, posts = 0;
  const members = slopedRun({box: () => posts++, quad: () => quads++}, [0, 0.18, 1], [2.24, 1.62, 1], 'bars');
  assert.equal(quads, 8, 'handrail and foot rail, four faces each');
  assert.ok(posts > 10 && members === posts + 2);
});
