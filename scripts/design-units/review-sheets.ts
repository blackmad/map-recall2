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
} else if (cmd === 'layers') {
  // Review layers (coordinator, 2026-11-20; read by the local review tool as a compare round): per block
  // layers/<key>/{today,r1,r2}.jpg at one scale and left edge, padded with sky at the top to one height (the ground line
  // stays put when flipping), at least 1800 px wide; photo-NN.jpg per pand left to right from the rectified wall crops
  // (scripts/house-crops/crops.ts, run into r2/crops-archive), at least 1200 px wide; photo-row.jpg when every pand on
  // the street has a crop; photos.json with each photo's source and flags.
  const ARCH = path.join(OUT, 'crops-archive/pand-crops'), LAYERS = path.join(OUT, 'layers');
  const poor: Record<string, string[]> = {};
  for (const b of todo.filter(x => !x.key.startsWith('regression-'))) {
    const dir = path.join(LAYERS, b.key);
    fs.mkdirSync(dir, { recursive: true });
    const conds = [['today', 'today'], ['r1', 'r1'], ['new', 'r2']] as const;
    const metas = await Promise.all(conds.map(([c]) => sharp(path.join(OUT, b.key, c, 'front.png')).metadata()));
    const w0 = Math.max(...metas.map(m => m.width ?? 0)), h0 = Math.max(...metas.map(m => m.height ?? 0)), k = Math.max(1, 1800 / w0);
    const W = Math.round(w0 * k), H = Math.round(h0 * k);
    for (let i = 0; i < conds.length; i++) {
      const src = path.join(OUT, b.key, conds[i][0], 'front.png'), m = metas[i];
      const img = await sharp(src).resize({ width: Math.round((m.width ?? w0) * k), kernel: 'lanczos3' }).png().toBuffer(), ih = (await sharp(img).metadata()).height ?? H;
      // Sky colour from the source's top-left pixel, so the padding reads as more sky.
      const { data } = await sharp(src).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      await sharp({ create: { width: W, height: H, channels: 3, background: { r: data[0], g: data[1], b: data[2] } } })
        .composite([{ input: img, left: 0, top: H - ih }]).jpeg({ quality: 88 }).toFile(path.join(dir, `${conds[i][1]}.jpg`));
    }
    // Photos: the pands on the street left to right, then any member not on the street line.
    const ids = [...b.order, ...b.ids.filter(id => !b.order.includes(id) && (JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/design-units/gate-blocks.json'), 'utf8')) as Array<{ key: string; members: string[] }>).find(g => g.key === b.key)!.members.includes(id))];
    const photos: Array<Record<string, unknown>> = [], rowParts: Array<{ img: Buffer; w: number; h: number; ppm: number }> = [];
    let n = 0;
    for (const id of ids) {
      const jpg = path.join(ARCH, id, 'front.jpg'), meta = path.join(ARCH, id, 'front.json');
      if (!fs.existsSync(jpg) || !fs.existsSync(meta)) { photos.push({ pandId: id, file: null, why: 'no rectified crop (house:crops found no usable panorama)' }); (poor[b.key] ??= []).push(`${id.slice(-6)}: no crop`); continue; }
      const j = JSON.parse(fs.readFileSync(jpg.replace(/front\.jpg$/, 'front.json'), 'utf8'));
      const file = `photo-${String(++n).padStart(2, '0')}.jpg`, m = await sharp(jpg).metadata();
      await sharp(jpg).resize({ width: Math.max(1200, m.width ?? 0), kernel: 'lanczos3' }).jpeg({ quality: 90 }).toFile(path.join(dir, file));
      const p0 = j.panoramas?.[0] ?? {}, month = Number(String(p0.timestamp ?? '').slice(5, 7));
      photos.push({ pandId: id, file, method: j.method, usable: j.usable, rejectedBecause: j.rejectedBecause, date: j.missionDate, leafOff: month <= 4 || month >= 11,
        obliquityDeg: p0.obliquityDeg, cameraDistM: p0.cameraDistM, panoramas: (j.panoramas ?? []).map((p: { panoId: string; sourceUrl: string }) => ({ panoId: p.panoId, sourceUrl: p.sourceUrl })),
        nativePx: [m.width, m.height], pixelsPerMetre: j.crop?.pixelsPerMetre, foliage: j.flags?.foliage, occluderShare: j.flags?.occluderShare });
      if (!j.usable) (poor[b.key] ??= []).push(`${id.slice(-6)}: ${(j.rejectedBecause ?? []).join(', ')}`);
      if (b.order.includes(id)) rowParts.push({ img: fs.readFileSync(jpg), w: m.width ?? 0, h: m.height ?? 0, ppm: j.crop?.pixelsPerMetre ?? 50 });
    }
    // The row: every street pand's rectified crop side by side at one scale, bottoms on the ground line.
    let row: Record<string, unknown> | null = null;
    if (rowParts.length === b.order.length && rowParts.length > 1) {
      const ppm = Math.min(...rowParts.map(r => r.ppm)), scaled = await Promise.all(rowParts.map(async r => { const img = await sharp(r.img).resize({ width: Math.max(1, Math.round(r.w * ppm / r.ppm)) }).png().toBuffer(); const mm = await sharp(img).metadata(); return { img, w: mm.width ?? 0, h: mm.height ?? 0 }; }));
      const RW = scaled.reduce((t, s) => t + s.w, 0), RH = Math.max(...scaled.map(s => s.h));
      let x = 0;
      const comp = scaled.map(s => { const o = { input: s.img, left: x, top: RH - s.h }; x += s.w; return o; });
      const k2 = Math.max(1, 1800 / RW);
      const stitched = await sharp({ create: { width: RW, height: RH, channels: 3, background: '#ffffff' } }).composite(comp).png().toBuffer();
      await sharp(stitched).resize({ width: Math.round(RW * k2), kernel: 'lanczos3' }).jpeg({ quality: 88 }).toFile(path.join(dir, 'photo-row.jpg'));
      const dates = [...new Set(photos.filter(p => p.file && b.order.includes(String(p.pandId))).map(p => p.date))];
      row = { file: 'photo-row.jpg', pands: b.order, note: `each pand's own rectified crop, side by side at ${ppm} px/m, bottoms on the ground line${dates.length > 1 ? `; mixed capture dates (${dates.join(', ')})` : ''}` };
    }
    fs.writeFileSync(path.join(dir, 'photos.json'), JSON.stringify({ block: b.key, street: b.street, buurt: b.buurt, title: b.title,
      layers: { today: 'today.jpg', r1: 'r1.jpg', r2: 'r2.jpg', width: W, height: H, note: 'one scale and left edge; shorter strips padded with sky at the top' },
      photos, row, attribution: 'Gemeente Amsterdam, Panoramabeelden (CC BY 4.0; faces and number plates blurred by the publisher)',
      source: 'rectified wall crops, scripts/house-crops/crops.ts (rankPanos, yearCandidates: clear straight views, then leaf-off, then newer years)' }, null, 1));
    console.log(`${b.key}: ${W}x${H} strips, ${n}/${ids.length} photos${row ? ', row' : ''}`);
  }
  fs.writeFileSync(path.join(LAYERS, 'poor.json'), JSON.stringify(poor, null, 1));
  console.log(JSON.stringify(poor, null, 1));
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
