/** Source-space study for inspected shapes whose building placement remains
 * unresolved. It deliberately uses an artificial pixel-scaled wall and the
 * compiler's candidate-preview path; nothing returned here is metric evidence. */
import { compileFacadePatches, facadeWallFrame, FACADE_PATCH_COLOURS } from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
import type { FacadeFeature } from '../../src/canalRecall/facadeDescription.ts';

export type SourceShapePreviewInput={features:FacadeFeature[];width:number;height:number;cropSha256:string;captureDate:string};
export function compileSourceShapePreview({features,width,height,cropSha256,captureDate}:SourceShapePreviewInput){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||!/^[a-f0-9]{64}$/i.test(cropSha256)||!captureDate)throw Error('Invalid source-shape preview input');
  const scale=.01,margin=.12,wallWidth=width*scale+margin*2,wallHeight=height*scale+margin*2;
  const owner:any={id:`source-shape:${cropSha256.slice(0,12)}`,geometryRevision:'source-space-unregistered',geometry:{frame:{axes:'x=east,y=up,z=south',originRD:{x:0,y:0},heightDatum:'source-space'},building:{id:`source-shape:${cropSha256.slice(0,12)}`,footprint:{type:'Polygon',coordinates:[[[0,0],[wallWidth,0],[wallWidth,1],[0,1],[0,0]]]},surfaces:[{type:'wall',rings:[[[-margin,-margin,0],[wallWidth-margin,-margin,0],[wallWidth-margin,wallHeight-margin,0],[-margin,wallHeight-margin,0]]]}]}}};
  const image={sha256:cropSha256,date:captureDate,width,height};
  // PreviewBrowser views this normal from -u screen-right. Reverse source X
  // so image left/right remains left/right on screen, while both pixel edges
  // sit exactly one synthetic margin inside the wall frame.
  const record:any={id:`source:${cropSha256.slice(0,12)}`,renderBuildingId:owner.id,renderSurfaceIndices:[0],localStart:[0,0],localEnd:[wallWidth,0],evidenceKey:cropSha256,images:{ground:image},facadeDescription:{version:1,extractionVersion:'source-space-shape-study-v1',buildingId:owner.id,geometryRevision:owner.geometryRevision,evidenceKey:cropSha256,frontage:[[0,0],[wallWidth,0]],surfaceIndices:[0],sources:{ground:{cropSha256,captureDate,imageDimensions:{width,height},openingsComplete:true,features,registration:{status:'ambiguous',uncertaintyM:Infinity,imageToWall:[],surfaceIndex:0,sourceDatum:'NAP',canonicalDatum:'surface-base',pixelConvention:'pixel-edge',preview:{kind:'native-crop-plane',cropSha256,imageDimensions:{width,height},imageToWall:[-scale,0,width*scale+margin,0,-scale,height*scale+margin,0,0,1],note:'Source-space shape study. Synthetic pixel-scaled wall; no building placement or registration claim.'}}}}}};
  const frame=facadeWallFrame(owner.geometry.building.surfaces[0],owner,[owner]);
  if(!frame)throw Error('Synthetic source-space wall unavailable');
  const patches=compileFacadePatches(owner,owner.geometry.building.surfaces[0],0,[record],[owner],{observed:true,candidateRegistrationPreview:true,contextual:false}).filter(p=>p.previewOnly).map(p=>({...p,colour:FACADE_PATCH_COLOURS[p.colour]??p.colour}));
  const counts=Object.fromEntries(['door','window','awning','material','fascia'].map(kind=>[kind,new Set(patches.filter(p=>p.featureKind===`observed-${kind}`).map(p=>p.featureId)).size]));
  return {mode:'source-space-shape-study' as const,owner,frame,patches,counts};
}
