/** Coarse source-selected cornice section. Dimensions remain recipe data. */
export interface CanalhouseCorniceAssembly {
 lowerLipEnd:number;upperCapStart:number;
 lowerLipDepthM:number;friezeDepthM:number;upperCapDepthM:number;
 capUnderside?:{riseM:number;insetM:number};
}
export interface CanalhouseCorniceSelection {template:'lip-frieze-cap';overrides?:Partial<CanalhouseCorniceAssembly>}
/** Drawing section selected explicitly by a recipe, not an inferred historic measurement. */
export const canalhouseCorniceSections={
 'lip-frieze-cap':{lowerLipEnd:.15,upperCapStart:.78,lowerLipDepthM:.15,friezeDepthM:.07,upperCapDepthM:.28,capUnderside:{riseM:.05,insetM:.1}},
} as const;
export function canalhouseCorniceLayers(bottomM:number,heightM:number,input:CanalhouseCorniceAssembly|CanalhouseCorniceSelection){
 const section:CanalhouseCorniceAssembly='template' in input?{...structuredClone(canalhouseCorniceSections[input.template]),...input.overrides}:input;
 if('template' in input&&!(input.template in canalhouseCorniceSections))throw Error('Unknown cornice assembly');
 const {lowerLipEnd:low,upperCapStart:high}=section;
 if(!Number.isFinite(bottomM)||!Number.isFinite(heightM)||heightM<=0||!Number.isFinite(low)||!Number.isFinite(high)||low<=0||high<=low||high>=1)throw Error('Invalid observed cornice band or section');
 for(const depth of [section.lowerLipDepthM,section.friezeDepthM,section.upperCapDepthM])if(!Number.isFinite(depth)||depth<=0)throw Error('Invalid cornice course depth');
 const under=section.capUnderside;
 if(under&&(!Number.isFinite(under.riseM)||under.riseM<=0||under.riseM>=heightM*(1-high)||!Number.isFinite(under.insetM)||under.insetM<=0||under.insetM>=section.upperCapDepthM))throw Error('Invalid cornice cap underside');
 return[
  {bottomM,heightM:heightM*low,depthM:section.lowerLipDepthM},
  {bottomM:bottomM+heightM*low,heightM:heightM*(high-low),depthM:section.friezeDepthM},
  {bottomM:bottomM+heightM*high,heightM:heightM*(1-high),depthM:section.upperCapDepthM,...(under?{underside:structuredClone(under)}:{})},
 ];
}
