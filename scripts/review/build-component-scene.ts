/** Build a provisional strip from automatically detected image components. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {applyFacadeComponents,applyEntranceAssembly} from '../../src/canalRecall/facade/componentGeometry';
const base='public/data/facade-review-galleries/head-on-3d-v1/';
const input=process.argv.find(x=>x.startsWith('--features='))?.slice(11)??'.cache/facade-assessment/banana-head-on-v1/auto-components-strip1/components.json';
const bytes=await fs.readFile(input);const extraction=JSON.parse(bytes.toString());
const sourceBytes=await fs.readFile(base+'strip1-generated.png');if(createHash('sha256').update(sourceBytes).digest('hex')!==extraction.source.imageSha256)throw Error('Component source hash mismatch');
const scene=JSON.parse(await fs.readFile(base+'scene.json','utf8'));const row=scene.rows.find((r:any)=>r.id==='strip1');
const features=extraction.features.map((f:any)=>({...f,bbox:f.bbox??f.bounds??f.normalizedBounds}));
if(features.some((f:any)=>!['window','door','balcony'].includes(f.kind)||f.bbox?.length!==4||f.bbox.some((n:any)=>!Number.isFinite(n)||n<0||n>1)))throw Error('Invalid component contract');
// Railing occludes the lower part of an already detected opening. Extend only a
// uniquely aligned opening, preserving this completion as inferred metadata.
const completions:any[]=[];
for(const balcony of features.filter((f:any)=>f.kind==='balcony')){
 const [l,t,r,b]=balcony.bbox,cx=(l+r)/2;
 const matches=features.filter((f:any)=>f.kind==='window'&&f.bbox[0]<cx&&f.bbox[2]>cx&&f.bbox[1]<t&&f.bbox[3]>=t-.015&&f.bbox[3]<b&&b-f.bbox[3]<(f.bbox[3]-f.bbox[1])*1.6);
 if(matches.length===1){const f=matches[0];completions.push({id:f.id,balcony:balcony.id,originalBounds:[...f.bbox],status:'inferred-behind-railing'});f.bbox=[f.bbox[0],f.bbox[1],f.bbox[2],b-.004];}
}
const result=applyFacadeComponents(row.roofRepair.meshes,features);
// Geometry acceptance determines which original painted projections can be removed.
const skipped=new Set(result.stats.skipped.map((s:any)=>s.id));
const cleanup=features.filter((f:any)=>f.kind==='balcony'&&!skipped.has(f.id)).map((f:any)=>({bbox:f.bbox,colour:f.wallColour??'#946957'}));
const output={...row,id:'components',textureId:'strip1',label:'Components + reviewed entrance',roofRepair:undefined,
 meshes:result.meshes.map((m:any)=>({...m,...(m.textured?{cleanup:m.id.includes('component:')?cleanup.map((c:any)=>({...c,colour:'#536267'})):cleanup}: {})})),
 notes:['Automatic image candidates; inferred depths. Balcony paint is replaced locally by sampled masonry. Registration and classification remain provisional.'],
 componentExtraction:{path:input,sha256:createHash('sha256').update(bytes).digest('hex'),stats:result.stats,inferredCompletions:completions,cleanupCount:cleanup.length}};
const entranceBytes=await fs.readFile('review-data/facade-vector-pilot/head-on-3d-v1/entrance-assembly.json');
const fixture=JSON.parse(entranceBytes.toString());
if(fixture.sourceSha256!==extraction.source.imageSha256)throw Error('Entrance fixture source changed');
const outline=fixture.outlinePixels.map(([x,y]:number[])=>[x/fixture.imageSize[0],y/fixture.imageSize[1]]);
const minX=Math.min(...outline.map((p:number[])=>p[0])),maxX=Math.max(...outline.map((p:number[])=>p[0]));
const minY=Math.min(...outline.map((p:number[])=>p[1])),maxY=Math.max(...outline.map((p:number[])=>p[1]));
const unaffected=features.filter((f:any)=>(f.kind==='balcony'||f.bbox[1]<.78)&&(f.bbox[2]<=minX||f.bbox[0]>=maxX||f.bbox[3]<=minY||f.bbox[1]>=maxY));
const withoutOldCuts=applyFacadeComponents(row.roofRepair.meshes,unaffected);
const entrance=applyEntranceAssembly(withoutOldCuts.meshes,{...fixture,outline});
const postCleanup=(fixture.postCleanup??[]).map((f:any)=>({bbox:f.pixels.map((v:number,i:number)=>v/fixture.imageSize[i%2]),colour:f.colour}));
const withEntrance={...output,entranceRepair:{meshes:entrance.meshes.map((m:any)=>({...m,...(m.textured?{cleanup:m.id.includes('component:')?cleanup.map((c:any)=>({...c,colour:'#536267'})):[...cleanup,...postCleanup]}: {})})),stats:entrance.stats,fixtureSha256:createHash('sha256').update(entranceBytes).digest('hex'),fixture}};
await fs.writeFile(base+'entrance-stats.json',JSON.stringify(entrance.stats,null,2));
await fs.writeFile(base+'component-scene.json',JSON.stringify(withEntrance));
await fs.writeFile(base+'component-stats.json',JSON.stringify(output.componentExtraction,null,2));
console.log(JSON.stringify(output.componentExtraction));
