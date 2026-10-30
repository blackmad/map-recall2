/**
 * The default runtime's building path, run in Node from the extract directory: what the compiler bakes
 * and what the tests compare against. Every step is the runtime's own function, in the runtime's order:
 *   BuildingTileStreamer.fetchTile: clone, dropNestedDuplicates, tile enricher (years + roof facts)
 *   BuildingTileStreamer.styled:    decorateBuildingFeature + vector-map's feature decorator
 *                                   (galleryPipeline.gameDecorator repeats _applyFeatureDecorator).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { dropNestedDuplicates } from '../../src/canalRecall/buildingNesting.js';
import { constructionYearEnricher, roofFactsEnricher, composeEnrichers, roofFactsEnabled } from '../../src/canalRecall/genericFacades.js';
import { gameDecorator, gameFeatureDecorator } from '../../src/canalRecall/galleryPipeline.js';
import { setShopfronts } from '../../src/canalRecall/shopfronts.js';
import { buildingCell } from '../../src/canalRecall/world/cellGrid.js';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
export const COVERS = path.join(ROOT, 'public/canal-drive/models/covers.json');
export type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: any };
export type Row = { tile: string; ordinal: number; raw: Feature; styled: Feature; cell: string };

export const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const tileFile = (t: string) => path.join(EXTRACT, `building-tiles/14/${t}.geojson.gz`);
export const tileInputs = (t: string) => [tileFile(t), path.join(EXTRACT, `building-facts/14/${t}.json.gz`), path.join(EXTRACT, `roof-facts/14/${t}.json.gz`)];

/** fetch over the extract directory, for the runtime enrichers (they take a fetch). */
const FILE_BASE = 'file:/extract';
const fileFetch = (async (input: string | URL | Request) => {
  const url = String(input);
  const file = url.startsWith(FILE_BASE) ? path.join(EXTRACT, url.slice(FILE_BASE.length)) : null;
  if (!file || !fs.existsSync(file)) return new Response(null, { status: 404 });
  return new Response(fs.readFileSync(file));
}) as typeof fetch;

/** The decorator inputs vector-map loads (monument gables, landmark ids, shopfronts) and the chain. */
export function gameChain() {
  const gablesJson = readJson(path.join(EXTRACT, 'monument-gables.json'));
  const gables = new Map(Object.entries(gablesJson.buildings ?? {})) as any;
  const listed = new Set<string>(gablesJson.listedLandmarks ?? []);
  const landmarkIds = new Set<string>();
  for (const list of Object.values<string[]>(readJson(path.join(EXTRACT, 'landmark-buildings.json')).buildings ?? {})) for (const id of list) landmarkIds.add(String(id));
  setShopfronts(readJson(path.join(EXTRACT, 'shopfronts.json')));
  const decorate = gameDecorator({ gables, landmarkIds, listed }) as (f: Feature) => Feature;
  /** What vector-map installs with setFeatureDecorator (the streamer applies decorateBuildingFeature itself). */
  const featureDecorator = gameFeatureDecorator({ gables, landmarkIds, listed }) as (f: Feature) => Feature;
  const years = constructionYearEnricher(FILE_BASE, fileFetch);
  const enricher = roofFactsEnabled('') ? composeEnrichers(years, roofFactsEnricher(FILE_BASE, fileFetch)) : years;
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
