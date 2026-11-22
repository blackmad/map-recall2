/**
 * Belt review render routes (plan R2), mounted by router.ts under /api/belt-review:
 *
 *   Houses: a pand split in stage 1 is several houses `<pand>#n` (houses.ts); each is derived, rendered and cropped alone.
 *
 *   GET /faces/:face/derived            per house: drawn fields (description + edits + links), link chain, notes, what the kit
 *                                       cannot draw (lane C kitGaps.ts), render hash
 *   GET /faces/:face/render/:pand.png   the pand's front at the face's px/m (cached by design hash)
 *   GET /faces/:face/render/:pand.json  its meta: ms, cached, hash, heights, applied / not applied overrides
 *   GET /faces/:face/photo/:house.jpg   the picked photo cropped to the house: David's facade span or split slice, else
 *                                       the BAG span (pandSpanPx), else whole; at the candidate's own px/m
 *   GET /faces/:face/row.json           the row: renders every house, returns the layout and the two strip URLs; houses
 *                                       are registered on the BAG span, so a corrected facade span overhangs its slot
 *   GET /faces/:face/row-render.png     the rendered row, bottoms aligned        (?key= from row.json)
 *   GET /faces/:face/row-photo.png      the picked photos at the same scale     (?key= from row.json)
 *   GET /faces/:face/pano-link/:pand    {url, from: camera|front, lat, lng, heading}: the city panorama viewer at this house
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
import { frontLineArg, type FaceWall } from '../../../src/canalRecall/beltReview/frontLine.ts';
import { houseSlice } from '../../../src/canalRecall/beltReview/sliceFootprint.ts';
import { DESC_FIELDS, type DescField } from '../../../src/canalRecall/beltReview/fields.ts';
import { kitCannotDraw, parseKitGaps, type KitGap } from '../../../src/canalRecall/beltReview/kitGaps.ts';
import { readJson, type BeltReviewStore } from '../../../src/canalRecall/beltReview/store.ts';
import { cropSpanPx } from '../../../src/canalRecall/beltReview/logic.ts';
import { expandDescription, expandFace, type HouseEntry } from '../../../src/canalRecall/beltReview/houses.ts';
import type { PhotoCandidate, Pick as PickEntry } from '../../../src/canalRecall/beltReview/types.ts';
import type { DescFieldValue } from '../../../src/canalRecall/beltReview/description.ts';
import { panoLink } from './pano-link.ts';
import { RenderService, composeRow, designHash, type RowLayout, type RowPiece } from './render-service.ts';

export interface DerivedPand {
  pandId: string;
  fields: Record<string, { value: unknown; source: string; ref?: string; edited?: boolean; via?: string }>;
  chain: string[];
  notes: string[];
  cannotDraw: Array<{ field: string; value?: unknown; drawnAs?: unknown; why: string; gapId?: string }>;
  hash: string;
  /** Fields with a weak source: missing from the description, or an own read under 60 % (stage 2 sorts worst first). */
  weak: string[];
  /** Lane C's photo-against-render likeness when it has judged this house (0–1, higher is closer); null before. */
  likeness: number | null;
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
    const [raw, rawDesc, edits, grouping, picks, cands, walls] = await Promise.all([store.face(faceId), store.description(faceId), store.doc(faceId, 'edits'), store.doc(faceId, 'grouping'), store.doc(faceId, 'picks'), store.candidates(faceId).catch(() => null),
      // The wall each photo was cut on (scripts/belt-review/walls.ts); absent: house preview frames its own wall.
      fs.readFile(path.join(store.dataRoot, faceId, 'walls.json'), 'utf8').then(t => JSON.parse(t).walls as Record<string, FaceWall>, () => null)]);
    const face = expandFace(raw, picks), description = expandDescription(rawDesc, face);
    const ppm = face.pxPerM ?? 50, list = await kitGaps();
    const pands: Record<string, DerivedPand & { design: unknown; house: HouseEntry }> = {};
    for (const p of face.pands) {
      const d = pandDesign(face as never, p.pandId, description, edits, grouping);
      // The render spans the photo's street front (frontLine.ts): the wall it was cut on, at David's edges when moved.
      const pk = (picks as { picks?: Record<string, { candidateId?: string | null; facadeSpanPx?: [number, number] }> }).picks?.[p.basePandId];
      const cand = (cands as { pands?: Array<{ pandId: string; candidates: Array<{ id: string; pandSpanPx?: [number, number]; ppm?: number }> }> } | null)?.pands?.find(x => x.pandId === p.basePandId)?.candidates.find(c => c.id === pk?.candidateId);
      const line = frontLineArg(walls?.[p.basePandId], p.part ? undefined : { facadeSpanPx: pk?.facadeSpanPx, pandSpanPx: cand?.pandSpanPx, ppm: cand?.ppm });
      if (line) (d.design as Record<string, unknown>).wall = line;
      // A split house is drawn on its own part of the footprint (sliceFootprint.ts), cut at its dividers only.
      if (p.part && p.spanM && line) {
        const sibs = face.pands.filter(q => q.basePandId === p.basePandId && q.spanM);
        (d.design as Record<string, unknown>).slice = houseSlice(p.spanM, [Math.min(...sibs.map(q => q.spanM![0])), Math.max(...sibs.map(q => q.spanM![1]))]);
      }
      const asDesc: Partial<Record<DescField, DescFieldValue>> = {};
      for (const f of DESC_FIELDS) if (d.fields[f]) asDesc[f] = { value: d.fields[f]!.value, source: d.fields[f]!.source as never, confidence: 1, ref: d.fields[f]!.ref ?? '' };
      const notes = p.part ? [...d.notes, `Split house ${p.part}: pand ${p.basePandId}'s footprint cut to ${p.spanM![0]}–${p.spanM![1]} m along the photo's wall, drawn with this house's fields.`] : d.notes;
      const desc = description?.pands.find(x => x.pandId === p.pandId) as (NonNullable<typeof description>['pands'][number] & { likeness?: unknown }) | undefined;
      const weak = DESC_FIELDS.filter(f => !['eavesM', 'facadeYear'].includes(f) && !d.fields[f]?.edited && (!desc?.fields?.[f] || (desc.fields[f]!.source === 'own-read' && (desc.fields[f]!.confidence ?? 0) < 0.6)));
      const likeness = typeof desc?.likeness === 'number' ? desc.likeness : null;
      pands[p.pandId] = { pandId: p.pandId, weak, likeness, fields: d.fields as DerivedPand['fields'], chain: d.chain, notes, cannotDraw: kitCannotDraw(p.basePandId, asDesc, list), hash: designHash(p.pandId, d.design, ppm, p.spanM), design: d.design, house: p };
    }
    return { face, ppm, pands };
  }

  router.get('/faces/:face/derived', async (req, res) => {
    try {
      const { pands, ppm } = await derive(req.params.face);
      res.set('Cache-Control', 'no-store').json({ ppm, pands: Object.fromEntries(Object.entries(pands).map(([k, { design: _d, house: _h, ...rest }]) => [k, rest])) });
    } catch (e) { fail(res, e); }
  });

  const renderOne = async (faceId: string, pandId: string) => {
    const { pands, ppm } = await derive(faceId);
    const d = pands[pandId];
    if (!d) throw new ReviewError(`House ${pandId} is not on this face`, 404);
    return service.front(pandId, d.design, ppm, { base: d.house.basePandId, sliceM: d.house.spanM });
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
      res.set('Cache-Control', 'no-store').json({ hash: r.hash, ms: r.ms, cached: r.cached, widthPx: r.widthPx, heightPx: r.heightPx, heights: r.measure.heights, layout: r.measure.layout, props: r.measure.props ?? null, overrides, url: `/api/belt-review/faces/${req.params.face}/render/${req.params.pand}.png?h=${r.hash}` });
    } catch (e) { fail(res, e); }
  });

  /** The house's picked photo: file, the candidate, and the span to show (source pixels, and metres from the BAG span start;
   *  null when the candidate has no BAG span, i.e. the whole image as today). */
  async function housePhoto(faceId: string, house: HouseEntry): Promise<{ file: string; c: PhotoCandidate; w: number; h: number; px: [number, number] | null; m: [number, number] | null } | null> {
    const [picks, candidates] = await Promise.all([store.doc(faceId, 'picks'), store.candidates(faceId)]);
    const pk: PickEntry | undefined = picks.picks[house.basePandId];
    const entry = candidates?.pands.find(p => p.pandId === house.basePandId);
    const id = pk ? pk.candidateId : entry?.autoPick;
    if (!id) return null;
    const c = entry?.candidates.find(k => k.id === id);
    const target = await store.candidateImage(faceId, house.basePandId, id).catch(() => null);
    if (!c || !target || !('file' in target)) return null;
    const meta = await sharp(target.file).metadata();
    const cp = c.pxPerM ?? 50, p0 = c.pandSpanPx?.[0] ?? 0;
    let px = cropSpanPx(c, pk?.candidateId === id ? pk : null);
    if (px && house.spanM) px = [p0 + house.spanM[0] * cp, p0 + house.spanM[1] * cp];
    const m: [number, number] | null = px ? [(px[0] - p0) / cp, (px[1] - p0) / cp] : null;
    return { file: target.file, c, w: meta.width ?? 1, h: meta.height ?? 1, px, m };
  }
  const extractOf = (ph: { w: number }, px: [number, number]) => {
    const left = Math.max(0, Math.min(ph.w - 1, Math.round(px[0])));
    return { left, width: Math.max(1, Math.min(ph.w - left, Math.round(px[1]) - left)) };
  };

  router.get('/faces/:face/photo/:house.jpg', async (req, res) => {
    try {
      const { pands } = await derive(req.params.face), d = pands[req.params.house];
      if (!d) throw new ReviewError(`House ${req.params.house} is not on this face`, 404);
      const ph = await housePhoto(req.params.face, d.house);
      if (!ph) throw new ReviewError('No usable photo picked for this house', 404);
      let img = sharp(ph.file);
      if (ph.px) img = img.extract({ ...extractOf(ph, ph.px), top: 0, height: ph.h });
      res.set({ 'Cache-Control': 'no-store', 'x-crop-m': ph.m ? ph.m.map(v => v.toFixed(2)).join(',') : '' }).type('image/jpeg').send(await img.jpeg({ quality: 90 }).toBuffer());
    } catch (e) { fail(res, e); }
  });

  router.get('/faces/:face/row.json', async (req, res) => {
    try {
      const faceId = req.params.face, { face, ppm, pands } = await derive(faceId);
      const renders: RowPiece[] = [], photos: RowPiece[] = [];
      const t0 = performance.now();
      for (const p of face.pands) {
        const d = pands[p.pandId], house = d.house;
        const r = await service.front(p.pandId, d.design, ppm, { base: house.basePandId, sliceM: house.spanM }).catch(() => null);
        const ph = await housePhoto(faceId, house);
        const rw = r?.widthPx ?? Math.round((p.widthM ?? 6) * ppm), rh = r?.heightPx ?? Math.round(12 * ppm);
        if (!ph?.m || !ph.px) {
          // No BAG span in the photo: as before, the photo fills the render's slot so the rows line up house by house.
          renders.push({ pandId: p.pandId, file: r?.file ?? null, widthPx: rw, heightPx: rh });
          photos.push({ pandId: p.pandId, file: ph?.file ?? null, widthPx: rw, heightPx: ph ? Math.round(ph.h * (rw / ph.w)) : rh });
          continue;
        }
        // Registered on the BAG span: the render starts at its drawn left edge (0 m, or a split slice's clamped start), the
        // photo at its span's start, both at the face's px/m; the slot covers both.
        const slice = r?.measure?.slice as { leftPx: number } | undefined;
        const rStart = house.spanM ? (slice?.leftPx ?? Math.max(0, house.spanM[0] * ppm)) / ppm : 0;
        const k = ppm / (ph.c.pxPerM ?? 50), pw = Math.max(1, Math.round((ph.m[1] - ph.m[0]) * ppm));
        const m0 = Math.min(rStart, ph.m[0]), m1 = Math.max(rStart + rw / ppm, ph.m[1]);
        const slotW = Math.max(1, Math.round((m1 - m0) * ppm));
        renders.push({ pandId: p.pandId, file: r?.file ?? null, widthPx: rw, heightPx: rh, dx: (rStart - m0) * ppm, slotW });
        photos.push({ pandId: p.pandId, file: ph.file, widthPx: pw, heightPx: Math.max(1, Math.round(ph.h * k)), dx: (ph.m[0] - m0) * ppm, slotW, extract: extractOf(ph, ph.px) });
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

  router.get('/faces/:face/pano-link/:pand', async (req, res) => {
    try {
      const faceId = req.params.face, [face, picks, candidates] = await Promise.all([store.face(faceId), store.doc(faceId, 'picks'), store.candidates(faceId)]);
      const pandId = req.params.pand;
      if (!face.pands.some(p => p.pandId === pandId)) throw new ReviewError(`Pand ${pandId} is not on this face`, 404);
      const entry = candidates?.pands.find(p => p.pandId === pandId) as (NonNullable<typeof candidates>['pands'][number] & { wall?: { bearingDeg?: number } }) | undefined;
      const id = picks.picks[pandId]?.candidateId ?? entry?.autoPick;
      const c = id ? entry?.candidates.find(k => k.id === id) : undefined;
      const link = await panoLink(pandId, face.pands.map(p => p.pandId), (c?.pano ?? null) as never, entry?.wall?.bearingDeg);
      if (!link) throw new ReviewError('No camera position on the photo and no footprint for this pand in the building tiles', 404);
      res.set('Cache-Control', 'no-store').json(link);
    } catch (e) { fail(res, e); }
  });

  router.get('/render-stats', (_req, res) => { res.set('Cache-Control', 'no-store').json({ ...service.summary(), recent: service.stats.slice(-20) }); });
  router.get('/kit-catalogue', async (_req, res) => {
    try { res.set('Cache-Control', 'no-cache').json(await readJson(path.join(store.dataRoot, 'kit-catalogue.json'), { enums: {} })); } catch (e) { fail(res, e); }
  });
  /** Each house's current render hash (no rendering): a stage 2 mark on another hash is "changed, recheck". */
  const hashes = async (faceId: string) => Object.fromEntries(Object.entries((await derive(faceId)).pands).map(([k, v]) => [k, v.hash]));
  return { service, hashes };
}
