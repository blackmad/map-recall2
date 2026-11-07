// node --import tsx scripts/landmarks/.entry-tmp.ts <id> <overrides.json> -> prints a catalogue entry built from <id>-footprints.json
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';
const [id, file] = process.argv.slice(2);
const o = JSON.parse(fs.readFileSync(file, 'utf8'));
const f = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const [ax, ay] = f.anchorRD;
const ll = (p: number[]) => { const r = rdToLngLat(ax + p[0], ay - p[1]); return [+r[0].toFixed(8), +r[1].toFixed(8)]; };
const rings = f.rings.map((r: number[][]) => { const c = r.map(ll); return [...c, c[0]]; });
const xs = f.rings[0].map((p: number[]) => p[0]), zs = f.rings[0].map((p: number[]) => p[1]);
const entry = {
  id, name: o.name, modelUrl: `./models/${id}.glb`, suppressOsmIds: o.suppress, spatialSuppression: false,
  footprint: {centre: f.anchor, headingDegrees: 0, lengthMetres: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), widthMetres: +(Math.max(...zs) - Math.min(...zs)).toFixed(1)},
  surveyed: {anchor: f.anchor, northOffsetDegrees: 0, source: o.source},
  groundAltitudeMetres: 0, facingOffsetDegrees: 0, heightMetres: o.height, bagYear: o.year,
  materialOverrides: o.materials,
  attribution: {title: o.title, author: 'Map Recall', sourceUrl: o.sourceUrl, licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', modifications: o.modifications},
  buildingFootprint: {type: 'Polygon', coordinates: o.footprintRings ?? rings},
  ...(o.extra ?? {}),
};
console.log(JSON.stringify(entry));
