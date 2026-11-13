// Describer D1 twin pass (prompt v2 `sameAs` / `mirrored`): rows where the hand specs show twins.
//
//   node --import tsx scripts/house-specs/describer-d1/twins.ts sample [--neg 1]     build the twin sample + row images
//   node --import tsx scripts/house-specs/describer-d1/twins.ts score [--answers <dir>]
//
// Adjacency: two pands whose archived crop walls (pand-crops/<id>/front.json `wall`) share an end point within 1.5 m. Side: the
// neighbour's wall midpoint against the viewer's right (`-n.y, n.x` for the outward wall normal n). Truth twin: both pands carry
// an author hand spec and their first fronts agree on gable, storeys, upper bays and window kind. Truth mirrored: twins whose door
// index differs (i vs n-1-i on equal ground counts). Sample: every pand of a twin pair, plus `--neg` times as many pands of
// adjacent non-twin pairs. Row image: left neighbour crop | target crop | right neighbour crop, at the archive's common scale,
// bottoms aligned, 6 px grey gaps, an orange bar over the target; artifacts/describer-d1/twin-images/<pandId>.jpg; sample: artifacts/describer-d1/twins.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frontBays, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { twinProblems, type TwinAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { wilson } from '../../../src/canalRecall/houseSpec/describerScore.ts';
import { handSpecFiles } from './truth.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'artifacts/describer-d1');
const CROP_DIRS = (process.env.D1_CROP_DIRS ?? ['/Users/blackmad/Code/map-recall2-source-data-h5h', '/Users/blackmad/Code/map-recall2-source-data-belt-nieuwmarkt-build-20261110', '/Users/blackmad/Code/map-recall2-source-data-belt-burgwallen-oz-build-20261110'].join(':')).split(':');
type P = [number, number];
type Wall = { a: P; b: P; normal: P };

export type Side = 'left' | 'right';
/** Which side of `me` (seen from the street) the neighbour wall lies on. */
export function sideOf(me: Wall, nb: Wall): Side {
  const mid = (w: Wall): P => [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  const [mx, my] = mid(me), [nx, ny] = mid(nb), right: P = [-me.normal[1], me.normal[0]];
  return (nx - mx) * right[0] + (ny - my) * right[1] > 0 ? 'right' : 'left';
}
export const adjacent = (w1: Wall, w2: Wall, tol = 1.5): boolean => [w1.a, w1.b].some(p => [w2.a, w2.b].some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol));

const upper = (f: any) => frontBays(f);
export const designKey = (f: any): string => JSON.stringify([f?.gable, f?.storeys, upper(f), f?.windows]);
const groundCount = (f: any) => (Array.isArray(f?.bays) ? f.bays[0] : f?.bays);
/** Mirrored twins: door indices differ and sit symmetrically on equal ground counts. Undefined when either door is unstated. */
export function mirroredOf(f1: any, f2: any): boolean | undefined {
  if (!Number.isInteger(f1?.doorBay) || !Number.isInteger(f2?.doorBay)) return undefined;
  const n = groundCount(f1);
  if (n !== groundCount(f2) || !n) return undefined;
  return f1.doorBay !== f2.doorBay && f1.doorBay === n - 1 - f2.doorBay;
}

export type TwinRow = { pandId: string; left: { id: string; twin: boolean } | null; right: { id: string; twin: boolean } | null; mirrored: boolean | null; image: string };

function cropDir(id: string): string | null { for (const d of CROP_DIRS) { const p = path.join(d, 'pand-crops', id); if (fs.existsSync(path.join(p, 'front.json'))) return p; } return null; }

async function sample(neg: number) {
  const walls = new Map<string, Wall>();
  const specs = new Map<string, HouseSpec>();
  for (const { spec } of handSpecFiles(ROOT)) if (spec.design.fronts?.length === 1 && !specs.has(spec.pandId)) specs.set(spec.pandId, spec);
  for (const id of specs.keys()) { const d = cropDir(id); if (d) { const w = JSON.parse(fs.readFileSync(path.join(d, 'front.json'), 'utf8')).wall; if (w?.normal) walls.set(id, w); } }
  const ids = [...walls.keys()].sort();
  const nbs = new Map<string, { left?: string; right?: string }>();
  for (const i of ids) for (const j of ids) if (i !== j && adjacent(walls.get(i)!, walls.get(j)!)) (nbs.get(i) ?? nbs.set(i, {}).get(i)!)[sideOf(walls.get(i)!, walls.get(j)!)] = j;
  const f0 = (id: string) => specs.get(id)!.design.fronts![0];
  const rows: TwinRow[] = [];
  const mk = (id: string): TwinRow => {
    const n = nbs.get(id) ?? {};
    const side = (j?: string) => (j ? { id: j, twin: designKey(f0(id)) === designKey(f0(j)) } : null);
    const left = side(n.left), right = side(n.right);
    const twinNb = [left, right].filter(x => x?.twin).map(x => x!.id);
    const m = twinNb.map(j => mirroredOf(f0(id), f0(j))).filter(x => x !== undefined);
    return { pandId: id, left, right, mirrored: m.length ? m.some(Boolean) : null, image: path.join(OUT, 'twin-images', `${id}.jpg`) };
  };
  const all = [...nbs.keys()].map(mk);
  const pos = all.filter(r => r.left?.twin || r.right?.twin), negs = all.filter(r => !(r.left?.twin || r.right?.twin));
  rows.push(...pos, ...negs.filter((_, i) => i % Math.max(1, Math.floor(negs.length / Math.max(1, pos.length * neg))) === 0).slice(0, pos.length * neg));
  fs.mkdirSync(path.join(OUT, 'twin-images'), { recursive: true });
  for (const r of rows) await rowImage(r);
  fs.writeFileSync(path.join(OUT, 'twins.json'), `${JSON.stringify({ v: 1, positives: pos.length, rows }, null, 1)}\n`);
  console.log(`twin rows ${rows.length} (with a twin neighbour ${pos.length}); adjacent hand-spec pands ${all.length}`);
}

/** Left | target | right crops at one height scale (the archive crops share pixelsPerMetre), bottoms aligned. */
async function rowImage(r: TwinRow) {
  const parts = [r.left?.id, r.pandId, r.right?.id].filter(Boolean) as string[];
  const imgs = await Promise.all(parts.map(async id => { const f = path.join(cropDir(id)!, 'front.jpg'); const m = await sharp(f).metadata(); return { f, w: m.width!, h: m.height! }; }));
  const bar = 14, H = Math.max(...imgs.map(i => i.h)) + bar, gap = 6, W = imgs.reduce((s, i) => s + i.w, 0) + gap * (imgs.length - 1);
  let x = 0;
  const comps: sharp.OverlayOptions[] = imgs.map(i => { const c = { input: i.f, left: x, top: H - i.h }; x += i.w + gap; return c; });
  // an orange bar over the target panel (the house to judge), so a two-panel row is unambiguous
  const t = parts.indexOf(r.pandId), tx = imgs.slice(0, t).reduce((s, i) => s + i.w + gap, 0);
  comps.push({ input: { create: { width: imgs[t].w, height: bar, channels: 3, background: { r: 255, g: 140, b: 0 } } }, left: tx, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 } } }).composite(comps).jpeg({ quality: 88 }).toFile(r.image);
}

export type TwinScore = { sides: number; tp: number; fp: number; fn: number; precision: number | null; recall: number | null; precisionCI: [number, number]; recallCI: [number, number]; mirrored: { k: number; n: number; acc: number | null; ci: [number, number] } };
/** Per side: predicted twin on side s iff sameAs is s or both; truth from the hand specs. Mirrored scored on true-twin rows the reader called twins. */
export function scoreTwins(rows: TwinRow[], answers: Map<string, Pick<TwinAnswer, 'readable' | 'sameAs' | 'mirrored'>>): TwinScore {
  let tp = 0, fp = 0, fn = 0, sides = 0, mk = 0, mn = 0;
  for (const r of rows) {
    const a = answers.get(r.pandId);
    if (!a || !a.readable || a.sameAs === 'not-visible') continue;
    for (const s of ['left', 'right'] as const) {
      const t = r[s]; if (!t) continue;
      sides++;
      const said = a.sameAs === s || a.sameAs === 'both';
      if (said && t.twin) tp++; else if (said) fp++; else if (t.twin) fn++;
    }
    if (r.mirrored !== null && (r.left?.twin || r.right?.twin) && a.sameAs !== 'none' && typeof a.mirrored === 'boolean') { mn++; if (a.mirrored === r.mirrored) mk++; }
  }
  const pr = tp + fp ? +(tp / (tp + fp)).toFixed(3) : null, rc = tp + fn ? +(tp / (tp + fn)).toFixed(3) : null;
  return { sides, tp, fp, fn, precision: pr, recall: rc, precisionCI: wilson(tp, tp + fp), recallCI: wilson(tp, tp + fn), mirrored: { k: mk, n: mn, acc: mn ? +(mk / mn).toFixed(3) : null, ci: wilson(mk, mn) } };
}

async function main() {
  const [cmd] = process.argv.slice(2);
  const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  if (cmd === 'sample') return sample(Number(opt('neg') ?? 1));
  if (cmd === 'score') {
    const { rows } = JSON.parse(fs.readFileSync(path.join(OUT, 'twins.json'), 'utf8'));
    const dir = opt('answers') ?? path.join(OUT, 'answers-twins');
    const answers = new Map<string, TwinAnswer>();
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const p = twinProblems(a); if (p.length) throw new Error(`${f}: ${p.join('; ')}`);
      answers.set(a.pandId, a);
    }
    const s = scoreTwins(rows, answers);
    fs.writeFileSync(path.join(OUT, 'twins-score.json'), `${JSON.stringify(s, null, 1)}\n`);
    console.log(JSON.stringify(s, null, 1));
    return;
  }
  console.log('twins.ts sample [--neg 1] | score [--answers <dir>]');
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
