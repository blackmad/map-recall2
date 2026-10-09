/**
 * Install a built block-kit model: copy the meshopt GLB to public/canal-drive/models and add (or replace)
 * its entry in src/canalRecall/landmarks/manualCatalogue.json with `status: "held"`.
 *
 *   node --import tsx scripts/haparandaweg/install.ts --id=haparandaweg-902-950 [--unheld]
 *
 * The catalogue file is edited textually (appended before the closing bracket) so existing entries keep their formatting.
 * `--unheld` writes status-less entries and is for local screenshots only; never commit that.
 */
import fs from 'node:fs';
import { loadSpec } from './build.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ids = arg('id').split(',').filter(Boolean);
const unheld = process.argv.includes('--unheld');
const file = 'src/canalRecall/landmarks/manualCatalogue.json';
let text = fs.readFileSync(file, 'utf8');

for (const id of ids) {
  const { spec, set } = loadSpec(id);
  const out = `artifacts/haparandaweg/${id}`;
  fs.copyFileSync(`${out}/model.min.glb`, `public/canal-drive/models/${id}.glb`);
  const [lng0, lat0] = set.anchor, k = 111320 * Math.cos(lat0 * Math.PI / 180);
  const ll = (p: number[]) => [lng0 + p[0] / k, lat0 - p[2] / 111320];
  const rings = set.ground.flatMap(g => g.rings).map(r => { const c = r.map(ll); c.push(c[0]); return c; });
  const xs = set.ground.flatMap(g => g.rings[0]).map(p => p[0]), zs = set.ground.flatMap(g => g.rings[0]).map(p => p[2]);
  const report = JSON.parse(fs.readFileSync(`${out}/report.json`, 'utf8'));
  const entry: Record<string, unknown> = {
    id, ...(unheld ? {} : { status: 'held', heldReason: `Block-kit draft awaiting integrator review of artifacts/haparandaweg/${id}/contact.png (2026-10-09).` }),
    name: spec.name, modelUrl: `./models/${id}.glb`,
    suppressOsmIds: [`NL.IMBAG.Pand.${spec.pandId}`], spatialSuppression: false,
    footprint: { centre: [lng0, lat0], headingDegrees: 0, lengthMetres: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), widthMetres: +(Math.max(...zs) - Math.min(...zs)).toFixed(1) },
    groundAltitudeMetres: 0, facingOffsetDegrees: 0,
    surveyed: { anchor: [lng0, lat0], northOffsetDegrees: 0, source: `3DBAG LoD2.2 NL.IMBAG.Pand.${spec.pandId} (ground ${set.groundNap.toFixed(2)} m NAP)` },
    materialOverrides: spec.palette, preservePositionPrecision: true,
    attribution: {
      title: `${spec.name} original architecture`, author: 'Map Recall',
      sourceUrl: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${spec.pandId}`, licence: 'Original project asset', licenceUrl: './LICENSE',
      modifications: `Original texture-free native metre geometry: exact 3DBAG LoD2.2 walls and roofs with facade systems laid out from Gemeente Amsterdam panoramas (CC BY 4.0) by the block kit (src/canalRecall/blockBuilding). ${report.gates.triangles} triangles. Rear and party walls are unmeasured. No invented POI.`,
    },
    buildingFootprint: { type: 'Polygon', coordinates: rings }, heightMetres: +set.heightMax.toFixed(2),
  };
  const body = JSON.stringify(entry, null, 2).split('\n').map(l => '  ' + l).join('\n');
  // replace an existing entry of this id (made by this script, therefore ending at the next "\n  }" line)
  const marker = text.indexOf(`  {\n    "id": "${id}"`);
  if (marker >= 0) {
    const end = text.indexOf('\n  }', marker) + 4;
    text = text.slice(0, marker) + body + text.slice(end);
  } else {
    const close = text.lastIndexOf('\n]');
    text = text.slice(0, close) + ',\n' + body + text.slice(close);
  }
  console.log('installed', id, unheld ? '(UNHELD, local only)' : '(held)');
}
fs.writeFileSync(file, text);
JSON.parse(text);
