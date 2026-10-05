/** Native production-generator probe. GLBs preserve geometry/colors; facade atlas is separate. */
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {buildFeatureChunk,ORIGIN,type Feature} from '../../src/canalRecall/threeBuildingFeatures.ts';
import {decorateFacade} from '../../src/canalRecall/genericFacades.ts';
import {shortBuildingId} from '../../src/canalRecall/buildingFacts.ts';
import {streetSegments} from '../../src/canalRecall/streetFronts.ts';
import {extraUsage} from '../../src/canalRecall/facadeExtras.ts';
import {compileStreetAppearanceAssignments,streetAppearanceFrontageRecords,validateStreetAppearanceCatalog,type StreetAppearanceProfile,type StreetPoint} from '../../src/canalRecall/streetAppearance.ts';

const output='artifacts/jan-evertsen-pilot/procedural';fs.mkdirSync(output,{recursive:true});
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
  return decorateFacade({...f,properties:{...f.properties,appearanceStyleSource:'citywide-identity-palette-v3-not-measured',constructionYear:fact?.[0]??null}});
};
const native:Feature[]=specs.map((s:any)=>{const f=tile.features.find((f:Feature)=>f.properties.id===s.sourceBuildingId);if(!f)throw Error(`Missing native feature ${s.sourceBuildingId}`);return decorate(f);});
const segment:readonly [StreetPoint,StreetPoint]=[[4.851836,52.37036],[4.852514,52.37048]];
const profile:StreetAppearanceProfile={id:'jan-evertsen-canopy-candidate-native-pair',streetName:'Jan Evertsenstraat',revision:'unaccepted-native-generator-probe-v1',
  segment,side:1,reachM:15,confidence:.8,assemblyM:6,status:'pilot',
  recipes:[{weight:1,priority:0,yearMin:1920,yearMax:1940,heightMin:10,heightMax:20,frontageMin:5,frontageMax:7,
    recipe:{family:'masonry',period:'school',confidence:.8,wallHex:'#92775c',frameHex:'#e5e5d8',frameColor:'pale',wallMaterial:'brick',
      balconyPolicy:'assembly-only',detailPolicy:'architectural',trim:{frames:.5,lintels:0,cornice:0,courses:0,quoins:0,arches:0},
      shopCanopy:{kind:'continuous-rigid',projectionM:.85,fasciaHeightM:.24,fasciaHex:'#dedbd2',edgeHex:'#454b49'}}}],
  evidence:[{id:'user-streetview-shop-canopy',kind:'user-reference',sha256:userImageHash,inference:'agent-visual-review',quality:.8,
    notes:'User crop shows long rigid dark rounded canopy edge and pale fascia below masonry. Candidate identity/address unconfirmed; upper facade and roof cropped. No visual acceptance; approximate street axis.'}]};
const fronts=specs.map((s:any,i:number)=>({building:{id:s.sourceBuildingId,year:Number(native[i].properties.constructionYear)||null,heightM:Number(native[i].properties.height)},
  wall:{start:s.frontage.vertices[0],end:s.frontage.vertices[1],normal:[s.frontage.outwardEastSouth[0],-s.frontage.outwardEastSouth[1]] as [number,number]}}));
const assignments=compileStreetAppearanceAssignments([profile],fronts);
profile.frontages=streetAppearanceFrontageRecords(profile,assignments);
if(profile.frontages.length!==2)throw Error('Native source cohort did not admit both real1925 fronts');
const catalog=validateStreetAppearanceCatalog({schemaVersion:1,revision:profile.revision,profiles:[profile],streetFrontPaths:[{highway:'tertiary',points:segment}]});
fs.writeFileSync('docs/references/jan-evertsen-pilot/procedural-profile.json',JSON.stringify({...catalog,previewOnly:true,sourceArchive:{commit:specs[0].source.privateSourceCommit,path:'models/jan-evertsen-north-canopy-pilot/'},visualAcceptance:'pending; not installed at runtime'},null,2)+'\n');
const streets=streetSegments(catalog.streetFrontPaths!,ORIGIN),reports:any[]=[];
for(const [i,spec] of specs.entries()){
  const f=native[i],id=spec.id.replace('native','procedural');
  // Neighbors use the same ordinary decoration and visibility tests; no suppression or padding.
  const neighborIds=new Set([...spec.retainedNeighborIds,...specs.map((s:any)=>s.sourceBuildingId)].filter(id=>id!==spec.sourceBuildingId));
  const context=tile.features.filter((f:Feature)=>neighborIds.has(f.properties.id)).map(decorate);
  const records:any[]=[],previous=extraUsage.record;
  const walls=buildFeatureChunk([f],'photo','walls',streets,[profile],context);
  let extras;
  try{extraUsage.record=(c,used,triangles)=>records.push({wallKey:c.wallKey,streetSide:c.streetSide,canopyOwner:c.canopyOwner,runLength:c.canopyFrames?.reduce((n,f)=>n+f.len,0),used,triangles});
    extras=buildFeatureChunk([f],'photo','extras',streets,[profile],context);
  }finally{extraUsage.record=previous;}
  if(records.filter(r=>r.used.includes('continuous-shop-canopy')).length!==1)throw Error(`${id}: expected one production canopy`);
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(id),mesh=doc.createMesh(id);doc.getRoot().setDefaultScene(scene);
  const centerE=(spec.anchor[0]-ORIGIN.lng)*111320*Math.cos(ORIGIN.lat*Math.PI/180),centerN=(spec.anchor[1]-ORIGIN.lat)*110540;
  for(const [mode,chunk] of [['walls',walls],['extras',extras]] as const){
    const groups=new Map<string,{p:number[];n:number[];uv:number[]}>();
    for(let k=0;k<chunk.indices.length;k+=3){
      const indices=Array.from(chunk.indices.slice(k,k+3)),first=indices[0];
      const rgb=Array.from(chunk.tints.slice(first*4,first*4+3)),key=rgb.join(',');
      const group=groups.get(key)??{p:[],n:[],uv:[]};groups.set(key,group);
      const points=indices.map(v=>[chunk.positions[v*3]-centerE,chunk.positions[v*3+2],-(chunk.positions[v*3+1]-centerN)]);
      const ab=points[1].map((v,i)=>v-points[0][i]),ac=points[2].map((v,i)=>v-points[0][i]);
      const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal)||1;
      group.p.push(...points.flat());for(const v of indices){group.n.push(...normal.map(n=>n/length));group.uv.push(chunk.uvs[v*2],chunk.uvs[v*2+1]);}
    }
    for(const [key,g] of groups){
      const linear=key.split(',').map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
      const mat=doc.createMaterial(`${mode}-${key}`).setBaseColorFactor([...linear,1] as [number,number,number,number]).setRoughnessFactor(.9);
      const attribute=(type:'VEC3'|'VEC2',array:number[])=>doc.createAccessor().setType(type).setArray(Float32Array.from(array)).setBuffer(buffer);
      mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',attribute('VEC3',g.p)).setAttribute('NORMAL',attribute('VEC3',g.n)).setAttribute('TEXCOORD_0',attribute('VEC2',g.uv)).setMaterial(mat));
    }
    fs.writeFileSync(`${output}/${id}-${mode}-runtime-chunk.json`,JSON.stringify(Object.fromEntries(Object.entries(chunk).map(([k,v])=>[k,ArrayBuffer.isView(v)?Array.from(v as any):v])))+'\n');
  }
  scene.addChild(doc.createNode(id).setMesh(mesh));const modelPath=`${output}/${id}.glb`;await new NodeIO().write(modelPath,doc);
  const report={...spec,id,modelPath,productionGenerator:'buildFeatureChunk/photo/walls+extras',productionSourceId:f.properties.id,constructionYear:f.properties.constructionYear,
    observedCanopyOwners:records.filter(r=>r.used.includes('continuous-shop-canopy')),wallTriangles:walls.indices.length/3,extraTriangles:extras.indices.length/3,
    sourceHashes:{tile:hash(tilePath),facts:hash(factsPath),userImage:userImageHash},profilePath:'docs/references/jan-evertsen-pilot/procedural-profile.json',
    textureStatus:'Geometry/colors only inGLB; runtime UV/layer/tint/accents preserved in sidecar. No atlas embedded, soGLB omits painted windows and doors. This is not full ordinary-facade visual evidence.',
    visualAcceptance:'unaccepted candidate; photographed identity, upper facade, roof, game scene and performance pending'};
  fs.writeFileSync(`${output}/${id}.json`,JSON.stringify(report,null,2)+'\n');reports.push(report);
  console.log(JSON.stringify({id,year:report.constructionYear,wallTriangles:report.wallTriangles,extraTriangles:report.extraTriangles,canopies:report.observedCanopyOwners.length,modelPath}));
}
fs.writeFileSync(`${output}/report.json`,JSON.stringify({status:'unaccepted-production-geometry-probe',runtimeInstallation:false,reports},null,2)+'\n');
