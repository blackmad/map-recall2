import type {CanalhouseOpening} from './canalhouseRecipes';

/** Rectangular masonry returns; dimensions refer to the existing opening.
 * Joinery retains its normal local offsets and is translated inward by recessM.
 */
export function canalhouseOpeningRecess(o:CanalhouseOpening){
 const depth=o.recessM;
 if(depth===undefined){if(o.recessReturns)throw Error('Recess returns require an opening recess');return null;}
 const frameDepth=o.frameDepthM??.12;
 if(!Number.isFinite(depth)||depth<=frameDepth+.015||depth>1.5||o.head!==undefined||o.headRiseM!==undefined||(o.projectionM??0)!==0)throw Error('Unsupported rectangular opening recess');
 const sides=o.recessReturns?.glazedSides??[],soffit=o.recessReturns?.soffitSurface??'wall';
 if(!Array.isArray(sides)||new Set(sides).size!==sides.length||sides.some(s=>s!=='left'&&s!=='right')||!['wall','door','trim'].includes(soffit))throw Error('Unsupported recessed glazed return');
 const rim=Math.min(.04,o.trimWidthM/2),x=o.leftM,y=o.bottomM,w=o.widthM,h=o.heightM;
 return {depthM:depth,cutDepthM:depth+.04,returns:[
  {id:'left-jamb',x,y,w:rim,h,surface:sides.includes('left')?'glass' as const:'wall' as const},
  {id:'right-jamb',x:x+w-rim,y,w:rim,h,surface:sides.includes('right')?'glass' as const:'wall' as const},
  {id:'soffit',x,y:y+h-rim,w,h:rim,surface:soffit},
  {id:'sill',x,y,w,h:rim,surface:'wall' as const},
 ]};
}
