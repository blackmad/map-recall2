/**
 * Block-face intent: ONE typed JSON per block face, written by one person or
 * vision model while looking at the face's rectified facade strip.
 *
 * Houses are listed left to right as seen from the street, each with the
 * existing canal-house design (src/canalRecall/buildingRecipe/intent.ts, minus
 * identity), a ground-floor use reconciled from BAG + OSM + the dated photo,
 * and a facade rhythm spec with a photo citation (the acceptance checklist in
 * docs/buildings-pipeline.md). Face-level continuity is stated once: one
 * street level, which cornices form one line, which houses are the same
 * design. Like the house intent it names components and counts, never
 * coordinates or metres: everything metric comes from facts.
 */
import {validateIntent, type CanalHouseIntent, type IntentSource} from '../buildingRecipe/intent.ts';

export const GROUND_USES = ['residential', 'shop', 'restaurant', 'cafe', 'bar', 'services', 'office', 'vacant', 'other'] as const;
export const USE_AGREEMENT = ['osm-and-photo', 'photo-only', 'osm-only', 'conflict', 'bag-only'] as const;

/** The house design as in a canal-house intent, without identity (the face gives id, pand, address, sources). */
export type HouseDesign = Omit<CanalHouseIntent, 'schemaVersion' | 'kind' | 'id' | 'pandId' | 'address' | 'sources'>;

export interface GroundFloorUse {
  use: typeof GROUND_USES[number];
  /** Trading name as signed on the photo (or OSM name when the photo has no legible sign). */
  name?: string;
  /** OSM category, e.g. `shop=bicycle`, `amenity=restaurant`. */
  category?: string;
  osm?: {type: string; id: number; name?: string; tags?: string};
  /** BAG gebruiksdoel of the street-level unit(s). */
  bag?: string[];
  /** Date of the photo this was read from (shops change). */
  photoDate: string;
  agreement: typeof USE_AGREEMENT[number];
  note?: string;
}

/** Facade rhythm spec for one wall, from the strip (acceptance checklist item 1). */
export interface RhythmSpec {
  bays: string;
  identicalBays?: string;
  windowsPerStorey: string;
  symmetry: string;
  groundFloor: string;
  signage: string;
  roofline: string;
  setbacks?: string;
  /** Where on the strip: `strip.jpg pand <n>` or another image; `inferred: <why>` when the photo does not show it. */
  citation: string;
  /** Machine-checkable counts from the photo for facade-compare: glazed openings per row bottom→top (ground row = shop glass + fanlights), silhouette peaks. */
  photoRows?: number[];
  /** How many leading `photoRows` entries belong to the ground band (ground floor/pui incl. its transom or mezzanine row,
   * and a basement). Default: 1, or 2 when the second row is a lone transom/mezzanine row (fewer openings than the rows
   * on either side, e.g. `[2, 1, 3, 3, 3, 1]`). See `blockFace/openingCount.ts`. */
  photoGroundRows?: number;
  photoGables?: number;
  /** Things the schema cannot express that the model will therefore get wrong (shown on the review sheet). */
  schemaLimits?: string[];
}

export interface BlockFaceHouse {
  pandId: string;
  /** Slug for the pand (`<face prefix>-<last 6 digits>`). */
  slug: string;
  address: string;
  /** Either a full design, or `sameAs` another pand of this face with overrides (a declared identical design). */
  design?: HouseDesign;
  sameAs?: string;
  overrides?: Partial<HouseDesign> & {fronts?: Partial<HouseDesign['fronts'][number]>[]};
  groundFloor: GroundFloorUse;
  rhythm: RhythmSpec;
}

export interface BlockFaceIntent {
  schemaVersion: 1;
  kind: 'block-face';
  id: string;
  street: string;
  /** The strip and panoramas the author looked at. */
  sources: IntentSource[];
  houses: BlockFaceHouse[];
  continuity: {
    /** `shared`: one street level for the face (median 3DBAG ground). */
    streetLevel: 'shared' | 'stepped';
    /** Houses whose eaves/cornice read as ONE line on the photo; evidence = what on the strip shows it. */
    corniceGroups: {pands: string[]; evidence: string;
      /** The photo overrules 3DBAG for this line: snap every member to `reference`'s surveyed eaves even beyond the usual
       * spread limit (<= 2.5 m). For gable fronts whose LoD2.2 profile picks up a lower rear roof. The gate then reports
       * the survey delta as an override instead of failing. */
      trust?: 'photo'; reference?: string}[];
    /** Houses with the same design (the later ones use `sameAs`); evidence on the strip. */
    identical: {pands: string[]; evidence: string}[];
    /**
     * Eaves read off the rectified strip where 3DBAG misreads them (a cornice front hiding a gabled roof, a gable foot
     * under a dormer): `stripRow` is the pixel row of the cornice top / gable foot on `strip.jpg` (strip.json gives the
     * scale and ground); `front` names the front of a multi-front pand (default: every front of the pand).
     * `frontRoof` (a front whose cornice sits BELOW 3DBAG's eaves; on a multi-front pand only that front's stretch): LoD2.2 carries a mansard's flat top, or a
     * dormer merged into the roof, out to the facade (Bilderdijkstraat 133, 145, 147, 153: eaves 2.5-3.5 m above the photo
     * cornice). The front strip of the roof is re-pitched from the measured eaves at `pitchDeg` (default 72, a mansard
     * face) up to the survey's height (blockFace/compile.ts repitchFrontRoof), so the shell stops at the cornice; `topRow`
     * first caps the front roof at that strip row (the roof top beside a dormer 3DBAG merged into the roof).
     */
    measuredEaves?: {pand: string; front?: string; stripRow: number; frontRoof?: {topRow?: number; pitchDeg?: number}; evidence: string}[];
    /**
     * Crowns read off the strip instead of authored (blockFace/gableFromStrip.ts): the photo's gable type, step count,
     * rise and (when it differs from the authored placement) span replace the front's crown fields at compile time.
     * `front` names one front of a multi-front pand (default: every front). A front whose photo reading abstains keeps
     * its authored crown (reported). Absent = the authored crown, byte-identical.
     */
    crownFromPhoto?: {pand: string; front?: string; evidence: string}[];
    /** Clip street-side details at oblique party walls on every house of the face (FrontIntent `partyClip`). */
    partyClip?: boolean;
    notes?: string[];
  };
  authoring?: {author: string; startedAt?: string; finishedAt?: string; passes: number; note?: string};
}

const merge = (a: any, b: any): any => {
  if (Array.isArray(a) && Array.isArray(b)) return b.length && typeof b[0] === 'object' && !Array.isArray(b[0]) ? a.map((x, i) => i < b.length ? merge(x, b[i]) : x).concat(b.slice(a.length)) : b;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(b)) { const out = {...a}; for (const [k, v] of Object.entries(b)) out[k] = k in a ? merge(a[k], v) : v; return out; }
  return b === undefined ? a : b;
};

/** Resolve every house to a validated canal-house intent (identity from the face, design from itself or its `sameAs`). */
export function houseIntents(face: BlockFaceIntent): CanalHouseIntent[] {
  const byPand = new Map(face.houses.map(h => [h.pandId, h]));
  const designOf = (h: BlockFaceHouse, depth = 0): HouseDesign => {
    if (h.design) return h.design;
    if (!h.sameAs || depth > 4) throw Error(`${h.pandId}: needs design or sameAs`);
    const base = byPand.get(h.sameAs);
    if (!base) throw Error(`${h.pandId}: sameAs ${h.sameAs} is not on this face`);
    return merge(designOf(base, depth + 1), h.overrides ?? {});
  };
  // Face-wide party-wall clipping: every front opts in unless it says otherwise.
  const withClip = (d: HouseDesign): HouseDesign => face.continuity?.partyClip ? {...d, fronts: d.fronts.map(f => ({partyClip: true, ...f}))} : d;
  return face.houses.map(h => validateIntent({schemaVersion: 1, kind: 'canal-house', id: h.slug, pandId: h.pandId, address: h.address, sources: face.sources, ...withClip(designOf(h)),
    notes: [...(designOf(h).notes ?? []), ...(h.sameAs ? [`sameAs ${h.sameAs} (block face ${face.id})`] : [])]}));
}

/** Validate a parsed face intent: houses, uses vs shopfronts, continuity references. Throws one error listing every problem. */
export function validateBlockFace(input: unknown, order?: string[]): BlockFaceIntent {
  const face = input as BlockFaceIntent, problems: string[] = [];
  if (face?.kind !== 'block-face' || face.schemaVersion !== 1) problems.push('kind must be "block-face", schemaVersion 1');
  if (!Array.isArray(face?.houses) || face.houses.length < 2) problems.push('a block face needs at least two houses');
  const pands = new Set(face?.houses?.map(h => h.pandId) ?? []);
  if (order && face?.houses && face.houses.map(h => h.pandId).join() !== order.join()) problems.push(`houses must be listed left to right in street order: ${order.map(p => p.slice(-6)).join(' ')}`);
  let intents: CanalHouseIntent[] = [];
  try { intents = houseIntents(face); } catch (e) { problems.push((e as Error).message); }
  for (const [i, h] of (face?.houses ?? []).entries()) {
    const at = `house ${h.pandId?.slice(-6)}`;
    const g = h.groundFloor;
    if (!g || !GROUND_USES.includes(g.use)) problems.push(`${at}.groundFloor.use must be one of ${GROUND_USES.join('|')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g?.photoDate ?? '')) problems.push(`${at}.groundFloor.photoDate must be YYYY-MM-DD`);
    if (g && !USE_AGREEMENT.includes(g.agreement)) problems.push(`${at}.groundFloor.agreement must be one of ${USE_AGREEMENT.join('|')}`);
    const front = intents[i]?.fronts[0];
    if (front && g) {
      const trading = !['residential', 'office', 'vacant'].includes(g.use);
      if (g.use === 'residential' && front.shopfront) problems.push(`${at}: residential ground floor must not have a shopfront`);
      if (trading && !front.shopfront && !front.groundFront) problems.push(`${at}: ${g.use} ground floor needs a shopfront (or a historic groundFront)`);
      if (front.shopfront?.sign && g.name && !g.name.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(front.shopfront.sign.text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))) problems.push(`${at}: sign "${front.shopfront.sign.text}" does not match the use name "${g.name}"`);
    }
    for (const k of ['bays', 'windowsPerStorey', 'symmetry', 'groundFloor', 'signage', 'roofline', 'citation'] as const) if (!h.rhythm?.[k]) problems.push(`${at}.rhythm.${k} required (acceptance checklist: rhythm spec before modelling)`);
  }
  for (const g of [...(face?.continuity?.corniceGroups ?? []), ...(face?.continuity?.identical ?? [])]) {
    for (const p of g.pands) if (!pands.has(p)) problems.push(`continuity group lists ${p}, not on this face`);
    if (!g.evidence) problems.push(`continuity group ${g.pands.map(p => p.slice(-6)).join('+')} needs evidence`);
  }
  for (const g of face?.continuity?.corniceGroups ?? []) if (g.trust === 'photo' && (!g.reference || !g.pands.includes(g.reference))) problems.push(`cornice group ${g.pands.map(p => p.slice(-6)).join('+')}: trust photo needs a reference pand in the group`);
  for (const g of face?.continuity?.identical ?? []) for (const p of g.pands.slice(1)) {
    const h = face.houses.find(x => x.pandId === p);
    if (h && h.sameAs !== g.pands[0]) problems.push(`identical group: ${p.slice(-6)} should be sameAs ${g.pands[0].slice(-6)}`);
  }
  const seen = new Set<string>();
  for (const g of face?.continuity?.corniceGroups ?? []) for (const p of g.pands) { if (seen.has(p)) problems.push(`${p} in two cornice groups`); seen.add(p); }
  const measuredSeen = new Set<string>();
  for (const [k, m] of (face?.continuity?.measuredEaves ?? []).entries()) {
    const at = `continuity.measuredEaves[${k}]`, i = face.houses.findIndex(h => h.pandId === m?.pand);
    if (i < 0) { problems.push(`${at}: pand ${m?.pand} is not on this face`); continue; }
    if (!(Number.isInteger(m.stripRow) && m.stripRow >= 0)) problems.push(`${at}.stripRow: a pixel row on strip.jpg`);
    if (!m.evidence) problems.push(`${at}: needs evidence (what on the strip marks the line)`);
    if (m.frontRoof !== undefined) {
      const r = m.frontRoof;
      if (r.topRow !== undefined && !(Number.isInteger(r.topRow) && r.topRow >= 0 && r.topRow < m.stripRow)) problems.push(`${at}.frontRoof.topRow: a pixel row above stripRow (the roof top is higher than the eaves)`);
      if (r.pitchDeg !== undefined && !(r.pitchDeg >= 30 && r.pitchDeg <= 80)) problems.push(`${at}.frontRoof.pitchDeg: 30..80`);
      if (intents[i] && intents[i].fronts.length > 1 && m.front === undefined) problems.push(`${at}.frontRoof: name the front of a multi-front pand`);
    }
    if (m.front !== undefined && intents[i] && !intents[i].fronts.some(f => f.id === m.front)) problems.push(`${at}.front: ${m.front} is not a front of ${m.pand.slice(-6)}`);
    const key = `${m.pand}/${m.front ?? '*'}`;
    if (measuredSeen.has(key)) problems.push(`${at}: ${key} measured twice`);
    measuredSeen.add(key);
    if (face.continuity.corniceGroups.some(g => g.pands.includes(m.pand))) problems.push(`${at}: ${m.pand.slice(-6)} is also in a cornice group; measure it or group it, not both`);
  }
  const photoSeen = new Set<string>();
  for (const [k, c] of (face?.continuity?.crownFromPhoto ?? []).entries()) {
    const at = `continuity.crownFromPhoto[${k}]`, i = face.houses.findIndex(h => h.pandId === c?.pand);
    if (i < 0) { problems.push(`${at}: pand ${c?.pand} is not on this face`); continue; }
    if (!c.evidence) problems.push(`${at}: needs evidence (why the photo crown beats the authored one)`);
    if (c.front !== undefined && intents[i] && !intents[i].fronts.some(f => f.id === c.front)) problems.push(`${at}.front: ${c.front} is not a front of ${c.pand.slice(-6)}`);
    const key = `${c.pand}/${c.front ?? '*'}`;
    if (photoSeen.has(key)) problems.push(`${at}: ${key} listed twice`);
    photoSeen.add(key);
  }
  if (face?.continuity?.partyClip !== undefined && typeof face.continuity.partyClip !== 'boolean') problems.push('continuity.partyClip must be boolean');
  if (problems.length) throw Error(`Invalid block face ${face?.id ?? '?'}:\n - ${problems.join('\n - ')}`);
  return face;
}
