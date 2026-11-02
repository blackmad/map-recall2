/**
 * Prints the manualCatalogue.json geometry fields (footprint rectangle, anchor, buildingFootprint) for a Vijzelstraat-lane model
 * from its <id>-footprints.json, so the catalogue entry is derived, not typed.
 *   node --import tsx scripts/landmarks/vijzelstraat-catalogue-entry.ts <id> <long-axis bearing deg>
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';
const [id, bearingArg] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const br = Number(bearingArg) * Math.PI / 180, t = [Math.sin(br), -Math.cos(br)], n = [-t[1], t[0]];
const us = d.nativeRing.map((p: number[]) => p[0] * t[0] + p[1] * t[1]), vs = d.nativeRing.map((p: number[]) => p[0] * n[0] + p[1] * n[1]);
const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, cx = cu * t[0] + cv * n[0], cz = cu * t[1] + cv * n[1];
const ll = (x: number, z: number) => rdToLngLat(d.anchorRD[0] + x, d.anchorRD[1] - z).map(v => +v.toFixed(7));
const ring = d.nativeRing.map((p: number[]) => ll(p[0], p[1]));
console.log(JSON.stringify({
  footprint: {centre: ll(cx, cz), headingDegrees: Number(bearingArg), lengthMetres: +(u1 - u0).toFixed(2), widthMetres: +(v1 - v0).toFixed(2)},
  anchor: d.anchor,
  buildingFootprint: {type: 'Polygon', coordinates: [[...ring, ring[0]]]},
}));
