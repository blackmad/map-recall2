/**
 * Stage the terraced-house survey as build areas: terraces (classes.json from the survey: design, variant, photo, front bearing, hold reason)
 * are grouped into ~0.8 km cells; each cell becomes staging/building-types/<prefix>-NN/ via select-area.ts (--ids) plus a variants.json that
 * assigns every house its design/variant and the photo that covered its terrace, or holds it with the reason.
 *
 *   node --import tsx scripts/building-types/stage-terraces.ts --nw=<survey dir> [--classes=staging/building-types/rh-survey/classes.json] [--prefix=rh]
 *
 * Then per area: build.ts --area=rh-NN, camera-sheets.ts --sheets=..., and finally export-runtime.ts --areas=... --merge.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const nw = arg('nw'), classesFile = arg('classes', 'staging/building-types/rh-survey/classes.json'), prefix = arg('prefix', 'rh');
const CELL_LNG = Number(arg('cell-lng', '0.012')), CELL_LAT = Number(arg('cell-lat', '0.007'));
if (!nw) throw new Error('--nw required');
const classes = JSON.parse(fs.readFileSync(classesFile, 'utf8')) as {terrace: number; size: number; class: string; rep: string; via: string; photo: string | null; photoDate: string; frontBearingDeg: number | null; members: string[]; type?: string; variant?: string; hold?: string}[];
const terraces = JSON.parse(fs.readFileSync(path.join(path.dirname(classesFile), 'terraces.json'), 'utf8')).terraces as {terrace: number; centreLngLat: [number, number]}[];
const centre = new Map(terraces.map(t => [t.terrace, t.centreLngLat]));

const cells = new Map<string, typeof classes>();
for (const c of classes) {
  const [lng, lat] = centre.get(c.terrace)!;
  const key = `${Math.floor(lng / CELL_LNG)},${Math.floor(lat / CELL_LAT)}`;
  (cells.get(key) ?? cells.set(key, []).get(key)!).push(c);
}
const ordered = [...cells.entries()].sort(([a], [b]) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return ay - by || ax - bx; });
const summary: any[] = [];
ordered.forEach(([, list], idx) => {
  const area = `${prefix}-${String(idx + 1).padStart(2, '0')}`, dir = path.join('staging/building-types', area);
  const ids = list.flatMap(c => c.members);
  fs.mkdirSync('.cache/building-types', {recursive: true});
  const idsFile = `.cache/building-types/${area}-ids.json`;
  fs.writeFileSync(idsFile, JSON.stringify(ids));
  const idType = list.find(c => c.type)?.type ?? 'nw-rowhouse-garage-door';
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/building-types/select-area.ts', `--nw=${nw}`, `--area=${area}`, `--ids=${idsFile}`, `--idtype=${idType}`], {stdio: ['ignore', 'pipe', 'inherit']});
  const variants: Record<string, any> = {};
  for (const c of list) for (const id of c.members) {
    const base = {type: c.type ?? idType, ...(c.frontBearingDeg != null ? {frontBearingDeg: c.frontBearingDeg} : {})};
    variants[id] = c.type
      ? {...base, variant: c.variant, note: `terrace #${c.terrace} (${c.size} houses) covered by panorama ${c.photo} ${c.photoDate} via ${c.via}, representative pand ${c.rep}`}
      : {...base, hold: c.hold};
  }
  fs.writeFileSync(path.join(dir, 'variants.json'), JSON.stringify(variants, null, 1) + '\n');
  const assigned = list.filter(c => c.type).reduce((s, c) => s + c.size, 0), total = list.reduce((s, c) => s + c.size, 0);
  summary.push({area, houses: total, assigned, held: total - assigned});
  console.log(area, total, 'houses,', assigned, 'assigned,', total - assigned, 'held');
});
fs.writeFileSync(path.join(path.dirname(classesFile), 'areas.json'), JSON.stringify(summary, null, 1) + '\n');
