import type {BuildingTools} from './cultural-builders';
import {buildRaiAmsterdam} from './rai-amsterdam-builder';
import {buildRaiEuropahal} from './rai-europahal-builder';
/** Reviewed phases still require combined native/gallery and live scope acceptance. */
export function buildRaiAmsterdamComplex(w:number,d:number,b:BuildingTools):void {
 buildRaiAmsterdam(w,d,b);
 buildRaiEuropahal(w,d,b);
}
