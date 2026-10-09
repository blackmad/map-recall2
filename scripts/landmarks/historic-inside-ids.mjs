// node historic-inside-ids.mjs <id> — ids of every public building-tile feature whose centroid lies inside the footprint ring
import fs from 'node:fs';import zlib from 'node:zlib';
const id=process.argv[2];const d=JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`));
const [alng,alat]=d.anchor,mx=111320*Math.cos(alat*Math.PI/180),my=111320;const ring=d.ring[0];
const inside=(x,z)=>{let y=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a[1]>z)!==(c[1]>z)&&x<((c[0]-a[0])*(z-a[1]))/(c[1]-a[1])+a[0])y=!y}return y};
const n=2**14,tx=Math.floor((alng+180)/360*n),ty=Math.floor((1-Math.log(Math.tan(alat*Math.PI/180)+1/Math.cos(alat*Math.PI/180))/Math.PI)/2*n);
const out=new Set();
for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const f=`public/data/extracts/amsterdam/building-tiles/14/${tx+dx}/${ty+dy}.geojson.gz`;if(!fs.existsSync(f))continue;
 for(const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).features){const r=(ft.geometry.type==='Polygon'?ft.geometry.coordinates:ft.geometry.coordinates[0])[0];
  const loc=r.map(p=>[(p[0]-alng)*mx,(alat-p[1])*my]);const cx=loc.reduce((s,p)=>s+p[0],0)/loc.length,cz=loc.reduce((s,p)=>s+p[1],0)/loc.length;
  if(inside(cx,cz))out.add(ft.properties.id)}}
console.log(JSON.stringify([...out]));
