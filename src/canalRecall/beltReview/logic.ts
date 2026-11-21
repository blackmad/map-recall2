/**
 * Belt review: pure rules shared by the server and the page. Entry validation, stage transitions and the derived parts
 * of the ledger. No I/O here (store.ts does the files), so every rule is unit-testable.
 */
import {
  ENTRY_ID_PATTERN, GROUPING_LINK_KINDS, PAND_PATTERN, PIN_KINDS, PIN_STATUSES, PIN_TAGS, PIN_TARGETS, STAGES, VERDICTS,
  type Actor, type CandidatesFile, type DescriptionFile, type EditsFile, type FaceFile, type FieldEdit, type GroupingFile,
  type LedgerFile, type PhotoCandidate, type Pick as PickEntry, type PinsFile, type PicksFile, type Pin, type Stage, type StateAction, type StateFile,
  type Verdict,
} from './types.ts';
import { DESC_FIELDS, LIBRARY_SOURCES } from './fields.ts';
import { HOUSE_PATTERN, basePand } from './houses.ts';

export class ReviewError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const bad = (message: string) => new ReviewError(message, 400);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number, what: string): string => {
  if (typeof v !== 'string' || v.length > max) throw bad(`${what} must be text up to ${max} characters`);
  return v;
};

// ------------------------------------------------------------------------------------------------------------ picks

const span = (v: unknown): [number, number] | null =>
  Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && Number.isFinite(n)) && v[0] < v[1] ? [v[0], v[1]] : null;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The facade span in metres from the BAG span start, from pixels in a candidate with `pandSpanPx` and a scale. */
export function facadeSpanToM(c: Pick<PhotoCandidate, 'pandSpanPx' | 'pxPerM'>, px: [number, number]): [number, number] | null {
  if (!c.pandSpanPx || !c.pxPerM) return null;
  return [r2((px[0] - c.pandSpanPx[0]) / c.pxPerM), r2((px[1] - c.pandSpanPx[0]) / c.pxPerM)];
}
/** The span to crop a candidate to, pixels: David's facade span (from metres, so it survives a re-crop), else the BAG span,
 *  else null (the whole image). */
export function cropSpanPx(c: Pick<PhotoCandidate, 'pandSpanPx' | 'pxPerM'>, pick?: Pick<PickEntry, 'facadeSpanM'> | null): [number, number] | null {
  if (!c.pandSpanPx) return null;
  if (pick?.facadeSpanM && c.pxPerM) return [c.pandSpanPx[0] + pick.facadeSpanM[0] * c.pxPerM, c.pandSpanPx[0] + pick.facadeSpanM[1] * c.pxPerM];
  return c.pandSpanPx;
}

/** candidates.json as lane B writes it, onto PhotoCandidate: `flags` may be a measurement object (its `reasons` become the
 *  flags), `ppm`/`width`/`height` alias `pxPerM`/`widthPx`/`heightPx`, a malformed `pandSpanPx` is dropped. */
export function parseCandidates(raw: unknown): CandidatesFile | null {
  if (!isObj(raw) || !Array.isArray(raw.pands)) return null;
  const pands = (raw.pands as unknown[]).filter(isObj).map(p => ({
    ...p,
    candidates: (Array.isArray(p.candidates) ? p.candidates : []).filter(isObj).map(c => {
      const o = { ...c } as Record<string, unknown>;
      if (!Array.isArray(o.flags)) o.flags = Array.isArray(o.reasons) ? (o.reasons as unknown[]).map(String) : [];
      o.pxPerM ??= typeof o.ppm === 'number' ? o.ppm : undefined;
      o.widthPx ??= typeof o.width === 'number' ? o.width : undefined;
      o.heightPx ??= typeof o.height === 'number' ? o.height : undefined;
      o.month ??= null; o.distM ??= null; o.obliquityDeg ??= null;
      o.pano = isObj(o.pano) ? o.pano : { id: '', date: '' };
      const sp = span(o.pandSpanPx);
      if (sp) o.pandSpanPx = sp; else delete o.pandSpanPx;
      return o as unknown as PhotoCandidate;
    }),
    autoPick: typeof p.autoPick === 'string' ? p.autoPick : null,
  })) as unknown as CandidatesFile['pands'];
  return { ...(raw as object), pands } as CandidatesFile;
}

/** picks.json from disk: an older file without facade spans reads as is; a malformed span is dropped, never fatal. */
export function parsePicks(raw: unknown, faceId: string): PicksFile {
  const base: PicksFile = { schemaVersion: 1, faceId, revision: 0, updatedAt: null, picks: {} };
  if (!isObj(raw)) return base;
  const out: PicksFile = { ...base, ...(raw as object), picks: {} } as PicksFile;
  for (const [id, v] of Object.entries(isObj(raw.picks) ? raw.picks : {})) {
    if (!isObj(v) || !(typeof v.candidateId === 'string' || v.candidateId === null)) continue;
    const e = { ...v } as unknown as PickEntry;
    const px = span(v.facadeSpanPx), m = span(v.facadeSpanM);
    if (px && m && e.candidateId !== null) { e.facadeSpanPx = px; e.facadeSpanM = m; } else { delete e.facadeSpanPx; delete e.facadeSpanM; }
    const hs = Array.isArray(v.houses) ? (v.houses as unknown[]).filter(isObj).filter(x => typeof x.fromM === 'number' && typeof x.toM === 'number' && x.fromM < x.toM) : [];
    if (hs.length >= 2 && e.candidateId !== null) e.houses = hs.map(x => ({ fromM: x.fromM as number, toM: x.toM as number, ...(typeof x.label === 'string' && x.label ? { label: x.label } : {}) }));
    else delete e.houses;
    out.picks[id] = e;
  }
  return out;
}

/** A pick body: `{candidateId: string|null, note?, facadeSpanPx?: [x0, x1] | null}`; the candidate must exist for that pand
 *  in candidates.json. A facade span needs a candidate with `pandSpanPx` and a scale; it is stored with its metres. Re-picking
 *  the same candidate without `facadeSpanPx` keeps the prior span; another candidate drops it; `null` clears it. */
export function validatePick(face: FaceFile, candidates: CandidatesFile | null, pandId: string, body: unknown, prior?: PickEntry): Pick<PickEntry, 'candidateId' | 'autoPick' | 'note' | 'facadeSpanPx' | 'facadeSpanM' | 'houses'> {
  if (!face.pands.some(p => p.pandId === pandId)) throw bad(`Pand ${pandId} is not on this face`);
  if (!isObj(body)) throw bad('Invalid pick');
  const { candidateId, note } = body;
  const entry = candidates?.pands.find(p => p.pandId === pandId);
  if (candidateId !== null) {
    if (typeof candidateId !== 'string') throw bad('candidateId must be a candidate id or null (none usable)');
    if (!entry?.candidates.some(c => c.id === candidateId)) throw bad(`Unknown candidate ${candidateId} for pand ${pandId}`);
  }
  const out: Pick<PickEntry, 'candidateId' | 'autoPick' | 'note' | 'facadeSpanPx' | 'facadeSpanM' | 'houses'> = { candidateId: candidateId as string | null, autoPick: entry?.autoPick ?? null };
  if (note !== undefined && note !== '') out.note = str(note, 2000, 'note');
  const cand = candidateId === null ? undefined : entry?.candidates.find(c => c.id === candidateId);
  if ('facadeSpanPx' in body && body.facadeSpanPx !== null) {
    const px = span(body.facadeSpanPx);
    if (!px) throw bad('facadeSpanPx must be [x0, x1] with x0 < x1');
    if (!cand) throw bad('A facade span needs a picked photo');
    const m = facadeSpanToM(cand, px);
    if (!m) throw bad('This photo has no BAG span (pandSpanPx) or scale to measure the facade against');
    const w = cand.widthPx ?? Infinity;
    if (px[0] < -1 || px[1] > w + 1) throw bad('facadeSpanPx is outside the photo');
    if (px[1] - px[0] < cand.pxPerM! * 1) throw bad('A facade is at least 1 m wide');
    out.facadeSpanPx = [r2(px[0]), r2(px[1])]; out.facadeSpanM = m;
  } else if (!('facadeSpanPx' in body) && prior?.facadeSpanPx && prior.facadeSpanM && prior.candidateId === candidateId && candidateId !== null) {
    out.facadeSpanPx = prior.facadeSpanPx; out.facadeSpanM = prior.facadeSpanM;
  }
  // Houses: given (null clears), else kept from the same candidate's prior pick; the outer ends always follow the span.
  const sameCand = prior?.candidateId === candidateId && candidateId !== null;
  const rawHouses = 'houses' in body ? body.houses : sameCand ? prior?.houses : undefined;
  if (rawHouses !== undefined && rawHouses !== null) {
    if (!cand?.pandSpanPx || !cand.pxPerM) throw bad('Splitting needs a picked photo with a BAG span (pandSpanPx) and a scale');
    if (!Array.isArray(rawHouses) || rawHouses.length < 2 || rawHouses.length > 12) throw bad('houses must list 2–12 houses');
    const hs = rawHouses.map((x, i) => {
      if (!isObj(x) || typeof x.fromM !== 'number' || typeof x.toM !== 'number' || !Number.isFinite(x.fromM) || !Number.isFinite(x.toM)) throw bad(`houses[${i}] needs fromM and toM`);
      const label = x.label === undefined || x.label === '' ? undefined : str(x.label, 40, 'label');
      return { fromM: r2(x.fromM), toM: r2(x.toM), ...(label ? { label } : {}) };
    });
    const bagW = (cand.pandSpanPx[1] - cand.pandSpanPx[0]) / cand.pxPerM, [s0, s1] = out.facadeSpanM ?? [0, r2(bagW)];
    hs[0].fromM = s0; hs[hs.length - 1].toM = s1;
    for (let i = 0; i < hs.length; i++) {
      if (i > 0 && Math.abs(hs[i].fromM - hs[i - 1].toM) > 0.02) throw bad('Split houses must be contiguous');
      if (hs[i].toM - hs[i].fromM < 1) throw bad('A split house is at least 1 m wide');
    }
    out.houses = hs;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------------------ edits

/** Spec field paths: `fronts/0/gable`, `palette/wallMaterial`, `facts/facadeYear`, `roof/material`. */
export const FIELD_PATH = /^(fronts\/\d{1,2}\/[A-Za-z][A-Za-z0-9]{0,40}|(palette|roof|facts)\/[A-Za-z][A-Za-z0-9]{0,40}|[A-Za-z][A-Za-z0-9]{0,40})$/;

export function validateEdits(face: FaceFile, pandId: string, body: unknown): { fields: Record<string, FieldEdit> } {
  if (!face.pands.some(p => p.pandId === pandId)) throw bad(`Pand ${pandId} is not on this face`);
  if (!isObj(body) || !isObj(body.fields)) throw bad('Edits need {fields: {path: {value}}}');
  const fields: Record<string, FieldEdit> = {};
  const entries = Object.entries(body.fields);
  if (entries.length > 80) throw bad('Too many field edits');
  for (const [path, edit] of entries) {
    if (!FIELD_PATH.test(path)) throw bad(`Invalid field path ${path}`);
    if (!isObj(edit) || !('value' in edit)) throw bad(`Field ${path} needs a value`);
    const json = JSON.stringify(edit.value);
    if (json === undefined || json.length > 4000) throw bad(`Field ${path} value is not JSON or too large`);
    fields[path] = { value: edit.value };
    if (edit.note !== undefined && edit.note !== '') fields[path].note = str(edit.note, 2000, 'note');
  }
  return { fields };
}

// ------------------------------------------------------------------------------------------------------------ pins

export function validatePin(face: FaceFile, pinId: string, body: unknown, prior: Pin | undefined, actor: Actor, pass: number, now: string): Omit<Pin, 'revision' | 'at' | 'by'> {
  if (!ENTRY_ID_PATTERN.test(pinId)) throw bad('Invalid pin id');
  if (!isObj(body)) throw bad('Invalid pin');
  const pandId = body.pandId === null || body.pandId === undefined ? null : String(body.pandId);
  if (pandId !== null && !face.pands.some(p => p.pandId === pandId)) throw bad(`Pand ${pandId} is not on this face`);
  const target = body.target, tag = body.tag, status = body.status ?? prior?.status ?? 'open', kind = body.kind;
  if (!PIN_TARGETS.includes(target as never)) throw bad('Invalid pin target');
  if (!PIN_TAGS.includes(tag as never)) throw bad('Invalid pin tag');
  if (!PIN_STATUSES.includes(status as never)) throw bad('Invalid pin status');
  if (kind !== undefined && kind !== null && !PIN_KINDS.includes(kind as never)) throw bad('Invalid pin kind');
  const x = Number(body.x), y = Number(body.y);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw bad('Pin x and y must be 0…1');
  const thread = Array.isArray(body.thread) ? body.thread : prior?.thread ?? [];
  if (thread.length > 200) throw bad('Thread too long');
  const cleanThread = thread.map((m: unknown) => {
    if (!isObj(m)) throw bad('Invalid thread message');
    return { at: str(m.at ?? now, 40, 'at'), by: m.by === 'claude' ? 'claude' as const : 'david' as const, text: str(m.text, 4000, 'message') };
  });
  const out: Omit<Pin, 'revision' | 'at' | 'by'> = {
    id: pinId, pandId, target: target as Pin['target'], x, y, tag: tag as Pin['tag'], note: str(body.note ?? '', 4000, 'note'),
    status: status as Pin['status'], thread: cleanThread, createdAt: prior?.createdAt ?? now, pass: prior?.pass ?? pass,
  };
  if (kind) out.kind = kind as Pin['kind'];
  void actor;
  return out;
}

// ------------------------------------------------------------------------------------------------------------ grouping

export function validateGrouping(face: FaceFile, body: unknown, actor: Actor, now: string): Pick<GroupingFile, 'units' | 'links'> {
  if (!isObj(body) || !Array.isArray(body.units) || !Array.isArray(body.links)) throw bad('Grouping needs {units: [], links: []}');
  const pands = new Set(face.pands.map(p => p.pandId)), seen = new Set<string>();
  const units = body.units.map((u: unknown) => {
    if (!isObj(u) || typeof u.id !== 'string' || !ENTRY_ID_PATTERN.test(u.id) || !Array.isArray(u.pandIds)) throw bad('Invalid unit');
    for (const p of u.pandIds) {
      if (!pands.has(p as string)) throw bad(`Unit ${u.id}: pand ${String(p)} is not on this face`);
      if (seen.has(p as string)) throw bad(`Pand ${String(p)} is in two units`);
      seen.add(p as string);
    }
    const unit: GroupingFile['units'][number] = { id: u.id, pandIds: [...u.pandIds as string[]], source: typeof u.source === 'string' ? u.source.slice(0, 40) : actor };
    if (typeof u.ordekaartId === 'string') unit.ordekaartId = u.ordekaartId.slice(0, 80);
    if (typeof u.note === 'string' && u.note) unit.note = u.note.slice(0, 2000);
    return unit;
  });
  const links = body.links.map((l: unknown) => {
    if (!isObj(l) || !GROUPING_LINK_KINDS.includes(l.kind as never)) throw bad('Invalid link');
    const pandId = String(l.pandId), target = String(l.target);
    if (!pands.has(pandId)) throw bad(`Link pand ${pandId} is not on this face`);
    // A target may be outside the face (a library house), but must be a pand id.
    if (!HOUSE_PATTERN.test(target) || target === pandId) throw bad('Invalid link target');
    const link: GroupingFile['links'][number] = { pandId, kind: l.kind as 'sameAs' | 'basedOn', target, by: l.by === 'claude' ? 'claude' : actor, at: typeof l.at === 'string' ? l.at : now };
    if (isObj(l.overrides)) link.overrides = l.overrides;
    return link;
  });
  const linked = new Set<string>();
  for (const l of links) { if (linked.has(l.pandId)) throw bad(`Pand ${l.pandId} has two links`); linked.add(l.pandId); }
  return { units, links };
}

// ------------------------------------------------------------------------------------------------------------ state

export interface Readiness { picks: PicksFile; pins: PinsFile; face: FaceFile }

/** What blocks confirming `stage` (empty = ready). */
export function stageBlockers(stage: Stage, r: Readiness): string[] {
  if (stage === 1) {
    const missing = r.face.pands.filter(p => !r.picks.picks[p.pandId]);
    return missing.length ? [`${missing.length} pand${missing.length === 1 ? '' : 's'} without a photo pick (${missing.map(p => p.address).slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''})`] : [];
  }
  if (stage === 4) {
    const open = Object.values(r.pins.pins).filter(p => p.status !== 'resolved');
    return open.length ? [`${open.length} pin${open.length === 1 ? '' : 's'} not resolved`] : [];
  }
  return [];
}

/** Apply a state action; throws ReviewError (409 for a refused transition). Mutates and returns `state`. */
export function applyStateAction(state: StateFile, action: StateAction, stageArg: unknown, actor: Actor, r: Readiness, now: string): StateFile {
  const refuse = (m: string) => new ReviewError(m, 409);
  const stage = stageArg === undefined ? state.stage : Number(stageArg) as Stage;
  if (!STAGES.includes(stage)) throw bad('Invalid stage');
  switch (action) {
    case 'confirm-stage': {
      if (state.status === 'accepted') throw refuse('The block is accepted; reopen it first');
      if (stage !== state.stage) throw refuse(`Stage ${state.stage} is the open stage, not ${stage}`);
      if (stage === 4) throw refuse('Stage 4 is finished by accepting the block');
      const blockers = stageBlockers(stage, r);
      if (blockers.length) throw refuse(blockers.join('; '));
      state.confirmed[String(stage)] = now;
      state.stage = (stage + 1) as Stage;
      break;
    }
    case 'reopen-stage':
      if (state.status === 'accepted') throw refuse('The block is accepted; reopen it first');
      if (stage > state.stage) throw refuse(`Stage ${stage} is not open yet`);
      for (const s of STAGES) if (s >= stage) delete state.confirmed[String(s)];
      state.stage = stage;
      break;
    case 'send-to-claude':
      if (state.status === 'accepted') throw refuse('The block is accepted');
      state.status = 'with-claude';
      state.passes += 1;
      break;
    case 'return-to-david':
      if (state.status !== 'with-claude') throw refuse('The block is not with Claude');
      state.status = 'with-david';
      break;
    case 'accept': {
      if (state.stage !== 4) throw refuse('Accept opens at stage 4');
      const blockers = stageBlockers(4, r);
      if (blockers.length) throw refuse(blockers.join('; '));
      state.status = 'accepted';
      state.confirmed['4'] = now;
      break;
    }
    case 'reopen-block':
      if (state.status !== 'accepted') throw refuse('The block is not accepted');
      state.status = 'with-david';
      delete state.confirmed['4'];
      break;
    default:
      throw bad('Invalid action');
  }
  state.events.push({ at: now, by: actor, action, stage });
  if (state.events.length > 500) state.events.splice(0, state.events.length - 500);
  return state;
}

// ------------------------------------------------------------------------------------------------------------ ledger


export interface LedgerInputs { face: FaceFile; candidates: CandidatesFile | null; description: DescriptionFile | null; picks: PicksFile; edits: EditsFile; grouping: GroupingFile; pins: PinsFile; state: StateFile }

/** Recompute the derived sections of the ledger (photos, fields, pins, stage failures, passes); keeps `david` and `claude`. */
export function deriveLedger(ledger: LedgerFile, x: LedgerInputs): LedgerFile {
  const picks = Object.values(x.picks.picks);
  ledger.photos = {
    pands: x.face.pands.length,
    picked: picks.length,
    agreedWithAuto: picks.filter(p => p.candidateId !== null && p.candidateId === p.autoPick).length,
    overridden: picks.filter(p => p.candidateId !== null && p.candidateId !== p.autoPick).length,
    noneUsable: picks.filter(p => p.candidateId === null).length,
    spanCorrected: picks.filter(p => p.candidateId !== null && p.facadeSpanM).length,
    pandSplits: picks.filter(p => p.candidateId !== null && (p.houses?.length ?? 0) >= 2).length,
  };
  let fromLibrary = 0, fromNewRead = 0;
  // Lane C's split: a field from a library source (fields.ts LIBRARY_SOURCES) against a donor, period default or absent field.
  for (const d of x.description?.pands ?? []) for (const f of DESC_FIELDS) (d.fields?.[f] && LIBRARY_SOURCES.has(d.fields[f]!.source) ? fromLibrary++ : fromNewRead++);
  const edited = Object.values(x.edits.edits).reduce((n, e) => n + Object.keys(e.fields).length, 0);
  ledger.fields = { fromLibrary, fromNewRead, edited };
  const pins = Object.values(x.pins.pins), byTag: Record<string, number> = {}, byKind: Record<string, number> = {};
  for (const p of pins) { byTag[p.tag] = (byTag[p.tag] ?? 0) + 1; if (p.kind) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1; }
  ledger.pins = { total: pins.length, open: pins.filter(p => p.status !== 'resolved').length, byTag, byKind };
  ledger.stageFailures = {
    '1': ledger.photos.overridden + ledger.photos.noneUsable,
    '2': Object.values(x.edits.edits).filter(e => Object.keys(e.fields).length).length,
    '3': x.grouping.units.filter(u => u.source !== 'ordekaart').length + x.grouping.links.length,
    '4': pins.length,
  };
  const reopens: Record<string, number> = {};
  for (const e of x.state.events) if (e.action === 'reopen-stage') reopens[String(e.stage)] = (reopens[String(e.stage)] ?? 0) + 1;
  ledger.reopens = reopens;
  ledger.passes = x.state.passes;
  ledger.acceptedAt = x.state.status === 'accepted' ? x.state.confirmed['4'] ?? null : null;
  return ledger;
}

/** Add active seconds (the page's timer) to the ledger; one post adds at most 120 s. */
export function addActivity(ledger: LedgerFile, seconds: unknown, stage: unknown): LedgerFile {
  const s = Number(seconds), st = Number(stage);
  if (!(s > 0 && s <= 120)) throw bad('seconds must be 0…120');
  if (!STAGES.includes(st as Stage)) throw bad('Invalid stage');
  ledger.david.activeSeconds = Math.round((ledger.david.activeSeconds + s) * 10) / 10;
  ledger.david.byStage[String(st)] = Math.round(((ledger.david.byStage[String(st)] ?? 0) + s) * 10) / 10;
  return ledger;
}

// ------------------------------------------------------------------------------------------------------------ verdicts

export function validateVerdict(body: unknown): { verdict: Verdict | null; note: string } {
  if (!isObj(body)) throw bad('Invalid verdict');
  const verdict = body.verdict ?? null;
  if (verdict !== null && !VERDICTS.includes(verdict as Verdict)) throw bad('Verdict must be better, same, worse or null');
  return { verdict: verdict as Verdict | null, note: str(body.note ?? '', 4000, 'note') };
}
