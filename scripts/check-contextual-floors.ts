/**
 * Named regression for the contextual (inferred) upper-floor rhythm used by the
 * city-wide close-LOD display prior.
 *
 * Why this exists: the 21 Sep user review grouped cases 12/13/16/17 as "missing
 * inferred floors" and pass-1 diagnosed the contextual floor count
 * (`floor(height/floorHeight)`) as the root cause with "round-up" as the fix.
 * Inspecting the real reviewed wall geometry shows that claim is wrong: on all
 * 20 wall surfaces of those four buildings the extra round-up row does not fit
 * the actual 3DBAG wall polygon, so `Math.ceil` changes nothing there. Most of
 * those cases also render the observed extraction path, not the contextual
 * prior. This check pins the soundness invariant and records the measured
 * floor sets so a future pass can see when the inference really changes.
 *
 * Run: npx tsx scripts/check-contextual-floors.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contextualFacadePatches, facadeWallFrame } from '../src/canalRecall/cityAppearanceFacadeRecipes.js';

type Owner = any;

// --- Synthetic rectangular wall: the floor rule must be the documented one.
const synth = (height: number, year = 1900): Owner => ({
  id: `contextual-floors-fixture-h${height}`,
  geometryRevision: `geometry-h${height}`,
  footprint: { type: 'Polygon', coordinates: [[[4.8, 52.3], [4.8001, 52.3], [4.8001, 52.3001], [4.8, 52.3001], [4.8, 52.3]]] },
  geometry: {
    frame: { originRD: { x: 120000, y: 480000 }, axes: 'x=east,y=up,z=south', heightDatum: 'legacy-block-NAP-minus-0.65m' },
    building: {
      id: `contextual-floors-fixture-h${height}`,
      year,
      footprint: { type: 'Polygon', coordinates: [[[0, 0], [12, 0], [12, 8], [0, 8], [0, 0]]] },
      surfaces: [{ type: 'wall', rings: [[[0, 0, 0], [12, 0, 0], [12, height, 0], [0, height, 0]]] }],
    },
  },
  observations: [],
});

const floorsOf = (owner: Owner) => {
  const windows = contextualFacadePatches(owner, owner.geometry.building.surfaces[0], 0, [owner])
    .filter((patch: any) => patch.featureKind === 'contextual-window-prior');
  const ids = new Set(windows.map((patch: any) => (/context-window:(\d+):/.exec(patch.featureId) ?? [])[1]));
  return { windows, floors: [...ids].map(Number).sort((a, b) => a - b) };
};

// Rectangular wall, floorHeight 3.45 (pre-1940). The current rule truncates
// (`Math.floor`), so 13.6 m renders three rows even though a fourth would fit a
// rectangular wall. That truncation is real, but it is not the defect behind the
// reviewed cases: their 3DBAG walls are trapezoidal, so the fourth row does not
// fit and round-up is a no-op (asserted below).
for (const [height, expected] of [[12, [0, 1, 2]], [13.6, [0, 1, 2]], [5.2, [0]]] as const) {
  const { windows, floors } = floorsOf(synth(height));
  assert.deepEqual(floors, [...expected], `height ${height} must infer floors [${expected}]`);
  assert.equal(windows.length, windows.length / 5 * 5, 'window patches stay grouped in complete assemblies');
  for (const patch of windows) {
    for (let index = 0; index < patch.triangles.length; index += 3) {
      const y = patch.triangles[index + 1];
      assert.ok(y >= -1e-6 && y <= height + 1e-6, `contextual window y=${y} escaped the ${height} m wall`);
    }
  }
}

// The inference is deterministic and creates no observation identity.
const first = contextualFacadePatches(synth(13.6), synth(13.6).geometry.building.surfaces[0], 0, [synth(13.6)]);
const second = contextualFacadePatches(synth(13.6), synth(13.6).geometry.building.surfaces[0], 0, [synth(13.6)]);
assert.deepEqual(first, second, 'contextual floor inference must be stable for one identity');
assert.ok(first.every((patch: any) => patch.observationId === null && patch.styleSource === 'procedural-prior-not-measured'));

// --- Real reviewed geometries. Pin the measured floor sets and the evidence
// that a naive round-up is a no-op on every wall surface of these cases.
const data = JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json', 'utf8'));
const expectedFloors: Record<string, number[]> = {
  'case-12': [0, 1],
  'case-13': [0, 1, 2, 3, 4],
  'case-16': [0, 1, 2, 3],
  'case-17': [0, 1, 2, 3, 4],
};
let roundUpWouldFit = 0;
for (const cid of Object.keys(expectedFloors)) {
  const entry = data.cases.find((item: any) => item.caseId === cid);
  assert.ok(entry, `${cid} missing from the review packet`);
  const owner: Owner = entry.owner;
  const building = owner.geometry.building;
  const rendered: any[] = [];
  for (const [index, surface] of (building.surfaces as any[]).entries()) {
    if (surface.type !== 'wall') continue;
    const patches = contextualFacadePatches(owner, surface, index, [owner]);
    assert.deepEqual(patches, contextualFacadePatches(owner, surface, index, [owner]), `${cid} wall ${index} must be deterministic`);
    const frame = facadeWallFrame(surface, owner, [owner]);
    if (frame) {
      for (const patch of patches) {
        for (let i = 0; i < patch.triangles.length; i += 3) {
          const y = patch.triangles[i + 1];
          assert.ok(y >= frame.bottom - 1e-6 && y <= frame.top + 1e-6, `${cid} wall ${index}: patch escaped the wall band`);
        }
      }
    }
    rendered.push(...patches.filter((patch: any) => patch.featureKind === 'contextual-window-prior'));
    // Does Math.ceil(height/floorHeight) add a row that the wall polygon accepts?
    const ground = Number.isFinite(building.groundNAP) ? building.groundNAP - .65 : frame?.bottom ?? 0;
    const height = Math.min(frame?.top ?? ground, ground + 42) - ground;
    const floor = Math.floor(height / 3.45), ceil = Math.ceil(height / 3.45);
    if (frame && floor !== ceil) {
      const windowHeight = Math.min(1.85, 3.45 * .58);
      const extraY = ground + .55 + (floor + .5) * 3.45;
      const bays = Math.max(1, Math.round(frame.width / 2.45));
      const polygon = frame.polygon as number[][];
      const fits = [...Array(bays)].every((_, bay) => {
        const t = ((bay + .5) * frame.width) / bays;
        let top = -Infinity;
        for (let e = 0; e < polygon.length; e++) {
          const p = polygon[e], q = polygon[(e + 1) % polygon.length];
          if ((p[0] <= t && t <= q[0]) || (q[0] <= t && t <= p[0])) {
            const y = p[0] === q[0] ? Math.max(p[1], q[1]) : p[1] + ((q[1] - p[1]) * (t - p[0])) / (q[0] - p[0]);
            top = Math.max(top, y);
          }
        }
        return extraY + windowHeight / 2 + .08 <= top;
      });
      if (fits) roundUpWouldFit++;
    }
  }
  const ids = new Set(rendered.map((patch: any) => Number((/context-window:(\d+):/.exec(patch.featureId) ?? [])[1])));
  const floors = [...ids].sort((a, b) => a - b);
  assert.deepEqual(floors, expectedFloors[cid], `${cid} contextual floor set changed`);
}
assert.equal(roundUpWouldFit, 0, 'round-up is expected to be a no-op on all reviewed wall surfaces');

console.log(`Contextual floor regression passed: reviewed floor sets ${JSON.stringify(expectedFloors)}; round-up fits 0/20 reviewed walls.`);
