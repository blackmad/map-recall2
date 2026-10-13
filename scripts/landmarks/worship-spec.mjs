// Usage: node scripts/landmarks/worship-spec.mjs <id> "<Name>" <landmarkId> <sourceUrl> '<materialOverrides json>'
import fs from 'node:fs';
const [id, name, landmarkId, sourceUrl, mats] = process.argv.slice(2);
const f = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const xs = f.nativeRing.map(p => p[0]), zs = f.nativeRing.map(p => p[1]);
const spec = {
  id, name, landmarkId, modelUrl: `./models/${id}.glb`,
  suppressOsmIds: [`NL.IMBAG.Pand.${f.bagId}`], spatialSuppression: false,
  footprint: {centre: f.anchor, headingDegrees: 0, lengthMetres: Math.ceil(Math.max(...xs) - Math.min(...xs)), widthMetres: Math.ceil(Math.max(...zs) - Math.min(...zs))},
  surveyed: {anchor: f.anchor, northOffsetDegrees: 0, source: `Current BAG ${f.bagId} footprint and 3DBAG LoD2.2 surfaces, native east/south metres from the anchor.`},
  groundAltitudeMetres: 0, facingOffsetDegrees: 0,
  materialOverrides: JSON.parse(mats),
  attribution: {title: name, author: 'Map Recall', sourceUrl, licence: 'Original project asset', licenceUrl: './LICENSE', modifications: 'Original texture-free flat-colour geometry from BAG/3DBAG massing; reference photographs guided architectural detail, no pixels or meshes imported.'},
};
fs.writeFileSync(`scripts/landmarks/${id}-spec.json`, JSON.stringify(spec, null, 2) + '\n');
