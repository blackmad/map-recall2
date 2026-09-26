/** Measure framing (centering / clipping / neighbour inclusion) on every case crop.
 *
 * Uses the facade centering heuristic: the building is a run of vertical edges.
 * Reports whether that run is centred, shifted, clipped at a crop edge, or too
 * narrow (so the crop includes a neighbour). Diagnostic only.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { columnEdgeProfile, detectFacadeBounds } from '../../src/canalRecall/facade/facadeCentering.ts';

const CASES = 'public/data/facade-repair-preview/cases.json';
const EVIDENCE = 'public/data/city-expansion/evidence';
const OUT = 'review-data/case-framing.json';

const cases = JSON.parse(await fs.readFile(CASES, 'utf8')).cases as any[];
const rows: any[] = [];

for (const item of cases) {
  const observation = (item.candidateObservations ?? []).find((entry: any) => entry.images?.full?.sha256);
  const sha = observation?.images?.full?.sha256;
  if (!sha) { rows.push({ caseId: item.caseId, status: 'no-crop' }); continue; }
  const file = path.join(EVIDENCE, `${sha}.jpg`);
  try {
    const decoded = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
    const image = { data: new Uint8Array(decoded.data), width: decoded.info.width, height: decoded.info.height };
    const bounds = detectFacadeBounds(columnEdgeProfile(image));
    if (!bounds) { rows.push({ caseId: item.caseId, status: 'cannot-tell', width: image.width }); continue; }
    const offsetPx = Number((bounds.centrePx - image.width / 2).toFixed(1));
    const clippedLeft = bounds.leftPx <= 1;
    const clippedRight = bounds.rightPx >= image.width - 2;
    rows.push({
      caseId: item.caseId, status: 'measured', width: image.width,
      leftPx: bounds.leftPx, rightPx: bounds.rightPx, coverage: Number(bounds.coverage.toFixed(2)),
      offsetPx, clippedLeft, clippedRight,
      flag: Math.abs(offsetPx) > image.width * 0.12 ? 'off-centre' : clippedLeft || clippedRight ? 'may-include-neighbour-or-clipped' : 'ok',
    });
  } catch {
    rows.push({ caseId: item.caseId, status: 'missing-crop', file: `${sha}.jpg` });
  }
}

const report = { version: 1, kind: 'case-framing', generatedAt: new Date().toISOString(), rows };
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
for (const row of rows) {
  if (row.status !== 'measured') { console.log(String(row.caseId).padEnd(9), row.status); continue; }
  console.log(String(row.caseId).padEnd(9), 'w' + String(row.width).padStart(4), 'run', String(row.leftPx).padStart(4) + '-' + String(row.rightPx).padStart(4), 'cov', String(row.coverage).padStart(4), 'off', String(row.offsetPx).padStart(6), row.flag);
}
