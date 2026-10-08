import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planInterwarGroundFrontage,validateInterwarGroundFrontageRecipe,type InterwarGroundFrontageRecipe,type InterwarGroundRect} from './interwarGroundFrontage.ts';
const recipe=():InterwarGroundFrontageRecipe=>({entranceSide:'left',entranceWidthM:1.05,recessDepthM:.65,edgePierM:.18,separatorPierM:.22,shopSillM:.12,openingHeadM:2.9,shopPanes:3,frameWidthM:.07,shopTransomFraction:.8,frameHex:'#e5e5d8'});
const input=()=>({lengthM:5.945129,baseM:0,groundM:3.4,recipe:recipe()});
const inside=(r:InterwarGroundRect,x:number,z:number)=>x>r.left+1e-8&&x<r.left+r.width-1e-8&&z>r.bottom+1e-8&&z<r.bottom+r.height-1e-8;
const area=(r:InterwarGroundRect)=>r.width*r.height;

test('bounded admission rejects partial recipe, shallow fake recess and incompatible whole assembly',()=>{
 assert(validateInterwarGroundFrontageRecipe(recipe()));
 for(const r of [null,[],{}, {...recipe(),recessDepthM:0},{...recipe(),entranceSide:'random'},{...recipe(),shopPanes:2.5},{...recipe(),frameHex:'white'},{...recipe(),openingHeadM:'2.9'}])assert(!validateInterwarGroundFrontageRecipe(r));
 for(const i of [{...input(),lengthM:3},{...input(),lengthM:Infinity},{...input(),groundM:2.9},{...input(),recipe:{...recipe(),shopPanes:5},lengthM:3.5}])assert.equal(planInterwarGroundFrontage(i),undefined);
});

test('native pilot cut complements preserve every solid ground pixel without an entrance-wall overlay',()=>{
 for(const L of [5.945129,6.010429])for(const base of [0,7]){
  const p=planInterwarGroundFrontage({...input(),lengthM:L,baseM:base})!;
  assert(Math.abs(p.wallSegments.reduce((s,r)=>s+area(r),0)+p.cutRects.reduce((s,r)=>s+area(r),0)-L*3.4)<1e-8);
  for(const c of p.cutRects)for(const wall of p.wallSegments){
   const overlapX=Math.min(c.left+c.width,wall.left+wall.width)-Math.max(c.left,wall.left);
   const overlapZ=Math.min(c.bottom+c.height,wall.bottom+wall.height)-Math.max(c.bottom,wall.bottom);
   assert(overlapX<=1e-8||overlapZ<=1e-8,'wall segment must never cover a cut');
  }
  assert(p.wallSegments.every(w=>w.width>0&&w.height>0&&w.left>=0&&w.left+w.width<=L&&w.bottom>=base&&w.bottom+w.height<=base+3.4));
  assert(p.shop.width>3.5&&p.entrance.width===1.05);
 }
});

test('first hit through residential portico reaches textured door behind wall plane, with closed side/head/floor reveals',()=>{
 const p=planInterwarGroundFrontage(input())!,x=p.entrance.left+p.entrance.width/2,z=1.4;
 assert(p.wallSegments.every(w=>!inside(w,x,z)));
 const hits=p.quads.filter(q=>q.normal[1]>0&&q.points.every(v=>Math.abs(v[1]-q.points[0][1])<1e-8)).filter(q=>{
  const xs=q.points.map(v=>v[0]),zs=q.points.map(v=>v[2]);return x>Math.min(...xs)&&x<Math.max(...xs)&&z>Math.min(...zs)&&z<Math.max(...zs);
 }).sort((a,b)=>b.points[0][1]-a.points[0][1]);
 assert(hits.length>0);assert.equal(hits[0].role,'door');assert(hits[0].points[0][1]<-.6);
 assert.equal(p.quads.filter(q=>q.part==='portico-reveal').length,2);
 assert.equal(p.quads.filter(q=>q.part==='portico-soffit').length,1);
 assert.equal(p.quads.filter(q=>q.part==='portico-floor').length,1);
 for(const q of p.quads.filter(q=>q.part.startsWith('portico-')))assert.deepEqual([...new Set(q.points.map(v=>v[1]))].sort((a,b)=>a-b),[-.65,0]);
 assert(!p.quads.some(q=>q.role==='door'&&q.points.some(v=>v[1]>=0)),'no dark facade-plane door masquerading as recess');
});

test('broad shop panes have shared datum, separate access pier and unobstructed textured first hits',()=>{
 const p=planInterwarGroundFrontage(input())!,glass=p.quads.filter(q=>q.role==='shopGlass');
 assert.equal(glass.length,3);assert(glass.every(q=>q.points[0][1]>.02));
 assert(glass.every(q=>Math.max(...q.points.map(v=>v[0]))-Math.min(...q.points.map(v=>v[0]))>1));
 assert.equal(Math.min(...glass.flatMap(q=>q.points.map(v=>v[2]))),.19);
 assert(p.shop.left-p.entrance.left-p.entrance.width>=.22-1e-8);
 for(const q of glass){const x=q.points.reduce((s,v)=>s+v[0],0)/4,z=.4;assert(p.wallSegments.every(w=>!inside(w,x,z)));}
 assert(p.quads.filter(q=>q.part==='shop-frame').every(q=>q.points.every(v=>v[2]>=.12&&v[2]<=2.9)));
});

test('explicit left/right source selection mirrors openings and all geometry remains bounded with correct inward/outward normals',()=>{
 const a=planInterwarGroundFrontage(input())!,b=planInterwarGroundFrontage({...input(),recipe:{...recipe(),entranceSide:'right'}})!;
 assert(Math.abs(b.entrance.left-(input().lengthM-a.entrance.left-a.entrance.width))<1e-8);
 assert(Math.abs(b.shop.left-(input().lengthM-a.shop.left-a.shop.width))<1e-8);
 for(const p of [a,b])for(const q of p.quads){
  assert(q.points.every(([x,y,z])=>x>=0&&x<=input().lengthM&&y>=-.65&&y<=.05&&z>=0&&z<=2.9));
  const [a,b,c]=q.points,u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  assert(cross.reduce((s,n,i)=>s+n*q.normal[i],0)>0);
  assert(q.uv.every(([u,v])=>u>=0&&u<=1&&v>=0&&v<=1));
 }
});

test('plans have bounded complete geometry, do not mutate recipe and do not share writable outputs',()=>{
 const i=input(),before=structuredClone(i),a=planInterwarGroundFrontage(i)!,b=planInterwarGroundFrontage(i)!;
 assert.deepEqual(i,before);assert(a.quads.length<=30);assert.notEqual(a.cutRects,b.cutRects);a.cutRects[0].left=999;assert.notEqual(b.cutRects[0].left,999);
});

test('explicit customer door lowers only its selected leaf and removes the entire threshold plinth union',()=>{
 for(const side of ['left','right'] as const)for(const paneIndex of [0,1,2]){
  const i={...input(),recipe:{...recipe(),entranceSide:side,shopDoorPane:paneIndex}},p=planInterwarGroundFrontage(i)!;
  assert(p.shopDoor);assert.equal(p.cutRects.length,3);assert.equal(p.quads.filter(q=>q.role==='shopGlass').length,2);
  const customer=p.quads.find(q=>q.role==='shopDoor')!;assert(customer);assert.equal(customer.part,'shop-door');
  assert.equal(Math.min(...customer.points.map(v=>v[2])),.07);
  const x=p.shopDoor.opening.left+p.shopDoor.opening.width/2,z=.09;
  assert(p.cutRects.some(c=>inside(c,x,z)));assert(p.wallSegments.every(w=>!inside(w,x,z)),'customer threshold must not retain stock plinth');
  assert(customer.points[0][1]>.02&&customer.points.some(v=>v[2]<recipe().shopSillM),'textured glass door owns first visible plane below shop sill');
  const remainingArea=p.wallSegments.reduce((s,r)=>s+area(r),0),holesArea=p.cutRects.reduce((s,r)=>s+area(r),0);
  assert(Math.abs(remainingArea+holesArea-i.lengthM*i.groundM)<1e-8,'threshold and shop cuts must form an exact union complement');
  const other=p.quads.filter(q=>q.role==='shopGlass');assert(other.every(q=>Math.min(...q.points.map(v=>v[2]))===.19),'unselected panes retain shop sill');
 }
 for(const shopDoorPane of [-1,3,.5,NaN,'0'])assert(!validateInterwarGroundFrontageRecipe({...recipe(),shopDoorPane}));
 const noDoor=planInterwarGroundFrontage(input())!;assert.equal(noDoor.shopDoor,undefined);assert(!noDoor.quads.some(q=>q.role==='shopDoor'));
});
