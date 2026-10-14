/**
 * Print a pand's BAG footprint and 3DBAG LoD2.2 roof planes in a square-aligned local frame, for measuring the towers:
 * u along bearing 74 deg (the square's long axis, east-north-east), n along 344 deg (towards the square's north side),
 * heights above the 3DBAG ground. Origin = BAG footprint centroid (the large tier's origin).
 *
 *   node --import tsx scripts/mercatorplein/local-frame.ts --house=mercatorplein-noordtoren [--min-z=0]
 */
import fs from 'node:fs';
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const house = arg('house'), minZ = Number(arg('min-z', '0'));
const facts = JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${house}/facts.json`, 'utf8'));
const ring: number[][] = facts.bagFootprintRD[0];
const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length, g = facts.heights.groundNAP;
const a = 74 * Math.PI / 180, b = 344 * Math.PI / 180;
const U = (x: number, y: number) => +((x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)).toFixed(2);
const N = (x: number, y: number) => +((x - cx) * Math.sin(b) + (y - cy) * Math.cos(b)).toFixed(2);
console.log('centroid RD', cx.toFixed(2), cy.toFixed(2), 'ground NAP', g.toFixed(2));
console.log('footprint (u, n):', ring.map(p => `(${U(p[0], p[1])}, ${N(p[0], p[1])})`).join(' '));
for (const r of facts.roofsRD) {
  const vs: number[][] = r.vertices, zs = vs.map(v => v[2] - g);
  if (Math.max(...zs) < minZ) continue;
  const us = vs.map(v => U(v[0], v[1])), ns = vs.map(v => N(v[0], v[1]));
  console.log(`roof ${r.surfaceId.split(':').pop()}: u ${Math.min(...us).toFixed(1)}..${Math.max(...us).toFixed(1)} n ${Math.min(...ns).toFixed(1)}..${Math.max(...ns).toFixed(1)} z ${Math.min(...zs).toFixed(1)}..${Math.max(...zs).toFixed(1)}`);
}
// --walls [--min-top=15] [--min-len=1] [--u-min=8]: LoD2.2 wall surfaces in the same frame
if (process.argv.includes('--walls')) {
  const minTop = Number(arg('min-top', '0')), minLen = Number(arg('min-len', '1')), uMin = Number(arg('u-min', '-1e9'));
  for (const w of facts.wallsRD) {
    const pts: number[][] = w.ringsRD.flat(), zs = pts.map(v => v[2] - g);
    const us = pts.map(v => U(v[0], v[1])), ns = pts.map(v => N(v[0], v[1]));
    const du = Math.max(...us) - Math.min(...us), dn = Math.max(...ns) - Math.min(...ns);
    if (Math.max(...zs) < minTop || Math.hypot(du, dn) < minLen || Math.max(...us) < uMin) continue;
    console.log(`wall ${w.surface}: u ${Math.min(...us).toFixed(1)}..${Math.max(...us).toFixed(1)} n ${Math.min(...ns).toFixed(1)}..${Math.max(...ns).toFixed(1)} z ${Math.min(...zs).toFixed(1)}..${Math.max(...zs).toFixed(1)}`);
  }
}
