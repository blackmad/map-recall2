// The H1b bay gate (#349): for the #348 sample, drawn upper-storey window columns before (no spec) and after (spec
// bays through frontageLayoutScale) against the hand-grid photo counts in bays-gate-photo.json.
//   npx tsx scripts/house-specs/bays-gate.ts [--old-rule]    --old-rule replays the pre-H1b cell rounding (validation)
// Drawn columns = layoutWall's cells x the cell's axes on the pand's street front (reference.json facts.footprint
// .frontWidthM, the longest wall on the nearest road), with the building's own jittered bay scale, as the mesher does.
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT, gameChain, loadTile, ROOT } from '../world/pipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { frontageLayoutScale } from '../../src/canalRecall/streetFacadeRendering.ts';
import { layoutWall } from '../../src/canalRecall/facadeLayout.ts';
import { STYLE_DIMS } from '../../src/canalRecall/facadeCells.ts';

export const HELP = 'bays-gate [--old-rule]: before/after drawn window columns vs hand-grid photo counts for the #348 sample';
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const oldRule = process.argv.includes('--old-rule');
const hash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const photo: Record<string, number | null> = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/house-specs/bays-gate-photo.json'), 'utf8')).photo;
process.env.HOUSE_SPECS = '1'; process.env.HOUSE_SPECS_DIR = 'house-specs';
const chain = gameChain();
const base = path.join(EXTRACT, 'house-specs', '14');
const rows: any[] = [];
for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) for (const r of await loadTile(`${x}/${y.replace('.json.gz', '')}`, chain)) {
  const pand = String(r.raw.properties.id).slice(-16);
  if (!(pand in photo)) continue;
  const ref = JSON.parse(fs.readFileSync(path.join(ROOT, 'staging/pand-reference', pand, 'reference.json'), 'utf8'));
  const front: number = ref.facts.footprint.frontWidthM, view = r.raw.properties.houseSpec as { bays?: number } | undefined;
  const mb = meshBuildingFor(r.styled as never, 'photo' as never)!;
  const axes = mb.openings?.upper?.axes.length ?? 1, nominal = STYLE_DIMS[mb.style].bay;
  const own = mb.layoutScale ?? { bay: 0.88 + hash01(`${mb.id}:bay`) * 0.3, storey: 1, ground: 1 };
  const draw = (scale: { bay: number; storey: number; ground: number }) => layoutWall(mb.style, front, 12, 0.3, true, scale)!.bays * axes;
  let after = draw(own);
  if (view?.bays) {
    if (oldRule) {
      const cells = Math.max(1, Math.round(view.bays / axes));
      after = draw({ ...own, bay: Math.min(1.5, Math.max(0.7, front / cells / nominal)) });
    } else after = draw(frontageLayoutScale(undefined, own, mb.style, front, { bays: view.bays, axesPerCell: axes }));
  }
  rows.push({ pand, photo: photo[pand], bays: view?.bays ?? null, axes, front, before: draw(own), after });
}
rows.sort((a, b) => a.pand.localeCompare(b.pand));
const scored = rows.filter(r => r.photo !== null);
let notWorse = 0, wasBetter = 0, nowBetter = 0, big = 0, bigBefore = 0;
for (const r of scored) {
  const db = Math.abs(r.before - r.photo), da = Math.abs(r.after - r.photo);
  if (da <= db) notWorse++; if (da < db) nowBetter++; if (da > db) wasBetter++;
  if (r.after >= 1.5 * r.photo) big++; if (r.before >= 1.5 * r.photo) bigBefore++;
}
console.log(['pand', 'photo', 'specBays', 'axes', 'frontM', 'before', 'after'].join('\t'));
for (const r of rows) console.log([r.pand, r.photo ?? 'n/s', r.bays ?? '-', r.axes, r.front, r.before, r.after].join('\t'));
console.log(JSON.stringify({ rule: oldRule ? 'old' : 'H1b', scored: scored.length, afterEqualOrCloser: notWorse, pct: +(100 * notWorse / scored.length).toFixed(1), afterCloser: nowBetter, afterFurther: wasBetter, afterAtLeast1p5xPhoto: big, beforeAtLeast1p5xPhoto: bigBefore }));
