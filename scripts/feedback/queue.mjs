#!/usr/bin/env node
/** Private feedback queue via IAM, never a public browser/service-account key. */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v)])) } };
}
export function decode(v) {
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x]) => [k,decode(x)]));
  throw new Error('Unsupported Firestore value');
}
export const transitions = {
  open: ['in-progress','deferred'], 'in-progress': ['open','resolved','deferred'],
  deferred: ['open','in-progress'], resolved: ['open'],
};
export async function main(args = process.argv.slice(2)) {
  const command = args.shift() || 'pull';
  const option = (key, fallback) => { const i=args.indexOf(key); return i<0 ? fallback : args[i+1]; };
  const project = option('--project', 'map-recall2-blackmad');
  if (!/^[a-z0-9-]+$/.test(project)) throw new Error('Invalid project');
  const directory = resolve(option('--out', '.cache/canal-feedback'));
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  // Uses the existing operator account. The CLI never prints or writes tokens.
  const token = execFileSync('gcloud', ['auth','print-access-token'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  async function api(path, method='GET', body) {
    const r=await fetch(`${base}${path}`, { method, headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', 'x-goog-user-project':project }, ...(body ? {body:JSON.stringify(body)} : {}) });
    const data=await r.json(); if(!r.ok) throw new Error(`Firestore ${r.status}: ${data.error?.message || 'request failed'}`); return data;
  }
  const readNote = doc => ({ id:doc.name.split('/').at(-1), updateTime:doc.updateTime, ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v])=>[k,decode(v)])) });
  if(command==='pull') {
    const status=option('--status','open');
    if(status!=='all' && !Object.hasOwn(transitions,status)) throw new Error('Invalid status');
    const max=Number(option('--limit','50'));
    if(!Number.isInteger(max)||max<1||max>500) throw new Error('Limit must be 1–500');
    const query={from:[{collectionId:'canalFeedback'}],limit:max, ...(status==='all'?{}:{where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:status}}}})};
    const result=await api(':runQuery','POST',{structuredQuery:query});
    await mkdir(directory,{recursive:true});
    const notes=[];
    for(const {document} of result) {
      if(!document) continue;
      const note=readNote(document);
      if(note.screenshot?.startsWith('data:image/jpeg;base64,')) {
        const image=join(directory,`${note.id}.jpg`);
        await writeFile(image,Buffer.from(note.screenshot.split(',')[1],'base64')); note.screenshotPath=image;
      }
      delete note.screenshot; notes.push(note);
    }
    notes.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    const file=join(directory,`queue-${status}.json`); await writeFile(file,JSON.stringify({project,pulledAt:new Date().toISOString(),status,limit:max,notes},null,2)+'\n');
    console.log(JSON.stringify({file,count:notes.length,atLimit:notes.length===max,notes:notes.map(n=>({id:n.id,status:n.status,target:n.target?.label,text:n.text.slice(0,400),host:n.environment?.host,build:n.environment?.build,screenshotPath:n.screenshotPath}))},null,2));
    return;
  }
  if(command==='status') {
    const [id,next]=args;
    if(!/^[a-zA-Z0-9-]{1,100}$/.test(id||'')||!Object.hasOwn(transitions,next)) throw new Error('Usage: status ID open|in-progress|deferred|resolved --expected UPDATE_TIME --note-file FILE');
    const expected=option('--expected',''); if(!expected) throw new Error('Supply --expected from the pulled note to prevent concurrent overwrites.');
    const noteFile=option('--note-file',''); if(!noteFile) throw new Error('Supply --note-file with the claim, deferral reason, or verified resolution.');
    const message=(await readFile(noteFile,'utf8')).trim(); if(!message || message.length>12000) throw new Error('A 1–12000 character work note is required.');
    const raw=await api(`/canalFeedback/${id}`);const note=readNote(raw);
    if(note.updateTime!==expected) throw new Error('Note changed since pull; refresh before updating.');
    if(!transitions[note.status]?.includes(next)) throw new Error(`Invalid transition ${note.status} → ${next}`);
    const updated = await api(`/canalFeedback/${id}?updateMask.fieldPaths=status&updateMask.fieldPaths=resolution&updateMask.fieldPaths=updatedAt&currentDocument.updateTime=${encodeURIComponent(expected)}`,'PATCH', {fields:{status:encode(next),resolution:encode(message),updatedAt:{timestampValue:new Date().toISOString()}}});
    console.log(JSON.stringify({id,status:next,updateTime:updated.updateTime}));return;
  }
  throw new Error('Commands: pull [--status open|in-progress|deferred|resolved|all] [--limit 50] [--out DIR]; status ID STATUS --expected UPDATE_TIME --note-file FILE');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
