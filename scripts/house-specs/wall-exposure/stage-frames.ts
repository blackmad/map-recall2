/**
 * Lane WC (#384): stage D1-style wall specs for pands that have a house:frames photo but no describer read (benchmark-v2),
 * so the wall-exposure options can be framed on them. Per pand: the W1 sample is the frame's photo wall (pose.json
 * lab.photo, analyse.ts wallLab), the references are wallExposureRef on the same photo; the part stages `palette/brick`
 * = wallBrickFromSample(sample) and `facts/wallExposure` exactly as describer-d1/stage.ts does. No wall material (no read).
 *
 *   node --import tsx scripts/house-specs/wall-exposure/stage-frames.ts --poses <dir> --photos <dir> --out <dir> [--at 2026-11-13]
 *     --poses: <dir>/<key>.w1.json or <dir>/<key>/pose.json; --photos: <dir>/<key>.jpg or <dir>/<key>/photo.jpg
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frameFor } from '../../house-frames/pose.ts';
import { wallExposureRef } from '../../house-frames/analyse.ts';
import { emptySpec, setSpecField, specProblems } from '../../../src/canalRecall/houseSpec/spec.ts';
import { wallBrickFromSample, wallExposureFact } from '../describer-d1/stage.ts';

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const posesDir = opt('poses'), photosDir = opt('photos'), out = opt('out'), at = opt('at') ?? null;
if (!posesDir || !photosDir || !out) { console.error('stage-frames.ts --poses <dir> --photos <dir> --out <dir>'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const keys = fs.readdirSync(posesDir).map(f => f.replace(/\.w1\.json$/, '')).filter(k => fs.existsSync(path.join(posesDir, `${k}.w1.json`)) || fs.existsSync(path.join(posesDir, k, 'pose.json')));
const refs: Record<string, unknown> = {};
let n = 0;
for (const key of keys) {
  const pf = fs.existsSync(path.join(posesDir, `${key}.w1.json`)) ? path.join(posesDir, `${key}.w1.json`) : path.join(posesDir, key, 'pose.json');
  const phf = fs.existsSync(path.join(photosDir, `${key}.jpg`)) ? path.join(photosDir, `${key}.jpg`) : path.join(photosDir, key, 'photo.jpg');
  const p = JSON.parse(fs.readFileSync(pf, 'utf8')), hex = p.lab?.photo?.hex as string | undefined;
  if (!hex || !fs.existsSync(phf)) continue;
  const { data, info } = await sharp(phf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  if (img.width !== p.pose.width || img.height !== p.pose.height) { console.warn(`${key}: photo ${img.width}x${img.height} is not the pose's`); continue; }
  const ref = wallExposureRef(img, frameFor(p.pose), p.pose, p.wall);
  refs[key] = { sample: hex, ref };
  const id = String(p.pandId).replace(/^NL\.IMBAG\.Pand\./, '');
  const spec = emptySpec(id), prov = { source: 'streetlevel-measured' as const, confidence: 0.6, ref: `house:frames ${p.pick?.panoId ?? key}`, at };
  setSpecField(spec, 'palette/brick', wallBrickFromSample(hex.toLowerCase()).brick); spec.provenance['palette/brick'] = { ...prov };
  const fact = wallExposureFact(hex.toLowerCase(), ref);
  if (fact) { setSpecField(spec, 'facts/wallExposure', fact); spec.provenance['facts/wallExposure'] = { ...prov }; }
  const problems = specProblems(spec);
  if (problems.length) { console.warn(`${key}: ${problems.join('; ')}`); continue; }
  fs.writeFileSync(path.join(out, `${id}.json`), JSON.stringify(spec, null, 1) + '\n');
  n++;
}
fs.writeFileSync(path.join(path.dirname(path.resolve(out)), `${path.basename(out)}-refs.json`), JSON.stringify(refs, null, 1));
console.log(`stage-frames: ${n} of ${keys.length} staged -> ${out}`);
