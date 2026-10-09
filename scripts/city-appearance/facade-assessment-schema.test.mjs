import assert from 'node:assert/strict';
import {FACADE_SCHEMA,validateFacadeAssessment,validateGroundAssessment} from './facade-assessment-schema.mjs';
const unknown={upper:{material:'unknown',colour:'unknown',visibility:'unknown'},base:{material:'unknown',colour:'unknown',visibility:'unknown',contrast:'unknown',boundary:'unknown'},
 openings:{visibleStoreys:null,windowPattern:'unknown',entrance:'unknown',visibility:'unknown'},retail:{use:'unknown',displayGlazing:'unknown',fascia:'unknown',awning:'unknown',signLegibility:'unknown',literalSignText:null},
 roofline:{shape:'unknown',targetAttribution:'unknown',visibility:'unknown'},caution:'Obscured.'};
assert(validateFacadeAssessment(unknown).valid);
for(const patch of [
 {upper:{...unknown.upper,material:'brick'}},
 {retail:{...unknown.retail,literalSignText:'INVENTED SHOP'}},
 {retail:{...unknown.retail,signLegibility:'readable',literalSignText:''}},
 {roofline:{...unknown.roofline,shape:'bell'}},
 {openings:{...unknown.openings,visibleStoreys:99}},
 {extra:'unrequested'}])assert.equal(validateFacadeAssessment({...unknown,...patch}).valid,false);
assert.equal(Object.keys(FACADE_SCHEMA.properties).length,6);
const ground={entrance:'visible',entranceCount:2,displayGlazing:'absent',fascia:'absent',awning:'absent',baseMaterial:'brick',baseColour:'brown',distinctPlinth:'visible',signLegibility:'no-visible-sign',literalSignText:null};
assert(validateGroundAssessment(ground).valid);
assert(!validateGroundAssessment({...ground,entrance:'unknown'}).valid);
assert(!validateGroundAssessment({...ground,literalSignText:'GUESSED'}).valid);
console.log('Facade assessment: independent unknowns, bounded counts and unsupported sign/roof claims checked');
