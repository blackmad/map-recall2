/** Publication gate for source/cohort correctness, not visual city-wide approval. */
export interface StreetAppearanceSourceAudit {
 surveyRevisionMatches:boolean;admissionRecorded:boolean;sourceMismatches:string[];admissionMismatches:string[];
 localStreetMaskChanges:string[];splitPaletteChanges:unknown[];splitExtraFronts:string[];
 profiles:Array<{id:string;reproduces:boolean;missingAtRuntime:string[]}>;
}
export function assessStreetAppearanceSourceAdmission(audit:StreetAppearanceSourceAudit) {
 const failures:string[]=[];
 if(!audit.surveyRevisionMatches)failures.push('catalog revision differs from baked survey');
 if(!audit.admissionRecorded)failures.push('source and generator provenance missing');
 if(audit.sourceMismatches.length)failures.push('surveyed footprint or construction-year sources changed');
 if(audit.admissionMismatches.length)failures.push('routing, curated identities or assignment compiler changed');
 if(audit.localStreetMaskChanges.length)failures.push('local appearance street graph differs from complete street graph');
 if(audit.splitPaletteChanges.length)failures.push('palette changes when cohort is streamed separately');
 if(audit.splitExtraFronts.length)failures.push('chunk split exposes additional profiled identities');
 for(const profile of audit.profiles){if(!profile.reproduces)failures.push(`${profile.id}: baked cohort is not reproducible`);if(profile.missingAtRuntime.length)failures.push(`${profile.id}: baked cohort includes fronts rejected by production street visibility`);}
 return {readyForVisualReview:failures.length===0,failures};
}
