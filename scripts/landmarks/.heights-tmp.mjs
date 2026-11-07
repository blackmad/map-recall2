import fs from 'node:fs';
import sharp from 'sharp';
const R = JSON.parse(fs.readFileSync('/tmp/landmarks-west/andreas-roofs.json','utf8'));
const fp = JSON.parse(fs.readFileSync('scripts/landmarks/andreas-ensemble-footprints.json','utf8'));
const S=8, X0=-70, Z0=-50, W=150*S, H=85*S;
const P=(x,z)=>`${((x-X0)*S).toFixed(1)},${((z-Z0)*S).toFixed(1)}`;
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
R.sort((a,b)=>mean(a.poly[0].map(p=>p[1]))-mean(b.poly[0].map(p=>p[1])));
let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="white"/>`;
for (const r of R){ const ring=r.poly[0]; const h=mean(ring.map(p=>p[1])); const c=Math.round(255-Math.min(h,45)/45*220);
  const col = r.part===0?`rgb(${c},${c},255)`:r.part===1?`rgb(${c},255,${c})`:`rgb(255,${c},${c})`;
  s+=`<polygon points="${ring.map(p=>P(p[0],p[2])).join(' ')}" fill="${col}" stroke="black" stroke-width="1"/>`; }
for (const r of R){ const ring=r.poly[0]; const h=mean(ring.map(p=>p[1])); let A=0; for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];A+=a[0]*b[2]-b[0]*a[2];}
  const hs=ring.map(p=>p[1]); if(Math.abs(A)/2>12){ const [x,y]=P(mean(ring.map(p=>p[0])),mean(ring.map(p=>p[2]))).split(','); s+=`<text x="${x}" y="${y}" font-size="13" font-family="Helvetica">${Math.min(...hs).toFixed(1)}-${Math.max(...hs).toFixed(1)}</text>`;} }
const ring=fp.rings[0]; s+=`<polygon points="${ring.map(p=>P(p[0],p[1])).join(' ')}" fill="none" stroke="red" stroke-width="2"/>`;
for (const n of fp.neighbours) s+=`<polygon points="${n.ring.map(p=>P(p[0],p[1])).join(' ')}" fill="none" stroke="orange" stroke-width="2"/>`;
for(let x=-70;x<=80;x+=10) s+=`<text x="${(x-X0)*S}" y="12" font-size="11">${x}</text><line x1="${(x-X0)*S}" y1="0" x2="${(x-X0)*S}" y2="${H}" stroke="#ddd"/>`;
for(let z=-50;z<=35;z+=10) s+=`<text x="2" y="${(z-Z0)*S}" font-size="11">${z}</text><line x1="0" y1="${(z-Z0)*S}" x2="${W}" y2="${(z-Z0)*S}" stroke="#ddd"/>`;
s+='</svg>';
await sharp(Buffer.from(s)).png().toFile('/tmp/landmarks-west/andreas-heights.png');
