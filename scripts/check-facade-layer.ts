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
import { buildingGeometry, colourFor, drawableHeights, EVIDENCE_COLOURS, FACADE_COLOURS, gableFor, openingGeometry, ownedPandIds, type Lod22Extract } from '../src/canalRecall/facade/facadeLayer.ts';

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

// ---- façade invariants ---------------------------------------------------
// These matter more than the massing ones. A wrong silhouette is visibly wrong;
// a window drawn where none was measured is invisibly wrong, and it is the exact
// failure the brief says is worse than a gap.
const withFacade = extract.buildings.filter(b => b.facade);
const openingsTotal = withFacade.reduce((sum, b) => sum + b.facade!.openings.length, 0);

check('no façade without openings behind it', withFacade.every(b => b.facade!.openings.length > 0),
  `${withFacade.filter(b => b.facade!.openings.length === 0).length} carry an empty façade`);

// An opening outside its own wall is a rectification failure, and drawing it
// puts a window on a neighbour's house.
let strayOpenings = 0, tallOpenings = 0, sunkOpenings = 0;
for (const building of withFacade) {
  const [x0, y0, x1, y1] = building.facade!.wall;
  const wallLength = Math.hypot(x1 - x0, y1 - y0);
  const { ridge } = drawableHeights(building);
  for (const [along, up, width, height] of building.facade!.openings) {
    if (along < -0.5 || along + width > wallLength + 0.5) strayOpenings++;
    if (up + height > ridge + 0.5) tallOpenings++;
    if (up < -2.5) sunkOpenings++;
  }
}
check('no opening outside its own wall', strayOpenings === 0, `${strayOpenings} of ${openingsTotal} stray`);
check('no opening above its own ridge', tallOpenings === 0, `${tallOpenings} of ${openingsTotal} above the roof`);
check('no opening buried below the souterrain', sunkOpenings === 0, `${sunkOpenings} of ${openingsTotal} under the ground`);

// Geometry must actually be produced for a measured façade, and never for one
// that was not measured.
const drawn = withFacade.filter(b => openingGeometry(b).positions.length > 0).length;
check('every measured façade draws openings', drawn === withFacade.length, `${drawn}/${withFacade.length}`);
const unobserved = extract.buildings.find(b => !b.facade);
if (unobserved) {
  check('an unobserved building draws no openings', openingGeometry(unobserved).positions.length === 0, `pand ${unobserved.id}`);
  check('an unobserved building reads as unobserved', colourFor(unobserved, 'facade', 'wall') === FACADE_COLOURS.unobserved, `pand ${unobserved.id}`);
}

// Every opening draws glass, joinery and a sill, and nothing else.
const strayCounts = withFacade.find(b => {
  const drawnHere = b.facade!.openings.filter(([along, , w, h]) => {
    const [x0, y0, x1, y1] = b.facade!.wall;
    const length = Math.hypot(x1 - x0, y1 - y0);
    return along >= -0.5 && along <= length + 0.5 && w >= 0.2 && h >= 0.2;
  }).length;
  const parts = openingGeometry(b).part;
  const glass = parts.filter(p => p === 'glass').length / 6;
  const sill = parts.filter(p => p === 'sill').length / 6;
  return glass !== drawnHere || sill !== drawnHere * 2;
});
check('each opening draws one glass pane and its sill', !strayCounts,
  strayCounts ? `pand ${strayCounts.id}` : `${openingsTotal} openings`);

// Depth is the point of the window rewrite, and it is built outward because
// the wall has no aperture cut in it. Two things have to hold, measured on the
// wall's own outward normal so they hold at any bearing: the pane must sit at
// the wall face, not buried behind it — buried, it is inside the building and
// nothing can see it, which rendered a terrace as rows of white dashes — and
// the joinery must stand proud of the pane, because the shadow the joinery
// throws across the glass is the whole cue that says "hole" rather than
// "sticker".
const depths = (b: (typeof withFacade)[number], want: string) => {
  const geometry = openingGeometry(b);
  const [x0, y0, x1, y1] = b.facade!.wall;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const nx = (y1 - y0) / length, ny = -(x1 - x0) / length;
  const out: number[] = [];
  for (let i = 0; i < geometry.part.length; i++) {
    if (geometry.part[i] !== want) continue;
    out.push((geometry.positions[i * 3] - x0) * nx + (geometry.positions[i * 3 + 1] - y0) * ny);
  }
  return out;
};
const buried = withFacade.find(b => {
  const glass = depths(b, 'glass');
  return glass.length > 0 && Math.min(...glass) < -0.001;
});
check('the pane sits at the wall face, not inside the building', !buried,
  buried ? `pand ${buried.id}` : 'all panes');

const noRelief = withFacade.find(b => {
  const glass = depths(b, 'glass'), frame = depths(b, 'frame');
  if (!glass.length || !frame.length) return false;
  return Math.max(...frame) - Math.max(...glass) < 0.04;
});
check('the joinery stands proud of the pane', !noRelief, noRelief ? `pand ${noRelief.id}` : 'all reveals');

// The ridge is a measurement and the gable is drawn, so the drawing conforms to
// the measurement and never the other way round: no gable may stand above the
// ridge the laser found. A shaped gable reaches it exactly, because that is
// what a shaped gable is — the front wall carried up to the ridge. A `lijst`
// deliberately does not: it is a cornice with the roof visible behind it, and
// forcing it to the ridge would turn every 19th-century parapet into a spout.
const gabled = extract.buildings.filter(b => b.facade && (b.ridge ?? 0) - (b.eaves ?? 0) > 0.5);
const peakOf = (b: (typeof gabled)[number]) => {
  const geometry = buildingGeometry(b);
  let peak = -Infinity;
  for (let i = 0; i < geometry.part.length; i++) {
    if (geometry.part[i] === 'gable') peak = Math.max(peak, geometry.positions[i * 3 + 2]);
  }
  return peak;
};
const overRidge = gabled.find(b => peakOf(b) > b.ground + b.ridge! + 0.05);
check('no gable stands above the measured ridge', !overRidge,
  overRidge ? `pand ${overRidge.id}` : `${gabled.length} gables`);
const shaped = gabled.filter(b => gableFor(b).type !== 'lijst');
const shortGable = shaped.find(b => Math.abs(peakOf(b) - (b.ground + b.ridge!)) > 0.05);
check('a shaped gable reaches the measured ridge', !shortGable,
  shortGable ? `pand ${shortGable.id}` : `${shaped.length} shaped`);

// A building nobody has looked at gets the plainest gable there is. Anything
// shaped would be inventing a front that has never been photographed.
const unobservedGables = extract.buildings.filter(b => !b.facade);
const invented = unobservedGables.find(b => gableFor(b).type !== 'punt' || gableFor(b).stated);
check('an unobserved front gets a plain gable', !invented,
  invented ? `pand ${invented.id}` : `${unobservedGables.length} unobserved`);

console.log(`Façades: ${withFacade.length} measured, ${openingsTotal} openings, `
  + `${(100 * withFacade.length / extract.buildings.length).toFixed(1)}% of the boundary observed.`);
console.log(`Extract: ${extract.buildings.length} buildings, heights ${minZ.toFixed(1)}–${maxZ.toFixed(1)} m, ${estimated} at a fallback height.`);
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} layer checks failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`All ${checks} layer checks passed.`);
