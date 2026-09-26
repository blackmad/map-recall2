import type {FittedFacadeFeature} from './facadeDescription';
/** Display priors, not measured dimensions or building-code requirements. */
export const DOOR_PRIORS={minimumWidthM:.65,minimumPairedWidthM:1.1,minimumHeightM:1.8,maximumGroundGapM:.30,maximumWidthGrowthM:.20,maximumHeightGrowthM:.25};
export type DoorAdjustment='door-ground-extension'|'door-minimum-width'|'door-minimum-height'|'door-panel-grammar'|'door-furniture-grammar';
export function regularizeDoor(f:FittedFacadeFeature,groundY:number|undefined):{feature:FittedFacadeFeature;adjustments:DoorAdjustment[]}{
 const unchanged={feature:f,adjustments:[] as DoorAdjustment[]};
 // Explicit thresholds and reviewed corrections outrank display priors. Unknown
 // or synthetic pixel-space scales cannot supply metric door dimensions.
 if(f.kind!=='door'||!Number.isFinite(groundY)||f.thresholdHeightM!==undefined||f.disposition==='human-reviewed')return unchanged;
 const bottom=f.y-f.height/2,top=f.y+f.height/2,gap=bottom-groundY!;
 if(gap < -1e-6 || gap > DOOR_PRIORS.maximumGroundGapM+1e-6)return unchanged;
 const minimumWidth=f.paired?DOOR_PRIORS.minimumPairedWidthM:DOOR_PRIORS.minimumWidthM;
 if(f.width<minimumWidth-DOOR_PRIORS.maximumWidthGrowthM||f.height<DOOR_PRIORS.minimumHeightM-DOOR_PRIORS.maximumHeightGrowthM-gap)return unchanged;
 const adjustments:DoorAdjustment[]=[];let lower=bottom,upper=top,width=f.width;
 if(gap>1e-6){lower=groundY!;adjustments.push('door-ground-extension');}
 if(width<minimumWidth){width=minimumWidth;adjustments.push('door-minimum-width');}
 if(upper-lower<DOOR_PRIORS.minimumHeightM){upper=lower+DOOR_PRIORS.minimumHeightM;adjustments.push('door-minimum-height');}
 if(!adjustments.length)return unchanged;
 const height=upper-lower,feature={...f,width,height,y:(upper+lower)/2};
 // Preserve absolute head rise and transom distance from the top when extending
 // a leaf downwards; stretching the whole opening would alter its curve.
 for(const key of ['archRise','lintelRise','transom'] as const)if(f[key]!==undefined)feature[key]=f[key]!*f.height/height;
 if(f.topCornerRadius!==undefined)feature.topCornerRadius=f.topCornerRadius*Math.min(f.width,f.height)/Math.min(width,height);
 return {feature,adjustments};
}
