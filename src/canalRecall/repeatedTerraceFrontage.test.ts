import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {planRepeatedTerraceFrontage,validateRepeatedTerraceFrontageRecipe,type RepeatedTerraceFrontageRecipe,type RepeatedTerraceFrontagePlan} from './repeatedTerraceFrontage.ts';

/** Capability fixture only; source admission and game review belong to caller. */
const recipe=():RepeatedTerraceFrontageRecipe=>({columns:2,insetM:.2,frameWidthM:.07,sashWidthM:.04,recessDepthM:.16,
  upperRows:[{bottomM:3.7,heightM:2.3,widthM:1.2},{bottomM:6.6,heightM:2.3,widthM:1.2},{bottomM:9.5,heightM:2.2,widthM:1.2}],
  ground:{bottomM:0,heightM:2.9,widthM:1.2},groundWindowRow:{bottomM:.3,heightM:2.6,widthM:1.2},entrance:{axisIndex:0,leafHeightM:2.1},
  stringCourses:[{bottomM:3.2,heightM:.1,projectionM:.05},{bottomM:6.2,heightM:.1,projectionM:.05},{bottomM:9.1,heightM:.1,projectionM:.05}]});
const input=()=>({lengthM:4.8,baseM:0,topM:12.5,recipe:recipe()});
function meshes(p:RepeatedTerraceFrontagePlan){const out:T.Mesh[]=[];
  for(const q of p.quads){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(q.points.flat(),3));g.setIndex([0,1,2,0,2,3]);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.userData=q;out.push(m);}
  for(const a of p.wallSegments){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([a.left,0,a.bottom,a.left,0,a.bottom+a.height,a.left+a.width,0,a.bottom+a.height,a.left+a.width,0,a.bottom],3));g.setIndex([0,1,2,0,2,3]);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.userData={role:'wall'};out.push(m);}return out;
}
const hit=(ms:T.Mesh[],x:number,z:number,oblique=0)=>new T.Raycaster(new T.Vector3(x+oblique,4,z),new T.Vector3(-oblique,-4,0).normalize(),0,5).intersectObjects(ms,false)[0];
const overlap=(a:{left:number;bottom:number;width:number;height:number},b:typeof a)=>Math.min(a.left+a.width,b.left+b.width)>Math.max(a.left,b.left)+1e-8&&Math.min(a.bottom+a.height,b.bottom+b.height)>Math.max(a.bottom,b.bottom)+1e-8;

test('source tiers and entrance stay unscaled under taller and raised envelopes, with bounded complete frontage cost',()=>{
  const i=input(),p=planRepeatedTerraceFrontage(i)!;assert(p);assert.equal(p.cutRects.length,8);assert.equal(p.windows.length,8);
  const tall=planRepeatedTerraceFrontage({...i,topM:18})!;assert.deepEqual(tall.quads,p.quads);assert.deepEqual(tall.cutRects,p.cutRects);
  const raised=planRepeatedTerraceFrontage({...i,baseM:5,topM:17.5})!;assert(raised);
  assert.deepEqual(raised.cutRects,p.cutRects.map(a=>({...a,bottom:a.bottom+5})));
  assert.equal(p.access.bottom,0);assert.equal(p.access.height,2.1);
  assert(p.quads.every(q=>!['stair','basement','hoist','cornice'].includes(q.part)));
  const triangles=(p.quads.length+p.wallSegments.length)*2;assert(triangles>=400&&triangles<=700,`triangle budget ${triangles}`);
  const three=recipe();three.columns=3;assert(planRepeatedTerraceFrontage({...i,lengthM:6.8,recipe:three}));
  const doorOnly=recipe();doorOnly.groundWindowAxes=[];assert.equal(planRepeatedTerraceFrontage({...i,recipe:doorOnly})!.cutRects.length,7);
});

test('real cuts expose recessed panes and door from direct and oblique approaches with single sided winding',()=>{
  for(const direction of [1,-1]as const){const p=planRepeatedTerraceFrontage({...input(),direction})!,ms=meshes(p);assert(p);
    for(const w of p.windows)for(const [fx,fy]of [[.2,.2],[.8,.9]])for(const oblique of [-.1,0,.1]){
      const h=hit(ms,w.left+w.width*fx,w.bottom+w.height*fy,oblique);assert(h);assert.equal(h.object.userData.role,'glass');assert(h.point.y<0);
    }
    const h=hit(ms,p.access.axis,p.access.bottom+1);assert(h);assert.equal(h.object.userData.role,'door');
    const a=p.cutRects[0],pale=hit(ms,a.left+.035,a.bottom+a.height*.45);assert.equal(pale?.object.userData.role,'frame');
    const green=hit(ms,a.left+.09,a.bottom+a.height*.45);assert.equal(green?.object.userData.role,'sash');
  }
});

test('broad paired casements expose both glazed fields around a proud cream central mullion',()=>{
  for(const direction of [1,-1]as const){const p=planRepeatedTerraceFrontage({...input(),direction})!,ms=meshes(p);
    for(const w of p.windows.filter(w=>w.part!=='entrance-transom')){
      const z=w.bottom+w.height*.4;
      for(const fx of [.25,.75])for(const oblique of [-.1,0,.1])assert.equal(hit(ms,w.left+w.width*fx,z,oblique)?.object.userData.role,'glass');
      const middle=hit(ms,w.left+w.width/2,z);assert.equal(middle?.object.userData.role,'frame');assert(Math.abs(middle!.point.y-.035)<1e-7);
    }
  }
  const i=input();i.recipe.upperRows[0].paneColumns=1;
  const p=planRepeatedTerraceFrontage(i)!,w=p.windows[0];assert.equal(hit(meshes(p),w.left+w.width/2,w.bottom+w.height*.4)?.object.userData.role,'glass');
  i.recipe.upperRows[0].transomFraction=false;const noTransom=planRepeatedTerraceFrontage(i)!,plain=noTransom.windows[0];
  assert.equal(hit(meshes(noTransom),plain.left+plain.width*.25,plain.bottom+plain.height*.7)?.object.userData.role,'glass');
  assert.equal(validateRepeatedTerraceFrontageRecipe({...recipe(),upperRows:[{...recipe().upperRows[0],paneColumns:3}]}),false);
});

test('complete complement covers native wall exactly once and never overlaps any aperture',()=>{
  const i=input(),p=planRepeatedTerraceFrontage(i)!;
  const all=p.cutRects.concat(p.wallSegments);assert(Math.abs(all.reduce((sum,a)=>sum+a.width*a.height,0)-i.lengthM*i.topM)<1e-7);
  all.forEach((a,k)=>all.slice(k+1).forEach(b=>assert(!overlap(a,b))));
});

test('mirror preserves entrance identity, vertex UV associations, outward winding and recipe immutability',()=>{
  const i=input(),saved=JSON.stringify(i),p=planRepeatedTerraceFrontage(i)!,m=planRepeatedTerraceFrontage({...i,direction:-1})!;
  assert.equal(JSON.stringify(i),saved);assert.equal(m.access.axis,i.lengthM-p.access.axis);
  for(let k=0;k<p.quads.length;k++){const a=p.quads[k],b=m.quads[k];for(const [v,j]of [0,3,2,1].entries()){
    assert.deepEqual(b.points[v],[i.lengthM-a.points[j][0],a.points[j][1],a.points[j][2]]);assert.deepEqual(b.uv[v],a.uv[j]);
  }}
  for(const q of p.quads.concat(m.quads)){const[a,b,c]=q.points,u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert(cross.reduce((s,n,j)=>s+n*q.normal[j],0)>0);}
  const right=recipe();right.entrance.axisIndex=1;assert.equal(planRepeatedTerraceFrontage({...i,recipe:right})!.access.axis,p.axes[1]);
});

test('optional shallow lintels remain below source eave without changing aperture or wall ownership',()=>{
  const i=input(),p=planRepeatedTerraceFrontage(i)!,next=planRepeatedTerraceFrontage({...i,recipe:{...i.recipe,segmentalLintel:{riseM:.12,bandM:.07,projectionM:.04}}})!;assert(next);
  assert.deepEqual(next.cutRects,p.cutRects);assert.deepEqual(next.wallSegments,p.wallSegments);assert.equal(next.quads.filter(q=>q.part==='segmental-lintel').length,64);
  assert(next.quads.every(q=>q.points.every(([x,_,z])=>x>=0&&x<=i.lengthM&&z>=0&&z<=i.topM-.1)));
});

test('all incompatible fits fail atomically including unsupported rows, overlaps, trim and narrow fronts',()=>{
  for(const v of [null,{},[],{...recipe(),columns:4},{...recipe(),groundWindowAxes:[0]},{...recipe(),groundWindowAxes:[1,1]},{...recipe(),entrance:{axisIndex:2,leafHeightM:2.1}}])assert.equal(validateRepeatedTerraceFrontageRecipe(v),false);
  assert(validateRepeatedTerraceFrontageRecipe(recipe()));
  const i=input();assert.equal(planRepeatedTerraceFrontage({...i,topM:11.5}),undefined);assert.equal(planRepeatedTerraceFrontage({...i,lengthM:3.3}),undefined);
  for(const change of [(r:RepeatedTerraceFrontageRecipe)=>r.upperRows[1].bottomM=4,(r:RepeatedTerraceFrontageRecipe)=>r.upperRows[0].widthM=2.4,
    (r:RepeatedTerraceFrontageRecipe)=>r.stringCourses![0].bottomM=6.2,(r:RepeatedTerraceFrontageRecipe)=>r.upperRows[1].bottomM=6.03,
    (r:RepeatedTerraceFrontageRecipe)=>r.stringCourses!.push({...r.stringCourses![0]}),
    (r:RepeatedTerraceFrontageRecipe)=>r.segmentalLintel={riseM:.3,bandM:.16,projectionM:.05}]){
    const next=input();change(next.recipe);assert(!planRepeatedTerraceFrontage(next),`incompatible recipe ${JSON.stringify(next.recipe)}`);
  }
  for(const direction of [0,2,NaN,null])assert.equal(planRepeatedTerraceFrontage({...i,direction}as unknown as Parameters<typeof planRepeatedTerraceFrontage>[0]),undefined);
});

test('low masonry course splits around real door and ground windows without hiding recessed fields',()=>{
  for(const direction of [1,-1]as const){const i=input();i.recipe.stringCourses!.unshift({bottomM:.5,heightM:.1,projectionM:.055});
    const p=planRepeatedTerraceFrontage({...i,direction})!;assert(p);const ms=meshes(p),z=.55;
    assert.equal(hit(ms,p.access.axis,z)?.object.userData.role,'door');
    const w=p.windows.find(w=>w.part==='ground-window')!;
    for(const fraction of [.25,.75])assert.equal(hit(ms,w.left+w.width*fraction,z)?.object.userData.role,'glass');
    assert.equal(hit(ms,.1,z)?.object.userData.part,'string-course');
    for(const q of p.quads.filter(q=>q.part==='string-course'&&q.normal[1]===1)){
      const xs=q.points.map(v=>v[0]),zs=q.points.map(v=>v[2]);const a={left:Math.min(...xs),width:Math.max(...xs)-Math.min(...xs),bottom:Math.min(...zs),height:Math.max(...zs)-Math.min(...zs)};
      assert(p.cutRects.every(b=>!overlap(a,b)));
    }
  }
});

test('wide three-axis front supports explicit narrow boundary lights without stretching source dimensions',()=>{
  const r=recipe();r.columns=3;r.entrance.axisIndex=1;
  r.upperRows.forEach(row=>row.axisWidthsM=[2,1.45,2]);r.ground.axisWidthsM=[2,1.45,2];
  r.boundaryWindows=[{axisM:.6,row:{bottomM:4.4,heightM:.8,widthM:.32}},{axisM:12.4,row:{bottomM:7.3,heightM:.8,widthM:.32}}];
  const p=planRepeatedTerraceFrontage({lengthM:13,baseM:0,topM:12.5,recipe:r})!;assert(p);assert.equal(p.cutRects.length,14);
  assert(Math.abs(p.access.axis-6.5)<1e-8);assert.equal(p.cutRects[12].width,.32);assert.equal(p.cutRects[13].height,.8);
  assert.deepEqual(p.cutRects.slice(0,3).map(a=>a.width),[2,1.45,2]);assert.equal(p.access.width,1.45);
  assert(Math.abs(p.windows[12].left+p.windows[12].width/2-.6)<1e-8);
  for(const w of p.windows.slice(12)){const h=hit(meshes(p),w.left+w.width*.2,w.bottom+w.height*.2);assert.equal(h?.object.userData.role,'glass');}
  const mirrored=planRepeatedTerraceFrontage({lengthM:13,baseM:0,topM:12.5,recipe:r,direction:-1})!;assert(mirrored);
  assert(Math.abs(mirrored.windows[12].left+mirrored.windows[12].width/2-12.4)<1e-8);
  r.boundaryWindows[0].axisM=p.axes[0];assert(!planRepeatedTerraceFrontage({lengthM:13,baseM:0,topM:12.5,recipe:r}));
});
