import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {roofPlanForFeature,roofTriangles,roofTrianglesForOutline} from './roofMesh.ts';
const features=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString()).features;

test('ordinary native clock/bell fronts attach to surveyed trapezoid walls without changing crown families or elevations',()=>{
 for(const [suffix,year,shape] of [['2177703',1725,'clock'],['2177704',1905,'bell']] as const){
  const raw=features.find((f:any)=>f.properties.id.endsWith(suffix)),original=raw.geometry.coordinates[0] as number[][],[lng0,lat0]=original[0],kx=111320*Math.cos(lat0*Math.PI/180),ky=110540;
  for(const angle of [0,.71,-1.2])for(const reverse of [false,true]){
   const transform=([lng,lat]:number[])=>{const x=(lng-lng0)*kx,y=(lat-lat0)*ky;return[lng0+(x*Math.cos(angle)-y*Math.sin(angle))/kx,lat0+(x*Math.sin(angle)+y*Math.cos(angle))/ky];};
   const ring=original.map(transform);if(reverse)ring.reverse();
   const feature={...raw,properties:{...raw.properties,facade:true,facadeStyle:'canal',constructionYear:year,...(shape==='bell'?{monumentGable:'bell'}:{})},geometry:{type:'Polygon',coordinates:[ring]}},before=JSON.stringify(feature);
   const plan=roofPlanForFeature(feature)!;assert.ok(plan);assert.equal(plan.gable,shape,'legacy procedural/register crown family is retained');
   const h0=Number(raw.properties.height)-plan.riseM,dims={bayM:2,storeyM:3,cellM:1},triangles=roofTrianglesForOutline(ring,{lng:ring[0][0],lat:ring[0][1]},plan,h0,dims,111320*Math.cos(ring[0][1]*Math.PI/180));
   const old=plan.pieces!.flatMap(piece=>roofTriangles(piece.rect,piece.plan,h0,dims));
   assert.equal(triangles.length,old.length);assert.deepEqual(triangles.map(t=>t.p.map(p=>p[2])),old.map(t=>t.p.map(p=>p[2])),'roof/crown/detail elevation remains identical');
   assert.deepEqual(triangles.map(t=>[t.part,t.hex,t.uv]),old.map(t=>[t.part,t.hex,t.uv]),'roof materials, trim, glazing and other details retained');
   const toXY=([lng,lat]:number[])=>[(lng-ring[0][0])*111320*Math.cos(ring[0][1]*Math.PI/180),(lat-ring[0][1])*ky],a=toXY(transform(original[0])),b=toXY(transform(original[1])),dx=b[0]-a[0],dy=b[1]-a[1],width=Math.hypot(dx,dy),normal=[dy/width,-dx/width];
   const front=triangles.filter(t=>t.part==='plate'&&t.n[0]*normal[0]+t.n[1]*normal[1]>.9&&t.p.every(p=>Math.abs((p[0]-a[0])*normal[0]+(p[1]-a[1])*normal[1])<.01));
   assert.ok(front.length,'outer crown face is on actual surveyed front wall');
   assert.ok(front.some(t=>t.p.some(p=>Math.abs(p[2]-h0)<1e-7)),'crown starts at wall eaves');
   for(const t of front)for(const p of t.p){const along=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/width;assert.ok(along>=-1e-6&&along<=width+1e-6,'masonry stays over its native frontage width');}
   for(const t of triangles){const [a,b,c]=t.p,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];assert.ok(n.reduce((sum,v,i)=>sum+v*t.n[i],0)>1e-9,'warped roof winding agrees with outward normal');}
   assert.equal(JSON.stringify(feature),before);
  }
 }
});
