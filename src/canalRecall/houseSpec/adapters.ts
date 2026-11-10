/**
 * Adapters: every record that already describes a house, read as a partial HouseSpec (house line,
 * docs/house-line.md §1 "How to add a source"). Pure functions; the records stay where they are and stay the
 * authority for their own paths (block faces still compile from their intents, recipes still install from theirs).
 *
 *   fromBlockFace     scripts/block-face/faces/<id>/intent.json, one house of the face      streetlevel-measured
 *   fromRecipeIntent  scripts/building-recipes/houses/<id>/intent.json (canal-house only)   its own sources
 *   fromHouseRecord   facade/houseRecord.ts CanalHouse (facade-twin house-records.json)     each field's own receipt
 *   fromRegisterFacts monument-facts.json (facade/registerFacts.ts)                          monument-text
 *   fromJev           a Jev typed judgement of a street crop (type only; lane H5 wires it) vision-judge
 */
import type { CanalHouseIntent, GableIntent, IntentSource, WindowKind } from '../buildingRecipe/intent.ts';
import { houseIntents, type BlockFaceIntent } from '../blockFace/intent.ts';
import type { TypeLoader } from '../blockFace/typeLibrary.ts';
import { wasObserved, type Measured } from '../facade/evidence.ts';
import type { CanalHouse, GableType, WindowType } from '../facade/houseRecord.ts';
import { ELEMENT_COMPONENTS, registerYear, type PublishedFacts } from '../facade/registerRecipe.ts';
import type { RegisterFinish } from '../facade/registerFacts.ts';
import type { GableShape } from '../roofMesh.ts';
import { emptySpec, pandDigits, setSpecField, specStrength, type HouseSpec, type Prov, type SpecSource } from './spec.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOrNull = (s: string | null | undefined) => (s && DATE.test(s) ? s : null);
/** The design of an intent: everything but identity. */
const designOf = (intent: CanalHouseIntent) => {
  const { schemaVersion: _v, kind: _k, id: _i, pandId: _p, address: _a, sources: _s, ...design } = intent;
  return structuredClone(design);
};
/** The latest evidence date among sources. */
const latest = (sources: readonly IntentSource[]) => sources.map(s => dateOrNull(s.capturedAt)).filter((d): d is string => !!d).sort().pop() ?? null;

// --- block faces -------------------------------------------------------------------------------------------------
/** Confidence of a hand-written face design read off its rectified strip; an auto-placed type match is less sure. */
export const BLOCK_FACE_CONFIDENCE = { authored: 0.85, autoPlaced: 0.6 } as const;

/**
 * One house of a block face. `stripRef` is the face's strip.json path (the evidence the design was read off).
 * Every design field gets the face's receipt; `rhythm.schemaLimits` and the face `limitations` lines that name the
 * pand (`<pand6>: …` or the full id) become schemaLimits. Null when the pand is not on the face.
 */
export function fromBlockFace(face: BlockFaceIntent, pandId: string, stripRef = `scripts/block-face/faces/${face.id}/strip.json`, load?: TypeLoader): HouseSpec | null {
  const digits = pandDigits(pandId);
  const house = face.houses.find(h => h.pandId === digits);
  if (!house) return null;
  const intent = (load ? houseIntents(face, load) : houseIntents(face)).find(i => i.pandId === digits)!;
  const auto = /^auto-place/.test(face.authoring?.author ?? '');
  const spec = emptySpec(digits, house.address);
  spec.design = designOf(intent);
  spec.provenance[''] = { source: 'streetlevel-measured', confidence: auto ? BLOCK_FACE_CONFIDENCE.autoPlaced : BLOCK_FACE_CONFIDENCE.authored, ref: stripRef, at: latest(face.sources) };
  const six = digits.slice(-6);
  const limits = [
    ...(house.rhythm?.schemaLimits ?? []),
    ...(face.limitations ?? []).filter(l => l.includes(digits) || l.startsWith(`${six}:`) || new RegExp(`\\b${six}\\b`).test(l)),
  ].map(asLimit);
  if (limits.length) spec.schemaLimits = [...new Set(limits)];
  if (house.groundFloor?.use) {
    const pui = house.groundFloor.use === 'residential' ? 'residential' : ['vacant', 'office', 'other'].includes(house.groundFloor.use) ? null : 'shop';
    if (pui) setSpecField(spec, 'facts/pui', pui);
  }
  return spec;
}

/** A free-text limit as `<component>: <what>`: kept when it already reads so, else filed under `facade`. */
export function asLimit(line: string): string {
  const t = line.trim();
  const m = /^(\d{6}):\s*(.*)$/.exec(t); // face limitations are `<pand6>: <what>`
  const body = m ? m[2] : t;
  // A component is one to three words before the colon (`gable: …`, `shop sign: …`); anything else is filed under facade.
  return /^[a-z][\w-]*(?: [\w-]+){0,2}: \S/i.test(body) ? body : `facade: ${body}`;
}

// --- recipe intents ----------------------------------------------------------------------------------------------
/** Intent source kind -> spec source. An archive photo is a photo someone read, not a rectified measurement. */
export const INTENT_KIND_SOURCE: Record<IntentSource['kind'], SpecSource> = {
  'street-panorama': 'streetlevel-measured', 'archive-photo': 'streetlevel-measured', 'monument-record': 'monument-text',
  'human-review': 'reviewed', orthophoto: 'pdok-ortho',
};
export const RECIPE_INTENT_CONFIDENCE = 0.85;

/** A hand-written canal-house recipe intent (`kind: canal-house`; large/landmark intents return null). */
export function fromRecipeIntent(intent: { kind?: string } & Partial<CanalHouseIntent>, ref = `scripts/building-recipes/houses/${intent.id}/intent.json`): HouseSpec | null {
  if (intent.kind !== 'canal-house' || !intent.pandId) return null;
  const full = intent as CanalHouseIntent;
  const spec = emptySpec(pandDigits(full.pandId), full.address);
  spec.design = designOf(full);
  // The whole design carries the strongest of the intent's sources (the author read the photo against all of them).
  const ranked = [...(full.sources ?? [])].sort((a, b) => order(INTENT_KIND_SOURCE[b.kind]) - order(INTENT_KIND_SOURCE[a.kind]));
  const top = ranked[0];
  spec.provenance[''] = top
    ? { source: INTENT_KIND_SOURCE[top.kind] ?? 'author', confidence: RECIPE_INTENT_CONFIDENCE, ref: `${ref}#${top.id}`, at: dateOrNull(top.capturedAt) }
    : { source: 'author', confidence: RECIPE_INTENT_CONFIDENCE, ref, at: null };
  return spec;
}
const order = (s: SpecSource | undefined) => (s ? specStrength(s) : -1);

// --- facade-twin house records -----------------------------------------------------------------------------------
/** Dutch gable words (houseRecord.ts GableType) -> the intent vocabulary. */
export const GABLE_WORDS: Record<GableType, GableIntent> = {
  trap: 'step', hals: 'neck', 'verhoogde-hals': 'raised-neck', klok: 'bell', tuit: 'spout', punt: 'point', lijst: 'cornice',
};
const WINDOW_WORDS: Partial<Record<WindowType, WindowKind>> = {
  kruiskozijn: 'cross', 'schuifraam-6': 'sash-6-over-6', 'schuifraam-8': 'sash-8-over-8', 'schuifraam-plain': 'sash',
};
const CORNICE_WORDS = { kroonlijst: 'heavy', simple: 'simple', none: 'none' } as const;
const provOf = (m: Measured<unknown>): Prov => ({ source: m.source, confidence: m.confidence, ref: m.observationId ?? 'house-record', at: dateOrNull(m.measuredAt) });

/** A facade-twin record: only observed fields, each with its own receipt. */
export function fromHouseRecord(record: CanalHouse): HouseSpec {
  const spec = emptySpec(pandDigits(record.pandId));
  const put = <T>(path: string, m: Measured<T> | undefined, map: (v: T) => unknown = v => v) => {
    if (!m || !wasObserved(m)) return;
    const v = map(m.value);
    if (v === undefined || v === null) return;
    setSpecField(spec, path, v);
    spec.provenance[path] = provOf(m);
  };
  put('fronts/0/gable', record.gable, g => GABLE_WORDS[g]);
  put('fronts/0/bays', record.bays, b => (Number.isInteger(b) && b > 0 ? b : undefined));
  put('fronts/0/storeys', record.storeys, s => (Number.isInteger(s) && s > 0 ? s : undefined));
  put('fronts/0/hoist', record.hoistBeam);
  put('fronts/0/cornice', record.corniceType, c => CORNICE_WORDS[c.kind]);
  put('fronts/0/windows', record.windowType, w => WINDOW_WORDS[w]);
  put('palette/brick', record.brick, b => (/^#[0-9a-f]{6}$/i.test(b.colourHex) ? b.colourHex.toLowerCase() : undefined));
  put('palette/wallMaterial', record.brick, b => (b.painted ? 'painted-brick' : undefined));
  put('facts/pui', record.puiType, p => (p.kind === 'winkelpui' ? 'shop' : p.kind === 'none' ? undefined : p.kind));
  return spec;
}

// --- monuments register ------------------------------------------------------------------------------------------
/** Register gable (roofMesh GableShape, as monumentGables.ts classifies the text) -> the intent vocabulary. */
export const REGISTER_GABLE: Record<GableShape, GableIntent> = {
  step: 'step', neck: 'neck', raisedNeck: 'raised-neck', bell: 'bell', clock: 'bell', spout: 'spout', plain: 'point', cornice: 'cornice',
};
/** Register finish -> palette.wallMaterial; a stone front has no wall material in the kit (a schema limit). */
export const REGISTER_FINISH: Partial<Record<RegisterFinish, 'brick' | 'stucco' | 'painted-brick'>> = {
  brick: 'brick', ornamentalBrick: 'brick', plaster: 'stucco', painted: 'painted-brick',
};
/** How sure a register read is. Gable from golden-score.ts sampling (#316): the text's gable matched the front in
 *  most sampled pands; a date range wider than 50 years is a period, not a date. */
export const REGISTER_CONFIDENCE = { gable: 0.8, year: 0.7, period: 0.5, finish: 0.7, element: 0.6 } as const;

/**
 * The register's facts for one pand (monument-facts.json `buildings[id]`). `nr` is the register number (the ref);
 * `pandId` the pand they were matched to. Reads what registerRecipe.ts reads: gable, the facade year (era), finish,
 * elements (hoist beam and stoop into the design; every element's wall-extra ids into facts.elements).
 */
export function fromRegisterFacts(published: PublishedFacts, nr: string | string[] | undefined, pandId: string): HouseSpec {
  const spec = emptySpec(pandDigits(pandId));
  const number = Array.isArray(nr) ? nr[0] : nr ?? (Array.isArray(published.nr) ? published.nr[0] : published.nr) ?? '?';
  const ref = `rce:${number}`;
  const put = (path: string, value: unknown, confidence: number) => {
    setSpecField(spec, path, value);
    spec.provenance[path] = { source: 'monument-text', confidence, ref, at: null };
  };
  if (published.gable && REGISTER_GABLE[published.gable]) put('fronts/0/gable', REGISTER_GABLE[published.gable], REGISTER_CONFIDENCE.gable);
  const year = registerYear(published);
  if (year !== null) {
    const d = published.facadeDate ?? published.coreDate!;
    put('facts/facadeYear', year, d.to - d.from > 50 ? REGISTER_CONFIDENCE.period : REGISTER_CONFIDENCE.year);
  }
  if (published.finish) {
    const material = REGISTER_FINISH[published.finish];
    if (material) put('palette/wallMaterial', material, REGISTER_CONFIDENCE.finish);
    else spec.schemaLimits = [`palette: register finish ${published.finish} (no wallMaterial for a ${published.finish} front)`];
  }
  const keys = new Set((published.elements ?? []).map(e => e.key));
  if (keys.has('hoistBeam')) put('fronts/0/hoist', true, REGISTER_CONFIDENCE.element);
  if (keys.has('stoop')) put('fronts/0/basement', 'stoop', REGISTER_CONFIDENCE.element);
  const elements = [...new Set([...keys].flatMap(k => ELEMENT_COMPONENTS[k] ?? []))].sort();
  if (elements.length) put('facts/elements', elements, REGISTER_CONFIDENCE.element);
  return spec;
}

// --- Jev typed judge ---------------------------------------------------------------------------------------------
/** One Jev judgement of a street-level crop (#326). Each field carries the judge's probability for its answer. */
export interface JevJudgement {
  pandId: string;
  /** The crop the judge looked at (repo path, source-data:// path or URL). */
  crop: string;
  /** ISO date of the crop's imagery. */
  capturedAt: string | null;
  bays?: { value: number; p: number };
  pui?: { value: 'shop' | 'residential' | 'warehouse'; p: number };
  /** Only `confident` gables are read (the spike: confident-only 42 % coverage, otherwise too noisy). */
  gable?: { value: GableIntent; p: number; confident: boolean };
  finish?: { value: 'brick' | 'stucco' | 'painted-brick'; p: number };
}
/** Fields under this probability are dropped rather than recorded as weak evidence. */
export const JEV_MIN_P = 0.5;

/** A Jev judgement as a spec (type only today; lane H5 wires the judge). Confidence = the judge's probability. */
export function fromJev(j: JevJudgement): HouseSpec {
  const spec = emptySpec(pandDigits(j.pandId));
  const put = (path: string, value: unknown, p: number) => {
    if (!(p >= JEV_MIN_P && p <= 1)) return;
    setSpecField(spec, path, value);
    spec.provenance[path] = { source: 'vision-judge', confidence: p, ref: j.crop, at: dateOrNull(j.capturedAt) };
  };
  if (j.bays && Number.isInteger(j.bays.value) && j.bays.value > 0) put('fronts/0/bays', j.bays.value, j.bays.p);
  if (j.pui) put('facts/pui', j.pui.value, j.pui.p);
  if (j.gable?.confident) put('fronts/0/gable', j.gable.value, j.gable.p);
  if (j.finish) put('palette/wallMaterial', j.finish.value, j.finish.p);
  return spec;
}
