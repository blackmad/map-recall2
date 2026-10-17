/**
 * Builds public/data/extracts/amsterdam/explorer-index.json, the compact list
 * of every modelled building the neighbourhood explorer (canal-drive/explore.html)
 * pins, lists and opens.
 *
 * Sources: the placed-model specs the game draws (curated landmarks, manual
 * ordinary buildings, the ordinary-buildings catalogue), the block-face chunks
 * (ordinary-buildings-data/chunks.json), covers.json for landmark pands,
 * landmarks.json for Wikipedia links, boundaries.json for the neighbourhood.
 * The per-house street-survey models a drawn chunk replaces are left out, as in
 * the game, so no frontage is pinned twice.
 *
 *   npx tsx scripts/explorer/build-index.ts [--out <path>] [--check]
 *
 * --check exits 1 if the published index differs from a fresh build (ignoring generatedAt).
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PLACED_MODELS } from '../../src/canalRecall/landmarks/placedModels';
import { DEFAULT_HELD_CHUNKS } from '../../src/canalRecall/landmarks/ordinaryChunks';
import type { ChunkManifest } from '../../src/canalRecall/streetChunks/manifest';
import { blockName, buurtBboxes, buurtList, modelRow, prepareBoundaries, type Boundary, type RowInput } from '../../src/canalRecall/explorer/indexBuilder';
import type { ExplorerIndex, ExplorerKind } from '../../src/canalRecall/explorer/types';

const root = path.resolve(import.meta.dirname, '../..');
const canal = path.join(root, 'public/canal-drive');
const extract = path.join(root, 'public/data/extracts/amsterdam');
const args = process.argv.slice(2);
const out = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(extract, 'explorer-index.json');
const json = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

const boundaries = prepareBoundaries(json<Boundary[]>(path.join(extract, 'boundaries.json')).filter(b => b.kind !== 'municipality'));
const covers = json<{ models: Record<string, { p: string[] }> }>(path.join(canal, 'models/covers.json')).models;
const landmarks = new Map(json<{ id: string; wikipediaUrl?: string; wikipedia?: string }[]>(path.join(extract, 'landmarks.json')).map(l => [l.id, l]));
const catalogue = new Map(json<{ models: { id: string; triangles?: number; bytes?: number }[] }>(path.join(canal, 'ordinary-buildings-data/catalogue.json')).models.map(m => [m.id, m]));
const chunks = json<ChunkManifest>(path.join(canal, 'ordinary-buildings-data/chunks.json')).chunks.filter(c => !DEFAULT_HELD_CHUNKS.has(c.id));
const replacedByChunk = new Set(chunks.flatMap(c => c.replaces));

const fileOf = (modelUrl: string) => path.join(canal, modelUrl.replace(/\?.*$/, ''));
const wikiUrl = (landmarkId: string): string | undefined => {
  const l = landmarks.get(landmarkId);
  if (l?.wikipediaUrl) return l.wikipediaUrl;
  const m = l?.wikipedia && /^([a-z]{2,3}):(.+)$/.exec(l.wikipedia);
  return m ? `https://${m[1]}.wikipedia.org/wiki/${encodeURIComponent(m[2].replace(/ /g, '_'))}` : undefined;
};

const inputs: RowInput[] = [];
const missing: string[] = [];
const seen = new Set<string>();
for (const spec of PLACED_MODELS) {
  if (seen.has(spec.id) || replacedByChunk.has(spec.id)) continue;
  seen.add(spec.id);
  const file = fileOf(spec.modelUrl);
  if (!existsSync(file)) { missing.push(spec.id); continue; }
  const category = spec.buildingCategory ?? 'landmark';
  const kind: ExplorerKind = category === 'landmark' ? 'landmark' : category === 'ordinary' ? 'ordinary' : 'house';
  const anchor = spec.surveyed?.anchor ?? spec.footprint?.centre;
  if (!anchor) { missing.push(`${spec.id} (no anchor)`); continue; }
  const cat = catalogue.get(spec.id);
  // covers.json is the measured pand list for landmarks; suppressOsmIds carries BAG ids for ordinary models (and some landmarks).
  const pands = [...(covers[spec.id]?.p ?? []), ...spec.suppressOsmIds];
  const licence = spec.attribution?.licence ?? '';
  inputs.push({
    id: spec.id, kind, name: spec.name, lngLat: anchor as unknown as number[], modelUrl: spec.modelUrl,
    bytes: statSync(file).size, lodExists: existsSync(file.replace(/\.glb$/, '.lod1.glb')),
    triangles: cat?.triangles, pandIds: pands,
    wiki: kind === 'landmark' ? [spec.landmarkId, ...(spec.relatedLandmarkIds ?? [])].map(wikiUrl).find(Boolean) : undefined,
    restricted: /3D Warehouse/i.test(licence) && spec.attribution
      ? { licence, source: spec.attribution.sourceUrl, author: spec.attribution.author }
      : undefined,
  });
}
for (const c of chunks) {
  const file = fileOf(c.modelUrl);
  if (!existsSync(file)) { missing.push(c.id); continue; }
  inputs.push({
    id: c.id, kind: 'block', name: blockName(c.pands.map(p => p.address), c.name), lngLat: c.instance.anchor, modelUrl: c.modelUrl,
    bytes: statSync(file).size, lodExists: false, triangles: c.triangles, pandIds: c.pands.map(p => p.pandId),
  });
}

const models = inputs.map(input => modelRow(input, boundaries)).sort((a, b) => a.id.localeCompare(b.id));
const index: ExplorerIndex = { version: 1, generatedAt: new Date().toISOString(), buurten: buurtList(models, buurtBboxes(boundaries)), models };
const text = `${JSON.stringify(index)}\n`;

const byKind = Object.entries(models.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.kind]: (acc[m.kind] ?? 0) + 1 }), {}));
const elsewhere = models.filter(m => m.buurt === 'Elsewhere in Amsterdam').length;
console.log(`${models.length} models (${byKind.map(([k, n]) => `${n} ${k}`).join(', ')}) in ${index.buurten.length} buurten; ${elsewhere} outside every neighbourhood; ${models.filter(m => m.restricted).length} not redistributable.`);
if (missing.length) console.log(`Skipped ${missing.length} without a GLB on disk: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}`);

if (args.includes('--check')) {
  const strip = (s: string) => s.replace(/"generatedAt":"[^"]*"/, '');
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (strip(current) !== strip(text)) { console.error(`${path.relative(root, out)} is stale: run npx tsx scripts/explorer/build-index.ts`); process.exit(1); }
  console.log(`${path.relative(root, out)} is current.`);
} else {
  writeFileSync(out, text);
  console.log(`Wrote ${path.relative(root, out)}: ${(text.length / 1024).toFixed(1)} KB.`);
}
