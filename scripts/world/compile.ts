/**
 * World compiler v1: bake the city's buildings into `world-v1` cells (src/canalRecall/world/cellFormat.ts).
 *
 *   npm run world:compile                 # every cell -> artifacts/world/staging/
 *   npm run world:compile -- --changed    # only cells whose inputs changed since the last staging run
 *   npm run world:compile -- --tiles=8414/5384,8415/5384   # a subset (tests, quick looks)
 *   npm run world:compile -- --debug      # DEBUG cells: also the enriched source bags (ATTR), for diagnosis;
 *                                         # the runtime never needs them (cellFormat.ts, flags)
 *   npm run world:compile -- --against=none   # skip the reference check below (an intended decorator change)
 *   npm run world:compile -- --no-policy  # cells exactly as the default path (no centimetre heights:
 *                                         # src/canalRecall/world/cellPolicy.ts)
 *   npm run world:compile -- --collinear  # also remove near-collinear vertices within 5 cm (held, #130)
 *   npm run world:compile -- --height-step=0.1 --eaves-step=0.1  # height/minHeight, eaves to the decimetre (held, #130)
 *   npm run world:compile -- --shell      # also bake the shells (format 6, lane R2-B #229): shells/<i_j>.bin (SHEL, the
 *                                         # coarse chunk of the cell) and far/<i_j>.bin (SHL1, the far ring's prisms)
 *   npm run world:compile -- --shell=far  # only the far ring's SHL1 files
 * The building cells are the same bytes with or without --shell (BUILDING_FORMAT_VERSION 5: v6 only adds shell streams).
 * Format 4 also writes strings.bin, the shared string table (strings two or more cells use).
 *
 * Reference check (P2 bytes gate): every written cell is decoded and compared, whole (buildings, geometry,
 * styled bags, groups, party walls, hidden ids), with the same cell in --against (default: the published
 * public/data/extracts/amsterdam/world-v1, any format version) when that cell was compiled from the same
 * tile and global inputs (hidden ids only when covers.json is also unchanged); a difference throws. A format change must not change one decoded value.
 * Skipped on a --tiles subset (party walls into unloaded tiles are missing there).
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
import './useBrowserMath.js'; // first: the browser's Math.cos/sin (browserMath.ts)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { ROOT, EXTRACT, gameChain, loadTile, readJson, tileFile, tileInputs, inputHash, CODE, GLOBAL_INPUTS, COVERS, type Feature, type Row, type TileStats } from './pipeline.js';
import { roofPlanForFeature } from '../../src/canalRecall/roofMesh.js';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.js';
import { BuildingContextIndex } from '../../src/canalRecall/buildingContextIndex.js';
import { asPolygons } from '../../src/canalRecall/threeBuildingFeatures.js';
import { encodeCell, decodeCell, sameValue, rawFeature, styledFeature, chooseGlobalStrings, encodeGlobalStrings, GLOBAL_STRINGS_FILE, type GlobalStrings, HIDE_KIT, HIDE_COVER_OSM, HIDE_COVER_PAND, BUILDING_FORMAT_VERSION, encodeShellCell, decodeShellCell, type Cell, type CellBuilding, type HideEntry, type Geometry } from '../../src/canalRecall/world/cellFormat.js';
import { bakeCellShell, SHELL_LOOK } from './shellBake.js';
import { CELL_GRID, cellBounds, parseCellKey } from '../../src/canalRecall/world/cellGrid.js';
import { applyPolicy, emptyPolicyReport, summarisePolicy, policyOptionsOf, policyOptionsFromArgs, POLICY_VERSION, type PolicyOptions } from '../../src/canalRecall/world/cellPolicy.js';
import { readGlobalStrings } from './cellFiles.js';
import { shellLayerHash } from '../../src/canalRecall/world/shellLayers.js';

// world-compiler-2 (2026-11-06, lane R2-B #229): --shell bakes the format-6 shell files; the cells are unchanged.
export const COMPILER_VERSION = 'world-compiler-2';
/** What a cell's shells are baked from beyond the cell itself (the mesher and its tables): a change rebakes every shell. */
const SHELL_CODE = ['src/canalRecall/threeBuildingFeatures.ts', 'src/canalRecall/threeBuildingMesh.ts', 'src/canalRecall/world/shellMesh.ts', 'src/canalRecall/world/shellLayers.ts', 'scripts/world/shellBake.ts', 'public/data/street-appearance/profiles.json'].map(f => path.join(ROOT, f));
const WORLD_FORMAT_VERSION = BUILDING_FORMAT_VERSION;
const args = process.argv.slice(2);
const flag = (name: string) => args.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name: string) => flag(name)?.split('=').slice(1).join('=');
const OUT = path.resolve(value('out') ?? path.join(ROOT, 'artifacts/world/staging'));
const CHANGED = !!flag('changed');
const WITH_ROOF = !!flag('roof');
const DEBUG = !!flag('debug');
const ONLY_TILES = value('tiles')?.split(',').filter(Boolean);
const NO_POLICY = !!flag('no-policy');
const POLICY_OPTIONS: PolicyOptions = policyOptionsFromArgs(process.argv.slice(2));
const SHELL = flag('shell') ? (value('shell') === 'far' ? 'far' : 'all') : null;
const AGAINST = value('against') === 'none' ? null : path.resolve(value('against') ?? path.join(EXTRACT, 'world-v1'));

const sha = (b: Uint8Array | string) => crypto.createHash('sha256').update(b).digest('hex');
const gz = (b: Uint8Array) => zlib.gzipSync(b, { level: 6 }); // Node writes mtime 0, so output is reproducible
/** SHEL files at gzip level 9 (lane R4-A #243: −3.6 % over level 6 on the 604 cells, decoded the same). */
const gz9 = (b: Uint8Array) => zlib.gzipSync(b, { level: 9 });
const exists = (p: string) => fs.existsSync(p);
void tileFile;

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
    const allStale = previous.globalHash !== globalHash || !!previous.debug !== DEBUG;
    for (const [key, entry] of Object.entries<any>(previous.cells)) if (allStale || entry.tiles.some((t: string) => changedTiles.has(t))) rebuild.add(key);
    const newTiles = [...changedTiles].filter(t => !Object.values<any>(previous.cells).some(e => e.tiles.includes(t)));
    const ring = new Set<string>();
    for (const key of rebuild) { const [i, j] = parseCellKey(key); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) ring.add(`${i + di}_${j + dj}`); }
    const want = new Set<string>(newTiles);
    for (const key of ring) for (const t of previous.cells[key]?.tiles ?? []) want.add(t);
    load = tileList.filter(t => want.has(t));
    console.log(`--changed: ${changedTiles.size} tiles changed, ${rebuild.size} cells to rebuild, loading ${load.length} tiles${allStale ? ' (code, global inputs or --debug changed: all cells)' : ''}`);
    if (!rebuild.size && !newTiles.length) { console.log('nothing changed'); return; }
  }

  // The reference cells (published world-v1) and which of them came from the inputs this run reads.
  // Not on a --tiles subset: party walls into tiles that were not loaded are missing there, so cells legitimately differ.
  const reference = AGAINST && AGAINST !== OUT && !ONLY_TILES && exists(path.join(AGAINST, 'index.json')) ? readJson(path.join(AGAINST, 'index.json')) : null;
  const ownSources: Record<string, string> = {};
  for (const f of GLOBAL_INPUTS) ownSources[path.relative(ROOT, f)] = exists(f) ? sha(fs.readFileSync(f)) : 'absent';
  // covers.json feeds only the hidden ids: when it alone changed, buildings are still compared, HIDE is not.
  const coversKey = path.relative(ROOT, COVERS);
  const referenceGlobalsMatch = !!reference && Object.entries(ownSources).every(([f, h]) => f === coversKey || reference.sources?.[f] === h);
  const referenceCoversMatch = !!reference && reference.sources?.[coversKey] === ownSources[coversKey];
  const against = { dir: reference ? path.relative(ROOT, AGAINST!) : null, referenceFormat: reference?.format ?? null, globalInputsMatch: referenceGlobalsMatch, coversMatch: referenceCoversMatch, compared: 0, buildings: 0, skippedStale: [] as string[], missing: [] as string[] };
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
  const built: { key: string; list: Row[]; cell: Cell }[] = [], policyReport = emptyPolicyReport();
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
      // As the decoder gives a building back (the whole-cell round-trip check compares keys): a runtime cell carries
      // the styled bag as its only bag; absent keys are absent, not undefined.
      const b: CellBuilding = { id: ownId, tile: r.tile, ordinal: r.ordinal, geometry: r.raw.geometry as Geometry, attr: DEBUG ? r.raw.properties : r.styled.properties };
      if (DEBUG && r.styled !== r.raw) b.styled = r.styled.properties;
      if (roof) b.roof = roof;
      b.group = group; b.neighbours = neighbours;
      return b;
    });
    const ids = new Set(buildings.map(b => b.id));
    const hide = [...hides.values()].filter(h => ids.has(h.id));
    for (const h of hide) hiddenPlaced.add(h.id);
    const cell: Cell = DEBUG ? { i, j, buildings, hide, debug: true } : { i, j, buildings, hide };
    // The compile policy (cellPolicy.ts): heights to POLICY_OPTIONS.heightStepM; with --collinear, near-collinear vertices within 5 cm removed.
    built.push({ key, list, cell: NO_POLICY ? cell : applyPolicy(cell, policyReport, POLICY_OPTIONS) });
  }

  // The shared string table (format 4): strings two or more cells use. A --changed run keeps the table it
  // compiled before (cells it does not rewrite were encoded against it); new strings stay in their cell.
  let globals: GlobalStrings | undefined, globalsBytes: Uint8Array | undefined;
  const keepTable = !!rebuild && previous?.strings && exists(path.join(OUT, GLOBAL_STRINGS_FILE));
  if (keepTable) globals = readGlobalStrings(OUT);
  else ({ bytes: globalsBytes, table: globals } = encodeGlobalStrings(chooseGlobalStrings(built.map(b => encodeCell(b.cell).strings), 2)));
  const referenceGlobals = reference ? readGlobalStrings(AGAINST!) : undefined;

  const decoded = new Map<string, Cell>();
  for (const { key, list, cell } of built) {
    const [i, j] = parseCellKey(key), buildings = cell.buildings, hide = cell.hide;
    const encoded = encodeCell(cell, WORLD_FORMAT_VERSION, globals);
    // Verify before writing: the decoded cell must give back exactly the cell (the default path's raw and styled
    // features, through the policy).
    const back = decodeCell(encoded.bytes, key, globals);
    back.buildings.forEach((b, k) => { if (!sameValue(b, buildings[k])) throw Error(`${key}: ${b.id} does not round-trip`); });
    if (!sameValue(back, cell)) throw Error(`${key}: the cell does not round-trip`);
    if (SHELL) decoded.set(key, back);
    if (NO_POLICY) back.buildings.forEach((b, k) => {
      const src = list[k], raw = rawFeature(b), styled = styledFeature(b, raw);
      // A runtime cell gives back the styled bag only (raw === styled); a DEBUG cell also the source bag.
      if ((DEBUG && !sameValue(raw.properties, src.raw.properties)) || !sameValue(raw.geometry, src.raw.geometry) || !sameValue(styled.properties, src.styled.properties)) throw Error(`${key}: ${b.id} does not round-trip`);
    });
    if (reference) {
      const entry = reference.cells?.[key], file = path.join(AGAINST!, 'cells', `${key}.bin`);
      // A reference compiled under a different policy (or a policy when this run has none) cannot be compared.
      const refOptions = policyOptionsOf(reference), policyClash = !!refOptions && (NO_POLICY || refOptions.collinear !== POLICY_OPTIONS.collinear || refOptions.heightStepM !== POLICY_OPTIONS.heightStepM || refOptions.eavesStepM !== POLICY_OPTIONS.eavesStepM);
      const fresh = !policyClash && referenceGlobalsMatch && !!entry && entry.tiles.every((t: string) => reference.tileHashes?.[t] === tileHash.get(t)) && entry.tiles.join() === [...new Set(list.map(r => r.tile))].sort().join();
      if (!entry || !exists(file)) against.missing.push(key);
      else if (!fresh) against.skippedStale.push(key);
      else {
        // A reference compiled without the policy is compared through it (the policy is applied once).
        const decoded = decodeCell(zlib.gunzipSync(fs.readFileSync(file)), `reference ${key}`, referenceGlobals);
        const old = refOptions || NO_POLICY ? decoded : applyPolicy(decoded, undefined, POLICY_OPTIONS);
        if (!!old.debug !== DEBUG) against.skippedStale.push(key);
        else {
          if (old.buildings.length !== back.buildings.length) throw Error(`${key}: ${back.buildings.length} buildings, the reference cell has ${old.buildings.length}`);
          back.buildings.forEach((b, k) => { if (!sameValue(b, old.buildings[k])) throw Error(`${key}: ${b.id} decodes differently from the reference cell (${against.dir})`); });
          if (!sameValue(referenceCoversMatch ? back : { ...back, hide: [] }, referenceCoversMatch ? old : { ...old, hide: [] })) throw Error(`${key}: the decoded cell differs from the reference cell (${referenceCoversMatch ? 'hidden ids or ' : ''}cell fields)`);
          against.compared++; against.buildings += back.buildings.length;
        }
      }
    }
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

  // 5. Shells (--shell): from the decoded cells (what the runtime reads), each cell's buildings with their party-wall
  // neighbours in other cells as context, through the runtime coarse build (shellBake.ts).
  const shellReport = SHELL ? { look: SHELL_LOOK, cells: 0, coarseTriangles: 0, farPrisms: 0, bakeMs: 0, farMs: 0, shelGz: [] as number[], farGz: [] as number[] } : null;
  // The mesher's sources and (lane R4-A #243) the facade atlas layer table the SHEL `layers` bytes index.
  const layerHash = shellLayerHash(), shellHash = sha(`${inputHash(SHELL_CODE)}:${layerHash}`);
  if (SHELL && previous?.shells && previous.shells.hash !== shellHash && rebuild) throw Error('--shell --changed: the shell code changed since the last run; run --shell without --changed');
  if (SHELL) {
    const byId = new Map<string, any>();
    for (const c of decoded.values()) for (const b of c.buildings) byId.set(b.id, styledFeature(b, rawFeature(b)));
    for (const sub of SHELL === 'all' ? ['shells', 'far'] : ['far']) fs.mkdirSync(path.join(OUT, sub), { recursive: true });
    for (const [key, cell] of decoded) {
      const features = cell.buildings.map(b => byId.get(b.id));
      const context: any[] = [], seen = new Set<string>();
      for (const b of cell.buildings) for (const n of b.neighbours ?? []) if (typeof n === 'string' && !seen.has(n)) { seen.add(n); const f = byId.get(n); if (f) context.push(f); }
      // The far level leaves out what an installed model or kit replaces (HIDE): the model draws there, and a prism
      // the size of the footprint covered it (S4 Zuidas towers, lane R2-B #229).
      const bake = bakeCellShell(cell.i, cell.j, features, context, ROOT, cell.buildings.map(b => b.group ?? b.tile), new Set(cell.hide.map(h => h.id)));
      const entry = cellsOut[key];
      delete entry.shell; delete entry.far;
      if (!bake) continue;
      shellReport!.cells++; shellReport!.coarseTriangles += bake.coarseTriangles; shellReport!.farPrisms += bake.far.length; shellReport!.bakeMs += bake.ms; shellReport!.farMs += bake.farMs;
      const files: ['shell' | 'far', string, any][] = SHELL === 'all' ? [['shell', 'shells', { shel: bake.shel }], ['far', 'far', { far: bake.far }]] : [['far', 'far', { far: bake.far }]];
      for (const [field, sub, part] of files) {
        const enc = encodeShellCell({ i: cell.i, j: cell.j, ...part }), back = decodeShellCell(enc.bytes, `${sub} ${key}`);
        if (!sameValue(back, { i: cell.i, j: cell.j, ...part })) throw Error(`${sub} ${key}: the shell does not round-trip`);
        // SHEL at level 9; the published far files keep level 6 (their bytes, and so their published sha, unchanged).
        const zip = field === 'shell' ? gz9 : gz, zipped = zip(enc.bytes), s0 = enc.streams[0];
        fs.writeFileSync(path.join(OUT, sub, `${key}.bin`), zipped);
        const tag = s0.tag.trim(), sg = zip(enc.bytes.subarray(s0.offset, s0.offset + s0.bytes)).length;
        entry[field] = { bytes: enc.bytes.length, gzBytes: zipped.length, sha256: sha(zipped), streams: { [tag]: { offset: s0.offset, bytes: s0.bytes, gz: sg } } };
        const t = streamTotals[tag] ??= { raw: 0, gz: 0 }; t.raw += s0.bytes; t.gz += sg;
        (field === 'shell' ? shellReport!.shelGz : shellReport!.farGz).push(zipped.length);
      }
    }
  }
  const shells = SHELL ? { format: 6, look: SHELL_LOOK, hash: shellHash, layers: layerHash, shel: SHELL === 'all', far: true } : undefined;

  // Which cells each source tile's buildings landed in: the tile-preserving consumer fetches these.
  const tileCells: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries<any>(cellsOut)) for (const t of entry.tiles) (tileCells[t] ??= []).push(key);
  for (const t of Object.keys(tileCells)) tileCells[t].sort();

  const sources: Record<string, string> = {};
  for (const f of [...GLOBAL_INPUTS, path.join(EXTRACT, 'building-tiles/index-z14.json'), path.join(EXTRACT, 'elevation-v1/index.json'), path.join(EXTRACT, 'roads-v1/cells.json')]) sources[path.relative(ROOT, f)] = exists(f) ? sha(fs.readFileSync(f)) : 'absent';
  sources['building-tiles+building-facts+roof-facts (per tile, combined)'] = sha([...tileHash.entries()].sort().map(e => e.join(':')).join('\n'));
  sources['code'] = inputHash(CODE);
  if (globalsBytes) fs.writeFileSync(path.join(OUT, GLOBAL_STRINGS_FILE), gz(globalsBytes));
  const stringsFile = path.join(OUT, GLOBAL_STRINGS_FILE);
  const strings = globals ? { file: GLOBAL_STRINGS_FILE, count: globals.list.length, hash: globals.hash, gzBytes: fs.statSync(stringsFile).size, sha256: sha(fs.readFileSync(stringsFile)) } : undefined;
  const policy = NO_POLICY ? undefined : POLICY_VERSION, policyOptions = NO_POLICY ? undefined : POLICY_OPTIONS;
  const indexOut = { version: 1, format: WORLD_FORMAT_VERSION, ...(policy ? { policy, policyOptions } : {}), ...(strings ? { strings } : {}), ...(shells ? { shells } : {}), debug: DEBUG, compiler: COMPILER_VERSION, grid: CELL_GRID, generatedFrom: 'building-tiles', sources, globalHash, tileHashes: Object.fromEntries(tileHash), tileCells, cells: cellsOut };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(indexOut));
  // The runtime's probe reads only this (tileCells and the cell list, ~5 % of index.json): the 400 KB index cost
  // world-v1 ~150 ms against the default path at page start (lane L4 time-to-resident).
  // The far tier (engine/farShells.ts) reads `far` (gzip bytes of far/<key>.bin) to know which cells have prisms.
  const runtime = { version: 1, format: WORLD_FORMAT_VERSION, ...(policy ? { policy, policyOptions } : {}), ...(strings ? { strings } : {}), ...(shells ? { shells: { format: shells.format, look: shells.look, layers: shells.layers, shel: shells.shel, far: shells.far } } : {}), compiler: COMPILER_VERSION, globalHash, tileCells, cells: Object.fromEntries(Object.entries<any>(cellsOut).map(([k, c]) => [k, { buildings: c.buildings, gzBytes: c.gzBytes, ...(c.far ? { far: c.far.gzBytes } : {}), ...(c.shell ? { shell: c.shell.gzBytes } : {}) }])) };
  fs.writeFileSync(path.join(OUT, 'tiles.json'), JSON.stringify(runtime));

  const allGz = Object.values<any>(cellsOut).reduce((s, c) => s + c.gzBytes, 0);
  const report = {
    compiler: COMPILER_VERSION, format: WORLD_FORMAT_VERSION, changedMode: CHANGED, tilesLoaded: load.length,
    cellsWritten: written, cellsTotal: Object.keys(cellsOut).length, cellsOutsideRoadsV1: Object.entries<any>(cellsOut).filter(([, c]) => !c.inRoadsV1).map(([k]) => k),
    buildings: rows.length, ...stats, pipelineMs: Math.round(pipelineMs), roofMs: Math.round(roofMs), hiddenIds: hides.size, hiddenPlaced: hiddenPlaced.size,
    against, policy: NO_POLICY ? null : summarisePolicy(policyReport), strings: strings ?? null,
    bytes: { writtenRaw: rawTotal, writtenGz: gzTotal, maxCellGz: maxGz, allCellsGz: allGz, stringsGz: strings?.gzBytes ?? 0, cityTotalGz: allGz + (strings?.gzBytes ?? 0), perStream: streamTotals },
    shells: shellReport ? (() => { const med = (v: number[]) => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.floor(o.length / 2)] : 0; }; const { shelGz, farGz, ...rest } = shellReport; return { ...rest, bakeMs: Math.round(rest.bakeMs), farMs: Math.round(rest.farMs), shelGzMedian: med(shelGz), shelGzMax: Math.max(0, ...shelGz), shelGzTotal: shelGz.reduce((a, b) => a + b, 0), farGzMedian: med(farGz), farGzMax: Math.max(0, ...farGz), farGzTotal: farGz.reduce((a, b) => a + b, 0) }; })() : null,
    ms: Math.round(performance.now() - t0),
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
