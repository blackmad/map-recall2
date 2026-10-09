import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,PerspectiveCamera,Vector3} from 'three';
import {frameCanalhouseRow,frameCanalhouseRowFromStreet} from './canalhousePreviewFraming.ts';
import {canalhouseReferenceCamera} from './canalhouseReferenceCamera.ts';

test('native row corners stay in portrait, landscape and oblique perspective frames',()=>{
 const bounds=new Box3(new Vector3(-40,0,-18),new Vector3(45,21,9));
 for(const aspect of [.6,1,2.4])for(const direction of [new Vector3(0,0,1),new Vector3(.6,.12,1)]){
  const frame=frameCanalhouseRow(bounds,direction,45,aspect),camera=new PerspectiveCamera(45,aspect,.1,2000);
  camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   const p=new Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1,JSON.stringify({aspect,p}));
  }
 }
});

test('landscape row framing uses available width rather than a fixed world-distance multiplier',()=>{
 const bounds=new Box3(new Vector3(-40,0,-10),new Vector3(40,20,0));
 const portrait=frameCanalhouseRow(bounds,new Vector3(0,0,1),45,.6),landscape=frameCanalhouseRow(bounds,new Vector3(0,0,1),45,2);
 assert.ok(landscape.position.distanceTo(landscape.target)<portrait.position.distanceTo(portrait.target)/2);
 assert.ok(landscape.position.distanceTo(landscape.target)<80*1.7);
});

test('street row fits without lifting the eye above the facades',()=>{
 const bounds=new Box3(new Vector3(-40,0,-18),new Vector3(45,21,9));
 for(const aspect of [.6,1,2.4])for(const direction of [new Vector3(0,0,1),new Vector3(.6,0,1)]){
  const frame=frameCanalhouseRowFromStreet(bounds,direction,45,aspect);assert.equal(frame.position.y,2.5);
  const camera=new PerspectiveCamera(45,aspect,.1,2000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
   const p=new Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1);
  }
 }
});

test('panorama station preserves RD placement and horizontal photo field of view',()=>{
 for(const aspect of [.6,1,1.5,2.4]){
  const frame=canalhouseReferenceCamera({cameraRD:[121020,486980],cameraHeightM:2.5,headingDeg:90,pitchDeg:0,fovDeg:72},[121000,487000],aspect);
  assert.deepEqual(frame.position.toArray(),[20,2.5,20]);
  const camera=new PerspectiveCamera(frame.fovDeg,aspect,.1,2000);camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();
  const middle=new Vector3(70,2.5,20).project(camera);assert.ok(Math.abs(middle.x)<1e-10&&Math.abs(middle.y)<1e-10);
  const extent=50*Math.tan(36*Math.PI/180);
  for(const sign of [-1,1]){const edge=new Vector3(70,2.5,20+sign*extent).project(camera);assert.ok(Math.abs(Math.abs(edge.x)-1)<1e-10);}
 }
 assert.throws(()=>canalhouseReferenceCamera({cameraRD:[NaN,0],cameraHeightM:2.5,headingDeg:0,pitchDeg:0,fovDeg:72},[0,0],1),/Invalid/);
});
