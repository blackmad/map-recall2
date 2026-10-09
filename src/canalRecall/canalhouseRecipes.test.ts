import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { compileCanalHouseRecipe, canalhouseCrownProfile, type CanalHouseRecipe } from './canalhouseRecipes.ts';
import { unobservedHouse } from './facade/houseRecord.ts';
import { measured, defaulted, type Observation } from './facade/evidence.ts';
import {canalhouseFacadeGroup} from './canalhouseFacadeGroups.ts';
import {canalhouseGroundFront} from './canalhouseGroundFront.ts';
import {canalhouseOvalProfile} from './canalhouseOrnamentProfiles.ts';
import {canalhouseCorniceLayers} from './canalhouseCorniceAssembly.ts';
import {canalhouseSymmetricRoof} from './canalhouseSymmetricRoof.ts';
const observation:Observation={id:'fixture',pandId:'0363100012345678',kind:'human-review',elevation:'front',capturedAt:'2025-01-01',sourceUrl:null,license:null};
const m=<V>(value:V)=>measured(value,'reviewed',1,observation);
function fixture():CanalHouseRecipe{
 const house=unobservedHouse(observation.pandId);house.eavesHeightM=m(8);house.gable=m('punt');
 const polygon={outer:[[0,0],[6,0],[6,10],[0,10]] as [number,number][],holes:[[[2,4],[4,4],[4,7],[2,7]]] as [number,number][][]};
 return {schemaVersion:1,id:'fixture',house,observations:[observation],footprint:m([polygon]),palette:m({wall:'#763f2b',roof:'#413c3a',trim:'#eee9dc',glass:'#233a43',door:'#23322a'}),roof:m([{polygon,plane:{heightM:8,slopeX:0,slopeZ:0}}]),elevations:[{id:'front',polygonIndex:0,edgeIndex:0,openings:m([{id:'window',kind:'window',leftM:1,bottomM:3,widthM:1.4,heightM:2,trimWidthM:.08,verticalBars:[.5],horizontalBars:[.5]}]),crown:m({profile:[[0,8],[3,10],[6,8]],depthM:.25,trimWidthM:.1})}],simplifications:['Synthetic test geometry only']};
}
const hit=(group:T.Group,from:number[],direction:number[])=>new T.Raycaster(new T.Vector3(...from),new T.Vector3(...direction)).intersectObject(group,true);
test('selectable cornice spans expose raised glazing while preserving side courses',()=>{
 for(const layered of [false,true]){
  const r=fixture(),e=r.elevations[0],o=e.openings.value[0];o.leftM=2.3;o.bottomM=7.5;o.widthM=1.4;o.heightM=1.2;o.verticalBars=[];o.horizontalBars=[];
  e.cornice=m({bottomM:8,heightM:.4,depthM:.25,brackets:0,...(layered?{layers:canalhouseCorniceLayers(8,.4,{template:'lip-frieze-cap'})}:{})});
  const before=compileCanalHouseRecipe(r).group;assert(hit(before,[2.7,8.36,-5],[0,0,1])[0].object.name.startsWith('cornice/'));
  e.cornice.value.spans=[{leftM:0,widthM:2.2},{leftM:3.8,widthM:2.2}];
  const after=compileCanalHouseRecipe(r).group;
  assert.equal(hit(after,[2.7,8.36,-5],[0,0,1])[0].object.name,'opening/window/pane');
  for(const x of [1,5])assert(hit(after,[x,8.36,-5],[0,0,1])[0].object.name.startsWith('cornice/'));
  e.cornice.value.spans=[{leftM:0,widthM:4},{leftM:3,widthM:3}];assert.throws(()=>compileCanalHouseRecipe(r),/cornice spans/);
 }
});
test('shared crossed guards scale across widths and leave upper panes exposed',()=>{
 for(const width of [1.4,2.8])for(const panels of [1,2]){
  const r=fixture(),e=r.elevations[0],o=e.openings.value[0];o.widthM=width;
  e.balconies=m([{id:'guard',openingId:o.id,heightM:.6,depthM:.12,barWidthM:.025,posts:2,infill:{template:'cross',panels}}]);
  const {group}=compileCanalHouseRecipe(r);group.updateMatrixWorld(true);
  const bars:T.Mesh[]=[];group.traverse(object=>{if(object instanceof T.Mesh&&object.name.startsWith('balcony/guard/cross-'))bars.push(object);});
  assert.equal(bars.length,panels*2);
  assert(hit(group,[1+width*.27,4.7,-5],[0,0,1])[0].object.name.startsWith('opening/window/'));
  const facade=group.children.find(g=>g.name==='elevation/front')!;
  for(const bar of bars){const p=bar.geometry.getAttribute('position');for(let i=0;i<p.count;i++){assert(p.getX(i)>=1&&p.getX(i)<=1+width);assert(p.getY(i)>=3&&p.getY(i)<=3.6);}}
  assert(facade);
  e.balconies.value[0].infill!.panels=0;assert.throws(()=>compileCanalHouseRecipe(r),/cross infill/);
 }
});
test('localized crown facing follows varied shared heads without whitening the neck or burying apertures',()=>{
 for(const [family,cut] of [['klok',9.3],['hals',9.15]] as const){
  const r=fixture(),e=r.elevations[0];r.house.gable=m(family);
  e.crown=m({profile:canalhouseCrownProfile(family,6,8,10,1.8,9,1,{cap:'rounded',capRiseM:.5}),depthM:.15,trimWidthM:.06,capFacing:{bottomM:cut,depthM:.035,surface:'trim'}});
  e.openings.value.push({id:'crown-light',kind:'window',leftM:2.7,bottomM:8.3,widthM:.6,heightM:.5,trimWidthM:.04});
  const footprint=structuredClone(r.footprint.value),roof=structuredClone(r.roof.value),before=structuredClone(e.crown.value.profile);
  const {group}=compileCanalHouseRecipe(r);group.updateMatrixWorld(true);
  assert.equal(hit(group,[3,9.7,-5],[0,0,1])[0].object.name,'crown/cap-facing');
  assert.equal(hit(group,[3,9,-5],[0,0,1])[0].object.userData.surface,'wall');
  assert(hit(group,[2.9,8.5,-5],[0,0,1])[0].object.name.startsWith('opening/crown-light/'));
  assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
  assert.deepEqual(r.footprint.value,footprint);assert.deepEqual(r.roof.value,roof);assert.deepEqual(e.crown.value.profile,before);
  e.crown.value.capFacing!.bottomM=8.4;assert.throws(()=>compileCanalHouseRecipe(r),/overlaps an opening/);
  e.crown.value.capFacing!.bottomM=10;assert.throws(()=>compileCanalHouseRecipe(r),/Invalid crown cap facing/);
  e.crown.value.capFacing!.bottomM=cut;e.crown.value.capFacing!.depthM=.3;assert.throws(()=>compileCanalHouseRecipe(r),/Invalid crown cap facing/);
 }
 const r=fixture();r.elevations[0].crown!.value={profile:[[0,8],[1,10],[3,8],[5,10],[6,8]],depthM:.1,trimWidthM:.05,capFacing:{bottomM:9,depthM:.03,surface:'stone'}};
 assert.throws(()=>compileCanalHouseRecipe(r),/one connected head/);
});
test('paired split crown wings transfer across neck and clock profiles without burying the central window',()=>{
 for(const family of ['hals','klok'] as const){
  const r=fixture(),e=r.elevations[0];r.house.gable=m(family);
  e.crown=m({profile:canalhouseCrownProfile(family,6,8,10,1.8,9,1,{cap:'flat'}),depthM:.15,trimWidthM:.06,wings:{leftM:.1,widthM:1.5,thicknessM:.35,segments:2,gapM:.1,bulgeM:.15,depthM:.09,surface:'trim'}});
  e.openings.value.push({id:'neck-light',kind:'window',leftM:2.7,bottomM:8.2,widthM:.6,heightM:.5,trimWidthM:.04});
  const before=structuredClone({footprint:r.footprint.value,roof:r.roof.value,profile:e.crown.value.profile});
  const {group}=compileCanalHouseRecipe(r);group.updateMatrixWorld(true);const wings:T.Object3D[]=[];
  group.traverse(o=>{if(o.name.startsWith('crown/wing-'))wings.push(o);});assert.equal(wings.length,4);
  const profile=e.crown.value.profile,at=(x:number)=>{const i=profile.findIndex((p,i)=>i>0&&p[0]>profile[i-1][0]&&x>=profile[i-1][0]&&x<=p[0]);const a=profile[i-1],b=profile[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);};
  for(const x of [.45,5.55])assert(hit(group,[x,at(x)-.1,-5],[0,0,1])[0].object.name.startsWith('crown/wing-'));
  assert(hit(group,[3,8.4,-5],[0,0,1])[0].object.name.startsWith('opening/neck-light/'));
  assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);assert.deepEqual({footprint:r.footprint.value,roof:r.roof.value,profile:e.crown.value.profile},before);
  e.crown.value.wings!.gapM=2;assert.throws(()=>compileCanalHouseRecipe(r),/wing assembly/);
  e.crown.value.wings!.gapM=.1;e.openings.value.push({id:'wing-overlap',kind:'window',leftM:.3,bottomM:7.8,widthM:.4,heightM:.2,trimWidthM:.025});assert.throws(()=>compileCanalHouseRecipe(r),/wing overlaps/);
 }
});

test('analytic roof cut fragments retain coverage without relaxing footprint or native fragment guards',()=>{
 const r=fixture();r.house.eavesHeightM=m(10);r.shellTopM=m(10);r.elevations[0].crown=undefined;
 r.footprint=m([{outer:[[0,0],[4,0],[4,8],[0,8]],holes:[]}]);
 const input=[{polygon:{outer:[[0,0],[4,0],[4,8]] as [number,number][],holes:[]},plane:{heightM:4,slopeX:0,slopeZ:0}},{polygon:{outer:[[0,0],[4,8],[0,8]] as [number,number][],holes:[]},plane:{heightM:4,slopeX:0,slopeZ:0}}];
 r.roof=m(canalhouseSymmetricRoof(input,['main','main'],{a:[0,0],b:[4,0],normal:[0,-1]},{template:'symmetric-front-hip',surfaceIds:['main'],eavesM:10,ridgeM:13,hipDepthM:1.999999,sideRunM:1}));
 const fragment=r.roof.value.find(p=>p.generatedFragment)!;assert(fragment);
 const totalArea=r.roof.value.reduce((sum,r)=>sum+Math.abs(r.polygon.outer.reduce((s,p,i)=>{const q=r.polygon.outer[(i+1)%r.polygon.outer.length];return s+p[0]*q[1]-q[0]*p[1]},0))/2,0);
 assert(Math.abs(totalArea-32)<1e-8);
 assert.doesNotThrow(()=>compileCanalHouseRecipe(r));
 delete fragment.generatedFragment;assert.throws(()=>compileCanalHouseRecipe(r),/Degenerate footprint ring/);
 fragment.generatedFragment='symmetric-roof';r.roof.value.find(p=>p!==fragment)!.generatedFragment='symmetric-roof';
 assert.throws(()=>compileCanalHouseRecipe(r),/Invalid generated roof fragment/);
});
test('signed low roof surfaces retain source grade, stepped walls and open courtyards',()=>{
 const r=fixture();r.shellTopM=m(-.031);
 const footprint=r.footprint.value[0];
 footprint.holes=[[[2,6],[4,6],[4,7],[2,7]]];
 r.roof=m([
  {polygon:{outer:[[0,0],[6,0],[6,4],[0,4]],holes:[]},plane:{heightM:8,slopeX:0,slopeZ:0}},
  {polygon:{outer:[[0,4],[6,4],[6,10],[0,10]],holes:footprint.holes},plane:{heightM:-.03,slopeX:0,slopeZ:0}},
 ]);
 const {group}=compileCanalHouseRecipe(r);group.updateMatrixWorld(true);
 const low=hit(group,[1,10,8],[0,-1,0])[0];
 assert.equal(low.object.name,'roof/1');assert(Math.abs(low.point.y+.03)<1e-6);
 assert.equal(hit(group,[3,10,6.5],[0,-1,0]).length,0);
 assert.equal(hit(group,[1,4,8],[0,0,-1])[0].object.userData.surface,'wall');
 const shell=group.getObjectByName('shell/0') as T.Mesh;shell.geometry.computeBoundingBox();
 assert(Math.abs(shell.geometry.boundingBox!.min.y+.032)<1e-6);
 assert(Math.abs(shell.geometry.boundingBox!.max.y+.031)<1e-6);
 r.shellTopM=m(-.02);assert.throws(()=>compileCanalHouseRecipe(r),/below surveyed shell top/);
 r.shellTopM=m(NaN);assert.throws(()=>compileCanalHouseRecipe(r));
});
test('shared cornice courses expose frieze, lip and sloping cap underside without closing windows',()=>{
 const r=fixture(),section={lowerLipEnd:.15,upperCapStart:.78,lowerLipDepthM:.15,friezeDepthM:.07,upperCapDepthM:.28,capUnderside:{riseM:.05,insetM:.1}};
 assert.deepEqual(canalhouseCorniceLayers(6,1,{template:'lip-frieze-cap'}),canalhouseCorniceLayers(6,1,section));
 assert.equal(canalhouseCorniceLayers(6,1,{template:'lip-frieze-cap',overrides:{friezeDepthM:.04}})[1].depthM,.04);
 r.elevations[0].cornice=m({bottomM:6,heightM:1,depthM:.28,brackets:0,layers:canalhouseCorniceLayers(6,1,section)});
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[3,6.1,-5],[0,0,1])[0].object.name,'cornice/layer-0');
 assert.equal(hit(group,[3,6.5,-5],[0,0,1])[0].object.name,'cornice/layer-1');
 const sloped=hit(group,[3,6.805,-5],[0,0,1])[0];assert.equal(sloped.object.name,'cornice/layer-2');assert.ok(sloped.face!.normal.y<-.5);
 const cap=hit(group,[3,6.95,-5],[0,0,1])[0];assert.ok(Math.abs(cap.distance-sloped.distance+.05)<1e-5);
 assert.equal(hit(group,[1.35,3.4,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 assert.throws(()=>canalhouseCorniceLayers(6,1,{...section,upperCapStart:.1}),/section/);
 assert.throws(()=>canalhouseCorniceLayers(6,1,{...section,capUnderside:{riseM:.3,insetM:.1}}),/underside/);
 r.elevations[0].cornice!.value.layers![2].underside!.insetM=.5;assert.throws(()=>compileCanalHouseRecipe(r),/underside escapes/);
});
test('triglyph channels retain opaque backing and expose shallow relief before the frieze',()=>{
 const r=fixture();r.elevations[0].cornice=m({bottomM:6,heightM:1.2,depthM:.12,brackets:0,accents:[{id:'observed-panel',leftM:1,bottomM:6.1,widthM:.5,heightM:.7,depthM:.2,profile:'triglyph'}]});
 const {group}=compileCanalHouseRecipe(r);
 const rib=hit(group,[1.05,6.45,-5],[0,0,1])[0];
 assert.equal(rib.object.name,'cornice/triglyph-observed-panel/rib-0');
 for(const x of [1.1,1.25,1.4]){
  const channel=hit(group,[x,6.45,-5],[0,0,1])[0];
  assert.equal(channel.object.name,'cornice/triglyph-observed-panel/base');
  assert.equal(channel.object.userData.surface,'trim');
  assert(Math.abs(channel.distance-rib.distance-.024)<1e-6);
 }
 const shoulder=hit(group,[1.083125,6.45,-5],[0,0,1])[0];
 assert.equal(shoulder.object.name,'cornice/triglyph-observed-panel/channel-0/shoulder-0');
 assert(Math.abs(shoulder.distance-rib.distance-.012)<1e-6);
 assert.equal(hit(group,[1.25,6.12,-5],[0,0,1])[0].object.name,'cornice/triglyph-observed-panel/bottom');
 assert.equal(hit(group,[1.25,6.78,-5],[0,0,1])[0].object.name,'cornice/triglyph-observed-panel/top');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 r.elevations[0].cornice!.value.accents![0].bottomM=5.9;
 assert.throws(()=>compileCanalHouseRecipe(r),/accent escapes/);
});
test('reusable oval field exposes source-selected dark center without covering adjacent cornice or glazing',()=>{
 const r=fixture();r.elevations[0].cornice=m({bottomM:6,heightM:1,depthM:.27,brackets:0});
 r.elevations[0].ornaments=m([{id:'oval-field',profile:canalhouseOvalProfile({kind:'oval',left:1,bottom:6.3,width:.8,height:.3}),fill:'wall',depthM:.24}]);
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.4,6.45,-5],[0,0,1])[0].object.name,'ornament/oval-field/field');
 assert.equal(hit(group,[1.02,6.59,-5],[0,0,1])[0].object.userData.surface,'trim');
 assert.equal(hit(group,[1.3,3.4,-5],[0,0,1])[0].object.name,'opening/window/pane');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 assert.throws(()=>canalhouseOvalProfile({kind:'oval',left:1,bottom:6.3,width:0,height:.3}),/Invalid/);
});
test('ground-front field links actual openings while keeping recessed glass and native courts visible',()=>{
 const r=fixture(),front={id:'stone-pui',leftM:0,bottomM:0,widthM:3,heightM:5.5,depthM:.2,surface:'stone' as const,openingIds:['window'],header:{bottomM:5,heightM:.5,depthM:.25}};
 r.elevations[0].blocks=m(canalhouseGroundFront(front,r.elevations[0].openings.value));
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.3,3.4,-5],[0,0,1])[0].object.name,'opening/window/pane');
 assert.equal(hit(group,[.7,3.4,-5],[0,0,1])[0].object.userData.surface,'stone');
 assert.match(hit(group,[1.3,5.3,-5],[0,0,1])[0].object.name,/stone-pui\/header/);
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 assert.throws(()=>canalhouseGroundFront({...front,openingIds:['missing']},r.elevations[0].openings.value),/missing/);
 assert.throws(()=>canalhouseGroundFront({...front,openingIds:['window','window']},r.elevations[0].openings.value),/duplicate/);
 assert.throws(()=>canalhouseGroundFront({...front,heightM:4},r.elevations[0].openings.value),/outside/);
 const neighbor={...r.elevations[0].openings.value[0],id:'other',leftM:2.5,widthM:.4};
 assert.throws(()=>canalhouseGroundFront(front,[...r.elevations[0].openings.value,neighbor]),/unselected/);
 assert.throws(()=>canalhouseGroundFront({...front,header:{...front.header,heightM:1}},r.elevations[0].openings.value),/header/);
});
test('grouped masonry retains window apertures and native courts and cannot bypass wall support',()=>{
 const r=fixture(),input={id:'stone-rows',columns:[{id:'left',leftM:0,widthM:3}],rows:[{id:'lower',bottomM:2.8,heightM:2.4},{id:'upper',bottomM:6,heightM:1}],depthM:.15,surface:'stone' as const};
 r.elevations[0].blocks=m(canalhouseFacadeGroup(input));
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.3,3.4,-5],[0,0,1])[0].object.name,'opening/window/pane');
 assert.equal(hit(group,[.5,3.4,-5],[0,0,1])[0].object.userData.surface,'stone');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 input.rows[1].bottomM=11;r.elevations[0].blocks=m(canalhouseFacadeGroup(input));
 assert.throws(()=>compileCanalHouseRecipe(r),/escapes its supported wall/);
 assert.throws(()=>canalhouseFacadeGroup({...input,columns:[]}),/empty/);
 assert.throws(()=>canalhouseFacadeGroup({...input,rows:[input.rows[0],input.rows[0]]}),/duplicate/);
});
test('masonry around segmental heads fills its upper corners and retains first-hit curved glass',()=>{
 const r=fixture(),o=r.elevations[0].openings.value[0];o.head='segmental';o.headRiseM=.3;o.verticalBars=[];o.horizontalBars=[];
 r.elevations[0].blocks=m([{id:'portal',leftM:.7,bottomM:2.8,widthM:2,heightM:2.5,depthM:.09,surface:'stone'}]);
 const {group}=compileCanalHouseRecipe(r);
 for(const x of [1.02,2.38])assert.equal(hit(group,[x,4.98,-5],[0,0,1])[0].object.userData.surface,'stone');
 assert.equal(hit(group,[1.7,4.65,-5],[0,0,1])[0].object.name,'opening/window/pane');
 assert.equal(hit(group,[1.7,4.96,-5],[0,0,1])[0].object.userData.surface,'trim');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 r.elevations[0].blocks.value[0].heightM=2.05;
 const cropped=compileCanalHouseRecipe(r).group;
 assert.equal(hit(cropped,[1.02,4.84,-5],[0,0,1])[0].object.userData.surface,'stone');
 assert.equal(hit(cropped,[1.02,4.98,-5],[0,0,1])[0].object.userData.surface,'wall');
});
test('restored head masonry cannot bury another explicitly placed opening',()=>{
 const r=fixture(),o=r.elevations[0].openings.value[0];o.head='segmental';o.headRiseM=.3;o.verticalBars=[];o.horizontalBars=[];
 r.elevations[0].openings.value.push({id:'small-opening',kind:'window',leftM:.98,bottomM:4.88,widthM:.2,heightM:.25,trimWidthM:.02});
 r.elevations[0].blocks=m([{id:'portal',leftM:.7,bottomM:2.8,widthM:2,heightM:2.5,depthM:.09,surface:'stone'}]);
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.06,4.97,-5],[0,0,1])[0].object.name,'opening/small-opening/pane');
});
test('source-selected thin sash bars retain full outer frame and expose adjacent glass',()=>{
 const r=fixture(),opening=r.elevations[0].openings.value[0];opening.mullionWidthM=.03;
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.7,3.4,-5],[0,0,1])[0].object.name,'opening/window/bar');
 assert.equal(hit(group,[1.725,3.4,-5],[0,0,1])[0].object.name,'opening/window/pane');
 assert.equal(hit(group,[1.04,3.4,-5],[0,0,1])[0].object.name,'opening/window/frame');
 for(const width of [.001,.09,NaN]){opening.mullionWidthM=width;assert.throws(()=>compileCanalHouseRecipe(r),/mullion width/);}
});
test('rectangular and segmental joinery select dark frames independently of white sash',()=>{
 for(const head of [undefined,'segmental'] as const){
  const r=fixture(),o=r.elevations[0].openings.value[0];o.head=head;o.headRiseM=head ? .3 : undefined;o.frameSurface='door';o.mullionWidthM=.03;
  const {group}=compileCanalHouseRecipe(r);
  for(const [x,y,surface] of [[1.04,3.4,'door'],[1.7,3.4,'trim'],[1.725,3.4,'glass'],[1.3,4,'trim']] as const){
   const first=hit(group,[x,y,-5],[0,0,1])[0].object as T.Mesh;
   assert.equal(first.userData.surface,surface);
   assert.equal((first.material as T.MeshStandardMaterial).color.getHexString(),r.palette.value[surface].slice(1));
  }
  if(head)assert.equal(hit(group,[1.7,4.96,-5],[0,0,1])[0].object.userData.surface,'door');
  o.frameSurface='trim';o.barSurface='door';
  const dark=compileCanalHouseRecipe(r).group;
  assert.equal(hit(dark,[1.04,3.4,-5],[0,0,1])[0].object.userData.surface,'trim');
  assert.equal(hit(dark,[1.7,3.4,-5],[0,0,1])[0].object.userData.surface,'door');
  assert.equal(hit(dark,[1.3,4,-5],[0,0,1])[0].object.userData.surface,'door');
  o.verticalBars=[];o.horizontalBars=[];o.diagonalBars=[[[.15,.2],[.8,.8]]];
  const grille=compileCanalHouseRecipe(r).group,first=hit(grille,[1.665,4,-5],[0,0,1])[0].object;
  assert.equal(first.name,'opening/window/grille');assert.equal(first.userData.surface,'door');
 }
});
test('observed meeting rail width leaves slim mullions and neighboring glass visible',()=>{
 const r=fixture(),o=r.elevations[0].openings.value[0];o.mullionWidthM=.02;o.horizontalBars=[.3,.7];o.horizontalBarWidthsM=[.12,.025];
 const {group}=compileCanalHouseRecipe(r);
 for(const [x,y,name] of [[1.3,3.65,'bar'],[1.3,3.67,'pane'],[1.3,3.55,'bar'],[1.3,3.53,'pane'],[1.3,4.41,'bar'],[1.3,4.42,'pane'],[1.7,3.4,'bar'],[1.715,3.4,'pane']] as const)
  assert.equal(hit(group,[x,y,-5],[0,0,1])[0].object.name,`opening/window/${name}`);
 o.horizontalBars=[.05];o.horizontalBarWidthsM=[.12];assert.throws(()=>compileCanalHouseRecipe(r),/escapes pane/);
 o.heightM=.4;o.horizontalBars=[.5];o.horizontalBarWidthsM=[.11];assert.throws(()=>compileCanalHouseRecipe(r),/horizontal bar width/);
});
test('explicit default joinery inputs retain omitted-input geometry and materials',()=>{
 const snapshot=(r:CanalHouseRecipe)=>{const {group}=compileCanalHouseRecipe(r);const meshes:unknown[]=[];group.traverse(o=>{if(o instanceof T.Mesh)meshes.push([o.name,o.userData.surface,Array.from(o.geometry.getAttribute('position').array),o.geometry.index?Array.from(o.geometry.index.array):null,o.matrixWorld.toArray()]);});return meshes;};
 const r=fixture(),before=snapshot(r),o=r.elevations[0].openings.value[0];o.frameSurface='trim';o.barSurface='trim';o.horizontalBarWidthsM=[o.trimWidthM];assert.deepEqual(snapshot(r),before);
});
test('joinery slots and rail width lists reject malformed observations',()=>{
 for(const key of ['frameSurface','barSurface'] as const)for(const value of ['wall','#000000',null,0]){
  const r=fixture();Object.assign(r.elevations[0].openings.value[0],{[key]:value});assert.throws(()=>compileCanalHouseRecipe(r),/joinery surface/);
 }
 for(const widths of [null,{},.03,[],[.02,.03],[NaN],[Infinity],[.007],[.151],['.03'],Array(1)]){
  const r=fixture();Object.assign(r.elevations[0].openings.value[0],{horizontalBarWidthsM:widths});assert.throws(()=>compileCanalHouseRecipe(r),/bar width/);
 }
});
test('source intermediate landing connects to a higher door and rejects masonry across lower apertures',()=>{
 const r=fixture();r.elevations[0].openings=m([{id:'high-door',kind:'door',leftM:1,bottomM:2.112,widthM:1.2,heightM:1.5,trimWidthM:.05},{id:'low-window',kind:'window',leftM:4,bottomM:.2,widthM:1,heightM:1.3,trimWidthM:.05}]);
 r.elevations[0].landing=m({leftM:1,widthM:1.8,topM:1.72,depthM:1.2,thicknessM:.04,supportToGround:true,thresholdConnector:{riseM:.392,depthM:.25}});
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.5,2.05,-5],[0,0,1])[0].object.name,'entrance/threshold-connector');
 assert.equal(hit(group,[2.6,.6,-5],[0,0,1])[0].object.name,'entrance/landing-body');
 assert.equal(hit(group,[4.4,.6,-5],[0,0,1])[0].object.name,'opening/low-window/pane');
 assert.equal(hit(group,[1.5,2.6,-5],[0,0,1])[0].object.name,'opening/high-door/pane');
 r.elevations[0].landing.value.thresholdConnector!.riseM=.1;assert.throws(()=>compileCanalHouseRecipe(r),/Landing must meet/);
 r.elevations[0].landing.value.thresholdConnector!.riseM=.392;r.elevations[0].openings.value[1].leftM=1.5;assert.throws(()=>compileCanalHouseRecipe(r),/masonry body blocks/);
});
test('native geometry exposes glazing before the parent wall and preserves a courtyard',()=>{
 const {group,stats}=compileCanalHouseRecipe(fixture());assert.deepEqual(group.scale.toArray(),[1,1,1]);
 assert.equal(hit(group,[1.3,3.4,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 assert.equal(hit(group,[1,30,5],[0,-1,0])[0].object.userData.surface,'roof');
 assert.equal(hit(group,[3,9,-5],[0,0,1])[0].object.userData.component,'crown');
 assert(stats.triangles>0);assert(stats.bounds.max[2]>=10);
});
test('roof normals face upward, including a surveyed inclined plane',()=>{
 const r=fixture();r.roof.value[0].plane={heightM:8,slopeX:.2,slopeZ:.1};
 const {group}=compileCanalHouseRecipe(r);group.traverse((o:T.Object3D)=>{if(o instanceof T.Mesh&&o.userData.surface==='roof'){const n=o.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0);}});
});
test('unknown dimensions and foreign evidence cannot become actual house geometry',()=>{
 const r=fixture();r.elevations[0].openings=defaulted(r.elevations[0].openings.value);assert.throws(()=>compileCanalHouseRecipe(r),/unobserved/);
 const f=fixture();f.observations[0]={...observation,pandId:'0363100099999999'};assert.throws(()=>compileCanalHouseRecipe(f),/foreign-observation/);
 const g=fixture();g.house.gable=defaulted('punt');assert.throws(()=>compileCanalHouseRecipe(g),/gable is unobserved/);
});
test('compiler is deterministic and rejects openings outside surveyed elevation',()=>{
 const a=compileCanalHouseRecipe(fixture()),b=compileCanalHouseRecipe(fixture());assert.equal(a.inputKey,b.inputKey);assert.deepEqual(a.stats,b.stats);
 const r=fixture();r.elevations[0].openings.value[0].leftM=5;assert.throws(()=>compileCanalHouseRecipe(r),/escapes/);
});
test('observed door panels expose hollow frames and inset fields before the original leaf',()=>{
 const r=fixture();r.elevations[0].openings=m([{id:'door',kind:'door',leftM:1,bottomM:.1,widthM:1.2,heightM:2.4,trimWidthM:.1,projectionM:.12,paneOffsetM:.025,panels:[
  {rect:[.1,.1,.8,.35],frameWidthM:.035,reliefM:.025,fieldReliefM:.008,frameSurface:'door'},
  {rect:[.1,.55,.8,.35],frameWidthM:.035,reliefM:.025,fieldReliefM:.008,frameSurface:'trim'},
 ]}]);
 const {group}=compileCanalHouseRecipe(r);
 const frame=hit(group,[1.217,.805,-5],[0,0,1])[0],field=hit(group,[1.6,.805,-5],[0,0,1])[0],leaf=hit(group,[1.6,1.3,-5],[0,0,1])[0];
 assert.equal(frame.object.name,'opening/door/panel/0/frame');assert.equal(frame.object.userData.surface,'door');
 assert.equal(field.object.name,'opening/door/panel/0/field');assert.equal(field.object.userData.surface,'door');
 assert.equal(leaf.object.name,'opening/door/pane');assert(frame.point.z<field.point.z&&field.point.z<leaf.point.z);
 assert.equal(hit(group,[1.217,1.795,-5],[0,0,1])[0].object.userData.surface,'trim');
 assert.equal(hit(group,[1.05,1,-5],[0,0,1])[0].object.name,'opening/door/frame');
 const panelMeshes:T.Mesh[]=[];group.traverse(o=>{if(o instanceof T.Mesh&&o.name.includes('/panel/'))panelMeshes.push(o);});assert.equal(panelMeshes.length,4);
 for(const mesh of panelMeshes){mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox!;assert(bounds.min.x>1.1&&bounds.max.x<2.1&&bounds.min.y>.2&&bounds.max.y<2.4);}
});
test('absent and empty door panel observations retain the original flat leaf',()=>{
 const r=fixture();r.elevations[0].openings.value[0].kind='door';
 const original=compileCanalHouseRecipe(r);r.elevations[0].openings.value[0].panels=[];const empty=compileCanalHouseRecipe(r);
 assert.deepEqual(empty.stats,original.stats);assert.equal(hit(empty.group,[1.3,3.4,-5],[0,0,1])[0].object.name,'opening/window/pane');
 assert.equal(empty.group.getObjectByName('opening/window/panel/0/frame'),undefined);
});
test('partial observed molding exposes top and sides without inventing a hidden bottom stroke',()=>{
 const r=fixture();r.elevations[0].openings=m([{id:'door',kind:'door',leftM:1,bottomM:.1,widthM:1.2,heightM:2.4,trimWidthM:.1,panels:[{rect:[.1,.1,.8,.35],frameWidthM:.035,reliefM:.025,fieldReliefM:.008,frameSurface:'door',frameEdges:['top','left','right']}]}]);
 const {group}=compileCanalHouseRecipe(r);
 for(const [x,y,edge] of [[1.6,1.175,'top'],[1.217,.8,'left'],[1.983,.8,'right']] as const){assert.equal(hit(group,[x,y,-5],[0,0,1])[0].object.name,`opening/door/panel/0/frame/${edge}`);}
 const omitted=hit(group,[1.6,.437,-5],[0,0,1])[0];assert.equal(omitted.object.name,'opening/door/panel/0/field');
 assert.equal(hit(group,[1.6,.41,-5],[0,0,1])[0].object.name,'opening/door/pane');
 assert.equal(group.getObjectByName('opening/door/panel/0/frame/bottom'),undefined);
 const top=hit(group,[1.6,1.175,-5],[0,0,1])[0];assert(top.point.z<omitted.point.z);
 for(const invalid of [[],['left','left'],['top','unknown']]){r.elevations[0].openings.value[0].panels![0].frameEdges=invalid as ('left'|'right'|'top'|'bottom')[];assert.throws(()=>compileCanalHouseRecipe(r),/Invalid door panel frame edges/);}
});
test('door panel dimensions refuse trim collisions, escaped heads, excess relief and guessed window panels',()=>{
 const make=()=>{const r=fixture();r.elevations[0].openings=m([{id:'door',kind:'door',leftM:1,bottomM:.1,widthM:1.2,heightM:2.4,trimWidthM:.1,panels:[{rect:[.1,.1,.8,.35],frameWidthM:.035,reliefM:.025,fieldReliefM:.008,frameSurface:'door'}]}]);return r;};
 for(const rect of [[-.01,.1,.8,.35],[.1,.1,.95,.35],[.1,.8,.8,.35],[0,.1,.8,.35],[.1,.1,-.8,.35],[.1,NaN,.8,.35]]){
  const r=make();r.elevations[0].openings.value[0].panels![0].rect=rect as [number,number,number,number];assert.throws(()=>compileCanalHouseRecipe(r),/Door panel escapes|dimension/);
 }
 for(const change of [{frameWidthM:.07},{reliefM:.04},{fieldReliefM:.03},{fieldReliefM:.025}]){const r=make();Object.assign(r.elevations[0].openings.value[0].panels![0],change);assert.throws(()=>compileCanalHouseRecipe(r),/Unsupported door panel/);}
 const arched=make(),opening=arched.elevations[0].openings.value[0];opening.head='segmental';opening.headRiseM=.5;opening.panels![0].rect=[.01,.82,.3,.16];assert.throws(()=>compileCanalHouseRecipe(arched),/escapes its leaf or head/);
 const window=make();window.elevations[0].openings.value[0].kind='window';assert.throws(()=>compileCanalHouseRecipe(window),/require a door/);
 const overlap=make();overlap.elevations[0].openings.value[0].panels!.push({...overlap.elevations[0].openings.value[0].panels![0]});assert.throws(()=>compileCanalHouseRecipe(overlap),/overlap/);
 const many=make();many.elevations[0].openings.value[0].panels=Array.from({length:17},()=>({...many.elevations[0].openings.value[0].panels![0]}));assert.throws(()=>compileCanalHouseRecipe(many),/at most 16/);
});
test('step, neck, bell and plain crowns use explicit bounded parameters',()=>{
 for(const type of ['trap','hals','klok','punt','lijst'] as const){const p=canalhouseCrownProfile(type,6,8,11,2,9,3);assert.equal(p[0][0],0);assert.equal(p.at(-1)![0],6);assert(p.every(([x,y])=>Number.isFinite(x+y)&&y>=8));}
});

test('shared clock and neck cap controls preserve bounds, symmetry and independently selected crest width',()=>{
 for(const family of ['klok','hals'] as const)for(const cap of ['flat','rounded','pediment'] as const){
  const points=canalhouseCrownProfile(family,6,8,11,3.4,9,3,{crestWidthM:3,cap,capRiseM:cap==='flat'?0:.4,shoulderCurve:2.4});
  assert.deepEqual(points[0],[0,8]);assert.deepEqual(points.at(-1),[6,8]);
  assert.equal(Math.max(...points.map(p=>p[1])),11);
  assert(points.some(([x])=>Math.abs(x-1.5)<1e-9));
  points.forEach(([x,y],i)=>{const opposite=points[points.length-1-i];assert(Math.abs(x+opposite[0]-6)<1e-9);assert(Math.abs(y-opposite[1])<1e-9);assert(x>=0&&x<=6&&y>=8&&y<=11);});
 }
 const broad=canalhouseCrownProfile('klok',6,8,11,2.4,10.4,3,{cap:'rounded',capRiseM:.4,shoulderCurve:2.4});
 const narrow=canalhouseCrownProfile('klok',6,8,11,1.2,9,3,{cap:'rounded',capRiseM:.8,shoulderCurve:.5});
 assert.notDeepEqual(broad,narrow);
 const straightNeck=canalhouseCrownProfile('hals',6,8,11,2,9,1,{cap:'flat'});
 const curvedNeck=canalhouseCrownProfile('hals',6,8,11,2,9,1,{cap:'flat',shoulderCurve:2.4});
 assert.notDeepEqual(curvedNeck,straightNeck);assert(curvedNeck.some(([x,y])=>x===1&&y<8.5));
 assert.deepEqual(canalhouseCrownProfile('hals',6,8,11,2,9,1),[[0,8],[2,9],[2,11],[4,11],[4,9],[6,8]]);
 assert.throws(()=>canalhouseCrownProfile('klok',6,8,11,2,10.8,3,{cap:'rounded',capRiseM:.4}),/Invalid crown/);
 assert.throws(()=>canalhouseCrownProfile('klok',6,8,11,2,9,3,{crestWidthM:7}),/Invalid crown/);
 assert.throws(()=>canalhouseCrownProfile('klok',6,8,11,2,9,3,{shoulderCurve:NaN}));
});

test('a roof cannot silently cap the surveyed courtyard',()=>{
 const r=fixture();r.roof.value[0].polygon={...r.roof.value[0].polygon,holes:[]};assert.throws(()=>compileCanalHouseRecipe(r),/courtyard area/);
});

test('roof surveys cannot supply window measurements',()=>{
 const r=fixture();r.elevations[0].openings.source='3dbag';assert.throws(()=>compileCanalHouseRecipe(r),/incompetent-source/);
});

test('surveyed pitched roof closes the end wall without closing internal partition seams',()=>{
 const r=fixture();r.footprint.value[0].holes=[];r.elevations[0].crown=undefined;r.elevations[0].openings=m([]);
 r.roof=m([
  {polygon:{outer:[[0,0],[3,0],[3,10],[0,10]],holes:[]},plane:{heightM:8,slopeX:1,slopeZ:0}},
  {polygon:{outer:[[3,0],[6,0],[6,10],[3,10]],holes:[]},plane:{heightM:14,slopeX:-1,slopeZ:0}},
 ]);
 const {group}=compileCanalHouseRecipe(r);
 const front=hit(group,[1,8.5,-5],[0,0,1])[0];assert(front);assert.equal(front.object.userData.surface,'wall');assert.match(front.object.name,/roof-closure/);
 const rear=hit(group,[5,8.5,15],[0,0,-1])[0];assert(rear);assert.equal(rear.object.userData.surface,'wall');
 const seam=hit(group,[2,9,5],[1,0,0]);assert(!seam.some(h=>h.object.name.includes('roof-closure')));
});
test('same-area roof shifted outside the native footprint is rejected',()=>{
 const r=fixture();r.roof.value[0].polygon={outer:r.roof.value[0].polygon.outer.map(([x,z])=>[x+1,z]),holes:r.roof.value[0].polygon.holes.map(h=>h.map(([x,z])=>[x+1,z]))};
 assert.throws(()=>compileCanalHouseRecipe(r),/outside surveyed footprint/);
});
test('wall closure beside an elevated courtyard roof leaves the court open',()=>{
 const r=fixture();r.roof.value[0].plane={heightM:9,slopeX:0,slopeZ:0};
 const {group}=compileCanalHouseRecipe(r);assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 const wall=hit(group,[3,8.5,5],[-1,0,0])[0];assert(wall);assert.equal(wall.object.userData.surface,'wall');assert.match(wall.object.name,/roof-closure/);
});

test('attic panes are visible on supported crown geometry and reject unsupported heights',()=>{
 const r=fixture();r.elevations[0].openings=m([{id:'attic',kind:'window',leftM:2.5,bottomM:8.3,widthM:1,heightM:1,trimWidthM:.07}]);
 const {group}=compileCanalHouseRecipe(r);assert.equal(hit(group,[2.7,8.6,-5],[0,0,1])[0].object.userData.surface,'glass');
 r.elevations[0].openings.value[0].heightM=2;assert.throws(()=>compileCanalHouseRecipe(r),/escapes/);
});
test('low rear annex common eaves do not block openings on a taller surveyed front',()=>{
 const r=fixture();r.shellTopM=m(5);r.elevations[0].crown=undefined;r.footprint.value[0].holes=[];
 r.roof=m([{polygon:{outer:[[0,0],[6,0],[6,4],[0,4]],holes:[]},plane:{heightM:8,slopeX:0,slopeZ:0}},{polygon:{outer:[[0,4],[6,4],[6,10],[0,10]],holes:[]},plane:{heightM:5,slopeX:0,slopeZ:0}}]);
 r.elevations[0].openings=m([{id:'front-upper',kind:'window',leftM:1,bottomM:6,widthM:1.4,heightM:1.5,trimWidthM:.08}]);
 const {group}=compileCanalHouseRecipe(r);assert.equal(hit(group,[1.3,6.4,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(r.house.eavesHeightM.value,8);assert.equal(hit(group,[1,20,8],[0,-1,0])[0].point.y,5);
});
test('segmental heads use an observed rise and expose shaped glass with stone detail',()=>{
 const r=fixture();const opening=r.elevations[0].openings.value[0];opening.head='segmental';opening.headRiseM=.3;
 r.elevations[0].bands=m([{id:'belt',leftM:0,bottomM:5.5,widthM:6,heightM:.16,depthM:.1}]);
 r.elevations[0].blocks=m([{id:'pilaster',leftM:5.5,bottomM:1,widthM:.25,heightM:4,depthM:.13}]);
 const {group}=compileCanalHouseRecipe(r);assert.equal(hit(group,[1.45,4.85,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(hit(group,[.5,5.57,-5],[0,0,1])[0].object.userData.component,'facadeDetail');
 assert.equal(hit(group,[5.6,3,-5],[0,0,1])[0].object.userData.component,'facadeDetail');
 opening.headRiseM=undefined;assert.throws(()=>compileCanalHouseRecipe(r),/observed rise/);
});
test('facade decorative dimensions retain unknown and source guards',()=>{
 const r=fixture();r.elevations[0].blocks=defaulted([{id:'guess',leftM:0,bottomM:1,widthM:1,heightM:1,depthM:.2}]);assert.throws(()=>compileCanalHouseRecipe(r),/unobserved/);
});

test('discontinuous roof partitions close only the exposed difference with outward normals',()=>{
 const r=fixture();r.shellTopM=m(5);r.elevations[0].crown=undefined;r.footprint.value[0].holes=[];
 r.roof=m([{polygon:{outer:[[0,0],[6,0],[6,4],[0,4]],holes:[]},plane:{heightM:8,slopeX:0,slopeZ:0}},{polygon:{outer:[[0,4],[6,4],[6,10],[0,10]],holes:[]},plane:{heightM:5,slopeX:0,slopeZ:0}}]);
 const {group}=compileCanalHouseRecipe(r);
 const step=hit(group,[3,6,8],[0,0,-1])[0];assert(step);assert.equal(step.object.userData.surface,'wall');assert.match(step.object.name,/step-wall/);
 assert.equal(step.point.z,4);
 const meshes:T.Mesh[]=[];group.traverse((o:T.Object3D)=>{if(o instanceof T.Mesh&&o.name.includes('step-wall'))meshes.push(o);});assert.equal(meshes.length,1);
 const positions=meshes[0].geometry.getAttribute('position');for(let i=0;i<positions.count;i++)assert(positions.getY(i)>=5&&positions.getY(i)<=8);
 assert.equal(hit(group,[3,20,2],[0,-1,0])[0].point.y,8);assert.equal(hit(group,[3,20,8],[0,-1,0])[0].point.y,5);
});
test('continuous pitched partition seam emits no step wall geometry',()=>{
 const r=fixture();r.footprint.value[0].holes=[];r.elevations[0].crown=undefined;
 r.roof=m([{polygon:{outer:[[0,0],[3,0],[3,10],[0,10]],holes:[]},plane:{heightM:8,slopeX:1,slopeZ:0}},{polygon:{outer:[[3,0],[6,0],[6,10],[3,10]],holes:[]},plane:{heightM:14,slopeX:-1,slopeZ:0}}]);
 const {group}=compileCanalHouseRecipe(r);group.traverse((o:T.Object3D)=>assert(!o.name.includes('step-wall')));
});

test('Float32 surveyed mesh rounding is tolerated while source ownership stays exact',()=>{
 const r=fixture(),polygon={outer:[[.123456789,.23456789],[6.123456789,.3456789],[6.23456789,10.987654321],[.123456789,10.987654321]] as [number,number][],holes:[]};
 r.footprint=m([polygon]);r.roof=m([{polygon,plane:{heightM:8,slopeX:0,slopeZ:0}}]);r.elevations[0].crown=undefined;r.elevations[0].openings=m([]);
 assert.doesNotThrow(()=>compileCanalHouseRecipe(r));
 r.roof.value[0].polygon={outer:polygon.outer.map(([x,z])=>[x+.005,z]),holes:[]};assert.throws(()=>compileCanalHouseRecipe(r),/outside surveyed footprint/);
});

test('observed dormers expose framed glazing backed by walls and upward roof caps',()=>{
 for(const roofRiseM of [0,.4]){
  const r=fixture();r.elevations[0].crown=undefined;r.elevations[0].dormers=m([{id:'observed',leftM:1,widthM:1.6,bottomM:8,heightM:1.4,depthM:1.2,roofRiseM,verticalBars:[.5]}]);
  const {group}=compileCanalHouseRecipe(r);const pane=hit(group,[1.3,8.4,-5],[0,0,1])[0];assert(pane);assert.equal(pane.object.userData.surface,'glass');assert.match(pane.object.name,/dormer\/observed\/pane/);
  const cap=hit(group,[1.5,20,.5],[0,-1,0])[0];assert(cap);assert.equal(cap.object.userData.surface,'roof');assert.match(cap.object.name,/dormer\/observed\/roof/);
  group.traverse((o:T.Object3D)=>{if(o instanceof T.Mesh&&o.name==='dormer/observed/roof'){const n=o.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0);}});
 }
});
test('connected attic front surrounds independently sized dormers without hiding panes or closing courts',()=>{
 const r=fixture();r.elevations[0].crown=undefined;
 r.elevations[0].dormers=m([{id:'left',leftM:1,widthM:1,bottomM:8.3,heightM:1.2,depthM:.65,roofRiseM:0},{id:'right',leftM:3.6,widthM:1,bottomM:8.3,heightM:1.4,depthM:.65,roofRiseM:0}]);
 r.elevations[0].dormerFront=m({profile:[[.2,8],[.7,9.7],[2.5,9.7],[2.6,10],[5.2,10],[5.8,8]],depthM:.08,surface:'roof',trimWidthM:.055});
 const {group}=compileCanalHouseRecipe(r);
 for(const x of [1.3,1.7,3.9,4.3])assert.match(hit(group,[x,8.8,-5],[0,0,1])[0].object.name,/dormer\/(left|right)\/pane/);
 for(const [x,y]of [[1.5,8.15],[2.9,9],[.5,8.2]])assert.match(hit(group,[x,y,-5],[0,0,1])[0].object.name,/attic-front\/panel/);
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 r.elevations[0].dormerFront.value.profile=[[.2,8],[5.8,8]];
 assert.throws(()=>compileCanalHouseRecipe(r),/does not support/);
 r.elevations[0].dormerFront=m({profile:[[.2,10],[5.8,10]],depthM:.08,surface:'roof',trimWidthM:.055});
 r.footprint.value[0].holes.push([[2.6,.02],[3.2,.02],[3.2,.12],[2.6,.12]]);
 assert.throws(()=>compileCanalHouseRecipe(r),/Attic front.*(courtyard|footprint)/);
 r.elevations[0].dormerFront=defaulted(r.elevations[0].dormerFront.value);
 assert.throws(()=>compileCanalHouseRecipe(r),/unobserved/);
});
test('unobserved dormer and courtyard-crossing depth cannot become a standalone pane',()=>{
 const r=fixture();r.elevations[0].dormers=defaulted([{id:'guess',leftM:2,widthM:2,bottomM:8,heightM:1.2,depthM:2,roofRiseM:0}]);assert.throws(()=>compileCanalHouseRecipe(r),/unobserved/);
 r.elevations[0].dormers=m([{id:'court',leftM:2,widthM:2,bottomM:8,heightM:1.2,depthM:5,roofRiseM:0}]);assert.throws(()=>compileCanalHouseRecipe(r),/courtyard|footprint/);
});

test('grouped native frontage keeps panes outside an observed shallow facade projection',()=>{
 const r=fixture();const polygon=r.footprint.value[0];polygon.outer.splice(1,0,[3,-.2]);
 r.elevations[0].endEdgeIndex=2;r.elevations[0].frontageToleranceM=m(.25);
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.3,3.4,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 r.elevations[0].frontageToleranceM=defaulted(.25);assert.throws(()=>compileCanalHouseRecipe(r),/unobserved/);
});
test('risalit openings remain first-hit glazing in front of the projected backing',()=>{
 const r=fixture();r.elevations[0].blocks=m([{id:'risalit',leftM:.8,bottomM:1,widthM:2,heightM:6,depthM:.12,surface:'wall'}]);
 r.elevations[0].openings.value[0].projectionM=.12;
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[1.3,3.4,-5],[0,0,1])[0].object.userData.surface,'glass');
 r.elevations[0].openings.value[0].projectionM=1;assert.throws(()=>compileCanalHouseRecipe(r),/projection/);
});
test('layered cornice retains its observed band and rejects escaping profiles',()=>{
 const r=fixture();r.elevations[0].cornice=m({bottomM:7.7,heightM:.3,depthM:.2,brackets:0,layers:[{bottomM:7.7,heightM:.2,depthM:.08},{bottomM:7.9,heightM:.1,depthM:.22}]});
 const {group}=compileCanalHouseRecipe(r);assert.match(hit(group,[.5,7.95,-5],[0,0,1])[0].object.name,/cornice\/layer/);
 r.elevations[0].cornice.value.layers![0].heightM=1;assert.throws(()=>compileCanalHouseRecipe(r),/escapes/);
});
test('observed diagonal grille remains inside its pane and in front of the glass',()=>{
 const r=fixture(),o=r.elevations[0].openings.value[0];o.verticalBars=[];o.horizontalBars=[];o.diagonalBars=[[[.15,.1],[.8,.9]],[[.2,.9],[.8,.1]]];
 const {group}=compileCanalHouseRecipe(r);assert.match(hit(group,[1.665,4,-5],[0,0,1])[0].object.name,/grille/);
 o.diagonalBars=[[[0,.1],[.8,.9]]];assert.throws(()=>compileCanalHouseRecipe(r),/escapes pane/);
});
test('source-positioned cornice consoles have a sloping section instead of flat appliques',()=>{
 const r=fixture();r.elevations[0].cornice=m({bottomM:7.7,heightM:.3,depthM:.2,brackets:0,layers:[{bottomM:7.7,heightM:.3,depthM:.04}],accents:[{id:'visible-fragment',leftM:1,widthM:.3,bottomM:7.75,heightM:.2,depthM:.16,profile:'console'}]});
 const {group}=compileCanalHouseRecipe(r);const consoleHit=hit(group,[1.15,7.88,-5],[0,0,1])[0];assert.match(consoleHit.object.name,/cornice\/console/);assert(Math.abs(consoleHit.face!.normal.y)>.01);
 r.elevations[0].cornice.value.accents![0].bottomM=8;assert.throws(()=>compileCanalHouseRecipe(r),/escapes/);
});
test('light frame returns surround the glazing without filling the aperture',()=>{
 const r=fixture(),o=r.elevations[0].openings.value[0];o.frameDepthM=.12;
 const {group}=compileCanalHouseRecipe(r);
 const glass=hit(group,[1.3,3.4,-5],[0,0,1])[0],frame=hit(group,[1.03,3.4,-5],[0,0,1])[0];
 assert.equal(glass.object.userData.surface,'glass');assert.equal(frame.object.userData.surface,'trim');
 assert(frame.point.z<glass.point.z-.04);
 const innerSide=hit(group,[1.3,3.4,-.10],[-1,0,0])[0];assert.match(innerSide.object.name,/\/frame$/);
 o.frameDepthM=.5;assert.throws(()=>compileCanalHouseRecipe(r),/frame depth/);
});

test('souterrain apertures remain first-hit glazing inside a projecting stone plinth',()=>{
 const r=fixture();r.elevations[0].openings=m([
  {id:'low-left',kind:'window',leftM:.4,bottomM:.15,widthM:1.3,heightM:.65,trimWidthM:.06},
  {id:'low-middle',kind:'window',leftM:2.4,bottomM:.2,widthM:1.4,heightM:.7,trimWidthM:.06},
  {id:'lower-door',kind:'door',leftM:4.5,bottomM:.05,widthM:1,heightM:1.2,trimWidthM:.06},
 ]);
 r.elevations[0].bands=m([{id:'stone-plinth',leftM:0,bottomM:0,widthM:6,heightM:1.6,depthM:.12}]);
 const {group}=compileCanalHouseRecipe(r);
 for(const [x,y]of[[.8,.4],[2.8,.5]])assert.equal(hit(group,[x,y,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(hit(group,[4.8,.4,-5],[0,0,1])[0].object.userData.surface,'door');
 for(const [x,y]of[[.1,.4],[2,.5],[3,1.4]])assert.equal(hit(group,[x,y,-5],[0,0,1])[0].object.userData.surface,'trim');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
});

test('shallow basement window distinguishes stone, painted frame, recessed pane and cross framing',()=>{
 const r=fixture();r.palette.value.stone='#a6a49a';
 r.elevations[0].openings=m([{id:'basement',kind:'window',leftM:1,bottomM:.15,widthM:1.1,heightM:.42,trimWidthM:.034,frameDepthM:.08,paneOffsetM:.03,verticalBars:[.5],horizontalBars:[.5]}]);
 r.elevations[0].bands=m([{id:'base',leftM:0,bottomM:0,widthM:6,heightM:1.1,depthM:.06,surface:'stone'}]);
 const {group}=compileCanalHouseRecipe(r);
 const frame=group.getObjectByName('opening/basement/frame') as T.Mesh,pane=group.getObjectByName('opening/basement/pane') as T.Mesh;
 frame.geometry.computeBoundingBox();pane.geometry.computeBoundingBox();
 assert(pane.geometry.boundingBox!.max.z<.075);assert(frame.geometry.boundingBox!.max.z>.075);
 const stone=hit(group,[.3,.3,-5],[0,0,1])[0].object as T.Mesh;
 assert.equal(stone.userData.surface,'stone');assert.notEqual((stone.material as T.MeshStandardMaterial).color.getHex(),(frame.material as T.MeshStandardMaterial).color.getHex());
 assert.equal(hit(group,[1.3,.28,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(hit(group,[1.55,.28,-5],[0,0,1])[0].object.userData.surface,'trim');
});

test('projecting landing meets raised door without burying the lower entrance',()=>{
 const r=fixture();r.elevations[0].openings=m([
 {id:'main-door',kind:'door',leftM:1,bottomM:1.4,widthM:1.1,heightM:2,trimWidthM:.06},
 {id:'lower-door',kind:'door',leftM:1,bottomM:.05,widthM:1.1,heightM:1.2,trimWidthM:.06,paneOffsetM:.03},
 ]);r.elevations[0].landing=m({leftM:1,widthM:1.1,topM:1.4,depthM:.5,thicknessM:.04});
 const {group}=compileCanalHouseRecipe(r);assert.equal(hit(group,[1.3,.4,-5],[0,0,1])[0].object.userData.surface,'door');
 assert.equal(hit(group,[1.3,3,-.3],[0,-1,0])[0].object.name,'entrance/landing');
 r.elevations[0].landing.value.topM=2;assert.throws(()=>compileCanalHouseRecipe(r),/observed raised doorway/);
});

function approachFixture():CanalHouseRecipe{
 const r=fixture(),e=r.elevations[0];
 e.openings=m([
  {id:'main-door',kind:'door',leftM:1,bottomM:1.2,widthM:1,heightM:2,trimWidthM:.06},
  {id:'lower-door',kind:'door',leftM:1,bottomM:.05,widthM:1,heightM:1,trimWidthM:.06},
  {id:'low-window',kind:'window',leftM:3.4,bottomM:.5,widthM:.8,heightM:.8,trimWidthM:.05},
 ]);
 e.landing=m({leftM:1,widthM:1,topM:1.2,depthM:.5,thicknessM:.04});
 e.approach=m({topProfile:[[2,1.2],[2.3,1.2],[2.3,.95],[2.65,.95],[2.65,.7],[3,.7],[3,.45],[3.35,.45],[3.35,.2],[3.7,.2],[3.7,0]],groundM:0,backM:.02,depthM:.48,
  railProfile:[[2,2.1],[3.7,.9]],posts:[{xM:2.1,bottomM:1.2,topM:2.03},{xM:3.7,bottomM:0,topM:.9}],railWidthM:.035,postWidthM:.04});
 return r;
}
test('source descending approach joins landing while preserving low doors and space above its contour',()=>{
 const r=approachFixture(),{group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[2.1,.8,-5],[0,0,1])[0].object.name,'entrance/approach');
 assert.equal(hit(group,[1.5,.5,-5],[0,0,1])[0].object.name,'opening/lower-door/pane');
 // Its bounding rectangle overlaps this window; the actual stepped polygon does not.
 assert.equal(hit(group,[3.8,.7,-5],[0,0,1])[0].object.name,'opening/low-window/pane');
 const rail=hit(group,[2.85,1.5,-5],[0,0,1])[0];assert.equal(rail.object.name,'entrance/approach/rail-0');assert.equal(rail.object.userData.surface,'door');
 assert.equal(hit(group,[2.1,1.7,-5],[0,0,1])[0].object.name,'entrance/approach/post-0');
 const flight=group.getObjectByName('entrance/approach') as T.Mesh;flight.geometry.computeBoundingBox();assert(Math.abs(flight.geometry.boundingBox!.max.z-.5)<1e-6);assert(Math.abs(flight.geometry.boundingBox!.min.z-.02)<1e-6);
 assert(Math.abs(hit(group,[2.1,5,-.3],[0,-1,0])[0].point.y-1.2)<1e-6);
});
test('source ascending approach and rail-only observations compile without guessed steps',()=>{
 const r=approachFixture(),s=r.elevations[0].approach!.value;
 s.topProfile=s.topProfile!.map(([x,y])=>[6-x,y] as [number,number]).reverse();s.railProfile=[];s.posts=[];
 r.elevations[0].landing!.value.leftM=4;r.elevations[0].openings.value=r.elevations[0].openings.value.filter(o=>o.kind==='door');for(const o of r.elevations[0].openings.value)o.leftM=4;
 assert.doesNotThrow(()=>compileCanalHouseRecipe(r));
 const railOnly=approachFixture();railOnly.elevations[0].approach!.value.topProfile=null;railOnly.elevations[0].landing=undefined;
 const {group}=compileCanalHouseRecipe(railOnly);assert.equal(group.getObjectByName('entrance/approach'),undefined);assert(group.getObjectByName('entrance/approach/rail-0'));assert.equal(hit(group,[2.85,1.5,-5],[0,0,1])[0].object.userData.surface,'door');
});
test('opposed flights reuse one landing and leave its basement door visible',()=>{
 const r=approachFixture(),e=r.elevations[0],right=structuredClone(e.approach!.value);
 e.openings.value=e.openings.value.filter(o=>o.kind==='door');
 for(const o of e.openings.value)o.leftM=2.5;
 e.landing!.value.leftM=2.5;
 right.topProfile=right.topProfile!.map(([x,y])=>[x+1.5,y]);
 right.railProfile=right.railProfile.map(([x,y])=>[x+1.5,y]);
 right.posts=right.posts.map(p=>({...p,xM:p.xM+1.5}));
 const left=structuredClone(right);
 left.topProfile=left.topProfile!.map(([x,y])=>[6-x,y] as [number,number]).reverse();
 left.railProfile=left.railProfile.map(([x,y])=>[6-x,y] as [number,number]).reverse();
 left.posts=left.posts.map(p=>({...p,xM:6-p.xM}));
 delete e.approach;
 e.approaches=[{id:'left',assembly:m(left)},{id:'right',assembly:m(right)}];
 const {group}=compileCanalHouseRecipe(r);
 assert.equal(hit(group,[2.25,.8,-5],[0,0,1])[0].object.name,'entrance/approach/left');
 assert.equal(hit(group,[3.75,.8,-5],[0,0,1])[0].object.name,'entrance/approach/right');
 assert.equal(hit(group,[3,.5,-5],[0,0,1])[0].object.name,'opening/lower-door/pane');
 assert.equal(hit(group,[3,3,-.3],[0,-1,0])[0].object.name,'entrance/landing');
 assert(group.getObjectByName('entrance/approach/left/rail-0'));
 assert(group.getObjectByName('entrance/approach/right/rail-0'));
 const original=structuredClone(e.approaches);
 e.approach=m(right);assert.throws(()=>compileCanalHouseRecipe(r),/not both/);delete e.approach;
 e.approaches[1].id='left';assert.throws(()=>compileCanalHouseRecipe(r),/duplicate approach/);
 e.approaches=structuredClone(original);e.approaches[0].assembly=defaulted(left);assert.throws(()=>compileCanalHouseRecipe(r),/unobserved/);
 e.approaches=structuredClone(original);e.approaches[0].assembly.value.topProfile!.at(-1)![0]+=.1;
 assert.throws(()=>compileCanalHouseRecipe(r),/join its source landing/);
 e.approaches=structuredClone(original);e.approaches[0].assembly=m(right);
 assert.throws(()=>compileCanalHouseRecipe(r),/Overlapping solid/);
 for(const id of [null,undefined,0]){
  e.approaches=structuredClone(original);Object.assign(e.approaches[0],{id});
  assert.throws(()=>compileCanalHouseRecipe(r),/Invalid or duplicate approach/);
 }
});
test('absent approach retains legacy shell, plinth and entrance geometry',()=>{
 const r=approachFixture();delete r.elevations[0].approach;
 r.elevations[0].bands=m([{id:'base',leftM:0,bottomM:0,widthM:6,heightM:1.1,depthM:.08,surface:'stone'}]);
 const before=compileCanalHouseRecipe(r);r.elevations[0].approach=undefined;const after=compileCanalHouseRecipe(r);
 assert.deepEqual(after.stats,before.stats);
 assert.equal(after.group.getObjectByName('entrance/approach'),undefined);assert.equal(hit(after.group,[1.5,.5,-5],[0,0,1])[0].object.name,'opening/lower-door/pane');
});
test('approach refuses oversized risers, unconnected landing, invalid rails and unsupported dimensions',()=>{
 const changes=[
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.topProfile![2][1]=.8;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.topProfile![0][0]=2.1;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.topProfile![0][1]=1.18;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.topProfile![5][1]=.8;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.backM=-.01;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.depthM=1.51;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.railWidthM=.11;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.groundM=-.01;},
  (s:NonNullable<CanalHouseRecipe['elevations'][number]['approach']>['value'])=>{s.railProfile[1][0]=NaN;},
 ];
 for(const change of changes){const r=approachFixture();change(r.elevations[0].approach!.value);assert.throws(()=>compileCanalHouseRecipe(r),/approach|Approach/);}
 const unknown=approachFixture();unknown.elevations[0].approach=defaulted(unknown.elevations[0].approach!.value);assert.throws(()=>compileCanalHouseRecipe(unknown),/unobserved/);
});
test('genuine source-observed flight occlusion requires explicit matching opening IDs',()=>{
 const r=approachFixture();r.elevations[0].openings.value.push({id:'under-flight',kind:'window',leftM:2.4,bottomM:.1,widthM:.4,heightM:.5,trimWidthM:.04});
 assert.throws(()=>compileCanalHouseRecipe(r),/source acknowledgement: under-flight/);
 r.elevations[0].approach!.value.occludedOpeningIds=['under-flight'];const {group}=compileCanalHouseRecipe(r);assert.equal(hit(group,[2.5,.3,-5],[0,0,1])[0].object.name,'entrance/approach');
 r.elevations[0].approach!.value.occludedOpeningIds=['missing'];assert.throws(()=>compileCanalHouseRecipe(r),/Unknown/);
});

test('correcting an obscured pavement datum rebases the whole facade without moving source pixels',async()=>{
 const {rebaseFacadeDatum}=await import('../../scripts/canalhouse-recipes/facade-datum.ts');
 const note={facadeScreenQuad:{yGround:759,yEaves:489},openings:[{bottom:23/270,height:75/270}],door:{bottom:17/270,height:46/270},horizontalBands:[{label:'stone basement/plinth',bottom:0,height:23/270}],crown:{profileNormalized:[[0,1],[.5,343/270],[1,1]]}};
 const lower={facadeScreenQuad:{yGround:759,yEaves:489},openings:[{left:.3,bottom:-18/270,width:.2,height:30/270}]};
 const result=rebaseFacadeDatum(note,lower,785),height=785-489;
 assert.equal(note.facadeScreenQuad.yGround,759);assert.equal(lower.openings[0].bottom,-18/270);
 const window=result.note.openings[0];assert(Math.abs((785-window.bottom*height)-736)<1e-8);assert(Math.abs(window.height*height-75)<1e-8);
 assert(Math.abs((785-result.note.door.bottom*height)-742)<1e-8);
 assert(Math.abs((785-result.note.crown.profileNormalized[1][1]*height)-416)<1e-8);
 assert.equal(result.note.horizontalBands[0].bottom,0);assert(Math.abs(result.note.horizontalBands[0].height*height-49)<1e-8);
 assert(result.lower.openings[0].bottom>0);assert(Math.abs(result.lower.openings[0].height*height-30)<1e-8);
 assert.throws(()=>rebaseFacadeDatum(note,lower,900),/Unsupported/);
});


test('raised list crowns reuse cap controls while plain list defaults stay flat',()=>{
 assert.deepEqual(canalhouseCrownProfile('lijst',6,8,11,2,9,3),[[0,8],[6,8]]);
 for(const cap of ['rounded','pediment','flat'] as const){
  const points=canalhouseCrownProfile('lijst',6,8,8.6,2,8,1,{cap,capRiseM:cap==='flat'?0:.6,crestWidthM:2});
  assert.deepEqual(points[0],[0,8]);assert.deepEqual(points.at(-1),[6,8]);
  assert.equal(Math.max(...points.map(p=>p[1])),8.6);
  assert(points.every(([x,y],i)=>x>=0&&x<=6&&y>=8&&y<=8.6&&(i===0||x>=points[i-1][0])));
 }
});
test('crown surface selection changes visible fill without burying glazing',()=>{
 for(const surface of ['wall','trim','stone'] as const){
  const r=fixture();r.elevations[0].crown!.value.surface=surface;
  const {group}=compileCanalHouseRecipe(r);
  assert.equal(hit(group,[3,9,-5],[0,0,1])[0].object.userData.surface,surface);
  assert.equal(hit(group,[1.35,3.4,-5],[0,0,1])[0].object.userData.surface,'glass');
 }
 const r=fixture();r.elevations[0].crown!.value.surface='glass' as never;
 assert.throws(()=>compileCanalHouseRecipe(r),/Unsupported crown surface/);
});


test('front flights attach to a landing with shared approximate or observed stairs and optional side rails',()=>{
 for(const width of [1,2])for(const mode of ['observed','approximate'] as const){
  const r=fixture(),e=r.elevations[0];
  e.openings=m([{id:'door',kind:'door',leftM:1,bottomM:1.2,widthM:width,heightM:2,trimWidthM:.08}]);
  e.landing=m({leftM:1,widthM:width,topM:1.2,depthM:.6,thicknessM:.07});
  e.entrance=m({leftM:1,widthM:width,riseM:1.2,runM:1.5,attachToLanding:true,surface:'stone',...(mode==='observed'?{steps:6}:{approximateRiserM:.2}),rails:{heightM:.8,widthM:.04,sides:['left','right']}});
  const {group}=compileCanalHouseRecipe(r);
  const step=hit(group,[1+width/2,4,-.75],[0,-1,0])[0];assert.equal(step.object.name,'entrance/step');assert.equal(step.object.userData.surface,'stone');
  const rail=hit(group,[1.02,4,-1.365],[0,-1,0])[0];assert.equal(rail.object.name,'entrance/front-rail/left');assert(Math.abs(rail.point.y-1.4)<.04);
  assert.equal(hit(group,[1+width/2,2,-5],[0,0,1])[0].object.userData.surface,'door');
  e.entrance!.value.riseM=1.4;assert.throws(()=>compileCanalHouseRecipe(r),/meet its observed landing/);
 }
 const r=fixture();r.elevations[0].entrance=m({leftM:1,widthM:1,riseM:1,runM:1,steps:5,approximateRiserM:.2});
 assert.throws(()=>compileCanalHouseRecipe(r),/observed count or approximate/);
});


test('principal facade plane admits bounded native inward insets without flattening courts or accepting outward fins',()=>{
 const r=fixture(),e=r.elevations[0];
 const polygon={outer:[[0,0],[2,0],[2,.5],[2.6,.5],[2.6,0],[6,0],[6,10],[0,10]] as [number,number][],holes:r.footprint.value[0].holes};
 r.footprint=m([polygon]);r.roof.value[0].polygon=polygon;e.endEdgeIndex=5;
 e.openings=m([{id:'inset-window',kind:'window',leftM:2.02,bottomM:2,widthM:.55,heightM:1.5,trimWidthM:.05}]);
 assert.throws(()=>compileCanalHouseRecipe(r),/straight surveyed wall/);
 e.frontagePlan=m({maxInsetM:.55});const before=structuredClone(r.footprint.value),{group}=compileCanalHouseRecipe(r);
 assert.deepEqual(r.footprint.value,before);
 assert.equal(hit(group,[2.3,2.5,-5],[0,0,1])[0].object.userData.surface,'glass');
 assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 const glass=hit(group,[2.3,2.5,-5],[0,0,1])[0];assert(glass.point.z<0&&glass.point.z>-.1);
 e.frontagePlan!.value.maxInsetM=.4;assert.throws(()=>compileCanalHouseRecipe(r),/straight surveyed wall/);
 e.frontagePlan!.value.maxInsetM=.55;polygon.outer[2][1]=-.5;polygon.outer[3][1]=-.5;
 assert.throws(()=>compileCanalHouseRecipe(r),/straight surveyed wall/);
});

test('explicit shallow source outsets keep glazing visible and preserve native courtyard geometry',()=>{
 const r=fixture(),e=r.elevations[0],polygon={outer:[[0,0],[2,0],[2,-.12],[2.6,-.12],[2.6,0],[6,0],[6,10],[0,10]] as [number,number][],holes:r.footprint.value[0].holes};
 r.footprint=m([polygon]);r.roof.value[0].polygon=polygon;e.endEdgeIndex=5;
 e.openings=m([{id:'return-window',kind:'window',leftM:2.02,bottomM:2,widthM:.55,heightM:1.5,trimWidthM:.05}]);
 e.frontagePlan=m({maxInsetM:.2});assert.throws(()=>compileCanalHouseRecipe(r),/straight surveyed wall/);
 const before=structuredClone({footprint:r.footprint.value,roof:r.roof.value});
 e.frontagePlan.value.maxOutsetM=.13;const {group}=compileCanalHouseRecipe(r);
 const glass=hit(group,[2.3,2.5,-5],[0,0,1])[0];assert.equal(glass.object.userData.surface,'glass');assert(glass.point.z<-.12&&glass.point.z>-.22);
 assert.deepEqual({footprint:r.footprint.value,roof:r.roof.value},before);assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 e.frontagePlan.value.maxOutsetM=.1;assert.throws(()=>compileCanalHouseRecipe(r),/straight surveyed wall/);
 for(const invalid of [.31,-.01,NaN]){e.frontagePlan.value.maxOutsetM=invalid;assert.throws(()=>compileCanalHouseRecipe(r),/facade outset/);}
});

test('source-selected dormer setbacks move the complete assembly and keep footprint guards',()=>{
 for(const setback of [0,.25,.8]){
  const r=fixture(),e=r.elevations[0];delete e.crown;
  e.dormers=m([{id:'attic',leftM:1,widthM:1.4,bottomM:8.2,heightM:1.2,depthM:.6,roofRiseM:.3,setbackM:setback}]);
  const {group}=compileCanalHouseRecipe(r),pane=hit(group,[1.4,8.7,-5],[0,0,1])[0];
  assert.equal(pane.object.name,'dormer/attic/pane');assert(Math.abs(pane.point.z-(setback-.08))<1e-5);
  e.dormers!.value[0].setbackM=3;assert.throws(()=>compileCanalHouseRecipe(r),/setback/);
 }
 const r=fixture();delete r.elevations[0].crown;r.elevations[0].dormers=m([{id:'attic',leftM:2.2,widthM:1.4,bottomM:8.2,heightM:1.2,depthM:.8,roofRiseM:.3,setbackM:1.8}]);
 // Source placement cannot migrate a dormer through the existing courtyard.
 r.elevations[0].dormers.value[0].setbackM=1.9;
 r.elevations[0].dormers.value[0].depthM=2.8;
 assert.throws(()=>compileCanalHouseRecipe(r),/courtyard|footprint/);
});

test('native host apertures expose set-back dormers while preserving adjacent wall and courtyard',()=>{
 for(const [left,width,setback]of [[1,1.4,.25],[3.5,1.2,.6]]){
  const r=fixture(),e=r.elevations[0];delete e.crown;r.roof.value[0].plane.heightM=10;
  e.dormers=m([{id:'attic',leftM:left,widthM:width,bottomM:8.2,heightM:1.2,depthM:.6,roofRiseM:.3,setbackM:setback}]);
  const before=compileCanalHouseRecipe(r).group;
  assert.equal(hit(before,[left+width*.24,8.5,-5],[0,0,1])[0].object.userData.surface,'wall');
  e.dormers.value[0].hostAperture={depthM:setback+.15};const polygons=structuredClone(r.footprint.value),roofs=structuredClone(r.roof.value),{group}=compileCanalHouseRecipe(r);
  for(const x of [.24,.43,.76])for(const y of [.2,.4,.8])assert.equal(hit(group,[left+width*x,8.2+1.2*y,-5],[0,0,1])[0].object.name,'dormer/attic/pane');
  assert.equal(hit(group,[.3,9,-5],[0,0,1])[0].object.userData.surface,'wall');
  assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
  assert.deepEqual(r.footprint.value,polygons);assert.deepEqual(r.roof.value,roofs);
  e.dormers.value[0].hostAperture.depthM=.05;assert.throws(()=>compileCanalHouseRecipe(r),/cover its observed dormer setback/);
 }
 const r=fixture();delete r.elevations[0].crown;r.elevations[0].dormers=m([{id:'no-host',leftM:1,widthM:1,bottomM:8.2,heightM:1,depthM:.6,roofRiseM:.2,setbackM:.25,hostAperture:{depthM:.4}}]);
 assert.throws(()=>compileCanalHouseRecipe(r),/no matching host wall/);
});

test('source-selected glass tint changes only its pane and keeps opaque leaves guarded',()=>{
 const r=fixture(),e=r.elevations[0];e.openings.value.push({...e.openings.value[0],id:'other',leftM:4});e.openings.value[0].paneTint='#8b8c70';
 const {group}=compileCanalHouseRecipe(r),first=hit(group,[1.3,3.4,-5],[0,0,1])[0].object as T.Mesh,other=hit(group,[4.3,3.4,-5],[0,0,1])[0].object as T.Mesh;
 assert.equal(first.userData.surface,'glass');assert.equal((first.material as T.MeshStandardMaterial).color.getHexString(),'8b8c70');assert.equal((other.material as T.MeshStandardMaterial).color.getHexString(),'233a43');
 e.openings.value[0].paneTint='olive';assert.throws(()=>compileCanalHouseRecipe(r),/Pane tint/);e.openings.value[0].paneTint='#8b8c70';e.openings.value[0].kind='door';assert.throws(()=>compileCanalHouseRecipe(r),/Pane tint/);
});
test('dormer cheeks and caps select shared surfaces independently while legacy defaults remain',()=>{
 for(const selected of [false,true]){
  const r=fixture(),e=r.elevations[0];delete e.crown;e.dormers=m([{id:'attic',leftM:1,widthM:1.4,bottomM:8.2,heightM:1.2,depthM:.8,roofRiseM:.2,...(selected?{wallSurface:'trim' as const,roofSurface:'trim' as const}:{})}]);
  const {group}=compileCanalHouseRecipe(r);for(const [name,expected] of [['left-wall',selected?'trim':'wall'],['front-gable',selected?'trim':'wall'],['roof',selected?'trim':'roof']])assert.equal(group.getObjectByName('dormer/attic/'+name)!.userData.surface,expected);
  assert.equal(hit(group,[1.4,8.7,-5],[0,0,1])[0].object.name,'dormer/attic/pane');assert.equal(hit(group,[3,30,5],[0,-1,0]).length,0);
 }
});

test('pitched dormer end solids stay below their explicit roof instead of exposing coplanar pale lips',()=>{
 const r=fixture(),e=r.elevations[0];delete e.crown;e.dormers=m([{id:'attic',leftM:1,widthM:1.4,bottomM:8.2,heightM:1.2,depthM:.8,roofRiseM:.2,wallSurface:'trim'}]);
 const {group}=compileCanalHouseRecipe(r);
 for(const name of ['front-gable','back-gable']){const mesh=group.getObjectByName('dormer/attic/'+name) as T.Mesh,p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const roofY=9.4+.2*(1-Math.abs(p.getX(i)-1.7)/.7);assert.ok(roofY-p.getY(i)>.0049);}
 }
 const topHit=hit(group,[1.5,12,.4],[0,-1,0])[0];assert.equal(topHit.object.name,'dormer/attic/roof');
});

test('dormer front overhang exposes the pale head at a low street angle and preserves its back and native plan',()=>{
 const r=fixture(),e=r.elevations[0];delete e.crown;
 e.dormers=m([{id:'attic',leftM:1,widthM:1.4,bottomM:8.2,heightM:1.2,depthM:.8,roofRiseM:.2,wallSurface:'trim',roofSurface:'trim'}]);
 const baseline=compileCanalHouseRecipe(r).group;baseline.updateMatrixWorld(true);
 const extended=structuredClone(r);extended.elevations[0].dormers!.value[0].frontOverhangM=.22;
 const group=compileCanalHouseRecipe(extended).group;group.updateMatrixWorld(true);
 const positions=(g:T.Group,name:string)=>Array.from(((g.getObjectByName(name) as T.Mesh).geometry.getAttribute('position') as T.BufferAttribute).array);
 for(const name of ['dormer/attic/back-wall','dormer/attic/back-gable','dormer/attic/pane'])assert.deepEqual(positions(group,name),positions(baseline,name));
 assert.deepEqual(extended.footprint,r.footprint);assert.deepEqual(extended.roof,r.roof);
 const from=new T.Vector3(1.3,2.5,-5),target=new T.Vector3(1.3,9.425,-.18),direction=target.clone().sub(from).normalize();
 const repaired=new T.Raycaster(from,direction).intersectObject(group,true)[0];
 assert.equal(repaired.object.name,'dormer/attic/front-gable');assert.equal(repaired.object.userData.surface,'trim');
 const before=new T.Raycaster(from,direction).intersectObject(baseline,true)[0];assert.notEqual(before?.object.name,'dormer/attic/front-gable');
 const zero=structuredClone(r);zero.elevations[0].dormers!.value[0].frontOverhangM=0;const legacy=compileCanalHouseRecipe(zero).group;
 for(const name of ['dormer/attic/roof','dormer/attic/front-gable','dormer/attic/back-gable'])assert.deepEqual(positions(legacy,name),positions(baseline,name));
 for(const frontOverhangM of [-.01,.301,NaN]){const invalid=structuredClone(r);invalid.elevations[0].dormers!.value[0].frontOverhangM=frontOverhangM;assert.throws(()=>compileCanalHouseRecipe(invalid),/overhang|finite/);}
 const flat=structuredClone(extended);flat.elevations[0].dormers!.value[0].roofRiseM=0;const f=compileCanalHouseRecipe(flat).group;f.updateMatrixWorld(true);assert.equal(hit(f,[1.5,12,-.15],[0,-1,0])[0].object.name,'dormer/attic/roof');
});


test('source-painted window joinery stays independent of red or blue entry paint without changing geometry',()=>{
 for(const door of ['#a33222','#224488']){
  const r=fixture();r.palette.value.door=door;r.palette.value.joinery='#25302d';
  const o=r.elevations[0].openings.value[0];o.frameSurface='joinery';o.barSurface='joinery';
  r.elevations[0].openings.value.push({...o,id:'entry',kind:'door',leftM:3.6,bottomM:0,heightM:2.5,frameSurface:'door',barSurface:'door'});
  const {group,stats}=compileCanalHouseRecipe(r);
  const windowMeshes:T.Mesh[]=[],doorMeshes:T.Mesh[]=[];
  group.traverse(v=>{if(v instanceof T.Mesh){if(v.name.startsWith('opening/window/')&&v.userData.surface==='joinery')windowMeshes.push(v);if(v.name.startsWith('opening/entry/')&&v.userData.surface==='door')doorMeshes.push(v);}});
  assert.ok(windowMeshes.length&&doorMeshes.length);
  for(const mesh of windowMeshes)assert.equal((mesh.material as T.MeshStandardMaterial).color.getHexString(),'25302d');
  for(const mesh of doorMeshes)assert.equal((mesh.material as T.MeshStandardMaterial).color.getHexString(),door.slice(1));
  delete r.palette.value.joinery;const fallback=compileCanalHouseRecipe(r);assert.equal(fallback.stats.triangles,stats.triangles);
  fallback.group.traverse(v=>{if(v instanceof T.Mesh&&v.userData.surface==='joinery')assert.equal((v.material as T.MeshStandardMaterial).color.getHexString(),r.palette.value.trim.slice(1));});
 }
});
