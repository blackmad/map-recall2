/** Source RD metres → map projection basis, without changing model scale. */
import {rdToLngLat} from '../facade/rdNew';
import type {HorizontalProjectionBasis} from './signaturePlacement';

export interface SourceRDFrame {
  readonly anchorRD: readonly [number,number];
  readonly xAxisRD: readonly [number,number];
  readonly yAxisRD: readonly [number,number];
}
interface MercatorPoint {x:number;y:number;meterInMercatorCoordinateUnits():number}
interface MercatorFactory {fromLngLat(point:[number,number],altitude?:number):MercatorPoint}

export function rdProjectionBasis(frame:SourceRDFrame,mercator:MercatorFactory):HorizontalProjectionBasis {
  if(!mercator?.fromLngLat)throw new Error('RD projection requires MapLibre MercatorCoordinate');
  const pairs=[frame.anchorRD,frame.xAxisRD,frame.yAxisRD];
  if(pairs.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw new Error('Invalid source RD frame');
  const [x,y]=frame.anchorRD;
  for(const axis of [frame.xAxisRD,frame.yAxisRD])if(Math.abs(Math.hypot(...axis)-1)>1e-6)throw new Error('Source RD axes must be unit metre vectors');
  const det=frame.xAxisRD[0]*frame.yAxisRD[1]-frame.xAxisRD[1]*frame.yAxisRD[0];
  const dot=frame.xAxisRD[0]*frame.yAxisRD[0]+frame.xAxisRD[1]*frame.yAxisRD[1];
  if(Math.abs(dot)>1e-6||Math.abs(det-1)>1e-6)throw new Error('Source RD frame must preserve frontage handedness');
  const anchor=mercator.fromLngLat(rdToLngLat({x,y}));const units=anchor.meterInMercatorCoordinateUnits();
  const project=(axis:readonly[number,number]):[number,number]=>{
    // A symmetric 1 m derivative avoids choosing either edge of the owner.
    const before=mercator.fromLngLat(rdToLngLat({x:x-axis[0]/2,y:y-axis[1]/2}));
    const after=mercator.fromLngLat(rdToLngLat({x:x+axis[0]/2,y:y+axis[1]/2}));
    return [(after.x-before.x)/units,(after.y-before.y)/units];
  };
  return {x:project(frame.xAxisRD),y:project(frame.yAxisRD)};
}

/** Exact anchor paired with the differential basis; avoids cached WGS rounding. */
export function rdProjectedSurvey(frame:SourceRDFrame,mercator:MercatorFactory) {
  const horizontalBasis=rdProjectionBasis(frame,mercator);
  const anchor=rdToLngLat({x:frame.anchorRD[0],y:frame.anchorRD[1]});
  return {anchor,horizontalBasis};
}
