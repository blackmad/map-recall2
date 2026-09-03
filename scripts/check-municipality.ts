/**
 * Which boundary relation is "the city", checked without downloading a country.
 *
 * Both cities that failed to build on 2026-09-01 failed here, for two different
 * reasons, and both are pinned below: Den Haag because OSM renamed the relation
 * out from under a hardcoded `'s-Gravenhage`, and Rotterdam because a bbox cut
 * before the boundary was read left the relation with no closable ring.
 */
import assert from 'node:assert/strict';
import {
  type BoundaryFeature, boundingBox, findMunicipality, hasAreaGeometry, municipalityNames, osmiumBbox,
} from './lib/municipality.ts';

let checks = 0;
const check = (label: string, run: () => void) => { run(); checks++; void label; };

const relation = (properties: Record<string, string | undefined>, geometry: BoundaryFeature['geometry'] = {
  type: 'Polygon', coordinates: [[[4, 52], [5, 52], [5, 53], [4, 53], [4, 52]]],
}): BoundaryFeature => ({
  properties: { boundary: 'administrative', admin_level: '8', ...properties }, geometry,
});

// --- A city answers to more than one name ----------------------------------
check('the plain name matches', () => {
  assert.ok(findMunicipality([relation({ name: 'Amsterdam' })], 'Amsterdam'));
});

check("Den Haag is found under the name OSM carries today", () => {
  // Measured 2026-09-01 against Overpass: the relation is name="Den Haag",
  // official_name="'s-Gravenhage". The pipeline had been asking for the latter
  // as `name`, which matched nothing and took the city out of the build.
  const denHaag = relation({ name: 'Den Haag', 'name:nl': 'Den Haag', official_name: "'s-Gravenhage" });
  assert.ok(findMunicipality([denHaag], 'Den Haag'), 'by name');
  assert.ok(findMunicipality([denHaag], "'s-Gravenhage"), 'by official_name');
  // And under the older tagging, so a revert upstream does not break it again.
  const older = relation({ name: "'s-Gravenhage", 'name:nl': 'Den Haag' });
  assert.ok(findMunicipality([older], 'Den Haag'), 'by name:nl');
  assert.ok(findMunicipality([older], "'s-Gravenhage"), 'by the old name');
});

check('matching ignores case but not identity', () => {
  assert.ok(findMunicipality([relation({ name: 'Rotterdam' })], 'rotterdam'));
  assert.equal(findMunicipality([relation({ name: 'Rotterdam' })], 'Amsterdam'), undefined);
});

check('a district or province of the same name is not the municipality', () => {
  const district = relation({ name: 'Utrecht', admin_level: '10' });
  const province = relation({ name: 'Utrecht', admin_level: '4' });
  const city = relation({ name: 'Utrecht' });
  assert.equal(findMunicipality([district, province], 'Utrecht'), undefined);
  assert.equal(findMunicipality([district, province, city], 'Utrecht'), city);
});

check('a non-administrative boundary of the same name is not it either', () => {
  assert.equal(findMunicipality([relation({ name: 'Amsterdam', boundary: 'place' })], 'Amsterdam'), undefined);
});

check('every name field is read, and nothing else is', () => {
  const feature = relation({
    name: 'a', 'name:nl': 'b', 'name:en': 'c', official_name: 'd', alt_name: 'e', old_name: 'f',
  });
  assert.deepEqual(municipalityNames(feature), ['a', 'b', 'c', 'd', 'e']);
});

// --- A relation that did not close is not a boundary -----------------------
check('an unclosable relation is refused rather than used', () => {
  // This is Rotterdam's failure. osmium exports the relation as a line
  // collection when the source was cut through its member ways, and clipping a
  // city to that would silently keep whatever fell inside a stray ring.
  const cut = relation({ name: 'Rotterdam' }, { type: 'GeometryCollection', coordinates: [] });
  assert.ok(findMunicipality([cut], 'Rotterdam'), 'it is still the right relation');
  assert.equal(hasAreaGeometry(cut), false, 'but it has no area to clip with');
  assert.equal(hasAreaGeometry(undefined), false);
  assert.equal(hasAreaGeometry(relation({ name: 'x' }, null)), false);
  assert.ok(hasAreaGeometry(relation({ name: 'x' })), 'a Polygon is an area');
  assert.ok(hasAreaGeometry(relation({ name: 'x' }, {
    type: 'MultiPolygon', coordinates: [[[[4, 52], [5, 52], [5, 53], [4, 52]]]],
  })), 'and so is a MultiPolygon');
});

// --- The cut that follows is derived from the boundary, not guessed --------
check('the bounding box covers every ring of a MultiPolygon', () => {
  // Rotterdam's real shape: a compact city plus a detached western arm at Hoek
  // van Holland. A box taken from the first ring alone would cut the arm off,
  // which is exactly the failure this step exists to prevent.
  const box = boundingBox([
    [[[4.4, 51.9], [4.6, 51.9], [4.6, 52.0], [4.4, 52.0], [4.4, 51.9]]],
    [[[3.94, 51.95], [4.05, 51.95], [4.05, 52.0], [3.94, 52.0], [3.94, 51.95]]],
  ]);
  assert.deepEqual(box, { minLon: 3.94, minLat: 51.9, maxLon: 4.6, maxLat: 52.0 });
});

check('an empty geometry is an error, not an infinite box', () => {
  assert.throws(() => boundingBox([]), /no coordinates/);
});

check('the osmium bbox is grown, ordered and formatted', () => {
  const bbox = osmiumBbox({ minLon: 4.4, minLat: 51.9, maxLon: 4.6, maxLat: 52.0 }, 2000);
  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
  assert.equal(bbox.split(',').length, 4);
  assert.ok(minLon < 4.4 && maxLon > 4.6, `longitude was not grown: ${bbox}`);
  assert.ok(minLat < 51.9 && maxLat > 52.0, `latitude was not grown: ${bbox}`);
  // 2 km is about 0.018 degrees of latitude, and more of longitude at 52°N.
  assert.ok(Math.abs((51.9 - minLat) - 0.018) < 0.002, `latitude margin off: ${minLat}`);
  assert.ok((4.4 - minLon) > (51.9 - minLat), 'longitude degrees are shorter this far north');
});

check('a zero margin still produces a usable box', () => {
  assert.equal(osmiumBbox({ minLon: 4.4, minLat: 51.9, maxLon: 4.6, maxLat: 52.0 }, 0),
    '4.400000,51.900000,4.600000,52.000000');
});

process.stdout.write(`Municipality selection checks passed (${checks} checks).\n`);
