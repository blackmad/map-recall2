/** Bounded dated aerial originals from the same native owners as the recipes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {archiveHttpSource} from './source-fetch.ts';
import {aerialRoofRequest} from './aerial-roof-request.ts';
const opt=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const files=opt('admissions')?.split(','),years=opt('years')?.split(',').map(Number),output=opt('output');
const httpCache=opt('http-cache')?path.resolve(opt('http-cache')!):null;
const fetcher=httpCache?async()=>{throw Error('Missing verified HTTP cache record; acquire original source first');}:undefined;
const surveyFiles=opt('surveys')?.split(',');
if(!files?.length||files.length>12||!years?.length||years.length>2||new Set(years).size!==years.length||!output)throw Error('Use --admissions=id-source-admission.json,... --years=2023,2026 --output=new-private-stage');
const out=path.resolve(output),publicRoot=path.resolve('public');
if(out===publicRoot||out.startsWith(publicRoot+path.sep))throw Error('Raw reference images belong in private staging');
if(httpCache&&(httpCache===publicRoot||httpCache.startsWith(publicRoot+path.sep)))throw Error('Raw HTTP cache must remain private');
try{await fs.access(out);throw Error('Preserve earlier references: use a new output stage');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const admissions=await Promise.all(files.map(async file=>{
 const bytes=await fs.readFile(file),data=JSON.parse(bytes.toString());
 if(!data.officialIdentity?.pandId||!data.native?.surveyFootprintPolygonsRD?.length)throw Error('Missing explicit owner/native footprint');
 return {file,sha256:createHash('sha256').update(bytes).digest('hex'),data};
}));
if(new Set(admissions.map(a=>a.data.officialIdentity.pandId)).size!==admissions.length)throw Error('Duplicate physical owner');
const requests=years.map(year=>aerialRoofRequest(admissions.map(a=>a.data.native.surveyFootprintPolygonsRD),year,Number(opt('padding')??4)));
await fs.mkdir(out,{recursive:true});
const caps=await archiveHttpSource(httpCache??out,'https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?service=WMS&version=1.3.0&request=GetCapabilities',{timeoutMs:20000,fetcher});
const capabilities=caps.bytes.toString();
for(const r of requests)if(!capabilities.includes(`<Name>${r.layer}</Name>`))throw Error('Requested dated layer not advertised');
const views=await Promise.all(requests.map(async request=>{
 const source=await archiveHttpSource(httpCache??out,request.url,{timeoutMs:20000,fetcher});
 const meta=await sharp(source.bytes).metadata();
 if(meta.format!=='jpeg'||meta.width!==request.width||meta.height!==request.height)throw Error('Aerial WMS body is not the requested JPEG');
 const file=`${request.year}-original.jpg`;await fs.writeFile(path.join(out,file),source.bytes,{flag:'wx'});
 return {...request,file,originalSource:source.meta,cached:source.cached,captureDate:null,captureDateScope:'Layer year, not exact local flight timestamp',metricEligible:false};
}));
const plans:any[]=[];
if(surveyFiles){
 const surveys=await Promise.all(surveyFiles.map(async file=>({file,bytes:await fs.readFile(file)})));
 const request=requests[0],scale=3,w=request.width*scale,h=request.height*scale;
 const xy=(p:number[])=>[(p[0]-request.bbox[0])/(request.bbox[2]-request.bbox[0])*w,(request.bbox[3]-p[1])/(request.bbox[3]-request.bbox[1])*h];
 const points=(p:number[][])=>p.map(v=>xy(v).join(',')).join(' ');
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="white"/>`;
 for(const [i,{file,bytes}] of surveys.entries()){
  const survey=JSON.parse(bytes.toString());
  if(!admissions.some(a=>a.data.officialIdentity.pandId===survey.bagId))throw Error('Foreign aerial plan survey');
  for(const [j,roof] of survey.roofsRD.entries()){
   const vertices=roof.vertices.map((v:number[])=>v.slice(0,2)),color=['#9b4f16','#116d85','#693da8','#49823b'][j%4],center=xy(vertices.reduce((s:number[],v:number[])=>[s[0]+v[0]/vertices.length,s[1]+v[1]/vertices.length],[0,0]));
   svg+=`<polygon points="${points(vertices)}" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width="2"/><text x="${center[0]}" y="${center[1]}" font-size="18" fill="${color}">${j}</text>`;
  }
  plans.push({file,surveySHA256:createHash('sha256').update(bytes).digest('hex'),pandId:survey.bagId,legend:survey.roofsRD.map((r:any,j:number)=>({label:j,surfaceId:r.surfaceId}))});
 }
 for(const a of admissions)for(const polygon of a.data.native.surveyFootprintPolygonsRD)for(const ring of polygon)svg+=`<polygon points="${points(ring)}" fill="none" stroke="black" stroke-width="3" stroke-dasharray="8 4"/>`;
 svg+='</svg>';await fs.writeFile(path.join(out,'native-plan.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,'native-plan.png'));
}
const record={generatedAt:new Date().toISOString(),httpCache,provider:'Samenwerkingsverband Beeldmateriaal / PDOK',license:'CC BY; retain provider and license attribution',licenseSource:'https://www.pdok.nl/introductie/-/article/pdok-luchtfoto-rgb-open-',capabilitiesSource:caps.meta,owners:admissions.map(a=>({id:a.data.id,pandId:a.data.officialIdentity.pandId,admissionFile:a.file,admissionSHA256:a.sha256,polygonsRD:a.data.native.surveyFootprintPolygonsRD})),views,limits:['Ground-referenced ortho coordinates do not establish elevated roof ownership exactly; roof displacement/parallax and differing mosaics must be reviewed','Requested sampling resolution is not proof of source accuracy or local ground sample distance','Photos are original references, not texture assets or metric roof heights']};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(record,null,2)+'\n');
if(plans.length){(record as any).nativePlans={plans,file:'native-plan.svg',png:'native-plan.png',bbox:requests[0].bbox,scope:'Separate surveyed plan diagram, not a rectification/roof-to-ground registration or altered source photo'};await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(record,null,2)+'\n');}
console.log(JSON.stringify({output:out,owners:record.owners.length,views:views.length,metricEligible:false}));
