/**
 * Staged world-v1 cells against the default tile path run now, from this checkout's extract and code:
 *   node --import tsx scripts/world/verify.ts [--dir=artifacts/world/staging] [--tiles=8414/5384,...] [--report=file.json]
 * Per z14 tile: ids only in the cells, ids only in the default path, raw (attr/geometry) and styled
 * differences, order. Also the compiler's freshness hashes (tile inputs, code + global inputs) against
 * the index. Exits 1 on any difference. The browser A/B (tests/e2e/world-v1-ab.spec.ts) runs it first:
 * stale cells are the commonest cause of a world/default difference (2026-10-30: the four tiles under
 * Westerkerk differed because the building tiles were regenerated after the cells were compiled).
 */
import './useBrowserMath.js'; // first: the browser's Math.cos/sin (browserMath.ts)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, EXTRACT, CODE, GLOBAL_INPUTS, gameChain, inputHash, loadTile, readJson, tileInputs } from './pipeline.js';
import { rawFeature, sameValue, styledFeature, type Cell, type CellBuilding, type Geometry, type Props } from '../../src/canalRecall/world/cellFormat.js';
import { quantiseHeights, sharedVertices, policyFootprint, policyOptionsOf, POLICY_VERSION } from '../../src/canalRecall/world/cellPolicy.js';
import { readCell, readGlobalStrings } from './cellFiles.js';

const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const DIR = path.resolve(value('dir') ?? path.join(ROOT, 'artifacts/world/staging'));
const REPORT = value('report');

export type TileVerdict = { tile: string; default: number; world: number; onlyWorld: string[]; onlyDefault: string[]; rawDiffer: string[]; styledDiffer: string[]; orderDiffers: boolean };

async function main() {
  const index = readJson(path.join(DIR, 'index.json'));
  const all: string[] = readJson(path.join(EXTRACT, 'building-tiles/index-z14.json')).tileList.map((t: string) => t.replace(/^14\//, ''));
  const tiles = value('tiles')?.split(',').filter(Boolean) ?? [...new Set([...all, ...Object.keys(index.tileCells)])].sort();
  const globalFresh = index.globalHash === inputHash([...CODE, ...GLOBAL_INPUTS]);
  const staleTiles = tiles.filter(t => (index.tileHashes?.[t] ?? 'absent') !== (all.includes(t) ? inputHash(tileInputs(t)) : 'absent'));
  const chain = gameChain(), cells = new Map<string, Cell>();
  const globals = readGlobalStrings(DIR);
  const cell = (k: string) => { let c = cells.get(k); if (!c) cells.set(k, c = readCell(DIR, k, globals)); return c; };
  // Cells compiled with the compile policy (index.policy) are compared with the default path put through the same
  // policy (cellPolicy.ts), exactly; the shared-vertex set is the cell's (shared vertices are never removed, so the
  // decoded cell has the same set as the compiled one).
  if (index.policy && index.policy !== POLICY_VERSION) throw Error(`cells carry ${index.policy}; this checkout applies ${POLICY_VERSION}`);
  const shared = new Map<string, Set<string>>();
  const sharedOf = (k: string) => { let s = shared.get(k); if (!s) shared.set(k, s = sharedVertices(cell(k).buildings.map(b => b.geometry))); return s; };
  const options = policyOptionsOf(index);
  const policyGeometry = (g: Geometry, k: string): Geometry => options?.collinear ? policyFootprint(g, sharedOf(k)) : g;
  const policyBag = (p: Props): Props => options ? quantiseHeights(p, options.heightStepM) : p;
  const verdicts: TileVerdict[] = [];
  for (const t of tiles) {
    const rows = await loadTile(t, chain);
    const picked: CellBuilding[] = [];
    for (const k of index.tileCells[t] ?? []) for (const b of cell(k).buildings) if (b.tile === t) picked.push(b);
    picked.sort((a, b) => a.ordinal - b.ordinal);
    const a = new Map(rows.map(r => [String(r.raw.properties.id), r])), b = new Map(picked.map(p => [p.id, p]));
    const v: TileVerdict = { tile: t, default: rows.length, world: picked.length, onlyWorld: [...b.keys()].filter(k => !a.has(k)), onlyDefault: [...a.keys()].filter(k => !b.has(k)), rawDiffer: [], styledDiffer: [], orderDiffers: false };
    for (const [id, r] of a) {
      const p = b.get(id); if (!p) continue;
      const raw = rawFeature(p);
      // Runtime cells carry no source bag (raw === styled): only a DEBUG cell's raw properties can be compared.
      if ((index.debug && !sameValue(raw.properties, policyBag(r.raw.properties))) || !sameValue(raw.geometry, policyGeometry(r.raw.geometry, r.cell))) v.rawDiffer.push(id);
      if (!sameValue(styledFeature(p, raw).properties, policyBag(r.styled.properties))) v.styledDiffer.push(id);
    }
    v.orderDiffers = rows.length === picked.length && rows.some((r, i) => String(r.raw.properties.id) !== picked[i].id);
    verdicts.push(v);
  }
  const differing = verdicts.filter(v => v.onlyWorld.length || v.onlyDefault.length || v.rawDiffer.length || v.styledDiffer.length || v.orderDiffers);
  const summary = { dir: path.relative(ROOT, DIR), tiles: tiles.length, buildings: verdicts.reduce((s, v) => s + v.default, 0), globalFresh, staleTiles, differingTiles: differing.map(v => ({ ...v, onlyWorld: v.onlyWorld.length, onlyDefault: v.onlyDefault.length, rawDiffer: v.rawDiffer.length, styledDiffer: v.styledDiffer.length })) };
  if (REPORT) fs.writeFileSync(REPORT, JSON.stringify({ ...summary, verdicts: differing }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (differing.length || staleTiles.length || !globalFresh) process.exit(1);
}

main().catch(error => { console.error(error); process.exit(1); });
