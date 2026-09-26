/** Run before upgrading an already running localhost review server. No review
 * writes and no token output. --verify-only checks continuity after restart. */
import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {readReviewSession,storeReviewSession} from './review-session-token.mjs';
export async function preserveReviewSession({root='.cache/da-costa-neighbourhood',port=5195,verifyOnly=false}={}){
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local review port');
  const response=await fetch(`http://127.0.0.1:${port}/api/neighbourhood`,{signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw Error('Could not read the running local review session');
  const data=await response.json();
  if(typeof data.token!=='string'||! /^[a-f0-9]{48}$/.test(data.token))throw Error('Running server returned an invalid session');
  const expected=JSON.parse(await fs.readFile(path.join(path.resolve(root),'manifest.json'),'utf8'));
  if(expected.sourceHash!==data.sourceHash||expected.records.length!==data.records?.length||expected.records.some(row=>!data.records.some(record=>record.id===row.id&&record.derivationKey===row.derivationKey)))throw Error('Running server evidence does not match the explicitly selected review root');
  if(verifyOnly){const stored=await readReviewSession(path.resolve(root));if(stored?.token!==data.token)throw Error('Session continuity check failed');}
  else await storeReviewSession(path.resolve(root),data.token);
  return {preserved:true,verified:verifyOnly,reviewWrites:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const flag=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
  preserveReviewSession({root:flag('root')??process.env.NEIGHBOURHOOD_ROOT??'.cache/da-costa-neighbourhood',port:Number(flag('port')??process.env.NEIGHBOURHOOD_PORT??5195),verifyOnly:process.argv.includes('--verify-only')})
    .then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
