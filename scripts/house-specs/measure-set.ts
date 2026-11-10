/**
 * Measure the street photo of every pand in a house-line set (lane H9): the pand-reference crop
 * (`staging/pand-reference/<pand>/front.jpg` or `front-alt.jpg`, from scripts/pand-reference/run.ts) read by
 * `buildingRecipe/measureFacade.ts` (the H2c wall-vs-trim reading, after the preview's pre-blur), inside the set's
 * reviewed wall box. Prints, per pand, the wall reading (normalised and raw), its colour family (houseSpec/wallColour.ts),
 * the display tint the wall-colour rule draws, window columns and the measured storey pitch, beside the set's reviewed
 * reads (storeys, bays, gable) so a reviewer sees both.
 *
 *   npx tsx scripts/house-specs/measure-set.ts scripts/house-specs/sets/easy-houses-20261110.json [--json <out>]
 *
 * Set entry: `photo: {crop: "front" | "front-alt", box?: [u0, u1, v0, v1] (metres: along the wall from the crop's
 * left, height above the crop's ground), why}`; `photo: null` = no usable crop (the pand keeps its other sources).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { measureBlurred } from '../house-preview/preview.ts';
import { storeyLines } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { specWallDisplay, wallColourFamily } from '../../src/canalRecall/houseSpec/wallColour.ts';

export const HELP = `measure-set <set.json> [--json <out>]: measureFacade on each pand's reviewed pand-reference crop (wall colour,
family, rule tint, columns, storey pitch) beside the set's reviewed storeys/bays/gable. Read-only.`;

export type SetPhoto = { crop: 'front' | 'front-alt'; box?: [number, number, number, number]; why?: string } | null;
export type SetPand = { pandId: string; label: string; cams: string[]; photo?: SetPhoto; review?: { storeys?: number; bays?: number; gable?: string; wall?: string; notes?: string } };
export type Reading = { pandId: string; crop: string; date: string | null; wall: string; rawWall: string; family: string; display: string; material: string | null; columns: number | null; windowColumns: number | null; storeyM: number | null; glazing: number; box: number[] };

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PPM = 50;

export async function measurePand(p: SetPand): Promise<Reading | null> {
  if (!p.photo) return null;
  const dir = path.join(ROOT, 'staging/pand-reference', p.pandId), file = path.join(dir, `${p.photo.crop}.jpg`);
  if (!fs.existsSync(file)) throw new Error(`${p.pandId}: no ${path.relative(ROOT, file)} (run scripts/pand-reference/run.ts --ids=${p.pandId})`);
  const ref = JSON.parse(fs.readFileSync(path.join(dir, 'reference.json'), 'utf8'));
  const shot = p.photo.crop === 'front' ? ref.primary : ref.alternate ?? ref.alt ?? ref.secondary ?? ref.primary;
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const topM = info.height / PPM, widthM = info.width / PPM;
  const box = p.photo.box ?? [Math.min(0.2, widthM / 4), widthM - Math.min(0.2, widthM / 4), 0, topM];
  const m = measureBlurred({ width: info.width, height: info.height, rgb: new Uint8Array(data), ppm: PPM, topM } as never, { u0: box[0], u1: box[1], v0: box[2], v1: Math.min(box[3], topM) }, storeyLines(Math.min(box[3], topM)));
  return {
    pandId: p.pandId, crop: p.photo.crop, date: shot?.timestamp?.slice(0, 10) ?? null, wall: m.wall.hex, rawWall: m.wall.rawHex, family: wallColourFamily(m.wall.hex), display: specWallDisplay(m.wall.hex),
    material: m.material?.family ?? null, columns: m.columns, windowColumns: m.windowColumns ?? null, storeyM: m.storeyM, glazing: +m.glazing.toFixed(2), box,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (!args[0] || args.includes('--help')) { console.log(HELP); process.exit(args[0] ? 0 : 1); }
  const set = JSON.parse(fs.readFileSync(args[0], 'utf8')) as { pands: SetPand[] };
  const out: (Reading | { pandId: string; photo: null })[] = [];
  for (const p of set.pands) {
    const r = await measurePand(p);
    out.push(r ?? { pandId: p.pandId, photo: null });
    const rv = p.review ?? {};
    console.log(r ? `${p.pandId} ${r.crop} ${r.date}  wall ${r.wall} (raw ${r.rawWall}) ${r.family} -> ${r.display}  material ${r.material}  columns ${r.windowColumns ?? r.columns ?? '-'} storeyM ${r.storeyM ?? '-'}  glazing ${r.glazing} (info)  | review storeys ${rv.storeys ?? '-'} bays ${rv.bays ?? '-'} gable ${rv.gable ?? '-'}`
      : `${p.pandId} no usable crop  | review ${JSON.stringify(rv)}`);
  }
  if (args.includes('--json')) fs.writeFileSync(args[args.indexOf('--json') + 1], JSON.stringify(out, null, 1));
}
