/**
 * Pick the bounded panorama sample for the measured period walls (GitHub lane measured-period-walls-20261024):
 * per buurt group x report period, the pands already cropped (pand-reference-walls archive, kit-walls caches, this
 * lane's own crops) and a seeded draw of ordinary pands to fill each cell to `--per-cell`, at most `--max` new pands.
 *
 *   node --import tsx scripts/look/period-walls-sample.ts [--per-cell=10] [--max=300] [--crops=<dir>,...] [--period=canal] [--group=de-pijp] [--out=<json>]
 *
 * Writes artifacts/period-walls/sample.json: { existing: {pand: dir}, fetch: [pand...], cells: {...counts} }.
 * `--period=` / `--group=` draw only that report period's / buurt group's cells (GitHub #50: the canal period had 12 measured pands);
 * `--out=` writes elsewhere (artifacts/period-walls/canal-sample.json), so the original sample stays as it was.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BUURT_GROUPS, loadCity, reportPeriod, type CityBuilding } from './cityIndex.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const perCell = Number(arg('per-cell', '10')), max = Number(arg('max', '300')), onlyPeriod = arg('period'), onlyGroup = arg('group');
const SOURCE = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const cropRoots = arg('crops', [path.join(SOURCE, 'pand-reference-walls'), path.join(ROOT, 'artifacts/period-walls/crops')].join(',')).split(',').filter(d => fs.existsSync(d));

const covers = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/models/covers.json'), 'utf8'));
const covered = new Set<string>();
for (const m of Object.values(covers.models ?? {}) as { p?: string[] }[]) for (const p of m.p ?? []) covered.add(p.replace(/^NL\.IMBAG\.Pand\./, ''));
for (const m of Object.values(covers.buildingTypes ?? {}) as any[]) for (const p of (Array.isArray(m) ? m : m?.p ?? [])) covered.add(String(p).replace(/^NL\.IMBAG\.Pand\./, ''));

const existing = new Map<string, string>();
for (const root of cropRoots) for (const d of fs.readdirSync(root)) if (/^\d{16}$/.test(d) && fs.existsSync(path.join(root, d, 'walls.json')) && !existing.has(d)) existing.set(d, root);

const city = loadCity().filter(b => b.id.startsWith('NL.IMBAG.Pand.') && b.year !== null);
const key = (b: CityBuilding) => `${b.group}|${reportPeriod(b.year!)}`;
const cells = new Map<string, { all: CityBuilding[]; have: string[] }>();
for (const b of city) {
  const k = key(b), cell = cells.get(k) ?? cells.set(k, { all: [], have: [] }).get(k)!;
  const digits = b.id.slice(14);
  if (existing.has(digits)) cell.have.push(digits);
  // Ordinary candidates: a real building (not a shed or a podium sliver), not a model or a typed building.
  else if (b.heightM >= 6 && b.areaM2 >= 30 && b.areaM2 <= 4000 && !covered.has(digits)) cell.all.push(b);
}
// Seeded order: FNV of the id, so a rerun picks the same pands.
const fnv = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const perCellPicks: string[][] = [], report: Record<string, { population: number; have: number; draw: number }> = {};
const groups = [...Object.keys(BUURT_GROUPS)];
for (const [k, cell] of [...cells].sort()) {
  if (!groups.includes(k.split('|')[0]) || (onlyPeriod && k.split('|')[1] !== onlyPeriod) || (onlyGroup && k.split('|')[0] !== onlyGroup)) continue;
  const population = cell.all.length + cell.have.length;
  const draw = population >= 30 ? Math.max(0, perCell - cell.have.length) : 0;
  const picks = [...cell.all].sort((a, b) => fnv(a.id) - fnv(b.id)).slice(0, draw).map(b => b.id.slice(14));
  perCellPicks.push(picks);
  report[k] = { population, have: cell.have.length, draw: picks.length };
}
// Round-robin over the cells, so a --max cut thins every cell instead of dropping the last ones.
const fetch: string[] = [];
for (let i = 0; perCellPicks.some(p => i < p.length); i++) for (const p of perCellPicks) if (i < p.length) fetch.push(p[i]);
const out = path.resolve(ROOT, arg('out', 'artifacts/period-walls/sample.json'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ cropRoots, existing: Object.fromEntries(existing), fetch: fetch.slice(0, max), cells: report }, null, 1));
console.table(report);
console.log(`existing cropped pands ${existing.size}; to fetch ${Math.min(fetch.length, max)} (of ${fetch.length})`);
