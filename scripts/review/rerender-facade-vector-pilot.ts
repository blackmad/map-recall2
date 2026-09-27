/** Renderer-only ablation: reuse saved model JSON, preserve original artifacts. No API calls. */
import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import {createHash} from 'node:crypto';
import {renderFacadeSvg} from '../../src/canalRecall/facade/facadeSvgExperiment.ts';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const root=path.resolve('.cache/facade-assessment/vector-pilot'),source=root+'/v2',out=path.resolve(process.argv.find(v=>v.startsWith('--out='))?.slice(6)??root+'/renderer-fix-v2');
const manifest=JSON.parse(await fs.readFile('.cache/facade-assessment/vector-inputs-v1/manifest.json','utf8'));
await fs.mkdir(out);const rendererSha256=sha(await fs.readFile('src/canalRecall/facade/facadeSvgExperiment.ts'));
await fs.writeFile(out+'/provenance.json',JSON.stringify({source,rendererSha256,apiCalls:0,note:'Renderer-only correction: structured geometry is drawn in source-pixel space so arch radii and strokes retain their proportions. All model boxes, polygons and colours are unchanged. Direct SVG outputs are unchanged. Costs below refer to original inference, not new charges. Incorrect model geometry remains visible.'},null,2));
let rerendered=0;
for(const dir of await fs.readdir(source,{withFileTypes:true})){
 if(!dir.isDirectory()||dir.name==='contacts')continue;
 const reportPath=source+'/'+dir.name+'/report.json';let report:any;try{report=JSON.parse(await fs.readFile(reportPath,'utf8'));}catch(e:any){if(e.code==='ENOENT')continue;throw e;}
 const target=out+'/'+dir.name;await fs.mkdir(target);const receipts=[];
 for(const file of await fs.readdir(source+'/'+dir.name)){
  if(!/^\d+-(svg|structured|assisted)\.json$/.test(file))continue;
  const oldPath=source+'/'+dir.name+'/'+file,oldBytes=await fs.readFile(oldPath),r=JSON.parse(oldBytes.toString());
  r.originalReceipt={path:oldPath,sha256:sha(oldBytes)};
  if(r.status==='rendered'&&r.arm!=='svg'){
   if(sha(await fs.readFile(r.pngPath))!==r.pngSha256||sha(await fs.readFile(r.svgPath))!==r.svgSha256)throw Error('Original artifact changed');
   const e=manifest.entries.find((v:any)=>v.index===r.index);const svg=renderFacadeSvg(r.description,{width:e.originalWidth,height:e.originalHeight});
   r.originalRender={svgPath:r.svgPath,svgSha256:r.svgSha256,pngPath:r.pngPath,pngSha256:r.pngSha256};
   r.svgPath=target+'/'+file.replace('.json','.svg');r.pngPath=target+'/'+file.replace('.json','.png');
   await fs.writeFile(r.svgPath,svg);await sharp(Buffer.from(svg)).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).flatten({background:'#ece9e2'}).png().toFile(r.pngPath);
   r.svgSha256=sha(svg);r.pngSha256=sha(await fs.readFile(r.pngPath));r.rendererRevision=rendererSha256;rerendered++;
  }
  await fs.writeFile(target+'/'+file,JSON.stringify(r,null,2)+'\n');receipts.push(r);
 }
 await fs.writeFile(target+'/report.json',JSON.stringify({...report,receipts,rendererOnlyCorrection:true},null,2)+'\n');
}
console.log({out,rerendered,apiCalls:0});
