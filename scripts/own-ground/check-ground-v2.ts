// Ground v2 typed check (lane G2a #372): the pinned seam pair, the frame header, and bake determinism.
import '../world/useBrowserMath.js'; // first: the browser's Math.cos/sin, as the bake and the runtime use
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer';
import { GroundStore, waterTest } from '../../src/canalRecall/ownGround/groundStore.ts';
import { LOD0_OPTIONS, type SurfaceBakeOptions } from '../../src/canalRecall/ownGround/groundPartition.ts';
import { decodeGrd2, frameMismatch, readGrd2Header, type Grd2Decoded } from '../../src/canalRecall/ownGround/groundV2Format.ts';
import { auditCell, compareSeam } from '../../src/canalRecall/ownGround/groundV2Audit.ts';
import { V2_LEVEL_Z } from '../../src/canalRecall/ownGround/groundV2Sources.ts';
import { GROUND_V2_SEAM_PIN, GROUND_V2_SEAM_REGRESSIONS } from '../../src/canalRecall/ownGround/groundV2Places.ts';
import { bakeCellFile, codeDigest, frame } from './groundV2BakeCell.ts';

const PAIRS = [{ ...GROUND_V2_SEAM_PIN, why: 'the seam pin' }, ...GROUND_V2_SEAM_REGRESSIONS];
const HELP = `npm run check:ground-v2 -- [--dir=DIR] [--bake] [--determinism]     (npx tsx scripts/own-ground/check-ground-v2.ts)

The pinned ground v2 seam pairs (groundV2Places GROUND_V2_SEAM_PIN and GROUND_V2_SEAM_REGRESSIONS):
${PAIRS.map(p => `  ${p.a} | ${p.b}  ${p.why}`).join('\n')}
For each: both files' GRD2 headers carry the runtime's frame (origin, transform, scale, version, rect), so the loader
would accept them; every seam vertex on the shared side is identical in both (position, height, normal); no cell has
a crack or an overlap (z-fight or poke-through).
Files come from --dir, else the published public/data/extracts/amsterdam/ground-v2, else artifacts/ground-v2/staging;
with none there it bakes the cells in-process (about a minute per cell).
  --bake          bake the cells in-process even when files exist, and require the bytes equal to the files'
  --determinism   bake every cell twice in-process and require identical bytes (slow)
Exit 1 on any failure.`;
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }
const opt = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);

const ROOT = 'public/data/extracts/amsterdam';
const dirs = [opt('dir'), `${ROOT}/ground-v2`, 'artifacts/ground-v2/staging'].filter((d): d is string => !!d);
const KEYS = [...new Set(PAIRS.flatMap(p => [p.a, p.b]))].sort();
const dir = dirs.find(d => KEYS.every(k => existsSync(join(d, `${k}.lod0.bin.gz`))));
const bakeOpt: SurfaceBakeOptions = { ...LOD0_OPTIONS, tolFlatM: 0.075 };
await MeshoptDecoder.ready;
const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { parks: true, roads: true, rails: true, deterministic: true });
await store.init();

const fails: string[] = [];
const bake = async (k: string) => (await bakeCellFile(store, k, 0, bakeOpt, { kerbBand: true, codeHash: codeDigest(bakeOpt) }))!.fileGz;
const files = new Map<string, Buffer>();
if (dir && !args.includes('--bake')) for (const k of KEYS) files.set(k, readFileSync(join(dir, `${k}.lod0.bin.gz`)));
else {
  console.log(`baking ${KEYS.join(', ')} in-process${dir ? ` (comparing with ${dir})` : ''}…`);
  for (const k of KEYS) {
    const gz = await bake(k); files.set(k, gz);
    if (dir && !gunzipSync(readFileSync(join(dir, `${k}.lod0.bin.gz`))).equals(gunzipSync(gz))) fails.push(`${k}: in-process bake differs from ${dir}`);
  }
}
if (args.includes('--determinism')) for (const k of KEYS) {
  if (!gunzipSync(await bake(k)).equals(gunzipSync(files.get(k)!))) fails.push(`${k}: two bakes differ`);
}

const cells = new Map<string, Grd2Decoded>();
for (const k of KEYS) {
  const bytes = new Uint8Array(gunzipSync(files.get(k)!));
  const why = frameMismatch(readGrd2Header(bytes), frame, store.cellRect(k));
  if (why) fails.push(`${k}: header refused (${why})`);
  cells.set(k, decodeGrd2(bytes, MeshoptDecoder));
}
for (const { a: A, b: B, why } of PAIRS) {
  const [ax, ay] = A.split('_').map(Number), [bx, by] = B.split('_').map(Number);
  const side = bx === ax + 1 && by === ay ? 'east' : bx === ax && by === ay + 1 ? 'north' : null;
  if (!side) { fails.push(`${A} | ${B}: not east/north neighbours`); continue; }
  const s = compareSeam(cells.get(A)!, cells.get(B)!, side, [A, B]);
  console.log(`seam ${A} ${side} ${B} (${why}): ${s.equal}/${s.vertices} identical`);
  if (!s.vertices || s.equal !== s.vertices) fails.push(`seam ${A} | ${B}: ${s.equal}/${s.vertices}${s.firstDiff ? `, first diff ${s.firstDiff}` : ''}`);
}
for (const k of KEYS) {
  const input = await store.cellInput(k, 0);
  const a = auditCell({ cell: cells.get(k)!, relief: input.surface.relief, water: waterTest(input.waterAround.flatMap(g => g.polygons), false), levelZ: V2_LEVEL_Z, step: 1 });
  console.log(`${k}: tri ${a.triangles}, crack ${a.crackM2} m², overlap ${a.overlapM2} m² (z-fight ${a.zFightM2}, poke ${a.pokeM2}), float p99.9 ${a.floatP999Mm} mm`);
  if (a.crackM2) fails.push(`${k}: ${a.crackM2} m² cracks at ${JSON.stringify(a.crackAt.slice(0, 3))}`);
  if (a.overlapM2) fails.push(`${k}: ${a.overlapM2} m² overlap`);
}
console.log(`files: ${dir && !args.includes('--bake') ? dir : 'baked in-process'}`);
if (fails.length) { for (const f of fails) console.error(`FAIL ${f}`); process.exit(1); }
console.log('check-ground-v2: ok');
