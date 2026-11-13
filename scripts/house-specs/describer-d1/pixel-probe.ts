/**
 * D1 pixel-check (lane D1 step 2 gate): what the generic near tier draws for a pand under the current env, measured
 * through the game's own chain and chunk builder (house:preview's PreviewSession + threeBuildingMesh layoutProbe).
 *
 * One process = one condition. Run it four times to compare:
 *   HOUSE_SPECS_DIR unset (published extract, "today") vs HOUSE_SPECS_DIR=staging/house-specs (the AH07 staged parts,
 *   merged by build-house-specs --extra-specs), each with HOUSE_SPEC_DESIGN unset (shipped holds) and =1 (H11 released).
 *
 *   node --import tsx scripts/house-specs/describer-d1/pixel-probe.ts <pandId,...> --label <name> --out <file.json>
 *
 * Per pand: the decorated properties the mesher reads (specRecipe, specShop, registerFinish, monumentGable, the view
 * keys the extract stamped), the drawn street-run grid (storeys incl. ground, window columns, storey/ground metres),
 * and meshBuildingFor's choices (bay layers = the preset, wallHex, shopfront, groundHex).
 */
import '../../world/useBrowserMath.ts';
import fs from 'node:fs';
import { PreviewSession, ROW_M } from '../../house-preview/preview.ts';
import type { Feature } from '../../world/pipeline.ts';
import { shellProfiles, shellStreets } from '../../world/shellBake.ts';
import { buildFeatureChunk, asPolygons, meshBuildingFor } from '../../../src/canalRecall/threeBuildingFeatures.ts';
import { layoutProbe } from '../../../src/canalRecall/threeBuildingMesh.ts';
import { BuildingContextIndex } from '../../../src/canalRecall/buildingContextIndex.ts';
import { KIT_HIDE_IDS } from '../../../src/canalRecall/landmarkKits.ts';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';

const argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(n); return i < 0 ? undefined : argv[i + 1]; };
const pands = (argv.find(a => /^\d{16}(,\d{16})*$/.test(a)) ?? '').split(',').filter(Boolean);
const label = flag('--label') ?? 'run', out = flag('--out');
if (!pands.length || !out) { console.error('pixel-probe.ts <pandId,...> --label <name> --out <file.json>'); process.exit(2); }

const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const full = (id: string) => `NL.IMBAG.Pand.${id}`;

const session = new PreviewSession('photo');
const profiles = shellProfiles(REPO_ROOT);
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
  const runs: { storeys: number; groundM: number; storeyM: number; bays: number; street: boolean; lengthM: number; base: number }[] = [];
  layoutProbe.sink = (bid, r) => { if (bid === own.properties.id) runs.push(r); };
  try { buildFeatureChunk(features as never, 'photo', 'walls', shellStreets(REPO_ROOT, features as never), profiles, context as never, [], new Map(), {}); } finally { layoutProbe.sink = undefined; }
  const run = runs.filter(r => r.street && r.base < 0.5).sort((a, b) => b.lengthM - a.lengthM)[0];
  const mb = meshBuildingFor(own as never, 'photo') as Record<string, unknown> | null;
  const view = p.houseSpec as Record<string, unknown> | undefined;
  rows.push({
    pandId: id, label,
    view: view ? Object.fromEntries(Object.entries(view).filter(([k]) => k !== 'src')) : null,
    props: { specRecipe: p.specRecipe ?? null, specShop: p.specShop ?? null, specStoop: p.specStoop ?? null, registerFinish: p.registerFinish ?? null, monumentGable: p.monumentGable ?? null, historicGable: p.historicGable ?? null, shopKind: p.shopKind ?? null, constructionYear: p.constructionYear ?? null },
    drawn: run ? { storeys: run.storeys + 1, columns: run.bays, storeyM: +run.storeyM.toFixed(2), groundM: +run.groundM.toFixed(2), runM: +run.lengthM.toFixed(2) } : null,
    mesh: mb ? { style: mb.style, layers: mb.layers, wallHex: mb.wallHex, shopfront: mb.shopfront, groundHex: mb.groundHex ?? null, registerFinish: mb.registerFinish ?? null } : null,
  });
}
fs.writeFileSync(out, JSON.stringify({ label, env: { HOUSE_SPECS_DIR: process.env.HOUSE_SPECS_DIR ?? null, HOUSE_SPEC_DESIGN: process.env.HOUSE_SPEC_DESIGN ?? null }, rows }, null, 1) + '\n');
console.log(`${label}: ${rows.length} pands -> ${out}`);
