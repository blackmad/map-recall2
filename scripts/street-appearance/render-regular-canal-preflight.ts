/** Exact native runtime geometry/atlas CPU diagnostic; not a gameplay/performance acceptance. */
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {regularRowFeatures as features,regularProfiles,regularStreets as streets,regularSamples,regularScopePath,regularTilePath,regularFactsPath} from '../../src/canalRecall/regularCanalNative.fixture.ts';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {runtimePhotoAtlas} from '../jan-evertsen-pilot/runtime-materials.ts';
import {buildFeatureChunk,ORIGIN,type Feature} from '../../src/canalRecall/threeBuildingFeatures.ts';

import {compoundSourceFeature as compoundFeature,compoundSourceProfile as profile,compoundSourceFront as front} from '../../src/canalRecall/compoundSourceCandidate.fixture.ts';
import {adaptSurveyedBuildingEnvelope} from '../../src/canalRecall/surveyedBuildingEnvelope.ts';
import {bindSurveyedEnvelopeToMesh} from '../../src/canalRecall/surveyedEnvelopeMeshBinding.ts';
const envelope=JSON.parse(fs.readFileSync('artifacts/street-appearance/compound-native/surveyed-envelope-binding-candidate.json','utf8'));
const validated=adaptSurveyedBuildingEnvelope(envelope,{nativeParentId:String(compoundFeature.properties.id),footprint:compoundFeature.geometry as any,aggregateHeightM:Number(compoundFeature.properties.height),constructionYear:1650});
if(!validated)throw Error('Source envelope failed exact native admission');
const binding=bindSurveyedEnvelopeToMesh(validated,compoundFeature.geometry as any,ORIGIN);
if(!binding)throw Error('Source envelope cannot bind to native mesh');
const regularEnvelopePath=process.argv.find(a=>a.startsWith('--regular85-envelope='))?.slice('--regular85-envelope='.length);
const regularEnvelopeBytes=regularEnvelopePath?fs.readFileSync(regularEnvelopePath):null;
const regularFeature=regularSamples.find(s=>s.address===85)!.feature;
const regularEnvelope=regularEnvelopeBytes?JSON.parse(regularEnvelopeBytes.toString()):null;
const regularValidated=regularEnvelope?adaptSurveyedBuildingEnvelope(regularEnvelope,{nativeParentId:String(regularFeature.properties.id),footprint:regularFeature.geometry as any,aggregateHeightM:Number(regularFeature.properties.height),constructionYear:Number(regularFeature.properties.constructionYear)}):null;
const regularBinding=regularValidated?bindSurveyedEnvelopeToMesh(regularValidated,regularFeature.geometry as any,ORIGIN):null;
if(regularEnvelopePath&&!regularBinding)throw Error('Official85 source envelope cannot bind to exact native feature');
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'artifacts/regular-canal-front/cycle-1';
if(fs.existsSync(output)&&fs.readdirSync(output).length)throw Error('Recorded comparison cycle already exists; choose a new --output directory');
fs.mkdirSync(output,{recursive:true});
const bindingBytes=Buffer.from(JSON.stringify(binding,null,2)+'\n');
fs.writeFileSync(`${output}/validated-binding.json`,bindingBytes);
if(regularBinding)fs.writeFileSync(`${output}/validated-85-binding.json`,JSON.stringify(regularBinding,null,2)+'\n');
const context:Feature[]=features,atlas=await runtimePhotoAtlas();
const W=1000,H=1000,canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
const rowCentre=[4.89827895,52.37353155],cx=(rowCentre[0]-ORIGIN.lng)*111320*Math.cos(ORIGIN.lat*Math.PI/180),cy=(rowCentre[1]-ORIGIN.lat)*110540;
const report:any={regular85Envelope:regularEnvelopeBytes?{candidatePath:regularEnvelopePath,sha256:createHash('sha256').update(regularEnvelopeBytes).digest('hex'),appliesTo:'after only',nativeHeight:Number(regularFeature.properties.height),nativeYear:Number(regularFeature.properties.constructionYear),scope:'validated official source envelope; photographic clock crown not inferred from survey'}:null,scope:'Exposed-training regular 85/99 body + left raised entry candidate on exact native row. CPU runtime geometry/production atlas diagnostic; no architectural, crown, transfer, browser/GPU or game acceptance',comparison:'Compound87/89 source envelope/profile held fixed both phases. Before85/99 ordinary fallback; after bounded body/door/cornice assembly, plus optional independently validated85surveyroof. Photographic85clock crown unresolved;99surveyroof rejected. No aggregate height/courtyard changes',regularNative:regularSamples.map(s=>({address:s.address,id:s.feature.properties.id,height:s.feature.properties.height,constructionYear:s.feature.properties.constructionYear,frontageM:s.front.lengthM,rings:(s.feature.geometry as any).coordinates.length,recipe:s.fixture})),sourcePhotos:JSON.parse(fs.readFileSync(regularScopePath,'utf8')).inspectedSources.filter((s:any)=>[85,99].includes(s.address)),sourceHashes:Object.fromEntries([regularScopePath,regularTilePath,regularFactsPath].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),ids:features.map(f=>f.properties.id),compoundScopedIds:profile.buildingIds,controlCourtyardRings:(features.find(f=>String(f.properties.id)==='NL.IMBAG.Pand.0363100012178291')!.geometry as any).coordinates.length,factualYear:1650,nativeAggregateHeightM:22.99,roofEnvelope:'Source piecewise wall tops and original surveyed roof surfaces; no whole-parent height replacement',bindingSha256:createHash('sha256').update(bindingBytes).digest('hex'),atlasColourSha256:createHash('sha256').update(atlas.colour).digest('hex'),atlasMaskSha256:createHash('sha256').update(atlas.mask).digest('hex'),atlasSize:atlas.size,atlasLayers:atlas.layers,surveySourceSha256:envelope.source.rawSha256,envelopeCandidateSha256:createHash('sha256').update(fs.readFileSync('artifacts/street-appearance/compound-native/surveyed-envelope-binding-candidate.json')).digest('hex'),rendererSources:Object.fromEntries(['src/canalRecall/threeBuildingMesh.ts','src/canalRecall/threeBuildingFeatures.ts','src/canalRecall/compoundSourceCandidate.fixture.ts','src/canalRecall/surveyedEnvelopeMeshBinding.ts','src/canalRecall/regularCanalNative.fixture.ts','src/canalRecall/regularCanalFrontage.ts','src/canalRecall/streetAppearance.ts','scripts/street-appearance/render-regular-canal-preflight.ts'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),views:[]};
const selectedViews=process.argv.find(a=>a.startsWith('--views='))?.slice(8).split(',');
for(const [view,oblique] of ([['front',0],['oblique',.5],['near85',.25],['near99',.25],['upper85',.25],['upper99',.25],['upper85-low',.25],['upper99-low',.25]] as const).filter(([view])=>!selectedViews||selectedViews.includes(view)))for(const phase of ['before','after'] as const){
 const bindings=new Map([[String(compoundFeature.properties.id),binding]]);
 if(phase==='after'&&regularBinding)bindings.set(String(regularFeature.properties.id),regularBinding);
 const profiles=phase==='after'?[profile,...regularProfiles]:[profile],chunks=['walls','extras'].map(mode=>buildFeatureChunk(features,'photo',mode as 'walls'|'extras',streets,profiles,context,[],bindings));
 const near=view.includes('85')?regularSamples[0]:view.includes('99')?regularSamples[1]:undefined;
 const centreZ=view.startsWith('upper')?16.5:near?5:12.8;
 const viewCx=near?near.front.x+near.front.ux*near.front.lengthM/2:cx,viewCy=near?near.front.y+near.front.uy*near.front.lengthM/2:cy;
 const image=ctx.createImageData(W,H),depth=new Float64Array(W*H).fill(-Infinity);for(let i=0;i<W*H;i++)image.data.set([235,232,222,255],i*4);
 const elevation=view.endsWith('-low')?-.65:.06;
 const eye=[front.nx+front.ux*oblique,front.ny+front.uy*oblique,elevation],right=[front.ux-front.nx*oblique,front.uy-front.ny*oblique,0],up=[-elevation*eye[0],-elevation*eye[1],1+oblique*oblique],norm=(v:number[])=>{const n=Math.hypot(...v);return v.map(x=>x/n);},E=norm(eye),R=norm(right),U=norm(up),dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0),scale=near?70:17;
 for(const chunk of chunks)for(let k=0;k<chunk.indices.length;k+=3){
  const ids=Array.from(chunk.indices.slice(k,k+3)),points=ids.map(i=>[chunk.positions[i*3]-viewCx,chunk.positions[i*3+1]-viewCy,chunk.positions[i*3+2]-centreZ]);
  const a0=points[0],ab=points[1].map((v,i)=>v-a0[i]),ac=points[2].map((v,i)=>v-a0[i]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  if(dot(n,E)<=0)continue;
  const q=points.map(p=>[W/2+dot(p,R)*scale,H/2-dot(p,U)*scale,dot(p,E)]),[a,b,c]=q,area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<1e-8)continue;
  const layer=chunk.layers[ids[0]],tint=Array.from(chunk.tints.slice(ids[0]*4,ids[0]*4+4)),accent=Array.from(chunk.accents.slice(ids[0]*4,ids[0]*4+4));
  for(let y=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1]))));y<=Math.min(H-1,Math.ceil(Math.max(...q.map(p=>p[1]))));y++)for(let x=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0]))));x<=Math.min(W-1,Math.ceil(Math.max(...q.map(p=>p[0]))));x++){
   const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,w=1-u-v;if(Math.min(u,v,w)<0)continue;
   const z=u*a[2]+v*b[2]+w*c[2],j=y*W+x;if(z<=depth[j]+1e-7)continue;depth[j]=z;
   const uv=[0,1].map(axis=>u*chunk.uvs[ids[0]*2+axis]+v*chunk.uvs[ids[1]*2+axis]+w*chunk.uvs[ids[2]*2+axis]);
   const texel=layer*atlas.size*atlas.size+Math.floor(((uv[1]%1+1)%1)*atlas.size)*atlas.size+Math.floor(((uv[0]%1+1)%1)*atlas.size),wall=atlas.mask[texel*2]/255,acc=atlas.mask[texel*2+1]/255;
   for(let d=0;d<3;d++)image.data[j*4+d]=atlas.colour[texel*4+d]*((1-wall)+wall*tint[d]/255)*((1-acc)+acc*accent[d]/255)*tint[3]/255;image.data[j*4+3]=255;
  }
 }
 ctx.putImageData(image,0,0);const file=`${output}/${phase}-${view}.png`;fs.writeFileSync(file,canvas.toBuffer('image/png'));report.views.push({phase,view,file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),triangles:chunks.reduce((n,c)=>n+c.indices.length/3,0)});
}
fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,views:report.views.map((v:any)=>({file:v.file,triangles:v.triangles})),scope:report.scope}));
