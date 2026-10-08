/** Diagnostic capability fixture only. Never published or admitted as a street profile. */
import {readFileSync} from 'node:fs';
import {decorateFacade} from './genericFacades.js';
import {ORIGIN,type Feature} from './threeBuildingFeatures.js';
import {streetSegments} from './streetFronts.js';
import type {ArchitecturalRecipe,StreetAppearanceProfile} from './streetAppearance.js';
import {planCompoundFrontage,type CompoundFrontageRecipe} from './compoundFrontageLayout.js';
const discovery=JSON.parse(readFileSync('docs/references/oudezijds-compound-discovery-review.json','utf8'));
const native=discovery.frozenSamples.representative.native;
export const compoundFixture:CompoundFrontageRecipe={mainFraction:.72,mainColumns:3,mainInsetM:.4,mainWindowWidthM:1.45,mainFrameWidthM:.065,
 mainRows:[6.8,9.7,12.6].map(bottomM=>({bottomM,heightM:2,transomFraction:.76})),
 shaft:{axisFraction:.5,frameWidthM:.035,rows:[6.4,9.6,13].map(bottomM=>({bottomM,heightM:2.3,transomFraction:.72,principalWidthM:1.10,sideLightWidthM:.19,sideLightGapM:.18,sideLightBottomOffsetM:.10,sideLightHeightM:2.10,projectionM:.25})),
 groundLights:{bottomM:3.4,heightM:2.3,lightWidthM:.19,gapM:.28,projectionM:.08},access:{bottomM:0,heightM:2.6,widthM:1.05,recessDepthM:.35,frameWidthM:.09},canopy:{bottomM:2.75,thicknessM:.25,widthM:1.9,projectionM:.75,corbels:{widthM:.22,layers:[{heightM:.15,projectionM:.30},{heightM:.15,projectionM:.45}]}}},
 groundSurround:{bottomM:1.35,heightM:4.2,openingBottomM:1.65,openingHeightM:3.60,openingWidthM:1.45,frameWidthM:.26,projectionM:.25,transomFraction:.82}};
export const compoundFeature:Feature=decorateFacade({type:'Feature',geometry:native.geometry,
 properties:{...native.properties,constructionYear:1650,appearanceStyleSource:'citywide-identity-palette-v3-not-measured'}});
export const compoundNeighbors:Feature[]=['transition','heldout'].map(key=>{
 const n=discovery.frozenSamples[key].native;
 return decorateFacade({type:'Feature',geometry:n.geometry,properties:{...n.properties}});
});
export const compoundRecipe:ArchitecturalRecipe={family:'masonry',period:'c19',confidence:.9,wallHex:'#665e54',frameHex:'#e5e5d8',
 sash:'transom',balconyPolicy:'assembly-only',compoundFrontage:compoundFixture};
export const compoundProfile:StreetAppearanceProfile={id:'compound-native-diagnostic-only',streetName:'Oudezijds Voorburgwal',revision:'unmeasured-capability-fixture',
 segment:discovery.scope,side:1,reachM:20,assemblyM:8,confidence:.9,status:'reviewed',buildingIds:[String(native.properties.id)],
 evidence:[{id:'station-2',kind:'municipal-panorama',captureDate:'2025-06-30',sha256:discovery.sources[0].sha256,inference:'agent-visual-review',quality:.9,notes:'Previously exposed reference; fixture tests capability only, no visual admission.'}],
 recipes:[{weight:1,frontageMin:9,frontageMax:12,heightMin:19,heightMax:26,recipe:compoundRecipe}]};
export const compoundStreets=streetSegments([{points:compoundProfile.segment}],ORIGIN);
const ring=native.geometry.coordinates[0],kx=111320*Math.cos(ORIGIN.lat*Math.PI/180);
const xy=(p:number[])=>[(p[0]-ORIGIN.lng)*kx,(p[1]-ORIGIN.lat)*110540];
const [a,b]=[xy(ring[0]),xy(ring[1])],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
export const compoundFront={x:a[0],y:a[1],ux:(b[0]-a[0])/L,uy:(b[1]-a[1])/L,nx:(b[1]-a[1])/L,ny:-(b[0]-a[0])/L,lengthM:L};
export const compoundPlan=planCompoundFrontage({lengthM:L,baseM:0,topM:Number(native.properties.height),recipe:compoundFixture})!;
