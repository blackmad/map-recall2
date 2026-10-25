import fs from 'node:fs';
const [lat, lon] = process.argv.slice(2).map(Number);
const f = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json'));
const inside=(p,ring)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [yi,xi]=ring[i],[yj,xj]=ring[j]; if(((yi>p[0])!==(yj>p[0])) && p[1] < (xj-xi)*(p[0]-yi)/(yj-yi)+xi) c=!c;} return c;};
const area=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++){a+=(r[j][1]*67900*r[i][0]*111320-r[i][1]*67900*r[j][0]*111320)}return Math.abs(a/2)};
for (const s of f) for (const [i,p] of (s.paths ?? (s.path?[s.path]:[])).entries()) { const closed=p.length>3&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]; if(closed && inside([lat,lon],p)) console.log(s.id+':'+i, JSON.stringify(s.name), s.highway, 'n='+p.length, 'area='+area(p).toFixed(0)+'m2', Object.keys(s).join(',')); }
