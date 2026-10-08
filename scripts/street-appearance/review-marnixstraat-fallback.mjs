import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const out=process.argv[2]??'artifacts/marnixstraat-game/fallback-1';fs.mkdirSync(out,{recursive:true});
const expected=JSON.parse(fs.readFileSync('public/data/street-appearance/profiles.json'));
const results=[];
try{for(const failure of ['http','network']){const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
 await page.route('**/data/street-appearance/marnixstraat-pilot.json*',r=>failure==='http'?r.fulfill({status:503,body:'bounded diagnostic failure'}):r.abort('failed'));
 await page.goto('http://127.0.0.1:49231/canal-drive/?marnixPilot=1#race=52.3758,4.8775,52.37545,4.87725,52.3765,4.8778');
 await page.waitForFunction(()=>{const t=canalRecallGame?.vectorMap?._threeBuildings;return t?.appearanceRevision&&t.chunks.size&&!t.pending.length&&!t.inflight.size&&!t.pumping},null,{timeout:120000});
 const actual=await page.evaluate(()=>{const t=canalRecallGame.vectorMap._threeBuildings;return {revision:t.appearanceRevision,profiles:t.appearanceProfiles.map(p=>p.id),envelopeIds:canalRecallGame.vectorMap.map._surveyedEnvelopeRoofIds??[]}});
 assert.equal(actual.revision,expected.revision);assert.deepEqual(actual.profiles,expected.profiles.map(p=>p.id));assert.deepEqual(actual.envelopeIds,[]);results.push({failure,actual});await page.screenshot({path:`${out}/${failure}.png`});await context.close();}
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({status:'pass',results,check:'Optional pilot HTTP/network failure retains exact installed catalogue and no envelope ownership'},null,2)+'\n');
}finally{await browser.close()}
