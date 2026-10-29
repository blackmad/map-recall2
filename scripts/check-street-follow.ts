// Street-follow touch steering and the comfort camera (streetFollow.ts,
// cameraYaw.ts), unit cases plus rides through real Amsterdam junctions.
//
// The rides use the world exactly as the game builds it (the same widths and
// simplification as osm-loader.js, as check-canal-car.ts's plaza world does)
// and a toy integrator: speed = cruise × alignment slowdown, heading eased by
// STREET_TURN_RATE. No road guard runs, so "stays on the street" here means the
// controller itself keeps the bike inside a corridor, not the guard rescuing it.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initialStreetFollowState, stepStreetFollow, streetPadButtonAt, streetPadRects,
  STREET_TURN_RATE, type FollowContact, type StreetFollowButtons,
} from '../src/canalRecall/streetFollow';
import { stepCameraYaw, CAMERA_YAW_DEFAULT } from '../src/canalRecall/cameraYaw';
import { alignmentSpeedScale, normalizeAngle, turnToward, dpadLayout } from '../src/canalRecall/touchControls';
import { buildRoadSpatialIndex, contactsAt, roadsNear } from '../src/canalRecall/routing/roadSurface';
import { buildRoadSegments, projectToWorld, type OsmWay } from '../src/canalRecall/osm/roadProjection';

const deg = (d: number) => (d * Math.PI) / 180;
const none: StreetFollowButtons = { left: false, right: false, back: false };
/** A state already riding (past the start-of-ride park). */
const riding = () => ({ ...initialStreetFollowState(), parked: false });
const street = (angle: number, dist = 0, width = 18, length?: number, along?: number): FollowContact => ({ angle, dist, width, length, along });

// --- unit cases ---------------------------------------------------------
{
  // A ride starts parked; the first press (or the up arrow) sets off.
  const parked = stepStreetFollow(initialStreetFollowState(), none, { heading: 0, speed: 0, contacts: [street(0)], dt: 1 / 60 });
  assert.equal(parked.command.speedFraction, 0, 'parked until the first press');
  const go = stepStreetFollow(parked.state, { ...none, forward: true }, { heading: 0, speed: 0, contacts: [street(0)], dt: 1 / 60 });
  assert.ok(!go.state.parked && go.command.speedFraction > 0, 'the up arrow sets off');
}
{
  // Straight on along the street, digitised in the opposite direction.
  const { command } = stepStreetFollow(riding(), none, { heading: 0, speed: 100, contacts: [street(Math.PI + deg(4))], dt: 1 / 60 });
  assert.ok(Math.abs(normalizeAngle(command.targetHeading! - deg(4))) < 1e-9, 'follows the street tangent, either digitisation');
  assert.ok(command.speedFraction > 0, 'cruises');
}
{
  // A queued right turn waits for the junction, then takes the cross street.
  let state = stepStreetFollow(riding(), { ...none, right: true }, { heading: 0, speed: 100, contacts: [street(0)], dt: 1 / 60 }).state;
  assert.equal(state.queuedTurn, 1, 'right is queued');
  let step = stepStreetFollow(state, none, { heading: 0, speed: 100, contacts: [street(0), street(Math.PI / 2, 30, 18)], dt: 1 / 60 });
  assert.equal(step.state.turning, null, 'a side street not yet reached is not taken');
  assert.equal(step.state.queuedTurn, 1, 'the queue survives the release');
  step = stepStreetFollow(step.state, none, { heading: 0, speed: 100, contacts: [street(0), street(Math.PI / 2, 5, 18)], dt: 1 / 60 });
  assert.ok(Math.abs(normalizeAngle(step.command.targetHeading! - Math.PI / 2)) < 1e-9, 'inside the cross corridor the turn commits (+y is right on screen)');
  assert.equal(step.state.queuedTurn, 0, 'the queue is spent');
  state = step.state;
  for (let i = 0; i < 300; i++) state = stepStreetFollow(state, none, { heading: 0, speed: 100, contacts: [street(0)], dt: 1 / 60 }).state;
  assert.equal(state.queuedTurn, 0);
}
{
  // One press, one turn: a left held through two left-hand openings takes
  // only the first (Utrechtsestraat by the Prinsengracht bridge, 2026-10-29
  // sim: a held left took a bridge kink and then looped back).
  const held = { ...none, left: true };
  let step = stepStreetFollow(riding(), held, { heading: 0, speed: 60, contacts: [street(0), street(Math.PI / 2, 2)], dt: 1 / 60 });
  assert.ok(step.state.turning != null, 'the first left is taken');
  let state = step.state;
  for (let i = 0; i < 120; i++) state = stepStreetFollow(state, held, { heading: -Math.PI / 2, speed: 60, contacts: [street(Math.PI / 2)], dt: 1 / 60 }).state;
  assert.equal(state.turning, null, 'the turn completes');
  step = stepStreetFollow(state, held, { heading: -Math.PI / 2, speed: 60, contacts: [street(Math.PI / 2), street(0, 2)], dt: 1 / 60 });
  assert.equal(step.state.turning, null, 'still holding: the next left is not taken');
  step = stepStreetFollow(step.state, none, { heading: -Math.PI / 2, speed: 60, contacts: [street(Math.PI / 2)], dt: 1 / 60 });
  step = stepStreetFollow(step.state, held, { heading: -Math.PI / 2, speed: 60, contacts: [street(Math.PI / 2), street(0, 2)], dt: 1 / 60 });
  assert.ok(step.state.turning != null, 'a fresh press takes it');
}
{
  // A slight kink is not a turn unless it is a fork.
  const kink = stepStreetFollow(riding(), { ...none, left: true }, { heading: 0, speed: 60, contacts: [street(-deg(28), 2, 18, 100, 50)], dt: 1 / 60 });
  assert.equal(kink.state.turning, null, 'a 28° kink with nothing else is just the street');
  const fork = stepStreetFollow(riding(), { ...none, left: true }, { heading: 0, speed: 60, contacts: [street(-deg(28), 2, 18, 100, 50), street(deg(20), 2, 18, 100, 50)], dt: 1 / 60 });
  assert.ok(fork.state.turning != null && fork.state.turning < 0, 'at a fork, left takes the left branch');
}
{
  // A queue expires after QUEUE_HOLD_SECONDS when no junction comes.
  let state = stepStreetFollow(riding(), { ...none, left: true }, { heading: 0, speed: 100, contacts: [street(0)], dt: 1 / 60 }).state;
  for (let i = 0; i < 60 * 5; i++) state = stepStreetFollow(state, none, { heading: 0, speed: 100, contacts: [street(0)], dt: 1 / 60 }).state;
  assert.equal(state.queuedTurn, 0, 'an untaken turn expires');
}
{
  // T-junction, nothing queued: wait for a choice instead of picking a side.
  const contacts = [street(0, 20, 18), street(Math.PI / 2, 2, 18)];
  const { command } = stepStreetFollow(riding(), none, { heading: 0, speed: 10, contacts: [street(Math.PI / 2, 2, 18)], dt: 1 / 60 });
  assert.equal(command.speedFraction, 0, 'stops at a T');
  assert.ok(command.awaitingChoice, 'and asks');
  void contacts;
  // A bend (the span underfoot ends, the next one turns off) is simply
  // followed: the incoming span offers no way on past its end, and the new
  // span only away from the vertex.
  const bend = stepStreetFollow(riding(), none, {
    heading: 0, speed: 100, dt: 1 / 60,
    contacts: [street(0, 0, 18, 100, 98), street(deg(80), 2, 18, 100, 0)],
  }).command;
  assert.ok(bend.targetHeading != null && Math.abs(bend.targetHeading - deg(80)) < 1e-9 && bend.speedFraction > 0, 'a bend is followed without asking');
  // A dead end: nothing past the end of the span. Stop rather than ride on.
  const deadEnd = stepStreetFollow(riding(), none, { heading: 0, speed: 10, contacts: [street(0, 0, 18, 100, 98)], dt: 1 / 60 }).command;
  assert.equal(deadEnd.speedFraction, 0, 'a dead end stops the bike');
}
{
  // Back: a tap turns round once slow; a hold stops.
  let step = stepStreetFollow(riding(), { ...none, back: true }, { heading: 0, speed: 200, contacts: [street(0)], dt: 1 / 60 });
  step = stepStreetFollow(step.state, none, { heading: 0, speed: 200, contacts: [street(0)], dt: 1 / 60 });
  assert.ok(step.state.uTurnPending && step.command.brake === 1 && !step.command.turnAround, 'a tap brakes first');
  step = stepStreetFollow(step.state, none, { heading: 0, speed: 5, contacts: [street(0)], dt: 1 / 60 });
  assert.ok(step.command.turnAround, 'then swings round once slow');
  let hold = riding();
  let last = stepStreetFollow(hold, { ...none, back: true }, { heading: 0, speed: 100, contacts: [street(0)], dt: 1 / 60 });
  for (let i = 0; i < 30; i++) last = stepStreetFollow(last.state, { ...none, back: true }, { heading: 0, speed: 100, contacts: [street(0)], dt: 1 / 60 });
  assert.ok(last.command.brake === 1 && last.command.speedFraction === 0, 'held back stops');
  last = stepStreetFollow(last.state, none, { heading: 0, speed: 0, contacts: [street(0)], dt: 1 / 60 });
  assert.ok(!last.state.uTurnPending && last.command.speedFraction > 0, 'releasing a hold rides on, no turn-around');
  hold = last.state;
  void hold;
}
{
  // Off the network the buttons steer directly.
  const { command } = stepStreetFollow(riding(), { ...none, left: true }, { heading: 0, speed: 100, contacts: [street(0, 80, 18)], dt: 1 / 60 });
  assert.ok(command.steer < 0 && command.targetHeading == null, 'free steer off the network');
}
{
  // Pad geometry: two turn buttons over a back bar, inside the stick's zone.
  const layout = dpadLayout({ width: 390, height: 844, mode: 'compact', orientation: 'portrait', touch: true, safeBottom: 20 } as never)!;
  const rects = streetPadRects(layout);
  const b = layout.bounds;
  for (const rect of Object.values(rects)) {
    assert.ok(rect.x >= b.x - 0.01 && rect.y >= b.y - 0.01 && rect.x + rect.width <= b.x + b.width + 0.01 && rect.y + rect.height <= b.y + b.height + 0.01, 'pad buttons stay in the zone');
  }
  assert.equal(streetPadButtonAt({ x: b.x + 5, y: b.y + 5 }, layout), 'left');
  assert.equal(streetPadButtonAt({ x: b.x + b.width - 5, y: b.y + 5 }, layout), 'right');
  assert.equal(streetPadButtonAt({ x: layout.cx, y: b.y + b.height - 5 }, layout), 'back');
  assert.equal(streetPadButtonAt({ x: b.x + b.width + 200, y: b.y - 200 }, layout), 'right', 'a wandering thumb keeps the nearest button');
}
{
  // Camera: small heading wobble does not yaw the view at all; a turn-around
  // pans no faster than the cap.
  const yaw = { following: false };
  let rotation = 0;
  let moved = 0;
  for (let i = 0; i < 600; i++) {
    const wobble = deg(6) * Math.sin(i / 7);
    const next = stepCameraYaw(rotation, wobble, 1 / 60, yaw);
    moved += Math.abs(next - rotation);
    rotation = next;
  }
  assert.equal(moved, 0, 'a ±6° steering wobble leaves the camera still');
  let maxRate = 0;
  for (let i = 0; i < 600; i++) {
    const next = stepCameraYaw(rotation, Math.PI, 1 / 60, yaw);
    maxRate = Math.max(maxRate, Math.abs(next - rotation) * 60);
    rotation = next;
  }
  assert.ok(maxRate <= CAMERA_YAW_DEFAULT.maxRate + 1e-9, `turn-around yaw capped (${(maxRate * 180 / Math.PI).toFixed(0)}°/s)`);
  assert.ok(Math.abs(normalizeAngle(rotation - Math.PI)) < deg(1.01), 'and it arrives');
}

// --- rides through real junctions ---------------------------------------
type RoutingStreet = { name: string; highway?: string; path?: [number, number][]; paths?: [number, number][][] };
const routing = JSON.parse(await readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as RoutingStreet[];
const ROAD_WIDTHS: Record<string, number> = {
  primary: 30, secondary: 26, tertiary: 21, residential: 18, unclassified: 17, living_street: 16,
  service: 13, busway: 18, cycleway: 9, pedestrian: 14, footway: 7, path: 8,
};
const pathsOf = (street: RoutingStreet) => street.paths ?? (street.path ? [street.path] : []);
const metres = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111_320, (a[1] - b[1]) * 111_320 * Math.cos(a[0] * Math.PI / 180));

/** The junction of two named streets: their closest pair of vertices. */
function junctionOf(a: string, b: string): [number, number] {
  let best: { d: number; p: [number, number] } = { d: Infinity, p: [0, 0] };
  const pa = routing.filter(s => s.name === a).flatMap(pathsOf).flat();
  const pb = routing.filter(s => s.name === b).flatMap(pathsOf).flat();
  for (const p of pa) for (const q of pb) { const d = metres(p, q); if (d < best.d) best = { d, p }; }
  assert.ok(best.d < 15, `${a} meets ${b} (${best.d.toFixed(1)} m)`);
  return best.p;
}

function world(centre: [number, number], radius = 400) {
  const ways: OsmWay[] = [];
  routing.forEach((s, si) => pathsOf(s).forEach((p, pi) => {
    if (p.length < 2) return;
    if (p.length > 3 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1]) return;
    if (!p.some(q => metres(q, centre) < radius)) return;
    const highway = s.highway || 'residential';
    ways.push({ id: `${si}:${pi}`, nodes: p.map(([lat, lon]) => ({ lat, lon })), tags: { name: s.name, highway }, highway } as unknown as OsmWay);
  }));
  const centreLL = { lat: centre[0], lon: centre[1] };
  const built = buildRoadSegments(ways, centreLL, { simplificationToleranceDegrees: 0.00003, roadWidths: ROAD_WIDTHS, defaultRoadWidth: 32 });
  const index = buildRoadSpatialIndex(built.segments, 100);
  const toWorld = (lat: number, lon: number) => {
    const p = projectToWorld({ lat, lon }, centreLL);
    return { x: p.x + built.offset.x, y: p.y + built.offset.y };
  };
  const contacts = (x: number, y: number) => contactsAt(roadsNear(index, x, y, 2), x, y);
  const nameAt = (x: number, y: number, heading: number) => {
    let best: { name: string; score: number } = { name: '', score: Infinity };
    for (const c of contacts(x, y)) {
      if (c.dist > c.width) continue;
      const off = Math.abs(normalizeAngle(2 * (c.angle - heading))) / 2;
      const score = c.dist + off * 40;
      if (score < best.score) best = { name: built.segments[c.segIdx].name || '', score };
    }
    return best.name;
  };
  const nameOf = (segIdx: number) => built.segments[segIdx]?.name || '';
  return { toWorld, contacts, nameAt, nameOf };
}

type Ride = { finalName: string; maxExcess: number; seconds: number; headingReversals: number; maxCameraRate: number; cameraTravel: number };

/** Ride from `from` toward `toward` along `startStreet`, pressing `press`
 *  for the first `pressSeconds`, for `seconds`. */
function ride(w: ReturnType<typeof world>, from: [number, number], toward: [number, number], press: Partial<StreetFollowButtons>, seconds: number, pressSeconds = 0.4, startName = ''): Ride {
  const a = w.toWorld(from[0], from[1]);
  const b = w.toWorld(toward[0], toward[1]);
  let x = a.x, y = a.y, heading = Math.atan2(b.y - a.y, b.x - a.x);
  // Start on the street's own tangent, as the game does.
  // On the named street, as a route start is.
  const start = w.contacts(x, y).filter(c => !startName || w.nameOf(c.segIdx) === startName).sort((p, q) => p.dist - q.dist)[0];
  if (start) {
    const along = [start.angle, start.angle + Math.PI].sort((p, q) => Math.abs(normalizeAngle(p - heading)) - Math.abs(normalizeAngle(q - heading)))[0];
    heading = along;
  }
  let state = riding();
  const yaw = { following: false };
  let camera = heading;
  let speed = 0, maxExcess = 0, maxCameraRate = 0, cameraTravel = 0, lastTurnSign = 0, reversals = 0;
  const dt = 1 / 60, maxSpeed = 260;
  for (let t = 0; t < seconds; t += dt) {
    const buttons = { ...none, ...(t < pressSeconds ? press : {}) };
    const contacts = w.contacts(x, y);
    const step = stepStreetFollow(state, buttons, { heading, speed, contacts, dt });
    state = step.state;
    const c = step.command;
    let cruise = c.brake > 0 ? 0 : c.speedFraction;
    if (c.targetHeading != null) {
      cruise *= alignmentSpeedScale(c.targetHeading - heading);
      const next = turnToward(heading, c.targetHeading, STREET_TURN_RATE * dt);
      const sign = Math.sign(normalizeAngle(next - heading));
      if (sign && lastTurnSign && sign !== lastTurnSign) reversals++;
      if (sign) lastTurnSign = sign;
      heading = next;
    }
    speed += (maxSpeed * cruise - speed) * Math.min(1, dt * 4);
    x += Math.cos(heading) * speed * dt;
    y += Math.sin(heading) * speed * dt;
    let excess = Infinity;
    for (const k of w.contacts(x, y)) excess = Math.min(excess, k.dist - k.width);
    if (process.env.SF_DEBUG && Math.round(t * 60) % 6 === 0) {
      console.log(t.toFixed(2), x.toFixed(0), y.toFixed(0), (heading * 180 / Math.PI).toFixed(0), speed.toFixed(0), excess.toFixed(1), state.queuedTurn, state.turning == null ? '-' : (state.turning * 180 / Math.PI).toFixed(0), c.awaitingChoice ? 'WAIT' : '', w.nameAt(x, y, heading));
    }
    maxExcess = Math.max(maxExcess, excess);
    const nextCamera = stepCameraYaw(camera, heading, dt, yaw);
    maxCameraRate = Math.max(maxCameraRate, Math.abs(normalizeAngle(nextCamera - camera)) / dt);
    cameraTravel += Math.abs(normalizeAngle(nextCamera - camera));
    camera = nextCamera;
  }
  return { finalName: w.nameAt(x, y, heading), maxExcess, seconds, headingReversals: reversals, maxCameraRate, cameraTravel };
}

const summary: string[] = [];
const report = (label: string, r: Ride) => summary.push(`${label}: on ${r.finalName}, max excess ${r.maxExcess.toFixed(1)} px, camera ≤${(r.maxCameraRate * 180 / Math.PI).toFixed(0)}°/s travel ${(r.cameraTravel * 180 / Math.PI).toFixed(0)}°, heading reversals ${r.headingReversals}`);

{
  // Named junction: Leidsestraat × Keizersgracht, riding north-east up
  // Leidsestraat from the Prinsengracht. Straight on stays on Leidsestraat;
  // a right queued well before the corner ends on Keizersgracht.
  const junction = junctionOf('Leidsestraat', 'Keizersgracht');
  const w = world(junction);
  const leidse = routing.filter(s => s.name === 'Leidsestraat').flatMap(pathsOf).flat();
  // A Leidsestraat vertex ~60 m before the junction, on the Prinsengracht side.
  const prinsen = junctionOf('Leidsestraat', 'Prinsengracht');
  const before = leidse
    .filter(p => metres(p, junction) > 40 && metres(p, junction) < 90 && metres(p, prinsen) < metres(junction, prinsen))
    .sort((p, q) => metres(p, prinsen) - metres(q, prinsen))[0];
  assert.ok(before, 'a start on Leidsestraat before the Keizersgracht');
  const straight = ride(w, before, junction, {}, 3);
  report('Leidsestraat straight', straight);
  assert.equal(straight.finalName, 'Leidsestraat', 'nothing queued: straight across the Keizersgracht');
  assert.equal(straight.cameraTravel, 0, 'riding a straight street never yaws the camera');
  if (process.env.SF_DEBUG) console.log('--- right');
  const right = ride(w, before, junction, { right: true }, 4);
  report('Leidsestraat → right', right);
  const left = ride(w, before, junction, { left: true }, 4);
  report('Leidsestraat → left', left);
  assert.equal(right.finalName, 'Keizersgracht', 'right queued: onto the Keizersgracht');
  assert.equal(left.finalName, 'Keizersgracht', 'left queued: onto the Keizersgracht the other way');
  for (const r of [straight, right, left]) {
    assert.ok(r.maxExcess < 6, `the bike stays inside a corridor without the guard (${r.maxExcess.toFixed(1)} px)`);
    assert.ok(r.maxCameraRate <= CAMERA_YAW_DEFAULT.maxRate + 1e-6, 'camera yaw stays under the cap');
    assert.ok(r.headingReversals <= 2, `no heading wobble (${r.headingReversals} reversals)`);
  }
}

{
  // Named ride: along the Keizersgracht's curve east of the Leidsestraat with
  // nothing pressed. The ring bends gently at every bridge; the bike must
  // keep to it (straight on wins at each cross street) and the camera must
  // turn in a few calm steps, not a continuous wobble.
  const start = junctionOf('Leidsestraat', 'Keizersgracht');
  const w = world(start, 700);
  const kg = routing.filter(s => s.name === 'Keizersgracht').flatMap(pathsOf).flat();
  const east = kg.filter(p => metres(p, start) > 30 && metres(p, start) < 160 && p[1] > start[1])
    .sort((p, q) => metres(p, start) - metres(q, start));
  assert.ok(east.length >= 2, 'Keizersgracht vertices east of the Leidsestraat');
  if (process.env.SF_DEBUG) console.log('--- ring');
  const r = ride(w, east[0], east.at(-1)!, {}, 8, 0.4, 'Keizersgracht');
  report('Keizersgracht ring, hands off', r);
  assert.equal(r.finalName, 'Keizersgracht', 'hands off, the bike stays on the canal ring');
  assert.ok(r.maxExcess < 6, `inside the corridor (${r.maxExcess.toFixed(1)} px)`);
  assert.ok(r.maxCameraRate <= CAMERA_YAW_DEFAULT.maxRate + 1e-6, 'camera yaw capped');
}

{
  // Named junction: Utrechtsestraat × Prinsengracht, riding south from the
  // Keizersgracht. Left and right both reach the Prinsengracht.
  const junction = junctionOf('Utrechtsestraat', 'Prinsengracht');
  const w = world(junction);
  const kj = junctionOf('Utrechtsestraat', 'Keizersgracht');
  // Kerkstraat crosses between the two canals: a turn queued before it is
  // taken there ("the next corner"), so start between Kerkstraat and the
  // Prinsengracht for the Prinsengracht turns.
  const kerk = junctionOf('Utrechtsestraat', 'Kerkstraat');
  const lerp = (f: number): [number, number] => [kerk[0] + (junction[0] - kerk[0]) * f, kerk[1] + (junction[1] - kerk[1]) * f];
  const before = lerp(0.3);
  assert.ok(metres(before, junction) > 20, `room to slow before the Prinsengracht (${metres(before, junction).toFixed(0)} m)`);
  for (const side of ['left', 'right'] as const) {
    if (process.env.SF_DEBUG) console.log('--- utrecht', side, before, kerk, junction);
    const r = ride(w, before, junction, { [side]: true }, 4, 0.4, 'Utrechtsestraat');
    report(`Utrechtsestraat → ${side}`, r);
    assert.equal(r.finalName, 'Prinsengracht', `${side} queued: onto the Prinsengracht`);
    assert.ok(r.maxExcess < 6, `inside the corridor (${r.maxExcess.toFixed(1)} px)`);
  }
  const straight = ride(w, before, junction, {}, 1.5, 0.4, 'Utrechtsestraat');
  report('Utrechtsestraat straight', straight);
  assert.equal(straight.finalName, 'Utrechtsestraat', 'nothing queued: straight across');
}

console.log(summary.join('\n'));
console.log('street follow: checks passed');
