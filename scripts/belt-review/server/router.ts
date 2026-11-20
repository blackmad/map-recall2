/**
 * `/api/belt-review`: the local belt review server (plan R1). Mounted by server.ts; the page is
 * public/canal-drive/belt-review.html, its script is bundled on request from src/canalRecall/beltReview/page.ts.
 *
 *   GET  /faces                               face summaries
 *   GET  /faces/:face                         the face bundle (all docs + a session token)
 *   POST /faces/:face/picks/:pand             {expectedRevision, value: {candidateId|null, note?}}
 *   POST /faces/:face/edits/:pand             {expectedRevision, value: {fields: {path: {value, note?}}}}
 *   POST /faces/:face/pins/:pin               {expectedRevision, value: Pin fields}         (expectedRevision 0 = new)
 *   POST /faces/:face/grouping                {expectedRevision, value: {units, links}}
 *   POST /faces/:face/state                   {expectedRevision, action, stage?}
 *   POST /faces/:face/activity                {seconds, stage}                              (no revision: additive)
 *   GET  /faces/:face/image/:pand/:candidate  the candidate crop (path-guarded) or a redirect to its URL
 *   GET  /rounds                              compare rounds
 *   GET  /rounds/:round                       blocks, layers, verdicts, token
 *   GET  /rounds/:round/file?path=rel         a layer or photo image (path-guarded)
 *   POST /rounds/:round/verdicts/:block       {expectedRevision, value: {verdict, note}}
 *   GET  /page.js                             the page bundle (esbuild, built per request)
 *
 * Every POST needs header `x-review-token` (the token from the GET; it changes when the server restarts) and the
 * revision the writer last saw; a stale revision is 409 and nothing is written. Writes go through `lockedJson`.
 * An `x-review-actor: claude` header marks a Claude-side write (default david).
 */
import { Router, type Request, type Response } from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BeltReviewStore, lockedJson, readJson, resolveInside } from '../../../src/canalRecall/beltReview/store.ts';
import { discoverRound } from '../../../src/canalRecall/beltReview/compare.ts';
import {
  ReviewError, addActivity, applyStateAction, validateEdits, validateGrouping, validatePick, validatePin, validateVerdict,
} from '../../../src/canalRecall/beltReview/logic.ts';
import {
  ENTRY_ID_PATTERN, ID_PATTERN, PAND_PATTERN, STATE_ACTIONS, initialDocs, initialVerdicts,
  type Actor, type EntryDocName, type RoundsConfig, type StateAction,
} from '../../../src/canalRecall/beltReview/types.ts';

export interface BeltReviewOptions {
  dataRoot?: string;
  imageRoot?: string | null;
  /** Extra rounds (tests); merged over rounds.json. */
  rounds?: RoundsConfig['rounds'];
  /** Fixed token (tests). */
  token?: string;
  repoRoot?: string;
}

const fail = (res: Response, e: unknown) => {
  const status = e instanceof ReviewError ? e.status : (e as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 : 500;
  if (status === 500) console.error('belt-review:', e);
  res.status(status).json({ error: (e as Error).message });
};
const conflict = (what: string) => new ReviewError(`${what} changed in another tab or by Claude. Reload and compare before saving.`, 409);

export function beltReviewRouter(options: BeltReviewOptions = {}): Router {
  const repoRoot = options.repoRoot ?? process.cwd();
  const store = new BeltReviewStore(options.dataRoot ?? path.join(repoRoot, 'review-data', 'belt-review'), options.imageRoot !== undefined ? options.imageRoot : (process.env.BELT_REVIEW_IMAGE_ROOT || null));
  const token = options.token ?? randomUUID();
  const router = Router();
  const actorOf = (req: Request): Actor => req.get('x-review-actor') === 'claude' ? 'claude' : 'david';
  const guard = (req: Request) => { if (req.get('x-review-token') !== token) throw new ReviewError('Reload this local review page before saving (the server restarted).', 403); };
  const expected = (req: Request) => {
    const r = req.body?.expectedRevision;
    if (!Number.isInteger(r) || r < 0) throw new ReviewError('expectedRevision must be a whole number', 400);
    return r as number;
  };
  const now = () => new Date().toISOString();

  // ---------------------------------------------------------------------------------------------------------- faces
  router.get('/faces', async (_req, res) => { try { res.set('Cache-Control', 'no-store').json({ token, faces: await store.listFaces() }); } catch (e) { fail(res, e); } });
  router.get('/faces/:face', async (req, res) => { try { res.set('Cache-Control', 'no-store').json(await store.bundle(req.params.face, token)); } catch (e) { fail(res, e); } });

  const entryWrite = (doc: EntryDocName) => async (req: Request, res: Response) => {
    try {
      guard(req);
      const faceId = req.params.face, id = req.params.entry, rev = expected(req), actor = actorOf(req), at = now();
      if (doc !== 'pins' && !PAND_PATTERN.test(id)) throw new ReviewError('Invalid pand id', 400);
      if (doc === 'pins' && !ENTRY_ID_PATTERN.test(id)) throw new ReviewError('Invalid pin id', 400);
      const face = await store.face(faceId);
      const candidates = doc === 'picks' ? await store.candidates(faceId) : null;
      const state = await store.doc(faceId, 'state');
      if (doc === 'picks' && (state.stage !== 1 || state.status === 'accepted')) throw new ReviewError('Stage 1 is confirmed. Reopen stage 1 to change a pick.', 409);
      const result = await lockedJson(store.docPath(faceId, doc), initialDocs[doc](faceId), (file: any) => {
        const map = file[doc] as Record<string, { revision: number }>;
        const prior = map[id];
        if ((prior?.revision ?? 0) !== rev) throw conflict(doc === 'pins' ? 'This pin' : `The ${doc.slice(0, -1)} for this pand`);
        const value = req.body?.value;
        const clean = doc === 'picks' ? validatePick(face, candidates, id, value)
          : doc === 'edits' ? validateEdits(face, id, value)
          : validatePin(face, id, value, prior as never, actor, state.passes, at);
        map[id] = { ...clean, revision: (prior?.revision ?? 0) + 1, at, by: actor } as never;
        file.revision += 1;
        file.updatedAt = at;
        return structuredClone(file);
      });
      const ledger = await store.refreshLedger(faceId);
      res.json({ doc: result, ledger });
    } catch (e) { fail(res, e); }
  };
  router.post('/faces/:face/picks/:entry', entryWrite('picks'));
  router.post('/faces/:face/edits/:entry', entryWrite('edits'));
  router.post('/faces/:face/pins/:entry', entryWrite('pins'));

  router.post('/faces/:face/grouping', async (req, res) => {
    try {
      guard(req);
      const faceId = req.params.face, rev = expected(req), at = now(), face = await store.face(faceId);
      const doc = await lockedJson(store.docPath(faceId, 'grouping'), initialDocs.grouping(faceId), file => {
        if (file.revision !== rev) throw conflict('The grouping');
        Object.assign(file, validateGrouping(face, req.body?.value, actorOf(req), at));
        file.revision += 1;
        file.updatedAt = at;
        return structuredClone(file);
      });
      res.json({ doc, ledger: await store.refreshLedger(faceId) });
    } catch (e) { fail(res, e); }
  });

  router.post('/faces/:face/state', async (req, res) => {
    try {
      guard(req);
      const faceId = req.params.face, rev = expected(req), at = now(), action = req.body?.action as StateAction;
      if (!STATE_ACTIONS.includes(action)) throw new ReviewError('Invalid action', 400);
      const [face, picks, pins] = await Promise.all([store.face(faceId), store.doc(faceId, 'picks'), store.doc(faceId, 'pins')]);
      const doc = await lockedJson(store.docPath(faceId, 'state'), initialDocs.state(faceId), file => {
        if (file.revision !== rev) throw conflict('The block state');
        applyStateAction(file, action, req.body?.stage, actorOf(req), { face, picks, pins }, at);
        file.revision += 1;
        file.updatedAt = at;
        return structuredClone(file);
      });
      res.json({ doc, ledger: await store.refreshLedger(faceId) });
    } catch (e) { fail(res, e); }
  });

  router.post('/faces/:face/activity', async (req, res) => {
    try {
      guard(req);
      await store.face(req.params.face);
      const ledger = await store.refreshLedger(req.params.face, l => { addActivity(l, req.body?.seconds, req.body?.stage); });
      res.json({ ledger });
    } catch (e) { fail(res, e); }
  });

  router.get('/faces/:face/image/:pand/:candidate', async (req, res) => {
    try {
      const target = await store.candidateImage(req.params.face, req.params.pand, req.params.candidate);
      if ('url' in target) { res.redirect(target.url); return; }
      res.set('Cache-Control', 'private, max-age=300').sendFile(target.file);
    } catch (e) { fail(res, e); }
  });

  // --------------------------------------------------------------------------------------------------------- rounds
  const rounds = async () => {
    const config = await readJson<RoundsConfig>(path.join(store.dataRoot, 'rounds.json'), { rounds: [] });
    const list = [...config.rounds.filter(r => !(options.rounds ?? []).some(o => o.id === r.id)), ...(options.rounds ?? [])];
    return list.map(r => ({ ...r, root: path.resolve(repoRoot, r.root) }));
  };
  const round = async (id: string) => {
    if (!ID_PATTERN.test(id)) throw new ReviewError('Invalid round id', 400);
    const r = (await rounds()).find(x => x.id === id);
    if (!r) throw new ReviewError(`No round ${id}`, 404);
    return r;
  };
  const verdictsPath = (id: string) => path.join(store.dataRoot, 'rounds', id, 'verdicts.json');

  router.get('/rounds', async (_req, res) => { try { res.set('Cache-Control', 'no-store').json({ token, rounds: await rounds() }); } catch (e) { fail(res, e); } });
  router.get('/rounds/:round', async (req, res) => {
    try {
      const r = await round(req.params.round);
      const found = await discoverRound(r.root, rel => `/api/belt-review/rounds/${r.id}/file?path=${encodeURIComponent(rel)}`);
      const verdicts = await readJson(verdictsPath(r.id), initialVerdicts(r.id));
      res.set('Cache-Control', 'no-store').json({ token, id: r.id, title: r.title, root: r.root, exists: found.exists, blocks: found.blocks, verdicts });
    } catch (e) { fail(res, e); }
  });
  router.get('/rounds/:round/file', async (req, res) => {
    try {
      const r = await round(req.params.round);
      res.set('Cache-Control', 'no-cache').sendFile(await resolveInside(r.root, String(req.query.path ?? '')));
    } catch (e) { fail(res, e); }
  });
  router.post('/rounds/:round/verdicts/:block', async (req, res) => {
    try {
      guard(req);
      const r = await round(req.params.round), key = req.params.block, rev = expected(req), at = now();
      if (!ENTRY_ID_PATTERN.test(key)) throw new ReviewError('Invalid block key', 400);
      const doc = await lockedJson(verdictsPath(r.id), initialVerdicts(r.id), file => {
        const prior = file.verdicts[key];
        if ((prior?.revision ?? 0) !== rev) throw conflict('This verdict');
        file.verdicts[key] = { ...validateVerdict(req.body?.value), revision: (prior?.revision ?? 0) + 1, at };
        file.revision += 1;
        file.updatedAt = at;
        return structuredClone(file);
      });
      res.json({ doc });
    } catch (e) { fail(res, e); }
  });

  // ------------------------------------------------------------------------------------------------------------ page
  router.get('/page.js', async (_req, res) => {
    try {
      const esbuild = await import('esbuild');
      const out = await esbuild.build({ entryPoints: [path.join(repoRoot, 'src/canalRecall/beltReview/page.ts')], bundle: true, write: false, format: 'iife', target: 'es2021', sourcemap: 'inline', logLevel: 'silent' });
      res.set('Cache-Control', 'no-store').type('application/javascript').send(out.outputFiles[0].text);
    } catch (e) { fail(res, e); }
  });

  return router;
}
