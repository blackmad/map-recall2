// node historic-plan.mjs <id> <out.png> — plan view of BAG ring (indexed vertices) and 3DBAG roof faces shaded by height.
import {chromium} from '@playwright/test';import fs from 'node:fs';
const [id,out]=process.argv.slice(2);const d=JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`));
const all=d.ring[0];const xs=all.map(p=>p[0]),zs=all.map(p=>p[1]);const x0=Math.min(...xs)-4,x1=Math.max(...xs)+4,z0=Math.min(...zs)-4,z1=Math.max(...zs)+4;
const S=Math.min(1100/(x1-x0),900/(z1-z0));const W=(x1-x0)*S,H=(z1-z0)*S;const X=x=>(x-x0)*S,Z=z=>(z-z0)*S;
const hmax=Math.max(...d.roofs.flatMap(r=>r.rings[0].map(p=>p[1])));
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff">`;
for(const r of d.roofs){const hs=r.rings[0].map(p=>p[1]);const m=hs.reduce((a,b)=>a+b)/hs.length;const c=Math.round(255-200*m/hmax);svg+=`<polygon points="${r.rings[0].map(p=>X(p[0])+','+Z(p[2])).join(' ')}" fill="rgb(${c},${c},255)" stroke="#06c" stroke-width=".5" opacity=".8"/>`;
 const cx=r.rings[0].reduce((a,p)=>a+p[0],0)/r.rings[0].length,cz=r.rings[0].reduce((a,p)=>a+p[2],0)/r.rings[0].length;svg+=`<text x="${X(cx)}" y="${Z(cz)}" font-size="9" fill="#004" text-anchor="middle">${m.toFixed(1)}</text>`}
svg+=`<polygon points="${all.map(p=>X(p[0])+','+Z(p[1])).join(' ')}" fill="none" stroke="#c00" stroke-width="1.5"/>`;
all.forEach((p,i)=>{svg+=`<circle cx="${X(p[0])}" cy="${Z(p[1])}" r="2" fill="#c00"/><text x="${X(p[0])+3}" y="${Z(p[1])-3}" font-size="10" fill="#c00">${i}</text>`});
svg+=`<text x="5" y="14" font-size="12">N up; scale ${S.toFixed(1)} px/m; x0=${x0.toFixed(0)} z0=${z0.toFixed(0)} (east right, south down)</text></svg>`;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:Math.ceil(W),height:Math.ceil(H)}});await p.setContent('<body style="margin:0">'+svg);await p.screenshot({path:out});await b.close();
