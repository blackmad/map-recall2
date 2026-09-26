/** Publish a local evidence report only after source and capture hash checks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const bytes=await fs.readFile('public/data/wall-materials/assignments.json'),assignments=JSON.parse(bytes.toString());
const grades=new Map<number,any>();
for(const [name,run] of [['render-pass3-luna','pass-3'],['render-pass3-terra','pass-3'],['render-pass4-terra','pass-4'],['render-pass4-sol','pass-4']]){
 const filename=`review-data/wall-colour/visual-loop/${name}.json`;
 const doc=JSON.parse(await fs.readFile(filename,'utf8'));const captureBytes=await fs.readFile(`.cache/wall-material-demo/${run}/captures.json`),captures=JSON.parse(captureBytes.toString());
 if(captures.assignmentSha256!==hash(bytes)||doc.captureManifestSha256&&doc.captureManifestSha256!==hash(captureBytes)||doc.assignmentSha256&&doc.assignmentSha256!==hash(bytes))throw Error(`Stale report ${name}`);
 for(const raw of doc.entries){const e={...raw,verdict:raw.verdict==='accept-family-only'?'accepted-material-family':raw.verdict};const a=assignments.entries[e.index],c=captures.results.find((x:any)=>x.index===e.index);if(!a||!c||e.buildingId!==a.buildingId||e.observationId!==a.observationId||e.sourceSha256!==a.sourceSha256||!['accepted-material-family','revise','unresolved'].includes(e.verdict))throw Error(`Invalid review ${name}:${e.index}`);
  if(a.materialId==='unknownneutral'&&e.verdict==='accepted-material-family')throw Error('Unknown material cannot be accepted');
  const published:Record<string,{url:string;sha256:string}>={};
  for(const [key,cap] of Object.entries(c.captures) as [string,any][]){const image=await fs.readFile(`.cache/wall-material-demo/${run}/${cap.file}`);if(hash(image)!==cap.sha256)throw Error(`Changed capture ${cap.file}`);const reviewHash=e.imageSha256?.[key]??e.evidence?.[key==='preview-front'?'front':key==='preview-oblique'?'oblique':key]?.sha256;if(reviewHash&&reviewHash!==cap.sha256)throw Error(`Review capture mismatch ${name}:${key}`);const url=`/data/wall-materials/review-images/${cap.sha256}.png`;await fs.mkdir(path.dirname(`public${url}`),{recursive:true});await fs.writeFile(`public${url}`,image);published[key]={url,sha256:cap.sha256};}
  const panel=await fs.readFile(`.cache/wall-material-demo/${run}/${String(e.index).padStart(3,'0')}-panel.png`);if(e.imageSha256?.panel&&hash(panel)!==e.imageSha256.panel)throw Error('Changed panel');const panelUrl=`/data/wall-materials/review-images/${hash(panel)}.png`;await fs.writeFile(`public${panelUrl}`,panel);
  const focusedMeta=JSON.parse(await fs.readFile(`.cache/wall-material-demo/${run}/${String(e.index).padStart(3,'0')}-focus.json`,'utf8'));const focusedBytes=await fs.readFile(`.cache/wall-material-demo/${run}/${focusedMeta.focusedFile}`);if(hash(focusedBytes)!==focusedMeta.focusedSha256||focusedMeta.normalSha256!==c.captures['preview-front'].sha256||focusedMeta.identitySha256!==c.captures.identity.sha256)throw Error('Stale focused capture');const focusedUrl=`/data/wall-materials/review-images/${focusedMeta.focusedSha256}.png`;await fs.writeFile(`public${focusedUrl}`,focusedBytes);
  let reviewerFocusedImage=null;if(e.imageSha256?.['focused-target']){const enlarged=await sharp(focusedBytes).resize({height:600}).png().toBuffer();if(hash(enlarged)!==e.imageSha256['focused-target'])throw Error('Reviewed focused crop mismatch');const url=`/data/wall-materials/review-images/${hash(enlarged)}.png`;await fs.writeFile(`public${url}`,enlarged);reviewerFocusedImage={url,sha256:hash(enlarged),transform:'identity-bound crop resized to 600px high, without colour adjustment'};}
  const previous=grades.get(e.index);const reviewHistory=[...(previous?.reviewHistory??[]),...(previous?[{reviewer:previous.reviewer,run:previous.run,verdict:previous.verdict,reason:previous.reason,reviewFile:previous.reviewFile}]:[])];
  grades.set(e.index,{reviewerFocusedImage,focused:{...focusedMeta,url:focusedUrl},reviewHistory,...e,address:a.address,crop:a.crop,reviewer:doc.reviewer,run,reviewFile:filename,reviewFileSha256:hash(await fs.readFile(filename)),captureManifestSha256:hash(captureBytes),bundleSha256:captures.bundleSha256,panel:panelUrl,images:published});
 }
}
if(grades.size!==10||assignments.gate.some((i:number)=>!grades.has(i)))throw Error('Incomplete ten-case gate');
const cases=[...grades.values()].sort((a,b)=>a.index-b.index);
const report={version:1,scope:'Broad wall material family in reference-bound game views; not exact texture reconstruction or building-wide accuracy',baselineReleaseId:assignments.baselineReleaseId,assignmentSha256:hash(bytes),currentBundleSha256:hash(await fs.readFile('public/canal-drive/js/wall-material-demo.bundle.js')),sourceAssessments:assignments.entries.length,unresolvedSourceMaterials:assignments.entries.filter((e:any)=>e.materialId==='unknownneutral').length,summary:Object.fromEntries(['accepted-material-family','revise','unresolved'].map(v=>[v,cases.filter(c=>c.verdict===v).length])),defaultGameChanged:false,cases};
await fs.writeFile('public/data/wall-materials/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
