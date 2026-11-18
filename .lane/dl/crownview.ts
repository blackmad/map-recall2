import sharp from 'sharp';
import { crownLobe } from '../../src/canalRecall/trees/crownGeometry.ts';
// Side view of a 3-lobe crown like the typology's (lobes offset), lit by a simple directional light.
const L = [0.5, -0.4, 0.75]; const ln = Math.hypot(...L); const light = L.map(v => v / ln);
const svgs: string[] = [];
for (const detail of [1, 0] as const) for (const v of [0, 1, 2]) {
  const lobes = [{ o: [0, 0, 0], s: [1, 1, 0.85], v }, { o: [0.55, 0.1, 0.45], s: [0.8, 0.8, 0.7], v: (v + 1) % 3 }, { o: [-0.5, -0.1, 0.35], s: [0.75, 0.75, 0.7], v: (v + 2) % 3 }];
  const polys: { z: number; d: string; c: string }[] = [];
  for (const lb of lobes) { const m = crownLobe(detail, lb.v);
    for (let i = 0; i < m.triangles; i++) { const pts = [0, 1, 2].map(j => [0, 1, 2].map(k => m.positions[i * 9 + j * 3 + k] * lb.s[k] + lb.o[k]));
      const n = [0, 1, 2].map(k => (m.normals[i * 9 + k] + m.normals[i * 9 + 3 + k] + m.normals[i * 9 + 6 + k]) / 3); const sh = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) * 0.7 + 0.3;
      polys.push({ z: pts.reduce((s, p) => s + p[1], 0), d: pts.map(p => `${(100 + p[0] * 60).toFixed(1)},${(110 - p[2] * 60).toFixed(1)}`).join(' '), c: `rgb(${Math.round(120 * sh)},${Math.round(148 * sh)},${Math.round(90 * sh)})` }); } }
  polys.sort((a, b) => b.z - a.z);
  svgs.push(`<svg x="${svgs.length * 200}" width="200" height="200">${polys.map(p => `<polygon points="${p.d}" fill="${p.c}" stroke="${p.c}" stroke-width="0.5"/>`).join('')}</svg>`);
}
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200"><rect width="1200" height="200" fill="#9ec3ed"/>${svgs.join('')}</svg>`)).png().toFile('.lane/dl/crowns.png');
