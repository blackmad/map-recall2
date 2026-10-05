import assert from 'node:assert/strict';
import test from 'node:test';
import { corniceHeight, roofTriangles, roofTrianglesForOutline, type RoofPlan } from './roofMesh.ts';

test('admitted cornice fronts keep closed native masonry and a light projecting roof band', () => {
  const lng=4.8995,lat=52.3745,kx=111320*Math.cos(lat*Math.PI/180);
  const ring=([[0,0],[12,0],[12,6],[0,6],[0,0]] as [number,number][])
    .map(([x,y])=>[lng+x/kx,lat+y/110540] as [number,number]);
  const rect={cx:6,cy:3,ux:1,uy:0,len:12,wid:6,coverage:1,maxDev:0};
  const plan:RoofPlan={kind:'gable',gable:'cornice',riseM:3,material:'slate',tone:0,dormers:false,seed:'source-trim',chimney:false,
    accents:true,trimHex:'#e6e1d4',pieces:[{rect,plan:{kind:'pitched',gable:'plain',riseM:3,material:'slate',tone:0,dormers:false,seed:'source-trim-inner',chimney:false}}],
    sourceCrownFront:{start:[0,0],end:[0,6],normal:[-1,0],shape:'cornice'}};
  const h0=10,dims={bayM:2,storeyM:3,cellM:1},before=JSON.stringify(plan);
  const triangles=roofTrianglesForOutline(ring,{lng,lat},plan,h0,dims,kx);
  const top=h0+corniceHeight(plan.riseM)+.05;
  const face=triangles.filter(t=>t.sourceCrownShape==='cornice'&&t.part==='trim'&&t.n[0]<-.99);
  assert.equal(face.length,2,'projecting cornice remains a single closed box front');
  const points=face.flatMap(t=>t.p);
  assert.ok(points.every(p=>Math.abs(p[0]+.18)<1e-7),'ledge projects 18cm from the surveyed wall');
  assert.ok(Math.abs(Math.max(...points.map(p=>p[2]))-top)<1e-7,'native crown envelope is unchanged');
  assert.ok(Math.abs(Math.max(...points.map(p=>p[2]))-Math.min(...points.map(p=>p[2]))-.25)<1e-7,'ledge face is 25cm high');
  const frieze=triangles.filter(t=>t.sourceCrownShape==='cornice'&&t.part==='decal'&&
    Math.min(...t.p.map(p=>p[2]))>h0+1);
  assert.equal(frieze.length,2,'one quiet continuous frieze');
  assert.ok(Math.abs(Math.max(...frieze.flatMap(t=>t.p.map(p=>p[2])))-Math.min(...frieze.flatMap(t=>t.p.map(p=>p[2])))-.10)<1e-7);
  const masonry=triangles.filter(t=>t.sourceCrownShape==='cornice'&&t.part==='plate'&&t.n[0]<-.99);
  assert.ok(masonry.length&&masonry.every(t=>t.p.every(p=>Math.abs(p[0])<1e-7)),'street masonry stays on the actual wall');
  assert.ok(masonry.some(t=>t.p.some(p=>Math.abs(p[2]-h0)<1e-7)),'wall-to-crown closure is retained');
  for(const t of triangles){
    for(const p of t.p)assert.ok(p[2]<=h0+plan.riseM+1e-7,'no roof/detail exceeds native height');
    const [a,b,c]=t.p,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    assert.ok(n.reduce((sum,v,i)=>sum+v*t.n[i],0)>1e-9,'closed trim and roof normals agree with winding');
  }
  assert.equal(JSON.stringify(plan),before,'source identity and geometry plan are not mutated');
  const stock=roofTriangles(rect,{...plan,pieces:undefined,sourceCrownFront:undefined},h0,dims);
  const stockFront=stock.filter(t=>t.part==='trim'&&t.n[0]>.99&&t.p.every(p=>p[0]>12));
  assert.ok(stockFront.some(t=>t.p.every(p=>Math.abs(p[0]-12.42)<1e-7)),'unobserved stock cornices retain their existing treatment');
});
