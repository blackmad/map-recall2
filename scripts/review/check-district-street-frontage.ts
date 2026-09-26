/**
 * Named regression for the district street-frontage camera (2026-09-21, pass 22).
 *
 * The zero-activation district renderer draws a `street-frontage` view so a human
 * can judge storey rhythm, roofline and massing. The first picker scored walls by
 * raw area and stood off from the whole building bbox, so for parallel-slab
 * districts the camera landed inside the slab across the street and produced a
 * featureless wall filling the frame (pass 20, defect 4). The selection now lives
 * in `src/canalRecall/review/districtFrontage.ts` and stands clear of the first
 * opposite footprint.
 *
 * This check loads each district's compiled tiles (read-only — no release, no
 * `current.json`, no `pipeline:district`) and pins:
 *  - the selected building id and street per district (a named location),
 *  - that the camera is not inside any building footprint,
 *  - that the standoff never exceeds the measured clear distance and the field of
 *    view stays in range.
 *
 * If a district's compiled run is absent (e.g. a clean checkout with no `.cache`),
 * the check reports SKIP rather than failing; the unit test
 * `src/canalRecall/review/districtFrontage.test.ts` carries the deterministic
 * guard.
 *
 * Run: npx tsx scripts/review/check-district-street-frontage.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  footprintRings,
  pointInRings,
  selectStreetFrontage,
  type OwnerLike,
} from '../../src/canalRecall/review/districtFrontage.ts';

interface Pinned {
  areaId: string;
  building: string;
  street: string;
  wallWidth: number;
  wallHeight: number;
}

const PINNED: Pinned[] = [
  { areaId: 'apollobuurt-v1', building: '0363100012100929', street: 'Anthonie van Dijckstraat', wallWidth: 27.1, wallHeight: 10.9 },
  { areaId: 'slotervaart-v1', building: '0363100012103095', street: 'Comeniusstraat', wallWidth: 93.3, wallHeight: 25 },
  { areaId: 'tuindorp-nieuwendam-v1', building: '0363100012088768', street: 'Het Hoogt', wallWidth: 190.3, wallHeight: 14.4 },
];

async function loadOwners(areaId: string): Promise<OwnerLike[] | null> {
  const areasRoot = `.cache/city-appearance/areas/${areaId}/runs`;
  let runs: string[];
  try {
    runs = await fs.readdir(areasRoot);
  } catch {
    return null;
  }
  if (!runs.length) return null;
  const run = path.join(areasRoot, runs.sort().at(-1)!);
  const tilesDir = (await fs.readdir(run)).find((name) => name.startsWith('tiles-'));
  if (!tilesDir) return null;
  const index = JSON.parse(await fs.readFile(path.join(run, tilesDir, 'index.json'), 'utf8'));
  const ownersById = new Map<string, OwnerLike>();
  for (const key of index.tileList) {
    const file = path.join(run, tilesDir, `${key}.json.gz`);
    const tile = JSON.parse(zlib.gunzipSync(await fs.readFile(file)).toString());
    for (const owner of [...(tile.owners ?? []), ...(tile.halo ?? [])]) {
      if (!ownersById.has(owner.id)) ownersById.set(owner.id, owner);
    }
  }
  return [...ownersById.values()].filter(
    (owner) => owner.geometry?.frame?.originRD && (owner.geometry?.building?.surfaces?.length ?? 0) > 0,
  );
}

let checked = 0;
for (const pin of PINNED) {
  const owners = await loadOwners(pin.areaId);
  if (!owners) {
    console.log(`SKIP ${pin.areaId}: no compiled run under .cache`);
    continue;
  }
  const origin = owners[0].geometry!.frame!.originRD!;
  const frontage = selectStreetFrontage(owners, origin);
  assert.ok(frontage, `${pin.areaId}: a street frontage must be selected`);
  assert.equal(frontage.building, pin.building, `${pin.areaId}: selected building changed`);
  assert.equal(frontage.street, pin.street, `${pin.areaId}: selected street changed`);
  assert.equal(frontage.wallWidth, pin.wallWidth, `${pin.areaId}: frontage width changed`);
  assert.equal(frontage.wallHeight, pin.wallHeight, `${pin.areaId}: frontage height changed`);

  // The camera must stand in the open: not inside any building's footprint.
  let inside: string | null = null;
  for (const owner of owners) {
    if (owner.geometry?.building?.id === frontage.building) continue;
    const rings = footprintRings(owner, origin);
    if (rings.length && pointInRings(frontage.position[0], frontage.position[2], rings)) {
      inside = owner.geometry?.building?.id ?? '?';
      break;
    }
  }
  assert.equal(inside, null, `${pin.areaId}: frontage camera is inside building ${inside}`);
  assert.ok(frontage.standoff <= frontage.clearDistance + 1e-6, `${pin.areaId}: standoff exceeds the clear distance`);
  assert.ok(frontage.fov >= 45 && frontage.fov <= 72, `${pin.areaId}: field of view out of range`);
  assert.ok(frontage.position[1] > frontage.groundY, `${pin.areaId}: camera is below ground`);

  console.log(
    `ok ${pin.areaId}: ${frontage.street} (${frontage.wallWidth}×${frontage.wallHeight} m), ` +
      `standoff ${frontage.standoff} m, fov ${frontage.fov}°, blocked=${frontage.blocked}`,
  );
  checked += 1;
}

if (checked === 0) {
  console.log('district street frontage: SKIP (no compiled district runs present)');
} else {
  console.log(`district street frontage: ${checked}/${PINNED.length} districts pinned and clear of obstruction`);
}
