/** Run against a Firestore emulator only; no live data or credentials. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { encode } from './queue.mjs';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required');
const project='demo-canal-feedback';
const base=`http://${host}/v1/projects/${project}/databases/(default)/documents`;
const ruleResponse=await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:await readFile('firestore.rules','utf8')}]}})});
assert.equal(ruleResponse.status,200,await ruleResponse.text());
function token(uid,provider='google.com') {
  const now=Math.floor(Date.now()/1000);
  return [ {alg:'none',typ:'JWT'}, {iss:`https://securetoken.google.com/${project}`,aud:project,iat:now,exp:now+3600,sub:uid,user_id:uid,auth_time:now,firebase:{sign_in_provider:provider,identities:{}}} ].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.';
}
async function create(id,uid,change={},provider='google.com') {
  const note={schemaVersion:1,ownerUid:'alice',text:'Roof is wrong',target:{id:'test',label:'Test',imageUrl:'',anchor:{x:.5,y:.5}},context:{},environment:{host:'localhost',page:'http://localhost/gallery'},screenshot:'',status:'open',resolution:'',...change};
  const write={update:{name:`projects/${project}/databases/(default)/documents/canalFeedback/${id}`,fields:Object.fromEntries(Object.entries(note).map(([k,v])=>[k,encode(v)]))},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'},{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]};
  const r=await fetch(`${base}:commit`,{method:'POST',headers:{'Content-Type':'application/json',...(uid?{Authorization:`Bearer ${token(uid,provider)}`}:{})},body:JSON.stringify({writes:[write]})});
  return r.status;
}
assert.equal(await create('valid','alice'),200,'author can submit');
assert.equal(await create('guest',null),403,'unauthenticated cannot submit');
assert.equal(await create('spoof','bob'),403,'cannot spoof owner');
assert.equal(await create('anon','alice',{},'anonymous'),403,'anonymous cannot submit');
assert.equal(await create('oversize','alice',{text:'x'.repeat(12001)}),403);
assert.equal(await create('status','alice',{status:'resolved'}),403,'cannot pre-resolve');
assert.equal(await create('anchor','alice',{target:{id:'t',label:'t',imageUrl:'',anchor:{x:2,y:0}}}),403);
assert.equal(await create('valid','alice',{text:'Changed evidence'}),403,'cannot rewrite');
async function get(uid,path='/canalFeedback/valid',method='GET') {return fetch(`${base}${path}`,{method,headers:uid?{Authorization:`Bearer ${token(uid)}`}:{}});}
assert.equal((await get('alice')).status,200);
assert.equal((await get('alice','/canalFeedback/not-yet-created')).status,404,'transaction can check missing note before create');
assert.equal((await get('bob')).status,403);
assert.equal((await get(null)).status,403);
assert.equal((await get('alice','/canalFeedback/valid','DELETE')).status,403);
console.log('Feedback rules: owner submission/read, immutable evidence, auth/size/anchor/status rejection passed.');
