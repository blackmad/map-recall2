/**
 * Plan view of a block-kit build: every wall panel as a line (colour = bearing), label = panel index / vMax,
 * neighbour footprints in grey, footprint (ground) in black.
 *   node --import tsx scripts/haparandaweg/plan.ts --id=haparandaweg-952-1002 [--out=artifacts/haparandaweg/<id>/plan.png]
 */
import fs from 'node:fs';
import sharp from 'sharp';
import { compose } from '../../src/canalRecall/blockBuilding/compose.ts';
import { loadSpec } from './build.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('id'), { spec, set } = loadSpec(id);
const res = compose(set, spec);
const S = 14, PAD = 60;
const pts: [number, number][] = set.ground.flatMap(g => g.rings.flatMap(r => r.map(p => [p[0], p[2]] as [number, number])));
const x0 = Math.min(...pts.map(p => p[0])) - 5, x1 = Math.max(...pts.map(p => p[0])) + 5, z0 = Math.min(...pts.map(p => p[1])) - 5, z1 = Math.max(...pts.map(p => p[1])) + 5;
const W = Math.round((x1 - x0) * S + 2 * PAD), H = Math.round((z1 - z0) * S + 2 * PAD);
const X = (x: number) => PAD + (x - x0) * S, Z = (z: number) => PAD + (z - z0) * S;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>`;
for (const n of set.neighbours) svg += `<polygon points="${n.ring.map(p => `${X(p[0])},${Z(p[1])}`).join(' ')}" fill="#ddd" stroke="#999"/><text x="${X(n.ring[0][0])}" y="${Z(n.ring[0][1])}" font-size="10" fill="#777">${n.id.slice(-4)} h${n.height.toFixed(0)}</text>`;
for (const g of set.ground) for (const r of g.rings) svg += `<polygon points="${r.map(p => `${X(p[0])},${Z(p[2])}`).join(' ')}" fill="#fcc" fill-opacity="0.4" stroke="#000"/>`;
for (const p of res.panels) {
  if (p.uMax - p.uMin < 0.5) continue;
  const a = [p.o[0] + p.r[0] * p.uMin, p.o[2] + p.r[2] * p.uMin], b = [p.o[0] + p.r[0] * p.uMax, p.o[2] + p.r[2] * p.uMax];
  const br = (Math.atan2(p.n[0], -p.n[2]) * 180 / Math.PI + 360) % 360, col = `hsl(${Math.round(br)},80%,40%)`;
  const mx = (a[0] + b[0]) / 2 + p.n[0] * 0.6, mz = (a[1] + b[1]) / 2 + p.n[2] * 0.6;
  svg += `<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(b[0])}" y2="${Z(b[1])}" stroke="${col}" stroke-width="3"/><text x="${X(mx)}" y="${Z(mz)}" font-size="9" fill="${col}" text-anchor="middle">#${p.index} h${p.vMax.toFixed(0)} ${br.toFixed(0)}°${p.partyH ? ' P' + p.partyH.toFixed(0) : ''}</text>`;
}
svg += '</svg>';
const out = arg('out', `artifacts/haparandaweg/${id}/plan.png`);
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(out, W, H);
