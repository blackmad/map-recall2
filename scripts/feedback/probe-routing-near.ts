// Feedback triage probe: which routing-extract ways lie near a point, with
// highway class and distance. Usage: tsx scripts/feedback/probe-routing-near.ts <lat> <lon> [radiusM]
import { loadRoutingFeatures } from '../lib/routingFeatures.ts';

type Feature = { id: string; name?: string; highway?: string; bridge?: boolean; path?: [number, number][]; paths?: [number, number][][] };
const [lat, lon, radius = 60] = process.argv.slice(2).map(Number);
const mx = 111320, my = 111320 * Math.cos(lat * Math.PI / 180);
const toXY = (p: [number, number]) => [(p[1] - lon) * my, (p[0] - lat) * mx] as const;
const segDist = (a: [number, number], b: [number, number]) => {
  const [ax, ay] = toXY(a), [bx, by] = toXY(b);
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
  return Math.hypot(ax + t * dx, ay + t * dy);
};
const features = await loadRoutingFeatures<Feature>();
const rows: string[] = [];
for (const f of features) for (const [i, p] of (f.paths ?? (f.path ? [f.path] : [])).entries()) {
  let m = Infinity;
  for (let k = 1; k < p.length; k++) m = Math.min(m, segDist(p[k - 1], p[k]));
  if (m < radius) rows.push(`${m.toFixed(1).padStart(6)} m  ${f.id}:${i}  ${f.highway ?? '?'}  ${f.name ?? '(unnamed)'}${f.bridge ? ' bridge' : ''}`);
}
console.log(rows.sort((a, b) => parseFloat(a) - parseFloat(b)).join('\n'));
