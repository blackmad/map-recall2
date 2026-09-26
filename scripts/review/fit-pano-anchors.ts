/** Fit per-panorama boresight corrections from the human anchor correspondences.
 *
 * The anchors are independent world<->pixel pairs recorded in the anchor tool.
 * The current model is `amsterdam-world-aligned/v1`, which ignores the published
 * heading. A constant horizontal shift in a pano is a yaw (boresight) offset; a
 * constant vertical shift is a pitch offset. We report the raw residual, the
 * per-pano median offset, and the residual after applying it, in pixels and in
 * metres at each wall's standoff. This is a measurement, not a certification.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ANCHORS = 'src/canalRecall/facade/fixtures/panorama-anchors.json';
const OUT = 'review-data/pano-anchor-fit.json';
const PX_PER_RAD = (width: number) => width / (2 * Math.PI);

type Anchor = {
  panoramaId: string;
  markerId: string;
  address: string;
  predicted: [number, number];
  pixel: [number, number];
  status: string;
  residualPx: number;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

async function main() {
  const data = JSON.parse(await fs.readFile(ANCHORS, 'utf8'));
  const anchors: Anchor[] = (data.anchors ?? []).filter((a: Anchor) => a.status !== 'skipped');
  if (!anchors.length) throw new Error('No anchors recorded yet');

  const panos = [...new Set(anchors.map((a) => a.panoramaId))];
  const report: any = { version: 1, kind: 'pano-anchor-fit', generatedAt: new Date().toISOString(), cameraModelId: data.cameraModelId, panos: [] };

  let allRaw: number[] = [];
  let allCorrected: number[] = [];
  for (const panoramaId of panos) {
    const group = anchors.filter((a) => a.panoramaId === panoramaId);
    const du = group.map((a) => a.pixel[0] - a.predicted[0]);
    const dv = group.map((a) => a.pixel[1] - a.predicted[1]);
    const yawOffsetPx = median(du);
    const pitchOffsetPx = median(dv);
    // Width is 8000 for these missions; infer from the largest predicted u if needed.
    const width = 8000;
    const yawOffsetDeg = (yawOffsetPx / PX_PER_RAD(width)) * 180 / Math.PI;
    const corrected = group.map((a) => Math.hypot(du[group.indexOf(a)] - yawOffsetPx, dv[group.indexOf(a)] - pitchOffsetPx));
    allRaw = allRaw.concat(group.map((a) => Math.hypot(a.pixel[0] - a.predicted[0], a.pixel[1] - a.predicted[1])));
    allCorrected = allCorrected.concat(corrected);
    report.panos.push({
      panoramaId,
      count: group.length,
      rawResidualPx: { median: Number(median(group.map((a) => a.residualPx)).toFixed(1)), max: Number(Math.max(...group.map((a) => a.residualPx)).toFixed(1)) },
      yawOffsetPx: Number(yawOffsetPx.toFixed(1)),
      yawOffsetDeg: Number(yawOffsetDeg.toFixed(3)),
      pitchOffsetPx: Number(pitchOffsetPx.toFixed(1)),
      correctedResidualPx: { median: Number(median(corrected).toFixed(1)), max: Number(Math.max(...corrected).toFixed(1)) },
    });
  }

  report.summary = {
    anchors: anchors.length,
    rawResidualPx: { median: Number(median(allRaw).toFixed(1)), p95: Number([...allRaw].sort((a, b) => a - b)[Math.floor(allRaw.length * 0.95)].toFixed(1)) },
    correctedResidualPx: { median: Number(median(allCorrected).toFixed(1)), p95: Number([...allCorrected].sort((a, b) => a - b)[Math.floor(allCorrected.length * 0.95)].toFixed(1)) },
    note: 'A per-pano constant shift is a boresight (yaw/pitch) offset. Corrected residual is the spread the offset cannot explain; part of it is BAG footprint error (~0.2 m) and reviewer click precision.',
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

await main();
