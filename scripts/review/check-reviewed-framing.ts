/**
 * Named regression for the framing / centering / overlap group.
 *
 * Why this exists: the 21 Sep 25-case review grouped case-06 ("maybe taking in a
 * bit of the next building?"), case-20 ("too much overlap, needs to be better
 * centered") and case-30 ("registration slightly off; we could have inferred the
 * right fit") as one centering defect. Measuring the three reviewed owners shows
 * three *different* causes, only one of which is crop centring:
 *
 * 1. case-06 Da Costakade 204 has a single, correctly-sized 7.41 m frontage wall
 *    (surface #2), but the source crop clips the building on the right: the
 *    detected building run reaches the crop's right edge and the fourth upper
 *    window bay ends exactly at the crop width. The crop therefore includes a
 *    slice of the next building. This is a crop-composition defect and needs a
 *    versioned crop regeneration, not a compiler change.
 * 2. case-20 De Clercqstraat 74 registers a 6.05 m frontage that 3DBAG splits
 *    across TWO collinear, coplanar wall segments (#9 3.18 m + #8 2.87 m). The
 *    release already binds both ([8, 9]) and the preview carries one observation
 *    per segment, so the source is not compressed onto a single 2.87 m wall. The
 *    residual is that the review panel centres on the first usable segment, and
 *    the independently-transformed ground tier sits ~0.45 m from the upper tier.
 * 3. case-30 Rozengracht 212 registers a 4.43 m frontage that 3DBAG fragments
 *    into three near-collinear-but-skewed pieces (#2 1.27 m, #4 2.11 m, #5
 *    1.12 m; off-plane 0.01/0.46/0.70 m, angles 0.1/12.8/12.6 deg). Only #4
 *    clears the `surfaceMatches` overlap gate, so the release binds 2.11 m of a
 *    4.43 m frontage. The preview's 0.18 m non-coplanarity guard then abstains
 *    and the candidate renders as a blank monolith with zero observed patches.
 *
 * This check pins those measured facts so the framing lane cannot regress
 * silently and so a future crop regeneration / surface rebinding can assert the
 * corrected behaviour. It changes no published data.
 * Run: npx tsx scripts/review/check-reviewed-framing.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { columnEdgeProfile, detectFacadeBounds } from '../../src/canalRecall/facade/facadeCentering.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const EVIDENCE = 'public/data/city-expansion/evidence';

const data = JSON.parse(fs.readFileSync(CASES, 'utf8'));
const caseById = (id: string) => {
  const entry = data.cases.find((item: any) => item.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};
const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );

/** Minimal frontage/wall geometry, mirroring `surfaceMatches` in evidence.js. */
function wallFacts(caseId: string) {
  const entry = caseById(caseId);
  const observation = entry.candidateObservations[0];
  const building = entry.owner.geometry.building;
  const start = observation.localStart as [number, number];
  const end = observation.localEnd as [number, number];
  const frontage = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const ux = (end[0] - start[0]) / frontage, uz = (end[1] - start[1]) / frontage;
  const surfaces = (building.surfaces ?? []) as any[];
  const walls = surfaces.flatMap((surface, index) => {
    if (surface.type !== 'wall') return [];
    const points = surface.rings[0];
    const dist = points.map((p: number[]) => Math.abs((p[0] - start[0]) * uz - (p[2] - start[1]) * ux));
    const along = points.map((p: number[]) => (p[0] - start[0]) * ux + (p[2] - start[1]) * uz);
    let length = 0, direction: [number, number] = [0, 0];
    for (let k = 0; k < points.length; k++) {
      const q = points[(k + 1) % points.length];
      const edge = Math.hypot(q[0] - points[k][0], q[2] - points[k][2]);
      if (edge > length) { length = edge; direction = [(q[0] - points[k][0]) / edge, (q[2] - points[k][2]) / edge]; }
    }
    const angle = Math.acos(Math.min(1, Math.abs(direction[0] * ux + direction[1] * uz))) * 180 / Math.PI;
    const overlap = Math.min(frontage, Math.max(...along)) - Math.max(0, Math.min(...along));
    // Exact copy of the surfaceMatches acceptance test.
    const matches = Math.max(...dist) < 0.8 && overlap > Math.min(2, frontage * 0.5);
    return [{ index, length, maxDist: Math.max(...dist), angle, overlap, matches }];
  });
  return { frontage, walls, matches: walls.filter(w => w.matches).map(w => w.index) };
}

/** The release packet's own binding for the reviewed observation. */
function releaseBinding(caseId: string) {
  const regressions = JSON.parse(fs.readFileSync('scripts/review/facade-regressions.json', 'utf8'));
  const entry = regressions.cases.find((item: any) => item.caseId === caseId);
  assert.ok(entry, `${caseId} missing from facade-regressions.json`);
  const tile = JSON.parse(gunzipSync(fs.readFileSync(entry.binding.tile.path)).toString());
  const owner = tile.owners.find((item: any) => item.id === entry.binding.buildingId);
  const observation = owner.observations.find((item: any) => item.id === entry.binding.observationId).payload;
  return observation.renderSurfaceIndices as number[];
}

async function cropRun(caseId: string) {
  const entry = caseById(caseId);
  const sha = entry.candidateObservations[0].images.full.sha256;
  const decoded = await sharp(`${EVIDENCE}/${sha}.jpg`).greyscale().raw().toBuffer({ resolveWithObject: true });
  const image = { data: new Uint8Array(decoded.data), width: decoded.info.width, height: decoded.info.height };
  const bounds = detectFacadeBounds(columnEdgeProfile(image));
  assert.ok(bounds, `${caseId}: expected a measurable facade run`);
  return { width: image.width, height: image.height, bounds: bounds! };
}

// --- 1. case-06: correct single frontage, crop clips the next building ----
{
  const entry = caseById('case-06');
  const { frontage, matches } = wallFacts('case-06');
  near(frontage, 7.41, 0.02, 'case-06 registered frontage');
  assert.deepEqual(matches, [2], 'case-06 must bind exactly surface #2 (7.41 m, collinear)');
  assert.deepEqual(releaseBinding('case-06'), [2], 'case-06 release binding changed');
  const run = await cropRun('case-06');
  assert.ok(
    run.bounds.rightPx >= run.width - 2,
    `case-06 crop must stay clipped at the right edge (run ${run.bounds.leftPx}-${run.bounds.rightPx} of ${run.width})`,
  );
  const fourthBay = entry.shapeFeatures.full.features.find((f: any) => f.id === 'full:window-r1-b4');
  assert.ok(fourthBay, 'case-06 fourth upper bay missing');
  assert.equal(fourthBay.bounds[2], run.width, 'case-06 fourth bay must end exactly at the crop edge');
}

// --- 2. case-20: one frontage split across two coplanar walls -------------
{
  const { frontage, matches, walls } = wallFacts('case-20');
  near(frontage, 6.05, 0.02, 'case-20 registered frontage');
  assert.deepEqual(matches, [8, 9], 'case-20 frontage must be served by the two coplanar segments #8 + #9');
  const eight = walls.find(w => w.index === 8)!, nine = walls.find(w => w.index === 9)!;
  near(eight.length, 2.87, 0.02, 'case-20 wall #8 length');
  near(nine.length, 3.18, 0.02, 'case-20 wall #9 length');
  assert.ok(eight.angle < 0.3 && nine.angle < 0.3, 'case-20 segments must stay collinear with the frontage');
  assert.ok(eight.maxDist < 0.05 && nine.maxDist < 0.05, 'case-20 segments must stay coplanar with the frontage');
  near(eight.length + nine.length, frontage, 0.02, 'case-20 segments must together span the frontage');
  assert.deepEqual(releaseBinding('case-20'), [8, 9], 'case-20 release must keep both segments bound');
  const previewIndices = caseById('case-20').candidateObservations.map((o: any) => o.renderSurfaceIndices);
  assert.deepEqual(previewIndices, [[8], [9]], 'case-20 preview must carry one observation per segment');
  assert.ok(caseById('case-20').patches.length > 0, 'case-20 must compile observed patches');
  const run = await cropRun('case-20');
  assert.ok(
    Math.abs(run.bounds.centrePx - run.width / 2) > 15,
    'case-20 crop should remain measurably off-centre (the documented residual)',
  );
}

// --- 3. case-30: fragmented frontage -> blank monolith --------------------
{
  const { frontage, matches, walls } = wallFacts('case-30');
  near(frontage, 4.43, 0.02, 'case-30 registered frontage');
  assert.deepEqual(matches, [4], 'case-30 must bind only surface #4 under the current overlap gate');
  const four = walls.find(w => w.index === 4)!, two = walls.find(w => w.index === 2)!, five = walls.find(w => w.index === 5)!;
  near(four.length, 2.11, 0.02, 'case-30 wall #4 length');
  assert.ok(four.length < frontage - 1, 'case-30 bound wall must stay far narrower than the frontage');
  assert.ok(two.length < 2 && five.length < 2, 'case-30 short segments must remain below the 2 m overlap gate');
  // An independent wall (#0) is collinear but 10 m away; the guard must keep it out.
  assert.ok(walls.find(w => w.index === 0)!.maxDist > 5, 'case-30 collinear rear wall must stay far off-plane');
  assert.deepEqual(releaseBinding('case-30'), [4], 'case-30 release binding changed');
  const entry = caseById('case-30');
  assert.equal(entry.patches.length, 0, 'case-30 has no observed patches because the preview abstains');
  const omitted = (entry.omissions ?? []).join(' ');
  assert.ok(
    omitted.includes('full/surface 4: noncoplanar source abstained') && omitted.includes('ground/surface 4: noncoplanar source abstained'),
    `case-30 must record the non-coplanarity abstention, got: ${omitted || '(none)'}`,
  );
}

console.log(
  'Reviewed framing regression passed: case-06 clips its next-building slice at the crop edge; case-20 splits a 6.05 m frontage across coplanar #8 + #9; case-30 binds 2.11 m of a fragmented 4.43 m frontage and abstains to a blank candidate.',
);
