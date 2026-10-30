/**
 * World compiler v1: bake the city's buildings into `world-v1` cells (src/canalRecall/world/cellFormat.ts).
 *
 *   npm run world:compile                 # every cell -> artifacts/world/staging/
 *   npm run world:compile -- --changed    # only cells whose inputs changed since the last staging run
 *   npm run world:compile -- --tiles=8414/5384,8415/5384   # a subset (tests, quick looks)
 *
 * It reads what the default runtime path reads (building-tiles z14, building-facts years, roof-facts,
 * monument gables, landmark ids, shopfronts, covers.json, the kit tables) and runs the runtime's own
 * functions in the runtime's order: clone + dropNestedDuplicates (buildingTilesBrowser fetchTile), the
 * composed tile enricher (vector-map _ensureCompleteCity), decorateBuildingFeature + the decorator
 * chain (galleryPipeline.gameDecorator = vector-map _applyFeatureDecorator), roofPlanForFeature
 * (roofMesh), and BuildingContextIndex for party-wall neighbours. Nothing is reimplemented.
 * Output goes to staging only; publishing into public/data/extracts/amsterdam/world-v1/ is the
 * integrator's step (see the publish command in the report).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { ROOT, EXTRACT, COVERS, gameChain, loadTile, readJson, tileFile, tileInputs, type Feature, type Row, type TileStats } from './pipeline.js';
import { roofPlanForFeature } from '../../src/canalRecall/roofMesh.js';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.js';
import { BuildingContextIndex } from '../../src/canalRecall/buildingContextIndex.js';
import { asPolygons } from '../../src/canalRecall/threeBuildingFeatures.js';
import { encodeCell, decodeCell, sameValue, rawFeature, styledFeature, HIDE_KIT, HIDE_COVER_OSM, HIDE_COVER_PAND, WORLD_FORMAT_VERSION, type Cell, type CellBuilding, type HideEntry, type Geometry } from '../../src/canalRecall/world/cellFormat.js';
import { CELL_GRID, cellBounds, parseCellKey } from '../../src/canalRecall/world/cellGrid.js';

export const COMPILER_VERSION = 'world-compiler-1';
const args = process.argv.slice(2);
const flag = (name: string) => args.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name: string) => flag(name)?.split('=').slice(1).join('=');
const OUT = path.resolve(value('out') ?? path.join(ROOT, 'artifacts/world/staging'));
const CHANGED = !!flag('changed');
const WITH_ROOF = !!flag('roof');
const ONLY_TILES = value('tiles')?.split(',').filter(Boolean);

const sha = (b: Uint8Array | string) => crypto.createHash('sha256').update(b).digest('hex');
const gz = (b: Uint8Array) => zlib.gzipSync(b, { level: 6 }); // Node writes mtime 0, so output is reproducible
const exists = (p: string) => fs.existsSync(p);
void tileFile;

function inputHash(files: string[]): string {
  const h = crypto.createHash('sha256');
  for (const f of files) { h.update(path.relative(ROOT, f)); h.update(exists(f) ? fs.readFileSync(f) : Buffer.from('absent')); }
  return h.digest('hex');
}

/** Source files whose code decides the baked output: a change to any of them invalidates every cell. */
const CODE = ['src/canalRecall/buildingNesting.ts', 'src/canalRecall/genericFacades.ts', 'src/canalRecall/galleryPipeline.ts', 'src/canalRecall/buildingTilesBrowser.ts',
  'src/canalRecall/roofMesh.ts', 'src/canalRecall/landmarkKits.ts', 'src/canalRecall/landmarkFrontData.ts', 'src/canalRecall/shopfronts.ts', 'src/canalRecall/monumentGables.ts',
  'src/canalRecall/roofs/roofFacts.ts', 'src/canalRecall/buildingContextIndex.ts', 'src/canalRecall/world/cellFormat.ts', 'src/canalRecall/world/cellGrid.ts', 'scripts/world/compile.ts'].map(f => path.join(ROOT, f));
const GLOBAL_INPUTS = ['monument-gables.json', 'landmark-buildings.json', 'shopfronts.json'].map(f => path.join(EXTRACT, f)).concat([COVERS]);

async function main() {
  const t0 = performance.now();
  const elevation = readJson(path.join(EXTRACT, 'elevation-v1/index.json'));
  if (elevation.cellSizeM !== CELL_GRID.cellSizeM || elevation.origin.join() !== CELL_GRID.origin.join() || elevation.metresPerDegree.join() !== CELL_GRID.metresPerDegree.join()) throw Error('cellGrid.ts no longer matches elevation-v1/index.json');
  const roadCells = new Set<string>(readJson(path.join(EXTRACT, 'roads-v1/cells.json')).cells);
  const index = readJson(path.join(EXTRACT, 'building-tiles/index-z14.json'));
  let tileList: string[] = index.tileList.map((t: string) => t.replace(/^14\//, ''));
  if (ONLY_TILES) tileList = tileList.filter(t => ONLY_TILES.includes(t));

  const globalHash = inputHash([...CODE, ...GLOBAL_INPUTS]);
  const tileHash = new Map(tileList.map(t => [t, inputHash(tileInputs(t))]));
  const previous = CHANGED && exists(path.join(OUT, 'index.json')) ? readJson(path.join(OUT, 'index.json')) : null;

  // --changed: which cells must be rebuilt, and which tiles to load for them (their own + neighbouring cells', for context).
  let rebuild: Set<string> | null = null, load = tileList;
  if (previous) {
    const prevTiles: Record<string, string> = previous.tileHashes ?? {};
    const changedTiles = new Set(tileList.filter(t => prevTiles[t] !== tileHash.get(t)));
    for (const t of Object.keys(prevTiles)) if (!tileHash.has(t)) changedTiles.add(t);
    rebuild = new Set();
    for (const [key, entry] of Object.entries<any>(previous.cells)) if (previous.globalHash !== globalHash || entry.tiles.some((t: string) => changedTiles.has(t))) rebuild.add(key);
    const newTiles = [...changedTiles].filter(t => !Object.values<any>(previous.cells).some(e => e.tiles.includes(t)));
    const ring = new Set<string>();
    for (const key of rebuild) { const [i, j] = parseCellKey(key); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) ring.add(`${i + di}_${j + dj}`); }
    const want = new Set<string>(newTiles);
    for (const key of ring) for (const t of previous.cells[key]?.tiles ?? []) want.add(t);
    load = tileList.filter(t => want.has(t));
    console.log(`--changed: ${changedTiles.size} tiles changed, ${rebuild.size} cells to rebuild, loading ${load.length} tiles${previous.globalHash !== globalHash ? ' (code or global inputs changed: all cells)' : ''}`);
    if (!rebuild.size && !newTiles.length) { console.log('nothing changed'); return; }
  }

  const chain = gameChain();
  // 1. Tiles -> raw (enriched) features and their styled copies, as BuildingTileStreamer adopts and styles them.
  const rows: Row[] = [];
  const stats: TileStats & { styledChanged: number } = { sourceFeatures: 0, droppedNested: 0, noCell: 0, geometryChangedByDecorator: 0, styledChanged: 0 };
  let ti = 0;
  const td = performance.now();
  for (const tile of load) {
    for (const row of await loadTile(tile, chain, stats)) { if (row.styled !== row.raw) stats.styledChanged++; rows.push(row); }
    if (++ti % 50 === 0) console.log(`  ${ti}/${load.length} tiles, ${rows.length} buildings`);
  }
  const pipelineMs = performance.now() - td;
  let roofMs = 0;
  if (stats.geometryChangedByDecorator) throw Error(`${stats.geometryChangedByDecorator} buildings had their geometry replaced by a decorator; FOOT would not be the drawn footprint`);

  // 2. Party-wall neighbours, with the runtime's index and exclusion rule (threeBuildingsBrowser.contextFor).
  const kitHide = new Set(KIT_HIDE_IDS);
  const boxOf = (f: Feature): [number, number, number, number] => { const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]; for (const [px, py] of asPolygons(f.geometry).flat(2)) { box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py); box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py); } return box; };
  const boxes = new Map<Feature, [number, number, number, number]>();
  const bounds = (f: Feature) => { let b = boxes.get(f); if (!b) boxes.set(f, b = boxOf(f)); return b; };
  const ctx = new BuildingContextIndex(rows.map(r => r.styled), bounds);

  // 3. Hidden ids: covers.json (model -> pands / OSM ways) and the kit tables.
  const covers = readJson(COVERS);
  const hides = new Map<string, HideEntry>();
  const hide = (id: string, reason: number, model?: string) => { let h = hides.get(id); if (!h) hides.set(id, h = { id, reasons: 0, models: [] }); h.reasons |= reason; if (model && !h.models.includes(model)) h.models.push(model); };
  for (const id of KIT_HIDE_IDS) hide(id, HIDE_KIT);
  for (const [model, entry] of Object.entries<any>(covers.models ?? {})) {
    for (const p of entry.p ?? []) hide(`NL.IMBAG.Pand.${p}`, HIDE_COVER_PAND, model);
    for (const o of entry.o ?? []) hide(String(o), HIDE_COVER_OSM, model);
  }

  // 4. Cells.
  const byCell = new Map<string, Row[]>();
  for (const r of rows) { let l = byCell.get(r.cell); if (!l) byCell.set(r.cell, l = []); l.push(r); }
  const localIndex = new Map<Feature, { cell: string; index: number }>();
  for (const [cell, list] of byCell) list.forEach((r, index) => localIndex.set(r.styled, { cell, index }));
  fs.mkdirSync(path.join(OUT, 'cells'), { recursive: true });
  const cellsOut: Record<string, any> = previous && rebuild ? { ...previous.cells } : {};
  const streamTotals: Record<string, { raw: number; gz: number }> = {};
  const hiddenPlaced = new Set<string>();
  let written = 0, rawTotal = 0, gzTotal = 0, maxGz = 0;
  for (const [key, list] of [...byCell].sort(([a], [b]) => a.localeCompare(b))) {
    if (rebuild && !rebuild.has(key) && previous.cells[key]) continue;
    const [i, j] = parseCellKey(key);
    const buildings: CellBuilding[] = list.map(r => {
      const tr = performance.now();
      const roof = WITH_ROOF ? roofPlanForFeature(r.styled as any) : null;
      roofMs += performance.now() - tr;
      const own = r.styled, ownId = String(own.properties.id);
      const neighbours = ctx.neighbors([own], f => String(f.properties.id) === ownId || kitHide.has(String(f.properties.id)))
        .map(f => { const at = localIndex.get(f)!; return at.cell === key ? at.index : String(f.properties.id); });
      const polygons = asPolygons(own.geometry), [lng, lat] = polygons[0]?.[0]?.[0] ?? [0, 0];
      const n = 2 ** 14, rad = lat * Math.PI / 180, group = `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
      return { id: ownId, tile: r.tile, ordinal: r.ordinal, geometry: r.raw.geometry as Geometry, attr: r.raw.properties, styled: r.styled === r.raw ? undefined : r.styled.properties, roof: roof ?? undefined, group, neighbours };
    });
    const ids = new Set(buildings.map(b => b.id));
    const hide = [...hides.values()].filter(h => ids.has(h.id));
    for (const h of hide) hiddenPlaced.add(h.id);
    const cell: Cell = { i, j, buildings, hide };
    const encoded = encodeCell(cell);
    // Verify before writing: the decoded cell must give back the exact raw and styled features.
    const back = decodeCell(encoded.bytes, key);
    back.buildings.forEach((b, k) => {
      const src = list[k], raw = rawFeature(b), styled = styledFeature(b, raw);
      if (!sameValue(raw.properties, src.raw.properties) || !sameValue(raw.geometry, src.raw.geometry) || !sameValue(styled.properties, src.styled.properties)) throw Error(`${key}: ${b.id} does not round-trip`);
    });
    const zipped = gz(encoded.bytes);
    fs.writeFileSync(path.join(OUT, 'cells', `${key}.bin`), zipped);
    const streams: Record<string, { offset: number; bytes: number; gz: number }> = {};
    for (const s of encoded.streams) {
      const g = gz(encoded.bytes.subarray(s.offset, s.offset + s.bytes)).length;
      streams[s.tag.trim()] = { offset: s.offset, bytes: s.bytes, gz: g };
      const t = streamTotals[s.tag.trim()] ??= { raw: 0, gz: 0 }; t.raw += s.bytes; t.gz += g;
    }
    cellsOut[key] = { bounds: cellBounds(i, j), buildings: buildings.length, hidden: hide.length, bytes: encoded.bytes.length, gzBytes: zipped.length, sha256: sha(zipped), streams, tiles: [...new Set(list.map(r => r.tile))].sort(), inRoadsV1: roadCells.has(key) };
    written++; rawTotal += encoded.bytes.length; gzTotal += zipped.length; maxGz = Math.max(maxGz, zipped.length);
  }

  // Which cells each source tile's buildings landed in: the tile-preserving consumer fetches these.
  const tileCells: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries<any>(cellsOut)) for (const t of entry.tiles) (tileCells[t] ??= []).push(key);
  for (const t of Object.keys(tileCells)) tileCells[t].sort();

  const sources: Record<string, string> = {};
  for (const f of [...GLOBAL_INPUTS, path.join(EXTRACT, 'building-tiles/index-z14.json'), path.join(EXTRACT, 'elevation-v1/index.json'), path.join(EXTRACT, 'roads-v1/cells.json')]) sources[path.relative(ROOT, f)] = exists(f) ? sha(fs.readFileSync(f)) : 'absent';
  sources['building-tiles+building-facts+roof-facts (per tile, combined)'] = sha([...tileHash.entries()].sort().map(e => e.join(':')).join('\n'));
  sources['code'] = inputHash(CODE);
  const indexOut = { version: 1, format: WORLD_FORMAT_VERSION, compiler: COMPILER_VERSION, grid: CELL_GRID, generatedFrom: 'building-tiles', sources, globalHash, tileHashes: Object.fromEntries(tileHash), tileCells, cells: cellsOut };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(indexOut));

  const allGz = Object.values<any>(cellsOut).reduce((s, c) => s + c.gzBytes, 0);
  const report = {
    compiler: COMPILER_VERSION, format: WORLD_FORMAT_VERSION, changedMode: CHANGED, tilesLoaded: load.length,
    cellsWritten: written, cellsTotal: Object.keys(cellsOut).length, cellsOutsideRoadsV1: Object.entries<any>(cellsOut).filter(([, c]) => !c.inRoadsV1).map(([k]) => k),
    buildings: rows.length, ...stats, pipelineMs: Math.round(pipelineMs), roofMs: Math.round(roofMs), hiddenIds: hides.size, hiddenPlaced: hiddenPlaced.size,
    bytes: { writtenRaw: rawTotal, writtenGz: gzTotal, maxCellGz: maxGz, allCellsGz: allGz, perStream: streamTotals },
    ms: Math.round(performance.now() - t0),
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
