import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {compileCanalHouseRecipe,type CanalHouseRecipe} from './canalhouseRecipes.ts';
import {canalhouseOpeningTemplate} from './canalhouseOpeningTemplates.ts';
import {unobservedHouse} from './facade/houseRecord.ts';
import {measured,type Observation} from './facade/evidence.ts';

const observation:Observation={id:'recess-fixture',pandId:'0363100012345678',kind:'human-review',elevation:'front',capturedAt:'2025-01-01',sourceUrl:null,license:null};
const m=<V>(v:V)=>measured(v,'reviewed',1,observation);
function fixture():CanalHouseRecipe{
 const house=unobservedHouse(observation.pandId);house.eavesHeightM=m(8);house.gable=m('punt');
 const polygon={outer:[[0,0],[6,0],[6,10],[0,10]] as [number,number][],holes:[[[2,4],[4,4],[4,7],[2,7]]] as [number,number][][]};
 return {schemaVersion:1,id:'recess-fixture',house,observations:[observation],footprint:m([polygon]),palette:m({wall:'#763f2b',roof:'#413c3a',trim:'#eee9dc',glass:'#233a43',door:'#23322a'}),roof:m([{polygon,plane:{heightM:8,slopeX:0,slopeZ:0}}]),elevations:[{id:'front',polygonIndex:0,edgeIndex:0,openings:m([{id:'entry',kind:'door',leftM:1,bottomM:0,widthM:1.4,heightM:2.6,trimWidthM:.08}])}],simplifications:['Synthetic test geometry only']};
}
const cast=(group:T.Group,x:number,y:number)=>new T.Raycaster(new T.Vector3(x,y,-3),new T.Vector3(0,0,1)).intersectObject(group,true);
const geometryHash=(group:T.Group)=>{const snapshot:object[]=[];group.traverse(o=>{if(o instanceof T.Mesh)snapshot.push({name:o.name,surface:o.userData.surface,index:o.geometry.index?.array,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,(a as T.BufferAttribute).array])),matrix:o.matrix.toArray()});});return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');};

test('omitted recess retains pre-change geometry bytes',()=>{
 const r=fixture(),group=compileCanalHouseRecipe(r).group;
 assert.equal(geometryHash(group),'21d4708d0cea0a73e3f29fd2958b07dab4b857a014ee45cf0ce87a48d5f9b56f');
 r.elevations[0].openings.value[0].recessM=undefined;
 assert.equal(geometryHash(compileCanalHouseRecipe(r).group),geometryHash(group));
});
test('door, joinery and returns are first-hit visible while surrounding shell, roof and court survive',()=>{
 const r=fixture(),o=r.elevations[0].openings.value[0];o.recessM=.4;
 o.panels=[{rect:[.15,.15,.7,.5],frameWidthM:.025,reliefM:.018,fieldReliefM:.004,frameSurface:'door'}];
 const original=structuredClone({footprint:r.footprint.value,roof:r.roof.value});
 const {group}=compileCanalHouseRecipe(r);
 const leaf=cast(group,1.2,2.1)[0];assert.equal(leaf.object.name,'opening/entry/pane');assert(Math.abs(leaf.point.z-.32)<1e-6);
 assert(cast(group,1.7,1)[0].object.name.startsWith('opening/entry/panel/'));
 assert.equal(cast(group,1.06,1)[0].object.name,'opening/entry/frame');
 assert.equal(cast(group,1.02,1)[0].object.name,'opening/entry/recess/left-jamb');
 assert.equal(cast(group,2.38,1)[0].object.name,'opening/entry/recess/right-jamb');
 assert.equal(cast(group,1.7,2.58)[0].object.name,'opening/entry/recess/soffit');
 const oblique=new T.Raycaster(new T.Vector3(.9,2.1,-1),new T.Vector3(1.7,2.1,.335).sub(new T.Vector3(.9,2.1,-1)).normalize()).intersectObject(group,true)[0];
 assert.equal(oblique.object.name,'opening/entry/pane');
 for(const x of [.5,2.8,5.5])assert.equal(cast(group,x,1)[0].object.name,'shell/0');
 const down=(x:number,z:number)=>new T.Raycaster(new T.Vector3(x,20,z),new T.Vector3(0,-1,0)).intersectObject(group,true);
 assert.equal(down(1,1)[0].object.name,'roof/0');assert.equal(down(3,5).length,0);
 assert.deepEqual({footprint:r.footprint.value,roof:r.roof.value},original);
});
test('window variants and apertures across shell/crown closures remain unburied',()=>{
 for(const surface of ['wall','trim','stone'] as const){
 const r=fixture();r.shellTopM=m(2);r.elevations[0].crown=m({profile:[[0,8],[3,10],[6,8]],depthM:.25,trimWidthM:.06});
 r.elevations[0].crown!.value.surface=surface;
 r.elevations[0].openings.value=[{id:'closure-window',kind:'window',leftM:1,bottomM:3,widthM:1.2,heightM:1.5,trimWidthM:.08,recessM:.5},{id:'crown-window',kind:'window',leftM:2.6,bottomM:8.3,widthM:.8,heightM:.6,trimWidthM:.06,recessM:.5}];
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(cast(group,1.3,3.4)[0].object.name,'opening/closure-window/pane');
 assert.equal(cast(group,2.8,8.5)[0].object.name,'opening/crown-window/pane');
 assert.equal(cast(group,2.4,8.5)[0].object.name,'crown/punt');
 }
});
test('left/right limits preserve ends and unsupported cavity geometry is rejected',()=>{
 for(const leftM of [0,4.6]){const r=fixture();Object.assign(r.elevations[0].openings.value[0],{leftM,recessM:.35});assert.equal(cast(compileCanalHouseRecipe(r).group,leftM+.3,1)[0].object.name,'opening/entry/pane');}
 for(const patch of [{leftM:-.1},{leftM:4.7},{recessM:NaN},{recessM:0},{recessM:-.1},{recessM:1.6},{recessM:.1},{projectionM:.1},{head:'oval'},{head:'segmental',headRiseM:.1}]){
  const r=fixture();Object.assign(r.elevations[0].openings.value[0],{recessM:.4,...patch});assert.throws(()=>compileCanalHouseRecipe(r));
 }
 const narrow=fixture();narrow.footprint.value[0].outer=[[0,0],[6,0],[6,.3],[0,.3]];narrow.footprint.value[0].holes=[];narrow.elevations[0].openings.value[0].recessM=.4;assert.throws(()=>compileCanalHouseRecipe(narrow),/footprint|courtyard/);
 const court=fixture();court.footprint.value[0].holes=[[[1.5,.2],[1.7,.2],[1.7,.3],[1.5,.3]]];court.elevations[0].openings.value[0].recessM=.4;assert.throws(()=>compileCanalHouseRecipe(court),/footprint|courtyard/);
 assert.equal(canalhouseOpeningTemplate({template:'plain-frame',overrides:{recessM:.4}}).recessM,.4);
});

test('reusable loggia variants expose recessed glass, glazed side, dark ceiling and open spanning rails',()=>{
 for(const spec of [{depth:.55,side:'left' as const,width:1.6},{depth:1.05,side:'right' as const,width:2.0}]){
  const r=fixture(),e=r.elevations[0],left=3.6,bottom=2.8,height=2.4;
  e.openings=m([{id:'loggia',kind:'window',leftM:left,bottomM:bottom,widthM:spec.width,heightM:height,trimWidthM:.06,recessM:spec.depth,recessReturns:{glazedSides:[spec.side],soffitSurface:'door'}}]);
  e.blocks=m([{id:'opaque-lower',leftM:1,bottomM:bottom,widthM:2.5,heightM:.7,depthM:.05,surface:'wall'}]);
  e.balconies=m([{id:'open-guard',openingId:'loggia',heightM:.9,depthM:.2,barWidthM:.025,posts:4,span:{leftM:1,widthM:left+spec.width-1},horizontalBars:[.49],occludesOpening:true}]);
  const native=structuredClone({footprint:r.footprint.value,roof:r.roof.value}),built=compileCanalHouseRecipe(r);built.group.updateMatrixWorld(true);
  const f=built.group.getObjectByName('elevation/front')!;
  const hit=(point:T.Vector3,direction:T.Vector3)=>new T.Raycaster(point.applyMatrix4(f.matrixWorld),direction.transformDirection(f.matrixWorld)).intersectObject(built.group,true)[0];
  const back=hit(new T.Vector3(left+.45,bottom+height*.75,2),new T.Vector3(0,0,-1));
  assert.equal(back.object.name,'opening/loggia/pane');
  assert.equal(back.object.userData.surface,'glass');
  assert(Math.abs(new T.Vector3().copy(back.point).applyMatrix4(f.matrixWorld.clone().invert()).z-(.08-spec.depth))<1e-5);
  const side=hit(new T.Vector3(left+spec.width/2,bottom+1.4,-spec.depth*.5),new T.Vector3(spec.side==='left'?-1:1,0,0));
  assert.equal(side.object.userData.surface,'glass');assert.match(side.object.name,new RegExp(`recess/${spec.side}-jamb$`));
  const ceiling=hit(new T.Vector3(left+spec.width/2,bottom+1.8,-spec.depth*.5),new T.Vector3(0,1,0));
  assert.equal(ceiling.object.name,'opening/loggia/recess/soffit');assert.equal(ceiling.object.userData.surface,'door');
  const panel=hit(new T.Vector3(1.2,bottom+.3,2),new T.Vector3(0,0,-1));assert.equal(panel.object.userData.surface,'wall');assert.match(panel.object.name,/opaque-lower/);
  const guard=hit(new T.Vector3(1.2,bottom+.9*.49,2),new T.Vector3(0,0,-1));assert.match(guard.object.name,/open-guard\/horizontal-0/);
  assert.deepEqual({footprint:r.footprint.value,roof:r.roof.value},native);
  assert.equal(new T.Raycaster(new T.Vector3(3,20,5),new T.Vector3(0,-1,0)).intersectObject(built.group,true).length,0,'courtyard stays open');
 }
 const bad=fixture();bad.elevations[0].openings.value[0].recessReturns={glazedSides:['left']};assert.throws(()=>compileCanalHouseRecipe(bad),/require an opening recess/);
});
