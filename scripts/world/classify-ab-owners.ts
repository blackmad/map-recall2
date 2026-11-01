/**
 * Who owns the pixels that differ between two variants of the world A/B (tests/e2e/world-v1-ab.spec.ts run with
 * AB_CAMERA=fixed AB_OWNERS=1). Per spot, every pixel over the threshold in the colour frames is put in one class:
 *   coverage  - a different owner is visible there (another pand, roof instead of wall, a mesh instead of ground);
 *   chunk     - the same pand/surface, drawn by a different chunk mesh (chunk tiling, cut spans);
 *   shadow    - same owner and chunk, and the frames agree with every light's castShadow off;
 *   shading   - same owner and chunk, and the frames still differ without shadows (material, tint, UV, normal);
 *   edge      - an antialiased owner edge in either code frame (the class of its decodable neighbours is given).
 * Writes <dir>/owners-<spot>.png (the base frame dimmed; coverage red, chunk magenta, shadow blue, shading yellow,
 * edge orange) and <dir>/owners.json (counts per class, and the top owners per class).
 *   node --import tsx scripts/world/classify-ab-owners.ts [--dir=artifacts/world/ab] [--a=default] [--b=world] [--spots=a,b]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { AB_SPOTS } from './abSpots';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const DIR = arg('dir', 'artifacts/world/ab'), A = arg('a', 'default'), B = arg('b', 'world'), THRESHOLD = Number(arg('threshold', '30'));
const SPOTS = arg('spots', '').split(',').filter(Boolean);

type Raw = { data: Buffer; width: number; height: number; channels: number };
const load = async (f: string): Promise<Raw> => { const r = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: r.data, width: r.info.width, height: r.info.height, channels: r.info.channels }; };
const CLASS_RGB: Record<string, [number, number, number]> = { coverage: [255, 40, 40], chunk: [230, 0, 230], shadow: [40, 120, 255], shading: [255, 220, 0], edge: [255, 140, 0] };

function decoder(img: Raw, codes: Record<string, string>) {
  return (i: number): string | null => {
    const o = i * img.channels;
    if (img.data[o + 3] === 0) return 'ground';
    const c = (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2];
    return codes[c] ?? null;
  };
}
/** The pixel's label, or (antialiased edge) the most common decodable label within 2 px, flagged. */
function labelAt(dec: (i: number) => string | null, w: number, h: number, i: number): { label: string; edge: boolean } {
  const own = dec(i);
  if (own) return { label: own, edge: false };
  const x = i % w, y = (i / w) | 0, tally = new Map<string, number>();
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const l = dec(yy * w + xx);
    if (l) tally.set(l, (tally.get(l) ?? 0) + 1);
  }
  const best = [...tally].sort((p, q) => q[1] - p[1])[0];
  return { label: best?.[0] ?? '?', edge: true };
}
const surface = (l: string) => l.startsWith('pand:') ? (l.endsWith('|roof') ? 'roof' : 'wall') : l === 'ground' ? 'ground' : l.startsWith('chunk:') ? 'chunk' : `mesh:${l.slice(5).split('/').filter(Boolean)[0] ?? ''}`;
const pandOf = (l: string) => l.startsWith('pand:') ? l.slice(5).replace(/\|(wall|roof)$/, '') : null;
const top = (m: Map<string, number>, n = 12) => [...m].sort((p, q) => q[1] - p[1]).slice(0, n).map(([k, v]) => ({ owner: k, px: v }));
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

const report: Record<string, any> = {};
for (const spot of AB_SPOTS.filter(s => !SPOTS.length || SPOTS.includes(s.name))) {
  const f = (v: string, pass = '') => `${DIR}/${spot.name}-${v}${pass ? `-${pass}` : ''}.png`;
  if (!existsSync(f(A, 'pand')) || !existsSync(f(B, 'pand'))) { console.warn(`${spot.name}: no owner frames`); continue; }
  const codes = { ...JSON.parse(readFileSync(`${DIR}/owners-${spot.name}-${A}.json`, 'utf8')).codes, ...JSON.parse(readFileSync(`${DIR}/owners-${spot.name}-${B}.json`, 'utf8')).codes };
  const [ca, cb, na, nb, pa, pb, ma, mb] = await Promise.all([f(A), f(B), f(A, 'noshadow'), f(B, 'noshadow'), f(A, 'pand'), f(B, 'pand'), f(A, 'mesh'), f(B, 'mesh')].map(load));
  const { width: w, height: h } = ca, n = w * h;
  const dPa = decoder(pa, codes), dPb = decoder(pb, codes), dMa = decoder(ma, codes), dMb = decoder(mb, codes);
  const diff = (p: Raw, q: Raw, i: number) => { const o = i * p.channels, r = i * q.channels; return Math.abs(p.data[o] - q.data[r]) + Math.abs(p.data[o + 1] - q.data[r + 1]) + Math.abs(p.data[o + 2] - q.data[r + 2]); };
  const out = Buffer.alloc(n * 3), counts: Record<string, number> = { coverage: 0, chunk: 0, shadow: 0, shading: 0, edge: 0 };
  const byClass: Record<string, Map<string, number>> = Object.fromEntries(Object.keys(counts).map(k => [k, new Map()]));
  const bySurface: Record<string, Map<string, number>> = Object.fromEntries(Object.keys(counts).map(k => [k, new Map()]));
  const pands = new Map<string, number>();
  let over = 0, codeFramesDiffer = 0;
  for (let i = 0; i < n; i++) {
    const o = i * ca.channels, g = ((ca.data[o] + ca.data[o + 1] + ca.data[o + 2]) / 3) * 0.35;
    out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = g;
    if (diff(pa, pb, i) || diff(ma, mb, i)) codeFramesDiffer++;
    if (diff(ca, cb, i) <= THRESHOLD) continue;
    over++;
    const la = labelAt(dPa, w, h, i), lb = labelAt(dPb, w, h, i), xa = labelAt(dMa, w, h, i), xb = labelAt(dMb, w, h, i);
    let cls: string, owner: string;
    if (la.label !== lb.label) { cls = 'coverage'; owner = `${la.label} -> ${lb.label}`; }
    else if (xa.label !== xb.label) { cls = 'chunk'; owner = `${la.label}: ${xa.label} -> ${xb.label}`; }
    else { cls = diff(na, nb, i) <= THRESHOLD ? 'shadow' : 'shading'; owner = la.label; }
    if (cls !== 'coverage' && cls !== 'chunk' && (la.edge || lb.edge)) cls = 'edge';
    counts[cls]++;
    bump(byClass[cls], owner);
    bump(bySurface[cls], la.label === lb.label ? surface(la.label) : `${surface(la.label)} -> ${surface(lb.label)}`);
    for (const p of new Set([pandOf(la.label), pandOf(lb.label)])) if (p) bump(pands, p);
    out.set(CLASS_RGB[cls], i * 3);
  }
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toFile(`${DIR}/owners-${spot.name}.png`);
  report[spot.name] = { pixelsOverThreshold: over, codeFramesDiffer, counts,
    bySurface: Object.fromEntries(Object.entries(bySurface).map(([k, m]) => [k, top(m, 8)])),
    topOwners: Object.fromEntries(Object.entries(byClass).map(([k, m]) => [k, top(m)])), topPands: top(pands, 15) };
  console.log(spot.name, JSON.stringify({ over, codeFramesDiffer, counts }));
}
writeFileSync(`${DIR}/owners.json`, JSON.stringify(report, null, 2));
