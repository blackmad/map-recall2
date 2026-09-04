/**
 * Pin the massing layer's geometry and tier ownership.
 *
 * The layer is the first thing in this project that draws pixels, and a
 * silhouette bug is cheap to see but expensive to leave in: it becomes the
 * reference every later façade measurement is judged against. So the geometry
 * rules are checked here, without a WebGL context, against the real extract.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../src/canalRecall/facade/areas.ts';
import { buildingGeometry, colourFor, drawableHeights, EVIDENCE_COLOURS, ownedPandIds, type Lod22Extract } from '../src/canalRecall/facade/facadeLayer.ts';

const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AMSTERDAM_GRACHTENGORDEL_WEST.areaId);
const extract = JSON.parse(readFileSync(path.join(STAGING, 'lod22.json'), 'utf8')) as Lod22Extract;

const failures: string[] = [];
let checks = 0;
const check = (label: string, condition: boolean, detail: string) => {
  checks++;
  if (!condition) failures.push(`${label} — ${detail}`);
  if (!condition || process.env.VERBOSE) console.log(`${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
};

check('extract is the pilot boundary', extract.buildings.length > 2900 && extract.buildings.length < 3200, `${extract.buildings.length} buildings`);

// Every building must be drawable. A hole in a terrace reads as "no building
// here", which is a worse lie than a wall of uncertain height.
let empty = 0, degenerate = 0;
let minZ = Infinity, maxZ = -Infinity;
for (const building of extract.buildings) {
  const geometry = buildingGeometry(building);
  if (!geometry.positions.length) { empty++; continue; }
  if (geometry.positions.length % 9 !== 0) degenerate++;
  for (let i = 2; i < geometry.positions.length; i += 3) {
    minZ = Math.min(minZ, geometry.positions[i]);
    maxZ = Math.max(maxZ, geometry.positions[i]);
  }
}
check('every building produces geometry', empty === 0, `${empty} produced none`);
check('every mesh is whole triangles', degenerate === 0, `${degenerate} had a partial triangle`);
check('nothing is drawn below the datum by more than a souterrain', minZ > -4, `lowest vertex ${minZ.toFixed(1)} m`);
check('nothing is taller than the Westerkerk tower', maxZ < 90, `highest vertex ${maxZ.toFixed(1)} m`);

// The eaves may never sit above the ridge — the inversion resolveHeights exists
// to catch. 198 buildings in this extract have inverted source heights, so this
// is a live case, not a hypothetical.
let inverted = 0;
for (const building of extract.buildings) {
  const { eaves, ridge } = drawableHeights(building);
  if (eaves > ridge + 1e-6) inverted++;
}
check('no eaves line above its own ridge', inverted === 0, `${inverted} inverted after resolution`);

const estimated = extract.buildings.filter(b => drawableHeights(b).estimated).length;
check('most buildings have a measured height', estimated < extract.buildings.length * 0.1, `${estimated} drawn at a fallback height`);

// Estimated heights must be visibly flagged, or a fallback silently becomes a
// measurement to anyone looking at the screen.
const withoutHeight = extract.buildings.find(b => drawableHeights(b).estimated);
if (withoutHeight) {
  check('a fallback height reads as unmeasured in evidence mode',
    colourFor(withoutHeight, 'evidence', 'wall') === EVIDENCE_COLOURS.estimated,
    `pand ${withoutHeight.id}`);
}
const measured = extract.buildings.find(b => !drawableHeights(b).estimated && b.reason === 'ok');
if (measured) {
  check('a measured height reads as measured',
    colourFor(measured, 'evidence', 'wall') === EVIDENCE_COLOURS.measured, `pand ${measured.id}`);
}
const invertedSource = extract.buildings.find(b => b.reason === 'inverted');
check('an inverted source height is flagged rather than hidden',
  !!invertedSource && colourFor(invertedSource, 'evidence', 'wall') === EVIDENCE_COLOURS.inverted,
  invertedSource ? `pand ${invertedSource.id}` : 'no inverted building in the extract');

// Tier ownership: the ids this layer claims are what the 3DBAG layer must skip.
const owned = ownedPandIds(extract);
check('every drawn building is claimed for tier ownership', owned.size === extract.buildings.length, `${owned.size} ids for ${extract.buildings.length} buildings`);
check('claimed ids are BAG pand ids', [...owned].every(id => /^\d{16}$/.test(id)), `${[...owned].filter(id => !/^\d{16}$/.test(id)).length} malformed`);

// A flat roof has no pitch, so it must not sprout one.
const flat = extract.buildings.filter(b => b.roof === 'flat' && b.eaves !== null && b.ridge !== null);
const pitchedFlats = flat.filter(b => { const h = drawableHeights(b); return h.ridge - h.eaves > 2; }).length;
check('flat roofs are not drawn with a pitch', pitchedFlats < flat.length * 0.25, `${pitchedFlats} of ${flat.length} flat roofs rise more than 2 m`);

console.log(`Extract: ${extract.buildings.length} buildings, heights ${minZ.toFixed(1)}–${maxZ.toFixed(1)} m, ${estimated} at a fallback height.`);
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} layer checks failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`All ${checks} layer checks passed.`);
