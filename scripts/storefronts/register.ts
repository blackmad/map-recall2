// Where along each storefront wall the pand's own facade actually is: project the footprint
// edges that lie on the wall line (within 1.5 m, nearly parallel) onto it.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { STOREFRONT_WALLS } from '../../src/canalRecall/storefrontWalls.generated.ts';
import { STOREFRONT_BY_SLUG } from '../../src/canalRecall/landmarkFrontData.ts';
const want = new Set(Object.values(STOREFRONT_WALLS).map(w => w.pand)), rings = new Map<string, number[][]>();
const root = 'public/data/extracts/amsterdam/building-tiles/14';
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  const b = fs.readFileSync(path.join(root, x, f));
  for (const ft of JSON.parse((b[0] === 0x1f ? zlib.gunzipSync(b) : b).toString()).features) {
    const id = String(ft.properties.id); if (!want.has(id) || rings.has(id)) continue;
    const g = ft.geometry; rings.set(id, g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
  }
}
const out: Record<string, { facade: [number, number]; span: [number, number] | null }> = {};
for (const [slug, w] of Object.entries(STOREFRONT_WALLS)) {
  const r = rings.get(w.pand); if (!r) continue;
  const k = Math.cos(w.start[1] * Math.PI / 180) * 111320, ky = 110540;
  const L = ([lng, lat]: number[]) => [(lng - w.start[0]) * k, (lat - w.start[1]) * ky];
  const [ex, ey] = L(w.end), len = Math.hypot(ex, ey), ux = ex / len, uy = ey / len;
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < r.length; i++) {
    const [ax, ay] = L(r[i - 1]), [bx, by] = L(r[i]);
    const da = Math.abs(ax * uy - ay * ux), db = Math.abs(bx * uy - by * ux), seg = Math.hypot(bx - ax, by - ay);
    if (da > 1.5 || db > 1.5 || seg < 0.3 || Math.abs(((bx - ax) * ux + (by - ay) * uy) / seg) < 0.9) continue;
    for (const [px, py] of [[ax, ay], [bx, by]]) { const t = px * ux + py * uy; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  }
  const f = STOREFRONT_BY_SLUG.get(slug);
  out[slug] = { facade: [Math.round(lo * 100) / 100, Math.round(hi * 100) / 100], span: f ? [f.outline[0][0], f.outline[1][0]] : null };
}
fs.writeFileSync('tmp/storefronts/register.json', JSON.stringify(out));
const bad = Object.entries(out).filter(([, v]) => v.span && (v.span[0] < v.facade[0] - 0.3 || v.span[1] > v.facade[1] + 0.3));
console.log('bojo', JSON.stringify(out['bojo-68561']), 'wall', STOREFRONT_WALLS['bojo-68561'].lengthM);
console.log('spans past their facade:', bad.length, 'of', Object.values(out).filter(v => v.span).length);
console.log(bad.slice(0, 25).map(([s, v]) => `${s} span ${v.span!.map(n => n.toFixed(1))} facade ${v.facade}`).join('\n'));
