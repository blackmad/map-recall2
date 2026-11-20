/**
 * Near-black modern walls: triage and corrections (src/canalRecall/buurtProfiles/darkWallRule.ts).
 *
 *   node --import tsx scripts/buurt-profiles/dark-wall-corrections.ts [--samples=a.json,b.json] [--write]
 *
 * For every wall in modern-pand-walls.json at L* < 17, the script finds its panorama sample (sample-panos.ts --modern
 * output, default .cache/pano-samples-modern-r16.json and -r35.json) and re-reads the cached thumbnail's centre box
 * without its dark pixels, any hue (darkWallRule.ts litWallTone). It classifies the reading (artefact / dark / unread / no sample) and, for artefacts, gives
 * the re-read colour calibrated through the population's raw-to-published mapping. The report goes to
 * staging/buurt-profiles/dark-walls.json. `--write` adds the artefact rows to modern-pand-wall-corrections.json; rows
 * already there are kept, hand rows first.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cachedBytes } from '../pand-reference/core.ts';
import { pixelKind } from '../../src/canalRecall/look/brickTone.ts';
import { DARK_WALL_RULE, calibrateByNeighbours, litWallTone, neighbourWall, classifyDarkWall, hexOf, lstar, luma, rgbOf, type Rgb } from '../../src/canalRecall/buurtProfiles/darkWallRule.ts';

const WALLS = 'src/canalRecall/buurtProfiles/modern-pand-walls.json', CORR = 'src/canalRecall/buurtProfiles/modern-pand-wall-corrections.json';
const files = (process.argv.find(a => a.startsWith('--samples='))?.split('=')[1] ?? '.cache/pano-samples-modern-r16.json,.cache/pano-samples-modern-r35.json').split(',');
const walls = JSON.parse(fs.readFileSync(WALLS, 'utf8')).walls as Record<string, string>;
const samples = new Map<string, any>();
for (const f of files) for (const s of JSON.parse(fs.readFileSync(f, 'utf8')).samples) if (!s.skipped && s.wall) samples.set(s.pand, s);
// The population: every measured sample with its published colour, the dark ones left out (they are what is wrong).
const population = [...samples.values()].filter(s => walls[s.pand] && lstar(walls[s.pand].slice(1)) >= DARK_WALL_RULE.maxLstar).map(s => ({ raw: s.wall as Rgb, published: rgbOf(walls[s.pand]), buurt: s.buurt as string, year: Number(s.year), pand: s.pand as string }));

const rows: any[] = [];
for (const [id, code] of Object.entries(walls)) {
  const L = lstar(code.slice(1));
  if (L >= DARK_WALL_RULE.maxLstar) continue;
  const s = samples.get(id);
  if (!s) { rows.push({ id, code, L: +L.toFixed(1), verdict: 'no sample' }); continue; }
  const bytes = await cachedBytes(s.url, '.jpg');
  const { data, info } = await sharp(bytes).extract({ left: 64, top: 48, width: 192, height: 192 }).raw().toBuffer({ resolveWithObject: true });
  let n = 0, dark = 0, sky = 0; const lit: number[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const c: Rgb = [data[i], data[i + 1], data[i + 2]], k = pixelKind(c[0], c[1], c[2]);
    if (k === 'sky' || k === 'burnt') { sky++; continue; }
    if (k === 'leaf') continue;
    n++; if (luma(c) < DARK_WALL_RULE.litLumaMin) dark++; else lit.push(...c);
  }
  const litTone = litWallTone(lit);
  const darkShare = dark / Math.max(1, n), skyShare = sky / (info.width * info.height);
  let verdict = classifyDarkWall(s.wall, litTone, darkShare, skyShare), wall: string | null = null, neighbours = 0;
  if (verdict === 'artefact') wall = code[0] + hexOf(calibrateByNeighbours(litTone!, population));
  if (verdict === 'exposure') {
    const others = population.filter(p => p.buurt === s.buurt && p.pand !== id);
    const nb = neighbourWall(Number(s.year), others);
    neighbours = others.length;
    if (nb) wall = code[0] + hexOf(nb); else verdict = litTone ? 'dark' : 'unread';
  }
  rows.push({ id, code, L: +L.toFixed(1), verdict, raw: s.wall, lit: litTone, darkShare: +darkShare.toFixed(2), skyShare: +skyShare.toFixed(2), wall, neighbours, buurt: s.buurt, year: s.year, url: s.url, captured: s.captured });
}
const count = (v: string) => rows.filter(r => r.verdict === v).length;
fs.mkdirSync('staging/buurt-profiles', { recursive: true });
fs.writeFileSync('staging/buurt-profiles/dark-walls.json', JSON.stringify({ rule: DARK_WALL_RULE, rows }, null, 0));
console.log('near-black', rows.length, 'artefact', count('artefact'), 'exposure', count('exposure'), 'dark', count('dark'), 'unread', count('unread'), 'no sample', count('no sample'));
if (process.argv.includes('--write')) {
  const set = JSON.parse(fs.readFileSync(CORR, 'utf8'));
  let added = 0;
  for (const r of rows) {
    if ((r.verdict !== 'artefact' && r.verdict !== 'exposure') || set.walls[r.id]) continue;
    const why = r.verdict === 'artefact'
      ? `Near-black artefact (darkWallRule.ts, lane fb-placement2 2026-11-20): the warm-pixel mode read shadow/glass at raw rgb(${r.raw.join(',')}); the centre box without its dark pixels (${Math.round((1 - r.darkShare) * 100)} % of it) reads rgb(${r.lit.map(Math.round).join(',')}), calibrated through the ${DARK_WALL_RULE.k} nearest population samples.`
      : `Near-black artefact, sky-exposed (darkWallRule.ts, lane fb-placement2 2026-11-20): ${Math.round(r.skyShare * 100)} % of the centre box is sky, so the facade read near-black at raw rgb(${r.raw.join(',')}) whatever its colour; drawn in the lower-quartile wall of the buurt's ${r.neighbours} other measured modern pands (${r.year}, same decade where 5 or more), by the wall-colour-by-judgement ruling of 2026-11-14.`;
    set.walls[r.id] = { wall: r.wall, measured: r.code, why, source: `Gemeente Amsterdam panorama thumbnail ${r.url} (captured ${r.captured}, CC BY 4.0)` };
    added++;
  }
  const hand = Object.entries(set.walls).filter(([, v]: any) => !String(v.why).startsWith('Near-black artefact'));
  const auto = Object.entries(set.walls).filter(([, v]: any) => String(v.why).startsWith('Near-black artefact')).sort(([a], [b]) => a.localeCompare(b));
  set.walls = Object.fromEntries([...hand, ...auto]);
  fs.writeFileSync(CORR, JSON.stringify(set, null, 2) + '\n');
  console.log('corrections added', added, 'rows now', Object.keys(set.walls).length, path.relative('.', CORR));
}
