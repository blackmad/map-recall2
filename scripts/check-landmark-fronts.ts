/**
 * Landmark fronts against their references: each modelled roofline must follow the
 * roofline measured from the rectified panorama (photoSilhouette, stored in the facade
 * JSON by scripts/pano-facades/add-silhouette.ts), and the geometry must be finite.
 */
import fs from 'node:fs';
import { FRONTS, STOREFRONT_BY_SLUG, STOREFRONT_FRONTS } from '../src/canalRecall/landmarkFrontData.ts';
import { STOREFRONT_SPECS } from '../src/canalRecall/storefrontSpecs.ts';
import { STOREFRONT_WALLS } from '../src/canalRecall/storefrontWalls.generated.ts';
import { frontTriangles } from '../src/canalRecall/landmarkFronts.ts';

const outlineAt = (outline: [number, number][], x: number) => {
  for (let i = 1; i < outline.length; i++) {
    const [xa, za] = outline[i - 1], [xb, zb] = outline[i];
    if (x >= xa && x <= xb) return xb === xa ? Math.max(za, zb) : za + ((zb - za) * (x - xa)) / (xb - xa);
  }
  return null;
};
let failed = false;
for (const [name, front] of Object.entries(FRONTS)) {
  const meta = JSON.parse(fs.readFileSync(`public/data/landmark-facades/${name}.json`, 'utf8'));
  const tris = frontTriangles(front, (a, u, o) => [a, o, u]);
  const finite = tris.every(t => t.p.every(p => p.every(Number.isFinite)));
  // Only where the measured roofline is the front itself: skip columns the reference shows
  // as taller buildings behind (the Beurs hall roofs at either end).
  const errors: number[] = [];
  const { sampleM, topsM } = meta.silhouette;
  const mode = front.roofline ?? 'full';
  topsM.forEach((measured: number, i: number) => {
    // The photo cannot show more than its own height: a pediment above the crop is not an error.
    const tops = [front.outline, ...(front.slabs ?? []).map(sl => sl.outline)].map(o => outlineAt(o, i * sampleM)).filter((v): v is number => v != null);
    const raw = tops.length ? Math.max(...tops) : null, modelled = raw == null ? null : Math.min(raw, meta.height / meta.pixelsPerMetre);
    if (modelled == null || measured >= modelled + 3) return;
    // Front-only: what shows above the front in the photo is roof or tower behind it.
    errors.push(mode === 'front-only' ? Math.max(0, modelled - measured) : Math.abs(measured - modelled));
  });
  errors.sort((a, b) => a - b);
  const median = errors[errors.length >> 1] ?? 0, p90 = errors[Math.floor(errors.length * 0.9)] ?? 0, coverage = errors.length / topsM.length;
  const ok = finite && (mode === 'unmeasured' || (median < 0.6 && p90 < 1.5 && coverage > 0.6));
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${tris.length} triangles, ${mode === 'unmeasured' ? 'roofline not measurable from its reference' : `${mode} roofline error median ${median.toFixed(2)} m, p90 ${p90.toFixed(2)} m over ${(coverage * 100).toFixed(0)}% of the wall`}`);
}
// Spec-built storefronts: every spec names a measured wall, and its boxes stay on that wall's frontage.
{
  const specs = Object.entries(STOREFRONT_SPECS), unplaced = specs.filter(([slug]) => !(slug in STOREFRONT_WALLS)).map(([slug]) => slug);
  const offWall = [...STOREFRONT_BY_SLUG].filter(([slug, f]) => f.boxes.some(b => b.x0 < -0.5 || b.x1 > STOREFRONT_WALLS[slug].lengthM + 0.5 || !(b.z1 > b.z0))).map(([slug]) => slug);
  const ok = unplaced.length === 0 && offWall.length === 0 && STOREFRONT_FRONTS.length >= 290;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} storefronts: ${STOREFRONT_FRONTS.length} built of ${specs.length} specs${unplaced.length ? `; no wall for ${unplaced.join(', ')}` : ''}${offWall.length ? `; off their wall: ${offWall.join(', ')}` : ''}`);
}
if (failed) process.exit(1);
