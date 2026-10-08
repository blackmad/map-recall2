/** Node-only, exposed-training capability fixture. Zero public/runtime admissions.
 * All facade dimensions below are rounded SOURCE APPROXIMATIONS, not surveys.
 * Native heights, factual years, footprints and crown ownership are unchanged. */
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decorateFacade} from './genericFacades.js';
import {ORIGIN,type Feature} from './threeBuildingFeatures.js';
import {streetSegments} from './streetFronts.js';
import type {ArchitecturalRecipe,StreetAppearanceProfile} from './streetAppearance.js';
import {planRegularCanalFrontage,type RegularCanalFrontageRecipe} from './regularCanalFrontage.js';
import {compoundSourceFeature,compoundSourceProfile} from './compoundSourceCandidate.fixture.js';
export const regularScopePath='docs/references/regular-canal-front-scope-20261006.json';
export const regularScope=JSON.parse(readFileSync(regularScopePath,'utf8'));
export const regularTilePath='public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz';
export const regularFactsPath='public/data/extracts/amsterdam/building-facts/14/8414/5384.json.gz';
const tile=JSON.parse(gunzipSync(readFileSync(regularTilePath)).toString()).features as Feature[];
const facts=JSON.parse(gunzipSync(readFileSync(regularFactsPath)).toString()).buildings;
const ids=['0363100012178296','0363100012178298','0363100012178233','0363100012178232','0363100012178300','0363100012178299','0363100012178291'].map(id=>'NL.IMBAG.Pand.'+id);
export const regularRowFeatures:Feature[]=tile.filter(f=>ids.includes(String(f.properties.id))).map(f=>String(f.properties.id)===String(compoundSourceFeature.properties.id)?compoundSourceFeature:decorateFacade({...f,properties:{...f.properties,constructionYear:facts['P'+String(f.properties.id).replace('NL.IMBAG.Pand.','')]?.[0]||null,appearanceStyleSource:'citywide-identity-palette-v3-not-measured'}}));
if(regularRowFeatures.length!==7)throw Error('Missing exact installed row parent');
const row=(bottomM:number,heightM:number,widthM:number,paneRows:1|2|3|4=2,paneColumns:1|2|3=2)=>({bottomM,heightM,widthM,paneColumns,paneRows});
export const regular85Recipe:RegularCanalFrontageRecipe={columns:3,insetM:.35,frameWidthM:.075,recessDepthM:.16,
 doorPanels:{columns:1,rows:2},
 upperRows:[row(6.4,2.4,1.05),row(9.5,2.0,1.05),row(12.2,1.5,1.05)],ground:row(2.2,3.6,1.05,3),
 entrance:{leafHeightM:2.6,stepCount:8,treadM:.24,landingDepthM:.55,stairWidthM:1.2,railHeightM:.85},
 basement:{heightM:2.2,access:{axisIndex:2,bottomM:0,heightM:1.9,widthM:.9},window: {...row(.35,.7,.75,1),axisIndex:1}}};
export const regular99Recipe:RegularCanalFrontageRecipe={columns:3,insetM:.55,frameWidthM:.085,recessDepthM:.18,
 doorPanels:{columns:2,rows:2},
 cornice:{heightM:.28,projectionM:.40,blockCount:12,blockWidthM:.20,blockHeightM:.24,blockProjectionM:.25,hoist:{widthM:.14,heightM:.14,projectionM:1.0}},
 upperRows:[row(7.0,2.7,1.5,3,3),row(10.5,2.1,1.5,2,3),row(13.3,1.7,1.5,2,3),row(15.7,1.25,1.5,2,3)],ground:row(2.4,4.0,1.5,4,3),
 entrance:{leafHeightM:2.6,stepCount:9,treadM:.25,landingDepthM:.65,stairWidthM:1.65,railHeightM:.9},
 basement:{heightM:2.4,access:{axisIndex:2,bottomM:0,heightM:2.05,widthM:1.4},window:{...row(.2,1.8,1.25,3),axisIndex:1}}};
export const regularDiagnosticSegment=[[4.89865,52.37386],[4.897677,52.373114]] as const;
export const regularSamples=[85,99].map(address=>{
 const inventory=regularScope.inventory.find((s:any)=>s.address===address),feature=regularRowFeatures.find(f=>String(f.properties.id)===inventory.buildingId)!;
 const ring=(feature.geometry as {coordinates:number[][][]}).coordinates[0],kx=111320*Math.cos(ORIGIN.lat*Math.PI/180);
 const xy=(p:number[])=>[(p[0]-ORIGIN.lng)*kx,(p[1]-ORIGIN.lat)*110540];
 const target=xy(inventory.frontageTarget);
 const edges=ring.slice(0,-1).map((p,i)=>{const a=xy(p),b=xy(ring[i+1]);return{a,b,d:Math.hypot((a[0]+b[0])/2-target[0],(a[1]+b[1])/2-target[1])};}).sort((a,b)=>a.d-b.d);
 const {a,b}=edges[0],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
 const front={x:a[0],y:a[1],ux:(b[0]-a[0])/L,uy:(b[1]-a[1])/L,nx:(b[1]-a[1])/L,ny:-(b[0]-a[0])/L,lengthM:L};
 const fixture=address===85?regular85Recipe:regular99Recipe;
 const recipe:ArchitecturalRecipe={family:'masonry',period:'canal',confidence:.65,wallMaterial:'brick',wallHex:address===85?'#635b52':'#594f46',frameHex:address===85?'#d9d7c7':'#eeeeDF',sash:'transom',balconyPolicy:'assembly-only',regularCanalFrontage:fixture};
 const profile:StreetAppearanceProfile={...structuredClone(compoundSourceProfile),id:`regular-canal-${address}-diagnostic-only`,revision:'source-approximation-cycle-1',segment:regularDiagnosticSegment,buildingIds:[inventory.buildingId],recipes:[{weight:1,frontageMin:4,frontageMax:10,heightMin:12,heightMax:22,recipe}],evidence:regularScope.inspectedSources.filter((s:any)=>s.address===address).map((s:any)=>({id:`exposed-${address}`,kind:'municipal-panorama',captureDate:s.captureDate,sha256:s.sha256,inference:'agent-visual-review',quality:.8,notes:'Exposed training; rounded inferred facade proportions, not metric survey. Crown not owned by this planner.'}))};
 const plan=planRegularCanalFrontage({lengthM:L,baseM:0,topM:Number(feature.properties.height),recipe:fixture});
 if(!plan)throw Error(`Regular source approximation fails native ${address} fit ${L}`);
 return{address,feature,front,fixture,recipe,profile,plan};
});
export const regularStreets=streetSegments([{points:regularDiagnosticSegment}],ORIGIN);
export const regularProfiles=regularSamples.map(s=>s.profile);
export const regularControls=regularRowFeatures.filter(f=>!regularSamples.some(s=>s.feature===f));
