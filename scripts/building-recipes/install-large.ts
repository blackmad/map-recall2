/**
 * `kind: large` recipes → `ordinary` building catalogue entries.
 *
 *   node --import tsx scripts/building-recipes/install-large.ts --house=<id>[,<id>...] [--install]
 *
 * Compiles each large house (large.ts, no renders), refuses any gate failure, and builds one catalogue entry per
 * house: category `ordinary`, the GLB on its own origin north-up (local frame X east, Z south, Y up from the 3DBAG
 * ground; origin = `anchorRD`, the BAG footprint centroid), so the entry carries `anchor` and no `instance`.
 * Exact BAG host suppression. An existing catalogue entry for the same pand (`ordinary-<pand>`) is replaced; its
 * gallery framing (galleryFrontage/gallerySecondary/cameraBearing/referenceImages/retainedNeighbors) is carried over.
 *
 * Default: stages `artifacts/building-recipes/<id>/catalogue-entry.json` and leaves the catalogue and models alone
 * (the integrator applies them). `--install` also copies the GLB to public/canal-drive/models/ordinary-buildings/
 * recipe-large-<id>.glb and upserts the entry into ordinary-buildings-data/catalogue.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {compileLargeHouse} from './large.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {closeRenderer} from './render.ts';

const CATALOGUE = 'public/canal-drive/ordinary-buildings-data/catalogue.json', MODELS = 'public/canal-drive/models/ordinary-buildings', ARTIFACTS = 'artifacts/building-recipes';
/** Gallery/placement fields of a replaced hand-built entry that still describe the same building. */
const CARRY = ['cameraBearing', 'galleryFrontage', 'gallerySecondary', 'referenceImages', 'retainedNeighbors'] as const;

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
async function bounds(bytes: Uint8Array) {
  const doc = await io.readBinary(bytes), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const p = prim.getAttribute('POSITION')!, v: number[] = [];
    for (let i = 0; i < p.getCount(); i++) { p.getElement(i, v); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } }
  }
  return {min: min.map(x => +x.toFixed(3)), max: max.map(x => +x.toFixed(3))};
}
const ll = (x: number, y: number) => { const p = rdToLngLat({x, y}); return [+p[0].toFixed(7), +p[1].toFixed(7)] as [number, number]; };

export async function largeCatalogueEntry(id: string, catalogue: {models: any[]}, now = new Date().toISOString()) {
  const {report, built, intent} = await compileLargeHouse(id);
  const bad = report.gates.filter(g => !g.pass);
  if (bad.length) throw Error(`${id}: gates failed (${bad.map(g => g.id).join(', ')}); not installing`);
  const glb = await fs.readFile(path.join(ARTIFACTS, id, 'model.glb')), b = await bounds(glb);
  const pand = intent.pandId, entryId = `ordinary-${pand}`, replaced = catalogue.models.find(m => m.id === entryId) ?? null;
  const facts = built.facts, [ax, ay] = built.anchorRD;
  const carried = Object.fromEntries(CARRY.filter(k => replaced?.[k] !== undefined).map(k => [k, replaced[k]]));
  const groups = built.recipe.groups.filter(g => g.system !== 'blank' || g.entrance);
  const entry = {
    id: entryId, category: 'ordinary' as const, buildingId: `NL.IMBAG.Pand.${pand}`, name: replaced?.name ?? intent.address,
    hash: report.sha256, sha256: report.sha256, bytes: report.bytes, triangles: report.triangles, materials: report.materials, textures: 0, scale: 1, bounds: b,
    anchor: ll(ax, ay), footprint: {type: 'Polygon', coordinates: facts.bagFootprintRD.map(ring => ring.map(p => ll(p[0], p[1])))},
    nativeHeight: +facts.heights.roofMaxM.toFixed(2), height: +b.max[1].toFixed(2),
    modelUrl: `./models/ordinary-buildings/recipe-large-${id}.glb`, suppress: [`NL.IMBAG.Pand.${pand}`],
    ...carried,
    // Not 'building-recipes': that tag means a street-survey recipe house (buildingCategory.test.ts).
    source: 'building-recipes-large', recipe: {id, kind: 'large', intentSources: intent.sources.map(s => s.image ?? s.id), gates: report.gates.map(g => `${g.id}:${g.pass ? 'pass' : 'FAIL'}`),
      wallGroups: groups.map(g => `${g.system}${g.entrance ? '+entrance' : ''} ${g.storeys}st ${g.bays}b`)},
    scope: 'Large-tier recipe: 3DBAG LoD2.2 walls and roofs verbatim, a facade system and components per wall group read from municipal panoramas (CC BY 4.0); exact BAG host suppression.',
    limitations: ['Facade systems are rule-fitted to the 3DBAG eaves and the counted storeys/bays, not rectified from the photographs.', ...(intent.notes ?? []).filter(n => /not modelled|below the component|not evidenced|not used|blank/i.test(n))],
    reviewState: 'large-recipe-gates-pass', sourceUrls: [`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`, 'https://api.data.amsterdam.nl/panorama/'], updatedAt: now,
  };
  return {entry, replaced: replaced ? {id: replaced.id, modelUrl: replaced.modelUrl, triangles: replaced.triangles} : null, glbPath: path.join(ARTIFACTS, id, 'model.glb')};
}

if (process.argv[1]?.endsWith('install-large.ts')) {
  const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  const install = process.argv.includes('--install'), catalogue = JSON.parse(await fs.readFile(CATALOGUE, 'utf8'));
  try {
    for (const id of ids) {
      const {entry, replaced, glbPath} = await largeCatalogueEntry(id, catalogue);
      await fs.writeFile(path.join(ARTIFACTS, id, 'catalogue-entry.json'), JSON.stringify(entry, null, 2) + '\n');
      if (install) {
        await fs.mkdir(MODELS, {recursive: true});
        await fs.copyFile(glbPath, path.join(MODELS, `recipe-large-${id}.glb`));
        // replace in place (a re-install keeps the catalogue order, so its diff is the one entry), else append
        const at = catalogue.models.findIndex((m: any) => m.id === entry.id);
        if (at >= 0) catalogue.models[at] = entry; else catalogue.models.push(entry);
      }
      console.log(`${id}: ${entry.id} ${entry.triangles} tris, anchor ${entry.anchor.join(',')}, ${replaced ? `replaces ${replaced.id} (${replaced.modelUrl}, ${replaced.triangles} tris)` : 'new entry'} -> ${path.join(ARTIFACTS, id, 'catalogue-entry.json')}`);
    }
    if (install) await fs.writeFile(CATALOGUE, JSON.stringify(catalogue, null, 2) + '\n');
  } finally { await closeRenderer(); }
}
