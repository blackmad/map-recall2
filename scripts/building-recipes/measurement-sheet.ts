/**
 * Measurement review sheet: per photographed wall group a row of crop | colour-cluster mask (the measurement before the
 * opening pass) | the mask after the opening pass and the material read | 50 % overlay with the model elevation, the
 * new openings outlined; and a before/after table (glazing mean and bands, wall family and colour, verdict).
 *
 *   MAP_RECALL_SOURCE_DATA=<checkout> node --import tsx scripts/building-recipes/measurement-sheet.ts \
 *     --houses=<id>[,<id>] [--before=<dir with <id>/measured.json>] [--hand=<id>:<group>=#hex,...] [--out=<file.jpg>] [--json=<file>]
 *
 * Compiles each house as it is (no intent is written). `--before` reads earlier `measured.json` files (one per house in
 * `<dir>/<id>/`) for the "before" columns; without it the cluster mask's glazing stands in.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {compileLargeHouse} from './large.ts';
import {closeRenderer} from './render.ts';
import type {GroupLikeness} from './likeness-house.ts';
import {photoWindow, PAD_M} from '../../src/canalRecall/buildingRecipe/likeness.ts';
import {analyseMask, isOpeningCell, MASK, type FacadeMeasurement} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '-' : String(Math.round(v * 100)));

interface Before {verdict: string; glazing: number | null; bands: (number | null)[]; family: string | null; wall: string | null; reasons: string[]}
async function readBefore(dir: string | undefined, id: string): Promise<Map<number, Before>> {
  const out = new Map<number, Before>();
  if (!dir) return out;
  try {
    const m = JSON.parse(await fs.readFile(path.join(dir, id, 'measured.json'), 'utf8'));
    for (const g of m.groups) out.set(g.group, {verdict: g.verdict, glazing: g.likeness?.glazing?.photoMean ?? null, bands: g.likeness?.glazing?.photo ?? [], family: g.likeness?.wall?.photoFamily ?? null, wall: g.measured?.wall ?? null, reasons: g.reasons ?? []});
  } catch { /* no before file */ }
  return out;
}

const COL = {dark: [30, 90, 230], frame: [120, 200, 255], trim: [255, 180, 30], unusable: [110, 110, 110]} as const;
/** The photo with a mask painted over it (alpha 0.55) at S px per cell. */
function paintMask(photo: Buffer, pw: number, ph: number, win: Uint8Array, cols: number, rows: number, legacy: boolean): Buffer {
  const out = Buffer.from(photo), sx = cols / pw, sy = rows / ph;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = Math.min(cols - 1, Math.floor(x * sx)), j = Math.min(rows - 1, Math.floor(y * sy)), m = win[j * cols + i], q = (y * pw + x) * 3;
    // the cluster mask counted light trim as glazing: drawn as trim (amber) there, the opening pass keeps trim out of it
    const c = m === MASK.dark ? COL.dark : m === MASK.frame ? COL.frame : m === MASK.trim ? (legacy ? COL.trim : COL.trim) : m === MASK.unusable ? COL.unusable : null;
    if (!c) { for (let ch = 0; ch < 3; ch++) out[q + ch] = Math.round(out[q + ch] * 0.85); continue; }
    for (let ch = 0; ch < 3; ch++) out[q + ch] = Math.round(out[q + ch] * 0.45 + c[ch] * 0.55);
  }
  return out;
}

type LegacyMeasure = (input: {image: unknown; box: unknown; lines: number[]; inside?: unknown}) => {mask: Uint8Array; cols: number; rows: number};
let legacy: LegacyMeasure | null = null;

async function row(id: string, g: GroupLikeness, before: Before | undefined, hand: string | undefined, H: number) {
  const box = g.box!, model = g.model!, like = g.likeness!, photo = g.photo! as FacadeMeasurement;
  const W = box.u1 - box.u0, Hm = box.v1 - box.v0, scale = Math.min(H / Hm, (Number(arg("row-height") ?? 150) * 2.3) / W), pw = Math.max(40, Math.round(W * scale)), ph = Math.max(40, Math.round(Hm * scale));
  const photoImg = g.photoRgb ? await sharp(g.photoRgb.data, {raw: {width: g.photoRgb.width, height: g.photoRgb.height, channels: 3}}).resize(pw, ph, {fit: 'fill'}).raw().toBuffer() : Buffer.alloc(pw * ph * 3, 200);
  const pad = Math.round(PAD_M / photo.cell), du = Math.round(like.shift.uM / photo.cell), dv = Math.round(like.shift.vM / photo.cell);
  const winNew = photoWindow(photo, pad, du, dv, model.cols, model.rows);
  // the old classification: the measurement module as it was (--legacy=<file>), else this one's cluster mask
  const oldMask = legacy && g.photoImage ? legacy(g.photoImage).mask : photo.clusterMask ?? photo.mask;
  const winOld = photoWindow({...photo, mask: oldMask}, pad, du, dv, model.cols, model.rows);
  const oldImg = paintMask(photoImg, pw, ph, winOld, model.cols, model.rows, true), newImg = paintMask(photoImg, pw, ph, winNew, model.cols, model.rows, false);
  // overlay: photo and model elevation at 50 %, the new openings outlined in cyan
  const ov = Buffer.alloc(pw * ph * 3), sx = model.cols / pw, sy = model.rows / ph;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = Math.min(model.cols - 1, Math.floor(x * sx)), j = Math.min(model.rows - 1, Math.floor(y * sy)), k = j * model.cols + i, q = (y * pw + x) * 3;
    for (let ch = 0; ch < 3; ch++) ov[q + ch] = (photoImg[q + ch] + model.colours[k * 3 + ch]) >> 1;
    const open = isOpeningCell(winNew[k]);
    const edge = open && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const ii = i + a, jj = j + b; return ii >= 0 && jj >= 0 && ii < model.cols && jj < model.rows && !isOpeningCell(winNew[jj * model.cols + ii]) && winNew[jj * model.cols + ii] !== MASK.unusable; });
    if (edge) { ov[q] = 0; ov[q + 1] = 255; ov[q + 2] = 255; }
  }
  const oldGrid = analyseMask({mask: winOld.map(m => (m === MASK.trim ? MASK.dark : m)), cols: model.cols, rows: model.rows, cell: model.cell, box, lines: like.glazing ? (g.photoImage?.lines ?? []) : []});
  const png = (b: Buffer) => sharp(b, {raw: {width: pw, height: ph, channels: 3}}).png().toBuffer();
  const mat = photo.material, bands = (photo.bands ?? []).filter(Boolean);
  const after = {verdict: like.verdict, glazing: like.glazing.photoMean, bands: like.glazing.photo, family: like.wall.photoFamily, wall: photo.wall.hex, reasons: like.reasons};
  const b = before ?? {verdict: '-', glazing: oldGrid.glazing, bands: oldGrid.storeyGlazing, family: null, wall: null, reasons: []};
  const text = [
    `${id} walls[${g.group}]  ${g.pieces!.map(q => `${q.tag} ${q.capturedAt}`).join(' + ')}`,
    `glazing mean ${pct(b.glazing)} -> ${pct(after.glazing)} (model ${pct(like.glazing.modelMean)})${photo.openings?.abstain ? ' ABSTAINS' : ''}; range ${photo.openings ? photo.openings.range.map(pct).join('..') : '-'}`,
    `bands ${b.bands.slice(1).map(pct).join(' ')} -> ${after.bands.slice(1).map(pct).join(' ')} | model ${like.glazing.model.slice(1).map(pct).join(' ')}`,
    `wall ${b.wall ?? '-'} ${b.family ?? '-'} -> ${after.wall} ${after.family} (${mat?.basis ?? '-'}${mat?.texture ? `, r1 ${mat.texture.r[0]} r2 ${mat.texture.r[1]} an ${mat.texture.anisotropy} cv ${mat.texture.cv}` : ''})${hand ? `; hand ${hand}` : ''}; model ${like.wall.model}`,
    `bands: ${bands.map(x => `${x!.hex} ${x!.family ?? '?'}${x!.second ? `+${x!.second.hex} ${x!.second.family ?? '?'}` : ''}`).slice(0, 6).join(', ')}${bands.length > 6 ? ' ...' : ''}`,
    `verdict ${b.verdict} -> ${after.verdict}: ${after.reasons.join('; ') || 'reads the same'}`,
  ];
  const tw = 560, th = Math.max(ph, text.length * 15 + 8);
  const svg = Buffer.from(`<svg width="${tw}" height="${th}"><rect width="100%" height="100%" fill="#fff"/>${text.map((t, i) => `<text x="6" y="${16 + i * 15}" font-family="Helvetica, Arial" font-size="${i ? 11 : 12}" ${i ? '' : 'font-weight="bold"'} fill="#1f2328">${esc(t.length > 110 ? t.slice(0, 108) + '..' : t)}</text>`).join('')}</svg>`);
  const gap = 6, width = pw * 4 + gap * 4 + tw, height = Math.max(ph, th);
  const img = await sharp({create: {width, height, channels: 3, background: '#fff'}}).composite([
    {input: await png(photoImg), left: 0, top: 0}, {input: await png(oldImg), left: pw + gap, top: 0}, {input: await png(newImg), left: 2 * (pw + gap), top: 0}, {input: await png(ov), left: 3 * (pw + gap), top: 0},
    {input: svg, left: 4 * (pw + gap), top: 0},
  ]).png().toBuffer();
  return {img, width, height, summary: {id, group: g.group, before: b, after, hand: hand ?? null, model: {glazing: like.glazing.modelMean, bands: like.glazing.model, wall: like.wall.model, family: like.wall.modelFamily},
    material: mat ? {family: mat.family, basis: mat.basis, texture: mat.texture && {r1: mat.texture.r[0], r2: mat.texture.r[1], anisotropy: mat.texture.anisotropy, cv: mat.texture.cv}} : null, openings: photo.openings, bands: photo.bands, clusters: photo.clusters, wallCluster: photo.wallCluster, grid: {pitchM: photo.pitchM, columns: photo.columns, window: photo.window, frontClass: photo.frontClass, storeyM: photo.storeyM}}};
}

if (process.argv[1]?.endsWith('building-recipes/measurement-sheet.ts')) {
  const ids = (arg('houses') ?? '').split(',').filter(Boolean), out = arg('out') ?? 'docs/images/large-tier/measurement-20261014.jpg';
  const hand = new Map((arg('hand') ?? '').split(',').filter(Boolean).map(s => { const [k, v] = s.split('='); return [k, v] as const; }));
  if (!ids.length) throw Error('Use --houses=<id>[,<id>...]');
  if (arg('legacy')) legacy = (await import(path.resolve(arg('legacy')!))).measureFacade as LegacyMeasure;
  const rows: {img: Buffer; width: number; height: number}[] = [], summaries: unknown[] = [];
  try {
    for (const id of ids) {
      const before = await readBefore(arg('before'), id), {likeness} = await compileLargeHouse(id);
      for (const g of likeness ?? []) if (g.likeness) { const r = await row(id, g, before.get(g.group), hand.get(`${id}:${g.group}`), Number(arg('row-height') ?? 150)); rows.push(r); summaries.push(r.summary); if (arg('rows')) { await fs.mkdir(arg('rows')!, {recursive: true}); await fs.writeFile(path.join(arg('rows')!, `${id}-g${g.group}.png`), r.img); } }
    }
  } finally { await closeRenderer(); }
  const head = 22, W = Math.max(...rows.map(r => r.width)), Htot = head + rows.reduce((s, r) => s + r.height + 6, 0);
  const title = Buffer.from(`<svg width="${W}" height="${head}"><rect width="100%" height="100%" fill="#1f2328"/><text x="6" y="16" font-family="Helvetica, Arial" font-size="13" fill="#fff">${esc('crop | cluster mask (before: dark blue + amber trim counted as glazing) | opening pass (dark blue glass, light blue frame/bars, amber trim not glazing) | 50 % overlay with the model, openings outlined')}</text></svg>`);
  let y = head; const comp: sharp.OverlayOptions[] = [{input: title, left: 0, top: 0}];
  for (const r of rows) { comp.push({input: r.img, left: 0, top: y}); y += r.height + 6; }
  await fs.mkdir(path.dirname(out), {recursive: true});
  let q = 72, buf: Buffer;
  do { buf = await sharp({create: {width: W, height: Htot, channels: 3, background: '#e8e8e6'}}).composite(comp).jpeg({quality: q, mozjpeg: true}).toBuffer(); q -= 6; } while (buf.length > 395_000 && q > 30);
  await fs.writeFile(out, buf);
  console.log(`${out}: ${rows.length} rows, ${(buf.length / 1024).toFixed(0)} KB (quality ${q + 6})`);
  if (arg('json')) await fs.writeFile(arg('json')!, JSON.stringify(summaries, null, 1) + '\n');
}
