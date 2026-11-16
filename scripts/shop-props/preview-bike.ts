/**
 * Preview the shop-props bikes (lane shop-bikes-20261116): the baked omafiets and the procedural bike side by side, side-on
 * and three-quarter, painted flat-shaded in Node. Writes a PNG.
 *
 *   node --import tsx scripts/shop-props/preview-bike.ts <out.png>
 */
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { posed, type PropTri } from '../../src/canalRecall/shopProps/kit.ts';
import { bike, omafiets, bikeRack } from '../../src/canalRecall/shopProps/props.ts';

const out = process.argv[2] ?? 'bike-preview.png';
const W = 1400, H = 700, c = createCanvas(W, H), ctx = c.getContext('2d');
ctx.fillStyle = '#d8dde2'; ctx.fillRect(0, 0, W, H);
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function draw(tris: PropTri[], cx: number, cy: number, s: number, yaw: number): void {
  const t = posed(tris, { x: 0, y: 0, z: 0, yaw });
  const L = [0.35, 0.75, 0.55], ln = Math.hypot(...L);
  t.sort((a, b) => a.p.reduce((q, p) => q + p[1], 0) - b.p.reduce((q, p) => q + p[1], 0));
  for (const tr of t) {
    const k = 0.55 + 0.5 * Math.max(0, (tr.n[0] * L[0] + tr.n[1] * L[1] + tr.n[2] * L[2]) / ln);
    ctx.fillStyle = `rgb(${rgb(tr.hex).map(v => Math.min(255, Math.round(v * k))).join(',')})`;
    const q = tr.p.map(p => [cx + p[0] * s, cy - (p[2] - p[1] * 0.25) * s]);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.stroke();
  }
}
const ob = omafiets('#2f4a36'), pb = bike('#2f4a36');
draw(pb, 200, 300, 160, 0); draw(pb, 200, 640, 160, 0.6);
draw(ob, 600, 300, 160, 0); draw(ob, 600, 640, 160, 0.6);
draw(omafiets('#d9cfb4'), 1000, 300, 160, -0.4); draw(bikeRack(), 1000, 640, 160, 0.6); draw(omafiets('#1a2a44'), 1000, 640, 160, 0.6 + Math.PI / 2 * 0);
ctx.fillStyle = '#222'; ctx.font = '22px sans-serif';
ctx.fillText(`procedural ${pb.length} tris`, 60, 40); ctx.fillText(`omafiets low ${ob.length} tris`, 460, 40);
fs.writeFileSync(out, c.toBuffer('image/png'));
console.log(out);
