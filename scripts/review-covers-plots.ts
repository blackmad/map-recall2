import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { ROOT, allSpecs, footprintOf } from './lib/placedFootprints';
import { loadBagTiles, nearbyPands, resolveSuppressed } from './lib/bagTileIndex';
import { fullPandId } from '../src/canalRecall/bagTiles';

// Top-down plots for every pand in scripts/covers-review.json (blue = model footprint, red = reviewed pand, green = already suppressed).
//   npx tsx scripts/review-covers-plots.ts [out=artifacts/covers-review/plot]
// Model names with several pands (westerkerk) share one plot; the first word group before the pand id is the spec id.
import { loadCoversReview } from './lib/coversReview';
const want: Record<string, string[]> = {};
for (const key of Object.keys(loadCoversReview())) { const [model, pand] = key.split(' '); (want[model] ??= []).push(pand); }
const out = process.argv[2] ?? 'artifacts/covers-review/plot';
fs.mkdirSync(out, { recursive: true });
const index = loadBagTiles(path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14'));
for (const spec of allSpecs()) {
  if (!want[spec.id]) continue;
  const { fp } = await footprintOf(spec);
  const b = fp!.bounds, pad = 0.0004;
  const w = b.w - pad, e = b.e + pad, s = b.s - pad * 0.6, n = b.n + pad * 0.6;
  const lat = (s + n) / 2, kx = Math.cos(lat * Math.PI / 180);
  const W = 900, scale = W / ((e - w) * kx), H = Math.round((n - s) * scale);
  const X = (lng: number) => ((lng - w) * kx * scale).toFixed(1), Y = (lt: number) => ((n - lt) * scale).toFixed(1);
  const resolved = resolveSuppressed(index, spec.suppressOsmIds.map(String));
  const suppressed = new Set(resolved.pands), bug = new Set(want[spec.id].map(fullPandId));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>`;
  const step = 0.00001;
  for (let lng = b.w; lng < b.e; lng += step * 2) for (let lt = b.s; lt < b.n; lt += step) if (fp!.contains([lng, lt])) svg += `<rect x="${X(lng)}" y="${Y(lt)}" width="${(step * 2 * kx * scale + 0.5).toFixed(1)}" height="${(step * scale + 0.5).toFixed(1)}" fill="#cde"/>`;
  for (const p of nearbyPands(index, { w, s, e, n })) {
    const col = bug.has(p.id) ? '#d22' : suppressed.has(p.id) ? '#2a2' : '#888';
    for (const ring of p.rings) svg += `<polygon points="${ring.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="${col}" fill-opacity="${bug.has(p.id) ? 0.55 : 0.3}" stroke="${col}" stroke-width="1.2"/>`;
  }
  svg += `<text x="6" y="16" font-size="14" font-family="Helvetica">${spec.id}: blue = model footprint, red = hidden-bug pand, green = already suppressed, grey = other pands (N up, ${((e - w) * kx * 111320).toFixed(0)} m wide)</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, `${spec.id}.png`));
}
