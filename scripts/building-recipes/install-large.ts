/**
 * `kind: large` recipes → `ordinary` building catalogue entries.
 *
 *   node --import tsx scripts/building-recipes/install-large.ts --house=<id>[,<id>...] [--install]
 *
 * Compiles each large house (large.ts, no renders), refuses any gate failure and any street-facing wall group whose
 * likeness to the photo is FAIL / NO EVIDENCE / NO PHOTO (likenessGate.ts; `--allow-inferred=<group>:<note>[;...]` with
 * one --house lets such a group through as inferred, with reviewState `large-recipe-likeness-inferred` and a
 * limitation per group; likeness needs MAP_RECALL_SOURCE_DATA and the archived crops), and builds one catalogue entry per
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
import {likenessGate, parseAllowInferred} from '../../src/canalRecall/buildingRecipe/likenessGate.ts';
import {meshHashOf} from './mesh-hash.ts';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {closeRenderer} from './render.ts';
import {loadBagTiles} from '../lib/bagTileIndex.ts';

const CATALOGUE = 'public/canal-drive/ordinary-buildings-data/catalogue.json', MODELS = 'public/canal-drive/models/ordinary-buildings', ARTIFACTS = 'artifacts/building-recipes';
/** Gallery/placement fields of a replaced hand-built entry that still describe the same building. */
const CARRY = ['cameraBearing', 'galleryFrontage', 'gallerySecondary', 'referenceImages', 'retainedNeighbors'] as const;

let bagIndex: ReturnType<typeof loadBagTiles> | null = null;
/** Hand-mapped OSM outlines the base tiles still draw under a pand (the pand's `osm` alias, a separate tier-4 feature):
 * hiding only the pand reveals them, so the entry lists them as `aliases` (the runtime suppresses buildingId + aliases) too (Rietveld Academie: w57860150, 1928 m2, 32.4 m). */
function linkedOsmOutlines(pand: string): string[] {
  bagIndex ??= loadBagTiles('public/data/extracts/amsterdam/bag-tiles/14');
  return (bagIndex.pands.get(`NL.IMBAG.Pand.${pand}`)?.osm ?? []).filter(id => bagIndex!.osmOnly.has(id));
}

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
async function bounds(bytes: Uint8Array) {
  const doc = await io.readBinary(bytes), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const p = prim.getAttribute('POSITION')!, v: number[] = [];
    for (let i = 0; i < p.getCount(); i++) { p.getElement(i, v); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } }
  }
  return {min: min.map(x => +x.toFixed(3)), max: max.map(x => +x.toFixed(3))};
}
/**
 * A re-install replaces an entry in place. When the old entry is itself a large-recipe install, every field this
 * script does not own (`bagYear`, `aliases`, ...) is kept; an entry owned here overwrites by key. A hand-built
 * entry being replaced only hands over the CARRY gallery fields (done by the caller), nothing else.
 */
export function mergeReplacedEntry<T extends Record<string, any>>(replaced: Record<string, any> | null, fresh: T): T & Record<string, any> {
  if (replaced?.source !== 'building-recipes-large') return fresh;
  return {...replaced, ...fresh};
}
const ll = (x: number, y: number) => { const p = rdToLngLat({x, y}); return [+p[0].toFixed(7), +p[1].toFixed(7)] as [number, number]; };

export async function largeCatalogueEntry(id: string, catalogue: {models: any[]}, now = new Date().toISOString(), allowInferred: Map<number, string> = new Map()) {
  const {report, built, intent, likeness} = await compileLargeHouse(id);
  const bad = report.gates.filter(g => !g.pass);
  if (bad.length) throw Error(`${id}: gates failed (${bad.map(g => g.id).join(', ')}); not installing`);
  // likeness gate (likenessGate.ts): street-facing groups must look like their photo, or be allowed as inferred with a note
  const gate = likenessGate(likeness && likeness.map(g => ({group: g.group, system: intent.walls[g.group].system, street: intent.walls[g.group].street,
    verdict: g.status === 'no-photo' ? 'NO PHOTO' as const : g.likeness!.verdict, reasons: g.likeness?.reasons})), allowInferred);
  if (!gate.ok) throw Error(`${id}: likeness gate refused (${gate.refused.join('; ')}); fix the intent, or --allow-inferred=<group>:<note> for a group the photo cannot judge`);
  const glb = await fs.readFile(path.join(ARTIFACTS, id, 'model.glb')), b = await bounds(glb);
  const pand = intent.pandId, entryId = `ordinary-${pand}`, replaced = catalogue.models.find(m => m.id === entryId) ?? null;
  const facts = built.facts, [ax, ay] = built.anchorRD;
  const carried = Object.fromEntries(CARRY.filter(k => replaced?.[k] !== undefined).map(k => [k, replaced[k]]));
  const groups = built.recipe.groups.filter(g => g.system !== 'blank' || g.entrance);
  const entry = {
    id: entryId, category: 'ordinary' as const, buildingId: `NL.IMBAG.Pand.${pand}`, name: replaced?.name ?? intent.address,
    hash: report.sha256, sha256: report.sha256, meshHash: meshHashOf(compileLargeBuilding(intent, built.facts, {budget: 1e9}).group), bytes: report.bytes, triangles: report.triangles, materials: report.materials, textures: 0, scale: 1, bounds: b,
    anchor: ll(ax, ay), footprint: {type: 'Polygon', coordinates: facts.bagFootprintRD.map(ring => ring.map(p => ll(p[0], p[1])))},
    nativeHeight: +facts.heights.roofMaxM.toFixed(2), height: +b.max[1].toFixed(2),
    modelUrl: `./models/ordinary-buildings/recipe-large-${id}.glb`, suppress: [`NL.IMBAG.Pand.${pand}`],
    ...(linkedOsmOutlines(pand).length ? {aliases: linkedOsmOutlines(pand)} : {}),
    ...carried,
    // Not 'building-recipes': that tag means a street-survey recipe house (buildingCategory.test.ts).
    source: 'building-recipes-large', recipe: {id, kind: 'large', intentSources: intent.sources.map(s => s.image ?? s.id), gates: report.gates.map(g => `${g.id}:${g.pass ? 'pass' : 'FAIL'}`),
      wallGroups: groups.map(g => `${g.system}${g.entrance ? '+entrance' : ''} ${g.storeys}st ${g.bays}b`)},
    scope: 'Large-tier recipe: 3DBAG LoD2.2 walls and roofs verbatim, a facade system and components per wall group read from municipal panoramas (CC BY 4.0); exact BAG host suppression.',
    limitations: [...gate.limitations, ...(intent.notes ?? []).filter(n => /not modelled|below the component|not evidenced|not used|blank/i.test(n))],
    reviewState: gate.reviewState, sourceUrls: [`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`, 'https://api.data.amsterdam.nl/panorama/'], updatedAt: now,
  };
  return {entry: mergeReplacedEntry(replaced, entry), replaced: replaced ? {id: replaced.id, modelUrl: replaced.modelUrl, triangles: replaced.triangles} : null, glbPath: path.join(ARTIFACTS, id, 'model.glb')};
}

if (process.argv[1]?.endsWith('install-large.ts')) {
  const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  const install = process.argv.includes('--install'), catalogue = JSON.parse(await fs.readFile(CATALOGUE, 'utf8'));
  const allow = parseAllowInferred(process.argv.find(a => a.startsWith('--allow-inferred='))?.slice(17));
  if (allow.size && ids.length !== 1) throw Error('--allow-inferred names groups of one house: use it with a single --house');
  try {
    for (const id of ids) {
      const {entry, replaced, glbPath} = await largeCatalogueEntry(id, catalogue, undefined, allow);
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
