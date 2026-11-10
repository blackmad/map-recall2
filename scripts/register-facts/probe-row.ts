// Step 0 probe (lane register-facts, #316): which decoration path a register-pinned row takes.
//   npx tsx scripts/register-facts/probe-row.ts [rceNr ...]
// Default row: Nieuwmarkt 6–22 by the Waag (RCE 3849–3856). For each register point: the footprint
// that contains it, the gable monument-gables.json carries, and the decorated properties the
// game chain (scripts/world/pipeline.ts gameChain) produces: roof kind, eaves, kit, facade.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { gameChain, loadTile } from '../world/pipeline.ts';
import { tileKeyAt } from '../../src/canalRecall/galleryPipeline.ts';

const nrs = process.argv.slice(2).length ? process.argv.slice(2) : ['3849', '3850', '3851', '3852', '3853', '3854', '3855', '3856'];
const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
const gables = JSON.parse(readFileSync('public/data/extracts/amsterdam/monument-gables.json', 'utf8')).buildings as Record<string, string>;
type Ring = number[][];
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const chain = gameChain();
const tiles = new Map<string, Awaited<ReturnType<typeof loadTile>>>();
const KEYS = ['facade', 'facadeStyle', 'constructionYear', 'height', 'roofShape', 'roofShapeTag', 'roofEavesHeightM', 'roofPlanned', 'monumentGable', 'kitRoof', 'kit', 'landmark', 'chunk', 'roofFacts'];
const pick = (p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).filter(([k]) => KEYS.includes(k) || /kit|recipe|canal|gable|roof|lod|front/i.test(k)).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v)?.slice(0, 80) : v]));
for (const nr of nrs) {
  const rec = snap.rce.find((r: any) => r.monumentNumber === nr);
  const pt = rec?.locations.map((l: any) => /Point\s*\(\s*([\d.]+)\s+([\d.]+)/i.exec(l.value)).find(Boolean);
  if (!pt) { console.log(nr, 'no point'); continue; }
  const p = [Number(pt[1]), Number(pt[2])];
  const tile = tileKeyAt(p[0], p[1]);
  if (!tiles.has(tile)) tiles.set(tile, await loadTile(tile, chain));
  const row = tiles.get(tile)!.find(r => { const g: any = r.raw.geometry; return (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((poly: Ring[]) => inside(p, poly[0])); });
  console.log(`\nRCE ${nr}: ${rec.descriptions[0]?.text.slice(0, 90)}`);
  if (!row) { console.log('  no footprint contains the point'); continue; }
  const id = String(row.raw.properties.id);
  console.log(`  pand ${id}  register-pand-link ${JSON.stringify(rec.bagPandIds)}  gable-extract ${gables[id] ?? '-'}`);
  console.log('  raw   ', JSON.stringify(pick(row.raw.properties as any)));
  console.log('  styled', JSON.stringify(pick(row.styled.properties as any)));
}

// Stage 2: what the planner and the mesher make of each styled feature (fine chunk vs coarse/shell).
import { roofPlanForFeature, localOuterRing } from '../../src/canalRecall/roofMesh.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
console.log('\n-- planner / mesher');
for (const rows of tiles.values()) for (const r of rows) {
  const id = String(r.raw.properties.id);
  if (!['0363100012171851', '0363100012171854', '0363100012182849', '0363100012182848', '0363100012182847', '0363100012182858', '0363100012182857'].some(s => id.endsWith(s))) continue;
  const plan = roofPlanForFeature(r.styled as any);
  const ring = localOuterRing((r.styled as any).geometry);
  const fine = meshBuildingFor(r.styled as any, 'photo' as any, false), coarse = meshBuildingFor(r.styled as any, 'photo' as any, true);
  const pr: any = plan?.pieces?.[0]?.rect; console.log(id.slice(-6), `rect len=${pr?.len?.toFixed(1)} wid=${pr?.wid?.toFixed(1)} ang=${pr?.angle !== undefined ? (pr.angle * 180 / Math.PI).toFixed(0) : JSON.stringify(Object.keys(pr ?? {}))} streetRidge=${JSON.stringify((plan as any)?.streetRidge)} streetEnds=${JSON.stringify((plan as any)?.streetEnds)} gableEnds=${JSON.stringify((plan as any)?.pieces?.[0]?.plan?.gableEnds)} sourceCrown=${!!(plan as any)?.sourceCrownFront}`); console.log(id.slice(-6), `pts=${ring?.length} plan=${plan ? `${plan.kind}/${plan.gable}/rise${plan.riseM?.toFixed(1)}/pieces${plan.pieces?.length}` : 'null'} fineRoof=${!!fine?.roof} fineFlatRoof=${!!(fine as any)?.flatRoof} coarseRoof=${!!coarse?.roof}`);
}
