/**
 * Row strip sheet (lane P, house rows first): one street side, consecutive, every front, three strips at one scale.
 *
 *   npm run house:row-sheet -- <row> [--ppm 40] [--out <dir>] [--drawn-env K=V,K=V] [--drawn-specs <dir>] [--drawn-label <text>] [--reread-cuts <dir>] [--list]
 *
 *   photo   the captures the D1 reader actually saw (the cut in the describer's cuts dir, cropped to its cyan outline
 *           and scaled to the front's width), NOT pickLikeness's capture;
 *   drawn   Node renderer (scripts/house-preview/preview.ts) under --drawn-env flags (lane R's row renderer: ROW_FRONT=1
 *           or whatever it names) with --drawn-specs <dir>/<pandId>.json applied as the house spec (lane D's output);
 *   today   the same renderer with no flags and no specs: this morning's drawing from the installed extracts.
 *
 * Writes <out>/sheet.jpg (all three, labelled, with a metre grid), and the blind pair for the row review:
 * <out>/blind/photo.jpg and <out>/blind/drawn.jpg (two strips at one scale, house numbers only, no conditions named),
 * plus <out>/blind/zoom/<label>.jpg (per front: photo crop | drawn crop at 3x the strip scale) and <out>/manifest.json. A front whose shown
 * capture is not the first read (--reread-cuts <dir> of jpgs + cuts.json, or a different capture date) is labelled on the sheet. Rows are defined in scripts/house-specs/rows/rows.json. Renders are cached by condition.
 * The sheet does not judge likeness; a fresh reviewer reads it (scripts/house-specs/rows/blind-review.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { loadRowDefs, loadRereads, cutPath, REPO, type RowDef } from './rowDefs.ts';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Bounding box of the cyan outline pixels the cutter draws round the front (r low, g and b high). */
export async function outlineBox(file: string): Promise<{ left: number; top: number; width: number; height: number; imgW: number; imgH: number } | null> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    if (data[i] < 90 && data[i + 1] > 190 && data[i + 2] > 190) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (n < 200 || x1 - x0 < 20) return null;
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, imgW: info.width, imgH: info.height };
}

/** The photo tile: the reader's cut cropped to the outline (plus 12 % of its height above for dormers), width = the front's width. */
export async function photoTile(cut: string, widthPx: number): Promise<{ buf: Buffer; heightPx: number; cropped: boolean }> {
  const box = await outlineBox(cut);
  const meta = await sharp(cut).metadata();
  const crop = box
    ? { left: box.left, width: box.width, top: Math.max(0, box.top - Math.round(box.height * 0.12)), height: Math.min(box.imgH, box.top + box.height) - Math.max(0, box.top - Math.round(box.height * 0.12)) }
    : { left: Math.round(meta.width! * 0.25), width: Math.round(meta.width! * 0.5), top: 0, height: meta.height! };
  const h = Math.max(1, Math.round(crop.height * widthPx / crop.width));
  return { buf: await sharp(cut).extract(crop).resize(widthPx, h, { fit: 'fill' }).png().toBuffer(), heightPx: h, cropped: !!box };
}

interface Cond { name: string; env: Record<string, string>; specsDir?: string }

async function drawnTiles(def: RowDef, cond: Cond, work: string, ppm: number) {
  const out = new Map<string, { buf: Buffer; heightPx: number; storeys: string; topM: number }>();
  for (const m of def.members) {
    const dir = path.join(work, cond.name, m.pandId);
    if (!fs.existsSync(path.join(dir, 'front.png'))) {
      const spec = cond.specsDir && fs.existsSync(path.join(cond.specsDir, `${m.pandId}.json`)) ? path.join(cond.specsDir, `${m.pandId}.json`) : null;
      const args = ['--import', 'tsx', 'scripts/house-preview/preview.ts', m.pandId, '--route', spec ? 'spec' : 'generic', '--ppm', String(ppm), '--out', dir, ...(spec ? ['--spec', spec] : [])];
      const r = spawnSync('node', args, { encoding: 'utf8', cwd: REPO, env: { ...process.env, ...cond.env } });
      if (r.status !== 0) { console.error(`${cond.name} ${m.pandId}: preview failed\n${(r.stderr || r.stdout).slice(-500)}`); continue; }
    }
    const meas = JSON.parse(fs.readFileSync(path.join(dir, 'measure.json'), 'utf8')) as { heights?: { topM: number }; layout?: { storeys?: number } };
    const topM = meas.heights?.topM ?? 0;
    const w = Math.round(m.widthM * ppm), h = Math.max(1, Math.round(topM * ppm));
    out.set(m.pandId, { buf: await sharp(path.join(dir, 'front.png')).resize(w, h, { fit: 'fill' }).png().toBuffer(), heightPx: h, storeys: String(meas.layout?.storeys ?? '?'), topM });
  }
  return out;
}

const grid = (W: number, H: number, ppm: number) => Array.from({ length: Math.floor(H / ppm / 3) }, (_, i) => { const y = H - (i + 1) * 3 * ppm; return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#ff3355" stroke-opacity="0.4"/><text x="2" y="${y - 2}" font-size="11" fill="#ff3355" font-family="Helvetica">${(i + 1) * 3} m</text>`; }).join('');

async function strip(tiles: Array<{ buf: Buffer; heightPx: number } | undefined>, xs: number[], widths: number[], H: number, bg: string, withGrid: boolean, ppm: number, W: number) {
  const layers: sharp.OverlayOptions[] = [];
  tiles.forEach((t, i) => { if (t) layers.push({ input: t.buf, left: xs[i], top: Math.max(0, H - t.heightPx) }); });
  tiles.forEach((t, i) => { if (!t && !withGrid) layers.push({ input: Buffer.from(`<svg width="${widths[i]}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#555"/><text x="${widths[i] / 2}" y="${H - 40}" text-anchor="middle" font-size="14" fill="#ddd" font-family="Helvetica">not read by D1</text></svg>`), left: xs[i], top: 0 }); });
  if (withGrid) layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${grid(W, H, ppm)}</svg>`), left: 0, top: 0 });
  return sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(layers).png().toBuffer();
}

async function main() {
  const defs = loadRowDefs();
  const id = argv.find(a => !a.startsWith('--') && defs[a]);
  if (argv.includes('--list') || !id) { console.log(`rows: ${Object.keys(defs).join(', ')}\nusage: house:row-sheet -- <row> [--ppm 40] [--out dir] [--drawn-env K=V,..] [--drawn-specs dir] [--drawn-label text]`); process.exit(id ? 0 : 2); }
  const def = defs[id];
  const ppm = Number(arg('ppm') ?? def.pixelsPerMetre ?? 40);
  const out = arg('out') ?? path.join(REPO, 'artifacts/house-rows/sheets', id);
  const work = path.join(REPO, 'artifacts/house-rows/sheet-cache', id);
  fs.mkdirSync(path.join(out, 'blind'), { recursive: true });
  const env = Object.fromEntries((arg('drawn-env') ?? '').split(',').filter(Boolean).map(kv => kv.split('=') as [string, string]));
  const specsDir = arg('drawn-specs');
  const envKey = Object.entries(env).map(([k, v]) => `${k}-${v}`).join('_') || 'none';
  const drawnCond: Cond = { name: `drawn-${envKey}${specsDir ? `-${path.basename(specsDir)}` : ''}`, env, specsDir };
  const todayCond: Cond = { name: 'today', env: {} };
  const drawnIsToday = !Object.keys(env).length && !specsDir;
  const drawnLabel = arg('drawn-label') ?? (drawnIsToday ? 'drawn (no row renderer or records given: same as today)' : `drawn (${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ') || 'default flags'}${specsDir ? `, specs ${path.basename(specsDir)}` : ''})`);

  const widths = def.members.map(m => Math.round(m.widthM * ppm));
  const GAP = 6;
  const xs: number[] = []; let x = 0;
  for (const w of widths) { xs.push(x); x += w + GAP; }
  const W = x - GAP;

  const reread = arg('reread-cuts');
  const dateOf = (dir: string, pid: string): string | null => { try { return String(JSON.parse(fs.readFileSync(path.join(dir, 'cuts.json'), 'utf8')).rows.find((r: any) => r.pandId === pid)?.captured ?? '').slice(0, 10) || null; } catch { return null; } };
  const shown = def.members.map(m => {
    const rr = reread && fs.existsSync(path.join(reread, `${m.pandId}.jpg`)) ? path.join(reread, `${m.pandId}.jpg`) : null;
    const file = rr ?? cutPath(def, m.pandId);
    if (!file) return null;
    const first = dateOf(def.cutsDir, m.pandId), now = dateOf(path.dirname(file), m.pandId);
    const note = rr ? `re-read: ${now ?? 'capture date unknown'}` : first && now && first !== now ? `shown capture ≠ first read (${now} vs ${first})` : null;
    return { file, note, capture: now, firstReadCapture: first };
  });
  const photo: Array<{ buf: Buffer; heightPx: number } | undefined> = [];
  const missing: string[] = [];
  for (let i = 0; i < def.members.length; i++) {
    const sh = shown[i];
    if (!sh) { missing.push(def.members[i].pandId); photo.push(undefined); continue; }
    photo.push(await photoTile(sh.file, widths[i]));
  }
  const drawn = await drawnTiles(def, drawnCond, work, ppm);
  const today = drawnIsToday ? drawn : await drawnTiles(def, todayCond, work, ppm);

  const maxPhotoH = Math.max(...photo.map(p => p?.heightPx ?? 0));
  const maxDrawnH = Math.max(...def.members.map(m => Math.max(drawn.get(m.pandId)?.heightPx ?? 0, today.get(m.pandId)?.heightPx ?? 0)));
  const H = Math.max(maxPhotoH, maxDrawnH, Math.round(19 * ppm));
  const sky = '#a0b4c8';
  const photoBase = await strip(photo, xs, widths, H, '#333', false, ppm, W);
  const noteSvg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${def.members.map((m, i) => shown[i]?.note ? `<rect x="${xs[i]}" y="${H - (photo[i]?.heightPx ?? 0)}" width="${widths[i]}" height="18" fill="#c4361b"/><text x="${xs[i] + 3}" y="${H - (photo[i]?.heightPx ?? 0) + 13}" font-size="11" fill="#fff" font-family="Helvetica">${esc(shown[i]!.note!)}</text>` : '').join('')}</svg>`);
  const photoStrip = shown.some(x => x?.note) ? await sharp(photoBase).composite([{ input: noteSvg, left: 0, top: 0 }]).png().toBuffer() : photoBase;
  const drawnStrip = await strip(def.members.map(m => drawn.get(m.pandId)), xs, widths, H, sky, true, ppm, W);
  const todayStrip = await strip(def.members.map(m => today.get(m.pandId)), xs, widths, H, sky, true, ppm, W);

  const labelBand = (h: number, f: (m: typeof def.members[number], i: number) => string) => Buffer.from(`<svg width="${W}" height="${h}" xmlns="http://www.w3.org/2000/svg">${def.members.map((m, i) => f(m, i)).join('')}</svg>`);
  const numLabels = (m: typeof def.members[number], i: number) => `<text x="${xs[i] + widths[i] / 2}" y="18" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff" font-family="Helvetica">${esc(m.label)}</text>`;
  const head = 30, band = 26;
  const blindHead = (t: string) => Buffer.from(`<svg width="${W}" height="${band}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="18" font-size="14" fill="#ccc" font-family="Helvetica">${esc(t)}</text></svg>`);

  // Blind pair: two strips at one scale, house numbers on top, nothing else about how either was made.
  for (const [name, img] of [['photo', photoStrip], ['drawn', drawnStrip]] as const) {
    await sharp({ create: { width: W, height: band + H, channels: 3, background: '#111' } })
      .composite([{ input: labelBand(band, numLabels), left: 0, top: 0 }, { input: img, left: 0, top: band }]).jpeg({ quality: 88 }).toFile(path.join(out, 'blind', `${name}.jpg`));
  }
  // Per-front zoom pairs for the reviewer: photo crop | drawn crop at 3x the strip scale (drawn re-rendered at 3x ppm).
  const Z = 3;
  const zoomDir = path.join(out, 'blind', 'zoom');
  fs.rmSync(zoomDir, { recursive: true, force: true }); fs.mkdirSync(zoomDir, { recursive: true });
  const drawnZ = await drawnTiles(def, { ...drawnCond, name: `${drawnCond.name}-z${Z}` }, work, ppm * Z);
  for (let i = 0; i < def.members.length; i++) {
    const m = def.members[i], sh = shown[i], dz = drawnZ.get(m.pandId);
    const pz = sh ? await photoTile(sh.file, widths[i] * Z) : null;
    const hh = Math.max(pz?.heightPx ?? 0, dz?.heightPx ?? 0, 60), w = widths[i] * Z;
    const lay: sharp.OverlayOptions[] = [];
    if (pz) lay.push({ input: pz.buf, left: 0, top: 24 + hh - pz.heightPx });
    if (dz) lay.push({ input: dz.buf, left: w + 8, top: 24 + hh - dz.heightPx });
    lay.push({ input: Buffer.from(`<svg width="${2 * w + 8}" height="24" xmlns="http://www.w3.org/2000/svg"><text x="4" y="17" font-size="15" font-weight="bold" fill="#fff" font-family="Helvetica">${esc(m.label)}</text><text x="${w + 12}" y="17" font-size="13" fill="#ccc" font-family="Helvetica">drawing</text></svg>`), left: 0, top: 0 });
    await sharp({ create: { width: 2 * w + 8, height: 24 + hh, channels: 3, background: sh ? '#111' : '#555' } }).composite(lay).jpeg({ quality: 88 }).toFile(path.join(zoomDir, `${m.label.replace(/[^\w-]+/g, '-')}.jpg`));
  }
  // A re-read front (its first read held: scaffold, netting) shows the re-read's capture, labelled on the tile and in the title,
  // so the sheet never passes it off as the capture the first read saw.
  const rereads = loadRereads();
  const rr = def.members.map((m, i) => ({ m, i, r: rereads[m.pandId] })).filter(x => x.r);
  const rrNote = rr.length ? `; RE-READ: ${rr.map(x => `${x.m.label} from the ${x.r.captured} capture (first read ${x.r.firstRead.captured ?? '?'}, held: ${x.r.firstRead.held})`).join('; ')}` : '';
  const rowsBlocks: Array<[string, Buffer]> = [[`photo: the captures the D1 reader saw, cropped to the front outline, scaled to the front width${rrNote}`, photoStrip], [drawnLabel, drawnStrip], ['today: this morning\'s drawing (installed extracts, no row flags)', todayStrip]];
  const total = head + band + rowsBlocks.length * (H + band + 4);
  const layers: sharp.OverlayOptions[] = [
    { input: Buffer.from(`<svg width="${W}" height="${head}" xmlns="http://www.w3.org/2000/svg"><text x="6" y="21" font-size="17" fill="#eee" font-family="Helvetica">${esc(def.title)} · ${ppm} px/m · left to right as seen from the street</text></svg>`), left: 0, top: 0 },
    { input: labelBand(band, numLabels), left: 0, top: head },
  ];
  rowsBlocks.forEach(([t, img], i) => { const top = head + band + i * (H + band + 4); layers.push({ input: blindHead(t), left: 0, top }, { input: img, left: 0, top: top + band }); });
  for (const { i, r } of rr) {
    const t = `re-read ${r.captured} (not the ${r.firstRead.captured ?? 'first'} read)`, w = Math.min(widths[i], 8 + t.length * 7);
    layers.push({ input: Buffer.from(`<svg width="${w}" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="20" fill="#f2c500"/><text x="4" y="14" font-size="12" font-weight="bold" fill="#000" font-family="Helvetica">${esc(t)}</text></svg>`), left: xs[i], top: head + band + band });
  }
  await sharp({ create: { width: W, height: total, channels: 3, background: '#111' } }).composite(layers).jpeg({ quality: 86 }).toFile(path.join(out, 'sheet.jpg'));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ row: id, ppm, drawn: { label: drawnLabel, env, specsDir: specsDir ?? null, sameAsToday: drawnIsToday }, members: def.members.map((m, i) => ({ ...m, photo: shown[i]?.file ?? null, captureNote: shown[i]?.note ?? null, capture: shown[i]?.capture ?? null, firstReadCapture: shown[i]?.firstReadCapture ?? null, ...(rereads[m.pandId] ? { reread: rereads[m.pandId] } : {}), drawnTopM: drawn.get(m.pandId)?.topM ?? null, todayTopM: today.get(m.pandId)?.topM ?? null })), missingCuts: missing }, null, 1));
  console.log(`${id}: ${def.members.length} fronts, ${missing.length} missing cuts, sheet ${path.join(out, 'sheet.jpg')}, blind pair ${path.join(out, 'blind')}`);
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
