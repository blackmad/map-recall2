/**
 * Belt review render routes (plan R2), mounted by router.ts under /api/belt-review:
 *
 *   GET /faces/:face/derived            per pand: drawn fields (description + edits + links), link chain, notes, what the kit
 *                                       cannot draw (lane C kitGaps.ts), render hash
 *   GET /faces/:face/render/:pand.png   the pand's front at the face's px/m (cached by design hash)
 *   GET /faces/:face/render/:pand.json  its meta: ms, cached, hash, heights, applied / not applied overrides
 *   GET /faces/:face/row.json           the row: renders every pand, returns the layout and the two strip URLs
 *   GET /faces/:face/row-render.png     the rendered row, bottoms aligned        (?key= from row.json)
 *   GET /faces/:face/row-photo.png      the picked photos at the same scale     (?key= from row.json)
 *   GET /render-stats                   cold / warm render latency
 *   GET /kit-catalogue                  review-data/belt-review/kit-catalogue.json (lane C, R5)
 */
import type { Request, Response, Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ReviewError } from '../../../src/canalRecall/beltReview/logic.ts';
import { pandDesign } from '../../../src/canalRecall/beltReview/design.ts';
import { DESC_FIELDS, type DescField } from '../../../src/canalRecall/beltReview/fields.ts';
import { kitCannotDraw, parseKitGaps, type KitGap } from '../../../src/canalRecall/beltReview/kitGaps.ts';
import { readJson, type BeltReviewStore } from '../../../src/canalRecall/beltReview/store.ts';
import type { DescFieldValue } from '../../../src/canalRecall/beltReview/description.ts';
import { RenderService, composeRow, designHash, type RowLayout, type RowPiece } from './render-service.ts';

export interface DerivedPand {
  pandId: string;
  fields: Record<string, { value: unknown; source: string; ref?: string; edited?: boolean; via?: string }>;
  chain: string[];
  notes: string[];
  cannotDraw: Array<{ field: string; value?: unknown; drawnAs?: unknown; why: string; gapId?: string }>;
  hash: string;
}

export function mountRenderRoutes(router: Router, store: BeltReviewStore, fail: (res: Response, e: unknown) => void, opts: { repoRoot: string; cacheDir?: string; service?: RenderService }) {
  const service = opts.service ?? new RenderService(opts.cacheDir ?? path.join(opts.repoRoot, '.cache/belt-review/renders'), opts.repoRoot);
  const rows = new Map<string, Buffer>();
  let gaps: { at: number; list: KitGap[] } | null = null;
  const kitGaps = async () => {
    const file = path.join(store.dataRoot, 'kit-gaps.json');
    const st = await fs.stat(file).catch(() => null);
    if (!st) return [];
    if (!gaps || gaps.at !== st.mtimeMs) gaps = { at: st.mtimeMs, list: parseKitGaps(JSON.parse(await fs.readFile(file, 'utf8'))).gaps };
    return gaps.list;
  };

  async function derive(faceId: string) {
    const [face, description, edits, grouping] = await Promise.all([store.face(faceId), store.description(faceId), store.doc(faceId, 'edits'), store.doc(faceId, 'grouping')]);
    const ppm = face.pxPerM ?? 50, list = await kitGaps();
    const pands: Record<string, DerivedPand & { design: unknown }> = {};
    for (const p of face.pands) {
      const d = pandDesign(face, p.pandId, description, edits, grouping);
      const asDesc: Partial<Record<DescField, DescFieldValue>> = {};
      for (const f of DESC_FIELDS) if (d.fields[f]) asDesc[f] = { value: d.fields[f]!.value, source: d.fields[f]!.source as never, confidence: 1, ref: d.fields[f]!.ref ?? '' };
      pands[p.pandId] = { pandId: p.pandId, fields: d.fields as DerivedPand['fields'], chain: d.chain, notes: d.notes, cannotDraw: kitCannotDraw(p.pandId, asDesc, list), hash: designHash(p.pandId, d.design, ppm), design: d.design };
    }
    return { face, ppm, pands };
  }

  router.get('/faces/:face/derived', async (req, res) => {
    try {
      const { pands, ppm } = await derive(req.params.face);
      res.set('Cache-Control', 'no-store').json({ ppm, pands: Object.fromEntries(Object.entries(pands).map(([k, { design: _d, ...rest }]) => [k, rest])) });
    } catch (e) { fail(res, e); }
  });

  const renderOne = async (faceId: string, pandId: string) => {
    const { pands, ppm } = await derive(faceId);
    const d = pands[pandId];
    if (!d) throw new ReviewError(`Pand ${pandId} is not on this face`, 404);
    return service.front(pandId, d.design, ppm);
  };
  router.get('/faces/:face/render/:pand.png', async (req, res) => {
    try {
      const r = await renderOne(req.params.face, req.params.pand);
      res.set({ 'Cache-Control': 'private, max-age=60', 'x-render-ms': String(r.ms), 'x-render-cached': String(r.cached), 'x-render-hash': r.hash }).sendFile(r.file);
    } catch (e) { fail(res, e); }
  });
  router.get('/faces/:face/render/:pand.json', async (req, res) => {
    try {
      const r = await renderOne(req.params.face, req.params.pand);
      // A field the game's decorator holds (SPEC_DESIGN_HELD) is not drawn in the game either: list it as not applied.
      const ov = r.measure.overrides as { applied: string[]; notApplied: string[] } | null;
      const overrides = ov ? { applied: ov.applied.filter(a => !a.includes('(held')), notApplied: [...ov.notApplied, ...ov.applied.filter(a => a.includes('(held')).map(a => a.replace(/ -> .*?(\(held.*)$/, ' $1'))] } : null;
      res.set('Cache-Control', 'no-store').json({ hash: r.hash, ms: r.ms, cached: r.cached, widthPx: r.widthPx, heightPx: r.heightPx, heights: r.measure.heights, layout: r.measure.layout, overrides, url: `/api/belt-review/faces/${req.params.face}/render/${req.params.pand}.png?h=${r.hash}` });
    } catch (e) { fail(res, e); }
  });

  /** The picked photo's file and its size at `ppm` (null when none usable or unpicked). */
  async function photoPiece(faceId: string, pandId: string, ppm: number): Promise<{ file: string; w: number; h: number } | null> {
    const [picks, candidates] = await Promise.all([store.doc(faceId, 'picks'), store.candidates(faceId)]);
    const id = picks.picks[pandId]?.candidateId ?? candidates?.pands.find(p => p.pandId === pandId)?.autoPick;
    if (!id) return null;
    const c = candidates?.pands.find(p => p.pandId === pandId)?.candidates.find(k => k.id === id);
    const target = await store.candidateImage(faceId, pandId, id).catch(() => null);
    if (!c || !target || !('file' in target)) return null;
    const meta = await sharp(target.file).metadata();
    const k = ppm / (c.pxPerM ?? 50);
    return { file: target.file, w: Math.max(1, Math.round((meta.width ?? 1) * k)), h: Math.max(1, Math.round((meta.height ?? 1) * k)) };
  }

  router.get('/faces/:face/row.json', async (req, res) => {
    try {
      const faceId = req.params.face, { face, ppm, pands } = await derive(faceId);
      const renders: RowPiece[] = [], photos: RowPiece[] = [];
      const t0 = performance.now();
      for (const p of face.pands) {
        const r = await service.front(p.pandId, pands[p.pandId].design, ppm).catch(() => null);
        const ph = await photoPiece(faceId, p.pandId, ppm);
        const w = r?.widthPx ?? ph?.w ?? Math.round((p.widthM ?? 6) * ppm);
        renders.push({ pandId: p.pandId, file: r?.file ?? null, widthPx: w, heightPx: r?.heightPx ?? Math.round(12 * ppm) });
        // The photo takes the render's slot width so the two rows line up house by house.
        photos.push({ pandId: p.pandId, file: ph?.file ?? null, widthPx: w, heightPx: ph ? Math.round(ph.h * (w / ph.w)) : Math.round(12 * ppm) });
      }
      const key = createHash('sha256').update(JSON.stringify([renders, photos])).digest('hex').slice(0, 20);
      let layout: RowLayout;
      if (!rows.has(`r:${key}`)) {
        const a = await composeRow(renders), b = await composeRow(photos, { r: 42, g: 45, b: 49 });
        rows.set(`r:${key}`, a.png); rows.set(`p:${key}`, b.png); rows.set(`l:${key}`, Buffer.from(JSON.stringify(a.layout)));
        if (rows.size > 60) rows.delete(rows.keys().next().value!);
      }
      layout = JSON.parse(rows.get(`l:${key}`)!.toString());
      res.set('Cache-Control', 'no-store').json({ key, ppm, ms: Math.round(performance.now() - t0), layout, render: `/api/belt-review/faces/${faceId}/row-render.png?key=${key}`, photo: `/api/belt-review/faces/${faceId}/row-photo.png?key=${key}` });
    } catch (e) { fail(res, e); }
  });
  const rowImage = (prefix: string) => (req: Request, res: Response) => {
    const png = rows.get(`${prefix}:${String(req.query.key ?? '')}`);
    if (!png) { res.status(404).json({ error: 'Row expired; reload row.json' }); return; }
    res.set('Cache-Control', 'private, max-age=600').type('image/png').send(png);
  };
  router.get('/faces/:face/row-render.png', rowImage('r'));
  router.get('/faces/:face/row-photo.png', rowImage('p'));

  router.get('/render-stats', (_req, res) => { res.set('Cache-Control', 'no-store').json({ ...service.summary(), recent: service.stats.slice(-20) }); });
  router.get('/kit-catalogue', async (_req, res) => {
    try { res.set('Cache-Control', 'no-cache').json(await readJson(path.join(store.dataRoot, 'kit-catalogue.json'), { enums: {} })); } catch (e) { fail(res, e); }
  });
  return service;
}
