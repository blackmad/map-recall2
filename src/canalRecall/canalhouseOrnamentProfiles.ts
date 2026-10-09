import type {CanalhousePoint} from './canalhouseRecipes.ts';

/** Compact source-selected contour. Tessellation is drawing quality, not a
 * source count. The existing ornament compiler owns material/depth/geometry. */
export interface CanalhouseOvalProfile {kind:'oval';left:number;bottom:number;width:number;height:number}
export function canalhouseOvalProfile(shape:CanalhouseOvalProfile):CanalhousePoint[]{
 const {left,bottom,width,height}=shape;
 if(shape.kind!=='oval'||![left,bottom,width,height].every(Number.isFinite)||left<0||bottom<0||width<=0||height<=0)throw Error('Invalid observed oval contour');
 return Array.from({length:16},(_,i)=>{
  const angle=2*Math.PI*i/16;
  return[left+width*(1+Math.cos(angle))/2,bottom+height*(1+Math.sin(angle))/2];
 });
}
