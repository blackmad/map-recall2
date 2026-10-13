/**
 * Z-fight survey: the coplanar-overlap part of the landmark geometry audit (geometryAudit.ts `auditZFight`) over every bespoke
 * landmark GLB and every ordinary-building GLB, ranked by visible overlap.
 *
 *   node --import tsx scripts/landmarks/zfight-survey.ts                  # all models -> artifacts/zfight-audit/{report.json,report.md}
 *   node --import tsx scripts/landmarks/zfight-survey.ts --id=centraal-station[,…]   # print patches for some models
 *   flags: --set=landmarks|ordinary|all (default all), --shard=i/n (parallel runs; merge with --merge), --out=dir, --top=30
 *
 * A patch is one pair of parts facing one way: coplanar (the smaller face within 2 cm of the larger one's plane) or near-coplanar
 * (2-8 cm apart, same facing; 2-3 cm is `tight`). Ranked by coplanar + tight, the overlap that bleeds through in renders with the
 * game projection (zfight-validate.ts). Areas are visible areas (overlap pieces inside another solid are dropped, see auditZFight).
 */
import fs from 'node:fs';
import path from 'node:path';
import {auditZFight, type ZFightPatch, type ZFightResult} from '../../src/canalRecall/landmarks/geometryAudit';
import {loadMaterialSoup} from './material-soup';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MODELS = path.join(ROOT, 'public/canal-drive/models');
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);

export interface SurveyRow {
  id: string; set: 'landmark' | 'ordinary'; file: string; triangles: number; ms: number;
  area: number; nearArea: number; tightArea: number; sameArea: number; hiddenArea: number; pairs: number; nearPairs: number;
  /** area + tightArea: overlap under 3 cm apart, which bleeds through in renders with the game projection (the ranking key and the gate). */
  total: number;
  roofArea: number; wallArea: number;
  worst?: {materials: [string, string]; orientation: string; near: boolean; area: number; gap: number; centre: number[]; min: number[]; max: number[]};
  cause: string;
  patches: Omit<ZFightPatch, 'trisA' | 'trisB' | 'samples'>[];
  error?: string;
}

export function listModels(set: string): {id: string; set: SurveyRow['set']; file: string}[] {
  const out: {id: string; set: SurveyRow['set']; file: string}[] = [];
  if (set !== 'ordinary') {
    const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as {id: string; modelUrl: string}[];
    const sig = JSON.parse(fs.readFileSync(path.join(MODELS, 'signature-landmarks.json'), 'utf8')).models as Record<string, {modelUrl: string}>;
    const all = new Map<string, string>();
    for (const [id, m] of Object.entries(sig)) all.set(id, m.modelUrl);
    for (const c of catalogue) all.set(c.id, c.modelUrl);
    for (const [id, url] of all) {
      const file = path.join(MODELS, url.replace(/^\.\/models\//, ''));
      if (fs.existsSync(file)) out.push({id, set: 'landmark', file});
    }
  }
  if (set !== 'landmarks') {
    const dir = path.join(MODELS, 'ordinary-buildings');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.glb') && !f.includes('.lod')).sort()) out.push({id: f.replace('.glb', ''), set: 'ordinary', file: path.join(dir, f)});
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** One-line guess at the builder pattern behind a patch, for the ranked table. */
export function likelyCause(p: Pick<ZFightPatch, 'near' | 'orientation' | 'materials' | 'gap'>): string {
  const [a, b] = p.materials, same = a === b, glazing = /glass|frame|pane|window/i.test(a + b);
  if (!p.near && same) return `doubled ${p.orientation} face (${a} twice)`;
  if (!p.near) return p.orientation === 'roof' ? `flush roof cap / two roof slabs at one height (${a}/${b})` : p.orientation === 'underside' ? `flush soffits (${a}/${b})` : `flush wall cladding or band on a wall (${a}/${b})`;
  const cm = Math.round(p.gap * 100);
  if (p.orientation === 'roof') return glazing ? `glazing/frame strip floating ${cm} cm over the roof` : `roof overlay ${cm} cm over the roof (${a}/${b})`;
  return glazing ? `window/frame ${cm} cm proud of an unholed wall` : `panel ${cm} cm proud of the ${p.orientation} (${a}/${b})`;
}

export function surveyRow(m: {id: string; set: SurveyRow['set']; file: string}, z: ZFightResult, triangles: number, ms: number): SurveyRow {
  const fights = (p: ZFightPatch) => (!p.near || p.tight) && !p.sameMaterial;
  const w = z.patches.find(fights) ?? z.patches[0];
  return {
    id: m.id, set: m.set, file: path.relative(ROOT, m.file), triangles, ms,
    area: z.area, nearArea: z.nearArea, tightArea: z.tightArea, sameArea: z.sameArea, hiddenArea: z.hiddenArea, pairs: z.pairs, nearPairs: z.nearPairs, total: +(z.area + z.tightArea).toFixed(2),
    roofArea: +z.patches.filter(p => fights(p) && p.orientation !== 'wall').reduce((t, p) => t + p.area, 0).toFixed(2),
    wallArea: +z.patches.filter(p => fights(p) && p.orientation === 'wall').reduce((t, p) => t + p.area, 0).toFixed(2),
    worst: w && {materials: w.materials, orientation: w.orientation, near: w.near, area: w.area, gap: w.gap, centre: w.centre.map(v => +v.toFixed(2)), min: w.min.map(v => +v.toFixed(2)), max: w.max.map(v => +v.toFixed(2))},
    cause: w ? likelyCause(w) : '',
    patches: z.patches.slice(0, 25).map(({trisA: _a, trisB: _b, samples: _s, ...p}) => ({...p, centre: p.centre.map(v => +v.toFixed(2)) as typeof p.centre})),
  };
}

export function markdown(rows: SurveyRow[], top = 30): string {
  const ranked = rows.filter(r => !r.error).sort((a, b) => b.total - a.total);
  const flagged = ranked.filter(r => r.total > 0);
  const lines = ['# Z-fight survey (coplanar + near-coplanar overlap)', '',
    `${rows.length} models (${rows.filter(r => r.set === 'landmark').length} landmarks, ${rows.filter(r => r.set === 'ordinary').length} ordinary), ${flagged.length} with visible fighting overlap, ${ranked.filter(r => r.total > 0.5).length} above the 0.5 m2 new-export gate. Fighting = coplanar (smaller face within 2 cm of the larger one's plane, same facing) + tight (2-3 cm). A material overlapping itself (same m2) cannot show and is listed, not ranked; near (2-8 cm) is listed but not ranked: renders with the game projection never showed 3 cm or more bleed. Areas are visible m2; roof includes undersides.`, '',
    '| # | model | set | fighting m2 | coplanar m2 | 2-3 cm m2 | 2-8 cm m2 | same m2 | pairs | roof m2 | wall m2 | worst material pair | worst at (x, y, z) | likely cause |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...flagged.slice(0, top).map((r, i) => `| ${i + 1} | ${r.id} | ${r.set} | ${r.total} | ${r.area} | ${r.tightArea} | ${r.nearArea} | ${r.sameArea} | ${r.pairs + r.nearPairs} | ${r.roofArea} | ${r.wallArea} | ${r.worst ? `${r.worst.materials.join('/')} (${r.worst.orientation}, ${r.worst.area} m2${r.worst.near ? `, ${Math.round(r.worst.gap * 100)} cm` : ''})` : ''} | ${r.worst ? r.worst.centre.map(v => v.toFixed(1)).join(', ') : ''} | ${r.cause} |`)];
  const errs = rows.filter(r => r.error);
  if (errs.length) lines.push('', '## Unreadable', '', ...errs.map(r => `- ${r.id}: ${r.error}`));
  return lines.join('\n') + '\n';
}

async function main(): Promise<void> {
  const out = path.resolve(ROOT, arg('out') ?? 'artifacts/zfight-audit');
  fs.mkdirSync(out, {recursive: true});
  if (process.argv.includes('--merge')) {
    const rows = fs.readdirSync(out).filter(f => /^shard-\d+\.json$/.test(f)).flatMap(f => JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')) as SurveyRow[]);
    rows.sort((a, b) => b.total - a.total);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({generated: new Date().toISOString(), models: rows}, null, 1));
    fs.writeFileSync(path.join(out, 'report.md'), markdown(rows, Number(arg('top') ?? 30)));
    console.log(`merged ${rows.length} rows -> ${path.relative(ROOT, out)}/report.{json,md}`);
    return;
  }
  let models = listModels(arg('set') ?? 'all');
  const ids = arg('id')?.split(',');
  if (ids) models = models.filter(m => ids.includes(m.id));
  const shard = arg('shard');
  if (shard) { const [i, n] = shard.split('/').map(Number); models = models.filter((_, k) => k % n === i); }
  const rows: SurveyRow[] = [];
  for (const m of models) {
    const t0 = Date.now();
    try {
      const soup = await loadMaterialSoup(m.file);
      const z = auditZFight(soup);
      const row = surveyRow(m, z, soup.indices.length / 3, Date.now() - t0);
      rows.push(row);
      console.log(`${m.id}: ${row.total} m2 (coplanar ${row.area}, tight ${row.tightArea}, near ${row.nearArea}, hidden ${row.hiddenArea}, ${row.pairs + row.nearPairs} pairs, ${row.triangles} tris, ${row.ms} ms)${row.worst ? ` worst ${row.cause} at ${row.worst.centre.join(', ')}` : ''}`);
      if (ids) for (const p of z.patches.slice(0, Number(arg('top') ?? 12))) console.log(`   ${p.near ? 'near' : 'flush'} ${p.orientation} ${p.materials.join('/')} ${p.area} m2 (raw ${p.rawArea}) ${p.pairs} pairs gap ${Math.round(p.gap * 1000)} mm centre ${p.centre.map(v => v.toFixed(1)).join(', ')} box ${p.min.map(v => v.toFixed(1)).join(',')}..${p.max.map(v => v.toFixed(1)).join(',')}`);
    } catch (e) {
      rows.push({id: m.id, set: m.set, file: path.relative(ROOT, m.file), triangles: 0, ms: Date.now() - t0, area: 0, nearArea: 0, hiddenArea: 0, pairs: 0, nearPairs: 0, tightArea: 0, sameArea: 0, total: 0, roofArea: 0, wallArea: 0, cause: '', patches: [], error: String(e).slice(0, 200)});
      console.log(`${m.id}: ERROR ${String(e).slice(0, 200)}`);
    }
  }
  if (ids) return;
  if (shard) { fs.writeFileSync(path.join(out, `shard-${shard.split('/')[0]}.json`), JSON.stringify(rows)); return; }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({generated: new Date().toISOString(), models: rows.sort((a, b) => b.total - a.total)}, null, 1));
  fs.writeFileSync(path.join(out, 'report.md'), markdown(rows, Number(arg('top') ?? 30)));
}

if (process.argv[1]?.endsWith('zfight-survey.ts')) await main();
