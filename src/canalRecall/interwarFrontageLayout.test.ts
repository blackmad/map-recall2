import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interwarStreetPhase, planInterwarFrontage, validateInterwarFrontageRecipe, type InterwarFrontageRecipe } from './interwarFrontageLayout.ts';

const recipe = (): InterwarFrontageRecipe => ({ residentialRows:3,groupPitchM:3.1,groupWidthM:2.3,
  windowHeightM:1.7,firstSillM:1.15,rowPitchM:2.8,projectionSequence:['flat','right','left'],
  projectionM:.35,frameWidthM:.065,centralMullionM:.18,transomFraction:.72 });
const input = () => ({lengthM:9.3,baseM:0,topM:13,groundM:3.6,recipe:recipe()});

test('catalogue validation rejects missing fields, unbounded values and malformed material colors',()=>{
  assert(validateInterwarFrontageRecipe(recipe()));
  for (const bad of [null,[],{}, {...recipe(),frameHex:'white'}, {...recipe(),capHex:3},
    {...recipe(),projectionSequence:['flat',null]}, {...recipe(),rowPitchM:'2.8'}])
    assert.equal(validateInterwarFrontageRecipe(bad),false);
});

test('source-selected broad pairs repeat through exactly three residential rows with quiet roof clearance',()=>{
  const p=planInterwarFrontage(input())!;
  assert.equal(p.groups,3);assert.equal(p.windows.length,18);
  assert.deepEqual([...new Set(p.windows.map(w=>w.rowIndex))],[0,1,2]);
  assert(p.windows.every(w=>w.bottom>3.6&&w.bottom+w.height<12));
  for(let row=0;row<3;row++){
    const w=p.windows.filter(w=>w.rowIndex===row);
    assert(w[0].out<.05&&w[1].out<.05);
    assert(w[2].out<.05&&w[3].out>.35);
    assert(w[4].out>.35&&w[5].out<.05);
    assert(w.every(v=>v.width>.9));
  }
});

test('all quad windings follow explicit normals and opening UV remains normalized',()=>{
  const p=planInterwarFrontage({...input(),baseM:7,topM:20})!;
  for(const q of p.quads){
    const [a,b,c]=q.points,u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert(cross.reduce((sum,n,i)=>sum+n*q.normal[i],0)>0);
    assert.deepEqual(q.uv.map(p=>p.join(',')).sort(),['0,0','0,1','1,0','1,1']);
    assert(q.points.every(([a,o,z])=>a>=0&&a<=9.3&&o>0&&z>7+3.6));
  }
});

test('projecting leaves retain full opening planes, proud frame faces and closed pale returns',()=>{
  const p=planInterwarFrontage(input())!;
  const w=p.windows.find(w=>w.groupIndex===1&&w.rowIndex===0&&w.leafIndex===1)!;
  const q=p.quads.filter(q=>q.groupIndex===1&&q.rowIndex===0&&q.leafIndex===1);
  const glass=q.find(q=>q.role==='glass')!;
  assert(glass.points.every(v=>v[1]===w.out));
  // A ray through the centre of the lower glass field meets this plane before
  // the underlying wall; frame strips only occupy their stated border/bar fields.
  const x=w.left+w.width/2,z=w.bottom+w.height*.35;
  const fronts=q.filter(q=>q.normal[1]===1&&q.points.some(p=>p[0]<x)&&q.points.some(p=>p[0]>x)
    &&q.points.some(p=>p[2]<z)&&q.points.some(p=>p[2]>z)).sort((a,b)=>b.points[0][1]-a.points[0][1]);
  assert.equal(fronts[0].role,'glass');assert(fronts[0].points[0][1]>0);
  assert(q.some(q=>q.role==='frame'&&q.normal[0]===-1));
  assert(q.some(q=>q.role==='frame'&&q.normal[0]===1));
  assert(q.some(q=>q.role==='frame'&&q.normal[2]===-1));
  assert(q.some(q=>q.role==='cap'&&q.normal[2]===1));
});

test('reject incompatible geometry atomically rather than squeeze, truncate or invent rows',()=>{
  for(const change of [{topM:11},{lengthM:1.8},{lengthM:1000},{groundM:NaN}])
    assert.equal(planInterwarFrontage({...input(),...change}),undefined);
  for(const change of [{residentialRows:7},{residentialRows:0},{groupWidthM:3},{projectionM:.9},
    {firstSillM:0},{frameWidthM:.6},{transomFraction:NaN},{projectionSequence:[]},
    {projectionSequence:['balcony'] as never}])
    assert.equal(planInterwarFrontage({...input(),recipe:{...recipe(),...change}}),undefined);
});

test('plans are independent, bounded and preserve the input recipe',()=>{
  const i=input(),before=structuredClone(i),p=planInterwarFrontage(i)!;
  assert(p.quads.length<=3*3*23); // two leaves, mullion, at most one projected leaf
  p.windows[0].width=99;p.quads[0].points[0][0]=99;
  assert.deepEqual(i,before);assert(planInterwarFrontage(i)!.windows[0].width<2);
  const flat=planInterwarFrontage({...i,recipe:{...recipe(),projectionSequence:['flat']}})!;
  assert(flat.quads.every(q=>q.normal[1]===1));
  assert.equal(flat.quads.length,3*3*13);
});

test('native-width group phase and projected physical leaves survive reversed surveyed edges',()=>{
 for(const width of [5.945129,6.010429])for(const start of [0,11.9,18.02]){
  const forward=planInterwarFrontage({lengthM:width,baseM:0,topM:16.5,groundM:3.4,recipe:{...recipe(),projectionSequence:['left','flat','right']},...interwarStreetPhase(start,start+width,width,recipe().groupPitchM)})!;
  const reversed=planInterwarFrontage({lengthM:width,baseM:0,topM:16.5,groundM:3.4,recipe:{...recipe(),projectionSequence:['left','flat','right']},...interwarStreetPhase(start+width,start,width,recipe().groupPitchM)})!;
  const canonical=(windows:typeof forward.windows,flip:boolean)=>windows.map(w=>[Number((flip?width-w.left-w.width:w.left).toFixed(6)),w.bottom,w.width,w.out]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  assert.deepEqual(canonical(forward.windows,false),canonical(reversed.windows,true));
 }
});
