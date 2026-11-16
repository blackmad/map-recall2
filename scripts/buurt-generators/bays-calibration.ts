/**
 * Round 19 (lane R): the bay counters scored against hand counts. Each hand-counted member cut (measure-bays.ts
 * --crops) is measured as measure-bays measures it; the pixel writer's gate (baysOfMeasure), its relaxations, and the
 * run counter (axesOfMask) over a grid of its parameters are each scored on coverage (a count given) and accuracy (the
 * count equals the hand count). Node only; nothing is fetched.
 *
 *   node --import tsx scripts/buurt-generators/bays-calibration.ts --crops=<dir> --key=<hand-key.json> --counts=<hand-counts.json> [--json=<out>]
 *
 * key:    { m01: { d: <district>, id: <pandId>, f: <crop file> }, ... }
 * counts: { m01: { axes: number | null, stair: number, wide: number, conf: 1-5 }, ... }
 */
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { measureCrop } from '../../src/canalRecall/houseSpec/writers/pixel.ts';
import { AXES_RUN, axesOfMask, baysOfMeasure } from '../../src/canalRecall/buurtGenerator/baysRead.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const crops = arg('crops')!, key = JSON.parse(fs.readFileSync(arg('key')!, 'utf8')), counts = JSON.parse(fs.readFileSync(arg('counts')!, 'utf8'));
const PPM = 40;
const lines = new Map<string, number>();
for (const d of new Set(Object.values(key).map((k: any) => k.d as string))) {
  for (const r of JSON.parse(fs.readFileSync(`artifacts/buurt-generators/${d}/rows.json`, 'utf8')).rows) {
    const line = Math.max(...r.series.map((s: any) => s.design.corniceTopM.value ?? 0));
    for (const m of r.members) lines.set(m.pandId, Math.max(lines.get(m.pandId) ?? 0, line));
  }
}
type Row = { n: string; hand: number; conf: number; stair: number; m: NonNullable<ReturnType<typeof measureCrop>> };
const rows: Row[] = [];
for (const [n, k] of Object.entries<any>(key)) {
  const h = counts[n]; if (!h || h.axes === null || h.axes === undefined) continue;
  const img = jpeg.decode(fs.readFileSync(`${crops}/${k.f}`), { useTArray: true }), w = img.width, H = img.height, rgb = new Uint8Array(w * H * 3);
  for (let i = 0; i < w * H; i++) { rgb[i * 3] = img.data[i * 4]; rgb[i * 3 + 1] = img.data[i * 4 + 1]; rgb[i * 3 + 2] = img.data[i * 4 + 2]; }
  const m = measureCrop({ pandId: k.id, image: { rgb, width: w, height: H, ppm: PPM }, tier: 'good', wallTopM: lines.get(k.id) ?? H / PPM, ref: '', at: null });
  if (m) rows.push({ n, hand: h.axes, conf: h.conf ?? 3, stair: h.stair ?? 0, m });
}
type Score = { name: string; given: number; right: number; off1: number; detail: string[] };
const score = (name: string, f: (r: Row) => number | null): Score => {
  const s: Score = { name, given: 0, right: 0, off1: 0, detail: [] };
  for (const r of rows) { const v = f(r); if (v === null) continue; s.given++; if (v === r.hand) s.right++; else if (Math.abs(v - r.hand) === 1) s.off1++; s.detail.push(`${r.n}:${v}/${r.hand}`); }
  return s;
};
const out: Score[] = [];
out.push(score('pixel gate (round 18)', r => baysOfMeasure(r.m.m)));
for (const p of [0.5, 0.4, 0.3]) out.push(score(`pixel gate, pitch >= ${p}`, r => { const m = r.m.m; return (m.frontClass === 'punched' || m.frontClass === 'columns') && m.usableFraction >= 0.5 && m.columns !== null && m.columns === m.windowColumns && m.pitchScore >= p && m.columns <= 8 ? m.columns : null; }));
for (const fill of [0.2, 0.3, 0.4]) for (const storeys of [0.5, 0.67]) for (const mergeM of [0.2, 0.3, 0.45]) for (const minM of [0.3, 0.45]) {
  const o = { fill, storeys, mergeM, minM };
  out.push(score(`runs ${JSON.stringify(o)}`, r => { const a = axesOfMask(r.m.m, r.m.lines, r.m.topM, o); return a && a.axes >= 1 && a.axes <= 8 ? a.axes : null; }));
}
out.sort((a, b) => b.right - a.right || a.given - b.given);
console.log(`${rows.length} hand-counted members measured (default runs ${JSON.stringify(AXES_RUN)})`);
for (const s of out.slice(0, 14)) console.log(`${s.name.padEnd(70)} given ${s.given}/${rows.length} right ${s.right} (${s.given ? Math.round(100 * s.right / s.given) : 0} %) off-by-1 ${s.off1}`);
const j = arg('json'); if (j) fs.writeFileSync(j, JSON.stringify(out, null, 1));
