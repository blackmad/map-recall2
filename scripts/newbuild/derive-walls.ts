/**
 * Contemporary walls from the new-build panorama samples (scripts/newbuild/sample-panos.ts):
 *   node --import tsx scripts/newbuild/derive-walls.ts [staging/newbuild/pano-samples.json]
 *   -> src/canalRecall/contemporary-walls.json
 *
 * Each area keeps its measured walls, lifted by LIFT_L L* (the thumbnails are pitched up into shade; the buurt
 * profiles' city transform lifts thumb brick the same way, and the user asked for a brighter palette), and the
 * centre of its sampled pands so the runtime can pick the nearest area; `pands` keeps each sampled pand's own code. A wall of L* >= 72 after the lift is render
 * or panel (`p`), anything else brick (`b`), the modern-pand-walls code.
 */
import fs from 'node:fs';
import { labToRgb, rgbToLab } from '../../src/canalRecall/look/brickTone.ts';

const LIFT_L = 12;
const TAGS = JSON.parse(fs.readFileSync('scripts/newbuild/front-tags.json', 'utf8')) as { bands: Record<string, string>; tall: Record<string, string> };
const file = process.argv[2] ?? 'staging/newbuild/pano-samples.json';
const samples = JSON.parse(fs.readFileSync(file, 'utf8')).samples as { area: string; pand: string; wall: number[] }[];
const hex = (c: readonly number[]) => c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const centres = JSON.parse(fs.readFileSync('scripts/newbuild/area-centres.json', 'utf8')) as Record<string, [number, number]>;
const areas: Record<string, { centre: [number, number]; walls: string[] }> = {};
// Each sampled pand also keeps its own code: contemporaryLookFor draws it before any area draw (round 2).
const pands: Record<string, string> = {};
for (const s of samples) {
  const [L, a, b] = rgbToLab(s.wall);
  const lifted = labToRgb([Math.min(92, L + LIFT_L), a, b]);
  const code = `${rgbToLab(lifted)[0] >= 72 ? 'p' : 'b'}${hex(lifted)}`;
  (areas[s.area] ??= { centre: centres[s.area], walls: [] }).walls.push(code);
  pands[s.pand] = code;
}
const out = { schemaVersion: 1, licence: 'Gemeente Amsterdam panorama, CC BY 4.0', source: 'scripts/newbuild/sample-panos.ts (2005+ BAG pands, 2019+ panoramas)', liftL: LIFT_L, areas, pands, bands: Object.keys(TAGS.bands).sort(), tall: Object.keys(TAGS.tall).sort() };
fs.writeFileSync('src/canalRecall/contemporary-walls.json', `${JSON.stringify(out, null, 1)}\n`);
for (const [k, v] of Object.entries(areas)) console.log(k, v.walls.length, v.walls.filter(w => w[0] === 'p').length, 'painted');
