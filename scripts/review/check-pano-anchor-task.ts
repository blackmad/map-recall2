/** Regression for the pano anchor task.
 *
 * Guards the world->pixel predictions the reviewer is asked to trust: markers
 * must be inside the source frame, ground corners must fall below the horizon
 * when the camera sits above them, and the task must keep a fit/holdout split.
 * A broken camera model should fail here before it wastes a reviewer's time.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TASK = 'public/canal-drive/data/pano-anchor-task.json';
const task = JSON.parse(fs.readFileSync(TASK, 'utf8'));

assert.equal(task.kind, 'pano-anchor-task', 'unexpected task kind');
assert.ok(Array.isArray(task.panos) && task.panos.length >= 1, 'task has no panos');
assert.ok(task.panos.some((p: any) => p.usedFor === 'holdout'), 'task has no holdout pano');
assert.ok(task.panos.some((p: any) => p.usedFor === 'fit'), 'task has no fit pano');

for (const pano of task.panos) {
  assert.ok(pano.markers.length >= 1, `${pano.panoramaId} has no markers`);
  for (const marker of pano.markers) {
    const [u, v] = marker.predicted;
    assert.ok(Number.isFinite(u) && Number.isFinite(v), `${marker.id} non-finite prediction`);
    assert.ok(u >= 0 && u < pano.width && v >= 0 && v < pano.height, `${marker.id} prediction outside frame`);
    if (marker.kind === 'corner-ground') {
      const cameraAbove = pano.pose.z > marker.world.z;
      if (cameraAbove) assert.ok(v > pano.height / 2, `${marker.id} ground corner not below horizon`);
      else assert.ok(v < pano.height / 2, `${marker.id} ground corner not above horizon`);
    }
    if (marker.kind === 'corner-mid') {
      assert.ok(marker.world.z > 0, `${marker.id} mid-height point at or below NAP`);
    }
  }
}

console.log(`pano anchor task passed: ${task.panos.length} panos, ${task.panos.reduce((n: number, p: any) => n + p.markers.length, 0)} markers.`);
