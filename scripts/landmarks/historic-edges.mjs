// node historic-edges.mjs <id> [minLen=3] — list footprint ring edges (index, length, direction bearing, start point)
import fs from 'node:fs';
const [id,minLen='3']=process.argv.slice(2);const d=JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`));
const r=d.ring[0];
for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz);if(L<Number(minLen))continue;
 const br=(Math.atan2(dx,-dz)*180/Math.PI+360)%360;console.log(i,'to',(i+1)%r.length,'len',L.toFixed(1),'dir',br.toFixed(0),'from',a.map(v=>v.toFixed(1)).join(','))}
