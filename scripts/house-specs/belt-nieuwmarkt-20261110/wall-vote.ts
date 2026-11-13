/**
 * Leaf-off wall-colour vote for this lane's pands (coordinator ruling 2026-11-12: measured dark brick, no single-house
 * calibration). For each pand, every archived capture year from house:crops --all-years (<archive>/<pand>/years/<y>.jpg)
 * dated November-March is fitted with blockFace stripPalette.measureStripWallFit (foliage dropped, trim masked, dominant
 * cluster) and the fits are combined one vote per capture (wallFit.combineWallFits). The 2025-01-08 capture (low winter
 * sun, 11:30) votes only when no other leaf-off capture exists. Body band: the preview's 3DBAG eaves
 * (artifacts/house-preview/<pand>/measure.json heights.eavesM).
 *
 *   node --import tsx scripts/house-specs/belt-nieuwmarkt-20261110/wall-vote.ts --archive=<dir> --out=wall-votes.json <pand> ...
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {measureStripWallFit} from '../../../src/canalRecall/blockFace/stripPalette.ts';
import {combineWallFits, type WallFit} from '../../../src/canalRecall/blockFace/wallFit.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const archive = arg('archive')!, out = arg('out'), pands = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SUN = new Set(['2025-01-08']);
const leafOff = (d: string) => [11, 12, 1, 2, 3].includes(Number(d.slice(5, 7)));
const res: Record<string, unknown> = {};
for (const pand of pands) {
  const dir = path.join(archive, 'pand-crops', pand), meta = JSON.parse(fs.readFileSync(path.join(dir, 'front.json'), 'utf8'));
  const m = JSON.parse(fs.readFileSync(path.join('artifacts/house-preview', pand, 'measure.json'), 'utf8'));
  const eavesM: number = m.heights.eavesM;
  const votes: {date: string; fit: WallFit; sun: boolean}[] = [];
  for (const c of meta.candidates ?? []) {
    const f = c.file ? path.join(dir, c.file) : null;
    if (!f || !fs.existsSync(f) || !c.date || !leafOff(c.date)) continue;
    const {data, info} = await sharp(f).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const fit = measureStripWallFit({rgb: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height,
      x0: 0, x1: info.width, pixelsPerMetre: info.height / meta.crop.wallHeightM, eavesM}, {});
    if (fit) votes.push({date: c.date, fit, sun: SUN.has(c.date)});
  }
  const use = votes.some(v => !v.sun) ? votes.filter(v => !v.sun) : votes;
  const c = combineWallFits(use.map(v => v.fit));
  res[pand] = {hex: c?.hex ?? null, votes: use.map(v => ({date: v.date, hex: v.fit.hex})), sunOnly: use.length > 0 && use.every(v => v.sun), neutral: c?.neutral ?? false};
  console.log(pand, c?.hex ?? '-', use.map(v => `${v.date} ${v.fit.hex}`).join(', '));
}
if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
