/**
 * Belt review, the render's front line (2026-11-21, David's row view: Herengracht 62 rendered 3.43 m of its 5.33 m BAG front,
 * a 1.9 m hole beside 60). House preview framed the pand by its own wall rule, while the photo was cut on prepare.ts's wall
 * (walls.json, scripts/belt-review/walls.ts). The render frames the photo's wall instead (house preview `--wall line:`),
 * cut to David's facade edges when he moved them (picks.json `facadeSpanPx`, pixels of the picked image whose BAG span is
 * `pandSpanPx` at `ppm`).
 *
 * Pure. No wall: null (house preview's own rule, as before).
 */
export interface FaceWall { a: [number, number]; b: [number, number]; lengthM: number }

/** The front line house preview frames, `line:lngA,latA,lngB,latB` (left to right as seen), or null. */
export function frontLineArg(wall: FaceWall | undefined, edges?: { facadeSpanPx?: [number, number]; pandSpanPx?: [number, number]; ppm?: number }): string | null {
  if (!wall || !(wall.lengthM > 0.5)) return null;
  let [a, b] = [wall.a, wall.b];
  const fs = edges?.facadeSpanPx, ps = edges?.pandSpanPx, ppm = edges?.ppm;
  if (fs && ps && ppm && ppm > 0 && fs[1] > fs[0]) {
    // Metres along the wall from its start; the line moves with the edges (a facade wider than the BAG span reaches out).
    const t0 = (fs[0] - ps[0]) / ppm / wall.lengthM, t1 = (fs[1] - ps[0]) / ppm / wall.lengthM;
    const at = (t: number): [number, number] => [wall.a[0] + (wall.b[0] - wall.a[0]) * t, wall.a[1] + (wall.b[1] - wall.a[1]) * t];
    if (t1 - t0 > 0.5 / wall.lengthM) [a, b] = [at(t0), at(t1)];
  }
  const f = (v: number) => v.toFixed(8);
  return `line:${f(a[0])},${f(a[1])},${f(b[0])},${f(b[1])}`;
}

/**
 * House preview's measured run (measure.json `layout`): the street run lying on the framed wall, parallel within 25 deg,
 * within 1.5 m of its line, with the most of its length inside the frame; undefined when none is (the caller takes the
 * longest street run, as before). A corner house's longest street run is not the framed front: Herengracht 82 measured
 * its 10.6 m side-street wall under the 6.68 m canal front the photo shows. `at` and the frame are metres from the chunk
 * origin (threeBuildingMesh layoutProbe).
 */
export function framedRun<R extends { at?: readonly [number, number, number, number] }>(runs: readonly R[], frame: { origin: readonly number[]; right: readonly number[]; normal: readonly number[]; len: number }): R | undefined {
  let best: R | undefined, bestM = 0.5;
  for (const r of runs) {
    if (!r.at) continue;
    const [x0, y0, x1, y1] = r.at, len = Math.hypot(x1 - x0, y1 - y0);
    if (!(len > 0)) continue;
    const t = (x: number, y: number) => (x - frame.origin[0]) * frame.right[0] + (y - frame.origin[1]) * frame.right[1];
    const d = (x: number, y: number) => (x - frame.origin[0]) * frame.normal[0] + (y - frame.origin[1]) * frame.normal[1];
    if (Math.abs(((x1 - x0) * frame.right[0] + (y1 - y0) * frame.right[1]) / len) < Math.cos(25 * Math.PI / 180)) continue;
    if (Math.abs(d((x0 + x1) / 2, (y0 + y1) / 2)) > 1.5) continue;
    const a = t(x0, y0), b = t(x1, y1), inside = Math.min(frame.len, Math.max(a, b)) - Math.max(0, Math.min(a, b));
    if (inside > bestM) { best = r; bestM = inside; }
  }
  return best;
}
