/**
 * belt-review:measure-openings (belt-windows lane, 2026-11-22): each house's windows measured on its picked crop, storey by
 * storey, into the read's opening grid (houseLine/openingGrid.ts).
 *
 *   node --import tsx scripts/belt-review/measure-openings.ts <faceId> --detect [--only <house,...>] [--overlays <dir>]
 *     The pixel pass (beltReview/openingProfile.ts) over each storey band of the landmarks file: window boxes and bars,
 *     written to review-data/belt-review/<faceId>/opening-measures.json (a staging file: rows the lane has checked by eye
 *     and corrected keep their `by: 'eye'` boxes; --detect rewrites only rows still `pixel`). Overlays draw the boxes on
 *     the crop for the check.
 *   node --import tsx scripts/belt-review/measure-openings.ts <faceId> --apply
 *     The staged rows as each read's `openings` (frontM, storeyM, rows with bay centres, w, h, sill, head, panes, frame,
 *     surround, per-bay exceptions, method), on photo-read.json with an `openingsMeasured` note.
 *
 * Landmarks (y in full-resolution crop pixels, down from the top): `pavement`, `floors` (ground storey's top first,
 * upward), `top` (the top storey's top: the cornice zone's foot or the gable's eaves line). Seeded from pixel-measures.json
 * (scaled from the 1000 px crops the self-check sent), else stated by eye in the staging file.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { faceCrops } from './read-house.ts';
import { bandWindows, windowBars, type PxBox, type RgbImage } from '../../src/canalRecall/beltReview/openingProfile.ts';
import { openingGridProblems, type OpeningGrid, type OpeningLook, type OpeningRow, type PaneLayout } from '../../src/canalRecall/houseLine/openingGrid.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const SERVE = '/Users/blackmad/Code/map-recall2-worktrees/belt-review-serve';
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const faceId = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!faceId) { console.error('usage: measure-openings.ts <faceId> --detect|--apply [--only ids] [--overlays dir]'); process.exit(2); }
const faceDir = path.join(REPO, 'review-data/belt-review', faceId);
const stateDir = path.resolve(opt('state') ?? path.join(SERVE, 'review-data/belt-review', faceId));
const only = new Set((opt('only') ?? '').split(',').filter(Boolean));
const stageFile = path.join(faceDir, 'opening-measures.json');

/** A staged row: its boxes (full-resolution crop px, as seen), its look, how it was measured. */
export interface StagedRow {
  storey: number;
  boxes: PxBox[];
  bars?: Array<{ mullions: number[]; rails: number[] }>;
  head?: OpeningLook['head'];
  panes?: PaneLayout;
  frame?: string;
  sash?: string;
  surround?: OpeningLook['surround'];
  /** Per-bay look exceptions (by index in boxes). */
  except?: Record<string, Partial<Pick<OpeningLook, 'head' | 'panes' | 'frame' | 'sash' | 'surround'>>>;
  /** 'pixel': the boxes as the pass found them; 'eye': set or corrected by eye (`eyeFields` names which values when only
   *  some were). */
  by: 'pixel' | 'eye';
  eyeFields?: string[];
  /** Skip the row (an awning, a shopfront: nothing to measure). */
  skip?: boolean;
  /** A pixel row the lane checked on the overlay and kept as found. */
  checked?: boolean;
}
export interface StagedHouse {
  address: string;
  ppm: number;
  width: number;
  height: number;
  landmarks: { pavement: number; floors: number[]; top: number; by: string };
  rows: StagedRow[];
  note?: string;
}

const stage: { about: string; houses: Record<string, StagedHouse> } = fs.existsSync(stageFile)
  ? JSON.parse(fs.readFileSync(stageFile, 'utf8'))
  : { about: '', houses: {} };
stage.about = 'Belt windows lane: each house\'s windows on its picked crop (full-resolution px), storey by storey; built by scripts/belt-review/measure-openings.ts --detect (pixel pass, beltReview/openingProfile.ts), checked and corrected by eye (by: eye), applied to photo-read.json as `openings` by --apply.';

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const r2 = (x: number) => +x.toFixed(2), r3 = (x: number) => +x.toFixed(3);

async function rgbOf(file: string, span: [number, number]): Promise<RgbImage> {
  const m = await sharp(file).metadata();
  const left = Math.max(0, span[0]), width = Math.min(span[1], m.width!) - left;
  const { data, info } = await sharp(file).extract({ left, top: 0, width, height: m.height! }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/**
 * The lane's by-eye rows (opening-eye.json, keyed by address): per row the window columns [x0, x1] and the frame's top and
 * bottom [y0, y1] (full-resolution crop px; `ys` per bay where they differ), with the look read off the zoomed crop.
 * They replace the pixel pass's rows (by: eye), and an eye `landmarks` replaces the seeded lines.
 */
interface EyeRow extends Omit<StagedRow, 'boxes' | 'by'> { x: Array<[number, number]>; y: [number, number]; ys?: Record<string, [number, number]>; by?: 'pixel' | 'eye' }
if (opt('eye')) {
  const eye = JSON.parse(fs.readFileSync(path.resolve(opt('eye')!), 'utf8')) as Record<string, { landmarks?: { pavement: number; floors: number[]; top: number }; rows?: EyeRow[]; note?: string }>;
  for (const [address, e] of Object.entries(eye)) {
    if (address.startsWith('_')) continue;
    const h = Object.values(stage.houses).find(x => x.address === address);
    if (!h) { console.log(`${address}: not staged (run --detect first)`); continue; }
    if (e.landmarks) h.landmarks = { ...e.landmarks, by: 'eye' };
    if (e.note) h.note = e.note;
    for (const r of e.rows ?? []) {
      const { x, y, ys, by, ...look } = r;
      const boxes = x.map(([x0, x1], i) => { const [y0, y1] = ys?.[String(i)] ?? y; return { x0, x1, y0, y1 }; });
      h.rows = [...h.rows.filter(q => q.storey !== r.storey), { ...look, boxes, by: by ?? 'eye' }].sort((a, b) => a.storey - b.storey);
    }
  }
  fs.writeFileSync(stageFile, JSON.stringify(stage, null, 1) + '\n');
  console.log('eye rows merged');
}

if (argv.includes('--detect')) {
  const pm = JSON.parse(fs.readFileSync(path.join(faceDir, 'pixel-measures.json'), 'utf8')).houses as Record<string, { pavement: number; floors: number[]; corniceBottom: number }>;
  const overlays = opt('overlays');
  if (overlays) fs.mkdirSync(overlays, { recursive: true });
  for (const c of faceCrops(faceDir, stateDir)) {
    if (only.size && !only.has(c.house) && !only.has(c.address)) continue;
    const img = await rgbOf(c.file, c.spanPx);
    let h = stage.houses[c.house];
    if (!h) {
      const p = pm[c.house], s = Math.min(1, 1000 / Math.max(img.width, img.height)), k = 1 / s;
      h = { address: c.address, ppm: c.ppm, width: img.width, height: img.height,
        landmarks: p ? { pavement: Math.round(p.pavement * k), floors: p.floors.map(y => Math.round(y * k)), top: Math.round(p.corniceBottom * k), by: 'pixel-measures.json (scaled)' } : { pavement: 0, floors: [], top: 0, by: 'unset' }, rows: [] };
      stage.houses[c.house] = h;
    }
    Object.assign(h, { address: c.address, ppm: c.ppm, width: img.width, height: img.height });
    const L = h.landmarks;
    if (!L.pavement) { console.log(`${c.address}: no landmarks`); continue; }
    const lines = [L.pavement, ...L.floors, L.top];
    for (let st = 0; st < lines.length - 1; st++) {
      const old = h.rows.find(r => r.storey === st);
      if (old && (old.by === 'eye' || old.skip)) continue;
      const band = bandWindows(img, { y0: lines[st + 1], y1: lines[st] }, c.ppm);
      const boxes = band.windows, frame = Math.max(2, Math.round(c.ppm * 0.07));
      const row: StagedRow = { storey: st, boxes, bars: boxes.map(b => windowBars(img, b, frame)), by: 'pixel' };
      h.rows = [...h.rows.filter(r => r.storey !== st), row].sort((a, b) => a.storey - b.storey);
    }
    if (overlays) await overlay(c.file, c.spanPx, h, path.join(overlays, `${c.address.replace(/[^\w]+/g, '-')}.jpg`));
    console.log(`${c.address.padEnd(18)} ${h.rows.map(r => `${r.storey}:${r.skip ? 'skip' : r.boxes.length}${r.by === 'eye' ? 'e' : ''}`).join(' ')}`);
  }
  fs.writeFileSync(stageFile, JSON.stringify(stage, null, 1) + '\n');
}

/** The crop with the landmarks (blue lines) and the staged boxes (green: pixel, orange: eye) drawn on it. */
export async function overlay(file: string, span: [number, number], h: StagedHouse, out: string): Promise<void> {
  const m = await sharp(file).metadata(), left = Math.max(0, span[0]), width = Math.min(span[1], m.width!) - left;
  const L = h.landmarks, lines = [L.pavement, ...L.floors, L.top].filter(y => y > 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${m.height}">${lines.map(y => `<line x1="0" x2="${width}" y1="${y}" y2="${y}" stroke="#2a7fff" stroke-width="2"/>`).join('')}${h.rows.flatMap(r => r.skip ? [] : r.boxes.map(b => `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="none" stroke="${r.by === 'eye' ? '#ff8c00' : '#00e000'}" stroke-width="2"/>`)).join('')}</svg>`;
  await sharp(file).extract({ left, top: 0, width, height: m.height! }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 85 }).toFile(out);
}

/**
 * Where the measured crop sits on the pand's BAG span in the photo (metres from its start, and the span's length): the
 * renderer draws the whole BAG front and frames the photo's facade span on it, so a crop cut narrower than the BAG span
 * (Herengracht 70: 4.17 m of a 6.38 m span) has its bay centres moved onto the span's frame. Null when they agree.
 */
export function pandFrame(pandId: string, widthPx: number): { offM: number; pandM: number } | null {
  const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const cands = json(path.join(stateDir, 'candidates.json')) as { pands: Array<{ pandId: string; candidates: Array<{ id: string; ppm?: number; pandSpanPx?: [number, number] }> }> };
  const pk = (json(path.join(stateDir, 'picks.json')).picks as Record<string, { candidateId: string | null; facadeSpanPx?: [number, number] }>)[pandId];
  const c = pk?.candidateId ? cands.pands.find(x => x.pandId === pandId)?.candidates.find(x => x.id === pk.candidateId) : undefined;
  if (!c?.pandSpanPx || !pk?.facadeSpanPx) return null;
  const ppm = c.ppm ?? 50, [p0, p1] = c.pandSpanPx, [f0, f1] = pk.facadeSpanPx;
  if (Math.abs((f1 - f0) - widthPx) > 3) return null; // the staged crop is not this facade span
  if (Math.abs(f0 - p0) < 0.1 * ppm && Math.abs(f1 - p1) < 0.1 * ppm) return null;
  return { offM: r2((f0 - p0) / ppm), pandM: r2((p1 - p0) / ppm) };
}

/**
 * Belt windows 2: the photo's front line under a staged house's grid (lng/lat, left to right as seen): the wall the photo
 * was cut on (walls.json), cut to the measured crop (David's facade edges, or a split house's metres along the BAG span),
 * or the whole wall where the grid was moved onto the pand's span (`frame`). Null without a wall.
 */
export function frontLineOf(house: string, widthPx: number, frame: { offM: number; pandM: number } | null): [number, number, number, number] | null {
  const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const wallsFile = path.join(faceDir, 'walls.json');
  if (!fs.existsSync(wallsFile)) return null;
  const pandId = house.split('#')[0], part = house.includes('#') ? Number(house.split('#')[1]) : 0;
  const wall = (json(wallsFile).walls as Record<string, { a: [number, number]; b: [number, number]; lengthM: number }>)[pandId];
  if (!wall || !(wall.lengthM > 0.5)) return null;
  const r8 = (x: number) => +x.toFixed(8), at = (m: number): [number, number] => { const t = m / wall.lengthM; return [r8(wall.a[0] + (wall.b[0] - wall.a[0]) * t), r8(wall.a[1] + (wall.b[1] - wall.a[1]) * t)]; };
  const whole: [number, number, number, number] = [r8(wall.a[0]), r8(wall.a[1]), r8(wall.b[0]), r8(wall.b[1])];
  if (frame) return whole;
  const cands = json(path.join(stateDir, 'candidates.json')) as { pands: Array<{ pandId: string; candidates: Array<{ id: string; ppm?: number; pandSpanPx?: [number, number] }> }> };
  const pk = (json(path.join(stateDir, 'picks.json')).picks as Record<string, { candidateId: string | null; facadeSpanPx?: [number, number]; houses?: Array<{ fromM: number; toM: number }> }>)[pandId];
  const c = pk?.candidateId ? cands.pands.find(x => x.pandId === pandId)?.candidates.find(x => x.id === pk.candidateId) : undefined;
  const ppm = c?.ppm ?? 50, p0 = c?.pandSpanPx?.[0];
  if (part) {
    const hs = pk?.houses?.[part - 1];
    return hs ? [...at(hs.fromM), ...at(hs.toM)] : null;
  }
  const fs0 = pk?.facadeSpanPx;
  if (fs0 && p0 !== undefined && Math.abs((fs0[1] - fs0[0]) - widthPx) <= 3) return [...at((fs0[0] - p0) / ppm), ...at((fs0[1] - p0) / ppm)];
  return whole;
}

/** A staged house's opening grid (null when it has no usable row). */
export function gridOf(h: StagedHouse, frame?: { offM: number; pandM: number } | null): OpeningGrid | null {
  const L = h.landmarks, lines = [L.pavement, ...L.floors, L.top], ppm = h.ppm;
  const storeyM = lines.slice(1).map((y, i) => r2((lines[i] - y) / ppm));
  const rows: OpeningRow[] = [];
  for (const r of h.rows) {
    // A pixel row counts only once checked by eye on the overlay (its boxes kept as found: `checked`).
    if (r.skip || !r.boxes.length || r.storey >= storeyM.length || (r.by === 'pixel' && !r.checked)) continue;
    const boxes = [...r.boxes].sort((a, b) => a.x0 - b.x0), floor = lines[r.storey];
    const ws = boxes.map(b => (b.x1 - b.x0) / ppm), hs = boxes.map(b => (b.y1 - b.y0) / ppm), sills = boxes.map(b => (floor - b.y1) / ppm);
    const w = r2(median(ws)), hh = r2(median(hs)), sill = r2(median(sills));
    const except: Record<string, Partial<OpeningLook>> = {};
    boxes.forEach((b, i) => {
      const e: Partial<OpeningLook> = { ...(r.except?.[String(i)] ?? {}) };
      if (Math.abs(ws[i] - w) > 0.1) e.w = r2(ws[i]);
      if (Math.abs(hs[i] - hh) > 0.12) e.h = r2(hs[i]);
      if (Math.abs(sills[i] - sill) > 0.12) e.sill = r2(sills[i]);
      if (Object.keys(e).length) except[String(i)] = e;
    });
    const xs = boxes.map(b => (b.x0 + b.x1) / 2 / h.width), across = frame ? xs.map(s => (frame.offM + s * h.width / ppm) / frame.pandM) : xs;
    const row: OpeningRow = { storey: r.storey, x: across.map(r3), w, h: hh, sill,
      ...(r.head ? { head: r.head } : {}), ...(r.panes ? { panes: r.panes } : {}), ...(r.frame ? { frame: r.frame } : {}), ...(r.sash ? { sash: r.sash } : {}), ...(r.surround ? { surround: r.surround } : {}),
      ...(Object.keys(except).length ? { except } : {}),
      by: r.by === 'eye' && r.eyeFields?.length ? { all: 'pixel', ...Object.fromEntries(r.eyeFields.map(f => [f, 'eye'])) } : r.by };
    rows.push(row);
  }
  if (!rows.length) return null;
  if (frame) return { frontM: frame.pandM, storeyM, rows, note: `bay centres moved from the ${r2(h.width / ppm)} m facade crop onto the pand's ${frame.pandM} m photo span (crop starts ${frame.offM} m in)` };
  return { frontM: r2(h.width / ppm), storeyM, rows };
}

if (argv.includes('--apply')) {
  const readFile = path.join(faceDir, 'photo-read.json'), rf = JSON.parse(fs.readFileSync(readFile, 'utf8'));
  let n = 0;
  for (const [house, h] of Object.entries(stage.houses)) {
    if (only.size && !only.has(house) && !only.has(h.address)) continue;
    const frame = house.includes('#') ? null : pandFrame(house, h.width), a = rf.reads[house]?.answer, g = gridOf(h, frame);
    const line = g ? frontLineOf(house, h.width, frame) : null;
    if (g && line) g.line = line;
    if (!a || !g) { console.log(`${h.address}: ${a ? 'no rows' : 'no read'}`); continue; }
    const p = openingGridProblems(g);
    if (p.length) { console.log(`${h.address}: ${p.join('; ')}`); continue; }
    a.openings = g;
    const methods = h.rows.filter(r => !r.skip).map(r => `${r.storey}:${r.by}${r.eyeFields?.length ? `(${r.eyeFields.join('+')})` : ''}`);
    a.openingsMeasured = { by: 'claude lane belt-windows (pixel pass + eye)', at: '2026-11-22', landmarks: h.landmarks.by, rows: methods, ...(h.note ? { note: h.note } : {}) };
    n++;
    console.log(`${h.address.padEnd(18)} ${g.rows.map(r => `${r.storey}:${r.x.length}x${r.w}x${r.h}@${r.sill}`).join(' ')}`);
  }
  fs.writeFileSync(readFile, JSON.stringify(rf, null, 1) + '\n');
  console.log(`applied openings to ${n} reads`);
}

if (opt('overlays') && !argv.includes('--detect')) {
  const dir = opt('overlays')!;
  fs.mkdirSync(dir, { recursive: true });
  for (const c of faceCrops(faceDir, stateDir)) {
    const h = stage.houses[c.house];
    if (!h || (only.size && !only.has(c.house) && !only.has(c.address))) continue;
    await overlay(c.file, c.spanPx, h, path.join(dir, `${c.address.replace(/[^\w]+/g, '-')}.jpg`));
  }
}
