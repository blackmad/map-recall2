import {isCanalhouseComponentId} from './canalhouseComponentIds.ts';
import type {CanalhouseOpening} from './canalhouseRecipes.ts';

/** A source-selected window group: explicit bays and tiers replace repeated
 * rectangles. This helper supplies no bay count, floor count or pane pattern. */
export interface CanalhouseOpeningGroup {
  id:string;
  kind:'window'|'door';
  bays:{id:string;leftM:number;widthM:number}[];
  tiers:{id:string;bottomM:number;heightM:number}[];
  frame:Omit<CanalhouseOpening,'id'|'kind'|'leftM'|'bottomM'|'widthM'|'heightM'>;
  /** Optional source-selected diagonal lattice inside a panel/leaf field. */
  grille?:CanalhouseGrillePattern;
  /** Source-observed missing positions, e.g. an entrance replacing a window. */
  omit?:{bay:string;tier:string}[];
}
export type CanalhouseWindowGroup=Omit<CanalhouseOpeningGroup,'kind'>;
/** A door and its source-observed aligned transom share one physical axis.
 * Independent/offset fanlights still use explicit openings. No gap is inferred. */
export function canalhouseEntryOpenings(door:CanalhouseOpening,transom?:{
 id?:string;bottomM:number;heightM:number;frame:CanalhouseOpeningGroup['frame'];
}):CanalhouseOpening[]{
 if(door.kind!=='door')throw Error('An entry transom requires a door');
 if(!transom)return [structuredClone(door)];
 if(!Number.isFinite(transom.bottomM)||!Number.isFinite(transom.heightM)||transom.heightM<=0||transom.bottomM<door.bottomM+door.heightM-1e-8)throw Error('Invalid or overlapping entry transom');
 const id=transom.id??`${door.id}-transom`;
 if(!id||id===door.id)throw Error('Invalid entry transom identity');
 return [structuredClone(door),{...structuredClone(transom.frame),id,kind:'window',leftM:door.leftM,bottomM:transom.bottomM,widthM:door.widthM,heightM:transom.heightM}];
}
/** House-local source axes shared by floors with different joinery or omissions.
 * No spacing, symmetry or bay count is inferred. Inline bays remain supported. */
export function canalhouseOpeningBays<T extends {id:string}>(selection:{bays?:T[];baySet?:string},sets:Record<string,T[]>):T[] {
  if((selection.bays!==undefined)===(selection.baySet!==undefined))throw Error('Select exactly one inline bay list or named bay set');
  if(selection.baySet!==undefined&&(typeof selection.baySet!=='string'||!Object.prototype.hasOwnProperty.call(sets,selection.baySet)))throw Error(`Unknown opening bay set: ${selection.baySet}`);
  const bays=selection.bays??sets[selection.baySet!];
  if(!Array.isArray(bays)||!bays.length)throw Error('Empty opening bay set');
  return structuredClone(bays);
}
export interface CanalhouseGrillePattern {
  /** Normalized to the opening inside its trim, matching door-panel rectangles. */
  rect:[number,number,number,number];columns:number;rows:number;
}

export function canalhouseWindowGroup(group:CanalhouseWindowGroup):CanalhouseOpening[] {
  return canalhouseOpeningGroup({...group,kind:'window'});
}
export function canalhouseOpeningGroup(group:CanalhouseOpeningGroup):CanalhouseOpening[] {
  const id=isCanalhouseComponentId;
  if(!id(group.id)||!group.bays.length||!group.tiers.length)throw Error('Invalid window group identity or empty observations');
  if(group.kind!=='window'&&group.kind!=='door')throw Error('Unsupported opening group kind');
  for(const axis of [group.bays,group.tiers]){
    const ids=new Set<string>();
    for(const item of axis){
      if(!id(item.id)||ids.has(item.id))throw Error('Duplicate or invalid window group position');
      ids.add(item.id);
    }
  }
  for(const bay of group.bays)if(!Number.isFinite(bay.leftM)||bay.leftM<0||!Number.isFinite(bay.widthM)||bay.widthM<=0)throw Error('Invalid observed window bay');
  for(const tier of group.tiers)if(!Number.isFinite(tier.bottomM)||tier.bottomM<0||!Number.isFinite(tier.heightM)||tier.heightM<=0)throw Error('Invalid observed window tier');
  const omitted=new Set<string>();
  for(const cell of group.omit??[]){
    const key=JSON.stringify([cell.bay,cell.tier]);
    if(!group.bays.some(b=>b.id===cell.bay)||!group.tiers.some(t=>t.id===cell.tier)||omitted.has(key))throw Error('Unknown or duplicate omitted window position');
    omitted.add(key);
  }
  return group.tiers.flatMap(tier=>group.bays.filter(bay=>!omitted.has(JSON.stringify([bay.id,tier.id]))).map(bay=>{
    const opening:CanalhouseOpening={...structuredClone(group.frame),id:`${group.id}/${tier.id}/${bay.id}`,kind:group.kind,
      leftM:bay.leftM,widthM:bay.widthM,bottomM:tier.bottomM,heightM:tier.heightM};
    if(group.grille)opening.diagonalBars=[...(opening.diagonalBars??[]),...canalhouseGrilleSegments(group.grille,opening)];
    return opening;
  }));
}

/** The existing diagonal-bar renderer owns geometry; this only expands a bounded
 * lattice recipe into clipped segments. Counts are drawing inputs, not evidence. */
export function canalhouseGrilleSegments(pattern:CanalhouseGrillePattern,opening:Pick<CanalhouseOpening,'widthM'|'heightM'|'trimWidthM'>):NonNullable<CanalhouseOpening['diagonalBars']> {
  const {columns,rows,rect:[left,bottom,width,height]}=pattern;
  if(![left,bottom,width,height,opening.widthM,opening.heightM,opening.trimWidthM].every(Number.isFinite)||left<0||bottom<0||width<=0||height<=0||left+width>1||bottom+height>1||opening.trimWidthM<=0||Math.min(opening.widthM,opening.heightM)<=2*opening.trimWidthM)throw Error('Invalid grille field');
  if(![columns,rows].every(n=>Number.isInteger(n)&&n>=1&&n<=16))throw Error('Invalid grille drawing divisions');
  const point=(u:number,v:number):[number,number]=>[(opening.trimWidthM+(left+u*width)*(opening.widthM-2*opening.trimWidthM))/opening.widthM,(opening.trimWidthM+(bottom+v*height)*(opening.heightM-2*opening.trimWidthM))/opening.heightM];
  const result:NonNullable<CanalhouseOpening['diagonalBars']>=[];
  for(const sign of [-1,1])for(let k=sign<0?-rows+1:1;k<columns+(sign>0?rows:0);k++){
    const candidates:[[number,number],[number,number],[number,number],[number,number]]=[[0,k/(sign*rows)],[1,(k-columns)/(sign*rows)],[k/columns,0],[(k-sign*rows)/columns,1]];
    const points=candidates.filter(([u,v])=>u>=0&&u<=1&&v>=0&&v<=1).filter((p,i,all)=>all.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-9)===i);
    if(points.length===2)result.push([point(...points[0]),point(...points[1])]);
  }
  return result;
}
