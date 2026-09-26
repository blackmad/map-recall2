/** Cross-layer regressions; generated human-shaped fixtures stay in an isolated cache. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {applyVisualProposal,matchingVisualReview} from './da-costa-block/visual-review.mjs';
import {reviewEvidenceKey} from './da-costa-block/review-dependencies.mjs';
import {observationFor} from '../public/canal-drive/da-costa-block/evidence.js';
const exec=promisify(execFile);
const visual={origin:'agent-visual-review',appearanceEligible:true,buildingMatch:'yes',cropQuality:'usable',fieldEligibility:{shopfront:true,awning:true,facadeTop:true,roofShape:false,visibleSignText:true},proposal:{shopfront:'no',awning:'no',facadeTop:'pointed',roofShape:'unknown',visibleSignText:''}};

test('usable direct fields survive a bad baseline, without resurrecting baseline paint',()=>{
  const baseline={wholeUsable:'no',wallColour:'red',wallMaterial:'brick',visibleSignText:'OLD GUESSED SIGN',shopfront:'yes'};
  const result=applyVisualProposal(baseline,visual);
  assert.equal(result.proposal.shopfront,'no');assert.notEqual(result.proposal.wholeUsable,'no');
  assert.ok(!result.proposal.wallColour||result.proposal.wallColour==='unknown');
  assert.ok(!result.proposal.wallMaterial||result.proposal.wallMaterial==='unknown');
  const record={id:'wall',renderBuildingId:'building',renderSurfaceIndices:[1],effectiveProposal:result.proposal,proposalSources:result.sources};
  assert.equal(observationFor([record],'building',1)?.id,'wall');
  assert.equal(baseline.wholeUsable,'no','baseline evidence must stay immutable');
});

test('explicitly withheld OCR does not retain a baseline tenant name',()=>{
  const result=applyVisualProposal({wholeUsable:'yes',visibleSignText:'LOCAL HANGOUT'},{...visual,fieldEligibility:{visibleSignText:false},proposal:{visibleSignText:''}});
  assert.equal(result.proposal.visibleSignText,'');assert.equal(result.sources.visibleSignText,'agent-withheld');
});

test('accepted human fields override a visual repair gate without restoring unsupported paint or OCR',async()=>{
  const active='.cache/da-costa-neighbourhood',manifest=JSON.parse(await fs.readFile(active+'/manifest.json'));
  const record=manifest.records[0],root=await fs.mkdtemp(path.resolve('.cache/visual-review-integration-'));
  const bad={...visual,id:record.id,derivationKey:record.derivationKey,images:[record.images.full],appearanceEligible:false,cropQuality:'unusable',reviewer:'synthetic regression fixture'};
  const baseline={wholeUsable:'yes',wallColour:'red',wallMaterial:'brick',visibleSignText:'UNSUPPORTED',shopfront:'no',awning:'no',roofShape:'flat',facadeTop:'straight'};
  const decision={placement:'accepted',targetId:record.id,shopfront:'yes',awning:'yes',roofShape:'mansard',facadeTop:'bell'};
  await fs.mkdir(root+'/self-review-2026-09-09');
  await fs.writeFile(root+'/manifest.json',JSON.stringify({...manifest,records:[record]}));
  await fs.writeFile(root+'/spend.json',JSON.stringify({results:[{id:record.id,derivationKey:record.derivationKey,status:'ok',mode:'multi',model:'synthetic-3.1-flash-lite',proposal:baseline,usage:{cost:0}}]}));
  await fs.writeFile(root+'/self-review-2026-09-09/findings.json',JSON.stringify({records:[bad]}));
  await fs.writeFile(root+'/reviews.json',JSON.stringify({events:[{id:record.id,derivationKey:record.derivationKey,evidenceKey:reviewEvidenceKey(record),origin:'human-review',reviewer:'synthetic isolated test only',decision}]}));
  await exec(process.execPath,['scripts/da-costa-block/publish-neighbourhood.mjs','--root='+root,'--out='+root+'/published.json']);
  const published=JSON.parse(await fs.readFile(root+'/published.json')).records[0];
  assert.ok(published.effectiveProposal,'human explicit fields must not disappear behind the machine gate');
  for(const key of ['shopfront','awning','roofShape','facadeTop']){assert.equal(published.effectiveProposal[key],decision[key]);assert.equal(published.proposalSources[key],'human-review');}
  assert.ok(!published.effectiveProposal.wallColour||published.effectiveProposal.wallColour==='unknown');
  assert.ok(!published.effectiveProposal.wallMaterial||published.effectiveProposal.wallMaterial==='unknown');
  assert.equal(published.effectiveProposal.visibleSignText||'','');
  assert.equal(published.visualReview.appearanceEligible,false,'retain machine disagreement as provenance');
});

test('source matching binds all referenced images and original panorama hashes',()=>{
  const record={id:'wall',derivationKey:'revision',images:{full:{file:'full.jpg',sha256:'crop',panoramaSha256:'pano'}}};
  const aerial={file:'aerial.jpg',sha256:'air',context:{file:'context.jpg',sha256:'context'}};
  const row={...visual,id:record.id,derivationKey:record.derivationKey,images:[record.images.full,aerial.context]};
  assert.ok(matchingVisualReview([row],record,aerial));
  assert.equal(matchingVisualReview([row],record,{...aerial,context:{...aerial.context,sha256:'new context'}}),null);
  assert.equal(matchingVisualReview([{...row,images:[{...record.images.full,panoramaSha256:'other original'}]}],record,aerial),null);
  assert.equal(matchingVisualReview([{...row,derivationKey:'old revision'}],record,aerial),null);
});
