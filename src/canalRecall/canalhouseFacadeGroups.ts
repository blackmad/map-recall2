import type {CanalhouseFacadeBlock} from './canalhouseRecipes.ts';
import {isCanalhouseComponentId} from './canalhouseComponentIds.ts';

/** Explicit observed rows/columns, sharing one masonry section. No spacing,
 * count or architecture is inferred from the frontage dimensions. */
export interface CanalhouseFacadeGroup {
 id:string;
 columns:{id:string;leftM:number;widthM:number}[];
 rows:{id:string;bottomM:number;heightM:number}[];
 depthM:number;surface:NonNullable<CanalhouseFacadeBlock['surface']>;
}
export function canalhouseFacadeGroup(group:CanalhouseFacadeGroup):CanalhouseFacadeBlock[]{
 const validId=isCanalhouseComponentId;
 if(!validId(group.id)||!group.columns.length||!group.rows.length)throw Error('Invalid facade group identity or empty observations');
 for(const axis of [group.columns,group.rows]){
  const ids=new Set<string>();
  for(const item of axis){if(!validId(item.id)||ids.has(item.id))throw Error('Invalid or duplicate facade group position');ids.add(item.id);}
 }
 if(!Number.isFinite(group.depthM)||group.depthM<=0||!['stone','trim','wall'].includes(group.surface))throw Error('Invalid facade group section');
 for(const c of group.columns)if(!Number.isFinite(c.leftM)||c.leftM<0||!Number.isFinite(c.widthM)||c.widthM<=0)throw Error('Invalid facade group column');
 for(const r of group.rows)if(!Number.isFinite(r.bottomM)||r.bottomM<0||!Number.isFinite(r.heightM)||r.heightM<=0)throw Error('Invalid facade group row');
 return group.rows.flatMap(r=>group.columns.map(c=>({id:`${group.id}/${r.id}/${c.id}`,leftM:c.leftM,widthM:c.widthM,bottomM:r.bottomM,heightM:r.heightM,depthM:group.depthM,surface:group.surface})));
}
