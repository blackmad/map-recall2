import {isCanalhouseComponentId} from './canalhouseComponentIds.ts';
import type {CanalhouseFacadeBlock,CanalhouseOpening} from './canalhouseRecipes.ts';

/** One source-selected ground-front field, tied to actual openings. Projecting
 * masonry makes shallow reveals around the existing frames; it does not move
 * glazing behind the native shell or infer a hidden entrance pocket. */
export interface CanalhouseGroundFront {
 id:string;leftM:number;bottomM:number;widthM:number;heightM:number;depthM:number;
 surface:NonNullable<CanalhouseFacadeBlock['surface']>;openingIds:string[];
 header?:{bottomM:number;heightM:number;depthM:number;surface?:NonNullable<CanalhouseFacadeBlock['surface']>};
}
export function canalhouseGroundFront(front:CanalhouseGroundFront,openings:CanalhouseOpening[]):CanalhouseFacadeBlock[]{
 const {leftM:l,bottomM:b,widthM:w,heightM:h,depthM:d}=front;
 if(!isCanalhouseComponentId(front.id)||![l,b,w,h,d].every(Number.isFinite)||l<0||b<0||w<=0||h<=0||d<=0||d>.3||!['stone','trim','wall'].includes(front.surface))throw Error('Invalid ground-front field');
 const selected=new Set(front.openingIds);
 if(!selected.size||selected.size!==front.openingIds.length)throw Error('Empty or duplicate ground-front opening selection');
 for(const id of selected){
  const o=openings.find(o=>o.id===id);
  if(!o||o.leftM<l-1e-5||o.leftM+o.widthM>l+w+1e-5||o.bottomM<b-1e-5||o.bottomM+o.heightM>b+h+1e-5)throw Error('Ground-front opening missing or outside field');
 }
 for(const o of openings)if(Math.min(l+w,o.leftM+o.widthM)>Math.max(l,o.leftM)+1e-5&&Math.min(b+h,o.bottomM+o.heightM)>Math.max(b,o.bottomM)+1e-5&&!selected.has(o.id))throw Error('Ground-front field overlaps an unselected opening');
 const blocks:CanalhouseFacadeBlock[]=[{id:`${front.id}/field`,leftM:l,bottomM:b,widthM:w,heightM:h,depthM:d,surface:front.surface}];
 if(front.header){
  const s=front.header;
  if(![s.bottomM,s.heightM,s.depthM].every(Number.isFinite)||s.bottomM<b||s.heightM<=0||s.bottomM+s.heightM>b+h+1e-5||s.depthM<d||s.depthM>.3||s.surface!==undefined&&!['stone','trim','wall'].includes(s.surface))throw Error('Invalid ground-front header');
  blocks.push({id:`${front.id}/header`,leftM:l,bottomM:s.bottomM,widthM:w,heightM:s.heightM,depthM:s.depthM,surface:s.surface??front.surface});
 }
 return blocks;
}
