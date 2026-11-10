/**
 * Per-house wall colours of a block face from several leaf-off captures (lane H7 round 2, #354): blockFace/wallFit.ts
 * fitWallColour on each capture (foliage dropped, light trim masked, dominant cluster, brick/joint split, a dark painted
 * wall neutral), combined one vote per capture (combineWallFits). Prints a table and, with --json, one JSON line per pand.
 * It writes nothing: copy a reviewed `hex` into the face intent (`paletteOverrides.brick` on a type placement,
 * `design.palette.brick` on a design).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {houseIntents, type BlockFaceIntent} from '../../src/canalRecall/blockFace/intent.ts';
import {measureStripWallFit} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {combineWallFits, type WallFit} from '../../src/canalRecall/blockFace/wallFit.ts';

export const HELP = `scripts/block-face/wall-fit.ts: per-house wall colours of a face from several leaf-off captures.

  node --import tsx scripts/block-face/wall-fit.ts --face=<id> [--strips=<dir>,...] [--crops=<archive>/pand-crops]
                                                   [--years=2018,2021,2022] [--skip=<pand6>,...] [--json]

  --face=<id>        scripts/block-face/faces/<id>: its houses, pand facts (eaves) and painted walls (palette.wallMaterial
                     painted-*: a dark one is drawn neutral)
  --strips=<dir>     strip directories holding strip.jpg and strip.json (else the strip.json of the face of the same name);
                     e.g. staging/block-face/nassau-145-152-w2019 (intake.ts --date=2019-01-09 under a scratch face id,
                     its strip.json copied beside the image)
  --crops=<dir>      a house:crops pand-crops directory (crops --all-years: <pand>/years/<year>.jpg, front.json crop size)
  --years=<y,...>    which crop files to vote with (the file year; front.json candidates name the capture date), default
                     2018,2021,2022 (Nassaukade: 2019-01-09, 2021-03-24, 2022-04-26: leaf-off, no sun-washed spring days)
  --skip=<pand6,..>  pands whose crops frame the wrong wall (their strip votes still count)
  --json             one JSON line per pand: combined {hex, lab, votes, neutral} and every vote
  --help             this text`;

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (process.argv.includes('--help') || !arg('face')) { console.log(HELP); process.exit(arg('face') ? 0 : 2); }
const faceId = arg('face')!, FACES = 'scripts/block-face/faces';
const face: BlockFaceIntent = JSON.parse(fs.readFileSync(path.join(FACES, faceId, 'intent.json'), 'utf8'));
const painted = new Set(houseIntents(face).filter(i => /^painted/.test(String(i.palette.wallMaterial ?? ''))).map(i => i.pandId));
const years = (arg('years') ?? '2018,2021,2022').split(','), skip = new Set((arg('skip') ?? '').split(',').filter(Boolean));
const load = async (f: string) => { const {data, info} = await sharp(f).removeAlpha().raw().toBuffer({resolveWithObject: true}); return {rgb: new Uint8Array(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height}; };
const stripJson = (d: string) => fs.existsSync(path.join(d, 'strip.json')) ? path.join(d, 'strip.json') : path.join(FACES, path.basename(d), 'strip.json');
const strips = await Promise.all((arg('strips') ?? '').split(',').filter(Boolean).map(async d => ({json: JSON.parse(fs.readFileSync(stripJson(d), 'utf8')), img: await load(path.join(d, 'strip.jpg'))})));
for (const h of face.houses) {
  const pand = h.pandId, six = pand.slice(-6), isPainted = painted.has(pand);
  const hh = JSON.parse(fs.readFileSync(path.join(FACES, faceId, 'pands', pand, 'facts.json'), 'utf8')).heights, eavesM = hh.eavesM ?? hh.roofMinM;
  const votes: {src: string; fit: WallFit}[] = [];
  const crops = arg('crops');
  if (crops && !skip.has(six)) for (const y of years) {
    const dir = path.join(crops, pand), f = path.join(dir, 'years', `${y}.jpg`);
    if (!fs.existsSync(f)) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'front.json'), 'utf8')), img = await load(f);
    const date = (meta.candidates ?? []).find((c: {file?: string}) => c.file === `years/${y}.jpg`)?.date ?? y;
    const fit = measureStripWallFit({rgb: img.rgb, width: img.w, height: img.h, x0: 0, x1: img.w, pixelsPerMetre: img.h / meta.crop.wallHeightM, eavesM}, {painted: isPainted});
    if (fit) votes.push({src: `crop ${date}`, fit});
  }
  for (const s of strips) {
    const sp = s.json.spans.find((x: {pandId: string}) => x.pandId === pand);
    if (!sp) continue;
    const fit = measureStripWallFit({rgb: s.img.rgb, width: s.img.w, height: s.img.h, x0: sp.px[0], x1: sp.px[1], pixelsPerMetre: s.json.pixelsPerMetre, eavesM}, {painted: isPainted});
    if (fit) votes.push({src: `strip ${s.json.date}`, fit});
  }
  const c = combineWallFits(votes.map(v => v.fit));
  if (process.argv.includes('--json')) console.log(JSON.stringify({pand: six, address: h.address, painted: isPainted, combined: c, votes: votes.map(v => ({src: v.src, ...v.fit}))}));
  else console.log(`${six} ${String(h.address).padEnd(22)} ${isPainted ? 'painted' : 'brick  '} ${c?.hex ?? '-'} (${c?.votes ?? 0} votes) | ${votes.map(v => `${v.src} ${v.fit.hex}`).join(', ')}`);
}
