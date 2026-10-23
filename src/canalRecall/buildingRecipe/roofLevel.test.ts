/**
 * Large-tier roof levelling (`roof.levelRooftop`, roofLevel.ts) with the named regression from the live site
 * (user note 0132871b, 2026-10-23, Rembrandtplein heading for the Amstel: "roof looks weird on the dark brown
 * building"): Utrechtsestraat 15 (Booking.com head office), pand 0363100012169214, whose 3DBAG LoD2.2 rooftop above
 * the fronts (~90 tilted planes, 32.9-40.7 m) drew as a crumpled triangle field.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {levelRoofAbove, ringArea3, rooftopLevel} from './roofLevel.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {compileBuilding} from './compile.ts';
import type {CompiledLargeBuilding} from './largeCompile.ts';
import {evaluateLargeGates} from './largeGates.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';
import type {BuildingFacts} from './facts.ts';

const HOUSES = 'scripts/building-recipes/houses', ID = 'utrechtsestraat-15-169214';
const rawIntent = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = () => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8')) as BuildingFacts;

/** Undirected shell edges used by exactly one ring (cm keys), walls and roofs together. */
function openEdges(f: BuildingFacts): number {
  const key = (p: number[]) => p.map(v => Math.round(v * 100)).join(',');
  const count = new Map<string, number>();
  for (const ring of [...f.roofsRD.flatMap(r => r.ringsRD), ...(f.wallsRD ?? []).flatMap(w => w.ringsRD)])
    for (let i = 0; i < ring.length; i++) {
      const a = key(ring[i]), b = key(ring[(i + 1) % ring.length]);
      if (a === b) continue;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  return [...count.values()].filter(n => n === 1).length;
}

/** A 10 x 10 m box, 20 m to a flat roof on its west half and a tilted 24-26 m roof on its east half, ground at 1 m NAP. */
function toyFacts(): BuildingFacts {
  const g = 1, z = (m: number) => g + m;
  const quad = (a: number[], b: number[], lo: number, hiA: number, hiB: number) => [[a[0], a[1], z(lo)], [b[0], b[1], z(lo)], [b[0], b[1], z(hiB)], [a[0], a[1], z(hiA)]];
  const roofs = [
    [[0, 0, z(20)], [5, 0, z(20)], [5, 10, z(20)], [0, 10, z(20)]],
    [[5, 0, z(24)], [10, 0, z(26)], [10, 10, z(26)], [5, 10, z(24)]],
  ];
  const walls = [
    quad([0, 0], [5, 0], 0, 20, 20), quad([5, 0], [10, 0], 0, 24, 26), quad([10, 0], [10, 10], 0, 26, 26),
    quad([10, 10], [5, 10], 0, 26, 24), quad([5, 10], [0, 10], 0, 20, 20), quad([0, 10], [0, 0], 0, 20, 20),
    // the step wall between the two roofs, 20 -> 24 m
    [[5, 0, z(20)], [5, 10, z(20)], [5, 10, z(24)], [5, 0, z(24)]],
    // a wall lying wholly in the upper roof zone (a parapet stub between tilted planes)
    [[7, 2, z(24.8)], [8, 2, z(25.2)], [8, 2, z(25.6)], [7, 2, z(25.4)]],
  ];
  return {
    schemaVersion: 1, pandId: 'toy', source: {threeDBag: '', fetchedAt: '2026-10-23', streets: ''}, attributes: {},
    bagFootprintRD: [[[0, 0], [10, 0], [10, 10], [0, 10]]], surveyFootprintPolygonsRD: [[[[0, 0], [10, 0], [10, 10], [0, 10]]]],
    roofsRD: roofs.map((r, i) => ({surfaceId: `toy:lod22:roof:${i}`, vertices: r, ringsRD: [r], slopeDeg: i ? 11.3 : 0, areaM2: ringArea3(r)})),
    heights: {groundNAP: g, roofMinM: 20, roofMaxM: 26, ridgeM: 26, dak50pM: 22, dak70pM: 24, storeys: null, builtYear: 1932},
    fronts: [],
    wallsRD: walls.map((r, i) => ({surface: i + 1, ringsRD: [r], onFootprintEdge: i < 6, areaM2: ringArea3(r), bearingDeg: 0, bottomM: Math.min(...r.map(p => p[2])) - g, topM: Math.max(...r.map(p => p[2])) - g})),
  } as unknown as BuildingFacts;
}

test('levelRoofAbove flattens the roof planes above fromM, cuts the walls through it and drops walls above it', () => {
  const before = toyFacts();
  const {facts: f, report} = levelRoofAbove(before, {fromM: 22, toM: 25});
  assert.deepEqual(f.roofsRD[0], before.roofsRD[0], 'the 20 m roof is untouched');
  assert.ok(f.roofsRD[1].ringsRD[0].every(p => p[2] === 26), 'the tilted roof is flat at 25 m above the 1 m ground');
  assert.equal(f.roofsRD[1].slopeDeg, 0);
  assert.equal(report.levelledRoofs, 1);
  assert.equal(report.droppedWalls, 1, 'the stub wholly above 22 m is gone');
  assert.equal(f.wallsRD!.length, 7);
  assert.equal(report.cutWalls, 4, 'east-half facades (3) and the step wall end at 25 m');
  const step = f.wallsRD!.find(w => w.surface === 7)!;
  assert.deepEqual(step.ringsRD[0].map(p => p[2]), [21, 21, 26, 26]);
  assert.equal(step.topM, 25);
  assert.ok(Math.abs(step.areaM2 - 50) < 1e-9);
  assert.equal(f.heights.roofMaxM, 25);
  assert.deepEqual(f.wallsRD!.find(w => w.surface === 1), before.wallsRD!.find(w => w.surface === 1), 'walls under fromM are untouched');
});

test('levelRoofAbove refuses a level that cuts a roof plane, and toM at or under fromM', () => {
  assert.throws(() => levelRoofAbove(toyFacts(), {fromM: 25, toM: 27}), /cuts roof plane toy:lod22:roof:1/);
  assert.throws(() => levelRoofAbove(toyFacts(), {fromM: 22, toM: 22}), /must lie above fromM/);
});

test('rooftopLevel starts at the fronts, clears every plane that starts under them, and takes the median level', () => {
  // fronts 1 and 5 end at 20 m; the east roof starts at 24 m, so it is the rooftop, at its own mid height
  assert.deepEqual(rooftopLevel(toyFacts(), [1, 5]), {fromM: 20, toM: 25});
  // with the east facade (26 m) as a front nothing lies above
  assert.throws(() => rooftopLevel(toyFacts(), [3]), /no roof plane lies above the fronts/);
});

test('levelRooftop is validated (no metres in an intent)', () => {
  const bad = (levelRooftop: unknown) => () => validateLargeIntent({...rawIntent(), roof: {material: 'zinc', levelRooftop}});
  assert.throws(bad({}), /levelRooftop.evidence/);
  assert.throws(bad({evidence: 'x', fromM: 32}), /fromM: coordinate\/metric field/);
});

test('Utrechtsestraat 15 (user note 0132871b): no crumpled rooftop, every front untouched, the shell no more open', async () => {
  const intent = validateLargeIntent(rawIntent());
  assert.ok(intent.roof?.levelRooftop);
  const raw = facts(), spec = rooftopLevel(raw, intent.walls.flatMap(w => w.wallSurfaces));
  // the Booking.com front's 30.5 m top, raised past the tilted planes 729/750/767 that start under it (to 31.88 m)
  assert.deepEqual(spec, {fromM: 31.88, toM: 35.62});
  const {facts: f, report} = levelRoofAbove(raw, spec);
  const g = raw.heights.groundNAP;
  // Before: ~90 tilted planes over 32 m, up to 40.7 m.
  assert.ok(raw.roofsRD.filter(r => Math.max(...r.ringsRD.flat().map(p => p[2] - g)) > 31.88 && r.slopeDeg > 3).length > 40);
  assert.equal(report.levelledRoofs, raw.roofsRD.filter(r => Math.min(...r.ringsRD.flat().map(p => p[2] - g)) > 31.88).length);
  for (const r of f.roofsRD) {
    const zs = r.ringsRD.flat().map(p => p[2] - g);
    if (Math.max(...zs) > 31.88) assert.ok(zs.every(z => Math.abs(z - 35.62) < 1e-6), `${r.surfaceId} is flat at 35.62 m`);
  }
  assert.ok(Math.abs(f.heights.roofMaxM - 35.62) < 1e-6);
  // The photographed fronts (walls[] groups) keep their 3DBAG geometry.
  for (const s of intent.walls.flatMap(w => w.wallSurfaces))
    assert.deepEqual(f.wallsRD!.find(w => w.surface === s), raw.wallsRD!.find(w => w.surface === s), `front wall ${s} unchanged`);
  assert.ok(openEdges(f) <= openEdges(raw), `open edges ${openEdges(raw)} -> ${openEdges(f)}`);
  // Compiles through the kit and passes every large-tier gate the install runs (ridge, eaves, open edges, parts).
  const built = compileBuilding(intent, raw) as CompiledLargeBuilding;
  assert.equal(built.fit.roofLevel?.levelledRoofs, report.levelledRoofs);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const failed = evaluateLargeGates(await decodeTriangles(glb.bytes), built).gates.filter(x => !x.pass && !x.advisory);
  assert.deepEqual(failed, []);
});
