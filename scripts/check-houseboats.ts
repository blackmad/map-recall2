// Houseboat generator over the published extract: every mapped boat gets a hull, the
// geometry stays inside a sane budget, sits on the water, and faces outward/up.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { houseboatGeometry, houseboatsByTile } from '../src/canalRecall/houseboats.ts';

const { boats } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
assert.ok(boats.length > 2500, `extract carries the city's houseboats (${boats.length})`);
const origin = { lng: 4.9, lat: 52.37 };
let tris = 0, failed = 0;
for (const boat of boats) {
  const g = houseboatGeometry(boat, origin);
  if (!g) { failed++; continue; }
  tris += g.tris.length;
  for (const t of g.tris) {
    for (const p of t.p) assert.ok(p[2] >= -0.11 && p[2] < 12, `${boat.id}: vertex height ${p[2]}`);
    const l = Math.hypot(...t.n);
    assert.ok(Math.abs(l - 1) < 1e-6, 'unit normals');
  }
  // Decks (the horizontal faces near the waterline) face up; only roof overhangs show an underside.
  assert.ok(g.tris.filter(t => t.p.every(p => p[2] === t.p[0][2]) && t.p[0][2] > 0.2 && t.p[0][2] < 1.2).every(t => t.n[2] > 0), `${boat.id}: decks face up`);
}
assert.ok(failed / boats.length < 0.01, `almost every footprint builds (${failed} failed)`);
const perBoat = tris / (boats.length - failed);
assert.ok(perBoat < 200, `triangle budget per boat (${perBoat.toFixed(0)})`);
assert.equal([...houseboatsByTile(boats).values()].reduce((n, list) => n + list.length, 0), boats.length, 'every boat lands in one tile');
console.log(`houseboats: ok (${boats.length} boats, ${failed} without geometry, ${perBoat.toFixed(0)} triangles each)`);

// A landmark aboard a boat lights that boat (user report 2026-10-03,
// "houseboat museum doesn't light up yellow when the trivia comes up"); one
// on the quay beside a boat does not.
{
  const { boatForLandmark } = await import('../src/canalRecall/houseboats.ts');
  const museum: [number, number] = [4.882602, 52.3701526]; // Houseboat Museum, Prinsengracht
  assert.equal(boatForLandmark(boats, museum, 'museum'), 'w174999382', 'Houseboat Museum lights the Hendrika Maria');
  assert.equal(boatForLandmark(boats, museum, 'landmark'), null, 'only kinds of place a boat can be');
  const lm = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8'));
  const kraan = (lm.landmarks ?? lm).find((l: { name: string }) => l.name === 'Kraan 2868');
  if (kraan) assert.equal(boatForLandmark(boats, [kraan.center[1], kraan.center[0]], 'museum'), null, 'a crane 4 m from a boat is on the quay');
  console.log('houseboats: Houseboat Museum lights its boat');
}
