/** Local CSRF session continuity. The token is never logged or exported in reports. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export const reviewTokenPath=root=>path.join(root,'review-session-token.json');
export async function readReviewSession(root){
  const file=reviewTokenPath(root);
  let stat;try{stat=await fs.lstat(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw Error('Review session file must be a private regular file (0600)');
  const session=JSON.parse(await fs.readFile(file,'utf8'));
  if(session.version!==1||typeof session.token!=='string'||! /^[a-f0-9]{48}$/.test(session.token))throw Error('Invalid review session file');
  return session;
}
export async function storeReviewSession(root,token){
  if(typeof token!=='string'||! /^[a-f0-9]{48}$/.test(token))throw Error('Invalid local session token');
  const current=await readReviewSession(root);
  if(current){if(current.token!==token)throw Error('Existing review session differs; refusing to overwrite it');return current;}
  const session={version:1,token};
  try{await fs.writeFile(reviewTokenPath(root),JSON.stringify(session)+'\n',{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;const concurrent=await readReviewSession(root);if(concurrent?.token!==token)throw Error('Concurrent review session differs');return concurrent;}
  return session;
}
export async function loadOrCreateReviewSession(root){
  return await readReviewSession(root)??await storeReviewSession(root,crypto.randomBytes(24).toString('hex'));
}
