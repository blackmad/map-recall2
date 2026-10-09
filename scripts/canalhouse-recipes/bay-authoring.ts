import {isCanalhouseComponentId} from '../../src/canalRecall/canalhouseComponentIds.ts';

export type ReferenceBay={id:string;left:number;width:number};
/** Explicit observed axes, with regular spacing selected by the author. */
export type ReferenceBaySet=ReferenceBay[]|{template:'regular';ids:string[];left:number;width:number;step:number};

export function expandBaySets(sets:Record<string,ReferenceBaySet>):Record<string,ReferenceBay[]> {
 return Object.fromEntries(Object.entries(sets).map(([name,selection])=>{
  if(Array.isArray(selection))return [name,structuredClone(selection)];
  if(!selection||selection.template!=='regular'||!Array.isArray(selection.ids)||selection.ids.length<1||selection.ids.length>16||new Set(selection.ids).size!==selection.ids.length||!selection.ids.every(isCanalhouseComponentId))throw Error('Invalid regular bay identities');
  const {left,width,step}=selection;
  if(![left,width,step].every(Number.isFinite)||left<0||width<=0||step<=0||(selection.ids.length>1&&step<width)||left+(selection.ids.length-1)*step+width>1+1e-12)throw Error('Invalid regular bay bounds or overlapping axes');
  // Decimal recipe coordinates remain stable through repeated expansion.
  const bays=selection.ids.map((id,i)=>({id,left:Number((left+i*step).toFixed(12)),width}));
  return [name,bays];
 }));
}
