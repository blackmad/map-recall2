import fs from 'node:fs';
const [,, inp, ox, oz, qx, qz] = process.argv;
const f = JSON.parse(fs.readFileSync(inp, 'utf8')); const g = f.groundNAP;
const O = [+ox, +oz], Q = [+qx, +qz]; const L = Math.hypot(Q[0]-O[0], Q[1]-O[1]); const t = [(Q[0]-O[0])/L, (Q[1]-O[1])/L]; const n = [-t[1], t[0]];
const tv = p => [ (p[0]-O[0])*t[0] + (p[1]-O[1])*t[1], -((p[0]-O[0])*n[0] + (p[1]-O[1])*n[1]) ]; // v = depth into the building (opposite outward normal)
console.log('frame len', L.toFixed(2), 'n', n.map(v=>v.toFixed(3)));
console.log('ring in (t,v):'); f.rings.forEach((r,i)=>console.log(i, r.map(p=>tv(p).map(v=>v.toFixed(1)).join(',')).join('  ')));
f.roofs.forEach((r, i) => { const pts = r[0]; const ys = pts.map(p => p[1] - g); const tvs = pts.map(p => tv([p[0], p[2]]));
  console.log(`roof ${i} h ${Math.min(...ys).toFixed(1)}-${Math.max(...ys).toFixed(1)} t ${Math.min(...tvs.map(a=>a[0])).toFixed(1)}..${Math.max(...tvs.map(a=>a[0])).toFixed(1)} v ${Math.min(...tvs.map(a=>a[1])).toFixed(1)}..${Math.max(...tvs.map(a=>a[1])).toFixed(1)} n${pts.length} holes${r.length-1} :: ${tvs.map(a=>a.map(v=>v.toFixed(1)).join(',')).join(' ')}`); });
