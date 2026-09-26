/** Report street-level registration evidence from the saved pano anchors.
 *
 * Prints, per anchored panorama, the corrected anchor residual in metres and
 * whether it qualifies as `correspondence-verified`. Writes the result to
 * review-data/anchor-registrations.json for downstream consumers.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { panoAnchorFits, correspondenceEvidence, type AnchorLike, type TaskLike } from '../../src/canalRecall/facade/anchorRegistration.ts';

const TASK = 'public/canal-drive/data/pano-anchor-task.json';
const ANCHORS = 'src/canalRecall/facade/fixtures/panorama-anchors.json';
const OUT = 'review-data/anchor-registrations.json';

const task = JSON.parse(await fs.readFile(TASK, 'utf8')) as TaskLike;
const anchors = JSON.parse(await fs.readFile(ANCHORS, 'utf8')).anchors as AnchorLike[];

const fits = panoAnchorFits(anchors, task);
const report = {
  version: 1,
  kind: 'anchor-registrations',
  generatedAt: new Date().toISOString(),
  note: 'In-sample residual is measured after the per-pano boresight fitted on the same anchors (optimistic). Held-out residual fits the boresight on a calibration split and measures the validation split, so it is not fitted on itself. Qualification uses the held-out number.',
  panos: fits.map((fit) => ({ ...fit, evidence: correspondenceEvidence(fit) })),
};
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: OUT, panos: fits.map((f) => ({ pano: f.panoramaId.slice(0, 28), anchors: f.anchors, medianM: f.medianM, p95M: f.p95M, qualifies: f.qualifies })) }, null, 2));
