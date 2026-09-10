import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root='.cache/da-costa-neighbourhood',read=async p=>JSON.parse(await fs.readFile(p));
const notes=await read('scripts/da-costa-block/agent-review-notes.json');
const inputs=await fs.readFile(root+'/agent-review-inputs.json');
if(createHash('sha256').update(inputs).digest('hex')!==notes.inputSha256)throw Error('Agent review inputs changed; assess new images, do not reuse these answers');
const ledger=await read(root+'/spend.json');
const records=notes.records.map(n=>{
  const input=JSON.parse(inputs).records.find(r=>r.case===n.case);
  const base=ledger.results.find(r=>r.id===input.id&&r.derivationKey===input.derivationKey&&r.mode==='multi'&&r.model.includes('flash-lite')&&r.status==='ok');
  return {...input,...n,origin:notes.origin,reviewer:notes.reviewer,at:notes.date,baseline:base?.proposal,disagreements:base?['shopfront','awning','roofShape','facadeTop','groundUsable'].filter(k=>n[k]!==base.proposal[k]):[]};
});
const summary={cases:records.length,needsReview:records.filter(r=>r.needsReview).length,suppressAppearance:records.filter(r=>r.suppressAppearance).length,disagreements:Object.fromEntries(['shopfront','awning','roofShape','facadeTop','groundUsable'].map(k=>[k,records.filter(r=>r.disagreements.includes(k)).length])),note:'Machine-to-machine comparison, not accuracy. Human review still required; some scenes appeared earlier in the session.'};
await fs.writeFile(root+'/agent-review.json',JSON.stringify({policy:notes.policy,summary,records},null,2));
console.log(JSON.stringify(summary));
