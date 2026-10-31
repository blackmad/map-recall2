import assert from 'node:assert/strict';
// Pier-edge geometry runs under `npm run test:ferry` through this import.
import './pierEdge.test';
import type { FerryLink, Segment, Terminal } from './network';
import { afterFerryMove, beginFerryFrame, boardingTerminal, edgeBoarding, FERRY_SIZE, ferryMotionTrack, LAUNCH_REACH, LAUNCH_SWEEP, openWaterHeading, type FerryGame, type FerryPlayer } from './travel';

// Synthetic IJ: land south of y = -5 and north of y = -595; two piers, plus an
// unrelated third pier on the north bank. Pier A's stop sits on the quay edge
// (5 px from water), like Centraal F3 against the rendered water mask.
const A: Terminal = { id: 'A', name: 'South', x: 0, y: 0, land: { x: 0, y: 30 } };
const B: Terminal = { id: 'B', name: 'North', x: 0, y: -600, land: { x: 0, y: -630 } };
const C: Terminal = { id: 'C', name: 'Elsewhere', x: 400, y: -600, land: { x: 400, y: -630 } };
const link: FerryLink = { id: 'F:A:B', ref: 'F', from: A, to: B, points: [A, B] };
const other: FerryLink = { id: 'G:C:D', ref: 'G', from: C, to: { id: 'D', name: 'D', x: 800, y: 0, land: { x: 800, y: 30 } }, points: [] };
const segments: Segment[] = [
  { points: [A.land, A], type: 'ferry-access', width: 18, name: '', ferryTerminal: A },
  { points: [B.land, B], type: 'ferry-access', width: 18, name: '', ferryTerminal: B },
  { points: [A, B], type: 'ferry', width: 45, name: '', ferryLink: link },
  { points: [C, other.to], type: 'ferry', width: 45, name: '', ferryLink: other },
];
const water = (_x: number, y: number) => y < -5 && y > -595;

function game(player: Partial<FerryPlayer>): FerryGame {
  return {
    travelMode: 'car',
    player: { x: 0, y: 0, angle: -Math.PI / 2, speed: 20, vx: 0, vy: -20, maxSpeed: 300, length: 12, width: 5, ...player },
    track: {
      segments,
      // The access is the only nearby "road" in this fixture.
      getNearestRoad: (x, y) => (Math.hypot(x - A.x, y - A.y) < 40 ? { segIdx: 0 } : null),
    },
  };
}

// Riding off the end of the access towards the water boards the ferry, and
// launches the vessel on the nearest water, not on the quay.
const g = game({ x: 0, y: 2 });
assert.equal(beginFerryFrame(g, water), true, 'boards at the quay-edge pier heading into the water');
assert.equal(g.player.ferryOrigin?.id, 'A');
assert.equal(g.player.ferryDestinations, 'North');
assert.equal(g.player.length, FERRY_SIZE.length);
assert.equal(g.player.maxSpeed, 180);
assert.ok(water(g.player.x, g.player.y), 'launched on water');
assert.ok(Math.hypot(g.player.x, g.player.y) > 40 && Math.hypot(g.player.x, g.player.y) < 60, 'launched with the stern at the pier, hull afloat');

// Turning towards the water at a pier whose access runs along the quay still
// boards (Centraal F3); riding past parallel to the water does not.
assert.equal(beginFerryFrame(game({ x: 0, y: 2, angle: -Math.PI / 2 + 0.9 }), water), true, '52 degrees off the shore normal');
assert.equal(beginFerryFrame(game({ x: 0, y: 2, angle: 0 }), water), false, 'parallel to the quay');
assert.equal(beginFerryFrame(game({ x: 0, y: 2, angle: Math.PI }), water), false, 'parallel the other way');

// Centraal F3 (feedback 05a7d02a): a quay cycleway passes 1.6 m from the stop
// and is what the nearest-road lookup returns there. A rider at the stop
// facing the water boards all the same.
const quay = game({ x: 2.4, y: 1.5, angle: -Math.PI / 2 + 0.12 });
quay.track = { ...quay.track, segments: [...segments, { points: [{ x: -90, y: 5 }, { x: 90, y: 5 }], type: 'cycleway', width: 12, name: 'Quay' }],
  getNearestRoad: () => ({ segIdx: 4 }) };
assert.equal(beginFerryFrame(quay, water), true, 'boards beside a quay path the nearest-road lookup prefers');
assert.equal(quay.player.ferryOrigin?.id, 'A');

// Not when backing away from the water, stopped, short of the end, or not cycling.
assert.equal(beginFerryFrame(game({ x: 0, y: 2, angle: Math.PI / 2 }), water), false, 'facing land');
assert.equal(beginFerryFrame(game({ x: 0, y: 2, speed: 0 }), water), false, 'stopped');
assert.equal(beginFerryFrame(game({ x: 0, y: 20 }), water), false, 'short of the pier end');
assert.equal(beginFerryFrame({ ...game({ x: 0, y: 2 }), travelMode: 'boat' }, water), false, 'cycling only');

// A dry pier (no rendered water within reach) never boards; misses are retried sparingly.
const dry: Terminal = { id: 'dry', name: 'Dry', x: 0, y: 0, land: { x: 0, y: 30 } };
let probes = 0;
const counting = () => { probes++; return false; };
const dryAccess: Segment = { points: [dry.land, dry], type: 'ferry-access', width: 18, name: '', ferryTerminal: dry };
const rider = game({ x: 0, y: 2 }).player;
assert.equal(boardingTerminal(rider, dryAccess, counting), null);
const firstScan = probes;
for (let i = 0; i < 10; i++) boardingTerminal(rider, dryAccess, counting);
assert.equal(probes, firstScan, 'a dry pier is not rescanned every frame');

// Sailing onto an unrelated bank is blocked; open water is free.
g.player.x = 200; g.player.y = -300;
assert.equal(afterFerryMove(g, { x: 200, y: -290 }, water), 'sailing');
assert.equal(g.player.ferryDeparted, true);
g.player.x = 200; g.player.y = -598;
assert.equal(afterFerryMove(g, { x: 200, y: -590 }, water), 'blocked');
assert.deepEqual([g.player.x, g.player.y], [200, -590]);

// Any ferry pier accepts the vessel, not only its line's destination
// (feedback 50ea10bf, 2026-10-25: an F4 boat from Centraal lay at the
// Buiksloterweg pontoon, the F3 terminal, and would not dock).
const aboard = (): FerryGame => {
  const fresh = game({ x: 0, y: 2 });
  assert.equal(beginFerryFrame(fresh, water), true);
  fresh.player.x = 200; fresh.player.y = -300;
  assert.equal(afterFerryMove(fresh, { x: 200, y: -290 }, water), 'sailing');
  return fresh;
};
const elsewhere = aboard();
elsewhere.player.x = C.x; elsewhere.player.y = C.y + 2;
assert.equal(afterFerryMove(elsewhere, { x: C.x, y: C.y + 10 }, water), 'docked', 'docks at a pier of another line');
assert.deepEqual([elsewhere.player.x, elsewhere.player.y], [C.land.x, C.land.y]);
assert.equal(elsewhere.player.ferryUnarmed, undefined, 'docking clears the crossing state');

// Docking puts the bike on the pier's land access, facing inland, also when
// the vessel touches the quay beside the pier.
const beside = aboard();
beside.player.x = B.x + 30; beside.player.y = B.y + 3;
assert.equal(afterFerryMove(beside, { x: B.x + 30, y: B.y + 10 }, water), 'docked');
assert.equal(beside.player.ferryOrigin, null);
assert.equal(beside.player.isBoat, false);
assert.deepEqual([beside.player.x, beside.player.y], [B.land.x, B.land.y]);
assert.equal(beside.player.length, 12);
assert.equal(beside.player.maxSpeed, 300);
assert.ok(Math.abs(beside.player.angle + Math.PI / 2) < 1e-9, 'faces away from the water');

// NDSM-werf (feedback 1d632c41): the vessel stood on the quay 24.7 m (74 px)
// from the stop. A quay touch along the pier's own 37 m pontoon docks; past
// the pontoon, 50 m along the same quay, the vessel is blocked.
const ndsm = aboard();
ndsm.player.x = B.x + 74; ndsm.player.y = B.y + 3;
assert.equal(afterFerryMove(ndsm, { x: B.x + 74, y: B.y + 12 }, water), 'docked', 'NDSM: quay touch 24.7 m from the stop docks');
const far = aboard();
far.player.x = B.x + 150; far.player.y = B.y + 3;
assert.equal(afterFerryMove(far, { x: B.x + 150, y: B.y + 12 }, water), 'blocked', '50 m along the quay does not dock');
assert.ok(far.player.ferryOrigin, 'still aboard');

// Buiksloterweg (feedback 50ea10bf): afloat against the pontoon 15 m (45 px)
// from the stop, heading in, docks; drifting away from it does not.
const pontoon = aboard();
pontoon.player.x = B.x + 45; pontoon.player.y = B.y + 20;
assert.equal(afterFerryMove(pontoon, { x: B.x + 47, y: B.y + 26 }, water), 'docked', 'afloat 15 m from the stop, heading in');
const drifting = aboard();
drifting.player.x = B.x + 45; drifting.player.y = B.y + 26;
assert.equal(afterFerryMove(drifting, { x: B.x + 44, y: B.y + 20 }, water), 'sailing', 'afloat 15 m off, heading away');

// Hysteresis: the departure pier re-arms only once the vessel has been 50 m away.
const back = game({ x: 0, y: 2 });
beginFerryFrame(back, water);
assert.deepEqual(back.player.ferryUnarmed, ['A']);
back.player.x = 0; back.player.y = -60;
assert.equal(afterFerryMove(back, { x: 0, y: -50 }, water), 'sailing', 'no instant re-docking at the origin');
back.player.angle = Math.PI / 2;
back.player.x = 0; back.player.y = -12;
assert.equal(afterFerryMove(back, { x: 0, y: -20 }, water), 'sailing', 'still unarmed inside 50 m, even heading in');
back.player.x = 0; back.player.y = -160;
assert.equal(afterFerryMove(back, { x: 0, y: -150 }, water), 'sailing');
assert.deepEqual(back.player.ferryUnarmed, [], 're-armed past 50 m');
back.player.x = 0; back.player.y = -12;
assert.equal(afterFerryMove(back, { x: 0, y: -20 }, water), 'docked');
assert.deepEqual([back.player.x, back.player.y], [A.land.x, A.land.y]);

// The hull stays on water (feedback f80d47da, "boat tears through the ground"):
// a bow that reaches the bank is blocked though the centre is still afloat,
// and a single bow corner on the bank glances off instead of stopping dead.
{
  const shore = aboard();
  const p = shore.player;
  p.angle = -Math.PI / 2; p.x = 200; p.y = -595 + p.length / 2 - 3; p.speed = 100;
  assert.ok(water(p.x, p.y), 'centre afloat');
  assert.equal(afterFerryMove(shore, { x: 200, y: p.y + 6 }, water), 'blocked', 'bow on the bank');
  assert.deepEqual([p.x, p.y], [200, -595 + p.length / 2 + 3], 'the move is undone');
  assert.ok(p.speed > 0 && p.speed < 100, 'slowed, not stopped');
  // Sailing east 5 px off the north bank (y = -595): the port bow corner,
  // 4 m to the north, is on land while the bow centre is afloat.
  const glance = aboard();
  const q = glance.player;
  q.angle = 0; q.x = 200; q.y = -590; q.speed = 100;
  assert.equal(afterFerryMove(glance, { x: 194, y: -590 }, water), 'blocked');
  assert.deepEqual([q.x, q.y], [194, -590]);
  assert.ok(q.angle > 0, 'turns away from the bank (to starboard, positive in screen space)');
  assert.ok(q.speed > 0, 'keeps way on');
}

// Issue #54: the whole boarding edge of a two-stop pier boards, like the
// Centraal F3/F4 quay with its two middle ramps, not only the stops. An
// ordinary quay on the same water, away from any stop, never does.
{
  const S1: Terminal = { id: 'S1', name: 'Quay west', x: 0, y: 0, land: { x: 0, y: 30 } };
  const S2: Terminal = { id: 'S2', name: 'Quay east', x: 120, y: 0, land: { x: 120, y: 30 } };
  const N1: Terminal = { id: 'N1', name: 'Across', x: 0, y: -600, land: { x: 0, y: -630 } };
  const N2: Terminal = { id: 'N2', name: 'Further', x: 120, y: -600, land: { x: 120, y: -630 } };
  const l1: FerryLink = { id: 'X:S1:N1', ref: 'X', from: S1, to: N1, points: [S1, N1] };
  const l2: FerryLink = { id: 'Y:S2:N2', ref: 'Y', from: S2, to: N2, points: [S2, N2] };
  const pierSegments: Segment[] = [
    ...[S1, S2, N1, N2].map((t): Segment => ({ points: [t.land, t], type: 'ferry-access', width: 18, name: '', ferryTerminal: t })),
    { points: [S1, N1], type: 'ferry', width: 45, name: '', ferryLink: l1 },
    { points: [S2, N2], type: 'ferry', width: 45, name: '', ferryLink: l2 },
  ];
  let probes = 0;
  const wet = (_x: number, y: number) => { probes++; return y < -5 && y > -595; };
  const at = (player: Partial<FerryPlayer>): FerryGame => {
    const base = game(player);
    return { ...base, track: { segments: pierSegments, getNearestRoad: () => null } };
  };
  const mid = at({ x: 80, y: 3 });
  assert.equal(beginFerryFrame(mid, wet), true, 'boards between the two stops');
  assert.equal(mid.player.ferryOrigin?.id, 'S2', 'with the nearest stop along the quay');
  assert.equal(mid.player.ferryDestinations, 'Further');
  assert.ok(wet(mid.player.x, mid.player.y) && Math.abs(mid.player.x - 80) < 1, 'launched straight ahead on the water');
  const west = at({ x: 40, y: 3 });
  assert.equal(beginFerryFrame(west, wet), true, 'west of the middle');
  assert.equal(west.player.ferryOrigin?.id, 'S1');
  assert.equal(west.player.ferryDestinations, 'Across');
  assert.equal(beginFerryFrame(at({ x: -40, y: 3 }), wet), true, 'beside the outer stop');
  assert.equal(beginFerryFrame(at({ x: 60, y: 3, angle: -Math.PI / 2 + 0.9 }), wet), true, '52 degrees off the normal');
  assert.equal(beginFerryFrame(at({ x: 60, y: 3, angle: 0 }), wet), false, 'riding along the pier');
  assert.equal(beginFerryFrame(at({ x: 60, y: 3, angle: Math.PI / 2 }), wet), false, 'riding off the pier');
  assert.equal(beginFerryFrame(at({ x: 60, y: 3, speed: 0 }), wet), false, 'stopped');
  assert.equal(beginFerryFrame(at({ x: 60, y: 40 }), wet), false, 'inland of the edge');
  // Same water, same quay line, but 50 m past the outer stop: an ordinary quay.
  probes = 0;
  assert.equal(beginFerryFrame(at({ x: 270, y: 3 }), wet), false, 'ordinary quay beyond the pier');
  assert.equal(beginFerryFrame(at({ x: 1200, y: 3 }), wet), false, 'ordinary quay far from any stop');
  // Far from every pier, no water is probed at all.
  probes = 0;
  assert.equal(edgeBoarding(at({ x: 1200, y: 3 }).player, at({}).track, wet), null);
  assert.equal(probes, 0, 'no water probes away from a pier');
}

// 2026-10-31: ferries dead-stopped 16 m out (Zamenhofstraat, Pontsteiger)
// and against the Buiksloterweg point, with no way free.
{
  // The launch heads for open water: a 55 px basin with the IJ to the east.
  const basin = (x: number, y: number) => (y < -5 && y > -60) || (x > 20 && y < -5 && y > -595);
  const straight = -Math.PI / 2;
  const out = openWaterHeading({ x: 0, y: -6 }, straight, basin);
  assert.ok(Math.abs(out - straight) > 0.5 && Math.abs(out - straight) <= LAUNCH_SWEEP + 1e-9, `swings towards the open side (${out.toFixed(2)})`);
  assert.ok(basin(Math.cos(out) * LAUNCH_REACH, -6 + Math.sin(out) * LAUNCH_REACH), 'open water for 80 m along it');
  assert.equal(openWaterHeading({ x: 0, y: -6 }, straight, water), straight, 'ties keep the boarding heading');
  const inlet = game({ x: 0, y: 2 });
  assert.equal(beginFerryFrame(inlet, basin), true);
  assert.ok(Math.abs(inlet.player.angle - straight) > 0.5, 'boards facing the open side');
  assert.ok(basin(inlet.player.x, inlet.player.y), 'afloat');

  // Under the pier exemption the quay is passable, but the centre never goes
  // ashore from the water (Pontsteiger: the hull drove 16 m onto the quay).
  const launch = game({ x: 0, y: 2 });
  beginFerryFrame(launch, water);
  assert.deepEqual(launch.player.ferryUnarmed, ['A']);
  launch.player.angle = Math.PI / 2; launch.player.x = 0; launch.player.y = -2;
  assert.equal(afterFerryMove(launch, { x: 0, y: -8 }, water), 'blocked', 'centre onto the quay at the pier');
  assert.deepEqual([launch.player.x, launch.player.y], [0, -8]);
  launch.player.angle = -Math.PI / 2; launch.player.x = 0; launch.player.y = -20;
  assert.equal(afterFerryMove(launch, { x: 0, y: -8 }, water), 'sailing', 'out again');

  // A head-on touch with water to one side turns that way and keeps way on
  // (the Centraal west boat against the Buiksloterweg point).
  const point = (x: number, y: number) => y < -5 && (y > -595 || x > 300);
  const pressed = aboard();
  const r = pressed.player;
  r.angle = -Math.PI / 2; r.x = 250; r.y = -595 + r.length / 2 - 3; r.speed = 100;
  assert.equal(afterFerryMove(pressed, { x: 250, y: r.y + 6 }, point), 'blocked');
  assert.ok(r.angle > -Math.PI / 2, 'turns to starboard, where the water is');
  assert.ok(r.speed > 0, 'keeps way on');
  // Head-on against a flat bank (water on both sides alike): turns all the
  // same, to starboard, rather than holding the vessel still.
  const flat = aboard();
  const f = flat.player;
  f.angle = -Math.PI / 2; f.x = 200; f.y = -595 + f.length / 2 - 3; f.speed = 100;
  assert.equal(afterFerryMove(flat, { x: 200, y: f.y + 6 }, water), 'blocked');
  assert.ok(f.angle > -Math.PI / 2 && f.speed > 0, 'turns and keeps way on');
  // A line of water skimming along a quay is no launch heading: the whole
  // hull must fit beyond the lead (the first cut launched a Centraal boat
  // along its quay into the next pier). Straight out across a 55 px band
  // (48 px of hull-wide water) beats along the quay (24 px).
  const band = (_x: number, y: number) => y < -5 && y > -60;
  const across = openWaterHeading({ x: 0, y: -6 }, straight, band);
  assert.ok(Math.abs(Math.sin(across)) > 0.5, `at least 30° off the quay line (${across.toFixed(2)})`);
  assert.ok(band(Math.cos(across) * 48, -6 + Math.sin(across) * 48), 'a hull length of water ahead');
  // A stop over the water with its access pointing into the pontoon: the
  // open water 100° round is found (the sweep is wide).
  const pontoon = (x: number, y: number) => y < -5 && !(x < -12 && x > -40 && y > -80);
  const west = Math.PI;
  const round = openWaterHeading({ x: 0, y: -12 }, west, pontoon);
  assert.ok(Math.abs(Math.atan2(Math.sin(round - west), Math.cos(round - west))) > 1.2, `swings well round from the pontoon (${round.toFixed(2)})`);
  assert.ok(pontoon(Math.cos(round) * LAUNCH_REACH, -12 + Math.sin(round) * LAUNCH_REACH), 'open water for 80 m along it');
  // While a touch lasts the turn keeps its side, even when the corners'
  // verdict flips frame to frame.
  const rocking = aboard();
  const k = rocking.player;
  k.angle = -Math.PI / 2; k.x = 250; k.y = -595 + k.length / 2 - 3; k.speed = 100;
  assert.equal(afterFerryMove(rocking, { x: 250, y: k.y + 6 }, point), 'blocked');
  assert.equal(k.ferryTurn, 1);
  const mirror = (x: number, y: number) => y < -5 && (y > -595 || x < 200);
  const before = k.angle; k.x = 250; k.y = -595 + k.length / 2 - 3;
  assert.equal(afterFerryMove(rocking, { x: 250, y: k.y + 6 }, mirror), 'blocked');
  assert.ok(k.angle > before, 'still turning to starboard');
  k.x = 250; k.y = -300;
  assert.equal(afterFerryMove(rocking, { x: 250, y: -294 }, water), 'sailing');
  assert.equal(k.ferryTurn, undefined, 'free again');

  // Getting free: a move that puts more of the hull on water goes through
  // even though the hull still touches; the move back ashore does not.
  const corner = (x: number, y: number) => x > 0 && y < -5 && y > -595;
  const freeing = aboard();
  const q = freeing.player;
  q.angle = -Math.PI / 2; q.x = -6; q.y = -300; q.speed = 40;
  assert.equal(afterFerryMove(freeing, { x: -12, y: -300 }, corner), 'sailing', 'a corner finds water: allowed');
  assert.deepEqual([q.x, q.y], [-6, -300]);
  q.x = -12;
  assert.equal(afterFerryMove(freeing, { x: -6, y: -300 }, corner), 'blocked', 'back onto the land: not');
  assert.deepEqual([q.x, q.y], [-6, -300]);

  // Street following sees no street on the water.
  const motion = ferryMotionTrack({ ...game({}).track, getRoadContacts: (_x: number, _y: number) => [{ dist: 0 }] });
  assert.deepEqual(motion.getRoadContacts!(0, 0), []);
  assert.equal(motion.getNearestRoad(0, 0, null), null);
}

console.log('Ferry boarding, water steering and docking passed');
