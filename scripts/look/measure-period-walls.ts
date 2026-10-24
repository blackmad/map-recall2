/**
 * The measured wall mix per period and buurt group, from rectified panorama crops (lane measured-period-walls,
 * 2026-10-24: "these buildings are basically all the same colour — are we doing too much false colouring?").
 *
 *   node --import tsx scripts/look/measure-period-walls.ts [--publish]
 *
 * Reads the crops artifacts/period-walls/sample.json lists (pand-reference-walls archive + this lane's own
 * all-walls.ts crops), measures each crop with the kit facts' reading (scripts/lib/cropWallReading.ts: light-trim
 * white balance, leaf/olive masking, dominant wall cluster, masonry family) and combines a pand's crops with
 * combineBrickTones. Bespoke landmark models (covers.json models) are left out: they are not the ordinary city.
 *
 * Writes artifacts/period-walls/measured.json (every pand, every crop and why it was dropped) and prints the
 * distribution tables; --publish writes src/canalRecall/look/measuredPeriodWalls.ts (display hexes per period, via
 * kitFacts.measuredWallDisplay, the transform the measured school walls use).
 */
import fs from 'node:fs';
import path from 'node:path';
import { combineBrickTones, rgbToLab } from '../../src/canalRecall/look/brickTone.ts';
import { masonryFamily } from '../../src/canalRecall/facade/cropWallColour.ts';
import { rgbToHex, type Period } from '../../src/canalRecall/look/palette.ts';
import { measuredWallDisplay } from '../../src/canalRecall/kitFacts.ts';
import { readCropWall, type CropReading } from '../lib/cropWallReading.ts';
import { loadCity, reportPeriod, type ReportPeriod } from './cityIndex.ts';
import { wallClassOf, type WallClass } from '../../src/canalRecall/look/measuredWalls.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/period-walls/sample.json'), 'utf8')) as { existing: Record<string, string> };
const ownCrops = path.join(ROOT, 'artifacts/period-walls/crops');
const covers = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/models/covers.json'), 'utf8'));
const landmark = new Set<string>();
for (const m of Object.values(covers.models ?? {}) as { p?: string[] }[]) for (const p of m.p ?? []) landmark.add(p.replace(/^NL\.IMBAG\.Pand\./, ''));

const roots = new Map<string, string>(Object.entries(sample.existing));
if (fs.existsSync(ownCrops)) for (const d of fs.readdirSync(ownCrops)) if (/^\d{16}$/.test(d) && !roots.has(d)) roots.set(d, ownCrops);
const city = new Map(loadCity().map(b => [b.id.slice(14), b]));

type PandRow = { pand: string; year: number | null; period: ReportPeriod | null; group: string; source: string; landmark: boolean; raw: string | null; cls: WallClass | null; display: string | null; L?: number; C?: number; h?: number; crops: CropReading[] };
const rows: PandRow[] = [];
// --reuse: classify the readings measured.json already holds (the crop reading is the slow part: ~14 min).
const reuse = process.argv.includes('--reuse') ? JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/period-walls/measured.json'), 'utf8')) as PandRow[] : null;
if (reuse) for (const r of reuse) {
  const rgb = r.raw ? hexRgb(r.raw) : null;
  rows.push({ ...r, cls: rgb ? wallClassOf(rgb) : null, display: r.raw ? measuredWallDisplay(r.raw) : null });
}
for (const [digits, root] of reuse ? [] : roots) {
  const json = path.join(root, digits, 'walls.json');
  const walls = JSON.parse(fs.readFileSync(json, 'utf8')).walls ?? [];
  const crops: CropReading[] = [], tones: number[][] = [];
  for (const w of walls) {
    const file = path.join(root, digits, `${w.tag}.jpg`);
    if (!fs.existsSync(file)) continue;
    const reading: CropReading = { file: path.relative(ROOT, file), tag: w.tag, foliage: typeof w.foliage === 'number' ? w.foliage : null, used: false };
    crops.push(reading);
    const rgb = await readCropWall(file, w, reading);
    if (rgb) tones.push(rgb);
  }
  const b = city.get(digits), year = b?.year ?? null;
  const rgb = tones.length ? combineBrickTones(tones) : null;
  const [L, a, bb] = rgb ? rgbToLab(rgb) : [0, 0, 0];
  rows.push({
    pand: digits, year, period: year === null ? null : reportPeriod(year), group: b?.group ?? 'unknown', source: root === ownCrops ? 'lane-sample' : path.basename(root), landmark: landmark.has(digits),
    raw: rgb ? rgbToHex(rgb as [number, number, number]) : null, cls: rgb ? wallClassOf(rgb) : null, display: rgb ? measuredWallDisplay(rgbToHex(rgb as [number, number, number])) : null,
    ...(rgb ? { L: +L.toFixed(1), C: +Math.hypot(a, bb).toFixed(1), h: +(((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360).toFixed(0) } : {}), crops,
  });
}
if (!reuse) fs.writeFileSync(path.join(ROOT, 'artifacts/period-walls/measured.json'), JSON.stringify(rows, null, 1));

// --- Distribution ---------------------------------------------------------------------------------------------------
const ordinary = rows.filter(r => r.raw && r.period && !r.landmark);
const q = (v: number[], p: number) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
function summary(set: PandRow[]) {
  const n = set.length, share = (c: WallClass) => n ? Math.round((100 * set.filter(r => r.cls === c).length) / n) : 0;
  const brick = set.filter(r => r.cls === 'brick' || r.cls === 'brick-dull');
  return {
    N: n, 'brick %': share('brick'), 'dull brick %': share('brick-dull'), 'buff %': share('buff'), 'light paint/render %': share('render-light'), 'grey render/concrete %': share('render-grey'),
    'brick L* p25/50/75': brick.length ? `${q(brick.map(r => r.L!), 0.25).toFixed(0)}/${q(brick.map(r => r.L!), 0.5).toFixed(0)}/${q(brick.map(r => r.L!), 0.75).toFixed(0)}` : '',
    'brick hue p25/50/75': brick.length ? `${q(brick.map(r => r.h!), 0.25)}/${q(brick.map(r => r.h!), 0.5)}/${q(brick.map(r => r.h!), 0.75)}` : '',
    'brick median raw': brick.length ? rgbToHex(combineBrickTones(brick.map(r => hexRgb(r.raw!))) as [number, number, number]) : '',
  };
}
function hexRgb(h: string): number[] { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
const periods: ReportPeriod[] = ['canal', 'c19', 'school', 'postwar', 'modern'];
console.log(`pands read ${rows.length}; with a wall reading ${rows.filter(r => r.raw).length}; ordinary (not a landmark model) with year ${ordinary.length}`);
console.log('\nBy period'); console.table(Object.fromEntries(periods.map(p => [p, summary(ordinary.filter(r => r.period === p))])));
const groups = [...new Set(ordinary.map(r => r.group))].sort();
console.log('\nBy buurt group x period (cells with N >= 5)');
const cells: Record<string, unknown> = {};
for (const g of groups) for (const p of periods) { const set = ordinary.filter(r => r.group === g && r.period === p); if (set.length >= 5) cells[`${g} ${p}`] = summary(set); }
console.table(cells);

// --- Palette ---------------------------------------------------------------------------------------------------------
/** The palette's four periods; post-war and modern are reported apart but drawn from one list (see report). */
const PALETTE_OF: Record<ReportPeriod, Period> = { canal: 'canal', c19: 'c19', school: 'school', postwar: 'modern', modern: 'modern' };
/** Entries per period list: quantile picks, so each entry stands for 1/LIST_N of the measured pands. */
const LIST_N = 24;
/** Fewest measured pands for a period to replace its guessed list. */
const MIN_N = 30;
const lists: Record<Period, string[]> = { canal: [], c19: [], school: [], modern: [] };
const counts: Record<Period, number> = { canal: 0, c19: 0, school: 0, modern: 0 };
for (const period of ['canal', 'c19', 'school', 'modern'] as Period[]) {
  const set = ordinary.filter(r => PALETTE_OF[r.period!] === period);
  counts[period] = set.length;
  // Order by class then lightness, then take evenly spaced picks: the list keeps the measured class shares and the
  // lightness spread inside each class.
  const order: WallClass[] = ['brick', 'brick-dull', 'buff', 'render-grey', 'render-light'];
  const sorted = [...set].sort((a, b) => order.indexOf(a.cls!) - order.indexOf(b.cls!) || a.L! - b.L!);
  for (let i = 0; i < LIST_N && sorted.length; i++) lists[period].push(sorted[Math.floor(((i + 0.5) / LIST_N) * sorted.length)].display!);
}
console.log('\nPalette (display hexes)');
for (const [p, l] of Object.entries(lists)) console.log(p, counts[p as Period], l.join(' '));
if (process.argv.includes('--publish')) {
  const out = path.join(ROOT, 'src/canalRecall/look/measuredPeriodWalls.ts');
  const paintShare = Object.fromEntries((['canal', 'c19', 'school', 'modern'] as Period[]).map(p => {
    const set = ordinary.filter(r => PALETTE_OF[r.period!] === p);
    return [p, set.length ? +(set.filter(r => r.cls === 'render-light' || r.cls === 'render-grey').length / set.length).toFixed(3) : 0];
  }));
  fs.writeFileSync(out, `// Generated by scripts/look/measure-period-walls.ts --publish (${new Date().toISOString().slice(0, 10)}). Do not edit.
// Per period: ${LIST_N} wall colours, quantile picks over the measured ordinary pands (class, then L*), each the raw
// panorama reading (crop light-trim white balance, leaf masking, dominant wall cluster, combineBrickTones) lifted by
// kitFacts.measuredWallDisplay. N per period: ${JSON.stringify(counts)}.
import type { Period } from './palette.js';

// A period measured on fewer than ${MIN_N} pands keeps the guessed prior (null): its list would be noise.
export const MEASURED_PERIOD_WALL_LISTS: Readonly<Record<Period, readonly string[] | null>> = ${JSON.stringify(Object.fromEntries(Object.entries(lists).map(([p, l]) => [p, counts[p as Period] >= MIN_N ? l : null])))};
/** Share of the measured pands per period whose front is painted or rendered (light or dark/grey). */
export const MEASURED_PAINTED_SHARE: Readonly<Record<Period, number>> = ${JSON.stringify(paintShare)};
/** Pands measured per period. */
export const MEASURED_PERIOD_WALL_N: Readonly<Record<Period, number>> = ${JSON.stringify(counts)};
`);
  console.log(`wrote ${path.relative(ROOT, out)}`);
}
