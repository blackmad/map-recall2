import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {planCompoundFrontage,validateCompoundFrontageRecipe,type CompoundFrontageRecipe,type CompoundFrontagePlan,type CompoundRect} from './compoundFrontageLayout.ts';
const recipe=():CompoundFrontageRecipe=>({mainFraction:.72,mainColumns:3,mainInsetM:.4,mainWindowWidthM:1.45,mainFrameWidthM:.065,
 mainRows:[6.8,9.7,12.6].map(bottomM=>({bottomM,heightM:2.0,transomFraction:.76})),
 shaft:{axisFraction:.5,frameWidthM:.035,rows:[6.4,9.6,13.0].map(bottomM=>({bottomM,heightM:2.3,transomFraction:.72,principalWidthM:1.10,sideLightWidthM:.19,sideLightGapM:.18,sideLightBottomOffsetM:.10,sideLightHeightM:2.10,projectionM:.25})),
 groundLights:{bottomM:3.4,heightM:2.3,lightWidthM:.19,gapM:.28,projectionM:.08},access:{bottomM:0,heightM:2.6,widthM:1.05,recessDepthM:.35,frameWidthM:.09},canopy:{bottomM:2.75,thicknessM:.25,widthM:1.9,projectionM:.75,corbels:{widthM:.22,layers:[{heightM:.15,projectionM:.30},{heightM:.15,projectionM:.45}]}}},
 groundSurround:{bottomM:1.35,heightM:4.2,openingBottomM:1.65,openingHeightM:3.60,openingWidthM:1.45,frameWidthM:.26,projectionM:.25,transomFraction:.82}});
const input=()=>({lengthM:10.5079421839,baseM:0,topM:16.3,recipe:recipe()});
const area=(r:CompoundRect)=>r.width*r.height;
function meshes(p:CompoundFrontagePlan){const result:T.Mesh[]=[];
 for(const q of p.quads){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(q.points.flat(),3));g.setIndex([0,1,2,0,2,3]);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData=q;result.push(m);}
 for(const r of p.wallSegments){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([r.left,0,r.bottom,r.left+r.width,0,r.bottom,r.left+r.width,0,r.bottom+r.height,r.left,0,r.bottom+r.height],3));g.setIndex([0,1,2,0,2,3]);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData={role:'parent-wall'};result.push(m);}return result;
}
function firstHit(ms:T.Mesh[],x:number,z:number,oblique=0){const origin=new T.Vector3(x+oblique,2,z),dir=new T.Vector3(-oblique,-2,0).normalize();return new T.Raycaster(origin,dir,0,4).intersectObjects(ms,false)[0];}

test('unequal linked zones have three shared main axes and independent projected principal/sidelight rows',()=>{
 const p=planCompoundFrontage(input())!;assert(p);assert(p.mainZone.width>p.shaftZone.width*2);
 const main=p.windows.filter(w=>w.part==='main-window'),principal=p.windows.filter(w=>w.part==='shaft-principal'),sides=p.windows.filter(w=>w.part==='shaft-sidelight');
 assert.equal(main.length,9);assert.equal(principal.length,3);assert.equal(sides.length,6);
 assert(main.every(w=>w.left+w.width<p.shaftZone.left));assert(principal.every(w=>Math.abs(w.left+w.width/2-p.shaftAxis)<1e-8));
 assert(principal.every(w=>w.out>.25&&main.every(m=>m.out<w.out)));assert.notDeepEqual(main.filter(w=>w.axisIndex===0).map(w=>w.bottom),principal.map(w=>w.bottom));
 for(const row of [0,1,2]){const rowSides=sides.filter(w=>w.rowIndex===row);assert(rowSides.every(w=>w.width<principal[row].width/4));assert(rowSides.some(w=>w.left+w.width<principal[row].left));assert(rowSides.some(w=>w.left>principal[row].left+principal[row].width));}
});

test('ground has joined pale three-opening surround and separate three narrow shaft lights/access/canopy axis',()=>{
 const p=planCompoundFrontage(input())!,ground=p.windows.filter(w=>w.part==='main-ground-window'),lights=p.windows.filter(w=>w.part==='shaft-ground-light');assert.equal(ground.length,3);assert.equal(lights.length,3);
 assert(ground.every((w,i)=>Math.abs(w.left+w.width/2-p.mainAxes[i])<1e-8));assert(lights.every(w=>w.width<ground[0].width/5));
 assert(Math.abs(lights[1].left+lights[1].width/2-p.shaftAxis)<1e-8);assert.equal(p.access.axis,p.canopy.axis);assert.equal(p.access.axis,p.shaftAxis);
 const joined=p.quads.filter(q=>q.part==='ground-surround'&&q.normal[1]>0);assert(joined.some(q=>Math.min(...q.points.map(v=>v[0]))<ground[0].left&&Math.max(...q.points.map(v=>v[0]))>ground[2].left+ground[2].width),'one full connected header/sill must span the three openings');
 assert(p.quads.some(q=>q.part==='access-corbel'));assert(p.quads.filter(q=>q.part==='access-canopy').every(q=>q.zone==='shaft'));
});

test('actual assembled first hits preserve every glazing field and reach dark recessed access behind the parent plane',()=>{
 const p=planCompoundFrontage(input())!,ms=meshes(p);
 for(const w of p.windows)for(const fx of [.15,.5,.85])for(const fy of [.18,.45,.6]){
  const hit=firstHit(ms,w.left+w.width*fx,w.bottom+w.height*fy);assert(hit,`missing ${w.part}`);assert.equal(hit.object.userData.role,'glass',`${w.part} obscured by ${hit.object.userData.part}`);assert.equal(hit.object.userData.part,w.part);
 }
 const a=p.access;for(const oblique of [-.20,0,.20])for(const z of [.3,1.3,2.3]){
  const hit=firstHit(ms,a.axis,z,oblique);assert(hit);assert.equal(hit.object.userData.part,'access-door');assert(hit.point.y<-.30,'actual first hit must be behind the original wall');
 }
});

test('wall complement has no opaque strips across openings and exactly preserves the native wall area',()=>{
 for(const baseM of [0,8]){const i={...input(),baseM,topM:baseM+16.3},p=planCompoundFrontage(i)!;assert(p);
  assert(Math.abs(p.cutRects.reduce((s,r)=>s+area(r),0)+p.wallSegments.reduce((s,r)=>s+area(r),0)-i.lengthM*(i.topM-baseM))<1e-7);
  for(const a of p.cutRects)for(const b of p.wallSegments){const width=Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left),height=Math.min(a.bottom+a.height,b.bottom+b.height)-Math.max(a.bottom,b.bottom);assert(width<=1e-8||height<=1e-8);}
 }
});

test('explicit shaft axes/rows can vary without moving or scaling main rows',()=>{
 const i=input(),before=planCompoundFrontage(i)!;i.recipe.shaft.axisFraction=.55;i.recipe.shaft.rows[1].bottomM=9.8;const after=planCompoundFrontage(i)!;assert(after);
 assert.deepEqual(after.windows.filter(w=>w.zone==='main'),before.windows.filter(w=>w.zone==='main'));assert.notEqual(after.shaftAxis,before.shaftAxis);assert.notEqual(after.windows.find(w=>w.part==='shaft-principal'&&w.rowIndex===1)!.bottom,before.windows.find(w=>w.part==='shaft-principal'&&w.rowIndex===1)!.bottom);
 assert.equal(after.access.axis,after.shaftAxis);assert.equal(after.canopy.axis,after.shaftAxis);
});

test('native eave and aggregate top are envelope constraints and never reposition explicit source rows',()=>{
 const i=input(),eave=planCompoundFrontage({...i,topM:19.3})!,aggregate=planCompoundFrontage({...i,topM:22.99})!;assert(eave);assert(aggregate);
 assert.deepEqual(eave.windows,aggregate.windows);assert.deepEqual(eave.quads,aggregate.quads);assert.deepEqual(eave.cutRects,aggregate.cutRects);
 assert.equal(eave.mainZone.height,19.3);assert.equal(aggregate.mainZone.height,22.99);
 const addedArea=aggregate.wallSegments.reduce((s,r)=>s+area(r),0)-eave.wallSegments.reduce((s,r)=>s+area(r),0);
 assert(Math.abs(addedArea-i.lengthM*(22.99-19.3))<1e-7);
 assert.equal(planCompoundFrontage({...i,topM:15.2}),undefined,'a shorter native envelope must reject the entire recipe, not compress its rows');
});

test('reversed native direction mirrors the entire source plan with visible glazing/door, exact cuts, normals and UV associations',()=>{
 const i=input(),original=planCompoundFrontage(i)!,frozen=JSON.stringify(original),p=planCompoundFrontage({...i,direction:-1})!;assert(p);
 assert.deepEqual(planCompoundFrontage({...i,direction:1}),original);
 const mirrored=(r:CompoundRect)=>({...r,left:i.lengthM-r.left-r.width});
 for(const key of ['mainZone','shaftZone'] as const)assert.deepEqual(p[key],mirrored(original[key]));
 for(const key of ['windows','cutRects','wallSegments'] as const)assert.deepEqual(p[key],original[key].map(mirrored));
 assert.deepEqual(p.mainAxes,original.mainAxes.map(x=>i.lengthM-x));assert.equal(p.shaftAxis,i.lengthM-original.shaftAxis);
 assert.deepEqual(p.access,{...mirrored(original.access),axis:i.lengthM-original.access.axis});assert.deepEqual(p.canopy,{...mirrored(original.canopy),axis:i.lengthM-original.canopy.axis});
 assert(p.shaftZone.left<p.mainZone.left,'narrow shaft must switch sides with the source orientation');
 const ms=meshes(p);for(const w of p.windows)for(const fx of [.15,.5,.85]){
  const hit=firstHit(ms,w.left+w.width*fx,w.bottom+w.height*.45);assert(hit);assert.equal(hit.object.userData.role,'glass');assert.equal(hit.object.userData.part,w.part);
 }
 for(const oblique of [-.2,0,.2]){const hit=firstHit(ms,p.access.axis,1.3,oblique);assert(hit);assert.equal(hit.object.userData.part,'access-door');assert(hit.point.y<-.3);}
 assert(Math.abs(p.cutRects.reduce((s,r)=>s+area(r),0)+p.wallSegments.reduce((s,r)=>s+area(r),0)-i.lengthM*(i.topM-i.baseM))<1e-7);
 for(let n=0;n<p.quads.length;n++){
  const q=p.quads[n],source=original.quads[n];assert.equal(q.part,source.part);assert.equal(q.axisIndex,source.axisIndex);assert.equal(q.rowIndex,source.rowIndex);assert.equal(q.zone,source.zone);
  assert.deepEqual(q.normal,[source.normal[0]===0?0:-source.normal[0],source.normal[1],source.normal[2]]);
  for(const [v,k]of [0,3,2,1].entries()){assert.deepEqual(q.points[v],[i.lengthM-source.points[k][0],source.points[k][1],source.points[k][2]]);assert.deepEqual(q.uv[v],source.uv[k]);}
  const [a,b,c]=q.points,u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert(cross.reduce((s,v,k)=>s+v*q.normal[k],0)>0);
 }
 assert.equal(JSON.stringify(original),frozen);assert.deepEqual(i.recipe,recipe());
 for(const direction of [0,2,NaN,null,'-1'])assert.equal(planCompoundFrontage({...i,direction} as unknown as Parameters<typeof planCompoundFrontage>[0]),undefined);
});

test('incompatible complete frontage refuses partial panes, guessed height, row collisions or corbels crossing the door',()=>{
 assert(validateCompoundFrontageRecipe(recipe()));for(const value of [null,{},[],{...recipe(),mainColumns:4},{...recipe(),mainRows:[null]},{...recipe(),mainFraction:NaN}])assert(!validateCompoundFrontageRecipe(value));
 for(const i of [{...input(),lengthM:6.2},{...input(),topM:15.2},{...input(),topM:Infinity}])assert.equal(planCompoundFrontage(i),undefined);
 const collide=input();collide.recipe.shaft.rows[1].bottomM=7.9;assert.equal(planCompoundFrontage(collide),undefined);
 const outside=input();outside.recipe.shaft.axisFraction=.8;assert.equal(planCompoundFrontage(outside),undefined);
 const blocked=input();blocked.recipe.shaft.canopy.widthM=1.3;assert.equal(planCompoundFrontage(blocked),undefined);
 const wide=input();wide.recipe.groundSurround.openingWidthM=2.4;assert.equal(planCompoundFrontage(wide),undefined);
});

test('optional continuous masonry shaft, basement and cornice have unobscured glazing, closed body bands and exact parent cuts in either direction',()=>{
 const i=input();i.recipe.shaft.body={widthM:2.35,bottomM:3.15,topM:15.6,projectionM:.18};
 i.recipe.basement={bottomM:.2,heightM:.8,widthM:1.35,frameWidthM:.06};
 i.recipe.cornice={heightM:.25,projectionM:.35,blockCount:14,blockWidthM:.2,blockHeightM:.15,blockProjectionM:.25};
 const before=JSON.stringify(i);
 for(const direction of [1,-1] as const){const p=planCompoundFrontage({...i,direction})!;assert(p);const ms=meshes(p);
  assert.equal(p.windows.filter(w=>w.part==='basement-window').length,3);assert.equal(p.windows.length,27);
  for(const w of p.windows)for(const fx of [.2,.5,.8]){const hit=firstHit(ms,w.left+w.width*fx,w.bottom+w.height*.45);assert(hit);assert.equal(hit.object.userData.role,'glass',`${w.part} obscured by ${hit.object.userData.part}`);}
  const principal=p.windows.find(w=>w.part==='shaft-principal')!;assert(Math.abs(principal.out-(.045+.18+.25-.012))<1e-9,'window projection is relative to the connected body front');
  const bodyHit=firstHit(ms,p.shaftAxis,9.15);assert(bodyHit);assert.equal(bodyHit.object.userData.part,'shaft-body');assert.equal(bodyHit.object.userData.role,'wall');assert(Math.abs(bodyHit.point.y-.225)<1e-6);
  assert.equal(firstHit(ms,p.access.axis,1.3)!.object.userData.part,'access-door');
  assert.equal(firstHit(ms,1,16.15)!.object.userData.part,'cornice');
  const bodyCap=new T.Raycaster(new T.Vector3(p.shaftAxis,.1,15.9),new T.Vector3(0,0,-1),0,1).intersectObjects(ms,false)[0];assert(bodyCap);assert.equal(bodyCap.object.userData.part,'shaft-body-cap');
  const block=p.quads.find(q=>q.part==='cornice-block'&&q.normal[1]===1)!;assert.equal(firstHit(ms,(block.points[0][0]+block.points[2][0])/2,15.98)!.object.userData.part,'cornice-block');
  assert(p.quads.some(q=>q.part==='shaft-body-return'&&q.normal[0]===-1));assert(p.quads.some(q=>q.part==='shaft-body-return'&&q.normal[0]===1));
  const bodyCut=p.cutRects.find(r=>Math.abs(r.width-2.35)<1e-8&&Math.abs(r.height-12.45)<1e-8)!;assert(bodyCut);
  assert(p.windows.filter(w=>w.zone==='shaft').every(w=>w.left>=bodyCut.left&&w.left+w.width<=bodyCut.left+bodyCut.width&&w.bottom>=bodyCut.bottom&&w.bottom+w.height<=bodyCut.bottom+bodyCut.height));
  assert.equal(p.cutRects.length,17,'nested shaft apertures must become one parent body cut, not overlapping parent cuts');
  assert(Math.abs(p.cutRects.reduce((s,r)=>s+area(r),0)+p.wallSegments.reduce((s,r)=>s+area(r),0)-i.lengthM*i.topM)<1e-7);
  for(const q of p.quads){const [a,b,c]=q.points,u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert(cross.reduce((s,v,k)=>s+v*q.normal[k],0)>0);}
 }
 assert.equal(JSON.stringify(i),before);
 const clipped=structuredClone(i);clipped.recipe.shaft.body!.topM=15.2;assert.equal(planCompoundFrontage(clipped),undefined);
 const blocked=structuredClone(i);blocked.recipe.shaft.body!.bottomM=2.8;assert.equal(planCompoundFrontage(blocked),undefined);
 const crossing=structuredClone(i);crossing.recipe.basement!.heightM=1.5;assert.equal(planCompoundFrontage(crossing),undefined);
 const crown=structuredClone(i);crown.recipe.cornice!.heightM=.7;assert.equal(planCompoundFrontage(crown),undefined);
});

test('all complete quads have finite bounded coordinates, correct winding and independent outputs without mutating the recipe',()=>{
 const i=input(),before=JSON.stringify(i),a=planCompoundFrontage(i)!,b=planCompoundFrontage(i)!;assert.equal(JSON.stringify(i),before);assert.deepEqual(a,b);
 for(const q of a.quads){assert(q.points.every(([x,out,z])=>Number.isFinite(x+out+z)&&x>=0&&x<=i.lengthM&&out>=-.35&&out<=1.5&&z>=i.baseM&&z<=i.topM));const [p,r,s]=q.points,u=r.map((v,k)=>v-p[k]),v=s.map((n,k)=>n-p[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert(cross.reduce((sum,n,k)=>sum+n*q.normal[k],0)>0);}
 a.windows[0].left=99;assert.notEqual(b.windows[0].left,99);
});
