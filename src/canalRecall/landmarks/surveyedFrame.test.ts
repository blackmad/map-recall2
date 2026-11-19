import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalogue from './manualCatalogue.json';
import namenmonument from '../../../scripts/landmarks/holocaust-namenmonument-footprints.json';

type Surveyed = { anchor: [number, number]; northOffsetDegrees: number };
const surveyedOf = (id: string): Surveyed => {
  const entry = (catalogue as { id?: string; surveyed?: Surveyed }[]).find(e => e.id === id);
  assert.ok(entry?.surveyed, `${id} has no surveyed placement`);
  return entry.surveyed;
};

/** Native glTF +X/+Z (metres) to lon/lat, turned clockwise by northOffsetDegrees as surveyedPlacement does. */
const place = ([x, z]: number[], { anchor, northOffsetDegrees }: Surveyed): [number, number] => {
  const n = (northOffsetDegrees * Math.PI) / 180, c = Math.cos(n), s = Math.sin(n);
  const east = c * x - s * z, south = s * x + c * z;
  return [anchor[0] + east / (111_320 * Math.cos((anchor[1] * Math.PI) / 180)), anchor[1] - south / 111_320];
};

// 2026-10-30: the Namenmonument (native x east / z south) carried northOffsetDegrees -90,
// which laid its 89 m north-south plaza east-west across Weesperstraat.
test('Namenmonument native site outline lands on its surveyed lon/lat', () => {
  const surveyed = surveyedOf('holocaust-namenmonument');
  const metresPerDegLon = 111_320 * Math.cos((surveyed.anchor[1] * Math.PI) / 180);
  namenmonument.site.forEach((point, i) => {
    const [lon, lat] = place(point, surveyed), [wantLon, wantLat] = namenmonument.siteLonLat[i];
    const error = Math.hypot((lon - wantLon) * metresPerDegLon, (lat - wantLat) * 111_320);
    assert.ok(error < 1, `site[${i}] is ${error.toFixed(1)} m from its surveyed point`);
  });
});

// Feedback 704240 (2026-11-13/19): the rider could not tap a building on the Tweede Kostverlorenkade while the
// El Tawheed card was up, and asked whether that building was the mosque. It is not. El Tawheed is BAG pand
// 0363100012137097 (1914, bijeenkomstfunctie, Jan Hanzenstraat 114), OSM way w276303116 (amenity=place_of_worship,
// religion=muslim), centroid 4.863928, 52.367777. The canal-side block the rider tapped is pand 0363100012075898
// (2006, Tweede Kostverlorenkade 63-70 / Bellamystraat 370-384), ~180 m south-west. Keep the card on the mosque.
test('El Tawheed stays on its own pand, not the Tweede Kostverlorenkade block (feedback 704240)', () => {
  const entry = (catalogue as { id?: string; suppressOsmIds?: string[]; footprint?: { centre: number[] } }[])
    .find(e => e.id === 'el-tawheed');
  assert.ok(entry, 'el-tawheed is in the catalogue');
  assert.ok(entry.suppressOsmIds?.includes('NL.IMBAG.Pand.0363100012137097'), 'replaces the mosque pand');
  assert.ok(entry.suppressOsmIds?.includes('w276303116'), 'replaces the OSM mosque way');
  assert.ok(!entry.suppressOsmIds?.includes('NL.IMBAG.Pand.0363100012075898'), 'leaves the Tweede Kostverlorenkade block alone');
  const [lon, lat] = entry.footprint!.centre, metresPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180);
  const fromMosque = Math.hypot((lon - 4.863928) * metresPerDegLon, (lat - 52.367777) * 111_320);
  const fromBlock = Math.hypot((lon - 4.862354) * metresPerDegLon, (lat - 52.366445) * 111_320);
  assert.ok(fromMosque < 15, `footprint centre is ${fromMosque.toFixed(1)} m from the mosque pand`);
  assert.ok(fromBlock > 150, `footprint centre is ${fromBlock.toFixed(1)} m from the canal-side block`);
});
