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
