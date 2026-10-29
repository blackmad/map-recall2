/**
 * Emulator test for the analytics function and its Firestore rules.
 * Run: npm --prefix functions run test:emulator (functions + firestore emulators, demo project).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const project = 'demo-canal-analytics';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!firestoreHost) throw new Error('FIRESTORE_EMULATOR_HOST is required (run under emulators:exec)');
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:8399';
const endpoint = `http://${functionsHost}/${project}/europe-west4/analytics`;
const root = `projects/${project}/databases/(default)/documents`;
const docs = `http://${firestoreHost}/v1/${root}`;
const rulesPath = fileURLToPath(new URL('../../firestore.rules', import.meta.url));

// The emulator loads firestore.rules from the config; push them again so the test is explicit.
const ruleResponse = await fetch(`http://${firestoreHost}/emulator/v1/projects/${project}:securityRules`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: await readFile(rulesPath, 'utf8') }] } }),
});
assert.equal(ruleResponse.status, 200, await ruleResponse.text());

function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  return [{ alg: 'none', typ: 'JWT' }, { iss: `https://securetoken.google.com/${project}`, aud: project, iat: now, exp: now + 3600, sub: uid, user_id: uid, auth_time: now, firebase: { sign_in_provider: 'google.com', identities: {} } }]
    .map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.';
}

const beacon = (body, contentType = 'text/plain;charset=UTF-8') =>
  fetch(endpoint, { method: 'POST', headers: { 'Content-Type': contentType }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function dayCounters() {
  // `Bearer owner` is the emulator's admin bypass, standing in for the operator's IAM read.
  const r = await fetch(`${docs}/analytics_daily/${day}/analytics_shards?pageSize=50`, { headers: { Authorization: 'Bearer owner' } });
  assert.equal(r.status, 200, await r.clone().text());
  const { documents = [] } = await r.json();
  const total = {};
  const fieldNames = new Set();
  for (const doc of documents) {
    for (const name of Object.keys(doc.fields)) fieldNames.add(name);
    for (const [key, value] of Object.entries(doc.fields.c?.mapValue?.fields ?? {})) {
      total[key] = (total[key] ?? 0) + Number(value.integerValue ?? value.doubleValue ?? 0);
    }
  }
  return { total, fieldNames, shards: documents.length };
}

// Wait for the function to be ready (the emulator loads it lazily).
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(endpoint, { method: 'GET' }); if (r.status === 405) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 250));
}

assert.equal((await fetch(endpoint, { method: 'GET' })).status, 405, 'GET is refused');

const sid = 'aaaaaaaaaaaaaaaa';
const good = {
  v: 1, sid, n: 0, events: [
    { t: 'session', device: 'phone' },
    { t: 'ride_start', mode: 'bike', entry: 'surprise', city: 'amsterdam', seq: '1' },
    { t: 'buurt', mode: 'bike', code: 'AA01' },
    { t: 'buurt', mode: 'bike', code: 'AA01' },
    { t: 'answer', mode: 'bike', kind: 'street', prompt: 'route', input: 'multiple', outcome: 'correct' },
    // Off the allow-list: dropped, only counted under _meta|dropped.
    { t: 'buurt', mode: 'bike', code: 'AA01', lat: 52.3747, lng: 4.8838 },
    { t: 'pageview', path: '/ride?user=alice' },
  ],
};
assert.equal((await beacon(good)).status, 204, 'beacon accepted');
assert.equal((await beacon(good)).status, 204, 'replay answered the same');
assert.equal((await beacon({ ...good, n: 1, events: [{ t: 'session', device: 'desktop' }] }, 'application/json')).status, 204, 'JSON content type also works');
assert.equal((await beacon('{not json')).status, 204, 'garbage answered the same');
assert.equal((await beacon({ ...good, n: 2, ip: '203.0.113.9' })).status, 204, 'bad envelope answered the same');
assert.equal((await beacon('x'.repeat(40000))).status, 204, 'oversized answered the same');

const { total, fieldNames } = await dayCounters();
assert.deepEqual(total, {
  '_meta|batches': 2,
  '_meta|dropped': 2,
  '_meta|replayed': 1,
  'session|device=phone': 1,
  'session|device=desktop': 1,
  'ride_start|mode=bike|entry=surprise|city=amsterdam|seq=1': 1,
  'buurt|mode=bike|code=AA01': 2,
  'answer|mode=bike|kind=street|prompt=route|input=multiple|outcome=correct': 1,
}, JSON.stringify(total));
assert.deepEqual([...fieldNames].sort(), ['c', 'day'], 'shard documents hold only the day and counters');
const stored = JSON.stringify(total);
for (const forbidden of [sid, '52.37', '4.88', 'alice', '203.0.113', 'pageview']) assert.ok(!stored.includes(forbidden), `nothing stores ${forbidden}`);

// Rules: browsers cannot read or write the counters, signed in or not.
const shardDoc = `${docs}/analytics_daily/${day}/analytics_shards/0`;
for (const auth of [null, token('alice')]) {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : {};
  assert.equal((await fetch(shardDoc, { headers })).status, 403, `read denied (${auth ? 'signed in' : 'guest'})`);
  assert.equal((await fetch(`${docs}/analytics_daily/${day}/analytics_shards`, { headers })).status, 403, 'list denied');
  assert.equal((await fetch(`${docs}/analytics_daily/${day}`, { headers })).status, 403, 'day doc read denied');
  const write = { writes: [{ update: { name: `${root}/analytics_daily/${day}/analytics_shards/9`, fields: { c: { mapValue: { fields: { 'session|device=phone': { integerValue: '1000' } } } } } } }] };
  assert.equal((await fetch(`${docs}:commit`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(write) })).status, 403, 'write denied');
}

console.log(`analytics emulator test passed (${Object.keys(total).length} counters)`);
