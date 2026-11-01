/**
 * The `?world=v1` structural gate (#129/#130): at the A/B's five fixed spots (abSpots.ts), the buildings the cells
 * give back must equal the default runtime path run now from this checkout's extract and code, field for field,
 * zero tolerance, against the unrounded runtime values (a cell policy that rounds heights or simplifies footprints
 * fails here, by design):
 *   ids and order, footprints, styled bag (heights, roof and style fields), roof plans (when the cells carry them),
 *   the coarse group, party-wall neighbours (BuildingContextIndex with the runtime's exclusion rule, over the spot's
 *   tile and its ring), and the hidden ids (covers.json and the kit tables).
 *   node --import tsx scripts/world/check-ab-spots.ts [--dir=public/data/extracts/amsterdam/world-v1]
 * Exits 1 on any difference and names each one. A difference after a code or extract change usually means the cells
 * need a recompile (npm run world:compile), not a runtime bug; scripts/world/verify.ts says which tiles are stale.
 */
import './useBrowserMath.js'; // first: the browser's Math.cos/sin (browserMath.ts)
import path from 'node:path';
import { ROOT, EXTRACT, COVERS, gameChain, loadTile, readJson, type Feature, type Row } from './pipeline.js';
import { AB_SPOTS } from './abSpots.js';
import { readCell, readGlobalStrings } from './cellFiles.js';
import { roofPlanForFeature } from '../../src/canalRecall/roofMesh.js';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.js';
import { BuildingContextIndex } from '../../src/canalRecall/buildingContextIndex.js';
import { asPolygons } from '../../src/canalRecall/threeBuildingFeatures.js';
import { sameValue, styledFeature, rawFeature, HIDE_KIT, HIDE_COVER_OSM, HIDE_COVER_PAND, type Cell, type CellBuilding, type Geometry, type Props } from '../../src/canalRecall/world/cellFormat.js';
import { policyOptionsOf, POLICY_VERSION } from '../../src/canalRecall/world/cellPolicy.js';

const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const DIR = path.resolve(value('dir') ?? path.join(EXTRACT, 'world-v1'));

const tileOf = (lng: number, lat: number, z = 14): [number, number] => {
  const n = 2 ** z, rad = lat * Math.PI / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)];
};
const groupOf = (f: Feature) => { const [lng, lat] = asPolygons(f.geometry)[0]?.[0]?.[0] ?? [0, 0]; const [x, y] = tileOf(lng, lat); return `${x}/${y}`; };
const boxOf = (f: Feature): [number, number, number, number] => {
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [px, py] of asPolygons(f.geometry).flat(2)) { box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py); box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py); }
  return box;
};

async function main() {
  const index = readJson(path.join(DIR, 'index.json'));
  if (index.policy && index.policy !== POLICY_VERSION) throw Error(`cells carry ${index.policy}; this checkout applies ${POLICY_VERSION}`);
  const options = policyOptionsOf(index), globals = readGlobalStrings(DIR), chain = gameChain();
  const cells = new Map<string, Cell>();
  const cell = (k: string) => { let c = cells.get(k); if (!c) cells.set(k, c = readCell(DIR, k, globals)); return c; };
  // The default side is never rounded or simplified: the cells must reproduce the runtime path exactly (#129,
  // 2026-11-01). Cells compiled under a value-changing policy (centimetre heights, collinear removal) differ here,
  // as they do on screen: that policy changed whole facades in the fixed-camera owners A/B.
  const policy = options && (options.collinear || options.heightStepM || options.eavesStepM) ? options : null;
  console.log(`cell policy: ${policy ? JSON.stringify(policy) : 'none'} (compared against the unrounded default path)`);
  // Hidden ids as compile.ts derives them.
  const expectedHide = new Map<string, number>();
  const hide = (id: string, reason: number) => expectedHide.set(id, (expectedHide.get(id) ?? 0) | reason);
  for (const id of KIT_HIDE_IDS) hide(id, HIDE_KIT);
  for (const entry of Object.values<any>(readJson(COVERS).models ?? {})) {
    for (const p of entry.p ?? []) hide(`NL.IMBAG.Pand.${p}`, HIDE_COVER_PAND);
    for (const o of entry.o ?? []) hide(String(o), HIDE_COVER_OSM);
  }
  const kitHide = new Set(KIT_HIDE_IDS);
  const tileRows = new Map<string, Row[]>();
  const rowsOf = async (t: string) => { let r = tileRows.get(t); if (!r) tileRows.set(t, r = await loadTile(t, chain)); return r; };

  const report: Array<{ spot: string; tile: string; buildings: number; differences: string[]; compared: { neighbours: number; roofs: number; hidden: number } }> = [];
  for (const spot of AB_SPOTS) {
    const [tx, ty] = tileOf(spot.at[0], spot.at[1]), tile = `${tx}/${ty}`, differences: string[] = [];
    const diff = (what: string) => { if (differences.length < 40) differences.push(what); else if (differences.length === 40) differences.push('…'); };
    // The default path: the spot's tile, with its ring for party-wall context.
    const ring: Row[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ring.push(...await rowsOf(`${tx + dx}/${ty + dy}`));
    const bounds = new Map<Feature, [number, number, number, number]>();
    const ctx = new BuildingContextIndex(ring.map(r => r.styled), f => { let b = bounds.get(f); if (!b) bounds.set(f, b = boxOf(f)); return b; });
    const rows = await rowsOf(tile);
    // CHECK_AB_PERTURB=1: nudge one building's height in the default path, to show the check sees it.
    if (process.env.CHECK_AB_PERTURB && rows[0]) rows[0].styled = { ...rows[0].styled, properties: { ...rows[0].styled.properties, height: Number(rows[0].styled.properties.height ?? 0) + 0.5 } };
    // The world path: the cells' buildings of that tile, in ordinal order.
    const picked: Array<{ b: CellBuilding; key: string }> = [];
    for (const k of index.tileCells[tile] ?? []) for (const b of cell(k).buildings) if (b.tile === tile) picked.push({ b, key: k });
    picked.sort((a, b) => a.b.ordinal - b.b.ordinal);
    const compared = { neighbours: 0, roofs: 0, hidden: 0 };
    if (rows.length !== picked.length) diff(`count: default ${rows.length}, world ${picked.length}`);
    const world = new Map(picked.map(p => [p.b.id, p]));
    rows.forEach((r, i) => {
      const id = String(r.raw.properties.id), p = world.get(id);
      if (!p) { diff(`${id}: only in the default path`); return; }
      if (picked[i]?.b.id !== id) diff(`${id}: order (default #${i}, world #${picked.indexOf(p)})`);
      const { b, key } = p, raw = rawFeature(b);
      if (!sameValue(raw.geometry, r.raw.geometry as Geometry)) diff(`${id}: footprint`);
      const styled = styledFeature(b, raw).properties, want = r.styled.properties as Props;
      if (!sameValue(styled, want)) {
        const keys = [...new Set([...Object.keys(styled), ...Object.keys(want)])].filter(k => !sameValue(styled[k], want[k]));
        diff(`${id}: styled ${keys.slice(0, 6).join(', ')}`);
      }
      // Cells compiled with --roof carry the plan; otherwise both paths plan the roof at runtime from what they hold.
      const wantRoof = roofPlanForFeature(r.styled as any), gotRoof = b.roof !== undefined ? b.roof : roofPlanForFeature({ type: 'Feature', properties: styled, geometry: raw.geometry } as any);
      if (wantRoof) compared.roofs++;
      if (!sameValue(gotRoof, wantRoof)) diff(`${id}: roof plan`);
      if (b.group !== groupOf(r.styled)) diff(`${id}: group ${b.group} != ${groupOf(r.styled)}`);
      const wantN = ctx.neighbors([r.styled], f => String(f.properties.id) === id || kitHide.has(String(f.properties.id))).map(f => String(f.properties.id)).sort();
      const gotN = (b.neighbours ?? []).map(n => typeof n === 'number' ? cell(key).buildings[n]?.id ?? `#${n}` : n).sort();
      compared.neighbours += wantN.length;
      if (!sameValue(gotN, wantN)) diff(`${id}: party-wall neighbours [${gotN.join(' ')}] != [${wantN.join(' ')}]`);
      const hidden = cell(key).hide.find(h => h.id === id)?.reasons ?? 0;
      if (hidden) compared.hidden++;
      if (hidden !== (expectedHide.get(id) ?? 0)) diff(`${id}: hidden ${hidden} != ${expectedHide.get(id) ?? 0}`);
    });
    for (const id of world.keys()) if (!rows.some(r => String(r.raw.properties.id) === id)) diff(`${id}: only in the cells`);
    report.push({ spot: spot.name, tile, buildings: rows.length, differences, compared });
  }
  for (const r of report) console.log(`${r.differences.length ? 'DIFFER' : 'same  '} ${r.spot} (${r.tile}, ${r.buildings} buildings, ${r.compared.neighbours} party walls, ${r.compared.roofs} roof plans, ${r.compared.hidden} hidden)${r.differences.length ? `\n  ${r.differences.join('\n  ')}` : ''}`);
  console.log(JSON.stringify({ dir: path.relative(ROOT, DIR), spots: report.length, differing: report.filter(r => r.differences.length).map(r => r.spot) }));
  if (report.some(r => r.differences.length)) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exit(1); });
