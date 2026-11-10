import fs from 'node:fs';
import { BuurtProfileIndex } from '/Users/blackmad/Code/map-recall2-worktrees/profiles-citywide-20261107/src/canalRecall/buurtProfiles/profiles.ts';
const set = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const idx = new BuurtProfileIndex(set);
const feats = JSON.parse(fs.readFileSync('.cache/buurt-profiles/buurten.geojson','utf8')).features;
const inRing=(x:number,y:number,r:number[][])=>{let i2=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)i2=!i2;}return i2;};
const out:any={own:0,wijk:0,none:0,list:{}};
for(const f of feats){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 // find an interior point: scan grid over bbox of biggest poly
 const ring=polys[0][0];const xs=ring.map((c:number[])=>c[0]),ys=ring.map((c:number[])=>c[1]);
 let hit:any=null;const N=12;
 const cnt:any={};
 for(let a=0;a<N;a++)for(let b=0;b<N;b++){const x=Math.min(...xs)+(a+.5)/N*(Math.max(...xs)-Math.min(...xs)),y=Math.min(...ys)+(b+.5)/N*(Math.max(...ys)-Math.min(...ys));
  if(!polys.some((p:any)=>inRing(x,y,p[0])))continue;const pr=idx.at(x,y);const k=pr?pr.code:'none';cnt[k]=(cnt[k]||0)+1;}
 const best=Object.entries(cnt).sort((a:any,b:any)=>b[1]-a[1])[0]?.[0]??'none';
 const code=f.properties.code;const kind=best==='none'?'none':best===code?'own':'wijk';out[kind]++;out.list[code]=kind;}
console.log(JSON.stringify({own:out.own,wijk:out.wijk,none:out.none,total:feats.length}));
fs.writeFileSync(process.argv[3],JSON.stringify(out.list));
