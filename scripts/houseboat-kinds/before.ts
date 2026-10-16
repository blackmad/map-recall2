// The classifier as it stood before 2026-10-16 (barge when length/width >= 2.3,
// occupancy < 0.96 and the section at ±0.46 L under 0.86 of the body), kept only
// to report before/after on the orthophoto sample.
export function classifyHouseboatHullBefore(_id: string, points: readonly (readonly [number, number])[], length: number, width: number): 'ark' | 'barge' {
  if (points.length < 3 || length <= 0 || width <= 0) return 'ark';
  let area = 0;
  for (let i = 0; i < points.length; i++) { const p = points[i], q = points[(i + 1) % points.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const occupancy = Math.abs(area) / 2 / (length * width);
  const section = (a: number) => {
    const hits: number[] = [];
    for (let i = 0; i < points.length; i++) { const p = points[i], q = points[(i + 1) % points.length]; if ((p[0] <= a && q[0] > a) || (q[0] <= a && p[0] > a)) hits.push(p[1] + (q[1] - p[1]) * (a - p[0]) / (q[0] - p[0])); }
    return hits.length >= 2 ? Math.max(...hits) - Math.min(...hits) : 0;
  };
  const body = Math.max(section(-length * 0.15), section(0), section(length * 0.15));
  const endWidth = Math.min(section(-length * 0.46), section(length * 0.46));
  return length / width >= 2.3 && occupancy < 0.96 && body > 0 && endWidth / body < 0.86 ? 'barge' : 'ark';
}
