// Describer D1 sample (house plan P1 step 1): every readable pand of the facade benchmark (benchmark-v1.json, 158) plus a
// stratified draw of hand-truth pands that have a square winter crop (hand set v1 reader A, and the author-written hand specs
// under scripts/house-specs/), with the image each is read from. The crop is chosen as describe.ts does (cropCandidates +
// tier.ts bestCrop); a pand outside the six crop manifests uses its archived front.json flags (no judge score: fallback tier).
// A benchmark pand without a crop is read from the benchmark's own pose photo (the photo its labels were read from).
//
//   node --import tsx scripts/house-specs/describer-d1/sample.ts [--hand 150] [--fail-extra 30]
// Writes artifacts/describer-d1/sample.json and copies each image to artifacts/describer-d1/images/<pandId>.jpg.
// Reads the source-data archive only (local crop checkouts, else `git show` from its origin/main and the F4 benchmark branch).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { cropCandidates, loadBag } from '../describe.ts';
import { bestCrop } from '../tier.ts';
import { usability, type CropFlags } from '../../house-crops/flags.ts';
import { judgePath, type JudgeRecord } from '../../house-crops/judge.ts';
import { handSpecFiles } from './truth.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'artifacts/describer-d1');
const SD = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const LOCAL_CROPS = (process.env.D1_CROP_DIRS ?? [
  '/Users/blackmad/Code/map-recall2-source-data-h5h',
  '/Users/blackmad/Code/map-recall2-source-data-belt-nieuwmarkt-build-20261110',
  '/Users/blackmad/Code/map-recall2-source-data-belt-burgwallen-oz-build-20261110',
].join(':')).split(':');
const BENCH_REF = 'refs/heads/lane/facade-f4-benchmark-20261112';
/** Pands the integrator names that no truth set holds (no crop either): read from a named archived photo. Weteringschans
 *  0363100012171218 (the P3a timed drill, house plan review 2026-11-13) has only the wall-colour benchmark v2 photo. */
export const EXTRA: { pandId: string; ref: string; rel: string; group: string; year: number; address: string }[] = [
  { pandId: '0363100012171218', ref: 'refs/heads/lane/wall-colour-benchmark-v2', rel: 'datasets/wall-colour-benchmark-v2-20261112/photos/0363100012171218.jpg', group: 'weteringschans', year: 1877, address: 'Weteringschans (AH07)' },
];
const json = <T = any>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));
const rd = <T,>(p: string, d: T): T => { try { return json<T>(p); } catch { return d; } };
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

const gitShow = (ref: string, rel: string): Buffer | null => {
  try { return execFileSync('/usr/bin/git', ['-C', SD, 'show', `${ref}:${rel}`], { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
};
const originCrops = new Set(execFileSync('/usr/bin/git', ['-C', SD, 'ls-tree', '--name-only', 'origin/main', 'pand-crops/'], { encoding: 'utf8' }).split('\n').map(s => s.split('/')[1]).filter(Boolean));
/** The bytes of pand-crops/<id>/<file> from a local checkout, else origin/main; null when absent. */
function cropBytes(id: string, file: string): Buffer | null {
  for (const d of LOCAL_CROPS) { const p = path.join(d, 'pand-crops', id, file); if (fs.existsSync(p)) return fs.readFileSync(p); }
  return originCrops.has(id) ? gitShow('origin/main', `pand-crops/${id}/${file}`) : null;
}
const hasCrop = (id: string) => originCrops.has(id) || LOCAL_CROPS.some(d => fs.existsSync(path.join(d, 'pand-crops', id, 'front.jpg')));

// crop choice, as describe.ts
const MAN = path.join(ROOT, 'scripts/house-crops/manifests');
const manifests = fs.readdirSync(MAN).filter(f => f.endsWith('.json')).map(f => ({ code: f.replace('.json', ''), m: json(path.join(MAN, f)) }));
function chooseCrop(id: string): { file: string; tier: 'good' | 'fallback' | 'none'; year: number | null; quality: number | null; reasons: string[] } | null {
  const hit = manifests.find(x => id in x.m.pands);
  let cands: { file: string; year: number | null; panoIds: string[]; reasons: string[]; quality: number | null }[] = [];
  if (hit) {
    const judge: Record<string, JudgeRecord> = rd(judgePath(hit.code, 'v1'), {});
    const picks = new Map<string, any>((rd<any>(path.join(ROOT, 'scripts/house-crops/judge', `${hit.code}-picks.json`), { picks: [] }).picks as any[]).map(p => [p.pandId, p]));
    cands = cropCandidates(hit.code, id, hit.m, judge, picks);
  }
  if (!cands.length) {
    const fj = cropBytes(id, 'front.json');
    if (!fj) return null;
    const f = JSON.parse(fj.toString('utf8'));
    cands = [{ file: 'front.jpg', year: f.chosenYear ?? null, panoIds: (f.panoramas ?? []).map((p: any) => p.panoId), reasons: f.flags ? usability(f.flags as CropFlags).reasons : [], quality: null }];
  }
  const best = bestCrop(cands);
  if (best) return { file: best.crop.file, tier: best.tier as 'good' | 'fallback', year: best.crop.year, quality: best.crop.quality, reasons: best.crop.reasons };
  // every candidate fails a hard flag: describe.ts would read nothing; D1 still reads the least-flagged one (scored in the gate-fail column)
  const c = [...cands].sort((a, b) => a.reasons.length - b.reasons.length || (b.year ?? 0) - (a.year ?? 0))[0];
  return c ? { file: c.file, tier: 'none', year: c.year, quality: c.quality, reasons: c.reasons } : null;
}

/** The image columns [x0, x1] the pand's wall (pose.json `wall.a`/`wall.b`, RD metres) spans in a pose photo (pinhole, heading
 *  `pose.headingDeg`, horizontal fov `hfovDeg`, width `pose.width`). */
export function wallSpanPx(pose: any): [number, number] {
  const W = pose.pose.width, half = Math.tan((pose.hfovDeg * Math.PI) / 360), c = pose.pose.rd;
  const px = (q: { x: number; y: number }) => {
    let rel = (Math.atan2(q.x - c.x, q.y - c.y) * 180) / Math.PI - pose.pose.headingDeg;
    rel = ((rel + 540) % 360) - 180;
    return W / 2 + (W / 2) * (Math.tan((rel * Math.PI) / 180) / half);
  };
  const xs = [px(pose.wall.a), px(pose.wall.b)].sort((a, b) => a - b);
  return [xs[0], xs[1]];
}
/** Cut the pose photo to the pand's wall span plus a margin of 30 % of the span each side, so the target is the middle of the
 *  image and the neighbours show at both edges (row tone and coherence, the labels' "against the neighbours"); full height kept. */
export async function cutToWall(photo: Buffer, pose: any): Promise<Buffer> {
  const meta = await sharp(photo).metadata(), W = meta.width!, H = meta.height!;
  const [a, b] = wallSpanPx(pose), m = Math.max(24, (b - a) * 0.3);
  const left = Math.max(0, Math.floor(a - m)), right = Math.min(W, Math.ceil(b + m));
  if (right - left < 40) return photo;
  return sharp(photo).extract({ left, top: 0, width: right - left, height: H }).jpeg({ quality: 90 }).toBuffer();
}

export type SampleRow = {
  pandId: string; set: 'benchmark' | 'hand-set' | 'hand-spec' | 'extra'; group: string; year: number | null; address: string | null;
  /** gate: `pass` when the crop breaks no usability threshold (house-crops/flags.ts, the pixel gate), `fail` otherwise; null for a photo. */
  image: { ref: string; kind: 'crop' | 'pose-photo'; tier: 'good' | 'fallback' | 'none' | null; year: number | null; gate: 'pass' | 'fail' | null; reasons?: string[]; local: string };
};

/** Every n-th of a list sorted by year, so a draw spans the build years (deterministic). */
export function spread<T extends { year: number | null; pandId: string }>(rows: T[], n: number): T[] {
  const s = [...rows].sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.pandId.localeCompare(b.pandId));
  if (n >= s.length) return s;
  return Array.from({ length: n }, (_, i) => s[Math.floor(((i + 0.5) * s.length) / n)]);
}

async function main() {
  const handN = Number(arg('hand', '150'));
  const bag = loadBag();
  const yearOf = (id: string) => bag.get(id)?.year ?? null;
  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });
  const rows: SampleRow[] = [];
  const poseCuts: { local: string; pose: Buffer | null }[] = [];
  const place = (pandId: string, set: SampleRow['set'], group: string, year: number | null, address: string | null, allowPose: boolean): boolean => {
    const local = path.join(OUT, 'images', `${pandId}.jpg`);
    const c = hasCrop(pandId) ? chooseCrop(pandId) : null;
    if (c) {
      const rel = c.file === 'front.jpg' ? 'front.jpg' : c.file.replace(/^.*pand-crops\/\d{16}\//, '');
      const bytes = cropBytes(pandId, rel) ?? cropBytes(pandId, 'front.jpg');
      if (bytes) {
        fs.writeFileSync(local, bytes);
        rows.push({ pandId, set, group, year, address, image: { ref: `source-data://pand-crops/${pandId}/${rel}`, kind: 'crop', tier: c.tier, year: c.year, gate: c.reasons.length ? 'fail' : 'pass', reasons: c.reasons, local } });
        return true;
      }
    }
    if (!allowPose) return false;
    const rel = `experiments/facade-benchmark/round-0/frames/${pandId}/photo.jpg`;
    const bytes = gitShow(BENCH_REF, rel);
    if (!bytes) return false;
    fs.writeFileSync(local, bytes);
    poseCuts.push({ local, pose: gitShow(BENCH_REF, rel.replace('photo.jpg', 'pose.json')) });
    rows.push({ pandId, set, group, year, address, image: { ref: `source-data://${rel}`, kind: 'pose-photo', tier: null, year: null, gate: null, local } });
    return true;
  };
  // 1. the benchmark: all readable pands
  for (const p of json(path.join(ROOT, 'scripts/house-line/benchmark/benchmark-v1.json')).pands) {
    if (!p.readable) continue;
    if (!place(p.pandId, 'benchmark', p.group, p.buildYear ?? yearOf(p.pandId), p.addresses?.[0] ?? null, true)) console.warn('no image', p.pandId);
  }
  for (const x of EXTRA) {
    if (rows.some(r => r.pandId === x.pandId)) continue;
    if (place(x.pandId, 'extra', x.group, x.year, x.address, false)) continue;
    const bytes = gitShow(x.ref, x.rel);
    if (!bytes) { console.warn('no image', x.pandId); continue; }
    const local = path.join(OUT, 'images', `${x.pandId}.jpg`);
    fs.writeFileSync(local, bytes);
    poseCuts.push({ local, pose: gitShow(x.ref, x.rel.replace('/photos/', '/poses/').replace('.jpg', '.w1.json')) });
    rows.push({ pandId: x.pandId, set: 'extra', group: x.group, year: x.year, address: x.address, image: { ref: `source-data://${x.rel}`, kind: 'pose-photo', tier: null, year: null, gate: null, local } });
  }
  const taken = new Set(rows.map(r => r.pandId));
  // 2. hand truth with a crop: hand set v1 (single, readable) and author hand specs, grouped by source, drawn by year
  const pool = new Map<string, { pandId: string; year: number | null; address: string | null; set: SampleRow['set'] }[]>();
  const add = (g: string, x: { pandId: string; year: number | null; address: string | null; set: SampleRow['set'] }) => { if (!taken.has(x.pandId) && hasCrop(x.pandId)) (pool.get(g) ?? pool.set(g, []).get(g)!).push(x); };
  for (const p of json(path.join(ROOT, 'data/house-line/hand-set-v1.json')).pands) if (p.readable && p.extent !== 'multi') add('hand-set', { pandId: p.pandId, year: yearOf(p.pandId), address: null, set: 'hand-set' });
  const seen = new Set<string>();
  for (const { file, spec } of handSpecFiles(ROOT)) {
    if (seen.has(spec.pandId)) continue; seen.add(spec.pandId);
    add(path.relative(path.join(ROOT, 'scripts/house-specs'), file).split('/')[0], { pandId: spec.pandId, year: spec.facts?.facadeYear ?? yearOf(spec.pandId), address: spec.address ?? null, set: 'hand-spec' });
  }
  // a pand in both the hand set and a hand spec stays in the hand set only
  const inHandSet = new Set((pool.get('hand-set') ?? []).map(x => x.pandId));
  for (const [g, xs] of pool) if (g !== 'hand-set') pool.set(g, xs.filter(x => !inHandSet.has(x.pandId)));
  const total = [...pool.values()].reduce((s, xs) => s + xs.length, 0);
  console.log('hand pool', Object.fromEntries([...pool].map(([g, xs]) => [g, xs.length])), 'total', total);
  for (const [g, xs] of pool) {
    const n = Math.max(Math.min(8, xs.length), Math.round((handN * xs.length) / total));
    let got = 0;
    for (const x of spread(xs, Math.min(xs.length, n + 4))) { if (got >= n) break; if (place(x.pandId, x.set, g, x.year, x.address, false)) got++; }
  }
  for (const c of poseCuts) if (c.pose) fs.writeFileSync(c.local, await cutToWall(fs.readFileSync(c.local), JSON.parse(c.pose.toString('utf8'))));
  // gate-fail top-up (plan B item 1): the remaining hand-truth pands whose chosen crop breaks a usability threshold, up to --fail-extra
  const failExtra = Number(arg('fail-extra', '30'));
  let added = 0;
  for (const [g, xs] of pool) for (const x of spread(xs, xs.length)) {
    if (added >= failExtra) break;
    if (rows.some(r => r.pandId === x.pandId)) continue;
    const c = chooseCrop(x.pandId);
    if (c && c.reasons.length && place(x.pandId, x.set, g, x.year, x.address, false)) added++;
  }
  const out = { v: 1, date: new Date().toISOString().slice(0, 10), n: rows.length, bySet: count(rows.map(r => r.set)), byImage: count(rows.map(r => `${r.image.kind}/${r.image.tier}/${r.image.gate}`)), byGroup: count(rows.map(r => r.group)), rows };
  fs.writeFileSync(path.join(OUT, 'sample.json'), `${JSON.stringify(out, null, 1)}\n`);
  console.log(JSON.stringify({ n: out.n, bySet: out.bySet, byImage: out.byImage, byGroup: out.byGroup }));
}
const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});

if (import.meta.url === `file://${process.argv[1]}`) await main();
