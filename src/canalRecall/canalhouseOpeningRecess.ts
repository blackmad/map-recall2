import type {CanalhouseOpening} from './canalhouseRecipes';

type ReturnSurface='wall'|'glass'|'door'|'trim'|'stone';
/** One lining piece of the cavity, facade-relative; `z`/`d` (centre and depth along the normal) default to the full cavity. */
export interface RecessReturn{id:string;x:number;y:number;w:number;h:number;surface:ReturnSurface;z?:number;d?:number}

/** Rectangular masonry returns; dimensions refer to the existing opening.
 * Joinery retains its normal local offsets and is translated inward by recessM.
 *
 * Door reveals (buildingRecipe/doorReveal.ts) stack a door and its fanlight as two recessed openings that read as one
 * cavity: `omit` drops the door's soffit and the fanlight's sill where they meet; `jambSurface`/`sillSurface` line the
 * cavity in stone or paint; `steps` stand on the cavity floor rising to the leaf (the top step reaches the back, and
 * they replace the sill); `sideDoors` puts a flat's door leaf on each side wall of a portiek. Every field absent = the
 * loggia/portal geometry, byte-identical.
 */
export function canalhouseOpeningRecess(o:CanalhouseOpening){
 const depth=o.recessM;
 if(depth===undefined){if(o.recessReturns)throw Error('Recess returns require an opening recess');return null;}
 const frameDepth=o.frameDepthM??.12;
 if(!Number.isFinite(depth)||depth<=frameDepth+.015||depth>1.5||o.head!==undefined||o.headRiseM!==undefined||(o.projectionM??0)!==0)throw Error('Unsupported rectangular opening recess');
 const rr=o.recessReturns,sides=rr?.glazedSides??[],soffit=rr?.soffitSurface??'wall';
 if(!Array.isArray(sides)||new Set(sides).size!==sides.length||sides.some(s=>s!=='left'&&s!=='right')||!['wall','door','trim'].includes(soffit))throw Error('Unsupported recessed glazed return');
 const omit=rr?.omit??[],jamb=rr?.jambSurface??'wall',sillSurface=rr?.sillSurface??'wall',st=rr?.steps,sd=rr?.sideDoors;
 if(!Array.isArray(omit)||omit.some(k=>k!=='sill'&&k!=='soffit')||!['wall','stone','trim'].includes(jamb)||!['wall','stone'].includes(sillSurface))throw Error('Unsupported recess lining');
 const rim=Math.min(.04,o.trimWidthM/2),x=o.leftM,y=o.bottomM,w=o.widthM,h=o.heightM;
 const returns:RecessReturn[]=[
  {id:'left-jamb',x,y,w:rim,h,surface:sides.includes('left')?'glass':jamb},
  {id:'right-jamb',x:x+w-rim,y,w:rim,h,surface:sides.includes('right')?'glass':jamb},
  ...(omit.includes('soffit')?[]:[{id:'soffit',x,y:y+h-rim,w,h:rim,surface:soffit}]),
  ...(omit.includes('sill')||st?[]:[{id:'sill',x,y,w,h:rim,surface:sillSurface}]),
 ];
 let landing=0;
 if(st){
  if(!Number.isInteger(st.count)||st.count<1||st.count>5||!Number.isFinite(st.riseM)||st.riseM<.1||st.riseM>.22||st.count*st.riseM>Math.min(1,h*.4)||o.kind!=='door'||omit.includes('sill'))throw Error('Unsupported recess steps');
  // Step k (0 = the street step) runs from k runs behind the facade to the next; the top step reaches the leaf.
  // Between the jamb linings, so no step face is coplanar with a lining face that looks the same way.
  const run=Math.min(.3,depth/st.count);landing=st.count*st.riseM;
  for(let k=0;k<st.count;k++){
   const front=k*run,back=k===st.count-1?depth:(k+1)*run;
   returns.push({id:`step-${k}`,x:x+rim,y,w:w-2*rim,h:st.riseM*(k+1),surface:'stone',z:-(front+back)/2,d:back-front});
  }
 }
 if(sd){
  if(!Number.isFinite(sd.widthM)||!Number.isFinite(sd.heightM)||sd.widthM<.6||sd.heightM<1.8||sd.widthM+.3>depth||landing+sd.heightM>h-.05||o.kind!=='door'||sides.length)throw Error('Unsupported portiek side doors');
  // Each side wall's door leaf stands 15 cm in front of the back wall, on the landing, against the jamb lining.
  const z=-(depth-.15-sd.widthM/2);
  for(const [id,dx] of [['left-door',x+rim],['right-door',x+w-rim-.02]] as const)returns.push({id,x:dx,y:y+landing,w:.02,h:sd.heightM,surface:'door',z,d:sd.widthM});
 }
 return {depthM:depth,cutDepthM:depth+.04,returns};
}
