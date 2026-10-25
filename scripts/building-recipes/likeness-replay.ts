/**
 * Replay the likeness measurement over every photographed wall group, so a change to measureFacade.ts / likeness.ts is
 * judged by the verdicts it moves (gate vs review, #38, #48), not by the one house it was made for.
 *
 *   node --import tsx scripts/building-recipes/likeness-replay.ts --dump=<dir> [--houses=a,b]   # compile + snapshot
 *   node --import tsx scripts/building-recipes/likeness-replay.ts --replay=<dir> --out=<file.json> [--houses=a,b]
 *   node --import tsx scripts/building-recipes/likeness-replay.ts --diff=<before.json>,<after.json>
 *
 * --dump compiles each `kind: large` house (large.ts `compileLargeHouse`, no renders; needs MAP_RECALL_SOURCE_DATA)
 * and writes, per measured group, the photo mosaic (RGB + validity, metric), its box, the fit's storey lines, the
 * panel outline and the model elevation's mask and wall colours: everything `measureFacade` and `compareLikeness`
 * read. The model geometry is frozen in the dump; a measurement change is then replayed in seconds.
 * --replay re-measures every dumped group with the code in this checkout and writes verdicts and the judged numbers.
 * --diff prints the groups whose verdict or reasons moved (street-facing groups flagged as the install gate sees them).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {compileLargeHouse} from './large.ts';
import {measureFacade, analyseMask, type FacadeBox, type Rgb} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import {compareLikeness, PAD_M, type ModelElevation} from '../../src/canalRecall/buildingRecipe/likeness.ts';
import {streetFacing} from '../../src/canalRecall/buildingRecipe/likenessGate.ts';
import {insidePanel} from '../../src/canalRecall/blockBuilding/panels.ts';

const HOUSES = 'scripts/building-recipes/houses';
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);

interface GroupMeta {
  house: string; group: number; panel: number; system: string; street: boolean;
  image: {width: number; height: number; ppm: number; topM: number};
  photoBox: FacadeBox; lines: number[]; panelU0: number; polys: unknown;
  model: {cols: number; rows: number; cell: number; box: FacadeBox; wall: Rgb | null; wallToday: Rgb | null; glass: Rgb | null; wallSlot: string | null};
  obliquityDeg: number; cameraDistM: number; cameraSpanM?: number;
}

function houseIds(): string[] {
  const only = arg('houses')?.split(',').filter(Boolean);
  if (only?.length) return only;
  return fs.readdirSync(HOUSES).filter(id => {
    const f = path.join(HOUSES, id, 'intent.json');
    return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).kind === 'large';
  }).sort();
}

async function dump(dir: string) {
  if (!process.env.MAP_RECALL_SOURCE_DATA) throw Error('MAP_RECALL_SOURCE_DATA is unset: the likeness would silently not run');
  fs.mkdirSync(dir, {recursive: true});
  for (const id of houseIds()) {
    let res;
    try { res = await compileLargeHouse(id); } catch (e) { console.log(`${id}: compile error ${(e as Error).message.split('\n')[0]}`); continue; }
    const {intent, likeness, built} = res;
    if (!likeness) { console.log(`${id}: no likeness`); continue; }
    const facing = new Set(streetFacing(intent.walls.map((w: any, i: number) => ({group: i, system: w.system, street: w.street}))));
    let n = 0;
    for (const g of likeness) {
      if (g.status !== 'measured' || !g.photoImage || !g.model || !g.replay) continue;
      const {image, box: photoBox, lines} = g.photoImage, m: ModelElevation = g.model, p = built.panels[g.panel];
      const meta: GroupMeta = {house: id, group: g.group, panel: g.panel, system: intent.walls[g.group].system, street: facing.has(g.group),
        image: {width: image.width, height: image.height, ppm: image.ppm, topM: image.topM}, photoBox, lines, panelU0: g.box!.u0 - PAD_M, polys: p.polys,
        model: {cols: m.cols, rows: m.rows, cell: m.cell, box: m.box, wall: m.wall, wallToday: m.wallToday, glass: m.glass, wallSlot: m.wallSlot},
        obliquityDeg: g.replay.obliquityDeg, cameraDistM: g.replay.cameraDistM, ...(g.replay.cameraSpanM !== undefined ? {cameraSpanM: g.replay.cameraSpanM} : {})};
      const base = path.join(dir, `${id}.g${g.group}`);
      fs.writeFileSync(base + '.json', JSON.stringify(meta));
      fs.writeFileSync(base + '.bin', zlib.gzipSync(Buffer.concat([Buffer.from(image.rgb), Buffer.from(image.valid ?? new Uint8Array(image.width * image.height).fill(255)), Buffer.from(m.mask), Buffer.from(m.colours)]), {level: 1}));
      n++;
    }
    console.log(`${id}: ${n} groups`);
  }
}

/** One dumped group, re-measured with this checkout's code. */
export function replayGroup(meta: GroupMeta, bin: Buffer) {
  const {width, height} = meta.image, P = width * height, M = meta.model.cols * meta.model.rows;
  const rgb = new Uint8Array(bin.subarray(0, P * 3)), valid = new Uint8Array(bin.subarray(P * 3, P * 4));
  const mask = new Uint8Array(bin.subarray(P * 4, P * 4 + M)), colours = new Uint8Array(bin.subarray(P * 4 + M, P * 4 + M * 4));
  const panel = {polys: meta.polys} as Parameters<typeof insidePanel>[0];
  const inside = (u: number, v: number) => insidePanel(panel, [u + meta.panelU0, v]);
  const photo = measureFacade({image: {...meta.image, rgb, valid}, box: meta.photoBox, lines: meta.lines, inside});
  const grid = analyseMask({mask, cols: meta.model.cols, rows: meta.model.rows, cell: meta.model.cell, box: meta.model.box, lines: meta.lines});
  const model: ModelElevation = {...meta.model, mask, colours, grid};
  const likeness = compareLikeness({photo, padCells: Math.round(PAD_M / photo.cell), model, lines: meta.lines, obliquityDeg: meta.obliquityDeg, cameraDistM: meta.cameraDistM, cameraSpanM: meta.cameraSpanM});
  return {photo, model, likeness};
}

function replay(dir: string, out: string) {
  const only = arg('houses')?.split(',').filter(Boolean);
  const rows: Record<string, unknown> = {};
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  for (const f of files) {
    const meta: GroupMeta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (only?.length && !only.includes(meta.house)) continue;
    const t0 = performance.now();
    const {photo, likeness: L} = replayGroup(meta, zlib.gunzipSync(fs.readFileSync(path.join(dir, f.replace(/\.json$/, '.bin')))));
    if (process.argv.includes('--verbose')) console.log(`${f} ${(performance.now() - t0).toFixed(0)} ms`);
    rows[`${meta.house} walls[${meta.group}]`] = {street: meta.street, verdict: L.verdict, reasons: L.reasons,
      wall: `${L.wall.photo} vs ${L.wall.model} dL ${L.wall.dL} dHue ${L.wall.dHue}`, glazing: `${L.glazing.photo.map(v => v ?? '-').join('/')} vs ${L.glazing.model.map(v => v ?? '-').join('/')}`,
      columns: `${L.columns.windows?.photo ?? '-'} vs ${L.columns.windows?.model ?? '-'}`, shape: `${L.shape.photo} vs ${L.shape.model}`, iou: L.iou,
      photo: {wall: photo.wall.hex, glass: photo.glass?.hex ?? null, pitchM: photo.pitchM, window: photo.window, glazing: photo.glazing}};
  }
  fs.writeFileSync(out, JSON.stringify(rows, null, 1) + '\n');
  const count: Record<string, number> = {};
  for (const r of Object.values(rows) as {verdict: string}[]) count[r.verdict] = (count[r.verdict] ?? 0) + 1;
  console.log(`${Object.keys(rows).length} groups: ${JSON.stringify(count)} -> ${out}`);
}

function diff(a: string, b: string) {
  const A = JSON.parse(fs.readFileSync(a, 'utf8')), B = JSON.parse(fs.readFileSync(b, 'utf8'));
  let verdicts = 0, reasons = 0, same = 0;
  const moved: string[] = [];
  for (const k of Object.keys(B)) {
    const x = A[k], y = B[k]; if (!x) continue;
    if (x.verdict !== y.verdict) { verdicts++; moved.push(`${y.street ? 'STREET ' : '       '}${k}: ${x.verdict} -> ${y.verdict}\n    before: ${x.reasons.join('; ')}\n    after:  ${y.reasons.join('; ')}`); }
    else if (JSON.stringify(x.reasons) !== JSON.stringify(y.reasons)) { reasons++; moved.push(`  (reasons) ${k}: ${x.verdict}\n    before: ${x.reasons.join('; ')}\n    after:  ${y.reasons.join('; ')}`); }
    else same++;
  }
  console.log(moved.join('\n'));
  console.log(`${Object.keys(B).length} groups: ${verdicts} verdicts moved, ${reasons} reason-only, ${same} same`);
}

if (process.argv[1]?.endsWith('likeness-replay.ts')) {
  const d = arg('dump'), r = arg('replay'), df = arg('diff');
  if (d) await dump(d);
  else if (r) replay(r, arg('out') ?? 'likeness-replay.json');
  else if (df) diff(...(df.split(',') as [string, string]));
  else throw Error('Use --dump=<dir>, --replay=<dir> --out=<file> or --diff=<a>,<b>');
  process.exit(0);
}
