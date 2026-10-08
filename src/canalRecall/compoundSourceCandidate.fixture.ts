/** Node-only source-proportion diagnostic. Never register this as a runtime
 * profile: it admits zero buildings and does not alter factual native heights.
 * Only exposed87/89 trains this candidate; fresh heldout99 is not exported,
 * rendered, inspected or used to select any dimensions here. */
import {readFileSync} from 'node:fs';
import {compoundFeature,compoundFront,compoundProfile} from './compoundNativeFrontage.fixture.js';
import {planCompoundFrontage,type CompoundFrontageRecipe} from './compoundFrontageLayout.js';
import type {ArchitecturalRecipe,StreetAppearanceProfile} from './streetAppearance.js';

const source=JSON.parse(readFileSync('docs/references/compound-frontage-source-candidate.json','utf8'));

/** Rounded hypotheses from the frozen visible proportions, not surveyed facade
 * dimensions. Body projections below are additional to the body front. */
export const compoundSourceFixture:CompoundFrontageRecipe=structuredClone(source.approximatePlannerCandidate);
compoundSourceFixture.shaft.body={widthM:3.2,bottomM:3.2,topM:18.35,projectionM:.18};
compoundSourceFixture.shaft.rows.forEach(row=>{row.projectionM=.04;});
compoundSourceFixture.shaft.groundLights.projectionM=.03;
compoundSourceFixture.basement={bottomM:.15,heightM:1.35,widthM:1.55,frameWidthM:.07};
compoundSourceFixture.cornice={heightM:.35,projectionM:.45,blockCount:16,blockWidthM:.25,blockHeightM:.20,blockProjectionM:.3};

/** Native geometry/metadata stay identical to the original diagnostic fixture.
 *19.3m is a separate street-envelope constraint, never a replacement Pand height. */
export const compoundSourceFeature=structuredClone(compoundFeature);
export const compoundSourceFront={...compoundFront};
export const compoundSourceEnvelope={
  nativePandId:'NL.IMBAG.Pand.0363100012178298',
  nativeAggregateHeightM:22.99,
  nativeOriginalConstructionYear:1650,
  monumentFacadeDesignYear:1920,
  groundDatumNapM:.499,
  surveyedStreetEaveAboveGroundM:[19.26700125360489,19.331001253604885] as const,
  diagnosticStreetWallTopM:19.3,
  roofSurfaceIndex:108,
  rule:'Root must integrate surveyed roof/envelope independently. Do not extrude the street facade to the22.99m whole-Pand aggregate or infer a roof plate from this recipe.',
};

export const compoundSourceRecipe:ArchitecturalRecipe={
  family:'masonry',period:'school',confidence:.65,wallHex:'#665e54',frameHex:'#e5e5d8',
  wallMaterial:'brick',sash:'transom',balconyPolicy:'assembly-only',compoundFrontage:compoundSourceFixture,
};

export const compoundSourceProfile:StreetAppearanceProfile={
  ...structuredClone(compoundProfile),
  id:'compound-source-diagnostic-only',
  revision:'primary-source-proportions-survey-envelope-candidate-v1',
  recipes:[{weight:1,frontageMin:9,frontageMax:12,heightMin:19,heightMax:26,recipe:compoundSourceRecipe}],
};

export const compoundSourcePlan=planCompoundFrontage({lengthM:compoundSourceFront.lengthM,
  baseM:0,topM:compoundSourceEnvelope.diagnosticStreetWallTopM,recipe:compoundSourceFixture});
if(!compoundSourcePlan)throw new Error('Source-proportion diagnostic does not fit the native87/89 street envelope');

export const compoundSourceDiagnostic={
  diagnosticOnly:true,
  runtimeAdmissions:0,
  eligibleBuildingIds:[compoundSourceEnvelope.nativePandId],
  sourceRecord:'docs/references/compound-frontage-source-candidate.json',
  sourceSha256:'a441bfff36fec4484bea0fae21f16f28ec9cd45d61dfcc548cb4fac684d1bba2',
  sourceCaptureDate:'2025-06-30',
  sourceArchiveCommit:'a3d5c3c6df8b2e6f8fe1d9795c2e29b803def25f',
  sourceArchivePath:'streets/oudezijds-east-next-south/',
  sourceConfidence:'High counts/ordering/assembly relationships; medium width proportions; low-to-medium absolute facade datums; low projection dimensions.',
  sourceDimensions:'Main rows6.1/10.2/14.3m height2.8m are approximate hypotheses; basement count follows the3 main axes, with clipped source grade/approach unresolved.',
  pending:['native source-envelope integration','source/render visual review','independent review','actual game scene','GPU/performance evidence'],
  freshHeldout99:'Unseen and unused for this candidate',
} as const;
