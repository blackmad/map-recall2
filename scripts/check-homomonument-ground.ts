import assert from 'node:assert/strict';
import fs from 'node:fs';
const file='public/data/extracts/amsterdam/homomonument-ground.geojson';
const d=JSON.parse(fs.readFileSync(file,'utf8')),f=d.features[0];
assert.equal(d.features.length,1);assert.equal(f.properties.sourceBgtId,'G0363.eb965d61629d424c934f94b634ebf74f');
function inRing([x,y]:number[],r:number[][]){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function inside(p:number[],g:any){return inRing(p,g.coordinates[0])&&!g.coordinates.slice(1).some((r:number[][])=>inRing(p,r));}
// These locations derive from the installed triangle vertices, not the fill itself.
assert(inside([4.884846397138091,52.37436432786265],f.geometry),'southern stair base connects to surveyed paving');
assert(inside([4.8848814633640885,52.37445418515119],f.geometry),'northern stair base connects to surveyed paving');
assert(!inside([4.8849867,52.3743914],f.geometry),'waterward tip retains open canal');
assert(!inside([4.884904853500726,52.37440330433795],f.geometry),'projecting platform centroid retains open canal');
assert(!inside([4.884637583867913,52.37456323200411],f.geometry),'mainland north uses existing plaza paving');
assert(!inside([4.884535062631362,52.374330763657944],f.geometry),'mainland south uses existing plaza paving');
const rawDir=process.argv[2];
if(rawDir){
 const raw=JSON.parse(fs.readFileSync(rawDir+'/bgt-wegdeel.json','utf8')).features.find((f:any)=>f.properties.lokaal_id===d.features[0].properties.sourceBgtId&&!f.properties.eind_registratie&&!f.properties.termination_date);
 assert.equal(f.geometry.coordinates.length,raw.geometry.coordinates.length,'surveyed holes retained');
 const sx=111320*Math.cos(52.37443243333333*Math.PI/180),sy=111320;
 let maxDeviation=0;
 for(let i=0;i<raw.geometry.coordinates.length;i++)for(const p of raw.geometry.coordinates[i]){
  let dist=Infinity;const ring=f.geometry.coordinates[i];
  for(let j=1;j<ring.length;j++){
   const a=ring[j-1],b=ring[j],dx=(b[0]-a[0])*sx,dy=(b[1]-a[1])*sy,px=(p[0]-a[0])*sx,py=(p[1]-a[1])*sy;
   const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));dist=Math.min(dist,Math.hypot(px-t*dx,py-t*dy));
  }maxDeviation=Math.max(maxDeviation,dist);
 }assert(maxDeviation<=.08001,'display simplification remains within 8 cm surveyed boundary');
 console.log(JSON.stringify({vertices:f.geometry.coordinates.flat().length,holes:f.geometry.coordinates.length-1,maxDeviationM:maxDeviation,sourceFeature:raw.id}));
}
console.log('Homomonument quay: inland stair connection, water retention, plaza exclusion passed');
