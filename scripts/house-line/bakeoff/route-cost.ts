/**
 * Lane BK (route bake-off, 2026-11-13): what the near tier's generic route (A) and the F1 record route (B) cost and
 * draw for a pand, through the game's own chain and chunk builder (house:preview's PreviewSession, as D1's
 * pixel-probe.ts). One process = one condition (HOUSE_SPECS_DIR published or staged; --records for F1).
 *
 *   node --import tsx scripts/house-line/bakeoff/route-cost.ts <pandId,...> --label <name> --out <file.json> [--records]
 *
 * Per pand: own triangles in the row chunk (walls + extras; the runtime builds one chunk per z14 group tile), the
 * median ms of five chunk builds of the pand alone (its row as context), the drawn street-run grid (layoutProbe), the
 * mesher's choices (meshBuildingFor: preset layers, wallHex, shopfront), and with --records the F1 record
 * (look/facadeRecord.ts facadeRecordFor) the shader draws: storeys, bays, head, bands and their Src bits.
 * --records needs the F1 branch (lane/facade-f1-build-20261112); on main it exits with a message.
 */
import '../../world/useBrowserMath.ts';
import fs from 'node:fs';
import { PreviewSession, ROW_M } from '../../house-preview/preview.ts';
import type { Feature } from '../../world/pipeline.ts';
import { EXTRACT, houseSpecsDir } from '../../world/pipeline.ts';
import * as shell from '../../world/shellBake.ts';
import { buildFeatureChunk, asPolygons, meshBuildingFor } from '../../../src/canalRecall/threeBuildingFeatures.ts';
import { layoutProbe } from '../../../src/canalRecall/threeBuildingMesh.ts';
import { BuildingContextIndex } from '../../../src/canalRecall/buildingContextIndex.ts';
import { KIT_HIDE_IDS } from '../../../src/canalRecall/landmarkKits.ts';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';

const argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(n); return i < 0 ? undefined : argv[i + 1]; };
const pands = (argv.find(a => /^\d{16}(,\d{16})*$/.test(a)) ?? '').split(',').filter(Boolean);
const label = flag('--label') ?? 'run', out = flag('--out'), records = argv.includes('--records');
if (!pands.length || !out) { console.error('route-cost.ts <pandId,...> --label <name> --out <file.json> [--records]'); process.exit(2); }

let facadeRecordFor: ((i: unknown) => Record<string, unknown>) | undefined, specFor: ((id: string) => unknown) | undefined;
if (records) {
  const loadTable = (shell as Record<string, unknown>).loadHouseSpecTable as ((e: string, d: string) => Map<string, unknown>) | undefined;
  if (!loadTable) { console.error('--records needs the F1 branch (look/facadeRecord.ts, shellBake loadHouseSpecTable)'); process.exit(2); }
  facadeRecordFor = (await import('../../../src/canalRecall/look/facadeRecord.ts' as string)).facadeRecordFor;
  const t = loadTable(EXTRACT, houseSpecsDir()); specFor = id => t.get(id);
}

const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const full = (id: string) => `NL.IMBAG.Pand.${id}`;
type Chunk = { indices: ArrayLike<number>; ranges: { id: string; start: number; count: number }[]; record?: { inputs: { id: string }[] } };
const ownTris = (c: Chunk, id: string) => {
  const own = c.ranges.filter(r => r.id === id); let n = 0;
  for (let k = 0; k < c.indices.length; k += 3) { const v = c.indices[k]; if (own.some(r => v >= r.start && v < r.start + r.count)) n++; }
  return n;
};
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const session = new PreviewSession('photo');
const profiles = shell.shellProfiles(REPO_ROOT);
const opts = records ? { facadeRecord: true, specFor } : {};
const rows: Record<string, unknown>[] = [];
for (const id of pands) {
  const tile = session.tileOf(id);
  const tileRows = await session.rows(tile);
  const raw = tileRows.find(r => r.raw.properties.id === full(id));
  if (!raw) { rows.push({ pandId: id, error: 'not drawn by the generic path' }); continue; }
  const own = raw.styled, p = own.properties as Record<string, unknown>;
  const kitHide = new Set(KIT_HIDE_IDS);
  const ctx = new BuildingContextIndex(tileRows.map(r => r.styled), boxOf);
  const ownBox = boxOf(own), rowLng = ROW_M / (111_320 * Math.cos(52.37 * Math.PI / 180)), rowLat = ROW_M / 110_540;
  const near = (f: Feature) => { const q = boxOf(f); return q[0] <= ownBox[2] + rowLng && q[2] >= ownBox[0] - rowLng && q[1] <= ownBox[3] + rowLat && q[3] >= ownBox[1] - rowLat; };
  const features = tileRows.map(r => r.styled).filter(f => !kitHide.has(String(f.properties.id)) && near(f));
  const inChunk = new Set(features);
  const context = ctx.neighbors(features, f => inChunk.has(f) || kitHide.has(String(f.properties.id)));
  const streets = shell.shellStreets(REPO_ROOT, features as never);
  const runs: { storeys: number; groundM: number; storeyM: number; bays: number; street: boolean; lengthM: number; base: number }[] = [];
  layoutProbe.sink = (bid, r) => { if (bid === own.properties.id) runs.push(r); };
  let walls: Chunk;
  try { walls = buildFeatureChunk(features as never, 'photo', 'walls', streets, profiles, context as never, [], new Map(), opts as never) as unknown as Chunk; } finally { layoutProbe.sink = undefined; }
  const extras = buildFeatureChunk(features as never, 'photo', 'extras', streets, profiles, context as never) as unknown as Chunk;
  const fid = String(own.properties.id);
  const tris = { walls: ownTris(walls, fid), extras: ownTris(extras, fid) };
  // Build cost of the pand alone (its row as context), median of five.
  const aloneCtx = ctx.neighbors([own], f => f === own || kitHide.has(String(f.properties.id)));
  const aloneStreets = shell.shellStreets(REPO_ROOT, [own] as never), ms: number[] = [];
  for (let k = 0; k < 5; k++) {
    const t0 = performance.now();
    buildFeatureChunk([own] as never, 'photo', 'walls', aloneStreets, profiles, aloneCtx as never, [], new Map(), opts as never);
    buildFeatureChunk([own] as never, 'photo', 'extras', aloneStreets, profiles, aloneCtx as never);
    ms.push(performance.now() - t0);
  }
  const run = runs.filter(r => r.street && r.base < 0.5).sort((a, b) => b.lengthM - a.lengthM)[0];
  const mb = meshBuildingFor(own as never, 'photo') as Record<string, unknown> | null;
  const view = p.houseSpec as Record<string, unknown> | undefined;
  let record: Record<string, unknown> | null = null;
  if (records && walls.record) {
    const input = walls.record.inputs.find(i => i.id === fid);
    if (input && facadeRecordFor) {
      const r = facadeRecordFor(input);
      const keep = ['storeys', 'groundDm', 'upperDm', 'atticDm', 'baysUpper', 'baysGround', 'windowKind', 'windowHead', 'archRing', 'archTop', 'keystone', 'cornice', 'basement', 'souterrain', 'stoop', 'plinthDm', 'bands', 'bandsSrc', 'spekSpacing', 'surround', 'surroundSrc', 'groundKind', 'groundSrc', 'wall', 'wallMaterial', 'wallSrc', 'statedMask', 'wallHcm'];
      record = Object.fromEntries(keep.map(k => [k, r[k]]));
    }
  }
  rows.push({
    pandId: id, label, tris, trisTotal: tris.walls + tris.extras, buildMs: +median(ms).toFixed(2),
    view: view ? Object.fromEntries(Object.entries(view).filter(([k]) => k !== 'src')) : null,
    props: { specRecipe: p.specRecipe ?? null, specShop: p.specShop ?? null, registerFinish: p.registerFinish ?? null, monumentGable: p.monumentGable ?? null },
    drawn: run ? { storeys: run.storeys + 1, columns: run.bays, storeyM: +run.storeyM.toFixed(2), groundM: +run.groundM.toFixed(2), runM: +run.lengthM.toFixed(2) } : null,
    mesh: mb ? { style: mb.style, layers: mb.layers, wallHex: mb.wallHex, shopfront: mb.shopfront } : null,
    record,
  });
}
fs.writeFileSync(out, JSON.stringify({ label, env: { HOUSE_SPECS_DIR: process.env.HOUSE_SPECS_DIR ?? null, records }, rows }, null, 1) + '\n');
console.log(`${label}: ${rows.length} pands -> ${out}`);
