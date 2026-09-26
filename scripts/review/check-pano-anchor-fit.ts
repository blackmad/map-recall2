/** Regression: the measured per-pano boresight must reduce anchor residuals.
 *
 * Guards the panoCamera registry against a wrong sign or a stale value. Uses
 * the saved human anchors as the reference; skipped markers are ignored.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AMSTERDAM_WORLD_ALIGNED, worldToEquirectangularPixel } from '../../src/canalRecall/facade/rectify.ts';
import { cameraModelForPano } from '../../src/canalRecall/facade/panoCamera.ts';

const TASK = 'public/canal-drive/data/pano-anchor-task.json';
const ANCHORS = 'src/canalRecall/facade/fixtures/panorama-anchors.json';

const task = JSON.parse(fs.readFileSync(TASK, 'utf8'));
const anchors = JSON.parse(fs.readFileSync(ANCHORS, 'utf8')).anchors.filter((a: any) => a.status !== 'skipped');
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

let checked = 0;
for (const pano of task.panos) {
  const group = anchors.filter((a: any) => a.panoramaId === pano.panoramaId);
  if (!group.length) continue;
  const residual = (model: any) => group.map((a: any) => {
    const [u, v] = worldToEquirectangularPixel(a.world, pano.pose, { width: pano.width, height: pano.height }, model);
    return Math.hypot(u - a.pixel[0], v - a.pixel[1]);
  });
  const raw = median(residual(AMSTERDAM_WORLD_ALIGNED));
  const corrected = median(residual(cameraModelForPano(pano.panoramaId)));
  assert.ok(corrected < raw, `${pano.panoramaId}: boresight did not improve residual (${raw} -> ${corrected})`);
  assert.ok(corrected < 25, `${pano.panoramaId}: corrected residual ${corrected}px exceeds 25px`);
  checked++;
}

assert.ok(checked >= 1, 'no anchored panos to check');
console.log(`pano anchor fit passed: ${checked} panos improve with the measured boresight.`);
