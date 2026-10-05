import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExtraSink, wallExtras, extraUsage, type ExtraContext } from './facadeExtras.js';
import { continuousShopCanopy, mergeCanopyFrames } from './shopCanopies.js';
import { buildChunk, type MeshBuilding } from './threeBuildingMesh.js';
import { validateStreetAppearanceCatalog, type ArchitecturalRecipe, type StreetAppearanceProfile } from './streetAppearance.js';

const recipe:ArchitecturalRecipe={family:'masonry',period:'school',confidence:.8,detailPolicy:'architectural',trim:{frames:0,lintels:0,cornice:0,courses:0,quoins:0,arches:0},
  shopCanopy:{kind:'continuous-rigid',projectionM:.85,fasciaHeightM:.24,fasciaHex:'#dedbd2',edgeHex:'#454b49'}};
const context=():ExtraContext=>({id:'observed-shop',style:'school',period:'school',wallKey:'front',
  f:{x0:0,y0:0,ux:1,uy:0,nx:0,ny:-1,len:12},base:0,top:14,layout:{bays:4,bayWidthM:3,groundM:3.4,storeys:3,storeyM:3.5,doorBays:[]},
  wallHex:'#876953',accentHex:'#dfdacf',groundLevel:true,streetSide:true,shopfront:true,recipe});

test('source rigid canopy is continuous, rounded, pale below dark, with outward unit normals',()=>{
  const c=context(),sink=new ExtraSink(180);
  assert.equal(wallExtras(c,sink)[0],'continuous-shop-canopy');
  const canopies=sink.tris.filter(t=>[recipe.shopCanopy!.edgeHex,recipe.shopCanopy!.fasciaHex].includes(t.hex));
  assert.equal(canopies.length,36,'24 dark profile and12 pale fascia triangles, independent of bay count');
  const dark=canopies.filter(t=>t.hex===recipe.shopCanopy!.edgeHex), pale=canopies.filter(t=>t.hex===recipe.shopCanopy!.fasciaHex);
  assert.ok(dark.some(t=>t.n[2]>0&&t.n[2]<1),'rounded nose includes angled outward faces');
  assert.ok(Math.max(...pale.flatMap(t=>t.p.map(p=>p[2])))<=Math.min(...dark.flatMap(t=>t.p.map(p=>p[2])))+1e-8);
  for(const t of canopies){
    assert.ok(Math.abs(Math.hypot(...t.n)-1)<1e-8);
    const [a,b,c]=t.p,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    assert.ok(cross.reduce((sum,v,i)=>sum+v*t.n[i],0)>1e-8,'every triangle has nonzero area and outward winding');
    for(const p of t.p)assert.ok(p.every(Number.isFinite)&&p[0]>=0&&p[0]<=12&&-p[1]>=.025&&-p[1]<=.85);
  }
});

test('no city default, rear, upper part, or duplicate owner; budget failure is whole-assembly atomic',()=>{
  for(const patch of [{recipe:undefined},{streetSide:false},{streetSide:undefined},{groundLevel:false},{canopyOwner:false}]){
    const sink=new ExtraSink(180);continuousShopCanopy({...context(),...patch},sink);assert.equal(sink.tris.length,0);
  }
  for(const budget of [0,12,35]){const sink=new ExtraSink(budget);continuousShopCanopy(context(),sink);assert.equal(sink.tris.length,0);assert.equal(sink.boxes,0);}
  const sink=new ExtraSink(36);continuousShopCanopy(context(),sink);assert.equal(sink.tris.length,36);
});

test('collinear tessellation costs nothing and bends retain surveyed wall normals',()=>{
  const c=context(),single=new ExtraSink(180),split=new ExtraSink(180);
  continuousShopCanopy(c,single);
  const frames=[{...c.f,len:3},{...c.f,x0:3,len:9}];
  assert.equal(mergeCanopyFrames(frames).length,1);
  continuousShopCanopy({...c,canopyFrames:frames},split);assert.deepEqual(split.tris,single.tris);
  const angle=.1,bend={...c.f,x0:3,len:9,ux:Math.cos(angle),uy:Math.sin(angle),nx:Math.sin(angle),ny:-Math.cos(angle)};
  const bent=new ExtraSink(180);continuousShopCanopy({...c,canopyFrames:[frames[0],bend]},bent);
  assert.equal(bent.tris.length,58);assert.ok(bent.tris.some(t=>Math.abs(t.n[0]-bend.nx)<1e-8&&Math.abs(t.n[1]-bend.ny)<1e-8));
  const small=new ExtraSink(57);continuousShopCanopy({...c,canopyFrames:[frames[0],bend]},small);assert.equal(small.tris.length,0,'all facets fit together or none survive');
});

test('positive and negative25 degree bends close every slab and fascia edge with a miter',()=>{
  for(const angle of [-25,25].map(a=>a*Math.PI/180)){
    const c=context(),first={...c.f,len:6},next={...c.f,x0:6,len:6,ux:Math.cos(angle),uy:Math.sin(angle),nx:Math.sin(angle),ny:-Math.cos(angle)};
    const sink=new ExtraSink(180);continuousShopCanopy({...c,canopyFrames:[first,next]},sink);
    for(const color of [recipe.shopCanopy!.edgeHex,recipe.shopCanopy!.fasciaHex]){
      const edges=new Map<string,number>(),key=(p:number[])=>p.map(n=>Math.round(n*1e6)).join(',');
      for(const tri of sink.tris.filter(t=>t.hex===color))for(let i=0;i<3;i++){
        const edge=[key(tri.p[i]),key(tri.p[(i+1)%3])].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
      }
      assert.ok([...edges.values()].every(n=>n===2),'every boundary triangle edge has its matching neighbor; no projected bend gap or internal cap');
    }
  }
});

test('six connected small surveyed bends retain a complete canopy within the existing180 wall allowance',()=>{
  const c=context(),frames=[];let x=0,y=0;
  for(let i=0;i<6;i++){
    const angle=i*.01,ux=Math.cos(angle),uy=Math.sin(angle);
    frames.push({...c.f,x0:x,y0:y,len:2,ux,uy,nx:uy,ny:-ux});x+=ux*2;y+=uy*2;
  }
  const sink=new ExtraSink(1000),used=wallExtras({...c,canopyFrames:frames},sink);
  assert.equal(used[0],'continuous-shop-canopy');
  const canopy=sink.tris.filter(t=>[recipe.shopCanopy!.edgeHex,recipe.shopCanopy!.fasciaHex].includes(t.hex));
  assert.equal(canopy.length,146,'six22-triangle facet shells plus14 outer-end triangles');
  assert.ok(sink.tris.length<=180,'the whole wall retains its original180 allowance');
  assert.ok(canopy.flatMap(t=>t.p).some(p=>p[0]>11.9),'the final facet survives atomically');
});

test('mesh run owns one continuous canopy; split tiny facets and courtyard holes never add owners',()=>{
  const origin={lng:4.85,lat:52.37},kx=111320*Math.cos(origin.lat*Math.PI/180);
  const point=(x:number,y:number):[number,number]=>[origin.lng+x/kx,origin.lat+y/110540];
  const profile:StreetAppearanceProfile={id:'source-shop',streetName:'bounded-source',revision:'test',segment:[point(-20,-2),point(30,-2)],side:1,reachM:15,confidence:.8,assemblyM:6,status:'pilot',
    recipes:[{weight:1,recipe,yearMin:1920,yearMax:1940}],evidence:[{id:'user',kind:'user-reference',sha256:'a'.repeat(64),inference:'agent-visual-review',quality:.8,notes:'test'}]};
  const replay=(split:boolean,tiny=false)=>{
    const front=tiny?Array.from({length:13},(_,i)=>point(i,0)):split?[point(0,0),point(1,0),point(4,0),point(11,0),point(12,0)]:[point(0,0),point(12,0)];
    const b:MeshBuilding={id:'observed-shop',polygons:[[ [...front,point(12,10),point(0,10),point(0,0)], [point(3,3),point(3,7),point(9,7),point(9,3),point(3,3)] ]],heightM:14,minHeightM:0,style:'school',wallHex:'#876953',extras:true,lid:{hex:'#876953',flatLayer:0},recipe};
    if(tiny){b.recipe=undefined;b.streetAppearance={profiles:[profile],look:'photo',year:1930};}
    const records:Array<{c:ExtraContext;used:readonly string[]}>=[],previous=extraUsage.record;
    try{extraUsage.record=(c,used)=>records.push({c,used});buildChunk([b],origin,'extras',Float32Array.from([-20,-2,30,-2]));}
    finally{extraUsage.record=previous;}
    return records.filter(r=>r.used.includes('continuous-shop-canopy'));
  };
  const single=replay(false),split=replay(true);
  assert.equal(single.length,1);assert.equal(split.length,1);
  assert.ok(split[0].c.f.len<2.5,'the tiny first facet owns the entire supported run');
  assert.ok(Math.abs(split[0].c.canopyFrames!.reduce((sum,f)=>sum+f.len,0)-12)<1e-6);
  assert.equal(mergeCanopyFrames(split[0].c.canopyFrames!).length,1);
  assert.ok(split[0].c.streetSide);
  const allTiny=replay(true,true);assert.equal(allTiny.length,1,'full-run source admission survives an entirely tiny-facet street front');
  assert.ok(Math.abs(allTiny[0].c.canopyFrames!.reduce((sum,f)=>sum+f.len,0)-12)<1e-6);
  const catalog={schemaVersion:1,revision:'test',profiles:[profile]};
  assert.equal(validateStreetAppearanceCatalog(catalog),catalog);
  for(const patch of [{projectionM:NaN},{projectionM:3},{fasciaHeightM:0},{edgeHex:'red'},{kind:'striped'}]){
    const invalid=structuredClone(catalog);Object.assign(invalid.profiles[0].recipes[0].recipe.shopCanopy!,patch);
    assert.throws(()=>validateStreetAppearanceCatalog(invalid),/invalid source shop canopy/);
  }
});
