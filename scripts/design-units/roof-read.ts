/**
 * Design units B (2026-11-21, David: "price it, don't batch"): a narrow roof read, one question per design unit on its
 * rectified row (the members' house:crops crops side by side, ground at the bottom, plot gaps marked), answered per plot
 * left to right: roof storey yes/no, form (mansard, dormers, a gable rising through the cornice, flat), dormer kind and
 * dormers per house. A pilot only: 20 units the photo rows do not cover, plus the 18 gate blocks for agreement.
 *
 *   node --import tsx scripts/design-units/roof-read.ts pick                 20 Ring segments on the A default -> units.json
 *   node --import tsx scripts/design-units/roof-read.ts crops                the house:crops runs those units need (printed)
 *   node --import tsx scripts/design-units/roof-read.ts rows [--archive d]   rows/<unit>.jpg (<= 1568 px) and the gate rows
 *   node --import tsx scripts/design-units/roof-read.ts score                answers/<unit>.json against A and the gate reads
 *
 * Writes artifacts/design-units/roof-read/. The prompt is ROOF_READ_PROMPT below; tokens are estimated from the image
 * sizes (w * h / 750 per image) plus the prompt and a measured answer length.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { PLOT_ROOFS, type PlotRoof } from '../../src/canalRecall/designUnits/plotPlan.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/design-units/roof-read');
const SEGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/design-units-v1/segments.json'), 'utf8')).segments as Array<{ id: string; members: string[]; slices: Array<{ pandId: string; street: string; fromM: number; toM: number }>; year?: number; at?: [number, number]; roofEvidence?: { roofSource?: string; dormer?: string; form?: string; storey?: boolean }; plots?: Record<string, { roof?: PlotRoof; dormer?: string }> }>;
const GATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/design-units/gate-blocks.json'), 'utf8')) as Array<{ key: string; segments: string[]; members: string[] }>;
const READS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/design-units/plot-reads.json'), 'utf8')).pands as Record<string, { roof?: PlotRoof; dormer?: string }>;
export const MAX_EDGE_PX = 1568;

export const ROOF_READ_PROMPT = `You are reading the roofs of one street row in Amsterdam from a rectified photo, and the light dressing of their fronts: the street fronts are drawn flat,
side by side, ground at the bottom. Thin dark vertical bars separate the plots (separate houses); there are {N} plots, numbered 1 to {N}
from left to right. Look only at what stands at or above each plot's main cornice (the top of its brick or stucco wall).

For each plot answer:
- roofStorey: true if anything is lived in above the main cornice (a mansard face, dormers, a gable rising through the cornice), else false.
- form: one of "dormers" (dormers or hoist dormers on a roof behind the cornice), "mansard" (a steep slate face with windows above the cornice),
  "pointedGable" (a pointed or triangular gable rising through the cornice), "stepGable", "bellGable" (curved or neck gable), "flat" (nothing above the cornice),
  "not-visible" (cut off, trees, scaffold).
- dormerKind: "pediment" (triangular or curved hood with a cornice), "gabled" (pointed small roof), "plain" (flat or shed top), or "none".
- dormers: how many dormers that plot has (0 if none).
- whiteHeads: the light (white, cream or buff) dressing at the upper window heads: "keystone" (a light key on a brick arch),
  "blocks" (light blocks fanned round or set over the head), "band" (a light lintel band or slab), or "none" (brick heads).
- stringCourses: true if light horizontal courses run across the front through the window sills, else false.
- headShape: the upper window heads' shape: "flat", "segmental" (a shallow arch) or "round".
- stone: grey natural stone or stucco at the foot: "plinth" (a band under the ground windows), "ground" (the whole ground storey), or "none".
- bands: horizontal stripes of light brick or stone (speklagen): "ground" (ground storey only), "all", or "none".
- pilasters: white vertical pilasters: "corners" (at the house's two ends), "centre" (one column on the axis), or "none".
- gable: only when the roof is a gable: {"widthM": its foot width in metres, "offsetM": its centre's shift from the front's centre in metres (right positive, 0 when centred), "riseM": its height over the cornice, "window": "none" | "square" | "round" | "segmental"}.
- dormers counts every roof window on the roofline, small ones too (often 3, not 1).

Reply with JSON only, no prose: {"plots":[{"roofStorey":true,"form":"dormers","dormerKind":"pediment","dormers":1,"whiteHeads":"none","stringCourses":false,"headShape":"flat","stone":"none","bands":"none","pilasters":"none"}, ...]} with exactly {N} entries.`;

const argv = process.argv.slice(2), cmd = argv[0];
const opt = (k: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
const hash = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };
const mainOrder = (s: (typeof SEGS)[number]) => {
  const by = new Map<string, typeof s.slices>();
  for (const x of s.slices) by.set(x.street, [...(by.get(x.street) ?? []), x]);
  const main = [...by.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  return [...new Map([...main].sort((a, b) => a.fromM - b.fromM).map(x => [x.pandId, 1])).keys()];
};
type Unit = { id: string; buurt: string; order: string[]; year?: number; a: { roof: PlotRoof; dormer?: string } };
const unitsFile = path.join(OUT, 'units.json');

function buurtOf(at: [number, number], buurten: Array<{ code: string; rings: Array<{ x: number; y: number }[]> }>): string | null {
  const p = lngLatToRd(at);
  const inRing = (r: { x: number; y: number }[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i].y > p.y) !== (r[j].y > p.y) && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) c = !c; return c; };
  return buurten.find(b => b.rings.some(inRing))?.code ?? null;
}

if (cmd === 'pick') {
  const gateSegs = new Set(GATE.flatMap(g => g.segments));
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/coverage-v1/buurten.json'), 'utf8')).features as Array<{ properties: { code: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }>;
  const buurten = all.map(f => ({ code: f.properties.code, rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : f.geometry.coordinates as number[][][][]).map(poly => poly[0].map(q => lngLatToRd([q[0], q[1]]))) }));
  const pool = SEGS.filter(s => s.id.startsWith('du:ring:') && !gateSegs.has(s.id) && s.roofEvidence?.roofSource === 'default' && !Object.keys(s.plots ?? {}).length
    && s.members.length >= 2 && s.members.length <= 5 && typeof s.year === 'number' && s.year >= 1875 && s.year <= 1915 && s.at)
    .sort((a, b) => hash(a.id) - hash(b.id));
  const picked: Unit[] = [], perBuurt = new Map<string, number>();
  for (const s of pool) {
    const b = buurtOf(s.at!, buurten);
    if (!b || (perBuurt.get(b) ?? 0) >= 2) continue;
    perBuurt.set(b, (perBuurt.get(b) ?? 0) + 1);
    picked.push({ id: s.id, buurt: b, order: mainOrder(s), year: s.year, a: { roof: s.roofEvidence?.storey === false ? 'flat' : s.roofEvidence?.form === 'mansard' ? 'mansard' : 'dormers', ...(s.roofEvidence?.dormer ? { dormer: s.roofEvidence.dormer } : {}) } });
    if (picked.length === 20) break;
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(unitsFile, JSON.stringify(picked, null, 1));
  console.log(`${picked.length} units in ${perBuurt.size} buurten; pool ${pool.length}`);
} else if (cmd === 'crops') {
  const units = JSON.parse(fs.readFileSync(unitsFile, 'utf8')) as Unit[], by = new Map<string, string[]>();
  for (const u of units) by.set(u.buurt, [...(by.get(u.buurt) ?? []), ...u.order]);
  for (const [b, ids] of by) console.log(`${b} ${ids.join(',')}`);
} else if (cmd === 'rows') {
  const arch = path.resolve(opt('--archive') ?? path.join(ROOT, 'artifacts/design-units/roof-read/crops-archive'), 'pand-crops');
  const units = JSON.parse(fs.readFileSync(unitsFile, 'utf8')) as Unit[];
  const jobs: Array<{ key: string; order: string[]; arch: string }> = units.map(u => ({ key: u.id.replace(/[:#]/g, '_'), order: u.order, arch }));
  for (const g of GATE) jobs.push({ key: `gate_${g.key}`, order: JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/design-units/r2/layers', g.key, 'photo-row.json'), 'utf8')).pands.map((p: { pandId: string }) => p.pandId), arch: path.join(ROOT, 'artifacts/design-units/r2/crops-archive/pand-crops') });
  fs.mkdirSync(path.join(OUT, 'rows'), { recursive: true });
  const meta: Record<string, { n: number; w: number; h: number; missing: string[] }> = {};
  for (const j of jobs) {
    const have = j.order.filter(id => fs.existsSync(path.join(j.arch, id, 'front.jpg')));
    if (!have.length) { console.log(`${j.key}: no crops`); continue; }
    // Each crop at one px/m (its own pixelsPerMetre to 40 px/m), ground at the bottom, 8 px dark bars between plots.
    const parts = await Promise.all(have.map(async id => {
      const ppm = Number(JSON.parse(fs.readFileSync(path.join(j.arch, id, 'front.json'), 'utf8')).crop?.pixelsPerMetre) || 50, m = await sharp(path.join(j.arch, id, 'front.jpg')).metadata();
      const k = 40 / ppm, w = Math.max(1, Math.round((m.width ?? 1) * k)), h = Math.max(1, Math.round((m.height ?? 1) * k));
      return { buf: await sharp(path.join(j.arch, id, 'front.jpg')).resize(w, h).jpeg().toBuffer(), w, h };
    }));
    const W = parts.reduce((t, p) => t + p.w, 0) + 8 * (parts.length - 1), H = Math.max(...parts.map(p => p.h));
    let x = 0; const layers: sharp.OverlayOptions[] = [];
    for (const [i, p] of parts.entries()) { layers.push({ input: p.buf, left: x, top: H - p.h }); x += p.w; if (i < parts.length - 1) { layers.push({ input: { create: { width: 8, height: H, channels: 3, background: '#202020' } }, left: x, top: 0 }); x += 8; } }
    const big = await sharp({ create: { width: W, height: H, channels: 3, background: '#9fb8cf' } }).composite(layers).jpeg().toBuffer();
    const s = Math.min(1, MAX_EDGE_PX / Math.max(W, H)), out = path.join(OUT, 'rows', `${j.key}.jpg`);
    await sharp(big).resize(Math.round(W * s), Math.round(H * s)).jpeg({ quality: 85 }).toFile(out);
    meta[j.key] = { n: have.length, w: Math.round(W * s), h: Math.round(H * s), missing: j.order.filter(id => !have.includes(id)) };
  }
  fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(meta, null, 1));
  console.log(`${Object.keys(meta).length} rows`);
} else if (cmd === 'call') {
  // One Messages call per row through the `ant` CLI (its active profile; no key in the repo). Usage is kept per row.
  const { execFileSync } = await import('node:child_process');
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'rows.json'), 'utf8')) as Record<string, { n: number }>;
  const model = opt('--model') ?? 'claude-opus-5-5', only = opt('--only');
  fs.mkdirSync(path.join(OUT, 'answers'), { recursive: true });
  const usage: Record<string, unknown> = fs.existsSync(path.join(OUT, 'usage.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'usage.json'), 'utf8')) : {};
  for (const [k, m] of Object.entries(meta)) {
    if (only && !k.includes(only)) continue;
    if (fs.existsSync(path.join(OUT, 'answers', `${k}.json`))) continue;
    const data = fs.readFileSync(path.join(OUT, 'rows', `${k}.jpg`)).toString('base64');
    const message = JSON.stringify({ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }, { type: 'text', text: ROOF_READ_PROMPT.replaceAll('{N}', String(m.n)) }] });
    const out = execFileSync('ant', ['--format', 'json', 'messages', 'create', '--model', model, '--max-tokens', '4000', '--output-config', '{"effort":"low"}', '--message', message], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const res = JSON.parse(out) as { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number }; stop_reason: string };
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    usage[k] = { model, ...res.usage, stop: res.stop_reason };
    try { const a = JSON.parse(json); fs.writeFileSync(path.join(OUT, 'answers', `${k}.json`), JSON.stringify(a, null, 1)); } catch { console.log(`${k}: unparsed ${text.slice(0, 200)}`); }
    fs.writeFileSync(path.join(OUT, 'usage.json'), JSON.stringify(usage, null, 1));
    console.log(`${k}: in ${res.usage.input_tokens} out ${res.usage.output_tokens}`);
  }
} else if (cmd === 'score') {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'rows.json'), 'utf8')) as Record<string, { n: number; w: number; h: number; missing: string[] }>;
  const units = JSON.parse(fs.readFileSync(unitsFile, 'utf8')) as Unit[];
  const ans = (k: string) => { const f = path.join(OUT, 'answers', `${k}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as { plots: Array<{ roofStorey: boolean; form: string; dormerKind: string; dormers: number }> } : null; };
  const imgTokens = (k: string) => Math.ceil((meta[k].w * meta[k].h) / 750), promptTokens = Math.ceil(ROOF_READ_PROMPT.length / 3.6);
  let tIn = 0, n = 0, overrides = 0, plotsA = 0, agree = 0, gatePlots = 0, gateStorey = 0, gateStoreyN = 0;
  const lines: string[] = [];
  for (const u of units) {
    const k = u.id.replace(/[:#]/g, '_'), a = ans(k);
    if (!a || !meta[k]) continue;
    n++; tIn += imgTokens(k) + promptTokens;
    const have = u.order.filter(id => !meta[k].missing.includes(id));
    const diffs = a.plots.map((p, i) => { plotsA++; const over = p.form !== 'not-visible' && (p.form !== u.a.roof || (p.form === 'dormers' && p.dormerKind !== 'none' && p.dormerKind !== (u.a.dormer ?? 'gabled'))); if (over) overrides++; return `${have[i]?.slice(-6)}:${p.form}/${p.dormerKind}${over ? '*' : ''}`; });
    lines.push(`${u.id} (${u.buurt}, A ${u.a.roof}/${u.a.dormer ?? '-'}): ${diffs.join(' ')}`);
  }
  for (const g of GATE) {
    const k = `gate_${g.key}`, a = ans(k);
    if (!a || !meta[k]) continue;
    const order = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/design-units/r2/layers', g.key, 'photo-row.json'), 'utf8')).pands.map((p: { pandId: string }) => p.pandId).filter((id: string) => !meta[k].missing.includes(id));
    a.plots.forEach((p, i) => { const mine = READS[order[i]]?.roof; if (!mine) return; gatePlots++; if (p.form === mine) agree++; gateStoreyN++; if (p.roofStorey === (mine !== 'flat')) gateStorey++; });
  }
  console.log(lines.join('\n'));
  console.log(JSON.stringify({ units: n, plots: plotsA, overridesOfA: overrides, overrideShare: +(overrides / Math.max(1, plotsA)).toFixed(3), inputTokensPerUnit: Math.round(tIn / Math.max(1, n)), promptTokens, gate: { plots: gatePlots, formAgree: agree, storeyAgree: gateStorey, storeyN: gateStoreyN } }, null, 1));
} else {
  console.error('pick | crops | rows | score'); process.exit(2);
}
void PLOT_ROOFS;
