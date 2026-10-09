import assert from 'node:assert/strict';
import test from 'node:test';
import { BAY_LAYER_COUNT, BAY_STYLES, bayLayer, bayLookFor, bayVariant, BAY_ENTRIES } from './bayLook.js';
import { canalGroundGeometry } from './bayTextures.js';
import { recipeBayOpenings } from './facadeOpenings.js';
import { frontageLayoutScale, PROCEDURAL_RECIPE_LAYER_OFFSET } from './streetFacadeRendering.js';
import { layoutRun } from './facadeLayout.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';
const recipe=(openingGroup:'canal-two'|'canal-three',groundAssembly:'tall-side-entry'|'tall-commercial'):ArchitecturalRecipe=>({family:'masonry',period:'canal',confidence:.8,openingGroup,groundAssembly,sash:'paired-transom',trimDensity:'restrained'});
test('two/three opening groups fit one native run, irrespective of nominal bayScale and polygon kinks',()=>{
  for(const width of [2.5,3.1,5.8,8.9])for(const group of ['canal-two','canal-three'] as const){
    const r={...recipe(group,'tall-side-entry'),bayScale:.6};
    const scale=frontageLayoutScale(r,{bay:.9,storey:1,ground:1},'canal',width);
    const layout=layoutRun('canal',[width*.3,width*.7],14,.3,true,scale,[true,true])!;
    assert.equal(layout.bays,1);assert.ok(Math.abs(layout.bayWidthM-width)<1e-9);
    const openings=recipeBayOpenings('native-front',r);
    assert.equal(openings.upper.axes.length,group==='canal-two'?2:3);
    assert.ok(openings.upper.width*width>.45);
    assert.equal(openings.doorWindow!.axes.length,openings.upper.axes.length-1);
    assert.ok(openings.ground!.head-openings.ground!.sill>.75);
    assert.ok(openings.door.axis>openings.doorWindow!.axes.at(-1)!);
    assert.ok(openings.door.axis-openings.door.width/2>openings.doorWindow!.axes.at(-1)!+openings.doorWindow!.width/2);
  }
});
test('tall ground geometry owns same texture and ornament coordinates; bounded styles retain coarse shells',()=>{
  for(const group of ['canal-two','canal-three'] as const)for(const ground of ['tall-side-entry','tall-commercial'] as const){
    const r=recipe(group,ground), bay=bayLookFor('front',1700,16,'photo','shopCafe',r);
    assert.equal(bay.variant.openingGroup,group);assert.equal(bay.variant.groundAssembly,ground);
    const openings=recipeBayOpenings('front',r),g=canalGroundGeometry(bay.variant);
    assert.deepEqual(openings.ground!.axes,ground==='tall-side-entry'?g.axes.slice(0,-1):g.axes);assert.equal(openings.door.axis,g.doorAxis);
    assert.equal(bay.layers.ground,bayLayer('canal',bay.style,'ground'));
    assert.ok(BAY_ENTRIES.some(e=>e.layer===bay.layers.upper&&bayVariant(e).openingGroup===group));
  }
});
test('plain cells share only equal material and remain within procedural byte layer capacity',()=>{
  assert.ok(PROCEDURAL_RECIPE_LAYER_OFFSET+BAY_LAYER_COUNT<=256);
  for(const archetype of ['canal','c19','school','modern'] as const){
    const styles=BAY_STYLES[archetype];
    for(let a=0;a<styles.length;a++)for(let b=0;b<styles.length;b++){
      const same=(styles[a].wallMaterial??(archetype==='modern'?'smooth':'brick'))===(styles[b].wallMaterial??(archetype==='modern'?'smooth':'brick'));
      assert.equal(bayLayer(archetype,a,'plain')===bayLayer(archetype,b,'plain'),same);
    }
  }
});
test('native mesh uses one frontage UV group while back and courtyard walls retain their own layers',async()=>{
  const {buildChunk}=await import('./threeBuildingMesh.js');
  const origin={lng:4.9,lat:52.37},kx=111320*Math.cos(origin.lat*Math.PI/180);
  const ll=(x:number,y:number):[number,number]=>[origin.lng+x/kx,origin.lat+y/110540];
  const r=recipe('canal-three','tall-commercial');
  const profile={id:'front',streetName:'canal',segment:[ll(-10,0),ll(20,0)] as [[number,number],[number,number]],side:1 as const,revision:'test',confidence:.8,assemblyM:18,reachM:20,status:'pilot' as const,evidence:[{id:'synthetic',kind:'user-reference' as const,sha256:'a'.repeat(64),inference:'agent-visual-review' as const,quality:.8,notes:'Synthetic geometry regression fixture'}],recipes:[{weight:1,recipe:r}]};
  const chosen=bayLookFor('native',1700,14,'photo','quiet',r);
  const b={id:'native',polygons:[[[ll(0,5),ll(4,5),ll(9,5),ll(9,15),ll(0,15),ll(0,5)],[ll(2,8),ll(2,12),ll(6,12),ll(6,8),ll(2,8)]]],heightM:14,minHeightM:0,style:'canal' as const,wallHex:'#55443b',layers:{upper:1,ground:2,door:3},plainLayer:4,streetAppearance:{look:'photo' as const,year:1700,profiles:[profile]}};
  const chunk=buildChunk([b],origin,'walls',new Float32Array([-10,0,20,0]));
  const groupUVs=[];
  for(let i=0;i<chunk.vertexCount;i++)if(chunk.layers[i]===chosen.layers.upper){
    assert.ok(Math.abs(chunk.positions[i*3+1]-5)<.01,'only street facade gets new group');
    groupUVs.push(chunk.uvs[i*2]);
  }
  assert.ok(groupUVs.length>=8,'both source polygon frontage facets carry cells');
  assert.ok(Math.abs(Math.max(...groupUVs)-Math.min(...groupUVs)-1)<1e-6,'complete run has one cell, never six repeated windows');
  assert.ok([...chunk.layers].includes(1),'back/courtyard facade keeps original upper layer');
});
test('mapped shop paint cannot replace either dark or pale recipe casing',async()=>{
  for(const frameHex of ['#f1ede2','#343b38']){
    const r={...recipe('canal-three','tall-commercial'),frameHex};
    const bay=bayLookFor('mapped-cafe',1700,14,'photo','shopCafe',r);
    assert.equal(bay.accentHex,frameHex);
    assert.equal(bay.variant.paintedFrames,false,'inner muntins stay untinted dark ink');
    assert.equal(bay.variant.openingGroup,'canal-three');
  }
});
test('raised side-entry assembly joins native base, aligned threshold and open rails atomically',async()=>{
  const {canalSideEntrance}=await import('./facadeOrnaments.js');
  const {ExtraSink}=await import('./facadeExtras.js');
  const r=recipe('canal-three','tall-side-entry'),openings=recipeBayOpenings('side-entry',r);
  const context={id:'side-entry',style:'canal' as const,wallKey:'front',f:{x0:0,y0:0,ux:1,uy:0,nx:0,ny:-1,len:9},base:0,top:14,layout:{bays:1,bayWidthM:9,groundM:4,storeys:3,storeyM:10/3,doorBays:[0]},wallHex:'#44332c',accentHex:'#eee8df',groundLevel:true,streetSide:true,shopfront:false,recipe:r,openings};
  const sink=new ExtraSink(100);canalSideEntrance(context,sink);
  assert.ok(sink.tris.length>0&&sink.tris.length<=80);
  const threshold=openings.door.bottom*context.layout.groundM;
  const stepTops=sink.tris.filter(t=>t.p.every(p=>Math.abs(p[2]-threshold)<1e-8)&&t.p.some(p=>p[1]<-.1));
  assert.ok(stepTops.length,'top stair meets painted door threshold');
  const rail=sink.tris.filter(t=>t.p.some(p=>p[2]>threshold+.6));
  assert.ok(rail.length,'raised entry has open rail geometry');
  const rightEntryX=openings.door.axis*9;
  assert.ok(rail.every(t=>t.p.every(p=>Math.abs(p[0]-rightEntryX)<openings.door.width*9/2+.11)),'rails flank right side entry');
  const short=new ExtraSink(sink.tris.length-1);canalSideEntrance(context,short);assert.equal(short.tris.length,0,'budget never leaves disconnected stair or rail');
  for(const variant of [{...context,shopfront:true},{...context,streetSide:false},{...context,recipe:recipe('canal-three','tall-commercial')}]){
    const held=new ExtraSink(100);canalSideEntrance(variant,held);assert.equal(held.tris.length,0);
  }
});
test('raised side leaf is painted into the complete ground cell with untinted panels and a continuous casing',async()=>{
  const {bayTextures,bayDoorGeometry}=await import('./bayTextures.js');
  const previous=globalThis.document;
  const passes:Array<Array<{args:number[];color:unknown}>>=[];
  globalThis.document={createElement:()=>{
    const calls:Array<{args:number[];color:unknown}>=[];passes.push(calls);
    const target:any={fillStyle:'',createLinearGradient:()=>({addColorStop(){}})};
    const ctx=new Proxy(target,{get:(obj,key)=>key in obj?obj[key]:(...args:number[])=>{if(key==='fillRect')calls.push({args,color:obj.fillStyle});},set:(obj,key,value)=>{obj[key]=value;return true;}});
    return {getContext:()=>ctx};
  }} as unknown as Document;
  try{
    for(const group of ['canal-two','canal-three'] as const){
      const chosen=bayLookFor('painted-entry',1700,14,'photo','quiet',recipe(group,'tall-side-entry'));
      const v={...chosen.variant,kind:'ground' as const},d=bayDoorGeometry(v),y=340-d.bottom-d.height;
      const before=passes.length;bayTextures(v,{} as CanvasImageSource,'photo');
      const [color,mask]=passes.slice(before);
      assert.ok(color.some(c=>c.color==='#30342f'&&Math.abs(c.args[0]-d.x-5)<1e-8&&c.args[3]>d.height*.48),'solid lower leaf occupies half the tall entry');
      assert.ok(color.some(c=>c.color==='#1d2421'&&Math.abs(c.args[0]-d.x-13)<1e-8),'recessed lower door panel distinguishes entry from windows');
      assert.ok(mask.some(c=>c.color==='#00ff00'&&Math.abs(c.args[0]-d.x+11)<1e-8&&Math.abs(c.args[1]-y+11)<1e-8&&Math.abs(c.args[3]-d.height-22)<1e-8),'continuous outer casing uses recipe accent channel');
      assert.ok(mask.some(c=>c.color==='#000000'&&Math.abs(c.args[0]-d.x-5)<1e-8&&c.args[3]>d.height*.48),'solid entry leaf is immune to mapped shop/frame recoloring');
    }
  }finally{globalThis.document=previous;}
});

test('segmental heads are explicit alternatives: flat default and ground hierarchy survive atlas sharing',()=>{
 for(const group of ['canal-two','canal-three'] as const)for(const ground of ['tall-side-entry','tall-commercial'] as const)for(const look of ['photo','storybook','cartoon'] as const){
  const r=recipe(group,ground),flat=bayLookFor('head',1700,16,look,undefined,r);
  const curved=bayLookFor('head',1700,16,look,undefined,{...r,windowHead:'segmental'});
  assert.equal(flat.variant.shape,'rect'); assert.equal(curved.variant.shape,'segmental');
  assert.deepEqual(recipeBayOpenings('head',r),recipeBayOpenings('head',{...r,windowHead:'segmental'}),'head shape must not move doors or whole-front columns');
  for(const kind of ['upper','ground','groundDoor'] as const){
   const a=bayLayer('canal',flat.style,kind),b=bayLayer('canal',curved.style,kind);
   assert.notEqual(a,b); assert.equal(bayVariant(BAY_ENTRIES[b]).shape,'segmental');
   assert.ok(b+PROCEDURAL_RECIPE_LAYER_OFFSET<256);
  }
 }
});
