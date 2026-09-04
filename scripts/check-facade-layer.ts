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
import { buildingGeometry, classifyOpening, colourFor, drawableHeights, EVIDENCE_COLOURS, FACADE_COLOURS, gableFor, openingGeometry, ownedPandIds, type Lod22Extract } from '../src/canalRecall/facade/facadeLayer.ts';

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

// Every opening draws a leaf — glass, or a door panel where the shape says
// door — and a window keeps its sill. A door and a shopfront do not get one:
// they meet the pavement, and a projecting stone sill across a doorway is a
// step nobody measured.
const drawnOpenings = (b: (typeof withFacade)[number]) => {
  const [x0, y0, x1, y1] = b.facade!.wall;
  const wallLength = Math.hypot(x1 - x0, y1 - y0);
  return b.facade!.openings.filter(([along, , w, h]) =>
    along >= -0.5 && along <= wallLength + 0.5 && w >= 0.2 && h >= 0.2);
};
const strayCounts = withFacade.find(b => {
  const here = drawnOpenings(b);
  const leaves = here.length;
  const sills = here.filter(([, up, w, h]) => {
    const kind = classifyOpening(up, w, h);
    return kind === 'window' || kind === 'souterrain';
  }).length;
  const parts = openingGeometry(b).part;
  const drawn = (parts.filter(p => p === 'glass').length + parts.filter(p => p === 'door').length) / 6;
  return drawn !== leaves || parts.filter(p => p === 'sill').length / 6 !== sills * 2;
});
check('each opening draws one leaf, and only a window gets a sill', !strayCounts,
  strayCounts ? `pand ${strayCounts.id}` : `${openingsTotal} openings`);

// A door must not draw as glass: that is what made every ground floor look like
// another storey of windows.
const glassDoor = withFacade.find(b => {
  const geometry = openingGeometry(b);
  const doors = drawnOpenings(b).filter(([, up, w, h]) => classifyOpening(up, w, h) === 'door').length;
  return doors > 0 && geometry.part.filter(p => p === 'door').length / 6 !== doors;
});
check('a door draws as a panel, not as glass', !glassDoor,
  glassDoor ? `pand ${glassDoor.id}` : 'all doors');

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

// Every face must point out of the building.
//
// This is the check that was missing when roofs rendered see-through. BAG
// footprint rings arrive in both winding directions, the plot frame's normal
// flips with them, and a face wound the wrong way is discarded by the GPU as a
// back face — so the building gets a hole you can look through into a dark
// interior, and any face that survives is lit as though the sun were inside it.
// Testable with no GPU at all: a normal on a closed solid points away from the
// middle of the solid.
const inwardFacing = extract.buildings.find(b => {
  const geometry = buildingGeometry(b);
  if (!geometry.positions.length) return false;
  const ring = b.ring, n = ring.length / 2;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += ring[i * 2]; cy += ring[i * 2 + 1]; }
  cx /= n; cy /= n;
  const { eaves } = drawableHeights(b);
  const cz = b.ground + eaves / 2;
  for (let i = 0; i < geometry.positions.length / 3; i += 3) {
    // One vertex per triangle is enough: the whole triangle shares a normal.
    const dx = geometry.positions[i * 3] - cx;
    const dy = geometry.positions[i * 3 + 1] - cy;
    const dz = geometry.positions[i * 3 + 2] - cz;
    const dot = geometry.normals[i * 3] * dx + geometry.normals[i * 3 + 1] * dy
      + geometry.normals[i * 3 + 2] * dz;
    // A face through the centre height can legitimately read near zero; only a
    // clearly inward normal is a fault.
    if (dot < -0.35) return true;
  }
  return false;
});
check('every face points out of its building', !inwardFacing,
  inwardFacing ? `pand ${inwardFacing.id}` : `${extract.buildings.length} buildings`);

// A canal house is entered from the street, so a façade measured down to the
// pavement should find the way in. This does not assert that every building has
// one — a warehouse door, a shared portico or a shopfront can all swallow it —
// but a *collapse* means the strip is not reaching the ground again, which is
// the failure that hid every door in the pilot behind a sill of exactly -0.40 m.
const groundFloor = withFacade.filter(b =>
  b.facade!.openings.some(([, up, w, h]) => up < 0.8 && h >= 1.8 && w <= 2.2));
const share = groundFloor.length / Math.max(withFacade.length, 1);
check('façades reach their own ground floor', share > 0.4,
  `${groundFloor.length}/${withFacade.length} carry a door-shaped opening (${(share * 100).toFixed(0)}%)`);

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
// Only a canal plot gets a shaped gable at all: a church, a warehouse or an
// L-shaped corner site gets a roof tapered inside its own footprint, because
// the plot-frame construction spans a bounding box and would throw shards over
// the neighbours. So this asks the question only of buildings that have one.
const hasGable = (b: (typeof gabled)[number]) =>
  buildingGeometry(b).part.some(p => p === 'gable');
const shaped = gabled.filter(b => gableFor(b).type !== 'lijst' && hasGable(b));
const shortGable = shaped.find(b => Math.abs(peakOf(b) - (b.ground + b.ridge!)) > 0.05);
check('a shaped gable reaches the measured ridge', !shortGable,
  shortGable ? `pand ${shortGable.id}` : `${shaped.length} shaped`);

// A building nobody has *photographed* gets the plainest gable there is —
// unless the register names one in prose, which is a weaker observation than a
// photograph but is still somebody having looked. What must never happen is a
// shaped gable on a building with neither: that would be pure invention on the
// exact question this twin exists not to invent.
const unobservedGables = extract.buildings.filter(b => !b.facade && !b.gable);
const invented = unobservedGables.find(b => gableFor(b).type !== 'punt' || gableFor(b).stated);
check('an unphotographed, unstated front gets a plain gable', !invented,
  invented ? `pand ${invented.id}` : `${unobservedGables.length} with neither`);

const statedOnly = extract.buildings.filter(b => !b.facade && b.gable);
check('a stated gable is marked as stated, not measured',
  statedOnly.every(b => gableFor(b).stated), `${statedOnly.length} stated without a photograph`);

console.log(`Façades: ${withFacade.length} measured, ${openingsTotal} openings, `
  + `${(100 * withFacade.length / extract.buildings.length).toFixed(1)}% of the boundary observed.`);
console.log(`Extract: ${extract.buildings.length} buildings, heights ${minZ.toFixed(1)}–${maxZ.toFixed(1)} m, ${estimated} at a fallback height.`);
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} layer checks failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`All ${checks} layer checks passed.`);
