/** Estimate a panorama's boresight automatically from projected wall edges.
 *
 * Given the raw equirectangular image and the walls we already know, search the
 * small yaw/pitch correction that best puts the projected building corners onto
 * vertical image edges. This is what lets the measured boresight scale beyond
 * the three hand-anchored panoramas. It is a diagnostic estimate, not a
 * certification.
 */
import { worldToEquirectangularPixel, type CameraModel, type CameraPose } from './rectify.ts';
import { edgeMaps, segmentSupport, type EdgeMaps, type GrayImage } from './edgeSupport.ts';

export interface WallEdge {
  start: { x: number; y: number };
  end: { x: number; y: number };
  baseZ: number;
  topZ: number;
}

export interface BoresightEstimate {
  yawDeg: number;
  pitchDeg: number;
  score: number;
  walls: number;
}

interface Point { x: number; y: number }

export function scoreBoresight(
  maps: EdgeMaps,
  pose: CameraPose,
  walls: WallEdge[],
  cameraModel: CameraModel,
  yawDeg: number,
  pitchDeg: number,
): { score: number; walls: number } {
  const model: CameraModel = { ...cameraModel, boresightYawDeg: yawDeg, boresightPitchDeg: pitchDeg };
  const { width, height } = maps;
  let total = 0;
  let used = 0;
  for (const wall of walls) {
    const project = (point: Point, z: number): [number, number] =>
      worldToEquirectangularPixel({ x: point.x, y: point.y, z }, pose, { width, height }, model);
    const sb = project(wall.start, wall.baseZ);
    const st = project(wall.start, wall.topZ);
    const eb = project(wall.end, wall.baseZ);
    const et = project(wall.end, wall.topZ);
    if ([sb, st, eb, et].some(([u, v]) => !Number.isFinite(u) || !Number.isFinite(v) || v < 0 || v >= height)) continue;
    // Both corners of the same wall must land on vertical edges at the same
    // boresight. Taking the weaker of the two rejects a spurious strong edge
    // that only matches one side, which is what fooled the earlier mean score.
    const left = segmentSupport(maps, sb, st, 'vertical', 2);
    const right = segmentSupport(maps, eb, et, 'vertical', 2);
    total += Math.min(left, right);
    used += 1;
  }
  return { score: used ? total / used : 0, walls: used };
}

/** Coarse-to-fine grid search over yaw/pitch. */
export function refineBoresight(
  image: GrayImage,
  pose: CameraPose,
  walls: WallEdge[],
  cameraModel: CameraModel,
  options: { yawCentreDeg?: number; pitchCentreDeg?: number; yawRangeDeg?: number; pitchRangeDeg?: number; coarseStepDeg?: number; fineStepDeg?: number } = {},
): BoresightEstimate {
  const { yawCentreDeg = 0, pitchCentreDeg = 0, yawRangeDeg = 6, pitchRangeDeg = 0.8, coarseStepDeg = 0.2, fineStepDeg = 0.05 } = options;
  const maps = edgeMaps(image);
  let best: BoresightEstimate = { yawDeg: yawCentreDeg, pitchDeg: pitchCentreDeg, score: -1, walls: 0 };

  const search = (yawFrom: number, yawTo: number, yawStep: number, pitchFrom: number, pitchTo: number, pitchStep: number) => {
    for (let yaw = yawFrom; yaw <= yawTo + 1e-9; yaw += yawStep) {
      for (let pitch = pitchFrom; pitch <= pitchTo + 1e-9; pitch += pitchStep) {
        const { score, walls: used } = scoreBoresight(maps, pose, walls, cameraModel, yaw, pitch);
        if (used && score > best.score) best = { yawDeg: Number(yaw.toFixed(3)), pitchDeg: Number(pitch.toFixed(3)), score, walls: used };
      }
    }
  };

  search(yawCentreDeg - yawRangeDeg, yawCentreDeg + yawRangeDeg, coarseStepDeg, pitchCentreDeg - pitchRangeDeg, pitchCentreDeg + pitchRangeDeg, coarseStepDeg);
  if (best.walls) {
    const centreYaw = best.yawDeg, centrePitch = best.pitchDeg;
    search(centreYaw - coarseStepDeg, centreYaw + coarseStepDeg, fineStepDeg, centrePitch - coarseStepDeg, centrePitch + coarseStepDeg, fineStepDeg);
  }
  return best;
}
