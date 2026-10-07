import type {BuildingTools} from './cultural-builders';
import {buildKcriterionRearNative} from './kriterion-rear-native';
import {buildKcriterionFrontNative} from './kriterion-front-native';
/** Root-owned street-facade detailing sits ahead of these two complete Pand bodies.
 * These own every roof; remove legacy auditorium/street-house extrusions and caps. */
export function buildKcriterionNativeScope(b:BuildingTools){buildKcriterionRearNative(b);buildKcriterionFrontNative(b);}
