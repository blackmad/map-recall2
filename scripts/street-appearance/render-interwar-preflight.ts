/** Exact native runtime geometry/atlas CPU diagnostic; not a gameplay/performance acceptance. */
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {runtimePhotoAtlas} from '../jan-evertsen-pilot/runtime-materials.ts';
import {decorateFacade} from '../../src/canalRecall/genericFacades.ts';
import {decorateRoof} from '../../src/canalRecall/roofMesh.ts';
import {buildFeatureChunk,ORIGIN,type Feature} from '../../src/canalRecall/threeBuildingFeatures.ts';
import {streetSegments} from '../../src/canalRecall/streetFronts.ts';
import {shortBuildingId} from '../../src/canalRecall/buildingFacts.ts';
import {validateStreetAppearanceCatalog} from '../../src/canalRecall/streetAppearance.ts';
const outputAt=process.argv.indexOf('--output');
if(outputAt>=0&&!process.argv[outputAt+1])throw Error('--output requires a new directory');
const output=outputAt>=0?process.argv[outputAt+1]:'artifacts/jan-evertsen-pilot/window-groups-native';
if(fs.existsSync(output)&&fs.readdirSync(output).length)throw Error(`Refusing to overwrite evidence: ${output}`);
fs.mkdirSync(output,{recursive:true});
const catalogPath='public/data/street-appearance/profiles.json',tilePath='public/data/extracts/amsterdam/building-tiles/14/8412/5384.geojson.gz',factsPath='public/data/extracts/amsterdam/building-facts/14/8412/5384.json.gz';
const catalog=validateStreetAppearanceCatalog(JSON.parse(fs.readFileSync(catalogPath,'utf8'))),profile=catalog.profiles.find(p=>p.id==='jan-evertsen-canopy-candidate-native-pair')!;
if(!profile?.recipes.some(r=>r.recipe.interwarFrontage&&r.recipe.interwarGround))throw Error('Missing current admitted Jan facade/ground profile');
const tile=JSON.parse(gunzipSync(fs.readFileSync(tilePath)).toString()).features as Feature[],facts=JSON.parse(gunzipSync(fs.readFileSync(factsPath)).toString());
const decorate=(f:Feature)=>decorateRoof(decorateFacade({...f,properties:{...f.properties,constructionYear:facts.buildings[shortBuildingId(String(f.properties.id))]?.[0]??null,appearanceStyleSource:'citywide-identity-palette-v3-not-measured'}}));
const features=tile.filter(f=>profile.buildingIds!.includes(String(f.properties.id))).map(decorate);
const context=tile.filter(f=>!profile.buildingIds!.includes(String(f.properties.id))).map(decorate);
const streets=streetSegments(catalog.streetFrontPaths!,ORIGIN),atlas=await runtimePhotoAtlas();
const W=1000,H=1000,canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
const anchor=[4.85209,52.37049],cx=(anchor[0]-ORIGIN.lng)*111320*Math.cos(ORIGIN.lat*Math.PI/180),cy=(anchor[1]-ORIGIN.lat)*110540;
const hash=(p:string)=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),byteHash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const provenance={catalogue:{path:catalogPath,sha256:hash(catalogPath),revision:catalog.revision,profileId:profile.id,profileRevision:profile.revision},sourceHashes:{tile:hash(tilePath),facts:hash(factsPath)},sourceEvidence:profile.evidence,
 codeHashes:Object.fromEntries(['scripts/street-appearance/render-interwar-preflight.ts','scripts/jan-evertsen-pilot/runtime-materials.ts','src/canalRecall/threeBuildingMesh.ts','src/canalRecall/threeBuildingFeatures.ts','src/canalRecall/threeBuildingsBrowser.ts','src/canalRecall/bayTextures.ts'].map(p=>[p,hash(p)])),atlas:{size:atlas.size,layers:atlas.layers,colourSha256:byteHash(atlas.colour),maskSha256:byteHash(atlas.mask)}};
const report:any={scope:'CPU exact geometry and production photo atlas, first-hit zbuffer; no browser, scene/GPU or heldout acceptance',comparison:'Before is ordinary profile-off generator; after is current production catalogue with material repair. This does not reproduce pre-repair failed materials; those remain in material-audit-20261006.',revision:catalog.revision,ids:profile.buildingIds,nativeFacts:features.map(f=>({id:f.properties.id,constructionYear:f.properties.constructionYear,height:f.properties.height})),provenance,views:[]};
for(const [view,oblique] of [['front',0],['oblique',.5]] as const)for(const phase of ['before','after'] as const){
 const profiles=phase==='after'?catalog.profiles:catalog.profiles.filter(p=>p.id!==profile.id),chunks=['walls','extras'].map(mode=>buildFeatureChunk(features,'photo',mode as 'walls'|'extras',streets,profiles,context));
 const image=ctx.createImageData(W,H),depth=new Float64Array(W*H).fill(-Infinity);for(let i=0;i<W*H;i++)image.data.set([235,232,222,255],i*4);
 const eye=[oblique,-1,.18],right=[1,oblique,0],up=[-.18*oblique,.18,1+oblique*oblique],norm=(v:number[])=>{const n=Math.hypot(...v);return v.map(x=>x/n);},E=norm(eye),R=norm(right),U=norm(up),dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0),scale=44;
 for(const chunk of chunks)for(let k=0;k<chunk.indices.length;k+=3){
  const ids=Array.from(chunk.indices.slice(k,k+3)),points=ids.map(i=>[chunk.positions[i*3]-cx,chunk.positions[i*3+1]-cy,chunk.positions[i*3+2]-8]);
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
fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
