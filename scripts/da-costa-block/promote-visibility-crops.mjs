/** Minimal, backed-up evidence promotion. Stop the local review server before --apply. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const arg=(key,fallback)=>process.argv.find(v=>v.startsWith(`--${key}=`))?.slice(key.length+3)||fallback;
const root=path.resolve(arg('root','.cache/da-costa-neighbourhood'));
const stage=path.resolve(arg('stage','.cache/da-costa-visibility-stage'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async file=>JSON.parse(await fs.readFile(file));
const manifestFile=path.join(root,'manifest.json'),before=await fs.readFile(manifestFile),manifest=JSON.parse(before);
const auditName=arg('audit','visibility-audit.json');if(path.basename(auditName)!==auditName)throw Error('Invalid audit filename');
const audit=await read(path.join(stage,auditName));
if(hash(before)!==audit.sourceManifestFileHash)throw Error('Active manifest differs from the audited source; audit again before promotion');
const selected=arg('ids','');
const expected=selected?selected.split(','):audit.records.filter(r=>r.views.full.rejected||r.views.ground.rejected).map(r=>r.id);
if(!expected.length||new Set(expected).size!==expected.length||expected.some(id=>!audit.records.some(r=>r.id===id)))throw Error('Replacement IDs must be distinct audited records');
const candidates=[];
for(const directory of arg('folders','amsta,da-costa-10').split(',')){
  if(path.basename(directory)!==directory)throw Error('Invalid stage folder');
  const folder=path.join(stage,directory),data=await read(path.join(folder,'manifest.json'));
  candidates.push(...data.records.map(record=>({record,folder,sourceHash:data.sourceHash})));
}
const changes=[];
for(const id of expected){
  const old=manifest.records.find(r=>r.id===id),candidate=candidates.find(c=>c.record.id===id);
  if(!old||!candidate)throw Error('Missing replacement '+id);
  const next=candidate.record;
  if(old.buildingId!==next.buildingId||JSON.stringify(old.wall)!==JSON.stringify(next.wall))throw Error('Replacement changes wall identity '+id);
  const changedKinds=[];
  for(const [kind,image] of Object.entries(next.images)){
    if(path.basename(image.file)!==image.file)throw Error('Invalid image name');
    const bytes=await fs.readFile(path.join(candidate.folder,'images',image.file));
    if(hash(bytes)!==image.sha256)throw Error('Staged pixels changed '+image.file);
    if(image.sha256!==old.images[kind]?.sha256)changedKinds.push(kind);
    if((image.visibility?.hiddenFraction??1)>.34)throw Error('Replacement remains occluded '+image.file);
  }
  if(!changedKinds.length||next.derivationKey===old.derivationKey)throw Error('Replacement needs new source identity '+id);
  changes.push({...candidate,old,changedKinds});
}
const summary={replacements:changes.map(c=>({id:c.record.id,changedKinds:c.changedKinds,oldKey:c.old.derivationKey,newKey:c.record.derivationKey})),unchangedRecords:manifest.records.length-changes.length,paidLedgerModified:false,humanReviewsModified:false};
if(!process.argv.includes('--apply')){console.log(JSON.stringify({dryRun:true,...summary},null,2));process.exit(0);}
// Readers must be stopped by the caller: image filenames are retained to keep derivation keys exact.
if(!process.argv.includes('--review-server-stopped'))throw Error('Stop the local review server, then pass --review-server-stopped');
const backup=await fs.mkdtemp(path.join(root,'before-visibility-'));
await fs.mkdir(path.join(backup,'images'));await fs.writeFile(path.join(backup,'manifest.json'),before);
for(const c of changes)for(const image of Object.values(c.old.images))await fs.copyFile(path.join(root,'images',image.file),path.join(backup,'images',image.file));
if(hash(await fs.readFile(manifestFile))!==hash(before))throw Error('Manifest changed during staging; nothing promoted');
try{
  for(const c of changes){
    for(const image of Object.values(c.record.images)){
      await fs.copyFile(path.join(c.folder,'images',image.file),path.join(root,'images',image.file));
      const pano=image.panoramaId+'.jpg',source=path.join(c.folder,'panoramas',pano),dest=path.join(root,'panoramas',pano);
      try{await fs.access(dest);}catch{await fs.copyFile(source,dest);}
    }
    manifest.records[manifest.records.findIndex(r=>r.id===c.record.id)]=c.record;
  }
  manifest.evidenceRevisions=[...(manifest.evidenceRevisions||[]),...(manifest.evidenceRevision?[manifest.evidenceRevision]:[])];
  manifest.evidenceRevision={at:new Date().toISOString(),policy:audit.version,previousManifestHash:hash(before),sourceHashScope:'Base sourceHash is retained; replacement derivations use the staged source hashes below.',replacements:changes.map(c=>({id:c.record.id,sourceHash:c.sourceHash,previousDerivationKey:c.old.derivationKey,derivationKey:c.record.derivationKey}))};
  await fs.writeFile(manifestFile+'.tmp',JSON.stringify(manifest,null,2));await fs.rename(manifestFile+'.tmp',manifestFile);
  await fs.writeFile(path.join(backup,'promotion.json'),JSON.stringify(summary,null,2));
}catch(error){
  for(const c of changes)for(const image of Object.values(c.old.images))await fs.copyFile(path.join(backup,'images',image.file),path.join(root,'images',image.file));
  await fs.writeFile(manifestFile+'.tmp',before);await fs.rename(manifestFile+'.tmp',manifestFile);throw error;
}
console.log(JSON.stringify({applied:true,backup,...summary},null,2));
