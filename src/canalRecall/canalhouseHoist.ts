import * as T from 'three';
import {isCanalhouseComponentId} from './canalhouseComponentIds.ts';

/** Source-selected beam; dimensions and rise are drawing inputs, not inferred machinery. */
export interface CanalhouseHoist {
 id:string;centerM:number;heightM:number;widthM:number;beamHeightM:number;
 projectionM:number;setbackM?:number;endRiseM?:number;surface:'door'|'trim';
}
/** Facade-local +Z points into the street. Beam cross-section follows its axis. */
export function canalhouseHoistGeometry(beam:CanalhouseHoist,frontageWidthM:number):T.BufferGeometry {
 const {centerM,heightM,widthM,beamHeightM,projectionM}=beam,setbackM=beam.setbackM??0,endRiseM=beam.endRiseM??0;
 if(!isCanalhouseComponentId(beam.id)||![centerM,heightM,widthM,beamHeightM,projectionM,setbackM,endRiseM,frontageWidthM].every(Number.isFinite)||heightM<0||widthM<=0||beamHeightM<=0||projectionM<=0||projectionM>3||setbackM<0||setbackM>3||Math.abs(endRiseM)>projectionM+setbackM||centerM-widthM/2<0||centerM+widthM/2>frontageWidthM||!['door','trim'].includes(beam.surface))throw Error('Invalid observed hoist beam');
 const start=new T.Vector3(centerM,heightM,-setbackM),end=new T.Vector3(centerM,heightM+endRiseM,projectionM),axis=end.clone().sub(start);
 const orientation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),axis.clone().normalize());
 const matrix=new T.Matrix4().compose(start.clone().add(end).multiplyScalar(.5),orientation,new T.Vector3(1,1,1));
 return new T.BoxGeometry(widthM,beamHeightM,axis.length()).applyMatrix4(matrix);
}
