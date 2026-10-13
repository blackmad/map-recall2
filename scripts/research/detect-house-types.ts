/**
 * Research prototype (2026-10-10): find repeated house TYPES along a block face from the rectified strip that
 * scripts/block-face/intake.ts writes, before anyone authors an intent. Not a gate; prints a report only.
 *
 *   node --import tsx scripts/research/detect-house-types.ts --face=nassau-162289 [--body=4.5,13.5] [--crown=13.5,20] [--module=6.2] [--threshold=0.6]
 *
 * Unit = a house MODULE, not a BAG pand: a pand wider than 1.5 modules is split into round(width / module) equal
 * modules (De Clercqstraat 16-18 is one 17.9 m pand of three fronts). For each module it crops two bands of the strip,
 * the BODY (upper storeys, default 4.5-13.5 m above the shared ground: above shopfronts / bel-etage, below the
 * cornice) and the CROWN (cornice to sky), turns each into a zero-mean unit-variance 16x40 grey thumbnail and scores
 * pairs by normalised cross-correlation, also against the mirrored crop (so mirror-image neighbours match). Modules
 * are linked when body NCC >= threshold and widths agree within 0.4 m; clusters = connected components (body types).
 * Within a body type, crowns are clustered the same way (crown variants). The ground storey is deliberately ignored:
 * on a shop street every ground floor differs while the uppers repeat.
 */
import fs from 'node:fs';
import sharp from 'sharp';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const face = arg('face') ?? 'nassau-162289';
const [b0, b1] = (arg('body') ?? '4.5,13.5').split(',').map(Number);
const [c0, c1] = (arg('crown') ?? '13.5,20').split(',').map(Number);
const moduleM = Number(arg('module') ?? 6.2), threshold = Number(arg('threshold') ?? 0.6), crownThreshold = Number(arg('crown-threshold') ?? 0.5);
const strip = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/strip.json`, 'utf8'));
const uses = fs.existsSync(`scripts/block-face/faces/${face}/uses.json`) ? JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/uses.json`, 'utf8')) : null;
const img = `staging/block-face/${face}/strip.jpg`;
const {height} = await sharp(img).metadata() as {height: number};
const ppm: number = strip.pixelsPerMetre;
const W = 16, H = 40;

interface Mod { label: string; pand: string; x0: number; x1: number; widthM: number; body: Float64Array; bodyMirror: Float64Array; crown: Float64Array; crownMirror: Float64Array }
const norm = (a: Float64Array) => { const m = a.reduce((s, x) => s + x, 0) / a.length; const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) || 1; return a.map(x => (x - m) / sd); };
const mirror = (a: Float64Array, w: number, h: number) => { const o = new Float64Array(a.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = a[y * w + (w - 1 - x)]; return o; };
const ncc = (a: Float64Array, b: Float64Array) => a.reduce((s, x, i) => s + x * b[i], 0) / a.length;
async function thumb(x0: number, x1: number, m0: number, m1: number, h: number) {
  const top = Math.max(0, Math.round(height - m1 * ppm)), bottom = Math.min(height, Math.round(height - m0 * ppm));
  const buf = await sharp(img).extract({left: Math.round(x0), top, width: Math.max(1, Math.round(x1 - x0)), height: Math.max(1, bottom - top)}).greyscale().resize(W, h, {fit: 'fill'}).raw().toBuffer();
  return norm(Float64Array.from(buf));
}
const address = (pand: string) => {
  const u = uses?.pands?.[pand] ?? uses?.[pand];
  const units = u?.bag ?? u?.units ?? [];
  const a = Array.isArray(units) ? units.map((x: any) => x.address ?? x).find((x: any) => typeof x === 'string') : undefined;
  return (a ?? '').replace(/^.*?(\d+\S*)$/, '$1');
};

const mods: Mod[] = [];
for (const s of strip.spans) {
  const w = s.x1M - s.x0M, n = w > 1.5 * moduleM ? Math.round(w / moduleM) : 1;
  for (let k = 0; k < n; k++) {
    const x0 = s.px[0] + (s.px[1] - s.px[0]) * k / n, x1 = s.px[0] + (s.px[1] - s.px[0]) * (k + 1) / n;
    const body = await thumb(x0, x1, b0, b1, H), crown = await thumb(x0, x1, c0, c1, H / 2);
    mods.push({label: `${s.pandId.slice(-6)}${n > 1 ? '/' + (k + 1) : ''}`, pand: s.pandId, x0, x1, widthM: w / n, body, bodyMirror: mirror(body, W, H), crown, crownMirror: mirror(crown, W, H / 2)});
  }
}
const score = (a: Mod, b: Mod, part: 'body' | 'crown') => {
  const direct = ncc(a[part], b[part]), mirrored = ncc(a[part], b[part === 'body' ? 'bodyMirror' : 'crownMirror']);
  return mirrored > direct + 0.05 ? {s: mirrored, mirror: true} : {s: direct, mirror: false};
};
function components(items: number[], linked: (i: number, j: number) => boolean): number[][] {
  const parent = new Map(items.map(i => [i, i])); const find = (i: number): number => parent.get(i) === i ? i : find(parent.get(i)!);
  for (const i of items) for (const j of items) if (i < j && linked(i, j)) parent.set(find(i), find(j));
  const groups = new Map<number, number[]>(); for (const i of items) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  return [...groups.values()];
}
const all = mods.map((_, i) => i);
const bodyTypes = components(all, (i, j) => score(mods[i], mods[j], 'body').s >= threshold && Math.abs(mods[i].widthM - mods[j].widthM) <= 0.4);
console.log(`${face}: ${mods.length} modules from ${strip.spans.length} pands; body band ${b0}-${b1} m, crown ${c0}-${c1} m, NCC >= ${threshold}`);
console.log('body NCC matrix (m = best match is mirrored):');
console.log('        ' + mods.map(m => m.label.slice(0, 6).padStart(7)).join(''));
for (const a of mods) console.log(a.label.padEnd(8) + mods.map(b => { const r = score(a, b, 'body'); return (a === b ? '   -  ' : r.s.toFixed(2).padStart(6)) + (r.mirror && a !== b ? 'm' : ' '); }).join(''));
let covered = 0, letter = 0;
for (const g of bodyTypes.sort((p, q) => q.length - p.length)) {
  if (g.length < 2) continue;
  covered += g.length;
  const crowns = components(g, (i, j) => score(mods[i], mods[j], 'crown').s >= crownThreshold);
  const name = String.fromCharCode(65 + letter++);
  console.log(`type ${name}: ${g.length} modules, width ${Math.min(...g.map(i => mods[i].widthM)).toFixed(2)}-${Math.max(...g.map(i => mods[i].widthM)).toFixed(2)} m; members ${g.map(i => mods[i].label + (score(mods[g[0]], mods[i], 'body').mirror ? '(m)' : '')).join(' ')}`);
  console.log(`   crown variants ${crowns.length}: ${crowns.map(c => '[' + c.map(i => mods[i].label).join(' ') + ']').join(' ')}`);
}
console.log(`singletons: ${bodyTypes.filter(g => g.length < 2).map(g => mods[g[0]].label).join(' ') || 'none'}`);
console.log(`coverage: ${covered}/${mods.length} modules in a repeated body type`);
