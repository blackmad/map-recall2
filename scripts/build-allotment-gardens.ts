/** Approximate planting, constrained by surveyed park/path/water/building geometry.
 * Regenerate with node --import tsx scripts/build-allotment-gardens.ts.
 * These are visual garden patches, not cadastral plot boundaries.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { contains, allotmentParks } from './allotment-house-source.ts';
import { polygonsOf, pointInRing } from '../src/canalRecall/buildingGeometry.ts';
import { fitRect } from '../src/canalRecall/roofMesh.ts';
import { hash01 } from '../src/canalRecall/facadeExtraCore.ts';
const origin={lng:4.9,lat:52.37},kx=111320*Math.cos(origin.lat*Math.PI/180),ky=110540;
type P=[number,number];
const xy=([x,y]:number[]):P=>[(x-origin.lng)*kx,(y-origin.lat)*ky];
const ll=([x,y]:P):P=>[Number((x/kx+origin.lng).toFixed(8)),Number((y/ky+origin.lat).toFixed(8))];
const houses=JSON.parse(readFileSync('artifacts/sloterdijkermeer-review/mapped-houses.geojson','utf8')).features;
const obstacles=JSON.parse(readFileSync('review-data/allotment-houses/garden-obstacles.geojson','utf8')).features;
const distance=(p:P,a:P,b:P)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const polygons:{rings:P[][];margin:number}[]=[],segments:{a:P;b:P;margin:number}[]=[];
for(const f of obstacles){const g=f.geometry,t=f.properties;if(g.type==='Point')continue;
 const margin=t.building?.5:t.highway?(['footway','path','steps','pedestrian'].includes(t.highway)?1.6:4):t.waterway?2:1;
 if(g.type==='LineString'){const r=g.coordinates.map(xy);for(let i=1;i<r.length;i++)segments.push({a:r[i-1],b:r[i],margin});}
 else if(g.type==='Polygon'||g.type==='MultiPolygon')for(const p of polygonsOf(g)){const rings=p.map(r=>r.map(xy));polygons.push({rings,margin});for(const r of rings)for(let i=1;i<r.length;i++)segments.push({a:r[i-1],b:r[i],margin});}
}
const frames=houses.map((f:any)=>{const ring=polygonsOf(f.geometry)[0][0].map(xy),rect=fitRect(ring,80)!;return{id:String(f.properties.id),rect,park:allotmentParks.find(p=>contains(p.geometry,ll([rect.cx,rect.cy])))!};});
const clear=(p:P,radius:number)=>!polygons.some(o=>pointInRing(p,o.rings[0])&&!o.rings.slice(1).some(r=>pointInRing(p,r)))&&!segments.some(s=>distance(p,s.a,s.b)<s.margin+radius);
// Each patch is entirely inside its nearest-house region, preventing competing gardens.
const data:Record<string,number[][]>={};let total=0,decorated=0;
for(const f of frames){const {rect:r,id,park}=f;const patches:number[][]=[];const local=(u:number,v:number):P=>[r.cx+r.ux*u-r.uy*v,r.cy+r.uy*u+r.ux*v];
 for(let u=-14;u<=14;u+=4)for(let v=-18;v<=18;v+=4){const p=local(u,v),corners=[local(u-2,v-2),local(u+2,v-2),local(u+2,v+2),local(u-2,v+2)];
 if(!clear(p,Math.SQRT2*2)||!corners.every(c=>contains(park.geometry,ll(c))))continue;
 if(!corners.every(c=>frames.every(other=>other===f||Math.hypot(c[0]-r.cx,c[1]-r.cy)<=Math.hypot(c[0]-other.rect.cx,c[1]-other.rect.cy))))continue;
 const seed=hash01(`${id}:garden:${u}:${v}`),kind=seed<.36?0:seed<.58?1:seed<.76?2:seed<.9?3:4;
 patches.push([...ll(p),Number((Math.atan2(r.uy,r.ux)*180/Math.PI).toFixed(2)),kind,Math.round(seed*1000)]);total++;if(kind)decorated++;
 }
 data[id]=patches;
}
writeFileSync('src/canalRecall/allotmentGardenPatches.json',JSON.stringify(data)+'\n');
writeFileSync('artifacts/sloterdijkermeer-review/garden-generation.json',JSON.stringify({houses:frames.length,patches:total,decorated,emptyHouseGardens:frames.filter(f=>!data[f.id].length).map(f=>f.id),source:'Cached Amsterdam OSM extract; review-data/allotment-houses/garden-obstacles.geojson',approximate:'Four-metre planting patches near mapped houses; nearest-house ownership is a placement constraint, not a surveyed plot boundary.',clearance:'Whole patch bounding circle clears mapped paths (1.6m half-width), roads (4m), ditches (2m), water banks (1m), and building walls (0.5m); all corners remain inside the exact park.'},null,2)+'\n');
console.log({houses:frames.length,patches:total,decorated});
