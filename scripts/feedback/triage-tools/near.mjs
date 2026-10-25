import fs from 'node:fs';
const [lat, lon, r = 80] = process.argv.slice(2).map(Number);
const f = JSON.parse(fs.readFileSync(process.env.F || 'public/data/extracts/amsterdam/streets-routing.json'));
const m = (a, b) => Math.hypot((a[0]-b[0])*111320, (a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180));
function segd(p, a, b){ const ax=(a[1]-p[1])*67900, ay=(a[0]-p[0])*111320, bx=(b[1]-p[1])*67900, by=(b[0]-p[0])*111320; const dx=bx-ax, dy=by-ay; const L=dx*dx+dy*dy||1; const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/L)); return Math.hypot(ax+t*dx, ay+t*dy); }
const out=[];
for (const s of f) { const paths = s.paths ?? (s.path ? [s.path] : []); paths.forEach((p,i)=>{ let d=Infinity; for(let k=1;k<p.length;k++) d=Math.min(d, segd([lat,lon],p[k-1],p[k])); if (p.length===1) d=m(p[0],[lat,lon]); const closed = p.length>3 && p[0][0]===p.at(-1)[0] && p[0][1]===p.at(-1)[1]; if (d<r) out.push({d:+d.toFixed(1), id:s.id+':'+i, name:s.name, hw:s.highway, closed, n:p.length, br:s.bridge||'', first:p[0], last:p.at(-1), extra: Object.keys(s).filter(k=>!['id','name','highway','path','paths','center','cityId','type','bridge'].includes(k)).join(',')}); }); }
out.sort((a,b)=>a.d-b.d); for (const o of out) console.log(JSON.stringify(o));
