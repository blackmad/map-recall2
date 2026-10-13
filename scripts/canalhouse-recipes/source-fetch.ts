/** Archive original HTTP bytes before extraction. Failed attempts never become cache hits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setDefaultResultOrder} from 'node:dns';

setDefaultResultOrder('ipv4first');
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
export interface ArchivedHttpSource {
 url:string;finalUrl:string;status:number|null;accessed:string;sha256:string|null;
 bytes:number;contentType:string|null;rawPath:string|null;error:string|null;
}
export async function archiveHttpSource(pack:string,url:string,options:{force?:boolean;timeoutMs?:number;fetcher?:typeof fetch}={}) {
 if(new URL(url).protocol!=='https:')throw Error('Research sources require HTTPS');
 const root=path.resolve(pack),key=sha(url),index=path.join(root,'requests',`${key}.json`);
 if(!options.force){
  try{
   const record:ArchivedHttpSource=JSON.parse(await fs.readFile(index,'utf8'));
   if(record.url===url&&record.status!==null&&record.status>=200&&record.status<300&&record.bytes>0&&record.rawPath?.startsWith('raw/')){
    const file=path.resolve(root,record.rawPath);
    if(file.startsWith(path.join(root,'raw')+path.sep)){
     const bytes=await fs.readFile(file);
     if(bytes.length===record.bytes&&sha(bytes)===record.sha256)return {bytes,meta:record,cached:true};
    }
   }
  }catch{/* Missing/invalid cache entries trigger an actual request. */}
 }
 await Promise.all(['raw','attempts','requests'].map(d=>fs.mkdir(path.join(root,d),{recursive:true})));
 const attempt=`${key}-${randomUUID()}`,accessed=new Date().toISOString();
 let bytes:Buffer|null=null;
 const meta:ArchivedHttpSource={url,finalUrl:url,status:null,accessed,sha256:null,bytes:0,contentType:null,rawPath:null,error:null};
 try{
  const response=await(options.fetcher??fetch)(url,{signal:AbortSignal.timeout(options.timeoutMs??30000),headers:{'User-Agent':'CanalRecallResearch/1.0'}});
  bytes=Buffer.from(await response.arrayBuffer());
  Object.assign(meta,{finalUrl:response.url||url,status:response.status,contentType:response.headers.get('content-type'),bytes:bytes.length,sha256:sha(bytes),rawPath:`raw/${attempt}.bin`});
  // Includes unsuccessful HTTP bodies; metadata distinguishes them from usable sources.
  await fs.writeFile(path.join(root,meta.rawPath!),bytes,{flag:'wx'});
  if(!response.ok||!bytes.length)meta.error=`HTTP ${response.status}${bytes.length?'':'; empty response'}`;
 }catch(e){meta.error=e instanceof Error?`${e.message}${'cause' in e?'; '+String(e.cause):''}`:String(e);}
 await fs.writeFile(path.join(root,'attempts',`${attempt}.json`),JSON.stringify(meta,null,2)+'\n',{flag:'wx'});
 if(meta.error||!bytes)throw Object.assign(new Error(meta.error??'No source bytes'),{sourceAttempt:meta});
 await fs.writeFile(index,JSON.stringify(meta,null,2)+'\n');
 return {bytes,meta,cached:false};
}
