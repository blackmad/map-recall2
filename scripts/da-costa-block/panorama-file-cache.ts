/** Reuse immutable panoramas without a second disk copy for every crop batch. */
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
export const MIN_PANORAMA_FREE_BYTES=4*1024**3;
export async function requireDiskSpace(directory:string,incomingBytes=0,minimumFreeBytes=MIN_PANORAMA_FREE_BYTES){
 const stats=await fs.statfs(directory);const available=Number(stats.bavail)*Number(stats.bsize);
 if(available-incomingBytes<minimumFreeBytes)throw Error(`disk-space-reserve: ${available} available bytes, ${incomingBytes} incoming, ${minimumFreeBytes} reserved`);
}
export async function reusePanoramaFile(source:string,destination:string){
 try{await fs.link(source,destination);}
 catch(error:any){
  if(error.code==='EEXIST')return;
  if(error.code!=='EXDEV')throw error;
  const size=(await fs.stat(source)).size;await requireDiskSpace(path.dirname(destination),size);
  try{await fs.copyFile(source,destination,constants.COPYFILE_EXCL);}catch(e:any){if(e.code!=='EEXIST')throw e;}
 }
}
export async function storePanoramaFile(destination:string,bytes:Buffer){
 await requireDiskSpace(path.dirname(destination),bytes.length);
 const temporary=`${destination}.${process.pid}.${randomUUID()}.partial`;
 try{await fs.writeFile(temporary,bytes,{flag:'wx'});await fs.link(temporary,destination);}
 catch(error:any){if(error.code!=='EEXIST')throw error;}
 finally{await fs.rm(temporary,{force:true});}
}
