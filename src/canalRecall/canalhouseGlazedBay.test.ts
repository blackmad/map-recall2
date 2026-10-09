import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {canalhouseGlazedBay,type CanalhouseGlazedBay} from './canalhouseGlazedBay.ts';

const materials={wall:new T.MeshBasicMaterial(),frame:new T.MeshBasicMaterial(),glass:new T.MeshBasicMaterial()};
const sample=():CanalhouseGlazedBay=>({id:'synthetic-bay',widthM:3,frontWidthM:2,depthM:1,heightM:3,lowerPanelM:.4,upperPanelM:.4,frameWidthM:.08,frameDepthM:.06,glassDepthM:.02,capM:.05,verticalBars:[.5],horizontalBars:[.7]});
function hit(group:T.Group,origin:number[],target:number[]){group.updateMatrixWorld(true);const p=new T.Vector3(origin[0],origin[1],origin[2]),direction=new T.Vector3(target[0],target[1],target[2]).sub(p).normalize();return new T.Raycaster(p,direction).intersectObject(group,true)[0]?.object.userData.role;}

test('front and both oblique returns expose glass with frame and masonry first hits',()=>{
 const group=canalhouseGlazedBay(sample(),materials);
 assert.equal(hit(group,[1,1.3,5],[1,1.3,1]),'glass');
 assert.equal(hit(group,[-3,1.3,2],[.175,1.3,.35]),'glass');
 assert.equal(hit(group,[6,1.3,2],[2.825,1.3,.35]),'glass');
 assert.equal(hit(group,[.54,1.3,5],[.54,1.3,1]),'frame');
 assert.equal(hit(group,[1.5,1.3,5],[1.5,1.3,1]),'frame');
 assert.equal(hit(group,[1,.2,5],[1,.2,1]),'wall');
 assert.equal(hit(group,[1.5,6,.5],[1.5,3,.5]),'wall');
 // Inside the bay, the first surface towards a pane is still glass.
 assert.equal(hit(group,[1,1.3,.5],[1,1.3,2]),'glass');
});
test('rectangular and splayed width/depth variants remain hollow and accept placement',()=>{
 for(const [widthM,frontWidthM,depthM] of [[2,2,.4],[4,2.8,.7],[1.6,1.2,.3]]){
  const group=canalhouseGlazedBay({...sample(),widthM,frontWidthM,depthM,leftM:5,bottomM:2,outwardM:.1},materials);
  const x=5+widthM/2-frontWidthM*.2,z=.1+depthM;
  assert.equal(hit(group,[x,3.3,z+4],[x,3.3,z]),'glass');
  const inset=(widthM-frontWidthM)/2;
  assert.equal(hit(group,[2,3.3,.1+depthM],[5+inset*.35,3.3,.1+depthM*.35]),'glass');
 }
});
test('fractional face apertures preserve visible masonry beside recessed panes',()=>{
 const group=canalhouseGlazedBay({...sample(),windowRect:[.1,.1,.8,.8],verticalBars:[],horizontalBars:[],faces:{left:{windowRect:[.2,0,.6,1]}}},materials);
 assert.equal(hit(group,[1.5,1.3,5],[1.5,1.3,1]),'glass');
 assert.equal(hit(group,[.6,1.3,5],[.6,1.3,1]),'wall');
});
test('rejects impossible dimensions and aperture/frame bounds',()=>{
 for(const patch of [{widthM:NaN},{depthM:0},{frontWidthM:4},{upperPanelM:3},{capM:.5},{outwardM:Infinity},{frameWidthM:.7},{windowRect:[0,0,2,1]},{verticalBars:[1]}]){
  assert.throws(()=>canalhouseGlazedBay({...sample(),...patch} as CanalhouseGlazedBay,materials),/Glazed bay|glazed bay/);
 }
});
