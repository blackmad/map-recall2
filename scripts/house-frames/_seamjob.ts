// Temporary (F1 P5 hand-over tone): an elevated approach toward the Weteringschans 171218 row, across the hand-over.
import { writeFileSync } from 'node:fs';
import { aimPose, fpsFor, frameFor, wallPoint, wallOutline, FRAME_W, FRAME_H, type WallQuad } from './pose.ts';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
const [query, outRoot, jobFile] = process.argv.slice(2);
const EYE = Number(process.env.EYE ?? 60);
// The row: 171218 and its neighbours' street walls along Weteringschans (RD, from house:frames pose.json and the row's line).
const wall: WallQuad = { a: { x: 121480, y: 485846.3 }, b: { x: 121530, y: 485840.8 }, heightM: 16.65 };
const target: WallQuad = { a: { x: 121500.99791513935, y: 485843.8145131306 }, b: { x: 121507.46474709586, y: 485843.103032599 }, heightM: 16.65 };
const pano = { x: 121502.89418900665, y: 485830.5326879061 };
const STOPS = (process.env.STOPS ?? '460,430,400,370,340,310,280,250').split(',').map(Number);
const mid = { x: (target.a.x + target.b.x) / 2, y: (target.a.y + target.b.y) / 2 };
const len = Math.hypot(target.b.x - target.a.x, target.b.y - target.a.y), ax = (target.b.x - target.a.x) / len, ay = (target.b.y - target.a.y) / len;
let nx = -ay, ny = ax; if ((pano.x - mid.x) * nx + (pano.y - mid.y) * ny < 0) { nx = -nx; ny = -ny; }
const poses: any[] = [], meta: any[] = [];
for (const d of STOPS) {
  const cam = { x: mid.x + nx * d, y: mid.y + ny * d };
  const lngLat = rdToLngLat(cam) as [number, number];
  const pose = aimPose({ lngLat, eyeHeightM: EYE }, wall);
  const frame = frameFor(pose);
  const outline = wallOutline(frame, pose, target), rowOutline = wallOutline(frame, pose, wall);
  const picks: [number, number][] = [];
  for (const u of [0.3, 0.5, 0.7]) for (const v of [0.35, 0.6, 0.85]) { const p = wallPoint(frame, pose, target, len * u, target.heightM * v); if (p.depth > 0) picks.push([p.x, p.y]); }
  const key = `wetering-${d}m`;
  poses.push({ key, pandId: '0363100012171218', out: outRoot, lngLat, headingDeg: pose.headingDeg, fps: fpsFor(pose), picks });
  meta.push({ key, d, lngLat, outline, rowOutline, vfov: pose.vfovDeg });
}
writeFileSync(jobFile, JSON.stringify({ out: outRoot, query, width: FRAME_W, height: FRAME_H, reopenEvery: 99, settleMs: 1200, poses }, null, 1));
writeFileSync(jobFile.replace(/\.json$/, '.meta.json'), JSON.stringify(meta, null, 1));
console.log(poses.length, 'poses');
