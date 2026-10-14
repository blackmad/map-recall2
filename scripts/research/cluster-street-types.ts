/**
 * Street-wide house-type clustering (Kinkerstraat type library, 2026-10-14). `detect-house-types.ts` clusters the
 * modules of ONE face; a district type library needs the bodies and crowns compared across every face of a street.
 *
 *   node --import tsx scripts/research/cluster-street-types.ts --street=kinkerstraat [--module=4.5] [--cut=0.42] [--prefix=kinker-]
 *
 * Unit = a house module (a pand wider than 1.5 modules is split into round(width / module) equal modules, as in
 * detect-house-types). Per module, from the face's rectified strip:
 *   - BODY: 4.4 m (over the shop storey) to 1 m under the pand's surveyed eaves, as a zero-mean unit-variance 16x40
 *     grey thumbnail (eaves differ per pand, so the band is normalised to the pand's own storeys);
 *   - CROWN: eaves - 1.2 m to eaves + 4 m, 16x16;
 *   - colour: the pand's strip-palette medians (palette-from-strip.ts): wall lightness/saturation, accent share, band runs.
 * Distance = (1 - body NCC)/2 (best of direct and mirrored) + 0.6 x colour distance (|dL| x 2 + |dS| + |d accent| x 2).
 * Clusters = average-linkage agglomeration cut at `--cut`. Then every pand is ASSIGNED to the nearest library type
 * (`scripts/block-face/types/<district>/<prefix>*.json`, exemplars = the pands in each type's `evidence`), restricted
 * by build year (>= 1970: infill types, whose id contains a year >= 1970; else the historic types), with the body NCC
 * against the type's exemplars. A grey placeholder span (no photo) is reported as `no strip`.
 *
 * Writes staging/street-types/<street>/clusters.json and clusters.md (a table per face: pand -> cluster, type, NCC).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {faceStripPalettes, type PandPalette} from '../block-face/palette-from-strip.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const street = arg('street') ?? 'kinkerstraat', moduleM = Number(arg('module') ?? 4.5), cut = Number(arg('cut') ?? 0.42), prefix = arg('prefix') ?? 'kinker-';
const survey = JSON.parse(fs.readFileSync(`scripts/street-surveys/streets/${street}.json`, 'utf8'));
const byPand = new Map<string, any>(survey.pands.map((p: any) => [p.pandId, p]));
const FACES = 'scripts/block-face/faces', W = 16, HB = 40, HC = 16;

interface Mod { face: string; pand: string; label: string; k: number; n: number; widthM: number; body: Float64Array; bodyM: Float64Array; crown: Float64Array; crownM: Float64Array; pal: PandPalette; void: number }
const norm = (a: Float64Array) => { const m = a.reduce((s, x) => s + x, 0) / a.length; const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) || 1; return a.map(x => (x - m) / sd); };
const mirror = (a: Float64Array, h: number) => { const o = new Float64Array(a.length); for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) o[y * W + x] = a[y * W + (W - 1 - x)]; return o; };
const ncc = (a: Float64Array, b: Float64Array) => a.reduce((s, x, i) => s + x * b[i], 0) / a.length;

const faces = [...new Set<string>(survey.pands.map((p: any) => p.face).filter(Boolean))].filter(f => fs.existsSync(path.join(FACES, f, 'strip.json')) && fs.existsSync(`staging/block-face/${f}/strip.jpg`)).sort();
const mods: Mod[] = [];
for (const face of faces) {
  const strip = JSON.parse(fs.readFileSync(path.join(FACES, face, 'strip.json'), 'utf8')), img = `staging/block-face/${face}/strip.jpg`;
  const {data, info} = await sharp(img).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const pals = await faceStripPalettes(face, byPand), ppm: number = strip.pixelsPerMetre;
  const grey = (x0: number, x1: number, m0: number, m1: number, h: number) => {
    const top = Math.max(0, Math.round(info.height - m1 * ppm)), bottom = Math.min(info.height, Math.round(info.height - m0 * ppm));
    const out = new Float64Array(W * h); let voids = 0, total = 0;
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < W; tx++) {
      let s = 0, c = 0;
      const ya = top + Math.floor((bottom - top) * ty / h), yb = top + Math.floor((bottom - top) * (ty + 1) / h), xa = Math.floor(x0 + (x1 - x0) * tx / W), xb = Math.floor(x0 + (x1 - x0) * (tx + 1) / W);
      for (let y = ya; y < Math.max(yb, ya + 1); y++) for (let x = xa; x < Math.max(xb, xa + 1); x++) {
        const i = (y * info.width + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
        total++; if (Math.abs(r - 128) <= 2 && Math.abs(g - 128) <= 2 && Math.abs(b - 128) <= 2) voids++;
        s += 0.299 * r + 0.587 * g + 0.114 * b; c++;
      }
      out[ty * W + tx] = s / Math.max(1, c);
    }
    return {t: norm(out), voidShare: voids / Math.max(1, total)};
  };
  strip.spans.forEach((s: any, i: number) => {
    const w = s.x1M - s.x0M, n = w > 1.5 * moduleM ? Math.round(w / moduleM) : 1, pal = pals[i];
    for (let k = 0; k < n; k++) {
      const x0 = s.px[0] + (s.px[1] - s.px[0]) * k / n, x1 = s.px[0] + (s.px[1] - s.px[0]) * (k + 1) / n;
      const b = grey(x0, x1, 4.4, pal.eavesM - 1, HB), c = grey(x0, x1, pal.eavesM - 1.2, pal.eavesM + 4, HC);
      mods.push({face, pand: s.pandId, label: `${s.pandId.slice(-6)}${n > 1 ? '/' + (k + 1) : ''}`, k, n, widthM: w / n, body: b.t, bodyM: mirror(b.t, HB), crown: c.t, crownM: mirror(c.t, HC), pal, void: b.voidShare});
    }
  });
}
const live = mods.filter(m => m.void < 0.3 && m.pal.wallHsl);
const bodyNcc = (a: Mod, b: Mod) => Math.max(ncc(a.body, b.body), ncc(a.body, b.bodyM));
const crownNcc = (a: Mod, b: Mod) => Math.max(ncc(a.crown, b.crown), ncc(a.crown, b.crownM));
const colourD = (a: Mod, b: Mod) => { const p = a.pal.wallHsl!, q = b.pal.wallHsl!; return Math.abs(p[2] - q[2]) * 2 + Math.abs(p[1] - q[1]) + Math.abs(a.pal.shares.accent - b.pal.shares.accent) * 2; };
const dist = (a: Mod, b: Mod) => (1 - bodyNcc(a, b)) / 2 + 0.6 * colourD(a, b);

// Average-linkage agglomeration (n ~ 400: a plain O(n^3) loop is fine).
const N = live.length, D = Array.from({length: N}, (_, i) => Float64Array.from({length: N}, (_, j) => i === j ? 0 : dist(live[i], live[j])));
let clusters = live.map((_, i) => [i]);
const link = (a: number[], b: number[]) => { let s = 0; for (const i of a) for (const j of b) s += D[i][j]; return s / (a.length * b.length); };
for (;;) {
  let best = Infinity, bi = -1, bj = -1;
  for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) { const d = link(clusters[i], clusters[j]); if (d < best) { best = d; bi = i; bj = j; } }
  if (best > cut || bi < 0) break;
  clusters[bi] = [...clusters[bi], ...clusters[bj]]; clusters.splice(bj, 1);
}
clusters = clusters.sort((p, q) => q.length - p.length);
const clusterOf = new Map<Mod, string>(), medoid = new Map<string, Mod>();
clusters.forEach((c, k) => {
  const id = c.length > 1 ? `C${String(k + 1).padStart(2, '0')}` : 'single';
  const med = c.reduce((b, i) => (c.reduce((s, j) => s + D[i][j], 0) < c.reduce((s, j) => s + D[b][j], 0) ? i : b), c[0]);
  if (c.length > 1) medoid.set(id, live[med]);
  c.forEach(i => clusterOf.set(live[i], id));
});

// Library types and their exemplars.
const typeDir = 'scripts/block-face/types';
const types = fs.readdirSync(typeDir).flatMap(d => fs.readdirSync(path.join(typeDir, d)).filter(f => f.startsWith(prefix)).map(f => JSON.parse(fs.readFileSync(path.join(typeDir, d, f), 'utf8'))));
const isInfill = (t: any) => Number((/(\d{4})/.exec(t.id) ?? [])[1]) >= 1970;
const exemplars = new Map<string, Mod[]>(types.map(t => [t.id, live.filter(m => t.evidence.some((e: any) => e.pands.some((p: string) => m.pand.endsWith(p))))]));
const assign = (m: Mod) => {
  const year = byPand.get(m.pand)?.buildYear ?? 1900;
  const cands = types.filter(t => isInfill(t) === year >= 1970 && exemplars.get(t.id)!.length);
  const scored = cands.map(t => {
    const ex = exemplars.get(t.id)!.filter(e => e !== m);
    if (!ex.length) return {id: t.id, ncc: 1, d: 0};
    const ds = ex.map(e => dist(m, e)).sort((a, b) => a - b), top = ds.slice(0, 3);
    return {id: t.id, ncc: Math.max(...ex.map(e => bodyNcc(m, e))), crown: Math.max(...ex.map(e => crownNcc(m, e))), d: top.reduce((a, b) => a + b, 0) / top.length};
  }).sort((a, b) => a.d - b.d);
  return scored[0];
};

interface Row { face: string; pand: string; label: string; address: string; year?: number; modules: number; cluster: string; clusterNcc: number | null; type: string | null; typeNcc: number | null; typeDist: number | null; wall: string | null; accent: number; stucco: boolean; note?: string }
const rows: Row[] = [];
for (const face of faces) for (const pand of [...new Set(mods.filter(m => m.face === face).map(m => m.pand))]) {
  const ms = mods.filter(m => m.pand === pand && m.face === face), ok = ms.filter(m => live.includes(m)), sv = byPand.get(pand);
  if (!ok.length) { rows.push({face, pand, label: pand.slice(-6), address: sv?.label ?? '', year: sv?.buildYear, modules: ms.length, cluster: '-', clusterNcc: null, type: null, typeNcc: null, typeDist: null, wall: null, accent: 0, stucco: false, note: 'no strip (grey placeholder span)'}); continue; }
  const counts = new Map<string, number>(); ok.forEach(m => counts.set(clusterOf.get(m)!, (counts.get(clusterOf.get(m)!) ?? 0) + 1));
  const cluster = [...counts].sort((a, b) => b[1] - a[1])[0][0], med = medoid.get(cluster);
  const as = ok.map(assign).filter(Boolean), tc = new Map<string, number>(); as.forEach(a => tc.set(a!.id, (tc.get(a!.id) ?? 0) + 1));
  const type = as.length ? [...tc].sort((a, b) => b[1] - a[1])[0][0] : null, ta = as.filter(a => a!.id === type);
  rows.push({face, pand, label: pand.slice(-6), address: sv?.label ?? '', year: sv?.buildYear, modules: ms.length, cluster, clusterNcc: med ? +(ok.reduce((s, m) => s + bodyNcc(m, med), 0) / ok.length).toFixed(2) : null,
    type, typeNcc: ta.length ? +(ta.reduce((s, a) => s + a!.ncc, 0) / ta.length).toFixed(2) : null, typeDist: ta.length ? +(ta.reduce((s, a) => s + a!.d, 0) / ta.length).toFixed(3) : null,
    wall: ok[0].pal.wall, accent: ok[0].pal.shares.accent, stucco: ok[0].pal.stucco});
}
// Survey pands with no face (no frontage on the strip).
for (const p of survey.pands) if (!rows.some(r => r.pand === p.pandId)) rows.push({face: p.face ?? '-', pand: p.pandId, label: p.pandId.slice(-6), address: p.label ?? '', year: p.buildYear, modules: 0, cluster: '-', clusterNcc: null, type: null, typeNcc: null, typeDist: null, wall: null, accent: 0, stucco: false, note: 'no face / no strip span'});

const out = `staging/street-types/${street}`;
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'clusters.json'), JSON.stringify({street, moduleM, cut, modules: mods.length, live: live.length, clusters: clusters.filter(c => c.length > 1).map((c, k) => ({id: `C${String(k + 1).padStart(2, '0')}`, size: c.length, medoid: medoid.get(`C${String(k + 1).padStart(2, '0')}`)?.label, members: c.map(i => live[i].label)})), rows}, null, 1) + '\n');
let md = `# ${survey.street}: street-wide clusters (module ${moduleM} m, cut ${cut}; ${mods.length} modules, ${live.length} with photo)\n\n`;
md += `| cluster | modules | medoid | faces |\n|---|---|---|---|\n`;
clusters.filter(c => c.length > 1).forEach((c, k) => { md += `| C${String(k + 1).padStart(2, '0')} | ${c.length} | ${medoid.get(`C${String(k + 1).padStart(2, '0')}`)?.label} | ${[...new Set(c.map(i => live[i].face))].join(', ')} |\n`; });
md += `\nsingletons: ${clusters.filter(c => c.length === 1).length}\n\n`;
const typeCounts = new Map<string, number>(); rows.forEach(r => typeCounts.set(r.type ?? '(none)', (typeCounts.get(r.type ?? '(none)') ?? 0) + 1));
md += `## Type counts (${rows.length} pands)\n\n| type | pands |\n|---|---|\n${[...typeCounts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `| ${t} | ${n} |`).join('\n')}\n\n`;
for (const face of [...new Set(rows.map(r => r.face))]) {
  md += `## ${face}\n\n| pand | address | year | modules | cluster | NCC to medoid | type | NCC to type | wall | accent |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows.filter(r => r.face === face)) md += `| ${r.label} | ${r.address} | ${r.year ?? ''} | ${r.modules} | ${r.cluster} | ${r.clusterNcc ?? ''} | ${r.type ?? r.note ?? ''} | ${r.typeNcc ?? ''} | ${r.wall ?? ''}${r.stucco ? ' stucco' : ''} | ${r.accent} |\n`;
  md += '\n';
}
fs.writeFileSync(path.join(out, 'clusters.md'), md);
console.log(md.split('\n## ')[0]);
console.log(`-> ${out}/clusters.{json,md}`);
