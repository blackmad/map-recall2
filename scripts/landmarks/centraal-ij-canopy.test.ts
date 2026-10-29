// IJ canopy cross-section and ribs (centraal-complex-builder.ts IJ_CANOPY), feedback bbbeaceb (2026-10-29, #99): the canopy was a
// symmetric opaque tube with a vertical north side at the OSM outline and nothing on the De Ruijterkade quay.
//   node --import tsx --test scripts/landmarks/centraal-ij-canopy.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {IJ_CANOPY, ijCanopyHeight, ijRibNorth, ijRibXs} from './centraal-complex-builder';
import survey from './centraal-complex-footprints.json';

// AHN4 DSM 0.5 m minus 0.9 m NAP ground, max over x -120..170 in the Centraal frame, glass dropouts ignored (PDOK WCS, CC0).
const AHN: [number, number][] = [[-118, 10.8], [-122, 15.2], [-126, 17.2], [-130, 18.6], [-134, 20.2], [-138, 21.0], [-144, 21.9],
  [-150, 21.8], [-154, 21.4], [-158, 20.3], [-162, 18.1], [-164, 16.7], [-166, 16.5], [-170, 13.9]];

test('canopy profile follows the AHN cross-section within 1 m', () => {
  for (const [z, h] of AHN) assert.ok(Math.abs(ijCanopyHeight(z) - h) < 1, `z ${z}: model ${ijCanopyHeight(z).toFixed(1)} m, AHN ${h} m`);
  assert.equal(ijCanopyHeight(IJ_CANOPY.crestZ), IJ_CANOPY.crest);
});

test('the glass reaches past the OSM outline; the ribs land on the quay', () => {
  const osmNorth = Math.min(...survey.parts.find(p => p.glass)!.localPolygons[0][0].map(p => p[1]));
  assert.ok(IJ_CANOPY.glassEdgeZ < osmNorth - 3, 'glass edge north of the OSM outline (AHN 12.5-13.9 m at z -170/-172)');
  assert.ok(ijCanopyHeight(IJ_CANOPY.glassEdgeZ) > 12 && ijCanopyHeight(IJ_CANOPY.glassEdgeZ) < 14.5, 'glass edge height');
  assert.ok(Math.abs(ijRibNorth(IJ_CANOPY.footZ)) < 1e-9, 'rib foot at ground level');
  assert.ok(ijRibNorth(IJ_CANOPY.footZ + 1) > 4, 'ribs rise steeply from the shoe');
});

test('29 ribs on the measured 12.56 m pitch, all over the canopy', () => {
  const xs = ijRibXs(), [x0, , x1] = survey.parts.find(p => p.glass)!.bounds;
  assert.equal(xs.length, 29);
  assert.ok(Math.abs(xs[14] - 0.9) < 1e-9 && Math.abs(xs[1] - xs[0] - 12.56) < 1e-9);
  assert.ok(xs[0] > x0 + 1 && xs[28] < x1 - 1, 'first and last rib inside the canopy ends');
});
