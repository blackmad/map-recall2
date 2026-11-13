/**
 * Interim front records for the Haarlemmerdijk block (lane 1), until lane 2's `data/front-records/haarlemmerdijk-block.json`
 * lands: per pand on the block's faces, the front top, the crown foot, the crown family and the stated rows, read from
 *   1. the hand spec (scripts/building-recipes/houses/spec-<pand>/intent.json) and the staged belt spec (staged.json):
 *      eavesHeight, storeyHeights, gable, crownRise (a person's or a measured statement);
 *   2. the face's reviewer pins (intent.json continuity.measuredEaves);
 *   3. the strip skyline (skyline.ts): the height most of the front reaches and its highest part;
 *   4. the monuments register gable (monument-gables.json) for the crown family where nothing above states one.
 * Low confidence (no stated or pinned height, a skyline read under half the span) gets `fallback: 'row-line'`.
 *
 *   node --import tsx scripts/house-line/row-front/interim.ts --sources <worktree> --strips <dir> --out <file.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { readSkyline, type SkylineReading } from './skyline.ts';
import type { RowFrontRecord, RowCrownFamily } from '../../../src/canalRecall/houseLine/rowFront.ts';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const sources = arg('sources') ?? '/Users/blackmad/Code/map-recall2-worktrees/integrator-transvaal-20261031';
const strips = arg('strips') ?? '/Users/blackmad/Code/map-recall2-source-data/block-face-strips/haarlemmerbuurt-20261110/strips';
const out = arg('out') ?? 'scripts/house-line/row-front/haarlemmerdijk-interim.json';
const faceRe = new RegExp(arg('faces') ?? '^haarlemmerdijk-\\d+-\\d+$|^haarlemmer-46-96$');

const FAMILY: Record<string, RowCrownFamily> = { cornice: 'cornice', flat: 'cornice', neck: 'neck', 'raised-neck': 'neck', raisedNeck: 'neck', bell: 'bell', 'bell-low': 'bell', clock: 'bell', point: 'point', plain: 'point', step: 'step', spout: 'spout' };
const readJson = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const register = (readJson('public/data/extracts/amsterdam/monument-gables.json')?.buildings ?? {}) as Record<string, string>;

type Front = { storeys?: number; storeyHeights?: number[]; eavesHeight?: number; gable?: string; crownRise?: number; atticWindows?: number; dormers?: unknown; hoist?: boolean };
function statedFront(pand: string): { front: Front; src: string } | null {
  const hand = readJson(path.join(sources, 'scripts/building-recipes/houses', `spec-${pand}`, 'intent.json'));
  if (hand?.fronts?.[0]) return { front: hand.fronts[0], src: `hand spec spec-${pand}` };
  const staged = readJson(path.join(sources, 'artifacts/house-specs/published/belt-20261113', pand, 'staged.json'));
  if (staged?.spec?.design?.fronts?.[0]) return { front: staged.spec.design.fronts[0], src: `staged belt-20261113 ${pand}` };
  return null;
}

const records: RowFrontRecord[] = [];
const faces = fs.readdirSync('scripts/block-face/faces').filter(f => faceRe.test(f)).sort();
for (const face of faces) {
  const strip = readJson(`scripts/block-face/faces/${face}/strip.json`);
  const jpg = path.join(strips, `${face}-strip.jpg`);
  if (!strip || !fs.existsSync(jpg)) { console.error(`${face}: no strip`); continue; }
  const pins = new Map<string, number>();
  for (const f of fs.readdirSync('scripts/block-face/faces').filter(f => f === face || f.startsWith(`${face}-r`))) {
    for (const p of readJson(`scripts/block-face/faces/${f}/intent.json`)?.continuity?.measuredEaves ?? []) pins.set(String(p.pand).slice(-16), +((strip.height - p.stripRow) / strip.pixelsPerMetre).toFixed(2));
  }
  const intentCrown = new Map<string, string>();
  for (const f of fs.readdirSync('scripts/block-face/faces').filter(f => f === face || f.startsWith(`${face}-r`))) {
    for (const h of readJson(`scripts/block-face/faces/${f}/intent.json`)?.houses ?? []) if (h.type?.crown) intentCrown.set(String(h.pandId).slice(-16), h.type.crown);
  }
  const { data, info } = await sharp(jpg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sky = new Map<string, SkylineReading>(readSkyline(data, info.width, info.height, strip.pixelsPerMetre, strip.spans).map(r => [String(r.pandId).slice(-16), r]));
  for (const span of strip.spans) {
    const pand = String(span.pandId).slice(-16);
    if (records.some(r => r.pandId === pand)) continue;
    const s = sky.get(pand)!, stated = statedFront(pand), f = stated?.front;
    const reg = register[`NL.IMBAG.Pand.${pand}`];
    const srcs: Record<string, string> = {};
    // Crown family: a person's or a photo reading first, then the face's crown, then the register; the skyline vetoes a
    // gable where the front stands flat against the sky across almost all its width (165073: register neck, photo cornice).
    const flatSky = !!s.frontTopM && s.readShare > 0.6 && s.crownShare < 0.2;
    let family: RowCrownFamily | null = null;
    if (f?.gable && FAMILY[f.gable]) { family = FAMILY[f.gable]; srcs.crown = `${stated!.src} gable ${f.gable}`; }
    else if (intentCrown.get(pand) && FAMILY[String(intentCrown.get(pand)).split('-')[0]]) { family = FAMILY[String(intentCrown.get(pand)).split('-')[0]]; srcs.crown = `face ${face} crown ${intentCrown.get(pand)}`; }
    else if (reg && FAMILY[reg] && !(flatSky && FAMILY[reg] !== 'cornice')) { family = FAMILY[reg]; srcs.crown = `register ${reg}`; }
    else if (flatSky) { family = 'cornice'; srcs.crown = `skyline flat (crown share ${s.crownShare})`; }
    if (family && family !== 'cornice' && flatSky && !(f?.gable && FAMILY[f.gable] === family && /hand spec/.test(stated!.src))) { srcs.crownVeto = `${srcs.crown} vetoed: skyline flat across ${Math.round((1 - s.crownShare) * 100)} % of the front`; family = 'cornice'; srcs.crown = 'skyline flat'; }
    // Heights: the gable foot / cornice top (eavesM) and the front's highest line (topM).
    const statedTop = f?.eavesHeight ?? pins.get(pand) ?? null;
    let eavesM: number | null = statedTop, topM: number | null = null, confidence = 0;
    if (statedTop !== null) { srcs.eaves = f?.eavesHeight !== undefined ? `${stated!.src} eavesHeight` : `face pin`; confidence = 0.85; }
    const gabled = family !== null && family !== 'cornice';
    if (eavesM === null && s.frontTopM !== null && s.readShare > 0.6) {
      // On a gabled front the wide-share line sits on the shoulders; the foot is lower, so take the skyline as a cap only.
      eavesM = gabled ? s.footM : s.frontTopM; if (eavesM !== null) { srcs.eaves = `skyline ${gabled ? 'foot' : 'front top'} (${Math.round(s.readShare * 100)} % read)`; confidence = 0.6; }
    }
    if (gabled) {
      const rise = f?.crownRise ?? (s.peakM !== null && eavesM !== null ? Math.max(0.8, s.peakM - eavesM) : null);
      topM = eavesM !== null && rise !== null ? +(eavesM + rise).toFixed(2) : s.peakM;
      if (f?.crownRise !== undefined) srcs.rise = `${stated!.src} crownRise`; else if (topM !== null) srcs.rise = 'skyline peak';
    } else topM = eavesM;
    const rec: RowFrontRecord = { pandId: pand, face, topM, eavesM, crown: { family: family ?? 'cornice', ...(gabled && topM !== null && eavesM !== null ? { riseM: +(topM - eavesM).toFixed(2) } : {}) },
      ...(f?.storeyHeights ? { rowLines: f.storeyHeights.reduce<number[]>((a, h) => [...a, +((a[a.length - 1] ?? 0) + h).toFixed(2)], []) } : {}),
      ...(f?.storeys ? { storeys: f.storeys } : {}), confidence: family ? confidence : Math.min(confidence, 0.4),
      skyline: { frontTopM: s.frontTopM, footM: s.footM, peakM: s.peakM, crownShare: s.crownShare, readShare: s.readShare }, sources: srcs };
    if (rec.eavesM === null || rec.confidence < 0.5) rec.fallback = 'row-line';
    records.push(rec);
  }
}
// The row line: a record without a usable height takes the median top of its measured neighbours on the same face (±2).
for (const [i, r] of records.entries()) {
  if (r.eavesM !== null) continue;
  const near = records.filter((q, j) => q.face === r.face && Math.abs(j - i) <= 2 && q.eavesM !== null && !q.fallback).map(q => q.eavesM!).sort((a, b) => a - b);
  if (!near.length) continue;
  r.eavesM = near[Math.floor(near.length / 2)];
  r.sources.eaves = `row line (median of ${near.length} measured neighbours)`;
  if (r.crown.family !== 'cornice') r.topM = +(r.eavesM + (r.crown.riseM ?? 1.5)).toFixed(2); else r.topM = r.eavesM;
}
fs.writeFileSync(out, JSON.stringify({ version: 1, kind: 'row-front-interim', note: 'lane 1 interim front records; replaced by lane 2 data/front-records/haarlemmerdijk-block.json', records }, null, 1));
const fam = records.reduce<Record<string, number>>((a, r) => ({ ...a, [r.crown.family]: (a[r.crown.family] ?? 0) + 1 }), {});
console.log(`${records.length} records on ${faces.length} faces; stated height ${records.filter(r => r.confidence >= 0.85).length}, skyline ${records.filter(r => /skyline/.test(r.sources.eaves ?? '')).length}, row line ${records.filter(r => /row line/.test(r.sources.eaves ?? '')).length}, none ${records.filter(r => r.eavesM === null).length}; crowns ${JSON.stringify(fam)}`);
