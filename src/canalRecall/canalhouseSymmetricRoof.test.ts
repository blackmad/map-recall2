import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {canalhouseSymmetricRoof,canalhouseRoofAssemblies} from './canalhouseSymmetricRoof.ts';
import {surveyRecipe} from '../../scripts/canalhouse-recipes/survey-recipe.ts';
import type {CanalHouseRecipe,CanalhousePoint} from './canalhouseRecipes.ts';
type Roof=CanalHouseRecipe['roof']['value'][number];
const roof=(outer:CanalhousePoint[],h=4):Roof=>({polygon:{outer,holes:[]},plane:{heightM:h,slopeX:0,slopeZ:0}});
const area=(r:Roof)=>Math.abs(r.polygon.outer.reduce((s,p,i)=>{const q=r.polygon.outer[(i+1)%r.polygon.outer.length];return s+p[0]*q[1]-q[0]*p[1]},0))/2;
const h=(r:Roof,p:CanalhousePoint)=>r.plane.heightM+r.plane.slopeX*p[0]+r.plane.slopeZ*p[1];
test('symmetric hip repairs continuous slopes, preserves an annex and excluded courtyard plan',()=>{
 // Native coverage of a 4x8main roof with a 1x1courtyard removed.
 const main=[roof([[0,0],[4,0],[4,3]]),roof([[0,0],[4,3],[0,3]]),roof([[0,3],[1.5,3],[1.5,4]]),roof([[0,3],[1.5,4],[0,4]]),roof([[2.5,3],[4,3],[4,4]]),roof([[2.5,3],[4,4],[2.5,4]]),roof([[0,4],[4,4],[4,8]]),roof([[0,4],[4,8],[0,8]])];
 const annex=roof([[4,0],[5,0],[4,8]],2),input=[...main,annex],before=JSON.stringify(input);
 const result=canalhouseSymmetricRoof(input,[...main.map(()=> 'main'),'annex'],{a:[0,0],b:[4,0],normal:[0,-1]},{template:'symmetric-front-hip',surfaceIds:['main'],eavesM:10,ridgeM:13,hipDepthM:2});
 assert.equal(JSON.stringify(input),before);assert.equal(result.at(-1),annex);
 assert.ok(Math.abs(result.reduce((s,r)=>s+area(r),0)-input.reduce((s,r)=>s+area(r),0))<1e-8);
 for(const r of result.slice(0,-1))for(const p of r.polygon.outer){assert.ok(Math.abs(h(r,p)-Math.min(10+1.5*p[0],16-1.5*p[0],10+1.5*p[1]))<1e-8);}
 const boundary=result.slice(0,-1).flatMap(r=>r.polygon.outer.filter(p=>p[1]===0).map(p=>h(r,p)));assert.ok(boundary.every(v=>Math.abs(v-10)<1e-8));
 // Coverage is only subdivided inside each original triangle, never courtyard filled.
 assert.ok(result.slice(0,-1).every(r=>!r.polygon.outer.some(p=>p[0]>1.5&&p[0]<2.5&&p[1]>3&&p[1]<4)));
});
test('roof symmetry is independent of frontage world orientation',()=>{
 const input=[roof([[0,0],[0,4],[-8,4]]),roof([[0,0],[-8,4],[-8,0]])];
 const result=canalhouseSymmetricRoof(input,['main','main'],{a:[0,0],b:[0,4],normal:[1,0]},{template:'symmetric-front-hip',surfaceIds:['main'],eavesM:10,ridgeM:13,hipDepthM:2});
 for(const r of result)for(const p of r.polygon.outer)assert.ok(Math.abs(h(r,p)-Math.min(10+1.5*p[1],16-1.5*p[1],10-1.5*p[0]))<1e-8);
});
test('missing source selection and unsupported partition topology fail explicitly',()=>{
 const front={a:[0,0] as CanalhousePoint,b:[4,0] as CanalhousePoint,normal:[0,-1] as CanalhousePoint};
 assert.throws(()=>canalhouseSymmetricRoof([roof([[0,0],[4,0],[0,4]])],['main'],front,{template:'symmetric-front-hip',surfaceIds:['absent'],eavesM:10,ridgeM:13,hipDepthM:2}),/Unknown/);
});

test('omitted fit preserves the pre-extension legacy numeric output',()=>{
 const input=[roof([[5,7],[9,7],[9,15]]),roof([[5,7],[9,15],[5,15]])];
 const front={a:[5,7] as CanalhousePoint,b:[9,7] as CanalhousePoint,normal:[0,-1] as CanalhousePoint};
 const selection={template:'symmetric-front-hip' as const,surfaceIds:['main'],eavesM:10,ridgeM:13,hipDepthM:2};
 const result=canalhouseSymmetricRoof(input,['main','main'],front,selection);
 assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'),'bf6936cde5363c141d3b096be75beb10008dfd1a7d7bd5089a9195709f4c7def');
 assert.deepEqual(canalhouseSymmetricRoof(input,['main','main'],front,{...selection,fit:undefined}),result);
});
test('native envelope bounds drifting coverage while retaining a courtyard and excluded far end',()=>{
 const rectangle=(left:number,right:number,near:number,far:number)=>{
  const p=(x:number,z:number):CanalhousePoint=>[x+z*.05,z];
  return [roof([p(left,near),p(right,near),p(right,far)]),roof([p(left,near),p(right,far),p(left,far)])];
 };
 // Irregular long-lot fixture with a 1x1 open court, negative front return
 // and an excluded far end. The front chord only spans x0..4.
 const main=[...rectangle(-1,5,-.3,2),...rectangle(-1,1,2,3),...rectangle(2,5,2,3),...rectangle(-1,5,3,40)];
 const annex=rectangle(-1,5,40,42),input=[...main,...annex],before=JSON.stringify(input);
 const front={a:[0,0] as CanalhousePoint,b:[4,0] as CanalhousePoint,normal:[0,-1] as CanalhousePoint};
 for(const template of ['symmetric-front-hip','symmetric-gable','front-slope'] as const){
  const selection={template,surfaceIds:['main'],eavesM:10,ridgeM:15,fit:'native-envelope' as const,...(template==='symmetric-front-hip'?{hipDepthM:2.7}:template==='front-slope'?{frontRunM:2.7}:{})};
  const result=canalhouseSymmetricRoof(input,[...main.map(()=> 'main'),...annex.map(()=> 'annex')],front,selection),selected=result.filter(r=>!annex.includes(r));
  assert.equal(JSON.stringify(input),before);for(const r of annex)assert(result.includes(r));
  assert(Math.abs(selected.reduce((s,r)=>s+area(r),0)-main.reduce((s,r)=>s+area(r),0))<1e-8);
  const inPolygon=(p:CanalhousePoint,r:Roof)=>{const signs=r.polygon.outer.map((a,i)=>{const b=r.polygon.outer[(i+1)%r.polygon.outer.length];return(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);});return signs.every(s=>s>=-1e-8)||signs.every(s=>s<=1e-8);};
  assert(!selected.some(r=>inPolygon([1.625,2.5],r)));
  for(const r of selected)for(const p of r.polygon.outer){assert(h(r,p)>=10-1e-8);assert(h(r,p)<=15+1e-8);assert(main.some(parent=>inPolygon(p,parent)));}
  assert(selected.some(r=>r.polygon.outer.some(p=>Math.abs(h(r,p)-15)<1e-8)));
 }
});
test('actual cached 130 native triangles fit without below-eave planes or altered far-end20',()=>{
 const survey=JSON.parse(fs.readFileSync(new URL('../../docs/references/canalhouse-recipes/bloemgracht-130-survey.json',import.meta.url),'utf8'));
 const native=surveyRecipe(survey,survey.surveyFootprintPolygonsRD,[[120407.929,487522.6635],[120414.2,487525.3005]]);
 const suffix='NL.IMBAG.Pand.0363100012168079-0:lod22:roof:',ids=[21,22,23].map(i=>suffix+i);
 const selection={template:'symmetric-front-hip' as const,surfaceIds:ids,eavesM:11.714500885009766,ridgeM:16.216500885009765,hipDepthM:2.7};
 const legacy=canalhouseSymmetricRoof(native.roof,native.roofOwners,native.front,selection);
 assert(legacy.some(r=>r.polygon.outer.some(p=>h(r,p)<selection.eavesM-1e-5)));
 const before=JSON.stringify(native.roof),excluded=native.roof.filter((r,i)=>native.roofOwners[i]===suffix+20);
 const result=canalhouseSymmetricRoof(native.roof,native.roofOwners,native.front,{...selection,fit:'native-envelope'});
 assert.equal(JSON.stringify(native.roof),before);for(const r of excluded)assert(result.includes(r));
 assert(Math.abs(result.reduce((s,r)=>s+area(r),0)-native.roof.reduce((s,r)=>s+area(r),0))<1e-7);
 for(const r of result.filter(r=>!excluded.includes(r)))for(const p of r.polygon.outer){assert(h(r,p)>=selection.eavesM-1e-7);assert(h(r,p)<=selection.ridgeM+1e-7);}
});
test('native envelope rejects unsupported modes, degenerate coverage and invalid construction basis',()=>{
 const input=[roof([[0,0],[4,0],[4,8]])],front={a:[0,0] as CanalhousePoint,b:[4,0] as CanalhousePoint,normal:[0,-1] as CanalhousePoint};
 const selection={template:'symmetric-front-hip' as const,surfaceIds:['main'],eavesM:10,ridgeM:13,hipDepthM:2,fit:'native-envelope' as const};
 assert.throws(()=>canalhouseSymmetricRoof(input,['main'],front,{...selection,fit:'guessed' as never}),/Unsupported/);
 assert.throws(()=>canalhouseSymmetricRoof([roof([[0,0],[0,1],[0,2]])],['main'],front,selection),/Degenerate/);
 assert.throws(()=>canalhouseSymmetricRoof([roof([[0,0],[4,0],[NaN,2]])],['main'],front,selection),/Degenerate/);
 assert.throws(()=>canalhouseSymmetricRoof(input,['main'],{...front,normal:[0,-2]},selection),/orthonormal/);
 assert.throws(()=>canalhouseSymmetricRoof(input,['main'],{...front,normal:[1,0]},selection),/orthonormal/);
 assert.throws(()=>canalhouseSymmetricRoof(input,['main'],front,{...selection,sideRunM:5}),/side run/);
});
test('short side runs produce a bounded flat-cap roof without seams or changing coverage',()=>{
 const input=[roof([[0,0],[8,0],[8,12]]),roof([[0,0],[8,12],[0,12]])];
 const result=canalhouseSymmetricRoof(input,['main','main'],{a:[0,0],b:[8,0],normal:[0,-1]},{template:'symmetric-front-hip',surfaceIds:['main'],eavesM:12,ridgeM:14,hipDepthM:.75,sideRunM:.9});
 assert.ok(result.some(r=>r.plane.slopeX===0&&r.plane.slopeZ===0&&r.plane.heightM===14));
 assert.ok(Math.abs(result.reduce((s,r)=>s+area(r),0)-96)<1e-8);
 for(const r of result)for(const p of r.polygon.outer)assert.ok(Math.abs(h(r,p)-Math.min(12+2*p[0]/.9,12+2*(8-p[0])/.9,12+2*p[1]/.75,14))<1e-8);
 assert.throws(()=>canalhouseSymmetricRoof(input,['main','main'],{a:[0,0],b:[8,0],normal:[0,-1]},{template:'symmetric-front-hip',surfaceIds:['main'],eavesM:12,ridgeM:14,hipDepthM:.75,sideRunM:5}),/side run/);
});
test('gable option omits a front hip and follows the source-selected crown ridge',()=>{
 const input=[roof([[0,0],[6,0],[6,10]]),roof([[0,0],[6,10],[0,10]])];const result=canalhouseSymmetricRoof(input,['main','main'],{a:[0,0],b:[6,0],normal:[0,-1]},{template:'symmetric-gable',surfaceIds:['main'],eavesM:14,ridgeM:17});
 assert.ok(Math.abs(result.reduce((s,r)=>s+area(r),0)-60)<1e-8);
 for(const r of result)for(const p of r.polygon.outer)assert.ok(Math.abs(h(r,p)-Math.min(14+p[0],20-p[0]))<1e-8);
 assert.ok(result.some(r=>r.polygon.outer.some(p=>p[0]===3&&p[1]===0&&h(r,p)===17)));
});
test('continuous front slope retains full boundary height across adjacent owners and preserves an annex',()=>{
 const front={a:[0,0] as CanalhousePoint,b:[4,0] as CanalhousePoint,normal:[0,-1] as CanalhousePoint};
 const first=[roof([[0,0],[4,0],[4,6]]),roof([[0,0],[4,6],[0,6]])];
 const second=[roof([[4,0],[8,0],[8,6]]),roof([[4,0],[8,6],[4,6]])],annex=roof([[0,6],[4,6],[0,8]],3);
 const selection={template:'front-slope' as const,surfaceIds:['main'],eavesM:7,ridgeM:10,frontRunM:2};
 const before=JSON.stringify(first),left=canalhouseSymmetricRoof([...first,annex],['main','main','annex'],front,selection);
 const right=canalhouseSymmetricRoof(second,['main','main'],{...front,a:[4,0],b:[8,0]},selection);
 assert.equal(JSON.stringify(first),before);assert.equal(left.at(-1),annex);
 assert(Math.abs(left.slice(0,-1).reduce((sum,r)=>sum+area(r),0)-24)<1e-8);
 assert(Math.abs(right.reduce((sum,r)=>sum+area(r),0)-24)<1e-8);
 for(const r of [...left.slice(0,-1),...right])for(const p of r.polygon.outer)assert(Math.abs(h(r,p)-Math.min(7+1.5*p[1],10))<1e-8);
 const seam=[...left.slice(0,-1),...right].flatMap(r=>r.polygon.outer.filter(p=>p[0]===4&&p[1]>=2).map(p=>h(r,p)));
 assert(seam.length>0&&seam.every(v=>Math.abs(v-10)<1e-8));
 assert.throws(()=>canalhouseSymmetricRoof(first,['main','main'],front,{...selection,sideRunM:1}),/continuous front slope/);
 assert.throws(()=>canalhouseSymmetricRoof(first,['main','main'],front,{...selection,frontRunM:0}),/continuous front slope/);
});

test('independent roof assemblies preserve flat steps, annexes and native plan area',()=>{
 const a=roof([[0,0],[4,0],[4,5]]),b=roof([[0,0],[4,5],[0,5]]);
 const flat=roof([[0,5],[4,5],[4,6]],13);
 const rear=[roof([[0,6],[4,6],[4,10]]),roof([[0,6],[4,10],[0,10]])];
 const annex=roof([[0,11],[4,11],[4,13]],5);
 const input=[a,b,flat,...rear,annex],owners=['front','front','flat','rear','rear','annex'];
 const front={a:[0,0] as CanalhousePoint,b:[4,0] as CanalhousePoint,normal:[0,-1] as CanalhousePoint};
 const selections=[{template:'symmetric-gable' as const,surfaceIds:['front'],eavesM:10,ridgeM:12,fit:'native-envelope' as const},{template:'symmetric-gable' as const,surfaceIds:['rear'],eavesM:11,ridgeM:14,fit:'native-envelope' as const}];
 const before=JSON.stringify(input),result=canalhouseRoofAssemblies(input,owners,front,selections);
 assert.equal(JSON.stringify(input),before);assert.ok(result.includes(flat));assert.ok(result.includes(annex));
 assert.ok(Math.abs(result.reduce((s,r)=>s+area(r),0)-input.reduce((s,r)=>s+area(r),0))<1e-8);
 for(const [z,h] of [[2,12],[8,14]]){
  const roofs=result.filter(r=>r.polygon.outer.some(p=>p[1]>=z-2&&p[1]<=z+2)&&r!==flat&&r!==annex);
  assert.ok(roofs.some(r=>Math.abs(r.plane.heightM+r.plane.slopeX*2+r.plane.slopeZ*z-h)<1e-8));
 }
 assert.deepEqual(canalhouseRoofAssemblies(input,owners,front,[selections[0]]),canalhouseSymmetricRoof(input,owners,front,selections[0]));
 assert.throws(()=>canalhouseRoofAssemblies(input,owners,front,[selections[0],selections[0]]),/overlap/);
 assert.throws(()=>canalhouseRoofAssemblies(input,owners,front,[]),/Invalid/);
});
