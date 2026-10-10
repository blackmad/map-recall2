/**
 * Block-face compile: intent.json + pand facts → one chunk GLB, gates, interference report.
 *
 *   node --import tsx scripts/block-face/compile.ts --face=bilder-081118-155417 [--install]
 *
 * Writes staging/block-face/<face>/{chunk.glb,report.json,manifest-entry.json} and runs the GLB audit
 * (scripts/audit-glb-quality.ts --file). --install (only when every gate and interference check passes,
 * or with --force-install) copies the GLB to public/canal-drive/models/ordinary-buildings/chunks/ and
 * upserts the entry into public/canal-drive/ordinary-buildings-data/chunks.json, replacing any chunk
 * that covers the same pands (e.g. the post-hoc chunk-bilder-081118-x7).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildChunkManifest, type ChunkManifest} from '../../src/canalRecall/streetChunks/manifest.ts';
import {findContacts} from '../../src/canalRecall/streetChunks/party.ts';
import {ringToFrame} from '../../src/canalRecall/buildingRecipe/instances.ts';
import {compileBlockFace} from '../../src/canalRecall/blockFace/compile.ts';
import {validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {FACES, STAGING} from './intake.ts';
import {loadSoup} from '../audit-glb-quality.ts';
import {analyseSoup, DEFAULT_THRESHOLDS} from '../../src/canalRecall/landmarks/glbQuality.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const MODELS = 'public/canal-drive/models/ordinary-buildings/chunks', MANIFEST = 'public/canal-drive/ordinary-buildings-data/chunks.json';

export async function compileFace(faceId: string) {
  const t0 = performance.now();
  const dir = path.join(FACES, faceId), discovery = JSON.parse(await fs.readFile(path.join(dir, 'discovery.json'), 'utf8'));
  const face = validateBlockFace(JSON.parse(await fs.readFile(path.join(dir, 'intent.json'), 'utf8')), discovery.members);
  const facts = new Map<string, BuildingFacts>();
  for (const h of face.houses) facts.set(h.pandId, JSON.parse(await fs.readFile(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8')));
  const name = `face-${faceId}`;
  const result = await compileBlockFace(face, facts, name);
  const out = path.join(STAGING, faceId);
  await fs.mkdir(out, {recursive: true});
  const glbPath = path.join(out, 'chunk.glb');
  await fs.writeFile(glbPath, result.chunk.glb);
  // The shared GLB audit, on what ships.
  let audit: any;
  try { audit = {exit: 0, out: execFileSync('npx', ['tsx', 'scripts/audit-glb-quality.ts', `--file=${glbPath}`], {encoding: 'utf8'}).trim().split('\n').slice(-12)}; }
  catch (e: any) { audit = {exit: e.status, out: String(e.stdout ?? '').trim().split('\n').slice(-12)}; }
  // The audit's hole check does not know party walls: trimming leaves the outline of each covered party wall as an
  // open loop ON the party plane. Classify loops: on a party line (within 6 cm, flat in x) = covered by the neighbour.
  const holes: any = (analyseSoup(await loadSoup(glbPath), DEFAULT_THRESHOLDS as any) as any).holes;
  const frame = {midRD: result.chunk.frame.midRD, uRD: result.chunk.frame.uRD, nRD: result.chunk.frame.nRD};
  const contacts = findContacts(face.houses.map(h => facts.get(h.pandId)!.surveyFootprintPolygonsRD.map(poly => ringToFrame(poly[0], frame) as [number, number][])), 0.05);
  // A loop lies on a party wall when both plan corners of its box are within 8 cm of one shared footprint edge.
  const onContact = (x: number, z: number) => contacts.some(c => { const s = (x - c.ox) * c.dx + (z - c.oz) * c.dz, d = Math.abs((x - c.ox) * -c.dz + (z - c.oz) * c.dx); return d <= 0.08 && s >= c.s0 - 0.1 && s <= c.s1 + 0.1; });
  const onParty = (d: any) => contacts.some(c => [[d.min[0], d.min[2]], [d.max[0], d.max[2]], [d.min[0], d.max[2]], [d.max[0], d.min[2]]].filter(([x, z]) => onContact(x, z)).length >= 2);
  const other = holes.details.filter((d: any) => !onParty(d));
  audit.holes = {loops: holes.loops, onPartyPlanes: holes.details.length - other.length, elsewhere: other.length, largestElsewhereM: other.length ? Math.max(...other.map((d: any) => d.perimeter)) : 0,
    verdict: other.some((d: any) => d.perimeter > DEFAULT_THRESHOLDS.maxHoleLoopPerimeter) ? 'fail' : 'pass (all large loops are trimmed party walls covered by the neighbour)'};
  audit.passWithPartyExemption = audit.exit === 0 || (audit.holes.verdict.startsWith('pass') && audit.out.filter((l: string) => /^\s+FAIL [\w-]+:/.test(l) && !/FAIL holes:/.test(l)).length === 0);
  const entry = buildChunkManifest([result.chunk], n => `./models/ordinary-buildings/chunks/chunk-${n}.glb`).chunks[0];
  const r = result.chunk.report;
  const report = {face: faceId, name, passed: result.passed && audit.passWithPartyExemption, seconds: +((performance.now() - t0) / 1000).toFixed(1),
    triangles: r.triangles, primitives: r.primitives, bytes: r.bytes, gzipBytes: r.gzipBytes,
    ground: {sharedNapM: result.ground.sharedNapM, shiftsM: result.ground.shiftsM, eavesBefore: result.ground.eavesBefore, eavesAfter: result.ground.eavesAfter, groups: result.ground.groups},
    instancing: result.instancing, slitsClosed: result.slitsClosed, perPand: result.perPand, gates: result.gates, interference: result.interference, partyWalls: r.partyWalls, joints: r.joints, warnings: r.warnings, audit,
    order: result.chunk.order, frame: result.chunk.frame, pands: result.chunk.pands.map(p => ({pandId: p.pandId, recipeId: p.recipeId, frontage: p.frontage, triangles: p.triangles, eavesM: p.eavesM}))};
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1) + '\n');
  await fs.writeFile(path.join(out, 'manifest-entry.json'), JSON.stringify(entry, null, 1) + '\n');
  const failed = result.gates.filter(g => !g.pass), bad = result.interference.filter(i => !i.pass);
  console.log(`${name}: ${face.houses.length} houses | ${r.triangles.chunk} tris (per-house ${r.triangles.individual}) | ${r.primitives.chunk} primitives | ${r.bytes.chunk} B (gzip ${r.gzipBytes.chunk}) | ${report.seconds} s`);
  console.log(`  gates: ${failed.length ? 'FAIL ' + failed.map(g => `${g.pand}/${g.id}=${JSON.stringify(g.value)}`).join('; ') : 'all pass'}`);
  const inst = result.instancing;
  console.log(`  instancing plan: ${inst.groups.length} groups (${inst.groups.map(g => g.members.length + 'x ' + g.master.slice(-6)).join(', ') || 'none'}); ${inst.savedTriangles} of ${inst.totalTriangles} tris (${inst.savedPercent} %) would be shared; chunk GLB is NOT instanced (loader contract, see blockFace/instancing.ts)`);
  for (const i of result.interference) console.log(`  ${i.left.slice(-6)}|${i.right.slice(-6)}: gap ${i.frontGapM} m, depth step ${i.frontDepthStepM} m, penetration ${i.penetrationM2.leftIntoRight}/${i.penetrationM2.rightIntoLeft} m2, overhang ${i.detailOverhangM.left}/${i.detailOverhangM.right} m, z-fight ${i.zFightM2} m2 (roof ${i.roofZFightM2}), eaves step ${i.eavesStepM} m (${i.corniceVerdict}) ${i.pass ? 'ok' : 'FAIL'}`);
  console.log(`  cornice groups: ${result.ground.groups.map(g => `${g.pands.map(p => p.slice(-6)).join('+')} spread ${g.spreadM} m ${g.snapped ? 'snapped' : 'NOT snapped'}`).join(' | ')}`);
  if (result.slitsClosed.length) console.log(`  front slits closed: ${result.slitsClosed.map(c => `${c.left.slice(-6)}|${c.right.slice(-6)} ${c.gapM} m`).join(', ')}`);
  console.log(`  glb audit: exit ${audit.exit}; holes ${audit.holes.loops} loops, ${audit.holes.onPartyPlanes} on party planes, ${audit.holes.elsewhere} elsewhere (largest ${audit.holes.largestElsewhereM.toFixed(2)} m) -> ${audit.holes.verdict}`);
  return {report, entry, glbPath, bad};
}

export async function installFace(faceId: string, entry: any, glbPath: string) {
  await fs.mkdir(MODELS, {recursive: true});
  await fs.copyFile(glbPath, path.join(MODELS, `chunk-${entry.name}.glb`));
  const manifest: ChunkManifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8').catch(() => '{"version":1,"chunks":[]}'));
  const mine = new Set<string>(entry.suppress);
  const replaced = manifest.chunks.filter(c => c.id === entry.id || c.suppress.some(s => mine.has(s)));
  manifest.chunks = [...manifest.chunks.filter(c => !replaced.includes(c)), entry];
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`installed ${entry.id} (${faceId}); replaced ${replaced.map(c => c.id).join(', ') || 'nothing'}`);
  return replaced.map(c => c.id);
}

if (process.argv[1]?.endsWith('block-face/compile.ts')) {
  const faceId = arg('face');
  if (!faceId) throw Error('Use --face=<id> [--install]');
  const {report, entry, glbPath} = await compileFace(faceId);
  if (process.argv.includes('--install')) {
    if (!report.passed && !process.argv.includes('--force-install')) { console.log('not installing: gates/interference/audit failed (see report.json)'); process.exit(1); }
    await installFace(faceId, entry, glbPath);
  }
}
