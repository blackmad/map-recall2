/** POI-stamp rules (users/{uid}/poiStamps/{id}). Firestore emulator only; run
 * with `npm run test:collection:rules` (reuses firebase.feedback.json). */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { encode } from '../feedback/queue.mjs';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required');
const project = 'demo-canal-feedback';
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const ruleResponse = await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: await readFile('firestore.rules', 'utf8') }] } }),
});
assert.equal(ruleResponse.status, 200, await ruleResponse.text());
function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  return [{ alg: 'none', typ: 'JWT' }, { iss: `https://securetoken.google.com/${project}`, aud: project, iat: now, exp: now + 3600, sub: uid, user_id: uid, auth_time: now, firebase: { sign_in_provider: 'google.com', identities: {} } }]
    .map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.';
}
const stamp = (id, change = {}) => ({ id, kind: 'poi', name: 'Westerkerk', firstEarnedAt: 1760000000000, lastEarnedAt: 1760000000000, how: 'arrived', count: 1, schemaVersion: 1, ...change });
async function write(owner, id, doc, uid = owner) {
  const fields = Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, encode(v)]));
  const r = await fetch(`${base}:commit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    body: JSON.stringify({ writes: [{ update: { name: `projects/${project}/databases/(default)/documents/users/${owner}/poiStamps/${id}`, fields } }] }),
  });
  return r.status;
}
async function get(owner, id, uid = owner, method = 'GET') {
  return (await fetch(`${base}/users/${owner}/poiStamps/${id}`, { method, headers: uid ? { Authorization: `Bearer ${token(uid)}` } : {} })).status;
}
assert.equal(await write('alice', 'extract_landmarks_1', stamp('extract_landmarks_1')), 200, 'owner can write a stamp');
assert.equal(await write('alice', 'extract_landmarks_1', stamp('extract_landmarks_1', { count: 4, lastEarnedAt: 1760000009999, how: 'named' })), 200, 'owner can update the merged stamp');
assert.equal(await write('alice', 'tour:jewish-amsterdam', stamp('tour:jewish-amsterdam', { kind: 'tour', how: 'completed', name: 'Jewish Amsterdam' })), 200, 'tour stamp');
assert.equal(await write('alice', 'x', stamp('x'), 'bob'), 403, 'another user cannot write');
assert.equal(await write('alice', 'x', stamp('x'), null), 403, 'guest cannot write');
assert.equal(await write('alice', 'x', stamp('y')), 403, 'id must match the document');
assert.equal(await write('alice', 'x', stamp('x', { kind: 'badge' })), 403, 'kind is validated');
assert.equal(await write('alice', 'x', stamp('x', { how: 'teleported' })), 403, 'how is validated');
assert.equal(await write('alice', 'x', stamp('x', { count: 0 })), 403, 'count >= 1');
assert.equal(await write('alice', 'x', stamp('x', { count: 1.5 })), 403, 'count is an integer');
assert.equal(await write('alice', 'x', stamp('x', { lastEarnedAt: 5 })), 403, 'last earning cannot precede the first');
assert.equal(await write('alice', 'x', stamp('x', { name: 'n'.repeat(201) })), 403, 'name size');
assert.equal(await write('alice', 'x', stamp('x', { schemaVersion: 2 })), 403, 'schema version');
assert.equal(await write('alice', 'x', stamp('x', { extra: true })), 403, 'no extra fields');
assert.equal(await get('alice', 'extract_landmarks_1'), 200, 'owner reads');
assert.equal(await get('alice', 'extract_landmarks_1', 'bob'), 403, 'others cannot read');
assert.equal(await get('alice', 'extract_landmarks_1', null), 403, 'guest cannot read');
assert.equal(await get('alice', 'extract_landmarks_1', 'bob', 'DELETE'), 403, 'others cannot delete');
assert.equal(await get('alice', 'extract_landmarks_1', 'alice', 'DELETE'), 200, 'owner can delete');
console.log('POI stamp rules: owner read/write/delete, id/kind/how/count/time/name/schema/extra-field rejection passed.');
