/**
 * Print the manual-catalogue geometry (anchor = BAG footprint vertex average, the large-tier origin; footprint extent;
 * BAG footprint polygon in lng/lat) for a Mercatorplein tower landmark.
 *
 *   node --import tsx scripts/mercatorplein/catalogue-entry.ts --house=mercatorplein-noordtoren
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const house = process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '';
const facts = JSON.parse(fs.readFileSync(`scripts/landmarks/${house}-facts.json`, 'utf8'));
const ring: number[][] = facts.bagFootprintRD[0];
const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
const r7 = (v: number) => +v.toFixed(7);
const centre = rdToLngLat(cx, cy).map(r7);
const xs = ring.map(p => p[0] - cx), ys = ring.map(p => p[1] - cy);
console.log(JSON.stringify({
  centre, lengthMetres: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), widthMetres: +(Math.max(...ys) - Math.min(...ys)).toFixed(1),
  buildingFootprint: {type: 'Polygon', coordinates: [ring.map(p => rdToLngLat(p[0], p[1]).map(r7))]},
  heightMetres: +(facts.heights?.maxNAP - facts.heights?.groundNAP).toFixed(1),
}));
