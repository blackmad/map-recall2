/**
 * List BAG pands near a point (id, height, area, centroid distance) and, for the one containing or nearest the point, the 3DBAG facts.
 *   node --import tsx scripts/landmarks/pand-near.ts --lat=52.366 --lng=4.8609 [--radius=40] [--facts]
 */
import {neighbourhood, lngLatToRd, pointInRing} from '../pand-reference/core.ts';
import {factsFor} from '../pand-reference/facts.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const lat = Number(arg('lat')), lng = Number(arg('lng')), radius = Number(arg('radius', '40'));
const c = lngLatToRd([lng, lat]);
const fps = await neighbourhood(c);
const rows = fps.filter(f => f.id.startsWith('NL.IMBAG.Pand.')).map(f => {
  const cx = f.ring.reduce((s, p) => s + p.x, 0) / f.ring.length, cy = f.ring.reduce((s, p) => s + p.y, 0) / f.ring.length;
  let a = 0; for (let i = 0; i < f.ring.length; i++) { const p = f.ring[i], q = f.ring[(i + 1) % f.ring.length]; a += p.x * q.y - q.x * p.y; }
  return {f, d: Math.hypot(cx - c.x, cy - c.y), inside: pointInRing(c, f.ring), area: Math.abs(a) / 2};
}).filter(r => r.inside || r.d < radius).sort((x, y) => x.d - y.d);
for (const r of rows) console.log(r.f.id, 'h', r.f.height, 'area', Math.round(r.area), 'd', Math.round(r.d), r.inside ? 'INSIDE' : '', 'verts', r.f.ring.length);
if (process.argv.includes('--facts') && rows[0]) console.log(JSON.stringify(await factsFor(rows[0].f, null), null, 1).slice(0, 6000));
