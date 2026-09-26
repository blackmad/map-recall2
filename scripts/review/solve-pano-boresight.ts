/** Solve per-panorama boresight (yaw + pitch) from the saved anchors.
 *
 * Grid-searches the correction that minimises the anchor pixel residual, then
 * prints the values to paste into `src/canalRecall/facade/panoCamera.ts`. This
 * is the measurement step; it does not modify the model itself.
 */
import fs from 'node:fs/promises';
import { worldToEquirectangularPixel, type CameraModel } from '../../src/canalRecall/facade/rectify.ts';

const TASK = 'public/canal-drive/data/pano-anchor-task.json';
const ANCHORS = 'src/canalRecall/facade/fixtures/panorama-anchors.json';

const task = JSON.parse(await fs.readFile(TASK, 'utf8'));
const anchors = JSON.parse(await fs.readFile(ANCHORS, 'utf8')).anchors.filter((a: any) => a.status !== 'skipped');

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const out: any[] = [];
for (const pano of task.panos) {
  const group = anchors.filter((a: any) => a.panoramaId === pano.panoramaId);
  if (!group.length) continue;
  let best = { yaw: 0, pitch: 0, cost: Infinity };
  for (let yaw = -6; yaw <= 6.0001; yaw += 0.05) {
    for (let pitch = -0.6; pitch <= 0.6001; pitch += 0.05) {
      const model: CameraModel = { id: 'solve', usesOrientation: false, yaw: 'centre', boresightYawDeg: yaw, boresightPitchDeg: pitch };
      const cost = group.reduce((sum: number, a: any) => {
        const [u, v] = worldToEquirectangularPixel(a.world, pano.pose, { width: pano.width, height: pano.height }, model);
        return sum + (u - a.pixel[0]) ** 2 + (v - a.pixel[1]) ** 2;
      }, 0) / group.length;
      if (cost < best.cost) best = { yaw, pitch, cost };
    }
  }
  const residuals = group.map((a: any) => {
    const model: CameraModel = { id: 'solve', usesOrientation: false, yaw: 'centre', boresightYawDeg: best.yaw, boresightPitchDeg: best.pitch };
    const [u, v] = worldToEquirectangularPixel(a.world, pano.pose, { width: pano.width, height: pano.height }, model);
    return Math.hypot(u - a.pixel[0], v - a.pixel[1]);
  });
  out.push({ panoramaId: pano.panoramaId, usedFor: pano.usedFor, count: group.length, yawDeg: Number(best.yaw.toFixed(3)), pitchDeg: Number(best.pitch.toFixed(3)), residualPx: { median: Number(median(residuals).toFixed(1)), max: Number(Math.max(...residuals).toFixed(1)) } });
}
console.log(JSON.stringify(out, null, 2));
