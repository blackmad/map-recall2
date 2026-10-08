/** Native production-generator probe. GLBs embed the production facade atlas, masks, tints and face shade. */
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {KHRMaterialsUnlit} from '@gltf-transform/extensions';
import {runtimePhotoAtlas,bakeRuntimeMaterial} from './runtime-materials.ts';
import {buildFeatureChunk,ORIGIN,type Feature} from '../../src/canalRecall/threeBuildingFeatures.ts';
import {decorateFacade} from '../../src/canalRecall/genericFacades.ts';
import {decorateRoof} from '../../src/canalRecall/roofMesh.ts';
import {shortBuildingId} from '../../src/canalRecall/buildingFacts.ts';
import {streetSegments} from '../../src/canalRecall/streetFronts.ts';
import {extraUsage} from '../../src/canalRecall/facadeExtras.ts';
import {validateStreetAppearanceCatalog} from '../../src/canalRecall/streetAppearance.ts';

const outputAt=process.argv.indexOf('--output');
if(outputAt>=0&&!process.argv[outputAt+1])throw Error('--output requires a new directory');
const output=outputAt>=0?process.argv[outputAt+1]:'artifacts/jan-evertsen-pilot/procedural';
if(fs.existsSync(output)&&fs.readdirSync(output).length)throw Error(`Refusing to overwrite evidence: ${output}`);
fs.mkdirSync(output,{recursive:true});
const catalogPath='public/data/street-appearance/profiles.json';
const catalog=validateStreetAppearanceCatalog(JSON.parse(fs.readFileSync(catalogPath,'utf8')));
const profile=catalog.profiles.find(p=>p.id==='jan-evertsen-canopy-candidate-native-pair');
if(!profile||!profile.recipes.some(r=>r.recipe.interwarFrontage&&r.recipe.interwarGround))throw Error('Missing current admitted Jan facade/ground profile');
const specs=JSON.parse(fs.readFileSync('scripts/jan-evertsen-pilot/native-specs.json','utf8'));
const tilePath='public/data/extracts/amsterdam/building-tiles/14/8412/5384.geojson.gz';
const factsPath='public/data/extracts/amsterdam/building-facts/14/8412/5384.json.gz';
const sourceImage='artifacts/jan-evertsen-pilot/private-source-stage/user-streetview-original.png';
const hash=(p:string)=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const userImageHash=fs.existsSync(sourceImage)?hash(sourceImage):specs[0].source.userImageSha256;
if(!/^[a-f0-9]{64}$/.test(userImageHash))throw Error('Missing archived source image checksum');
const tile=JSON.parse(gunzipSync(fs.readFileSync(tilePath)).toString());
const facts=JSON.parse(gunzipSync(fs.readFileSync(factsPath)).toString());
const decorate=(f:Feature)=>{
  const fact=facts.buildings[shortBuildingId(String(f.properties.id))];
  return decorateRoof(decorateFacade({...f,properties:{...f.properties,appearanceStyleSource:'citywide-identity-palette-v3-not-measured',constructionYear:fact?.[0]??null}}));
};
const native:Feature[]=specs.map((s:any)=>{const f=tile.features.find((f:Feature)=>f.properties.id===s.sourceBuildingId);if(!f)throw Error(`Missing native feature ${s.sourceBuildingId}`);return decorate(f);});
if(native.some(f=>!profile.buildingIds?.includes(String(f.properties.id))))throw Error('Spec lies outside admitted primary pair');
const profilePath=`${output}/production-catalogue.json`;
fs.writeFileSync(profilePath,JSON.stringify(catalog,null,2)+'\n');
const streets=streetSegments(catalog.streetFrontPaths!,ORIGIN),reports:any[]=[];
const atlas=await runtimePhotoAtlas();
const byteHash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const provenance={catalogue:{path:catalogPath,sha256:hash(catalogPath),revision:catalog.revision,profileId:profile.id,profileRevision:profile.revision},
 sourceEvidence:profile.evidence,codeHashes:Object.fromEntries(['scripts/jan-evertsen-pilot/procedural-preview.ts','scripts/jan-evertsen-pilot/runtime-materials.ts','src/canalRecall/threeBuildingMesh.ts','src/canalRecall/threeBuildingFeatures.ts','src/canalRecall/threeBuildingsBrowser.ts','src/canalRecall/bayTextures.ts'].map(p=>[p,hash(p)])),
 atlas:{size:atlas.size,layers:atlas.layers,colourSha256:byteHash(atlas.colour),maskSha256:byteHash(atlas.mask)}};
for(const [i,spec] of specs.entries()){
  const f=native[i],id=spec.id.replace('native','procedural');
  // Neighbors use the same ordinary decoration and visibility tests; no suppression or padding.
  const neighborIds=new Set([...spec.retainedNeighborIds,...specs.map((s:any)=>s.sourceBuildingId)].filter(id=>id!==spec.sourceBuildingId));
  const context=tile.features.filter((f:Feature)=>neighborIds.has(f.properties.id)).map(decorate);
  const records:any[]=[],previous=extraUsage.record;
  const walls=buildFeatureChunk([f],'photo','walls',streets,catalog.profiles,context);
  let extras;
  try{extraUsage.record=(c,used,triangles)=>records.push({wallKey:c.wallKey,streetSide:c.streetSide,canopyOwner:c.canopyOwner,runLength:c.canopyFrames?.reduce((n,f)=>n+f.len,0),used,triangles});
    extras=buildFeatureChunk([f],'photo','extras',streets,catalog.profiles,context);
  }finally{extraUsage.record=previous;}
  if(records.filter(r=>r.used.includes('continuous-shop-canopy')).length!==1)throw Error(`${id}: expected one production canopy`);
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(id),mesh=doc.createMesh(id);doc.getRoot().setDefaultScene(scene);const unlit=doc.createExtension(KHRMaterialsUnlit);
  const centerE=(spec.anchor[0]-ORIGIN.lng)*111320*Math.cos(ORIGIN.lat*Math.PI/180),centerN=(spec.anchor[1]-ORIGIN.lat)*110540;
  for(const [mode,chunk] of [['walls',walls],['extras',extras]] as const){
    const groups=new Map<string,{p:number[];n:number[];uv:number[]}>();
    for(let k=0;k<chunk.indices.length;k+=3){
      const indices=Array.from(chunk.indices.slice(k,k+3)),first=indices[0];
      const tint=Array.from(chunk.tints.slice(first*4,first*4+4)),accent=Array.from(chunk.accents.slice(first*4,first*4+4)),key=[chunk.layers[first],...tint,...accent].join(',');
      if(indices.some(v=>chunk.layers[v]!==chunk.layers[first]||tint.some((c,i)=>chunk.tints[v*4+i]!==c)||accent.some((c,i)=>chunk.accents[v*4+i]!==c)))throw Error('Atlas export requires per-face constant runtime material');
      const group=groups.get(key)??{p:[],n:[],uv:[]};groups.set(key,group);
      const points=indices.map(v=>[chunk.positions[v*3]-centerE,chunk.positions[v*3+2],-(chunk.positions[v*3+1]-centerN)]);
      const ab=points[1].map((v,i)=>v-points[0][i]),ac=points[2].map((v,i)=>v-points[0][i]);
      const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal)||1;
      group.p.push(...points.flat());for(const v of indices){group.n.push(...normal.map(n=>n/length));group.uv.push(chunk.uvs[v*2],1-chunk.uvs[v*2+1]);}
    }
    for(const [key,g] of groups){
      const fields=key.split(',').map(Number),texture=doc.createTexture(`runtime-${mode}-${key}`).setMimeType('image/png').setImage(bakeRuntimeMaterial(atlas,fields[0],fields.slice(1,5),fields.slice(5,9)));
      const mat=doc.createMaterial(`${mode}-${key}`).setBaseColorFactor([1,1,1,1]).setBaseColorTexture(texture).setRoughnessFactor(.9).setExtension('KHR_materials_unlit',unlit.createUnlit());
      mat.getBaseColorTextureInfo()!.setWrapS(10497).setWrapT(10497).setMagFilter(9729).setMinFilter(9987);
      const attribute=(type:'VEC3'|'VEC2',array:number[])=>doc.createAccessor().setType(type).setArray(Float32Array.from(array)).setBuffer(buffer);
      mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',attribute('VEC3',g.p)).setAttribute('NORMAL',attribute('VEC3',g.n)).setAttribute('TEXCOORD_0',attribute('VEC2',g.uv)).setMaterial(mat));
    }
    fs.writeFileSync(`${output}/${id}-${mode}-runtime-chunk.json`,JSON.stringify(Object.fromEntries(Object.entries(chunk).map(([k,v])=>[k,ArrayBuffer.isView(v)?Array.from(v as any):v])))+'\n');
  }
  scene.addChild(doc.createNode(id).setMesh(mesh));const modelPath=`${output}/${id}.glb`;await new NodeIO().registerExtensions([KHRMaterialsUnlit]).write(modelPath,doc);
  const report={...spec,id,modelPath,productionGenerator:'buildFeatureChunk/photo/walls+extras',productionSourceId:f.properties.id,constructionYear:f.properties.constructionYear,
    observedCanopyOwners:records.filter(r=>r.used.includes('continuous-shop-canopy')),wallTriangles:walls.indices.length/3,extraTriangles:extras.indices.length/3,
    sourceHashes:{tile:hash(tilePath),facts:hash(factsPath),userImage:userImageHash},profilePath,provenance,modelSha256:hash(modelPath),
    textureStatus:'Embedded production photo atlas with wall/accent masks, tints, UV repeat and face shade baked into unlit materials. Original runtime chunks retained alongside exports.',
    visualAcceptance:'Existing primary pair only; material repair diagnostic. No new admission; final source/gallery/game/performance review pending'};
  fs.writeFileSync(`${output}/${id}.json`,JSON.stringify(report,null,2)+'\n');reports.push(report);
  console.log(JSON.stringify({id,year:report.constructionYear,wallTriangles:report.wallTriangles,extraTriangles:report.extraTriangles,canopies:report.observedCanopyOwners.length,modelPath}));
}
fs.writeFileSync(`${output}/report.json`,JSON.stringify({status:'current-production-profile-material-repair-preview',runtimeInstallation:false,newAdmissions:0,provenance,reports},null,2)+'\n');
