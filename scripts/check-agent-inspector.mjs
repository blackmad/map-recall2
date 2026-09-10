/** Focused real renderer checks plus in-memory human readback; no screenshots or real writes. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5195/canal-drive/da-costa-block.html?neighbourhood=1');
  await page.waitForFunction(()=>window.daCostaDemo?.status().ready);
  const current=await page.evaluate(()=>{
    const records=window.daCostaDemo.evidence().records;
    const house=records.find(r=>r.address==='Da Costakade 13');
    const houseApplied=window.daCostaDemo.data().buildings.find(b=>b.id===house.renderBuildingId).surfaces.some(s=>s.observation?.id===house.id);
    const ice=records.find(r=>r.address==='Da Costakade 28'&&r.effectiveProposal?.visibleSignText?.includes('IJscuypje'));
    window.daCostaDemo.select(ice.renderBuildingId);const corrected=document.querySelector('#selection-body').textContent;
    const hangout=records.find(r=>r.address==='Nassaukade 129');window.daCostaDemo.select(hangout.renderBuildingId);const withheld=document.querySelector('#selection-body').textContent;
    const clipped=records.filter(r=>r.images.aerial?.coverageComplete===false);
    const bad=records.find(r=>r.visualReview?.appearanceEligible===false)||house;
    bad.visualReview={...bad.visualReview,appearanceEligible:false,cropQuality:'unusable'};
    bad.review={placement:'accepted',roofShape:'mansard',facadeTop:'bell',shopfront:'yes',awning:'no'};
    bad.effectiveProposal={wholeUsable:'unknown',roofShape:'mansard',facadeTop:'bell',shopfront:'yes',awning:'no',visibleSignText:''};
    window.daCostaDemo.select(bad.renderBuildingId);const human=document.querySelector('#selection-body').textContent;
    return {houseApplied,corrected,withheld,clipped:clipped.map(r=>({id:r.id,oracle:!!r.roofOracleProposal,gpt:!!r.roofGptProposal,aerial:!!r.roofAerialProposal})),human};
  });
  assert.equal(current.houseApplied,true,'direct eligible house observations reach renderer');
  assert.match(current.corrected,/Suggested sign reading: “IJscuypje; ICE CREAM”/);
  assert.doesNotMatch(current.corrected,/Suggested sign reading: “Ysbrrye”/);
  assert.doesNotMatch(current.withheld,/Suggested sign reading: “LOCAL HANGOUT”/);
  for(const r of current.clipped)assert.ok(!r.oracle&&!r.gpt&&!r.aerial,'partial aerial must not supply a whole-building roof candidate: '+r.id);
  assert.match(current.human,/Reviewed labels: roof mansard; facade top bell/);
  assert.deepEqual(errors,[]);
  console.log('Passed: primary agent fields render, corrected/withheld OCR reaches inspector, incomplete aerial candidates withheld, human-label readback, no browser errors. Human-shaped fixture was browser memory only.');
}finally{await browser.close();}
