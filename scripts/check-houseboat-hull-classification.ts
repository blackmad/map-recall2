// Houseboat kinds: ark (pontoon), barge (open ship) or hullbox (ship hull under one
// box cabin). Ground truth is scripts/houseboat-kinds/labels.json, read off the PDOK
// 8 cm orthophoto (user report 2026-10-16, "we are drawing too many canalhouses as
// canalboats": three of four boats on a Prinsengracht quay drawn as barges with
// wheelhouses and flags where the photo shows box cabins).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { classifyHouseboatHull, houseboatFrame, houseboatGeometry, houseboatKind, type Houseboat, type HouseboatKind } from '../src/canalRecall/houseboats.ts';

const rectangle: [number, number][] = [[-10, -2], [10, -2], [10, 2], [-10, 2]];
const densify = (ring: [number, number][]) => ring.flatMap((p, i) => { const q = ring[(i + 1) % ring.length]; return Array.from({ length: 8 }, (_, j) => [p[0] + (q[0] - p[0]) * j / 8, p[1] + (q[1] - p[1]) * j / 8] as [number, number]); });
assert.equal(classifyHouseboatHull(rectangle, 20, 4), 'ark');
assert.equal(classifyHouseboatHull(densify(rectangle), 20, 4), 'ark', 'extra traced vertices do not turn a pontoon into a ship');
const pointed: [number, number][] = [[-10, -2], [6, -2], [10, 0], [6, 2], [-10, 2]];
assert.equal(classifyHouseboatHull(pointed, 20, 4), 'ship', 'a simply mapped genuine bow does not require nine vertices');
assert.equal(classifyHouseboatHull(densify(pointed), 20, 4), 'ship');
assert.equal(classifyHouseboatHull([...pointed].reverse(), 20, 4), 'ship', 'winding does not select boat type');
// A rounded end (radius = half the beam), the commonest ship end on the canals.
const rounded: [number, number][] = [[-10, -2], [8, -2], ...Array.from({ length: 7 }, (_, k) => { const t = -Math.PI / 2 + Math.PI * (k + 1) / 8; return [8 + 2 * Math.cos(t), 2 * Math.sin(t)] as [number, number]; }), [8, 2], [-10, 2]];
assert.equal(classifyHouseboatHull(rounded, 20, 4), 'ship', 'a rounded end is a ship end');
// One corner chamfered 1.5 m (a deck cut-out, a gangway notch) narrows the end off-centre.
const chamfered: [number, number][] = [[-10, -2], [8.5, -2], [10, -0.5], [10, 2], [-10, 2]];
assert.equal(classifyHouseboatHull(chamfered, 20, 4), 'ark', 'a chamfered pontoon corner is not a bow');
// Squat or broad outlines with a curved end are pontoons (glasshouses, a rounded ark).
assert.equal(classifyHouseboatHull(rounded.map(([a, b]) => [a * 0.6, b * 2] as [number, number]), 12, 8), 'ark', 'a squat curved outline is a pontoon');

const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const byId = new Map(boats.map(b => [b.id, b]));
const frameOf = (id: string) => { const f = houseboatFrame(byId.get(id)!); assert(f, `${id} has a frame`); return f; };
const hull = (id: string) => { const f = frameOf(id); return classifyHouseboatHull(f.local, f.length, f.width); };
const drawn = (id: string) => { const f = frameOf(id); return houseboatKind(id, f.local, f.length, f.width); };

// Real outlines from the orthophoto sample, pinned by id.
for (const id of ['w277293288', 'w274024163', 'w277259764']) assert.equal(hull(id), 'ship', `${id}: long barge with rounded ends was an ark under the ±0.46 L rule`);
for (const id of ['w266597439', 'w268452928', 'w268446548', 'w269084863', 'w266604426']) assert.equal(hull(id), 'ship', `${id}: hullbox on a rounded hull`);
for (const id of ['w276328195', 'w280834056', 'w901407814']) assert.equal(hull(id), 'ark', `${id}: ark whose traced corner the old rule took for a bow`);
for (const id of ['w266907891', 'w645172847', 'w266907900']) assert.equal(hull(id), 'ark', `${id}: broad pontoon (glasshouse) with a curved corner`);
assert.equal(hull('w57863486'), 'ark', 'densely traced rectangular pontoon stays residential');
assert.equal(drawn('w174999382'), 'barge', 'Hendrika Maria (Houseboat Museum) keeps its ship');

// Named regression: Prinsengracht at Noordermarkt, the quay of the user's report (a
// run classified barge, barge, barge, ark): the orthophoto shows box cabins on hulls and a
// broad garden ark whose OSM outline is drawn narrow and ship-shaped.
const noordermarkt: Record<string, HouseboatKind> = { w266604434: 'ark', w266604436: 'ark', w266604450: 'hullbox', w266555535: 'hullbox', w266555538: 'hullbox' };
for (const [id, kind] of Object.entries(noordermarkt)) assert.equal(drawn(id), kind, `Prinsengracht at Noordermarkt ${id}`);
// Prinsengracht at Westermarkt: a full-length white cabin, an open cluttered barge, a timber-roofed hullbox.
for (const [id, kind] of Object.entries({ w266555540: 'hullbox', w266555542: 'barge', w266604403: 'hullbox' })) assert.equal(drawn(id), kind, `Prinsengracht at Westermarkt ${id}`);

// The footprint classifier against every label (overrides off): ark vs ship hull.
const { boats: labels }: { boats: Record<string, { label: string; set: string }> } = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/labels.json', 'utf8'));
const score = (set?: string) => {
  const rows = Object.entries(labels).filter(([, l]) => l.label !== 'none' && (!set || l.set === set));
  return rows.filter(([id, l]) => (l.label === 'ark') === (hull(id) === 'ark')).length / rows.length;
};
assert(score() >= 0.93, `hull accuracy on all labels ${score().toFixed(3)} (old rule 0.833)`);
assert(score('ring') >= 0.95, `hull accuracy on the blind ring-canal set ${score('ring').toFixed(3)} (old rule 0.948)`);
execFileSync('npx', ['tsx', 'scripts/houseboat-kinds/overrides.ts', '--check'], { stdio: 'inherit' });

const counts: Record<string, number> = {};
for (const boat of boats) {
  const f = houseboatFrame(boat);
  if (!f) continue;
  const kind = houseboatKind(boat.id, f.local, f.length, f.width);
  counts[kind] = (counts[kind] ?? 0) + 1;
  const origin = { lng: boat.ring[0][0], lat: boat.ring[0][1] };
  if (boat.id === 'w96706553') {
    const geometry = houseboatGeometry(boat, origin)!;
    const hullVertices = geometry.tris.flatMap(t => t.p).filter(p => Math.abs(p[2] + 0.1) < 1e-8);
    assert(hullVertices.length > 0);
    assert(hullVertices.every(p => f.pts.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-8)), 'pontoon waterline preserves mapped notch vertices rather than fitted rectangle');
  }
}
// What the city draws: open barges are a minority of ship hulls (old rule: 960 barges, no hullboxes).
assert(counts.barge < 500 && counts.hullbox > counts.barge && counts.ark > 1900, `kinds ${JSON.stringify(counts)}`);

// Geometry per kind: a hullbox has no flag and keeps its cabin inside the hull; a barge flies the flag.
const flagRed = '#ae1c28';
for (const id of ['w266555535', 'w266604450']) {
  const boat = byId.get(id)!, f = frameOf(id);
  const g = houseboatGeometry(boat, { lng: boat.ring[0][0], lat: boat.ring[0][1] })!;
  assert(!g.tris.some(t => t.hex === flagRed), `${id}: hullbox flies no flag`);
  const inside = ([x, y]: readonly number[]) => { let c = false; for (let i = 0, j = f.pts.length - 1; i < f.pts.length; j = i++) { const [xi, yi] = f.pts[i], [xj, yj] = f.pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const cabin = g.tris.filter(t => t.p.every(p => p[2] > 1.2 && p[2] < 3.5)).flatMap(t => t.p);
  assert(cabin.length > 0 && cabin.filter(p => inside(p)).length / cabin.length > 0.97, `${id}: cabin stands inside the hull outline`);
}
{
  const boat = byId.get('w174999382')!;
  const g = houseboatGeometry(boat, { lng: boat.ring[0][0], lat: boat.ring[0][1] })!;
  assert(g.tris.some(t => t.hex === flagRed), 'the barge keeps its Dutch flag');
}
console.log('Houseboat kind checks passed', counts, { hullAccuracy: +score().toFixed(3), ringHeldOut: +score('ring').toFixed(3) });
