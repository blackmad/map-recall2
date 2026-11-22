/**
 * belt-review:describe (lane C, the library; plan "The loop" check 2 and check 3): the first description of every pand of a
 * block face, assembled from what the repo already holds, with a source and a confidence per field, the grouping hints, the
 * fields the kit cannot draw, and the ledger's library / new-read counts. Node only; reads, never fetches.
 *
 *   node --import tsx scripts/belt-review/describe.ts <faceId> [--face <face.json>] [--out <description.json>]
 *        [--d1 <describer-d1 belt root>] [--ordekaart <dir>] [--check]
 *
 * Input: review-data/belt-review/<faceId>/face.json ({faceId, street, side, pands: [{pandId, address, order}]}, lane B).
 * Output: review-data/belt-review/<faceId>/description.json (FaceDescriptionFile below).
 *
 * Sources per pand (src/canalRecall/beltReview/description.ts ranks them):
 *   - HouseSpecs: the published extract (house-specs/14 tiles), hand-written specs (scripts/house-specs/specs), staged
 *     specs (artifacts/house-specs/staging), generated specs (scripts/house-specs/generated/*), and block-face intents
 *     (houseSpec/adapters.ts fromBlockFace): resolved together (resolveSpecs) and with `basedOn` applied (R4);
 *   - block-face intents: the house's `sameAs` / `type` (grouping);
 *   - the D1 belt reads (answers named in answers-kept; outline-off answers-held are not used): own read;
 *   - the belt photo readers (data/buurt-generators/belt/photo-reads.json): own read;
 *   - the belt look's records (data/buurt-generators/belt/row-front.json): donor (or own read when the look used it);
 *   - monument-facts.json: register; AHN front bands (data/buurt-generators/belt/ahn-fronts.json) and 3DBAG eaves
 *     (bag-tiles): survey;
 *   - the ordekaart Centrum layer (designUnits/join.ts pandOverlaps over BAG footprints): the design unit;
 *   - review-data/belt-review/kit-gaps.json (R6): open gaps per pand;
 *   - review-data/belt-review/<faceId>/photo-read.json (read-house.ts): the per-house read of David's picked crop, source
 *     `photo-read` (above own-read, below reviewed and face-intent; David's edits.json stays on top of everything).
 */
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { validateBlockFace, type BlockFaceIntent } from '../../src/canalRecall/blockFace/intent.ts';
import { fromBlockFace } from '../../src/canalRecall/houseSpec/adapters.ts';
import { applyBasedOn, resolveSpecs } from '../../src/canalRecall/houseSpec/resolve.ts';
import { emptySpec, validateSpec, type HouseSpec, type Prov } from '../../src/canalRecall/houseSpec/spec.ts';
import { ASSIGN_SHARE, pandOverlaps, parseOrdekaart } from '../../src/canalRecall/designUnits/join.ts';
import type { UnitPand } from '../../src/canalRecall/designUnits/types.ts';
import { WORLD_TWINS } from '../house-specs/rows/belt-rows.ts';
import {
  candidatesFromBeltLook, candidatesFromPhotoRead, candidatesFromRead, candidatesFromRegister, candidatesFromSpec, candidatesFromSurvey,
  countFields, pickFields, DESC_FIELDS, DESC_SOURCES, LIBRARY_SOURCES, type DescCounts, type DescField, type DescFieldValue, type FieldCandidate,
} from '../../src/canalRecall/beltReview/description.ts';
import { kitCannotDraw, parseKitGaps, type CannotDraw, type KitGap } from '../../src/canalRecall/beltReview/kitGaps.ts';
import { candidatesFromHouseRead, readExtras, type HouseRead } from '../../src/canalRecall/beltReview/houseRead.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const EXTRACT = path.join(REPO, 'public/data/extracts/amsterdam');
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const faceId = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!faceId) { console.error('usage: describe.ts <faceId> [--face <face.json>] [--out <file>] [--d1 <dir>] [--ordekaart <dir>] [--check]'); process.exit(2); }
const rel = (f: string) => (path.relative(REPO, f).startsWith('..') ? f : path.relative(REPO, f));
const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const jsonIf = (f: string) => (fs.existsSync(f) ? json(f) : null);

// --- the face ---------------------------------------------------------------------------------------------------------
interface FacePand { pandId: string; address: string; order: number }
interface FaceFile { faceId: string; street: string; side: string; pands: FacePand[] }
const faceFile = path.resolve(opt('face') ?? path.join(REPO, 'review-data/belt-review', faceId, 'face.json'));
const face = json(faceFile) as FaceFile;
if (face.faceId !== faceId) throw Error(`${rel(faceFile)} is face ${face.faceId}, not ${faceId}`);
const pands = [...face.pands].sort((a, b) => a.order - b.order);
const ids = new Set(pands.map(p => p.pandId));
const inputs: Record<string, string> = { face: rel(faceFile) };

// --- HouseSpecs -------------------------------------------------------------------------------------------------------
const SPEC_TILES = path.join(EXTRACT, 'house-specs/14');
const tileRecords = new Map<string, { d: Record<string, unknown>; x?: Record<string, unknown>; s: Record<string, string>; l?: Array<{ component: string; what: string }>; r: string }>();
for (const x of fs.readdirSync(SPEC_TILES)) for (const y of fs.readdirSync(path.join(SPEC_TILES, x))) {
  const t = JSON.parse(gunzipSync(fs.readFileSync(path.join(SPEC_TILES, x, y))).toString('utf8'));
  for (const [k, v] of Object.entries<any>(t.buildings ?? {})) tileRecords.set(k.slice(-16), v);
}
inputs.publishedSpecs = rel(SPEC_TILES);
/** Confidence the extract's compact record no longer carries: the ladder's typical value per source. */
const TILE_CONF: Record<string, number> = { reviewed: 0.9, author: 0.9, 'streetlevel-measured': 0.85, 'monument-text': 0.8, 'vision-judge': 0.6, 'based-on': 0.7, default: 0.3 };
function specFromTile(pandId: string): HouseSpec | null {
  const r = tileRecords.get(pandId);
  if (!r) return null;
  const s = emptySpec(pandId);
  s.design = structuredClone(r.d) as HouseSpec['design'];
  if (r.x && Object.keys(r.x).length) s.facts = structuredClone(r.x) as HouseSpec['facts'];
  for (const [p, src] of Object.entries(r.s)) s.provenance[p] = { source: src as Prov['source'], confidence: TILE_CONF[src] ?? 0.5, ref: 'house-specs extract', at: null };
  if (r.l?.length) s.schemaLimits = structuredClone(r.l);
  return s;
}
const HAND = path.join(REPO, 'scripts/house-specs/specs'), STAGED = path.join(REPO, 'artifacts/house-specs/staging'), GENERATED = path.join(REPO, 'scripts/house-specs/generated');
const generatedDirs = fs.existsSync(GENERATED) ? fs.readdirSync(GENERATED).map(b => path.join(GENERATED, b)) : [];

// Block-face intents: the spec part, and the house's sameAs / type.
const faceHouse = new Map<string, { face: BlockFaceIntent; sameAs?: string; type?: string }>();
const FACES = path.join(REPO, 'scripts/block-face/faces');
for (const dir of fs.readdirSync(FACES).sort()) {
  const f = path.join(FACES, dir, 'intent.json');
  if (!fs.existsSync(f)) continue;
  const raw = json(f) as BlockFaceIntent;
  if (!raw.houses?.some(h => ids.has(h.pandId))) continue;
  let fv: BlockFaceIntent;
  try { fv = validateBlockFace(raw); } catch { continue; }
  for (const h of fv.houses) if (ids.has(h.pandId)) faceHouse.set(h.pandId, { face: fv, ...(h.sameAs ? { sameAs: h.sameAs } : {}), ...(h.type ? { type: h.type.type } : {}) });
}

const partsCache = new Map<string, HouseSpec | null>();
const partRefs = new Map<string, string[]>();
/** A pand's spec as resolved from its own parts (no basedOn applied); null when no part states anything. */
function ownSpec(pandId: string): HouseSpec | null {
  if (partsCache.has(pandId)) return partsCache.get(pandId)!;
  const parts: HouseSpec[] = [], refs: string[] = [];
  const tile = specFromTile(pandId);
  if (tile) { parts.push(tile); refs.push('published'); }
  const hand = path.join(HAND, `${pandId}.json`);
  if (fs.existsSync(hand)) { parts.push(validateSpec(json(hand))); refs.push(rel(hand)); }
  const staged = path.join(STAGED, `${pandId}.json`);
  if (fs.existsSync(staged)) { parts.push(validateSpec(json(staged).spec)); refs.push(rel(staged)); }
  for (const d of generatedDirs) { const g = path.join(d, `${pandId}.json`); if (fs.existsSync(g) && json(g).spec) { parts.push(validateSpec(json(g).spec)); refs.push(rel(g)); } }
  const fh = faceHouse.get(pandId);
  if (fh) { const s = fromBlockFace(fh.face, pandId); if (s) { parts.push(s); refs.push(`scripts/block-face/faces/${fh.face.id}/intent.json`); } }
  const out = parts.length ? resolveSpecs(parts) : null;
  partsCache.set(pandId, out); partRefs.set(pandId, refs);
  return out;
}

// --- reads ------------------------------------------------------------------------------------------------------------
const d1Candidates = [opt('d1'), process.env.BELT_D1_ROOT,
  (() => { try { return path.join(json(path.join(REPO, 'scripts/house-specs/rows/rows.json')).d1Root, 'belt-20261114'); } catch { return undefined; } })(),
  path.resolve(REPO, '../_pruned-sheets/d1-belt-20261114/belt-20261114')].filter((x): x is string => !!x);
const d1Root = d1Candidates.find(d => fs.existsSync(path.join(d, 'answers')));
const kept = new Set(d1Root && fs.existsSync(path.join(d1Root, 'answers-kept')) ? fs.readdirSync(path.join(d1Root, 'answers-kept')).map(f => f.replace(/\.json$/, '')) : []);
const held = new Set(d1Root && fs.existsSync(path.join(d1Root, 'answers-held')) ? fs.readdirSync(path.join(d1Root, 'answers-held')).map(f => f.replace(/\.json$/, '')) : []);
inputs.d1 = d1Root ? `${d1Root} (answers named in answers-kept; answers-held not used)` : 'none found (pass --d1 <belt-20261114 dir>)';
/** The D1 pand of a world pand: belt-rows WORLD_TWINS files the evidence of a twin under the pand the world drops. */
const d1PandOf = new Map(Object.entries(WORLD_TWINS).map(([d1, world]) => [world, d1]));
function d1Answer(pandId: string): any | null {
  const id = d1PandOf.get(pandId) ?? pandId;
  if (!d1Root || held.has(id) || (kept.size && !kept.has(id))) return null;
  for (const sub of ['answers-kept', 'answers']) { const f = path.join(d1Root, sub, `${id}.json`); try { return json(f); } catch { /* a dangling kept link: the answers dir holds the file */ } }
  return null;
}
/** The house rows' members (rows.json): the cut's wall height over the street, a measured stand-in for the eaves. */
const rowMember = new Map<string, { row: string; heightM?: number; widthSource?: string }>();
for (const [row, def] of Object.entries<any>(jsonIf(path.join(REPO, 'scripts/house-specs/rows/rows.json'))?.rows ?? {})) for (const m of def.members ?? []) if (!rowMember.has(m.pandId)) rowMember.set(m.pandId, { row, heightM: m.heightM, widthSource: m.widthSource });
const BELT = path.join(REPO, 'data/buurt-generators/belt');
const photoReads = (jsonIf(path.join(BELT, 'photo-reads.json'))?.reads ?? {}) as Record<string, any>;
const beltLook = new Map<string, any>(((jsonIf(path.join(BELT, 'row-front.json'))?.records ?? []) as any[]).map(r => [String(r.pandId).slice(-16), r]));
const ahn = (jsonIf(path.join(BELT, 'ahn-fronts.json'))?.fronts ?? {}) as Record<string, { n: number; p90: number }>;
const monuments = new Map<string, any>(Object.entries<any>(json(path.join(EXTRACT, 'monument-facts.json')).buildings ?? {}).map(([k, v]) => [k.slice(-16), v]));
const reviewedRows = (jsonIf(path.join(REPO, 'scripts/house-specs/rows/reviewed.json')) ?? {}) as Record<string, Array<{ fronts: string[]; field: string; value: unknown; ref: string }>>;
Object.assign(inputs, { photoReads: rel(path.join(BELT, 'photo-reads.json')), beltLook: rel(path.join(BELT, 'row-front.json')), ahn: rel(path.join(BELT, 'ahn-fronts.json')), register: rel(path.join(EXTRACT, 'monument-facts.json')) });

// BAG footprints, years and 3DBAG eaves (bag tiles), for the design unit and the survey eaves.
const bag = new Map<string, UnitPand>();
const BAG_TILES = path.join(EXTRACT, 'bag-tiles/14');
for (const x of fs.readdirSync(BAG_TILES).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(BAG_TILES, x)).filter(n => n.endsWith('.geojson.gz'))) {
  const fc = JSON.parse(gunzipSync(fs.readFileSync(path.join(BAG_TILES, x, f))).toString('utf8'));
  for (const ft of fc.features ?? []) {
    const id = String(ft.properties?.id ?? '').slice(-16);
    if (!ids.has(id) || bag.has(id) || !ft.geometry) continue;
    const ring = ft.geometry.type === 'Polygon' ? ft.geometry.coordinates[0] : ft.geometry.coordinates[0][0];
    bag.set(id, { id, ring, year: ft.properties.year ?? null, eavesM: ft.properties.eaves ?? null, heightM: ft.properties.height ?? null });
  }
}

// The ordekaart Centrum layer.
const orDirs = [opt('ordekaart'), path.join(REPO, '.cache/ordekaart-20261119'), path.resolve(REPO, '../../map-recall2/.cache/ordekaart-20261119'), path.resolve(REPO, '../source-archive/datasets/ordekaart-20261119')].filter((x): x is string => !!x);
const orFile = orDirs.map(d => path.join(d, 'ORDE_CENTRUM_GEBOUWEN.geojson')).find(f => fs.existsSync(f));
const unitOf = new Map<string, { key: string; share: number; orde: string; architect: string | null; year: number | null }>();
if (orFile) {
  const objects = parseOrdekaart('centrum', json(orFile));
  const byKey = new Map(objects.map(o => [o.key, o]));
  for (const [id, ov] of pandOverlaps([...bag.values()], objects)) {
    const top = ov.hits[0];
    if (top && top.share >= ASSIGN_SHARE) { const o = byKey.get(top.key)!; unitOf.set(id, { key: top.key, share: top.share, orde: o.orde, architect: o.architect, year: o.year }); }
  }
  inputs.ordekaart = `${orFile} (centrum layer; a pand joins the object holding >= ${ASSIGN_SHARE} of its footprint)`;
} else inputs.ordekaart = 'not found (pass --ordekaart <dir with ORDE_CENTRUM_GEBOUWEN.geojson>)';

// Kit gaps (R6).
const GAPS = path.join(REPO, 'review-data/belt-review/kit-gaps.json');
const gaps: KitGap[] = fs.existsSync(GAPS) ? parseKitGaps(json(GAPS)).gaps : [];
inputs.kitGaps = fs.existsSync(GAPS) ? rel(GAPS) : 'none';

// Per-house photo reads (read-house.ts).
const READS_FILE = path.join(path.dirname(faceFile), 'photo-read.json');
const houseReads = (jsonIf(READS_FILE)?.reads ?? {}) as Record<string, { answer: Partial<HouseRead>; candidateId: string; model: string; at: string }>;
inputs.photoRead = fs.existsSync(READS_FILE) ? `${rel(READS_FILE)} (${Object.keys(houseReads).length} houses)` : 'none';

// --- describe ---------------------------------------------------------------------------------------------------------
interface PandDescription {
  pandId: string; address: string; order: number;
  fields: Partial<Record<DescField, DescFieldValue>>;
  /** Fields no source in the library states: a new read is needed. */
  missing: DescField[];
  group: {
    unit: { id: string; source: 'ordekaart' | 'single'; share?: number; orde?: string; architect?: string | null; year?: number | null; faceMembers: string[] };
    sameAs?: string; type?: string; basedOn?: { pandId: string; ref?: string };
    /** The D1 read's own "same design as the neighbour" call, mapped to the face order. */
    readSameAs?: { side: string; pandIds: string[] };
  };
  kitCannotDraw: CannotDraw[];
  /** The photo read's statements beyond the fields (roof material, wall hex, white heads, ornaments, what the kit cannot say). */
  photoRead?: ReturnType<typeof readExtras> & { candidateId: string };
  /** What the spec parts were (published, hand, staged, generated, face intent). */
  specParts: string[];
  counts: DescCounts;
}

const out: PandDescription[] = [];
for (const p of pands) {
  const cands: FieldCandidate[] = [];
  const own = ownSpec(p.pandId);
  let spec = own;
  if (own?.basedOn) spec = applyBasedOn(own, id => ownSpec(id) ?? undefined);
  if (spec) cands.push(...candidatesFromSpec(spec, 'house-spec'));
  for (const r of Object.values(reviewedRows)) if (Array.isArray(r)) for (const e of r) if (e.fronts?.some(f => f.slice(0, 16) === p.pandId)) {
    const field = ({ heads: 'heads', bays: 'bays', windows: 'windows', 'ground.use': 'ground', storeys: 'storeys' } as Record<string, DescField>)[e.field];
    if (field) cands.push({ field, value: e.value, source: 'reviewed', confidence: 0.95, ref: `scripts/house-specs/rows/reviewed.json: ${e.ref}` });
  }
  const a = d1Answer(p.pandId);
  if (a) cands.push(...candidatesFromRead(a, `D1 ${a.reader ?? 'read'} ${a.image?.ref ?? ''}`.trim()));
  if (photoReads[p.pandId]) cands.push(...candidatesFromPhotoRead(photoReads[p.pandId], `belt photo-reads (${photoReads[p.pandId].reader ?? 'reader'})`));
  if (monuments.has(p.pandId)) cands.push(...candidatesFromRegister(monuments.get(p.pandId)));
  cands.push(...candidatesFromSurvey(ahn[p.pandId], bag.get(p.pandId)?.eavesM, 'AHN front band'));
  const rm = rowMember.get(d1PandOf.get(p.pandId) ?? p.pandId) ?? rowMember.get(p.pandId);
  if (rm && Number.isFinite(rm.heightM) && /cut/.test(rm.widthSource ?? '')) cands.push({ field: 'eavesM', value: rm.heightM, source: 'survey', confidence: 0.65, ref: `scripts/house-specs/rows/rows.json ${rm.row}: the cut's wall height` });
  if (beltLook.has(p.pandId)) cands.push(...candidatesFromBeltLook(beltLook.get(p.pandId)));
  const hr = houseReads[p.pandId];
  // A style-dated year from the photo never outranks a dated source (the register, a spec): it only fills a gap.
  if (hr?.answer) cands.push(...candidatesFromHouseRead(hr.answer, `photo-read ${hr.model} ${hr.at.slice(0, 10)} crop ${hr.candidateId}`).filter(c => c.field !== 'facadeYear' || !cands.some(o => o.field === 'facadeYear')));
  const extras = hr?.answer ? readExtras(hr.answer) : null;
  const fields = pickFields(cands);
  const u = unitOf.get(p.pandId);
  const faceMembers = u ? pands.filter(q => unitOf.get(q.pandId)?.key === u.key).map(q => q.pandId) : [p.pandId];
  const fh = faceHouse.get(p.pandId);
  const side = a && typeof a.sameAs === 'string' && ['left', 'right', 'both'].includes(a.sameAs) ? a.sameAs : undefined;
  const at = pands.indexOf(p);
  const neighbours = side ? [...(side !== 'right' ? [pands[at - 1]] : []), ...(side !== 'left' ? [pands[at + 1]] : [])].filter(Boolean).map(q => q!.pandId) : [];
  const group: PandDescription['group'] = {
    unit: u ? { id: `du:${u.key}`, source: 'ordekaart', share: u.share, orde: u.orde, architect: u.architect, year: u.year, faceMembers } : { id: p.pandId, source: 'single', faceMembers },
    ...(fh?.sameAs ? { sameAs: fh.sameAs } : {}), ...(fh?.type ? { type: fh.type } : {}),
    ...(own?.basedOn ? { basedOn: { pandId: own.basedOn.pandId, ...(own.basedOn.ref ? { ref: own.basedOn.ref } : {}) } } : {}),
    ...(side ? { readSameAs: { side, pandIds: neighbours } } : {}),
  };
  out.push({
    pandId: p.pandId, address: p.address, order: p.order, fields, missing: DESC_FIELDS.filter(f => !fields[f]), group,
    kitCannotDraw: kitCannotDraw(p.pandId, fields, gaps), ...(extras ? { photoRead: { ...extras, candidateId: hr.candidateId } } : {}), specParts: partRefs.get(p.pandId) ?? [], counts: countFields([fields]),
  });
}

// Split houses (`<pand>#n`, picks.json houses) read on their own crop (read-house.ts keys them so): each is described alone,
// from its own read plus what holds for the whole pand (the survey's eaves, the register's year). The pand's other
// sources (specs, face intents, D1 reads) describe the pand as one front, so they do not speak for a half of it.
const houses: PandDescription[] = [];
for (const [key, hr] of Object.entries(houseReads)) {
  const m = /^(\d{16})#(\d{1,2})$/.exec(key), base = m ? pands.find(p => p.pandId === m[1]) : undefined;
  if (!m || !base || !hr?.answer) continue;
  const cands: FieldCandidate[] = [], baseFields = out.find(d => d.pandId === base.pandId)?.fields ?? {};
  // The pand's measured eaves and its dated year, as its own entry states them.
  for (const f of ['eavesM', 'facadeYear'] as const) { const v = baseFields[f]; if (v && (v.source === 'survey' || v.source === 'register')) cands.push({ field: f, value: v.value, source: v.source, confidence: v.confidence, ref: `${v.ref} (the pand's)` }); }
  cands.push(...candidatesFromHouseRead(hr.answer, `photo-read ${hr.model} ${hr.at.slice(0, 10)} crop ${hr.candidateId} (split house ${key})`).filter(c => c.field !== 'facadeYear' || !cands.some(o => o.field === 'facadeYear')));
  const extras = readExtras(hr.answer), fields = pickFields(cands);
  houses.push({
    pandId: key, address: (hr as { address?: string }).address ?? `${base.address} (${m[2]})`, order: base.order, fields, missing: DESC_FIELDS.filter(f => !fields[f]),
    group: { unit: { id: key, source: 'single', faceMembers: [key] } }, kitCannotDraw: kitCannotDraw(base.pandId, fields, gaps),
    ...(extras ? { photoRead: { ...extras, candidateId: hr.candidateId } } : {}), specParts: [], counts: countFields([fields]),
  });
}
houses.sort((a, b) => a.order - b.order || a.pandId.localeCompare(b.pandId));

const counts = countFields(out.map(d => d.fields));
const byField = Object.fromEntries(DESC_FIELDS.map(f => [f, {
  library: out.filter(d => d.fields[f] && LIBRARY_SOURCES.has(d.fields[f]!.source)).length,
  newRead: out.filter(d => !d.fields[f] || !LIBRARY_SOURCES.has(d.fields[f]!.source)).length,
}]));
const file = {
  version: 1, faceId, street: face.street, side: face.side, generatedAt: new Date().toISOString().slice(0, 10),
  about: 'Belt review stage 2 (lane C): the first description per pand from the library, a source and confidence per field (sources strongest first: ' + DESC_SOURCES.join(' > ') + '); library = sources above donor, newRead = donor, period-default or absent. Built by scripts/belt-review/describe.ts.',
  inputs,
  counts: { pands: out.length, ...counts, libraryShare: +(counts.library / Math.max(1, counts.fields)).toFixed(3), byField,
    pandsWithKitGaps: out.filter(d => d.kitCannotDraw.length).length, ordekaartUnits: new Set(out.filter(d => d.group.unit.source === 'ordekaart').map(d => d.group.unit.id)).size,
    multiPandUnits: new Set(out.filter(d => d.group.unit.faceMembers.length > 1).map(d => d.group.unit.id)).size },
  pands: out,
  ...(houses.length ? { houses } : {}),
};
console.log(JSON.stringify({ faceId, ...file.counts, byField: undefined }, null, 1));
console.log('per field (library/newRead): ' + DESC_FIELDS.map(f => `${f} ${byField[f].library}/${byField[f].newRead}`).join(', '));
if (!argv.includes('--check')) {
  const target = path.resolve(opt('out') ?? path.join(path.dirname(faceFile), 'description.json'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(file, null, 1) + '\n');
  console.log(`wrote ${rel(target)}`);
}
