/** Compare frozen direct-vision proposals after review; agreement is not accuracy. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='.cache/da-costa-neighbourhood',bytes=await fs.readFile(root+'/self-review-2026-09-09/findings.json');
const findings=JSON.parse(bytes),ledger=JSON.parse(await fs.readFile(root+'/spend.json'));
const keys=['shopfront','awning','visibleSignText','facadeTop'],summary=Object.fromEntries(keys.map(key=>[key,{eligible:0,exactAgreement:0,different:0}]));
const records=findings.records.map(r=>{
  const baseline=ledger.results.find(x=>x.id===r.id&&x.derivationKey===r.derivationKey&&x.status==='ok'&&x.mode==='multi'&&x.model.includes('3.1-flash-lite'));
  const comparison={};
  for(const key of keys)if(r.appearanceEligible&&r.fieldEligibility[key]===true&&baseline){const same=r.proposal[key]===baseline.proposal[key];summary[key].eligible++;summary[key][same?'exactAgreement':'different']++;comparison[key]={agent:r.proposal[key],baseline:baseline.proposal[key],same};}
  return {id:r.id,derivationKey:r.derivationKey,appearanceEligible:r.appearanceEligible,comparison};
});
const report={policy:'Post-freeze machine comparison, not human gold or accuracy. Historical source derivations remain historical; this does not validate labels for replacement images.',findingsSha256:createHash('sha256').update(bytes).digest('hex'),summary,records};
await fs.writeFile(root+'/self-review-2026-09-09/comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(summary,null,2));
