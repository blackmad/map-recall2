import fs from 'node:fs';
import sharp from 'sharp';
const [,, inp, out, s='8'] = process.argv; const S=+s;
const f=JSON.parse(fs.readFileSync(inp,'utf8'));
const pts=f.rings.flat(); const x0=Math.min(...pts.map(p=>p[0]))-6, x1=Math.max(...pts.map(p=>p[0]))+6, z0=Math.min(...pts.map(p=>p[1]))-6, z1=Math.max(...pts.map(p=>p[1]))+6;
const W=Math.round((x1-x0)*S), H=Math.round((z1-z0)*S); const T=(x,z)=>`${((x-x0)*S).toFixed(1)},${((z-z0)*S).toFixed(1)}`;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="white"/>`;
const g=f.groundNAP;
const roofs=[...f.roofs].sort((a,b)=>Math.max(...a.flat().map(p=>p[1]))-Math.max(...b.flat().map(p=>p[1])));
for(const r of roofs){const ys=r.flat().map(p=>p[1]); const h=ys.reduce((a,b)=>a+b,0)/ys.length-g; const hue=Math.max(0,Math.min(300,(30-h)*10));
 svg+=`<polygon points="${r[0].map(p=>T(p[0],p[2])).join(' ')}" fill="hsl(${hue},60%,75%)" stroke="#555" stroke-width="1"/>`;
 const cx=r[0].reduce((a,p)=>a+p[0],0)/r[0].length, cz=r[0].reduce((a,p)=>a+p[2],0)/r[0].length;
 const [X,Y]=T(cx,cz).split(','); svg+=`<text x="${X}" y="${Y}" font-size="${S*1.6}" font-family="sans-serif">${(Math.min(...ys)-g).toFixed(1)}-${(Math.max(...ys)-g).toFixed(1)}</text>`;}
for(const r of f.rings){svg+=`<polygon points="${r.map(p=>T(...p)).join(' ')}" fill="none" stroke="black" stroke-width="2"/>`; r.forEach((p,i)=>{const [X,Y]=T(...p).split(','); svg+=`<text x="${X}" y="${Y}" fill="red" font-size="${S*1.4}">${i}</text>`;});}
for(let gx=Math.ceil(x0/10)*10;gx<x1;gx+=10){const [X]=T(gx,0).split(','); svg+=`<line x1="${X}" y1="0" x2="${X}" y2="${H}" stroke="#00f" stroke-opacity="0.15"/><text x="${X}" y="${S*2}" fill="blue" font-size="${S*1.4}">${gx}</text>`;}
for(let gz=Math.ceil(z0/10)*10;gz<z1;gz+=10){const [,Y]=T(0,gz).split(','); svg+=`<line x1="0" y1="${Y}" x2="${W}" y2="${Y}" stroke="#00f" stroke-opacity="0.15"/><text x="2" y="${Y}" fill="blue" font-size="${S*1.4}">${gz}</text>`;}
svg+='</svg>'; await sharp(Buffer.from(svg)).png().toFile(out); console.log(out,W,H);
