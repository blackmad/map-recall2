/**
 * The belt's photo finish reader (lane D round 9, item 3: Singel 167687's stucco drawn as brick).
 *
 *   node --import tsx scripts/belt-look/photo-reads.ts features <cutDir...> <out.json>
 *       wall features per cut (the cyan wall box: luminance median/p75, saturation median, fine-texture median)
 *   node --import tsx scripts/belt-look/photo-reads.ts vote <labelled-features.json> <d1-root> <new-features.json> <cutDir...> --out <vote.json> --ask <ask.txt>
 *       the cheap reader: an 11-nearest-neighbour vote against the D1 tranche's labelled cuts. A unanimous brick vote
 *       stands (77 of 87 on the labelled cuts, leave-one-out); every other cut goes to the vision reader (ask.txt: "<id> <jpg>").
 *   node --import tsx scripts/belt-look/photo-reads.ts assemble <vote.json> <cuts.json...> --vision <reads.txt...> --out <photo-reads.json>
 *       one record per pand: {finish, confidence, reader, w1} for scripts/belt-look/generate.ts (photoFinish).
 *
 * Calibration (60 labelled belt cuts, 20 per finish): opus 56/60 with stucco 20/20 and no false stucco; haiku 25/60, so
 * the vision reader is opus. The Node vote alone is 74 % (stucco recall 19/83), so it only settles plain brick.
 * Writes stay outside the repo or under artifacts/; the reviewed copy is data/buurt-generators/belt/photo-reads.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export interface WallFeatures { lapMed: number; lumMed: number; lumP75: number; satMed: number }
const q = (a: number[], p: number) => { const s = Float64Array.from(a).sort(); return s[Math.floor(p * (s.length - 1))]; };

/** Features of the wall inside the cut's cyan outline (null when no outline is found). */
export async function wallFeatures(file: string): Promise<WallFeatures | null> {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * ch; if (data[i] < 90 && data[i + 1] > 190 && data[i + 2] > 190) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  if (x1 - x0 < 10 || y1 - y0 < 20) return null;
  const bx0 = Math.round(x0 + 0.1 * (x1 - x0)), bx1 = Math.round(x1 - 0.1 * (x1 - x0)), by0 = Math.round(y0 + 0.15 * (y1 - y0)), by1 = Math.round(y0 + 0.75 * (y1 - y0));
  const g = (x: number, y: number) => { const i = (y * W + x) * ch; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
  const lap: number[] = [], lum: number[] = [], sat: number[] = [];
  for (let y = by0 + 1; y < by1 - 1; y++) for (let x = bx0 + 1; x < bx1 - 1; x++) {
    const v = g(x, y), i = (y * W + x) * ch, mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]);
    lum.push(v); sat.push(mx ? (mx - mn) / mx : 0); lap.push(Math.abs(4 * v - g(x - 1, y) - g(x + 1, y) - g(x, y - 1) - g(x, y + 1)));
  }
  if (!lum.length) return null;
  const lo = q(lum, 0.35), hi = q(lum, 0.9), wl = lap.filter((_, k) => lum[k] >= lo && lum[k] <= hi);
  return { lapMed: +q(wl, 0.5).toFixed(2), lumMed: +q(lum, 0.5).toFixed(1), lumP75: +q(lum, 0.75).toFixed(1), satMed: +q(sat, 0.5).toFixed(3) };
}

type Finish = 'stucco' | 'paint' | 'brick';
export const LABEL: Record<string, Finish | undefined> = { stucco: 'stucco', stone: 'stucco', 'painted-brick': 'paint', brick: 'brick' };
const vec = (f: WallFeatures) => [f.lumMed / 40, f.lumP75 / 40, f.satMed / 0.05, f.lapMed / 0.5];

/** The 11-nearest-neighbour vote: the winning finish and its share. */
export function vote(x: number[], train: ReadonlyArray<{ x: number[]; l: Finish }>, k = 11): { finish: Finish; share: number } {
  const d = train.map(t => [t.x.reduce((s, v, i) => s + (v - x[i]) ** 2, 0), t.l] as const).sort((a, b) => a[0] - b[0]).slice(0, k);
  const n = new Map<Finish, number>(); for (const [, l] of d) n.set(l, (n.get(l) ?? 0) + 1);
  const [finish, c] = [...n].sort((a, b) => b[1] - a[1])[0];
  return { finish, share: c / d.length };
}

const rowsOf = (files: string[]) => new Map<string, any>(files.flatMap(f => (JSON.parse(fs.readFileSync(f, 'utf8')).rows as any[]).map(r => [r.pandId, { ...r, dir: path.dirname(f) }] as const)));
const opt = (argv: string[], k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

async function main(argv: string[]) {
  const [mode, ...rest] = argv;
  if (mode === 'features') {
    const out = rest.at(-1)!, res: Record<string, WallFeatures> = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
    for (const dir of rest.slice(0, -1)) for (const f of fs.readdirSync(dir).filter(x => /^\d{16}\.jpg$/.test(x)).sort()) {
      const id = f.slice(0, 16);
      if (!res[id]) { const w = await wallFeatures(path.join(dir, f)); if (w) res[id] = w; }
    }
    fs.writeFileSync(out, JSON.stringify(res)); console.log(`features: ${Object.keys(res).length}`);
  } else if (mode === 'vote') {
    const pos = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
    const [labelled, d1Root, fresh, ...cutDirs] = pos;
    const lf = JSON.parse(fs.readFileSync(labelled, 'utf8')), train: Array<{ x: number[]; l: Finish }> = [];
    for (const f of fs.readdirSync(path.join(d1Root, 'answers-kept'))) {
      const id = f.replace('.json', ''), l = LABEL[JSON.parse(fs.readFileSync(path.join(d1Root, 'answers-kept', f), 'utf8')).finish];
      if (l && lf[id]) train.push({ x: vec(lf[id]), l });
    }
    const ff = JSON.parse(fs.readFileSync(fresh, 'utf8')), out: Record<string, { finish: Finish; share: number }> = {}, ask: string[] = [];
    let n = 0;
    for (const dir of cutDirs) for (const f of fs.readdirSync(dir).filter(x => /^\d{16}\.jpg$/.test(x)).sort()) {
      const id = f.slice(0, 16), v = ff[id] ? vote(vec(ff[id]), train) : null; n++;
      if (v) out[id] = v;
      if (!v || v.finish !== 'brick' || v.share < 1) ask.push(`${id} ${path.join(dir, f)}`);
    }
    fs.writeFileSync(opt(rest, 'out')!, JSON.stringify(out)); fs.writeFileSync(opt(rest, 'ask')!, ask.join('\n') + '\n');
    console.log(`vote: ${Object.keys(out).length} voted, ${n - ask.length} settled as brick, ${ask.length} to the vision reader (train ${train.length})`);
  } else if (mode === 'assemble') {
    const i = rest.indexOf('--vision'), pos = rest.slice(0, i), visionFiles: string[] = [];
    for (let k = i + 1; k < rest.length && !rest[k].startsWith('--'); k++) visionFiles.push(rest[k]);
    const [voteFile, ...cutFiles] = pos, votes = JSON.parse(fs.readFileSync(voteFile, 'utf8')), cuts = rowsOf(cutFiles), reads: Record<string, unknown> = {};
    const vision = new Map<string, { finish: string; confidence: number }>();
    for (const f of visionFiles) for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = l.trim().match(/^(\d{16})\s+(stucco|paint|brick|unclear)\s+([\d.]+)$/); if (m) vision.set(m[1], { finish: m[2], confidence: +m[3] });
    }
    for (const [id, c] of cuts) {
      const v = vision.get(id), nv = votes[id];
      const fin = v ? { finish: v.finish, confidence: v.confidence, reader: 'opus (cut)' } : nv?.finish === 'brick' && nv.share === 1 ? { finish: 'brick', confidence: 0.9, reader: 'node 11-nn vote (unanimous)' } : null;
      const w1 = c.w1?.hex ? { hex: c.w1.hex, L: c.w1.L, C: c.w1.C, h: c.w1.h, n: c.w1.n } : undefined;
      if (fin || w1) reads[id] = { ...(fin ?? {}), ...(w1 ? { w1 } : {}), ...(c.pose?.pano ?? c.pano ? { pano: c.pose?.pano ?? c.pano } : {}) };
    }
    const n = (k: string) => Object.values<any>(reads).filter(r => r.finish === k).length;
    fs.mkdirSync(path.dirname(opt(rest, 'out')!), { recursive: true });
    fs.writeFileSync(opt(rest, 'out')!, JSON.stringify({ at: new Date().toISOString().slice(0, 10), ref: 'lane D round 9: photo finish reader (scripts/belt-look/photo-reads.ts)', reads }, null, 1));
    console.log(`assemble: ${Object.keys(reads).length} pands; stucco ${n('stucco')}, paint ${n('paint')}, brick ${n('brick')}, unclear ${n('unclear')}`);
  } else { console.log('photo-reads.ts features|vote|assemble ...'); process.exit(2); }
}
if (process.argv[1]?.endsWith('belt-look/photo-reads.ts')) await main(process.argv.slice(2));
