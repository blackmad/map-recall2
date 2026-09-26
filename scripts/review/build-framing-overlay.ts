/** Draw the detected facade bounds on case crops, for the centering group.
 * Diagnostic: shows where the heuristic thinks the building sits versus the crop centre.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { columnEdgeProfile, detectFacadeBounds } from '../../src/canalRecall/facade/facadeCentering.ts';

const CASES = ['case-30', 'case-20', 'case-06', 'case-14'];
const cases = JSON.parse(await fs.readFile('public/data/facade-repair-preview/cases.json', 'utf8')).cases as any[];
const EVIDENCE = 'public/data/city-expansion/evidence';
const PANEL_HEIGHT = 640;

const panels: Buffer[] = [];
for (const caseId of CASES) {
  const item = cases.find((entry) => entry.caseId === caseId);
  const sha = (item?.candidateObservations ?? []).find((entry: any) => entry.images?.full?.sha256)?.images?.full?.sha256;
  if (!sha) continue;
  const file = path.join(EVIDENCE, `${sha}.jpg`);
  const decoded = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const bounds = detectFacadeBounds(columnEdgeProfile({ data: new Uint8Array(decoded.data), width: decoded.info.width, height: decoded.info.height }));
  const w = decoded.info.width, h = decoded.info.height;
  const lines = bounds
    ? `<line x1="${bounds.leftPx}" y1="0" x2="${bounds.leftPx}" y2="${h}" stroke="#00e0a0" stroke-width="2"/>
       <line x1="${bounds.rightPx}" y1="0" x2="${bounds.rightPx}" y2="${h}" stroke="#00e0a0" stroke-width="2"/>
       <line x1="${bounds.centrePx}" y1="0" x2="${bounds.centrePx}" y2="${h}" stroke="#ffd25a" stroke-width="2"/>
       <line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="#ff5a7a" stroke-width="1.5" stroke-dasharray="5 5"/>`
    : '';
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`);
  // Composite at native size, then scale, so the lines stay on the features.
  const composed = await sharp(file).composite([{ input: svg }]).png().toBuffer();
  panels.push(await sharp(composed).resize({ height: PANEL_HEIGHT }).png().toBuffer());
}

if (!panels.length) throw Error('no panels');
const metas = await Promise.all(panels.map((buf) => sharp(buf).metadata()));
const totalW = metas.reduce((sum, m) => sum + (m.width ?? 0) + 10, 0);
const composites: sharp.OverlayOptions[] = [];
let left = 0;
for (let i = 0; i < panels.length; i++) {
  composites.push({ input: panels[i], left, top: 0 });
  left += (metas[i].width ?? 0) + 10;
}
await sharp({ create: { width: totalW, height: PANEL_HEIGHT, channels: 3, background: { r: 240, g: 238, b: 230 } } })
  .composite(composites).jpeg({ quality: 90 }).toFile('/tmp/case-framing.jpg');
console.log(JSON.stringify({ output: '/tmp/case-framing.jpg', cases: CASES }));
