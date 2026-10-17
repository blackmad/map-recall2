// Minimal COLMAP text-model reader (cameras.txt / images.txt / points3D.txt)
// for the sculpture scripts. `colmap model_converter --output_type TXT` first.
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { poseFromColmap, type Pose, type V3 } from '../../src/canalRecall/sculptures/coverage.js';

export type ColmapCamera = { id: number; model: string; width: number; height: number; params: number[] };
export type ColmapImage = Pose & { id: number; cameraId: number; q: [number, number, number, number]; t: V3 };

export function readCameras(dir: string): Map<number, ColmapCamera> {
  const out = new Map<number, ColmapCamera>();
  for (const line of fs.readFileSync(path.join(dir, 'cameras.txt'), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const p = line.trim().split(/\s+/);
    out.set(+p[0], { id: +p[0], model: p[1], width: +p[2], height: +p[3], params: p.slice(4).map(Number) });
  }
  return out;
}

/** Pose lines only (every other non-comment line); the 2D point lines are skipped without being split. */
export async function readImages(dir: string): Promise<ColmapImage[]> {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, 'images.txt')) });
  const out: ColmapImage[] = [];
  let k = 0;
  for await (const line of rl) {
    if (!line || line[0] === '#') continue;
    if (k++ % 2) continue;
    const p = line.trim().split(/\s+/);
    if (p.length < 10) continue;
    const q = p.slice(1, 5).map(Number) as [number, number, number, number];
    const t = p.slice(5, 8).map(Number) as V3;
    out.push({ ...poseFromColmap(p[9], q, t), id: +p[0], cameraId: +p[8], q, t });
  }
  return out;
}

/** Project a world point with a SIMPLE_RADIAL / PINHOLE camera; null if behind. */
export function project(img: ColmapImage, cam: ColmapCamera, X: V3): [number, number] | null {
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const [w, x, y, z] = img.q;
  R[0] = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)];
  R[1] = [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)];
  R[2] = [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  const c = [0, 1, 2].map(i => R[i][0] * X[0] + R[i][1] * X[1] + R[i][2] * X[2] + img.t[i]);
  if (c[2] <= 1e-6) return null;
  let u = c[0] / c[2], v = c[1] / c[2];
  const f = cam.params[0], cx = cam.params[cam.model === 'PINHOLE' ? 2 : 1], cy = cam.params[cam.model === 'PINHOLE' ? 3 : 2];
  if (cam.model === 'SIMPLE_RADIAL') { const k = cam.params[3], r2 = u * u + v * v; u *= 1 + k * r2; v *= 1 + k * r2; }
  return [f * u + cx, f * v + cy];
}
