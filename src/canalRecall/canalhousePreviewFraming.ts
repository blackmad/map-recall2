import {Box3, Vector3} from 'three';

/** Fit native row bounds in the current perspective viewport without moving houses. */
export function frameCanalhouseRow(bounds:Box3, outward:Vector3, fovDeg:number, aspect:number){
 if(bounds.isEmpty()||!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(fovDeg)||fovDeg<=0||fovDeg>=180)throw Error('Invalid row framing bounds or viewport');
 const eye=outward.clone().normalize();
 const right=new Vector3(0,1,0).cross(eye).normalize();
 if(right.lengthSq()<.5)throw Error('Row framing needs a street-facing direction');
 const up=eye.clone().cross(right).normalize(),target=bounds.getCenter(new Vector3());
 const vertical=Math.tan(fovDeg*Math.PI/360),horizontal=vertical*aspect;
 let distance=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const offset=new Vector3(x,y,z).sub(target);
  distance=Math.max(distance,offset.dot(eye)+1.08*Math.max(Math.abs(offset.dot(right))/horizontal,Math.abs(offset.dot(up))/vertical));
 }
 return{target,position:target.clone().addScaledVector(eye,Math.max(1,distance))};
}

/** Keep a street-level eye while fitting the row; tall bounds must not lift the camera. */
export function frameCanalhouseRowFromStreet(bounds:Box3,outward:Vector3,fovDeg:number,aspect:number,eyeHeightM=2.5){
 if(!Number.isFinite(eyeHeightM))throw Error('Invalid street eye height');
 const horizontal=outward.clone().setY(0).normalize();
 let fitted=frameCanalhouseRow(bounds,horizontal,fovDeg,aspect);
 for(let i=0;i<12;i++){
  const run=Math.hypot(fitted.position.x-fitted.target.x,fitted.position.z-fitted.target.z);
  const direction=horizontal.clone().multiplyScalar(run).setY(eyeHeightM-fitted.target.y);
  fitted=frameCanalhouseRow(bounds,direction,fovDeg,aspect);
 }
 fitted.position.y=eyeHeightM;
 return fitted;
}
