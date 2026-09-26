/** The contextual game mass uses one height for a whole BAG owner. LoD2.2
 * surfaces can rise above that roof-70p height on a mixed-height building.
 * Detail with no rendered mass behind it must be withheld as a whole opening. */
import {sourceToRenderHeight} from '../appearanceHeight.js';

export interface HeightBoundDetail {featureId:string;triangles:number[];sign?:unknown}
export interface WithheldHeightDetail {featureId:string;reason:'above-rendered-mass'|'invalid-height';highestRenderM:number|null}
export function detailsWithinRenderedMass<T extends HeightBoundDetail>(
  patches:readonly T[],massHeightM:number,datum:string,groundNAP:number,toleranceM=.25,
):{patches:T[];withheld:WithheldHeightDetail[]}{
  const groups=new Map<string,T[]>(),signs:T[]=[];
  for(const patch of patches){
    // Physical sign placement has its own source geometry and review policy.
    if(patch.sign){signs.push(patch);continue;}
    const group=groups.get(patch.featureId)??[];group.push(patch);groups.set(patch.featureId,group);
  }
  const retained:T[]=[],withheld:WithheldHeightDetail[]=[];
  const validEnvelope=Number.isFinite(massHeightM)&&massHeightM>0&&Number.isFinite(groundNAP)&&
    Number.isFinite(toleranceM)&&toleranceM>=0;
  for(const [featureId,group] of groups){
    let highest=-Infinity,valid=validEnvelope;
    for(const patch of group){
      if(!Array.isArray(patch.triangles)||!patch.triangles.length||patch.triangles.length%9){valid=false;continue;}
      for(let i=1;i<patch.triangles.length;i+=3){
        const height=patch.triangles[i];if(!Number.isFinite(height)){valid=false;continue;}
        const rendered=sourceToRenderHeight(height,datum,groundNAP);
        if(!Number.isFinite(rendered))valid=false;else highest=Math.max(highest,rendered);
      }
    }
    if(!valid||!Number.isFinite(highest)){withheld.push({featureId,reason:'invalid-height',highestRenderM:Number.isFinite(highest)?highest:null});continue;}
    if(highest>massHeightM+toleranceM){withheld.push({featureId,reason:'above-rendered-mass',highestRenderM:highest});continue;}
    retained.push(...group);
  }
  return{patches:[...retained,...signs],withheld};
}
