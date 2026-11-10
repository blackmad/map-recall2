/**
 * The default runtime's building path, run in Node from the extract directory: what the compiler bakes
 * and what the tests compare against. Every step is the runtime's own function, in the runtime's order:
 *   BuildingTileStreamer.fetchTile: clone, dropNestedDuplicates, tile enricher (gameTileEnricher: years + roof facts
 *                                   + the rail infrastructure table)
 *   BuildingTileStreamer.styled:    decorateBuildingFeature + vector-map's feature decorator
 *                                   (galleryPipeline.gameDecorator repeats _applyFeatureDecorator).
 */
// The compiler bakes what the browser computes: Chrome's Math.cos/sin are correctly rounded, Node's are not
// (one-ulp roofEavesHeightM differences, 2026-10-30 A/B). Every user of this pipeline (compile, verify, the
// world-format tests) runs with the browser's functions; this import comes first. See browserMath.ts.
import './useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { dropNestedDuplicates } from '../../src/canalRecall/buildingNesting.js';
import { constructionYearEnricher, roofFactsEnricher, composeEnrichers, roofFactsEnabled } from '../../src/canalRecall/genericFacades.js';
import { gameDecorator, gameFeatureDecorator } from '../../src/canalRecall/galleryPipeline.js';
import { setShopfronts } from '../../src/canalRecall/shopfronts.js';
import { registerFactsEnabled, registerFactsFromExtract, type RegisterFactsMap } from '../../src/canalRecall/facade/registerRecipe.js';
import { gameTileEnricher } from '../../src/canalRecall/gameTileEnricher.js';
import { HOUSE_SPECS_DIR, houseSpecsEnabled } from '../../src/canalRecall/houseSpec/decorate.js';
import { houseSpecsStamp, type HouseSpecsStamp } from '../../src/canalRecall/houseSpec/extractStamp.js';
import { buildingCell } from '../../src/canalRecall/world/cellGrid.js';
import { coversHides, resolveTileIds, tileCoversHash, type TileIdsCache } from '../../src/canalRecall/world/tileCovers.js';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
// COVERS_FILE: a covers.json other than the published one (house:publish rehearsals and the covers-slice measurements
// compile against a scratch copy; nothing under public/ changes).
export const COVERS = process.env.COVERS_FILE ? path.resolve(process.env.COVERS_FILE) : path.join(ROOT, 'public/canal-drive/models/covers.json');
// monument-facts.json: the register facts gameChain reads (facade/registerRecipe.ts); it was missing until 2026-11-10
// (house line H1 step 1), so a register-facts change did not invalidate any cell under --changed.
// covers.json is NOT here (house line H3): it reaches the world only through each cell's hide list, so each tile hashes
// its own slice of it (tileCoversHashes below) and an install rebuilds the cells of the tiles it covers, not the city.
export const GLOBAL_INPUTS = ['monument-gables.json', 'monument-facts.json', 'landmark-buildings.json', 'shopfronts.json', 'rail-infra-buildings.json', 'industrial-buildings.json'].map(f => path.join(EXTRACT, f));
export type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: any };
export type Row = { tile: string; ordinal: number; raw: Feature; styled: Feature; cell: string };

/** Hash of files' paths and contents (absent files hash as 'absent'): the compiler's change detector. */
export function inputHash(files: string[]): string {
  const h = crypto.createHash('sha256');
  // A staged HouseSpec extract (amsterdam/staging/house-specs, house:publish --dry-run --compile) hashes under the name it
  // will have once published, so compiling against it rebuilds only the tiles whose spec file differs.
  for (const f of files) { h.update(path.relative(ROOT, f).replace('amsterdam/staging/house-specs/', 'amsterdam/house-specs/')); h.update(fs.existsSync(f) ? fs.readFileSync(f) : Buffer.from('absent')); }
  return h.digest('hex');
}
/** Source files whose code decides the baked output: a change to any of them invalidates every cell. */
export const CODE = ['src/canalRecall/buildingNesting.ts', 'src/canalRecall/genericFacades.ts', 'src/canalRecall/galleryPipeline.ts', 'src/canalRecall/buildingTilesBrowser.ts',
  'src/canalRecall/roofMesh.ts', 'src/canalRecall/landmarkKits.ts', 'src/canalRecall/landmarkFrontData.ts', 'src/canalRecall/shopfronts.ts', 'src/canalRecall/monumentGables.ts', 'src/canalRecall/gameTileEnricher.ts', 'src/canalRecall/railInfraBuildings.ts', 'src/canalRecall/industrial/industrialTable.ts', 'src/canalRecall/industrial/industrialClass.ts',
  'src/canalRecall/roofs/roofFacts.ts', 'src/canalRecall/facade/registerRecipe.ts', 'src/canalRecall/facade/registerFacts.ts', 'src/canalRecall/houseSpec/decorate.ts', 'src/canalRecall/facade/evidence.ts', 'src/canalRecall/buildingContextIndex.ts', 'src/canalRecall/world/cellFormat.ts', 'src/canalRecall/world/cellGrid.ts', 'src/canalRecall/world/cellPolicy.ts', 'scripts/world/compile.ts', 'scripts/world/pipeline.ts', 'scripts/world/browserMath.ts', 'scripts/world/useBrowserMath.ts'].map(f => path.join(ROOT, f));

export const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const tileFile = (t: string) => path.join(EXTRACT, `building-tiles/14/${t}.geojson.gz`);
/** The HouseSpec extract directory the chain reads (HOUSE_SPECS_DIR, default the published `house-specs`). */
export const houseSpecsDir = () => process.env.HOUSE_SPECS_DIR || HOUSE_SPECS_DIR;
/** The index.json HouseSpec stamp (houseSpec/extractStamp.ts): on/off plus the extract directory's content hash. */
export function houseSpecsIndexStamp(): HouseSpecsStamp {
  const dir = houseSpecsDir(), abs = path.join(EXTRACT, dir), enabled = houseSpecsEnabled(null, process.env.HOUSE_SPECS);
  const files: [string, Uint8Array][] = [];
  const walk = (d: string) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push([path.relative(abs, f), fs.readFileSync(f)]); } };
  if (enabled) walk(path.join(abs, '14'));
  return houseSpecsStamp(enabled, dir, files);
}
/** A tile's own inputs: a change to any of them recompiles only the cells that list the tile. HouseSpecs are per tile
 *  (house line H1), so a spec edit rebuilds the cells of its tile, not the city. */
export const tileInputs = (t: string) => [tileFile(t), path.join(EXTRACT, `building-facts/14/${t}.json.gz`), path.join(EXTRACT, `roof-facts/14/${t}.json.gz`),
  ...(houseSpecsEnabled(null, process.env.HOUSE_SPECS) ? [path.join(EXTRACT, `${houseSpecsDir()}/14/${t}.json.gz`)] : [])];

/** fetch over the extract directory, for the runtime enrichers (they take a fetch). */
const FILE_BASE = 'file:/extract';
const fileFetch = (async (input: string | URL | Request) => {
  const url = String(input);
  const file = url.startsWith(FILE_BASE) ? path.join(EXTRACT, url.slice(FILE_BASE.length)) : null;
  if (!file || !fs.existsSync(file)) return new Response(null, { status: 404 });
  return new Response(fs.readFileSync(file));
}) as typeof fetch;

/** The decorator inputs vector-map loads (monument gables, landmark ids, shopfronts) and the chain. */
/** The published register facts (monument-facts.json, no sourceText) when the flag is on and the file exists; REGISTER_FACTS=0 turns it off. */
function publishedRegisterFacts(): RegisterFactsMap | undefined {
  const file = path.join(EXTRACT, 'monument-facts.json');
  return registerFactsEnabled(null, process.env.REGISTER_FACTS) && fs.existsSync(file) ? registerFactsFromExtract(readJson(file)) : undefined;
}
export function gameChain(options: { registerFacts?: RegisterFactsMap | null } = {}) {
  const registerFacts = options.registerFacts === null ? undefined : options.registerFacts ?? publishedRegisterFacts();
  const gablesJson = readJson(path.join(EXTRACT, 'monument-gables.json'));
  const gables = new Map(Object.entries(gablesJson.buildings ?? {})) as any;
  const listed = new Set<string>(gablesJson.listedLandmarks ?? []);
  const landmarkIds = new Set<string>();
  for (const list of Object.values<string[]>(readJson(path.join(EXTRACT, 'landmark-buildings.json')).buildings ?? {})) for (const id of list) landmarkIds.add(String(id));
  setShopfronts(readJson(path.join(EXTRACT, 'shopfronts.json')));
  const decorate = gameDecorator({ gables, landmarkIds, listed, registerFacts }) as (f: Feature) => Feature;
  /** What vector-map installs with setFeatureDecorator (the streamer applies decorateBuildingFeature itself). */
  const featureDecorator = gameFeatureDecorator({ gables, landmarkIds, listed, registerFacts }) as (f: Feature) => Feature;
  // Years, roof facts and the rail infrastructure table: the own engine's live path calls the same function
  // (gameTileEnricher.ts), and the runtime adopts cells without enriching, so the rail table must be baked here.
  // HouseSpecs (houseSpec/decorate.ts): HOUSE_SPECS=0 turns them off; HOUSE_SPECS_DIR reads another extract directory
  // (the lane's verification compiles against staging/house-specs before the integrator publishes).
  const enricher = gameTileEnricher({ constructionYearEnricher, roofFactsEnricher, composeEnrichers, roofFactsEnabled }, FILE_BASE,
    { fetch: fileFetch, search: '', houseSpecs: houseSpecsEnabled(null, process.env.HOUSE_SPECS), houseSpecsDir: houseSpecsDir() });
  return { decorate, featureDecorator, enricher, fileFetch, fileBase: FILE_BASE };
}

export type Chain = ReturnType<typeof gameChain>;
export type TileStats = { sourceFeatures: number; droppedNested: number; noCell: number; geometryChangedByDecorator: number };

/** One z14 tile through the default path: the adopted (enriched) features and their styled copies. */
export async function loadTile(tile: string, chain: Chain, stats?: TileStats): Promise<Row[]> {
  if (!fs.existsSync(tileFile(tile))) return [];
  const collection = JSON.parse(zlib.gunzipSync(fs.readFileSync(tileFile(tile))).toString('utf8'));
  const copies: Feature[] = (collection.features ?? []).map((f: Feature) => ({ type: 'Feature', properties: { ...(f.properties || {}) }, geometry: f.geometry && JSON.parse(JSON.stringify(f.geometry)) }));
  const features = dropNestedDuplicates(copies as any) as Feature[];
  if (stats) { stats.sourceFeatures += copies.length; stats.droppedNested += copies.length - features.length; }
  const [x, y] = tile.split('/').map(Number);
  const apply = await chain.enricher({ z: 14, x, y }, undefined as any);
  if (apply) apply(features as any);
  const rows: Row[] = [];
  features.forEach((raw, ordinal) => {
    const cell = raw.geometry ? buildingCell(raw.geometry) : null;
    if (!cell) { if (stats) stats.noCell++; return; }
    const before = JSON.stringify(raw.properties);
    const styled = chain.decorate(raw);
    if (JSON.stringify(raw.properties) !== before) throw Error(`${raw.properties.id}: a decorator mutated the source properties`);
    if (styled.geometry !== raw.geometry && stats) stats.geometryChangedByDecorator++;
    rows.push({ tile, ordinal, raw, styled, cell });
  });
  return rows;
}

/** The building ids of a z14 tile file (the ids a cell's hide list is matched against). */
export function tileFeatureIds(tile: string): string[] {
  if (!fs.existsSync(tileFile(tile))) return [];
  const collection = JSON.parse(zlib.gunzipSync(fs.readFileSync(tileFile(tile))).toString('utf8'));
  return (collection.features ?? []).map((f: Feature) => String(f.properties?.id));
}
/** The ids cache sits beside the compile output directory (`<out>.tile-ids.json`), not in it: the integrator publishes the directory. */
export const tileIdsCacheFile = (out: string) => `${out.replace(/\/$/, '')}.tile-ids.json`;
/** Each tile's covers slice hash (house line H3): the part of covers.json that hides a building of the tile.
 *  `cacheFile` (tileIdsCacheFile) holds the ids per tile keyed by the tile file's sha256, reused while a tile file is unchanged;
 *  a missing or stale cache is rebuilt by parsing the tiles that need it (the first run, about the cost of a full load). */
export function tileCoversHashes(tiles: string[], cacheFile: string | null, coversFile = COVERS): { hashes: Map<string, string>; ids: Map<string, string[]>; cache: TileIdsCache; parsed: number } {
  const hides = coversHides(fs.existsSync(coversFile) ? readJson(coversFile) : {});
  const cachePath = cacheFile;
  const cache: TileIdsCache | null = cachePath && fs.existsSync(cachePath) ? readJson(cachePath) : null;
  const shaOf = (t: string) => crypto.createHash('sha256').update(fs.existsSync(tileFile(t)) ? fs.readFileSync(tileFile(t)) : Buffer.from('absent')).digest('hex');
  const { ids, cache: next, parsed } = resolveTileIds(tiles, shaOf, cache, tileFeatureIds);
  return { hashes: new Map(tiles.map(t => [t, tileCoversHash(ids.get(t) ?? [], hides)])), ids, cache: next, parsed };
}
