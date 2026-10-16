// End-profile features of the labelled boats, for choosing classifier thresholds.
import fs from 'node:fs';
import { houseboatFrame, type Houseboat } from '../../src/canalRecall/houseboats.ts';
const { boats: labelled } = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/labels.json', 'utf8'));
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const byId = new Map(boats.map(b => [b.id, b]));
const section = (pts: [number, number][], a: number) => {
  const hits: number[] = [];
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; if ((p[0] <= a && q[0] > a) || (q[0] <= a && p[0] > a)) hits.push(p[1] + (q[1] - p[1]) * (a - p[0]) / (q[0] - p[0])); }
  return hits.length >= 2 ? Math.max(...hits) - Math.min(...hits) : 0;
};
const rows = [];
for (const [id, l] of Object.entries(labelled as Record<string, { label: string }>)) {
  if (l.label === 'none') continue;
  const f = houseboatFrame(byId.get(id)!)!;
  const { local, length: L, width: W } = f;
  const body = [-.2, -.1, 0, .1, .2].map(t => section(local, t * L)).sort((a, b) => a - b)[2];
  const end = (s: number) => [0.3, 0.6, 1, 1.5, 2.5, 4].map(d => section(local, s * (L / 2 - d)) / body);
  const a = end(1), b = end(-1);
  const [bow, stern] = a[2] < b[2] ? [a, b] : [b, a];
  let area = 0; for (let i = 0; i < local.length; i++) { const p = local[i], q = local[(i + 1) % local.length]; area += p[0] * q[1] - q[0] * p[1]; }
  rows.push({ id, label: l.label, n: local.length, L: +L.toFixed(1), W: +W.toFixed(1), body: +body.toFixed(1), occ: +(Math.abs(area) / 2 / L / W).toFixed(3), bow: bow.map(v => +v.toFixed(2)), stern: stern.map(v => +v.toFixed(2)) });
}
rows.sort((x, y) => x.label.localeCompare(y.label) || x.bow[2] - y.bow[2]);
for (const r of rows) console.log(r.label.padEnd(8), r.id.padEnd(12), String(r.n).padStart(3), String(r.L).padStart(5), String(r.W).padStart(4), String(r.body).padStart(4), r.occ, 'bow', r.bow.join(' '), '| stern', r.stern.join(' '));
