import {Vector3} from 'three';

/** Municipal horizontal station position and panorama rays. Eye height is explicit
 * drawing data because panorama GPS altitude is not a pavement-relative height. */
export function canalhouseReferenceCamera(source:{cameraRD:readonly[number,number];cameraHeightM:number;headingDeg:number;pitchDeg:number;fovDeg:number},origin:readonly[number,number],aspect:number){
 if([...source.cameraRD,source.cameraHeightM,source.headingDeg,source.pitchDeg,source.fovDeg,...origin,aspect].some(v=>!Number.isFinite(v))||aspect<=0||source.fovDeg<=0||source.fovDeg>=180)throw Error('Invalid panorama comparison camera');
 const yaw=source.headingDeg*Math.PI/180,pitch=source.pitchDeg*Math.PI/180;
 const position=new Vector3(source.cameraRD[0]-origin[0],source.cameraHeightM,origin[1]-source.cameraRD[1]);
 const forward=new Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
 return{position,target:position.clone().addScaledVector(forward,50),fovDeg:2*Math.atan(Math.tan(source.fovDeg*Math.PI/360)/aspect)*180/Math.PI};
}
