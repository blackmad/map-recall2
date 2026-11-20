/**
 * Design-units review sheets, round 2 (2026-11-20, after David's "over aggressively collapsing buildings" on #399): one row
 * sheet per gate block and regression row, Node only (scripts/house-preview/preview.ts over the block's stated front line;
 * no browser), stacked photo (the gate's per-pand photo.jpg cuts side by side, where they exist) | today | last night's flag
 * | new.
 *
 *   node --import tsx scripts/design-units/review-sheets.ts render <cond> [--env DESIGN_UNITS=1] [--only key,key]
 *   node --import tsx scripts/design-units/review-sheets.ts sheets
 *
 * `render` writes artifacts/design-units/r2/<key>/<cond>/front.png with the source tree as it stands (render `today` and
 * `r1` before the round-2 change, `new` after). `sheets` writes <key>/sheet.jpg and r2/blocks.json (id, street, buurt,
 * sheet file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { REGRESSION_ROWS } from '../../src/canalRecall/designUnits/regressionRows.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/design-units/r2');
const GATE = path.join(ROOT, 'artifacts/design-units/gate/desktop/after');
type LngLat = [number, number];
type Unit = { id: string; members: string[]; faces?: Array<{ street: string; slices: Array<{ pandId: string; fromM: number; toM: number; line?: [LngLat, LngLat] }> }> };
type Block = { key: string; street: string; buurt: string; title: string; ids: string[]; line: [number, number, number, number]; order: string[]; photoKey?: string };

const units = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/design-units/staging/design-units.json'), 'utf8')).units as Unit[];
const unitOfPand = new Map<string, Unit>();
for (const u of units) for (const m of u.members) unitOfPand.set(m, u);

/** The block's front line: every member slice line on the street, projected on the first slice's direction. */
function frontLine(ids: string[], street: string): { line: [number, number, number, number]; order: string[] } | null {
  const want = new Set(ids), slices: Array<{ pandId: string; line: [LngLat, LngLat] }> = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const u = unitOfPand.get(id);
    if (!u || seen.has(u.id)) continue;
    seen.add(u.id);
    for (const f of u.faces ?? []) if (!street || f.street === street) for (const s of f.slices) if (want.has(s.pandId) && s.line) slices.push({ pandId: s.pandId, line: s.line });
  }
  if (!slices.length) return null;
  const rd = (p: LngLat) => lngLatToRd(p);
  const a = rd(slices[0].line[0]), b = rd(slices[0].line[1]), len = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  const t = (p: LngLat) => { const r = rd(p); return (r.x - a.x) * ux + (r.y - a.y) * uy; };
  let lo = { t: Infinity, p: slices[0].line[0] }, hi = { t: -Infinity, p: slices[0].line[1] };
  for (const s of slices) for (const p of s.line) { const v = t(p); if (v < lo.t) lo = { t: v, p }; if (v > hi.t) hi = { t: v, p }; }
  const order = [...new Map(slices.map(s => [s.pandId, (t(s.line[0]) + t(s.line[1])) / 2])).entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
  return { line: [lo.p[0], lo.p[1], hi.p[0], hi.p[1]], order };
}

function blocks(): Block[] {
  const gate = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/design-units/gate-blocks.json'), 'utf8')) as Array<{ key: string; street: string; gebied: string; buurt?: string; members: string[]; segments: string[]; year?: number; architect?: string | null }>;
  const out: Block[] = [];
  for (const g of gate) {
    const fl = frontLine(g.members, g.street);
    if (!fl) { console.error(`${g.key}: no front line`); continue; }
    const ids = [...new Set(g.segments.flatMap(s => units.find(u => u.id === s)?.members ?? []).concat(g.members))];
    out.push({ key: g.key, street: g.street, buurt: g.buurt ?? g.gebied, title: `${g.street} (${g.segments.join(', ')}${g.year ? `; ${g.year}` : ''}${g.architect ? `; ${g.architect}` : ''})`, ids, ...fl, photoKey: g.key });
  }
  // The two Centrum regression rows (#392): outside the Ring extract, so every condition must draw them as today.
  for (const r of REGRESSION_ROWS.filter(r => r.objects.every(o => o.startsWith('centrum:')))) {
    const ids = [...r.units.flat(), ...r.found.flat()], street = unitOfPand.get(ids[0])?.faces?.find(f => f.slices.some(s => s.pandId === ids[0]))?.street ?? '';
    const fl = frontLine(r.units.flat(), street);
    if (!fl) { console.error(`${r.name}: no front line`); continue; }
    out.push({ key: `regression-${r.name.toLowerCase()}`, street: r.name, buurt: 'Centrum', title: `${r.name} (regression row, ${r.objects.join(', ')}; Centrum, not in the Ring extract)`, ids, ...fl });
  }
  return out;
}

const argv = process.argv.slice(2), cmd = argv[0];
const flag = (k: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
const all = blocks(), only = flag('--only')?.split(',');
const todo = only ? all.filter(b => only.includes(b.key)) : all;

if (cmd === 'render') {
  const cond = argv[1], env: Record<string, string> = {};
  for (const kv of (flag('--env') ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); env[k] = v; }
  for (const b of todo) {
    const dir = path.join(OUT, b.key, cond), t0 = Date.now();
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/house-preview/preview.ts', b.order[0], '--wall', `line:${b.line.join(',')}`, '--out', dir],
      { cwd: ROOT, env: { ...process.env, ...env, PREVIEW_ROW_IDS: b.ids.join(',') }, encoding: 'utf8' });
    console.log(`${b.key} ${cond} ${r.status === 0 ? 'ok' : 'FAILED'} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (r.status !== 0) console.error((r.stderr || r.stdout).slice(-2000));
  }
} else if (cmd === 'sheets') {
  const label = (text: string, w: number) => Buffer.from(`<svg width="${w}" height="34"><rect width="100%" height="100%" fill="#222"/><text x="10" y="23" font-family="Helvetica" font-size="18" fill="#eee">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
  const index: Array<{ id: string; street: string; buurt: string; title: string; sheet: string; photo: boolean }> = [];
  for (const b of todo) {
    const dir = path.join(OUT, b.key), strips: Array<{ input: Buffer; text: string }> = [];
    // Photo: the gate's per-pand cuts, left to right, at one height.
    const cuts = b.photoKey ? b.order.map(id => path.join(GATE, b.photoKey!, id, 'photo.jpg')).filter(f => fs.existsSync(f)) : [];
    if (cuts.length) {
      const H = 360, imgs = await Promise.all(cuts.map(f => sharp(f).resize({ height: H }).png().toBuffer()));
      const ws = await Promise.all(imgs.map(async i => (await sharp(i).metadata()).width ?? 0));
      let x = 0;
      const comp = imgs.map((input, i) => { const o = { input, left: x, top: 0 }; x += ws[i] + 4; return o; });
      strips.push({ input: await sharp({ create: { width: Math.max(1, x - 4), height: H, channels: 3, background: '#ffffff' } }).composite(comp).png().toBuffer(), text: `photo: ${cuts.length} per-pand cuts, left to right (each is that pand's own panorama crop)` });
    }
    for (const [cond, text] of [['today', 'today (flag off)'], ['r1', "last night's flag (#399: one slab per unit)"], ['new', 'new: unit = family, each plot its own house']] as const) {
      const f = path.join(dir, cond, 'front.png');
      if (fs.existsSync(f)) strips.push({ input: fs.readFileSync(f), text });
    }
    if (!strips.length) continue;
    const W = 1800, comps: sharp.OverlayOptions[] = [{ input: label(b.title, W), left: 0, top: 0 }];
    let y = 40;
    for (const s of strips) {
      const img = await sharp(s.input).resize({ width: W, height: 900, fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const m = await sharp(img).metadata();
      comps.push({ input: label(s.text, W), left: 0, top: y }, { input: img, left: Math.round((W - (m.width ?? W)) / 2), top: y + 34 });
      y += 34 + (m.height ?? 0) + 10;
    }
    await sharp({ create: { width: W, height: y, channels: 3, background: '#ffffff' } }).composite(comps).jpeg({ quality: 82 }).toFile(path.join(dir, 'sheet.jpg'));
    index.push({ id: b.key, street: b.street, buurt: b.buurt, title: b.title, sheet: `${b.key}/sheet.jpg`, photo: cuts.length > 0 });
  }
  fs.writeFileSync(path.join(OUT, 'blocks.json'), JSON.stringify(index, null, 1));
  console.log(`${index.length} sheets in ${path.relative(ROOT, OUT)}`);
} else {
  console.error('usage: review-sheets.ts render <cond> [--env K=V] [--only keys] | sheets');
  process.exit(2);
}
