import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {planRegularCanalFrontage,validateRegularCanalFrontageRecipe,type RegularCanalFrontageRecipe,type RegularCanalFrontagePlan} from './regularCanalFrontage.ts';

/** Synthetic bounded capability fixture, not a source admission or facade fit. */
const recipe=():RegularCanalFrontageRecipe=>({columns:3,insetM:.2,frameWidthM:.07,recessDepthM:.16,
 upperRows:[{bottomM:7,heightM:2.6,widthM:1.25,paneColumns:3,paneRows:3},{bottomM:10.2,heightM:1.8,widthM:1.25,paneColumns:3,paneRows:2},{bottomM:12.7,heightM:1.4,widthM:1.25,paneColumns:3,paneRows:2},{bottomM:14.8,heightM:1.0,widthM:1.25,paneColumns:2,paneRows:1}],
 ground:{bottomM:1.8,heightM:4.6,widthM:1.25,paneColumns:3,paneRows:4},
 entrance:{leafHeightM:2.8,stepCount:7,treadM:.26,landingDepthM:.5,stairWidthM:1.4,railHeightM:.95},
 basement:{heightM:1.8,access:{axisIndex:2,bottomM:0,heightM:1.7,widthM:1.15},window:{axisIndex:1,bottomM:.25,heightM:1.1,widthM:1.2,paneColumns:2,paneRows:2}}});
const input=()=>({lengthM:5.1,baseM:0,topM:17,recipe:recipe()});
function meshes(p:RegularCanalFrontagePlan){const out:T.Mesh[]=[];
 for(const q of p.quads){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(q.points.flat(),3));g.setIndex([0,1,2,0,2,3]);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData=q;out.push(m);}
 for(const r of p.wallSegments){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([r.left,0,r.bottom,r.left+r.width,0,r.bottom,r.left+r.width,0,r.bottom+r.height,r.left,0,r.bottom+r.height],3));g.setIndex([0,1,2,0,2,3]);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData={role:'parent-wall'};out.push(m);}return out;
}
function first(ms:T.Mesh[],x:number,z:number,oblique=0){const origin=new T.Vector3(x+oblique,4,z),direction=new T.Vector3(-oblique,-4,0).normalize();return new T.Raycaster(origin,direction,0,5).intersectObjects(ms,false)[0];}

test('three shared axes, tall ground and explicit shortening upper tiers retain source datums across height envelopes',()=>{
 const p=planRegularCanalFrontage(input())!;assert(p);assert.equal(p.windows.filter(w=>w.part==='upper-window').length,12);
 for(const w of p.windows)assert(Math.abs(w.left+w.width/2-p.axes[w.axisIndex])<1e-8);
 const taller=planRegularCanalFrontage({...input(),topM:20})!;assert(taller);assert.deepEqual(taller.windows,p.windows);assert.deepEqual(taller.quads,p.quads);
 const rows=p.windows.filter(w=>w.part==='upper-window'&&w.axisIndex===0);assert.deepEqual(rows.map(w=>w.bottom),recipe().upperRows.map(r=>r.bottomM+.07));
 assert(rows.every((w,i)=>i===0||w.height<rows[i-1].height));assert(p.windows.find(w=>w.part==='ground-window')!.height>rows[0].height);
 assert(p.quads.every(q=>!String(q.part).includes('roof')&&!String(q.part).includes('crown')));
});

test('first-hit wall cuts reveal dark upper/lower access and glass panes, including oblique approaches',()=>{
 for(const direction of [1,-1] as const){const p=planRegularCanalFrontage({...input(),direction})!,ms=meshes(p);assert(p);
  for(const w of p.windows)for(const [fx,fy]of [[.12,.12],[.82,.88]])for(const oblique of [-.12,0,.12]){
   const h=first(ms,w.left+w.width*fx,w.bottom+w.height*fy,oblique);assert(h,`missing ${w.part}`);assert.equal(h.object.userData.role,'glass',`${w.part} hidden by ${h.object.userData.part}`);
  }
  for(const a of [p.access,p.lowerAccess])for(const oblique of [-.12,0,.12]){const h=first(ms,a.axis,a.bottom+a.height*.5,oblique);assert(h);assert.equal(h.object.userData.role,'door');assert(h.point.y<0);}
 }
});

test('connected stair and open rail geometry meets the raised door on its physical axis',()=>{
 const p=planRegularCanalFrontage(input())!,e=input().recipe.entrance;
 const landingTop=p.quads.find(q=>q.part==='landing'&&q.normal[2]===1)!;assert(landingTop);assert(landingTop.points.every(v=>v[2]===p.access.bottom));
 assert(Math.abs((Math.min(...landingTop.points.map(v=>v[0]))+Math.max(...landingTop.points.map(v=>v[0])))/2-p.access.axis)<1e-8);
 const tops=p.quads.filter(q=>q.part==='stair'&&q.normal[2]===1);assert.equal(tops.length,e.stepCount);
 for(let k=0;k<tops.length-1;k++)assert(Math.abs(Math.max(...tops[k].points.map(v=>v[1]))-Math.min(...tops[k+1].points.map(v=>v[1])))<1e-8);
 assert(p.quads.filter(q=>q.part==='rail').every(q=>Math.max(...q.points.map(v=>v[0]))-Math.min(...q.points.map(v=>v[0]))<=.046),'rails stay thin/open');
 const h=first(meshes(p),p.access.axis,p.access.bottom-.04);assert(h);assert.equal(h.object.userData.part,'stair');
 const down=new T.Raycaster(new T.Vector3(p.access.axis,e.landingDepthM/2,p.access.bottom+1),new T.Vector3(0,0,-1),0,2).intersectObjects(meshes(p),false)[0];assert(down);assert.equal(down.object.userData.part,'landing');
});

test('complete native complement preserves area without opaque strips, including a raised native base',()=>{
 for(const baseM of [0,6]){const i={...input(),baseM,topM:baseM+17},p=planRegularCanalFrontage(i)!;assert(p);
  const area=p.cutRects.concat(p.wallSegments).reduce((s,r)=>s+r.width*r.height,0);assert(Math.abs(area-i.lengthM*17)<1e-7);
  for(const a of p.cutRects)for(const b of p.wallSegments)assert(Math.min(a.left+a.width,b.left+b.width)<=Math.max(a.left,b.left)+1e-8||Math.min(a.bottom+a.height,b.bottom+b.height)<=Math.max(a.bottom,b.bottom)+1e-8);
 }
});

test('mirror preserves UV associations, correctly wound outward normals and immutable recipe input',()=>{
 const i=input(),saved=JSON.stringify(i),p=planRegularCanalFrontage(i)!,mirror=planRegularCanalFrontage({...i,direction:-1})!;
 assert.equal(JSON.stringify(i),saved);assert.deepEqual(mirror.axes,p.axes.map(x=>i.lengthM-x));
 for(let k=0;k<p.quads.length;k++){const q=mirror.quads[k],a=p.quads[k];
  assert.deepEqual(q.normal,[a.normal[0]===0?0:-a.normal[0],a.normal[1],a.normal[2]]);
  for(const[v,j]of [0,3,2,1].entries()){assert.deepEqual(q.uv[v],a.uv[j]);assert.deepEqual(q.points[v],[i.lengthM-a.points[j][0],a.points[j][1],a.points[j][2]]);}
 }
 for(const q of p.quads.concat(mirror.quads)){const[a,b,c]=q.points,u=b.map((n,j)=>n-a[j]),v=c.map((n,j)=>n-a[j]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert(cross.reduce((s,n,j)=>s+n*q.normal[j],0)>0);assert(q.uv.flat().every(n=>n>=0&&n<=1));}
});

test('optional leaf panels remain inside both recessed doors and mirror without filling glazing or moving cuts',()=>{
 const i=input(),plain=planRegularCanalFrontage(i)!;
 for(const columns of [1,2]as const)for(const direction of [1,-1]as const){
  const p=planRegularCanalFrontage({...i,direction,recipe:{...i.recipe,doorPanels:{columns,rows:2}}})!;assert(p);
  const baseline=planRegularCanalFrontage({...i,direction})!;assert.deepEqual(p.cutRects,baseline.cutRects);assert.deepEqual(p.windows,baseline.windows);
  const faces=p.quads.filter(q=>q.role==='door-panel'&&q.normal[1]===1);assert.equal(faces.length,columns*4);
  for(const q of faces){const a=q.part==='entrance-door'?p.access:p.lowerAccess;
   assert(q.points.every(([x,out,z])=>x>a.left&&x<a.left+a.width&&z>a.bottom&&z<a.bottom+a.height&&Math.abs(out-(a.out+.020))<1e-8));
  }
 }
 assert(plain);assert.equal(validateRegularCanalFrontageRecipe({...i.recipe,doorPanels:{columns:3,rows:2}}),false);
});
test('bracketed cornice and hoist stay below the native top and do not cap or recut the parent roof',()=>{
 const i=input(),cornice={heightM:.28,projectionM:.4,blockCount:10,blockWidthM:.2,blockHeightM:.24,blockProjectionM:.25,hoist:{widthM:.14,heightM:.14,projectionM:1}};
 const plain=planRegularCanalFrontage(i)!,p=planRegularCanalFrontage({...i,recipe:{...i.recipe,cornice}})!;assert(p);
 assert.deepEqual(p.cutRects,plain.cutRects);assert.deepEqual(p.wallSegments,plain.wallSegments);assert.deepEqual(p.windows,plain.windows);
 const trim=p.quads.filter(q=>['cornice','cornice-block','hoist'].includes(q.part));assert(trim.length>0);
 assert.equal(trim.filter(q=>q.part==='cornice-block'&&q.normal[2]===1).length,10);
 assert(trim.every(q=>q.points.every(([x,out,z])=>x>0&&x<i.lengthM&&out>0&&z<=i.topM-.1)));
 assert.equal(p.quads.filter(q=>q.part==='hoist'&&q.normal[2]===1).length,1);
 assert.equal(planRegularCanalFrontage({...i,topM:16.3,recipe:{...i.recipe,cornice}}),undefined,'trim cannot cross the last observed window row');
 assert.equal(validateRegularCanalFrontageRecipe({...i.recipe,cornice:{...cornice,blockCount:100}}),false);
});
test('incompatible whole plans reject atomically instead of changing native fallback or compressing source rows',()=>{
 assert(validateRegularCanalFrontageRecipe(recipe()));for(const value of [null,{},[],{...recipe(),columns:4}])assert.equal(validateRegularCanalFrontageRecipe(value),false);
 const i=input(),saved=JSON.stringify(i);assert.equal(planRegularCanalFrontage({...i,topM:15}),undefined);assert.equal(planRegularCanalFrontage({...i,lengthM:4}),undefined);assert.equal(JSON.stringify(i),saved);
 for(const mutate of [(r:RegularCanalFrontageRecipe)=>r.upperRows[1].bottomM=8,(r:RegularCanalFrontageRecipe)=>r.upperRows[1].heightM=3,(r:RegularCanalFrontageRecipe)=>r.entrance.stepCount=2,(r:RegularCanalFrontageRecipe)=>r.basement.window!.axisIndex=2,(r:RegularCanalFrontageRecipe)=>r.ground.heightM=2]){const next=input();mutate(next.recipe);assert.equal(planRegularCanalFrontage(next),undefined);}
 for(const direction of [0,2,NaN,null])assert.equal(planRegularCanalFrontage({...input(),direction} as unknown as Parameters<typeof planRegularCanalFrontage>[0]),undefined);
 const three=input();three.recipe.upperRows.pop();assert(planRegularCanalFrontage(three),'three observed upper tiers are independently supported');
});
