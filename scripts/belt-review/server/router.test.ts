/** /api/belt-review router: save, revision conflict, token, stage gating, ledger, path traversal, compare rounds. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { beltReviewRouter } from './router.ts';
import type { CandidatesFile, FaceFile } from '../../../src/canalRecall/beltReview/types.ts';

const TOKEN = 'test-token';
const P1 = '0363100012174415', P2 = '0363100012174416';
let tmp: string, data: string, images: string, roundRoot: string, base: string, server: ReturnType<express.Express['listen']>;

const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex'); // not a real picture; served as bytes

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'belt-review-test-'));
  data = path.join(tmp, 'data'); images = path.join(tmp, 'images'); roundRoot = path.join(tmp, 'round');
  const face: FaceFile = { faceId: 'test-face', street: 'Prinsengracht', side: 'even', pands: [{ pandId: P2, address: 'Prinsengracht 146–148', order: 1, numbers: [146, 148] }, { pandId: P1, address: 'Prinsengracht 150', order: 0 }] };
  const cand = (id: string, file: string) => ({ id, file, year: 2022, month: 3, distM: 12, obliquityDeg: 4, source: 'wall' as const, flags: [], pano: { id: 'pano', date: '2022-03-20' } });
  const candidates: CandidatesFile = { pands: [
    { pandId: P1, candidates: [cand('a', 'p1/a.jpg'), cand('b', 'p1/b.jpg'), cand('evil', '../secret.jpg'), cand('abs', '/etc/hosts.jpg'), cand('link', 'p1/link.jpg'), cand('txt', 'p1/notes.txt')], autoPick: 'a' },
    // `c` is a lane B crop with a 1.5 m margin each side of a 3.46 m BAG front at 50 px/m.
    { pandId: P2, candidates: [{ ...cand('c', 'p2/c.jpg'), pandSpanPx: [75, 248] as [number, number], marginM: 1.5, pxPerM: 50, widthPx: 323 }], autoPick: 'c' },
  ] };
  await fs.mkdir(path.join(data, 'test-face'), { recursive: true });
  await fs.writeFile(path.join(data, 'test-face', 'face.json'), JSON.stringify(face));
  await fs.writeFile(path.join(data, 'test-face', 'candidates.json'), JSON.stringify(candidates));
  for (const f of ['p1/a.jpg', 'p1/b.jpg', 'p2/c.jpg', 'p1/notes.txt']) { await fs.mkdir(path.dirname(path.join(images, f)), { recursive: true }); await fs.writeFile(path.join(images, f), jpeg); }
  await fs.writeFile(path.join(tmp, 'secret.jpg'), 'secret');
  await fs.symlink(path.join(tmp, 'secret.jpg'), path.join(images, 'p1/link.jpg'));
  // Compare round, folder shape A.
  const blk = path.join(roundRoot, 'layers', 'blk-one');
  await fs.mkdir(blk, { recursive: true });
  for (const f of ['today.jpg', 'r1.jpg', 'r2.jpg', 'photo-row.jpg', 'photo-01.jpg', 'photo-02.jpg']) await fs.writeFile(path.join(blk, f), jpeg);
  await fs.writeFile(path.join(blk, 'photos.json'), JSON.stringify({ title: 'Block one', photos: [{ file: 'photo-01.jpg', pandId: P1, date: '2024-12-20', obliquityDeg: 30.3, usable: true }] }));
  await fs.writeFile(path.join(roundRoot, 'outside.jpg'), jpeg);

  const app = express(); app.use(express.json());
  app.use('/api/belt-review', beltReviewRouter({ dataRoot: data, imageRoot: images, token: TOKEN, rounds: [{ id: 'test-round', title: 'Test', root: roundRoot }, { id: 'missing-round', title: 'Missing', root: path.join(tmp, 'nope') }] }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.on('listening', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/belt-review`;
});
after(async () => { await new Promise<void>(r => server.close(() => r())); await fs.rm(tmp, { recursive: true, force: true }); });

const get = async (p: string) => { const r = await fetch(base + p); return { status: r.status, body: await r.json().catch(() => null) }; };
const post = async (p: string, body: unknown, token: string | null = TOKEN) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-review-token': token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const disk = async (doc: string) => JSON.parse(await fs.readFile(path.join(data, 'test-face', `${doc}.json`), 'utf8'));

describe('faces', () => {
  it('lists faces and returns the bundle with pands in order and initial docs', async () => {
    const list = await get('/faces');
    assert.equal(list.body.faces[0].faceId, 'test-face');
    const b = (await get('/faces/test-face')).body;
    assert.equal(b.token, TOKEN);
    assert.deepEqual(b.face.pands.map((p: { pandId: string }) => p.pandId), [P1, P2]);
    assert.equal(b.picks.revision, 0); assert.equal(b.state.stage, 1); assert.equal(b.state.status, 'with-david');
  });
  it('refuses a bad face id', async () => {
    assert.equal((await get('/faces/..%2F..%2Fetc')).status, 400);
    assert.equal((await get('/faces/no-such-face')).status, 404);
  });
});

describe('picks: save, token, revision conflict', () => {
  it('needs the session token', async () => {
    assert.equal((await post(`/faces/test-face/picks/${P1}`, { expectedRevision: 0, value: { candidateId: 'a' } }, null)).status, 403);
    assert.equal((await post(`/faces/test-face/picks/${P1}`, { expectedRevision: 0, value: { candidateId: 'a' } }, 'stale')).status, 403);
  });
  it('validates the candidate and the pand', async () => {
    assert.equal((await post(`/faces/test-face/picks/${P1}`, { expectedRevision: 0, value: { candidateId: 'nope' } })).status, 400);
    assert.equal((await post('/faces/test-face/picks/0363100099999999', { expectedRevision: 0, value: { candidateId: 'a' } })).status, 400);
    assert.equal((await post(`/faces/test-face/picks/${P1}`, { value: { candidateId: 'a' } })).status, 400);
  });
  it('saves to disk, bumps revisions, refuses a stale revision and keeps the first write', async () => {
    const first = await post(`/faces/test-face/picks/${P1}`, { expectedRevision: 0, value: { candidateId: 'a' } });
    assert.equal(first.status, 200);
    assert.equal(first.body.doc.picks[P1].revision, 1);
    assert.equal(first.body.ledger.photos.agreedWithAuto, 1);
    const stale = await post(`/faces/test-face/picks/${P1}`, { expectedRevision: 0, value: { candidateId: 'b' } });
    assert.equal(stale.status, 409);
    assert.equal((await disk('picks')).picks[P1].candidateId, 'a');
    const second = await post(`/faces/test-face/picks/${P1}`, { expectedRevision: 1, value: { candidateId: 'b' } });
    assert.equal(second.status, 200);
    const onDisk = await disk('picks');
    assert.equal(onDisk.picks[P1].candidateId, 'b'); assert.equal(onDisk.picks[P1].revision, 2); assert.equal(onDisk.picks[P1].autoPick, 'a');
    assert.equal(onDisk.revision, 2);
    assert.equal(second.body.ledger.photos.overridden, 1);
  });
});

describe('picks: facade span and split houses', () => {
  // Its own face (a copy of test-face's face and candidates), so the stage tests below see test-face untouched.
  before(async () => {
    await fs.mkdir(path.join(data, 'span-face'));
    for (const f of ['face.json', 'candidates.json']) {
      const j = JSON.parse(await fs.readFile(path.join(data, 'test-face', f), 'utf8'));
      if (f === 'face.json') j.faceId = 'span-face';
      await fs.writeFile(path.join(data, 'span-face', f), JSON.stringify(j));
    }
  });
  const sdisk = async (doc: string) => JSON.parse(await fs.readFile(path.join(data, 'span-face', `${doc}.json`), 'utf8'));
  it('stores the dragged facade span with its metres from the BAG start, and counts it', async () => {
    const r = await post(`/faces/span-face/picks/${P2}`, { expectedRevision: 0, value: { candidateId: 'c', facadeSpanPx: [50, 300] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const pk = (await sdisk('picks')).picks[P2];
    assert.deepEqual(pk.facadeSpanPx, [50, 300]); assert.deepEqual(pk.facadeSpanM, [-0.5, 4.5]);
    assert.equal(r.body.ledger.photos.spanCorrected, 1);
  });
  it('refuses a malformed span or one on a photo without a BAG span', async () => {
    const rev = (await sdisk('picks')).picks[P2].revision;
    assert.equal((await post(`/faces/span-face/picks/${P2}`, { expectedRevision: rev, value: { candidateId: 'c', facadeSpanPx: [300, 50] } })).status, 400);
    assert.equal((await post(`/faces/span-face/picks/${P2}`, { expectedRevision: rev, value: { candidateId: 'c', facadeSpanPx: [50, 70] } })).status, 400);
    const p1 = (await sdisk('picks')).picks[P1]?.revision ?? 0;
    assert.equal((await post(`/faces/span-face/picks/${P1}`, { expectedRevision: p1, value: { candidateId: 'b', facadeSpanPx: [0, 100] } })).status, 400);
  });
  it('splits a pand into houses (outer ends snap to the span), keeps them on a re-pick, expands the house face', async () => {
    let rev = (await sdisk('picks')).picks[P2].revision;
    const r = await post(`/faces/span-face/picks/${P2}`, { expectedRevision: rev, value: { candidateId: 'c', houses: [{ fromM: 0, toM: 2.5, label: '146' }, { fromM: 2.5, toM: 9, label: '148' }] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    let pk = (await sdisk('picks')).picks[P2];
    assert.deepEqual(pk.houses, [{ fromM: -0.5, toM: 2.5, label: '146' }, { fromM: 2.5, toM: 4.5, label: '148' }]);
    assert.deepEqual(pk.facadeSpanM, [-0.5, 4.5], 'span kept when only houses are sent');
    assert.equal(r.body.ledger.photos.pandSplits, 1);
    const d = (await get('/faces/span-face/derived')).body;
    assert.deepEqual(Object.keys(d.pands).sort(), [P1, `${P2}#1`, `${P2}#2`].sort());
    // Edits address a split house.
    assert.equal((await post(`/faces/span-face/edits/${P2}%231`, { expectedRevision: 0, value: { fields: { crown: { value: 'neck' } } } })).status, 200);
    rev = pk.revision;
    assert.equal((await post(`/faces/span-face/picks/${P2}`, { expectedRevision: rev, value: { candidateId: 'c' } })).status, 200);
    pk = (await sdisk('picks')).picks[P2];
    assert.equal(pk.houses.length, 2, 'a re-pick of the same photo keeps the split');
    assert.equal((await post(`/faces/span-face/picks/${P2}`, { expectedRevision: pk.revision, value: { candidateId: 'c', houses: [{ fromM: 0, toM: 0.3 }, { fromM: 0.3, toM: 4 }] } })).status, 400, 'a house under 1 m');
    // Clear the split (later tests address the pand as one house); the span stays.
    assert.equal((await post(`/faces/span-face/picks/${P2}`, { expectedRevision: pk.revision, value: { candidateId: 'c', houses: null } })).status, 200);
    pk = (await sdisk('picks')).picks[P2];
    assert.equal(pk.houses, undefined); assert.deepEqual(pk.facadeSpanM, [-0.5, 4.5]);
  });
});

describe('state: stages in order, send to Claude, ledger', () => {
  it('refuses to confirm stage 1 until every pand has a pick', async () => {
    const r = await post('/faces/test-face/state', { expectedRevision: 0, action: 'confirm-stage', stage: 1 });
    assert.equal(r.status, 409); assert.match(r.body.error, /without a photo pick/);
    assert.equal((await post(`/faces/test-face/picks/${P2}`, { expectedRevision: 0, value: { candidateId: null } })).status, 200);
    const ok = await post('/faces/test-face/state', { expectedRevision: 0, action: 'confirm-stage', stage: 1 });
    assert.equal(ok.status, 200); assert.equal(ok.body.doc.stage, 2); assert.ok(ok.body.doc.confirmed['1']);
    assert.equal(ok.body.ledger.photos.noneUsable, 1);
    assert.equal(ok.body.ledger.stageFailures['1'], 2);
  });
  it('refuses a stale state revision and a skipped stage', async () => {
    assert.equal((await post('/faces/test-face/state', { expectedRevision: 0, action: 'send-to-claude' })).status, 409);
    assert.equal((await post('/faces/test-face/state', { expectedRevision: 1, action: 'confirm-stage', stage: 3 })).status, 409);
  });
  it('locks picks once stage 1 is confirmed; reopening moves the stage pointer back', async () => {
    const locked = await post(`/faces/test-face/picks/${P1}`, { expectedRevision: 2, value: { candidateId: 'a' } });
    assert.equal(locked.status, 409); assert.match(locked.body.error, /Reopen stage 1/);
    const r = await post('/faces/test-face/state', { expectedRevision: 1, action: 'reopen-stage', stage: 1 });
    assert.equal(r.status, 200); assert.equal(r.body.doc.stage, 1); assert.equal(r.body.doc.confirmed['1'], undefined);
    assert.equal(r.body.ledger.reopens['1'], 1);
  });
  it('send to Claude writes status with-claude to state.json', async () => {
    const r = await post('/faces/test-face/state', { expectedRevision: 2, action: 'send-to-claude' });
    assert.equal(r.status, 200);
    const s = await disk('state');
    assert.equal(s.status, 'with-claude'); assert.equal(s.passes, 1); assert.equal(s.revision, 3);
    assert.equal(r.body.ledger.passes, 1);
  });
  it('adds active seconds to the ledger, capped per post', async () => {
    assert.equal((await post('/faces/test-face/activity', { seconds: 30, stage: 1 })).status, 200);
    assert.equal((await post('/faces/test-face/activity', { seconds: 500, stage: 1 })).status, 400);
    const l = await disk('ledger');
    assert.equal(l.david.activeSeconds, 30); assert.equal(l.david.byStage['1'], 30);
  });
});

describe('edits, pins, grouping', () => {
  it('saves a field edit and refuses a bad path', async () => {
    assert.equal((await post(`/faces/test-face/edits/${P1}`, { expectedRevision: 0, value: { fields: { crown: { value: 'bell' }, 'fronts/0/cornice': { value: 'heavy' } } } })).status, 200);
    assert.equal((await post(`/faces/test-face/edits/${P1}`, { expectedRevision: 1, value: { fields: { '../x': { value: 1 } } } })).status, 400);
    assert.equal((await disk('edits')).edits[P1].fields.crown.value, 'bell');
  });
  it('creates a pin and refuses a stale pin write', async () => {
    const pin = { pandId: P1, target: 'render', x: 0.4, y: 0.2, tag: 'gable-crown', note: 'neck too wide' };
    const r = await post('/faces/test-face/pins/pin-1', { expectedRevision: 0, value: pin });
    assert.equal(r.status, 200); assert.equal(r.body.doc.pins['pin-1'].status, 'open'); assert.equal(r.body.doc.pins['pin-1'].pass, 1);
    assert.equal((await post('/faces/test-face/pins/pin-1', { expectedRevision: 0, value: pin })).status, 409);
    assert.equal((await post('/faces/test-face/pins/pin-2', { expectedRevision: 0, value: { ...pin, tag: 'nope' } })).status, 400);
    assert.equal(r.body.ledger.pins.byTag['gable-crown'], 1);
  });
  it('saves grouping with a basedOn link and refuses a pand in two units', async () => {
    const ok = await post('/faces/test-face/grouping', { expectedRevision: 0, value: { units: [{ id: 'u1', pandIds: [P1, P2], source: 'david' }], links: [{ pandId: P2, kind: 'basedOn', target: P1, overrides: { crown: 'neck' } }] } });
    assert.equal(ok.status, 200);
    assert.equal((await post('/faces/test-face/grouping', { expectedRevision: 1, value: { units: [{ id: 'u1', pandIds: [P1] }, { id: 'u2', pandIds: [P1] }], links: [] } })).status, 400);
  });
});

describe('derived (render adapter over description + edits + grouping)', () => {
  it('draws description fields with edits on top and follows a basedOn link', async () => {
    const f = (value: unknown) => ({ value, source: 'own-read', confidence: 0.6, ref: 't' });
    await fs.writeFile(path.join(data, 'test-face', 'description.json'), JSON.stringify({ version: 1, pands: [{ pandId: P1, fields: { crown: f('bell'), storeys: f(4) } }, { pandId: P2, fields: { crown: f('step') } }] }));
    const d = (await get('/faces/test-face/derived')).body;
    // P1's crown was edited to bell earlier in this file; P2 is based on P1 (grouping test above).
    assert.equal(d.pands[P1].fields.crown.source, 'edit');
    assert.deepEqual(d.pands[P2].chain, [`basedOn:${P1}`]);
    assert.equal(d.pands[P2].fields.crown.value, 'neck'); assert.equal(d.pands[P2].fields.storeys.value, 4);
    assert.match(d.pands[P2].hash, /^[0-9a-f]{24}$/);
    const l = await disk('ledger');
    assert.equal(typeof l.fields.fromLibrary, 'number');
  });
});

describe('images: path traversal', () => {
  it('serves a candidate inside the image root', async () => {
    const r = await fetch(`${base}/faces/test-face/image/${P1}/a`);
    assert.equal(r.status, 200);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), jpeg);
  });
  it('refuses .., absolute paths, symlinks out of the root and non-images', async () => {
    for (const id of ['evil', 'abs', 'link', 'txt']) {
      const r = await fetch(`${base}/faces/test-face/image/${P1}/${id}`);
      assert.equal(r.status, 400, id);
      assert.notEqual(await r.text(), 'secret');
    }
    assert.equal((await fetch(`${base}/faces/test-face/image/${P1}/unknown`)).status, 404);
  });
});

describe('compare rounds', () => {
  it('discovers layers (photo-row as photo, today, r1, r2) and captions', async () => {
    const r = (await get('/rounds/test-round')).body;
    assert.equal(r.exists, true);
    const b = r.blocks[0];
    assert.equal(b.title, 'Block one');
    assert.deepEqual(b.layers.map((l: { name: string }) => l.name), ['photo', 'today', 'r1', 'r2']);
    assert.match(b.layers[0].url, /photo-row\.jpg/);
    assert.equal(b.photos.length, 2); assert.match(b.photos[0].caption, /2024-12-20/);
    assert.equal((await fetch(b.layers[1].url.replace('/api/belt-review', base))).status, 200);
  });
  it('a round whose folder does not exist yet loads empty', async () => {
    const r = (await get('/rounds/missing-round')).body;
    assert.equal(r.exists, false); assert.deepEqual(r.blocks, []);
  });
  it('refuses file paths outside the round root', async () => {
    for (const p of ['../secret.jpg', '/etc/hosts', 'layers/../../secret.jpg', 'layers/blk-one/photos.json']) assert.equal((await fetch(`${base}/rounds/test-round/file?path=${encodeURIComponent(p)}`)).status, 400, p);
    assert.equal((await fetch(`${base}/rounds/test-round/file?path=outside.jpg`)).status, 200);
  });
  it('saves a verdict per block with its own revision', async () => {
    const one = await post('/rounds/test-round/verdicts/blk-one', { expectedRevision: 0, value: { verdict: 'better', note: 'r2 gables read' } });
    assert.equal(one.status, 200); assert.equal(one.body.doc.verdicts['blk-one'].revision, 1);
    assert.equal((await post('/rounds/test-round/verdicts/blk-one', { expectedRevision: 0, value: { verdict: 'worse', note: '' } })).status, 409);
    assert.equal((await post('/rounds/test-round/verdicts/blk-two', { expectedRevision: 0, value: { verdict: 'meh', note: '' } })).status, 400);
    assert.equal((await post('/rounds/test-round/verdicts/blk-one', { expectedRevision: 1, value: { verdict: 'same', note: 'x' } }, null)).status, 403);
    const saved = JSON.parse(await fs.readFile(path.join(data, 'rounds', 'test-round', 'verdicts.json'), 'utf8'));
    assert.equal(saved.verdicts['blk-one'].verdict, 'better');
  });
});
