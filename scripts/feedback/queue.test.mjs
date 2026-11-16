import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, transitions, pullPages } from './queue.mjs';
test('Firestore nested feedback metadata roundtrips, including image anchors and absent build', () => {
  const data = {text:'Fix façade',target:{anchor:{x:.4,y:.75}},context:{camera:{zoom:17.25},ready:true},environment:{build:null},values:[1,2.5,'x']};
  assert.deepEqual(decode(encode(data)),data);
  assert.equal(decode({timestampValue:'2026-10-05T10:00:00Z'}),'2026-10-05T10:00:00Z');
});
test('resolution requires a claim and failed fixes can reopen', () => {
  assert(!transitions.open.includes('resolved'));
  assert(transitions['in-progress'].includes('resolved'));
  assert(transitions.resolved.includes('open'));
});
test('pull pages through every note and flags atLimit only when --limit cut it short', async () => {
  const all = Array.from({ length: 7 }, (_, i) => i);
  const runPage = async (offset, size) => all.slice(offset, offset + size);
  assert.deepEqual(await pullPages(runPage, { pageSize: 3 }), { docs: all, atLimit: false });
  assert.deepEqual(await pullPages(runPage, { pageSize: 7 }), { docs: all, atLimit: false });
  assert.deepEqual(await pullPages(runPage, { max: 5, pageSize: 3 }), { docs: all.slice(0, 5), atLimit: true });
  assert.deepEqual(await pullPages(runPage, { max: 50, pageSize: 3 }), { docs: all, atLimit: false });
});
