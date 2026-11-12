/**
 * Where do the pale and grey entries of a buurt profile's c19 wall pool come from? (lane #373, 2026-11-12)
 *
 *   node --import tsx scripts/house-specs/oudwest-profile-trace.ts [--samples=<pano-samples.json>] [--buurt=ES01,ET01,...]
 *
 * Profile walls (buurtProfiles/buurt-profiles.json) are 10 lightness slices of the samples of one buurt and era
 * (scripts/buurt-profiles/derive.ts `familySwatches`: brick and paint slices apart, slots in proportion to their counts). The
 * published JSON keeps only the slice medians, so this rebuilds the slices from the panorama-thumbnail samples
 * (`staging/buurt-profiles/pano-samples.json`: pand, thumbnail URL, raw wall, light trim) with derive's own typed calls
 * (`classifyWall`, `cityTrimLevel`, `masonryFamily`) and lists the pands behind each slice. Thumbnails only: the archived
 * panorama walls and block-face strips of the same buurt are not in the staging file, so slice membership is approximate
 * (the printed `n` against the profile's `n` says by how much). Slices are cut on the raw thumbnail L*: derive's calibration is
 * one monotone transform per source, so the order holds.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { classifyWall, cityTrimLevel } from '../../src/canalRecall/buurtProfiles/paintClass.ts';
import { masonryFamily, lch } from '../../src/canalRecall/facade/cropWallColour.ts';
import { periodForYear } from '../../src/canalRecall/look/palette.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXT = path.join(ROOT, 'public/data/extracts/amsterdam');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const samplesFile = arg('samples', path.join(process.env.HOME ?? '', 'Code/map-recall2-worktrees/profiles-citywide-20261107/staging/buurt-profiles/pano-samples.json'));
const codes = arg('buurt', 'ES01,ET01,EN02,EQ01,EP01').split(',');
const readGz = (f: string) => { const b = fs.readFileSync(f); return JSON.parse((b[0] === 0x1f ? zlib.gunzipSync(b) : b).toString('utf8')); };

const rows = JSON.parse(fs.readFileSync(samplesFile, 'utf8')).samples as any[];
const PANO_TRIM = cityTrimLevel(rows.filter(r => !r.skipped && r.wall).map(r => r.lightTrim));
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/buurtProfiles/buurt-profiles.json'), 'utf8')).profiles as any[];
// pand -> year (building-facts tiles keyed P<id>)
const years = new Map<string, number>();
const fdir = path.join(EXT, 'building-facts/14');
for (const x of fs.readdirSync(fdir)) for (const f of fs.readdirSync(path.join(fdir, x))) for (const [k, v] of Object.entries<any>(readGz(path.join(fdir, x, f)).buildings)) years.set(k.slice(1), v[0]);

const slices = <T extends { L: number }>(list: T[], slots: number): T[][] => {
  const sorted = [...list].sort((a, b) => a.L - b.L), k = Math.min(slots, sorted.length), out: T[][] = [];
  for (let i = 0; i < k; i++) out.push(sorted.slice(Math.floor(i * sorted.length / k), Math.floor((i + 1) * sorted.length / k)));
  return out;
};
const hex = (rgb: number[]) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

for (const code of codes) {
  const prof = profiles.find(p => p.code === code && p.level === 'buurt');
  if (!prof?.eras?.c19?.walls) { console.log(`${code}: no c19 buurt profile`); continue; }
  const mine = rows.filter(r => r.buurt === code && !r.skipped && r.wall && years.has(r.pand) && periodForYear(years.get(r.pand)!) === 'c19');
  const samples = mine.flatMap(r => {
    const cls = classifyWall(r.wall, r.lightTrim, PANO_TRIM);
    if (!cls.painted && !masonryFamily(r.brick) && lch(r.brick).C >= 4) return [];
    const rgb = cls.painted ? cls.normalised : r.brick;
    return [{ pand: r.pand, url: r.url as string, painted: cls.painted, via: cls.via, wall: hex(r.wall), brick: hex(r.brick), L: lch(rgb).L, shown: hex(rgb) }];
  });
  const paint = samples.filter(s => s.painted), brick = samples.filter(s => !s.painted);
  const kp = paint.length && brick.length ? Math.max(1, Math.min(9, Math.round(10 * paint.length / samples.length))) : 0;
  const brickSlices = slices(brick, brick.length && paint.length ? 10 - kp : 10), paintSlices = slices(paint, paint.length && brick.length ? kp : 10);
  console.log(`\n## ${code} ${prof.name} c19: profile n ${prof.eras.c19.n}, thumbnail samples rebuilt ${samples.length} (brick ${brick.length}, painted ${paint.length}; painted share in profile ${prof.eras.c19.paintedShare})`);
  console.log('profile walls:', prof.eras.c19.walls.map((w: any) => w[0]).join(' '));
  const show = (label: string, sl: typeof samples[]) => sl.forEach(s => console.log(`${label} slice (${s.length}): L ${s[0].L.toFixed(0)}-${s[s.length - 1].L.toFixed(0)}: ` + s.map(x => `${x.pand.slice(-6)}[${x.brick}${x.painted ? ` painted via ${x.via}` : ''} ${x.url.match(/panoramas?\/([^/]+)\/|thumbnail\/([^/]+)\//)?.[0]?.split('/')[1] ?? ''}]`).join(' ')));
  show('brick', brickSlices.slice(-2)); show('paint', paintSlices);
}
