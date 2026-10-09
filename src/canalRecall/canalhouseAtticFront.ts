import type {CanalhouseFacadeBlock,CanalhouseOpening} from './canalhouseRecipes';
import type {CanalhouseOpeningFrame} from './canalhouseOpeningTemplates';
import {isCanalhouseComponentId} from './canalhouseComponentIds';

/** One correlated attic facade: pale facing, central arch and side lights.
 * The existing crown owns its silhouette; this assembly never invents a roof. */
export interface CanalhouseAtticFront {
 id:string;template:'arched-center-with-side-lights';widthM:number;
 bottomM:number;sideTopM:number;depthM:number;surface:'trim'|'stone'|'wall';
 center:{leftM:number;widthM:number;bottomM:number;heightM:number;headRiseM:number;frame:CanalhouseOpeningFrame};
 sideLights:{bays:{id:string;leftM:number;widthM:number}[];bottomM:number;heightM:number;frame:CanalhouseOpeningFrame};
}
export function canalhouseAtticFront(front:CanalhouseAtticFront):{openings:CanalhouseOpening[];blocks:CanalhouseFacadeBlock[]} {
 const {widthM:w,bottomM:b,sideTopM:top,depthM:d,center:c,sideLights:s}=front;
 if(!isCanalhouseComponentId(front.id)||front.template!=='arched-center-with-side-lights'||![w,b,top,d].every(Number.isFinite)||w<=0||b<0||top<=b||d<=0||d>.3||!['trim','stone','wall'].includes(front.surface))throw Error('Invalid attic-front field');
 const inside=(left:number,width:number,bottom:number,height:number)=>[left,width,bottom,height].every(Number.isFinite)&&left>=0&&width>0&&left+width<=w+1e-8&&bottom>=b&&height>0;
 if(!inside(c.leftM,c.widthM,c.bottomM,c.heightM)||c.headRiseM<=0||!Number.isFinite(c.headRiseM)||c.headRiseM>Math.min(c.widthM/2,c.heightM)||c.bottomM>=top||c.frame.head!==undefined&&c.frame.head!=='segmental')throw Error('Invalid attic center opening');
 if(!s.bays.length||s.bays.length>4||s.frame.head!==undefined)throw Error('Attic side lights require explicit rectangular bays');
 const ids=new Set<string>(['center']);
 const openings:CanalhouseOpening[]=[{...structuredClone(c.frame),id:front.id+'/center',kind:'window',leftM:c.leftM,widthM:c.widthM,bottomM:c.bottomM,heightM:c.heightM,head:'segmental',headRiseM:c.headRiseM}];
 for(const bay of s.bays){
  if(!isCanalhouseComponentId(bay.id)||ids.has(bay.id)||!inside(bay.leftM,bay.widthM,s.bottomM,s.heightM)||s.bottomM+s.heightM>top+1e-8)throw Error('Invalid attic side light');
  ids.add(bay.id);openings.push({...structuredClone(s.frame),id:front.id+'/'+bay.id,kind:'window',leftM:bay.leftM,widthM:bay.widthM,bottomM:s.bottomM,heightM:s.heightM});
 }
 for(let i=0;i<openings.length;i++)for(let j=i+1;j<openings.length;j++){
  const a=openings[i],q=openings[j];
  if(Math.min(a.leftM+a.widthM,q.leftM+q.widthM)>Math.max(a.leftM,q.leftM)+1e-8&&Math.min(a.bottomM+a.heightM,q.bottomM+q.heightM)>Math.max(a.bottomM,q.bottomM)+1e-8)throw Error('Attic openings overlap');
 }
 return {openings,blocks:[{id:front.id+'/field',leftM:0,bottomM:b,widthM:w,heightM:top-b,depthM:d,surface:front.surface}]};
}
