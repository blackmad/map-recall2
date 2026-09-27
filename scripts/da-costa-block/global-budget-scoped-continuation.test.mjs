import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {globalBudget} from './global-budget.mjs';

const directory=await fs.mkdtemp(path.join(os.tmpdir(),'scoped-budget-'));
const ledger=path.join(directory,'spend.json');
const oldId='request:068099f48543ee8fad1e83e3db344e72d3c28aeec9c35cb0f3e2410e38121068';
const old={id:oldId,key:'old-glm',sourceLedger:'old.json',status:'unknown',reservedUsd:.06};
const scope={id:'nano-lite-three-sources',source:'User: let us see how Lite does',
 maxNewReservationsUsd:.60,maxRequests:3,acknowledgedUnknownIds:[oldId]};
const authorization={id:'owner-nano-lite-continuation',maxCeilingUsd:10,scopedContinuation:scope};
const options={file:ledger,ceiling:10,legacyLedgers:[],authorization};
const read=async()=>JSON.parse(await fs.readFile(ledger,'utf8'));
const seed=async(entries=[old])=>fs.writeFile(ledger,JSON.stringify({version:1,entries}));
const reserve=(budget,key,amount=.20)=>budget.reserve({key,sourceLedger:path.join(directory,`${key}.json`),reservedUsd:amount});

try{
 await seed();
 await assert.rejects(reserve(globalBudget(options),'default'),/Unresolved previous charge/);
 assert.throws(()=>globalBudget({...options,acknowledgedUnknownIds:[oldId],authorization:{...authorization,scopedContinuation:{...scope,acknowledgedUnknownIds:['wrong']}}}),/matching scoped continuation/);
 const budget=globalBudget({...options,acknowledgedUnknownIds:[oldId]});
 assert.equal(await budget.assertReady(),.06);
 await assert.rejects(reserve(budget,'too-small',.19),/below authorized per-request minimum/);
 const first=await reserve(budget,'first');
 assert.match(first,/^request:/);
 await assert.rejects(reserve(budget,'concurrent'),/Pending request/);
 const afterFirst=await read();
 assert.deepEqual(afterFirst.entries.find(entry=>entry.id===oldId),old,'old unknown and reserve are unchanged');
 assert.equal(afterFirst.entries.find(entry=>entry.id===first).scopedContinuationId,scope.id);
 await budget.settle(first,.04,{generationId:'gen-1'});
 const second=await reserve(budget,'second');
 await budget.settle(second,.05,{generationId:'gen-2'});
 const third=await reserve(budget,'third');
 await budget.settle(third,.03,{generationId:'gen-3'});
 await assert.rejects(reserve(budget,'fourth'),/continuation reservation or request cap/);
 const afterThree=await read();
 const scoped=afterThree.entries.filter(entry=>entry.scopedContinuationId===scope.id);
 assert.equal(scoped.length,3);
 assert.equal(Math.round(scoped.reduce((sum,entry)=>sum+entry.reservedUsd,0)*100),60,
  'the cap counts original reservations even after cheap settlements');
 assert.equal(afterThree.entries.find(entry=>entry.id===oldId).status,'unknown');
 assert.equal(afterThree.entries.find(entry=>entry.id===oldId).reservedUsd,.06);

 await seed([old,{...old,id:'request:new-unknown'}]);
 await assert.rejects(reserve(budget,'unlisted'),/Unresolved previous charge/);
 await seed([old,{...old,id:'request:pending',status:'pending',owner:{pid:process.pid}}]);
 await assert.rejects(reserve(budget,'pending'),/Pending request|Unresolved previous charge/);

 await seed();
 const over=await reserve(budget,'over');
 const settled=await budget.settle(over,.61,{generationId:'gen-over'});
 assert.equal(settled.exceededContinuation,true);
 await assert.rejects(reserve(budget,'after-over'),/continuation reservation or request cap/);
}finally{
 await fs.rm(directory,{recursive:true,force:true});
}
console.log('Scoped continuation: exact unknown, pending, reservation floor/cap, and original ledger status passed.');
