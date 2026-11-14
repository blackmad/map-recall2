/**
 * house:frames rule 10, the Node side (lane TF, 2026-11-13): the likeness capture and its photo window, the as-played
 * rider, the job fields the browser spec reads, and the rule-10 sheets (photo | today | candidate, panels >= 700 px).
 * frames.ts calls in here only when a rule-10 flag is given (rule10.ts parseRule10), so a run without one is unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { directionToPixel } from '../../src/canalRecall/facade/rectify.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { frameFor, gridConvergenceDeg, rayFor, toPanoDirection, wallOutline, fpsFor, type FramePose, type Rd, type WallQuad } from './pose.ts';
import { loadEquirect, type PanoSize, type Rgb8 } from './photo.ts';
import type { PanoPick } from '../pand-reference/select.ts';
import { acrossWater, asPlayedPose, cameraCaption, chooseLikeness, engineOf, waterSegments, worldOf, CHASE_FOV_DEG, LIKENESS_VFOV_DEG, SHEET, type LikenessCandidate, type LikenessPose, type Rule10, type WaterSegs } from './rule10.ts';

/** What a prepared pose carries for its likeness frame (Prepared.likeness). */
export type LikenessPrep = {
  lp: LikenessPose;
  pano: { panoId: string; timestamp: string; distM: number; obliquityDeg: number; url: string };
  farBank: boolean;
  steppedBackM: number;
  note: string;
};

let water: WaterSegs | null = null;
function waterSegs(): WaterSegs {
  if (!water) {
    const file = 'public/data/extracts/amsterdam/water.json';
    water = fs.existsSync(file) ? waterSegments(JSON.parse(fs.readFileSync(file, 'utf8'))) : [];
  }
  return water;
}

const llOf = (c: PanoPick): [number, number] => [c.record.geometry.coordinates[0], c.record.geometry.coordinates[1]];
const napOf = (c: PanoPick) => { const pub = Number(c.record.geometry.coordinates[2]); return pub > 0 ? pub - 43.5 : null; };

/** The likeness capture among `ranked` (the wide search's captures, farthest reach `rule10.likenessMaxDistM`). */
export function pickLikeness(ranked: PanoPick[], own: PanoPick, wall: WallQuad, rule10: Rule10): { pick: PanoPick; prep: Omit<LikenessPrep, 'pano'> } | null {
  const list = ranked.some(c => c.panoId === own.panoId) ? ranked : [own, ...ranked];
  const segs = rule10.farBank ? waterSegs() : [];
  const cands: LikenessCandidate[] = list.map(c => ({ lngLat: llOf(c), cameraNap: napOf(c), distM: c.distM, id: c.panoId, farBank: rule10.farBank && acrossWater(lngLatToRd(llOf(c)), wall, segs) }));
  const choice = chooseLikeness(cands, list.findIndex(c => c.panoId === own.panoId), wall, { farBank: rule10.farBank });
  if (!choice) return null;
  return { pick: list[choice.index], prep: { lp: choice.lp, farBank: choice.farBank, steppedBackM: choice.steppedBackM, note: choice.note } };
}

/** Bilinear RGB lookup, wrapping horizontally (photo.ts sample). */
function sample(img: Rgb8, u: number, v: number, out: Uint8Array, o: number) {
  const W = img.width, H = img.height;
  const x0 = Math.floor(u - 0.5), y0 = Math.floor(v - 0.5), fx = u - 0.5 - x0, fy = v - 0.5 - y0;
  const xa = ((x0 % W) + W) % W, xb = (xa + 1) % W, ya = Math.max(0, Math.min(H - 1, y0)), yb = Math.max(0, Math.min(H - 1, y0 + 1));
  const d = img.data;
  for (let c = 0; c < 3; c++) {
    const p = d[(ya * W + xa) * 3 + c] * (1 - fx) + d[(ya * W + xb) * 3 + c] * fx;
    const q = d[(yb * W + xa) * 3 + c] * (1 - fx) + d[(yb * W + xb) * 3 + c] * fx;
    out[o + c] = p * (1 - fy) + q * fy;
  }
}

/** The panorama cut to the likeness window at `dpr`: the tall frame's top window rows, (W x H) * dpr pixels. */
export function cutWindow(img: Rgb8, lp: LikenessPose, dpr: number): Rgb8 {
  const pose: FramePose = { ...lp.pose, width: lp.pose.width * dpr, height: lp.pose.height * dpr };
  const frame = frameFor(pose), conv = gridConvergenceDeg(pose.lngLat);
  const W = lp.window.width * dpr, H = lp.window.height * dpr, out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [u, v] = directionToPixel(toPanoDirection(rayFor(frame, x + 0.5, y + 0.5), conv), img, 'centre');
    sample(img, u, v, out, (y * W + x) * 3);
  }
  return { width: W, height: H, data: out };
}

/** Cut and write `<dir>/likeness-photo.jpg`; false when the panorama did not load. */
export async function writeLikenessPhoto(pick: PanoPick, lp: LikenessPose, dpr: number, size: PanoSize, file: string): Promise<boolean> {
  const img = await loadEquirect(pick.record, size);
  if (!img) return false;
  const cut = cutWindow(img, lp, dpr);
  await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: 3 } }).jpeg({ quality: 88 }).toFile(file);
  return true;
}

/** The as-played rider for a list: the walls' outward normals point at their captures. */
export function asPlayedFor(prepared: Array<{ wall: WallQuad; pose: FramePose }>, backM: number): ReturnType<typeof asPlayedPose> {
  const walls = prepared.map(p => {
    const w = p.wall, vx = w.b.x - w.a.x, vy = w.b.y - w.a.y, l = Math.hypot(vx, vy) || 1;
    let nx = vy / l, ny = -vx / l;
    const mx = (w.a.x + w.b.x) / 2, my = (w.a.y + w.b.y) / 2;
    if ((p.pose.rd.x - mx) * nx + (p.pose.rd.y - my) * ny < 0) { nx = -nx; ny = -ny; }
    return { ...w, nx, ny };
  });
  return asPlayedPose(walls, prepared.map(p => p.pose.rd as Rd), backM);
}

/** The job's rule-10 fields (tests/e2e/house-frames.spec.ts reads them; absent on an old run). */
export type Rule10Job = {
  dpr: number;
  /** extra query for likeness pages: the pins (rule10Pins) and `trees3d=0` when trees are hidden */
  likenessQuery: string;
  /** extra query for as-played pages: the pins (absent on an older job, which then runs on the job's query alone) */
  asPlayedQuery?: string;
  asPlayed: Array<{ out: string; lngLat: [number, number]; headingDeg: number }>;
};

/**
 * The pins a rule-10 page needs so both columns of a sheet draw at `--dpr`: the pixel ratio asked (`dpr=`), the render
 * governor off and the quality tier forced high. Without them the own engine's tier probe (mid caps the ratio at 1.5)
 * and governor stepped likeness frames down under load, so one run's "today" drew at 2 and its candidate at 1.5
 * (retail-ground lane, 2026-11-14; block-page.ts FRAME_QUERY already pinned them for its runs). A pin the job's query
 * already names is left to the query.
 */
export function rule10Pins(query: string, dpr: number): string {
  const q = new URLSearchParams(query.replace(/^\?/, ''));
  return ([['dpr', String(dpr)], ['governor', '0'], ['tier', 'high']] as const).filter(([k]) => !q.has(k)).map(([k, v]) => `${k}=${v}`).join('&');
}
export type LikenessJobPose = { fps: Record<string, unknown>; width: number; height: number; windowH: number; lngLat: [number, number]; headingDeg: number };
export function likenessJobPose(l: LikenessPrep): LikenessJobPose {
  return { fps: fpsFor(l.lp.pose) as unknown as Record<string, unknown>, width: l.lp.pose.width, height: l.lp.pose.height, windowH: l.lp.window.height, lngLat: l.lp.pose.lngLat, headingDeg: l.lp.pose.headingDeg };
}

// ---- sheets ---------------------------------------------------------------------------------------------------------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (lines: string[], w: number, px: number, colour = '#eee') => Buffer.from(`<svg width="${w}" height="${Math.round(px * 1.45 * lines.length + px * 0.6)}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/>${lines.map((l, i) => `<text x="6" y="${Math.round(px * 1.15 + i * px * 1.45)}" font-family="Helvetica, Arial, sans-serif" font-size="${px}" fill="${colour}">${esc(l)}</text>`).join('')}</svg>`);
const capH = (n: number, px: number) => Math.round(px * 1.45 * n + px * 0.6);

/** A panel: the image fitted into panelW x panelH (letterboxed), or a grey "missing" card. */
async function panel(file: string | null, outline?: { lp: LikenessPose; wall: WallQuad }): Promise<Buffer> {
  const { panelW: W, panelH: H } = SHEET;
  if (!file || !fs.existsSync(file)) return sharp({ create: { width: W, height: H, channels: 3, background: '#2a2a2a' } }).composite([{ input: text(['not taken'], W, 16, '#999'), left: 0, top: Math.round(H / 2 - 12) }]).png().toBuffer();
  let img = sharp(file).removeAlpha();
  if (outline) {
    // The BAG wall outline in window px, drawn at the image's own scale.
    const meta = await sharp(file).metadata(), k = (meta.width ?? outline.lp.window.width) / outline.lp.window.width;
    const o = wallOutline(frameFor(outline.lp.pose), outline.lp.pose, outline.wall);
    if (o.every(Boolean)) {
      const pts = o.map(p => `${(p!.x * k).toFixed(1)},${(p!.y * k).toFixed(1)}`).join(' ');
      img = sharp(await img.composite([{ input: Buffer.from(`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="none" stroke="#00e5ff" stroke-width="${Math.max(2, 2 * k)}" stroke-opacity="0.85"/></svg>`) }]).png().toBuffer());
    }
  }
  return img.resize(W, H, { fit: 'contain', background: '#1d1d1d' }).png().toBuffer();
}

export type SheetRow = { title: string; captions: [string, string, string]; files: [string | null, string | null, string | null]; outline?: { lp: LikenessPose; wall: WallQuad } };

/** Rule-10 sheets: three columns (photo | today | candidate), SHEET.rowsPerSheet rows, each panel 720 x 450. */
export async function rule10Sheets(out: string, rows: SheetRow[], title: string): Promise<string[]> {
  const { panelW: W, panelH: H, gap, rowsPerSheet, captionPx: px } = SHEET, files: string[] = [];
  const sheetW = 3 * W + 4 * gap, rowCapH = capH(2, px), titleH = capH(1, px) + 2;
  for (let s = 0; s * rowsPerSheet < rows.length; s++) {
    const slice = rows.slice(s * rowsPerSheet, (s + 1) * rowsPerSheet), rowH = capH(1, px) + H + rowCapH + gap;
    const parts: OverlayOptions[] = [{ input: text([`${title} — sheet ${s + 1} of ${Math.ceil(rows.length / rowsPerSheet)}  (photo | today | candidate; cyan: BAG wall outline)`], sheetW, px + 2), left: 0, top: 0 }];
    for (const [i, r] of slice.entries()) {
      const top = titleH + i * rowH;
      parts.push({ input: text([r.title], sheetW, px, '#fff'), left: 0, top });
      const ps = await Promise.all(r.files.map((f, k) => panel(f, k === 0 || f ? r.outline : undefined)));
      ps.forEach((p, k) => parts.push({ input: p, left: gap + k * (W + gap), top: top + capH(1, px) }));
      r.captions.forEach((c, k) => parts.push({ input: text(wrap(c, 92), W, px - 2), left: gap + k * (W + gap), top: top + capH(1, px) + H }));
    }
    const file = path.join(out, `rule10-${s + 1}.jpg`);
    await sharp({ create: { width: sheetW, height: titleH + slice.length * rowH, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 78, mozjpeg: true }).toFile(file);
    files.push(file);
  }
  return files;
}

function wrap(s: string, n: number): string[] {
  const words = s.split(/\s+/), lines: string[] = [];
  let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

/** Caption of a likeness game frame, from what the browser recorded (`likeness.json`) and the prep. */
export function likenessCaption(query: string, dpr: number, measuredDpr: number | null, extraQuery: string): string {
  const q = [query.replace(/^\?/, ''), extraQuery].filter(Boolean).join('&');
  return cameraCaption({ camera: 'first person', vfovDeg: LIKENESS_VFOV_DEG, dpr: measuredDpr ?? dpr, engine: engineOf(query, true), world: worldOf(query) }) + (/trees3d=0/.test(q) ? '  |  trees hidden' : '');
}
export function asPlayedCaption(query: string, dpr: number, measuredDpr: number | null): string {
  return cameraCaption({ camera: 'chase', vfovDeg: CHASE_FOV_DEG, dpr: measuredDpr ?? dpr, engine: engineOf(query, false), world: worldOf(query) });
}
