/** Ride history rules (users/{uid}/gameSessions). Run against a Firestore emulator only. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { encode } from '../feedback/queue.mjs';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required');
const project = 'demo-canal-feedback';
const root = `projects/${project}/databases/(default)/documents`;
const base = `http://${host}/v1/${root}`;
const ruleResponse = await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: await readFile('firestore.rules', 'utf8') }] } }) });
assert.equal(ruleResponse.status, 200, await ruleResponse.text());
function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  return [{ alg: 'none', typ: 'JWT' }, { iss: `https://securetoken.google.com/${project}`, aud: project, iat: now, exp: now + 3600, sub: uid, user_id: uid, auth_time: now, firebase: { sign_in_provider: 'google.com', identities: {} } }]
    .map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.';
}
const ride = (id, change = {}) => ({
  id, schemaVersion: 1, startedAt: 1760700000000, endedAt: 1760700300000, mode: 'bike', cityId: 'amsterdam',
  start: { name: 'Westerkerk', lngLat: [4.8838, 52.3747] },
  finish: { name: 'Anne Frank House', landmarkId: 'poi-9', lngLat: [4.884, 52.3752] },
  namedCount: 3, askedCount: 4, points: 120, streetsLearned: ['Prinsengracht', 'Bloemgracht'],
  raceHash: '#race=52.3737,4.8816,52.3728,4.8737,52.3757,4.8898', ...change,
});
async function put(owner, id, data, uid = owner) {
  const write = { update: { name: `${root}/users/${owner}/gameSessions/${id}`, fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)])) } };
  const r = await fetch(`${base}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) }, body: JSON.stringify({ writes: [write] }) });
  return r.status;
}
const omit = (object, key) => Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));

assert.equal(await put('alice', 'ride-1', ride('ride-1')), 200, 'owner can record a ride');
assert.equal(await put('alice', 'ride-1', ride('ride-1', { points: 130 })), 200, 'owner can re-sync a ride');
assert.equal(await put('alice', 'ride-2', ride('ride-2', { mode: 'boat', finish: { name: 'Westerdok', landmarkId: null, lngLat: [4.89, 52.38] } })), 200, 'finish without a landmark id');
assert.equal(await put('alice', 'ride-3', ride('ride-3', { mode: 'transit', raceHash: '' })), 200, 'transit, no share hash');
assert.equal(await put('alice', 'ride-4', ride('ride-4'), null), 403, 'guest cannot write');
assert.equal(await put('alice', 'ride-5', ride('ride-5'), 'bob'), 403, 'cannot write into another user');
assert.equal(await put('alice', 'ride-6', ride('other-id')), 403, 'id must match the document');
assert.equal(await put('alice', 'ride-7', ride('ride-7', { mode: 'car' })), 403, 'internal mode name rejected');
assert.equal(await put('alice', 'ride-8', ride('ride-8', { namedCount: 5, askedCount: 4 })), 403, 'cannot name more than asked');
assert.equal(await put('alice', 'ride-9', ride('ride-9', { namedCount: 1.5 })), 403, 'counts are whole');
assert.equal(await put('alice', 'ride-10', ride('ride-10', { startedAt: 1760700400000 })), 403, 'start after end rejected');
assert.equal(await put('alice', 'ride-11', ride('ride-11', { start: { name: 'x', lngLat: [4.8, 'north'] } })), 403, 'bad lngLat rejected');
assert.equal(await put('alice', 'ride-12', ride('ride-12', { streetsLearned: Array.from({ length: 101 }, (_, i) => `S${i}`) })), 403, 'name list bounded');
assert.equal(await put('alice', 'ride-13', ride('ride-13', { extra: 'nope' })), 403, 'unknown field rejected');
assert.equal(await put('alice', 'ride-14', omit(ride('ride-14'), 'raceHash')), 403, 'missing field rejected');
assert.equal(await put('alice', 'ride-15', ride('ride-15', { finish: { name: 'x'.repeat(201), landmarkId: null, lngLat: [4.8, 52.3] } })), 403, 'long name rejected');

async function req(uid, path, method = 'GET') { return fetch(`${base}${path}`, { method, headers: uid ? { Authorization: `Bearer ${token(uid)}` } : {} }); }
assert.equal((await req('alice', '/users/alice/gameSessions/ride-1')).status, 200, 'owner reads');
assert.equal((await req('bob', '/users/alice/gameSessions/ride-1')).status, 403, 'others cannot read');
assert.equal((await req(null, '/users/alice/gameSessions/ride-1')).status, 403, 'guests cannot read');
assert.equal((await req('alice', '/users/alice/gameSessions')).status, 200, 'owner lists');
assert.equal((await req('bob', '/users/alice/gameSessions/ride-1', 'DELETE')).status, 403);
assert.equal((await req('alice', '/users/alice/gameSessions/ride-3', 'DELETE')).status, 200, 'owner deletes');
console.log('Ride history rules: owner write/read/list/delete, field validation and cross-user rejection passed.');
