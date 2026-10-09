/** Cached raw DSM evidence: unsampled thin walls remain unsampled, never zero. */
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {readHeightGrid,heightGridSamples} from './height-grid.ts';
const opt=(k:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3);
const gridFile=opt('grid'),surveyFile=opt('survey'),admissionFile=opt('admission'),output=opt('output');
if(!gridFile||!surveyFile||!admissionFile||!output)throw Error('Use --grid=original.tif --survey=survey.json --admission=admission.json --output=new-private-report.json [--tail=47:12.67]');
if(path.resolve(output).startsWith(path.resolve('public')+path.sep))throw Error('Raw height evidence remains private');
try{await fs.access(output);throw Error('Preserve earlier height evidence; use a new report');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const admission=JSON.parse(await fs.readFile(admissionFile,'utf8')),survey=JSON.parse(await fs.readFile(surveyFile,'utf8'));
if(survey.bagId!==admission.officialIdentity.pandId)throw Error('Foreign height evidence owner');
const grid=await readHeightGrid(gridFile),[a,b]=admission.principalFront.orientedLeftToRightAsSeenFromCanal,dx=b[0]-a[0],dy=b[1]-a[1],width=Math.hypot(dx,dy);
if(!Number.isFinite(width)||width<=0)throw Error('Invalid source frontage');
const back=[-dy/width,dx/width],tail=opt('tail')?.split(':'),after=tail?Number(tail[1]):null;
if(tail&&(tail.length!==2||!Number.isFinite(after)))throw Error('Use --tail=surfaceSuffix:depthM');
const surfaces=survey.roofsRD.map((roof:any)=>{
 const id=roof.surfaceId,rings=roof.ringsRD??[roof.vertices],outer=rings[0],holes=rings.slice(1);
 const all=heightGridSamples(grid,outer,undefined,holes),valid=all.filter(s=>s.valid),values=valid.map(s=>s.heightNapM!).sort((a,b)=>a-b);
 const tailSamples=tail&&id.endsWith(':'+tail[0])?heightGridSamples(grid,outer,{origin:a,back,afterM:after!},holes):undefined;
 return {surfaceId:id,pixelCenters:all.length,valid:valid.length,invalid:all.length-valid.length,minNapM:values[0]??null,medianNapM:values.length?values[Math.floor(values.length/2)]:null,maxNapM:values.at(-1)??null,samples:all,...(tailSamples?{tail:{afterDepthM:after,status:tailSamples.length?'sampled;notarchitectureacceptance':'no-pixel-center-coverage',samples:tailSamples}}:{})};
});
if(tail&&!surfaces.some((s:any)=>s.tail))throw Error('Missing requested tail source');
const record={generatedAt:new Date().toISOString(),pandId:survey.bagId,gridFile,gridSHA256:createHash('sha256').update(await fs.readFile(gridFile)).digest('hex'),georeference:{epsg:grid.epsg,origin:grid.origin,step:grid.step,width:grid.width,height:grid.height},epoch:'unknown local survey epoch; service access time is not capture date',status:'bounded-source-samples;no-geometry-acceptance',scope:'Original source-domain pixel-center containment; no neighbor substitution, image-derived heights or unsampled wall extrapolation. DSM pixels can include equipment/vegetation/edge mixing; maxima are not whole-building heights.',surfaces};
await fs.writeFile(output,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({output,surfaces:surfaces.length,tails:surfaces.filter((s:any)=>s.tail).map((s:any)=>s.tail)}));
