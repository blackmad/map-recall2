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
