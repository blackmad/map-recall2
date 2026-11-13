/**
 * F1 finish hints (#380, coordinator ruling 2026-11-13; src/canalRecall/look/finishHint.ts): Jev's wall-finish answer on
 * archived pand crops, kept as a RENDER HINT (plaster at confidence >= 0.7 only) in its own staging file. Never a fact.
 *
 *   npx tsx scripts/finish-hints/finish-hints.ts --scope            count the in-scope pands, no calls
 *   J2_CACHE=... zsh -lic 'npx tsx scripts/finish-hints/finish-hints.ts --crops=<dir> [--answers=<file>] [--max-calls=n]'
 *
 * Scope: ride-priority gebieden (ridePriority.ts), constructionYear < 1945, generic (no kitWall/replaces/industrial),
 * no house spec and no register finish (those outrank the hint anyway). Crops: `<dir>/<16-digit id>/front.jpg` (the
 * house:crops archive layout, map-recall2-source-data pand-crops/); a pand without one is skipped, nothing is fetched.
 * Answers are cached and resumable (`--answers`, default artifacts/finish-hints/answers.json; archive it with the crops).
 * Output: artifacts/finish-hints/finish-hints-v1.json (staging; publishing it into the extract needs the integrator's ruling).
 * Jev key: TYPESAFE_API_KEY from the user env via `zsh -lic` only; spend is capped by scripts/jev/j2/lib.mjs HARD_CAP_USD.
 */
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildFinishHintFile } from '../../src/canalRecall/look/finishHint.ts';
import { RIDE_PRIORITY_GEBIEDEN } from '../../src/canalRecall/ridePriority.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), EX = path.join(ROOT, 'public/data/extracts/amsterdam');
const args = process.argv.slice(2), value = (n: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3), has = (n: string) => args.includes(`--${n}`);
const STAGE = path.join(ROOT, 'artifacts/finish-hints');

type Ring = number[][];
const inRing = (x: number, y: number, r: Ring) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };

/** In-scope pand ids (full BAG form) with their gebied, from the world-v1 cells. */
export async function scopeIds(): Promise<Map<string, string>> {
  await import('../world/useBrowserMath.ts');
  const { decodeCell, rawFeature, styledFeature } = await import('../../src/canalRecall/world/cellFormat.ts');
  const { readGlobalStrings } = await import('../world/cellFiles.ts');
  const W = path.join(EX, 'world-v1'), g = readGlobalStrings(W);
  const buurten = JSON.parse(fs.readFileSync(path.join(EX, 'coverage-v1/buurten.json'), 'utf8')).features.filter((f: any) => RIDE_PRIORITY_GEBIEDEN.has(f.properties.gebied));
  const box = buurten.map((f: any) => { const r: Ring = f.geometry.coordinates[0]; return [Math.min(...r.map(p => p[0])), Math.min(...r.map(p => p[1])), Math.max(...r.map(p => p[0])), Math.max(...r.map(p => p[1]))]; });
  const specs = new Set<string>(), base = path.join(EX, 'house-specs/14');
  for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x)))
    for (const id of Object.keys(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(base, x, y))).toString()).buildings ?? {})) specs.add(id);
  const out = new Map<string, string>();
  for (const f of fs.readdirSync(path.join(W, 'cells'))) {
    let bytes = fs.readFileSync(path.join(W, 'cells', f)); try { bytes = zlib.gunzipSync(bytes); } catch { /* raw */ }
    for (const b of decodeCell(new Uint8Array(bytes), f, g).buildings) {
      const p = styledFeature(b, rawFeature(b)).properties as Record<string, any>;
      const y = Number(p.constructionYear); if (!(y > 1000 && y < 1945) || p.kitWall || p.replaces || p.industrial) continue;
      const id = String(p.id); if (specs.has(id) || p.registerFinish === 'light' || p.registerFinish === 'brick') continue;
      const geom = b.geometry as any, ring: Ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
      const cx = ring.reduce((a, q) => a + q[0], 0) / ring.length, cy = ring.reduce((a, q) => a + q[1], 0) / ring.length;
      const k = buurten.findIndex((bu: any, i: number) => cx >= box[i][0] && cx <= box[i][2] && cy >= box[i][1] && cy <= box[i][3] && inRing(cx, cy, bu.geometry.coordinates[0]));
      if (k >= 0) out.set(id, buurten[k].properties.gebied);
    }
  }
  return out;
}

async function main() {
  const scope = await scopeIds(), byG: Record<string, number> = {};
  for (const gb of scope.values()) byG[gb] = (byG[gb] ?? 0) + 1;
  const crops = value('crops'), short = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
  const withCrop = crops ? [...scope.keys()].filter(id => fs.existsSync(path.join(crops, short(id), 'front.jpg'))) : [];
  console.log(JSON.stringify({ inScope: scope.size, byGebied: byG, withCrop: withCrop.length }));
  if (has('scope') || !crops) return;
  const { askJev, prepImage, pool, HARD_CAP_USD } = await import('../jev/j2/lib.mjs');
  const Q = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/houseSpec/writers/fixtures/jev-questions.json'), 'utf8')).questions.finish;
  const ANS = path.resolve(value('answers') ?? path.join(STAGE, 'answers.json')), TMP = path.join(STAGE, 'img');
  fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(path.dirname(ANS), { recursive: true });
  const answers: Record<string, any> = fs.existsSync(ANS) ? JSON.parse(fs.readFileSync(ANS, 'utf8')) : {};
  const todo = withCrop.filter(id => !answers[short(id)]?.choice), max = Number(value('max-calls') ?? 1000);
  console.log(`asking ${Math.min(todo.length, max)} of ${todo.length} (cap $${HARD_CAP_USD})`);
  let calls = 0;
  await pool(todo, 4, async (id: string) => {
    if (calls >= max) return;
    const img = path.join(TMP, `${short(id)}.jpg`);
    if (!(await prepImage(path.join(crops, short(id), 'front.jpg'), img))) { answers[short(id)] = { skip: 'size' }; return; }
    calls++;
    const r = await askJev({ images: { facade: img }, questions: { finish: Q }, note: 'Amsterdam street-level panorama crop of one house front, rectified.', family: 'f1-finish-hint' });
    const a = r.body?.answers?.finish;
    answers[short(id)] = r.status === 200 && a ? { choice: a.choice, confidence: a.confidence, probabilities: a.probabilities, tokens: r.tokens } : { error: r.status };
    fs.writeFileSync(ANS, JSON.stringify(answers, null, 1));
  });
  fs.writeFileSync(ANS, JSON.stringify(answers, null, 1));
  const file = buildFinishHintFile(answers, id => scope.has(id), new Date().toISOString().slice(0, 10));
  fs.writeFileSync(path.join(STAGE, 'finish-hints-v1.json'), JSON.stringify(file, null, 1) + '\n');
  const by: Record<string, number> = {};
  for (const v of Object.values<any>(answers)) if (v.choice) by[v.choice] = (by[v.choice] ?? 0) + 1;
  console.log(JSON.stringify({ calls, answered: Object.values<any>(answers).filter(v => v.choice).length, by, hints: Object.keys(file.hints).length, out: path.join(STAGE, 'finish-hints-v1.json') }));
}
await main();
