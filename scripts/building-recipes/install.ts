/**
 * Install compiled recipe houses into the ordinary-buildings catalogue.
 *
 *   node --import tsx scripts/building-recipes/install.ts --house=<id>,<id>... [--street="Bilderdijkstraat"] [--tolerance=0.5] [--dry]
 *
 * Runs compile + shared-mesh grouping for the given houses, copies each unique
 * mesh (frontage-frame GLB) to public/canal-drive/models/ordinary-buildings/,
 * and upserts one catalogue entry per house with `instance` {anchor,
 * northOffsetDegrees, mirror}. Entries are tagged `source: "building-recipes"`
 * and are replaced on re-run. Exact BAG-host suppression only (`suppress`/`buildingId`).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {compileHouse, shareMeshes, ARTIFACTS} from './compile.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const CATALOGUE = 'public/canal-drive/ordinary-buildings-data/catalogue.json', MODELS = 'public/canal-drive/models/ordinary-buildings';
const ids = (arg('house') ?? '').split(',').filter(Boolean);
if (!ids.length) throw Error('Use --house=<id>[,<id>...]');

const results = [];
for (const id of ids) results.push(await compileHouse(id));
const failed = results.filter(r => !r.report.passed);
if (failed.length) throw Error(`gates failed for ${failed.map(r => r.report.id).join(', ')}; not installing`);
const summary = await shareMeshes(results, {toleranceM: Number(arg('tolerance')) || undefined});

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
async function bounds(file: string) {
  const doc = await io.read(file), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const p = prim.getAttribute('POSITION')!, v: number[] = [];
    for (let i = 0; i < p.getCount(); i++) { p.getElement(i, v); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } }
  }
  return {min: min.map(x => +x.toFixed(3)), max: max.map(x => +x.toFixed(3))};
}

const now = new Date().toISOString(), street = arg('street') ?? 'Bilderdijkstraat';
const catalogue = JSON.parse(await fs.readFile(CATALOGUE, 'utf8'));
const meshInfo = new Map<string, {url: string; hash: string; bytes: number; triangles: number; bounds: Awaited<ReturnType<typeof bounds>>}>();
if (!process.argv.includes('--dry')) await fs.mkdir(MODELS, {recursive: true});
for (const m of summary.meshes) {
  const name = `recipe-${m.id}.glb`, src = path.join(ARTIFACTS, 'shared', m.file);
  if (!process.argv.includes('--dry')) await fs.copyFile(src, path.join(MODELS, name));
  meshInfo.set(m.file, {url: `./models/ordinary-buildings/${name}`, hash: m.sha256, bytes: m.bytes, triangles: m.triangles, bounds: await bounds(src)});
}
const byId = new Map(results.map(r => [r.report.id, r]));
const entries = summary.instances.map(inst => {
  const r = byId.get(inst.id)!, mesh = meshInfo.get(inst.mesh)!, intent = r.intent;
  const ring = r.facts.bagFootprintRD.map(ring => ring.map(p => { const ll = rdToLngLat({x: p[0], y: p[1]}); return [+ll[0].toFixed(7), +ll[1].toFixed(7)]; }));
  const height = Math.max(r.facts.heights.roofMaxM, ...r.report.fit.fronts.map(f => f.crownTopM));
  return {
    id: `ordinary-${inst.pandId}`, buildingId: `NL.IMBAG.Pand.${inst.pandId}`, name: intent.address, hash: mesh.hash, sha256: mesh.hash,
    bytes: mesh.bytes, triangles: mesh.triangles, materials: r.report.materials, textures: 0, scale: 1, bounds: mesh.bounds,
    anchor: inst.anchor, footprint: {type: 'Polygon', coordinates: ring}, nativeHeight: +r.facts.heights.roofMaxM.toFixed(2), height: +height.toFixed(2),
    modelUrl: mesh.url, suppress: [`NL.IMBAG.Pand.${inst.pandId}`],
    instance: {anchor: inst.anchor, northOffsetDegrees: inst.northOffsetDegrees, mirror: inst.mirror},
    source: 'building-recipes', recipe: {id: inst.id, mesh: inst.masterId, shared: inst.shared, intentSources: intent.sources.map(s => s.image ?? s.id), footprintIoU: inst.footprintIoU, frontZoneIoU: inst.frontZoneIoU, maxDimDeltaM: inst.maxDimDeltaM, gates: r.report.gates.map(g => `${g.id}:${g.pass ? 'pass' : 'FAIL'}`)},
    scope: `Recipe-pipeline house on ${street}: facade classified from the rectified municipal panorama crop, metres fitted from 3DBAG LoD2.2; exact BAG host suppression.`,
    limitations: ['Facade proportions are rule-fitted, not rectified from the photograph.', 'Roof is the 3DBAG LoD2.2 surface verbatim; dormers are declared, not measured.', ...(inst.shared ? [`Shares a mesh with ${inst.masterId}${inst.mirror ? ' (mirrored)' : ''}; footprint IoU ${inst.footprintIoU}, front-zone IoU ${inst.frontZoneIoU}.`] : [])],
    reviewState: 'recipe-draft-gates-pass', sourceUrls: ['https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.' + inst.pandId, 'https://data.amsterdam.nl/'], updatedAt: now,
  };
});
catalogue.models = [...catalogue.models.filter((m: any) => m.source !== 'building-recipes' || !entries.some(e => e.id === m.id)), ...entries];
if (!process.argv.includes('--dry')) await fs.writeFile(CATALOGUE, JSON.stringify(catalogue, null, 2) + '\n');
console.log(JSON.stringify({installed: entries.length, uniqueMeshes: summary.uniqueMeshes, sharedGroups: summary.sharedGroups, rejected: summary.rejected, bytes: [...meshInfo.values()].reduce((s, m) => s + m.bytes, 0)}));
