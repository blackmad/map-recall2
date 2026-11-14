/**
 * Build data/front-records/haarlemmerdijk-block.json: one FrontRecord (src/canalRecall/houseLine/frontRecord.ts) per pand
 * on the Haarlemmerdijk block faces and on Haarlemmerstraat 46-96.
 *
 *   node --import tsx scripts/front-records/build-haarlemmerdijk-block.ts [--check] [--out <path>]
 *
 * Reads only tracked files: the block faces (scripts/block-face/faces/<face>/{discovery,strip,auto-place,uses}.json and
 * pands/<pand>/facts.json), the hand specs (scripts/house-specs/specs/<pand>.json, for the conflicts list) and the hand
 * reads (data/front-records/haarlemmerdijk-block.reads.json, strip datum). --check rebuilds in memory and fails when the
 * committed table differs or does not validate.
 */
import fs from 'node:fs';
import path from 'node:path';
import {outlineOf} from '../../src/canalRecall/houseLine/frontOutline.ts';
import {hexToOklab} from '../../src/canalRecall/houseSpec/wallColour.ts';
import {frontTableProblems, type WallColour, type WallFinish, type Colour, type Conflict, type Confidence, type CrownFamily, type FrontRecord, type FrontRecordTable, type FrontTopKind, type Row, type Source, type SubFront, type FrontFields, type FrontTrace, type Opening, type Band} from '../../src/canalRecall/houseLine/frontRecord.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FACES = path.join(ROOT, 'scripts/block-face/faces');
const READS = 'data/front-records/haarlemmerdijk-block.reads.json';
const OUT = 'data/front-records/haarlemmerdijk-block.json';
const WALLS = 'data/front-records/haarlemmerdijk-walls.json'; // scripts/front-records/measure-walls.ts
const TRACES = 'data/front-records/haarlemmerdijk-traces.json'; // hand traces of the openings, bands and shop band
const FACE_IDS = ['haarlemmerdijk-2-58', 'haarlemmerdijk-13-45', 'haarlemmerdijk-66-120', 'haarlemmerdijk-67-91', 'haarlemmerdijk-93-113',
  'haarlemmerdijk-117-143', 'haarlemmerdijk-126-188', 'haarlemmerdijk-149-175', 'haarlemmer-46-96'];
const TOL = 0.5; // metres: two height reads within this agree
const r2 = (v: number) => Math.round(v * 100) / 100;
const json = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));

interface ReadCrown {family?: CrownFamily; widthM?: number; neckWidthM?: number; topM?: number; ornamentTopM?: number;
  dormer?: {kind: NonNullable<FrontRecord['crown']['dormer']>['kind']; topM: number | null}; atticWindows?: number; hoist?: boolean; note?: string}
interface Read {by: 'lane2-strip-read' | 'reviewer-strip-read'; ref: string; frontTop?: number; frontTopKind?: FrontTopKind; crown?: ReadCrown;
  storeys?: number; groundTop?: number; rows?: [number, number][]; bays?: number; wallWord?: string; trimWord?: string; note?: string}
/** One front of a multi-front pand: a single read over metres `from`-`to` of the pand's span (see SubFront). */
interface FrontRead extends Read {from: number; to: number; addresses?: string[]; cap?: Confidence}
interface PandReads {pandId: string; reads: Read[]; cap?: Confidence; fronts?: FrontRead[]}

const GABLE_FAMILY: Record<string, CrownFamily> = {cornice: 'straight-cornice', neck: 'neck', 'raised-neck': 'neck', bell: 'bell', 'bell-low': 'bell',
  point: 'point', step: 'step', spout: 'spout', 'pitched-eaves': 'other', flat: 'flat-parapet'};

function build(): FrontRecordTable {
  const walls = new Map<string, WallMeasure>(exists(WALLS) ? (json(WALLS).walls as WallMeasure[]).map(w => [w.pandId, w]) : []);
  const readsFile = json(READS) as {refs: Record<string, string>; pands: PandReads[]};
  const traces: Record<string, TraceIn> = exists(TRACES) ? json(TRACES).fronts : {};
  const reads = new Map(readsFile.pands.map(p => [p.pandId, p]));
  const refOf = (r: Read) => r.by === 'lane2-strip-read' ? `lane2 strip read 2026-11-13: ${r.ref}` : `${expandRef(r.ref, readsFile.refs)}`;
  const records: FrontRecord[] = [];
  const seen = new Set<string>();
  for (const face of FACE_IDS) {
    const dir = path.join('scripts/block-face/faces', face);
    const strip = json(`${dir}/strip.json`);
    const disc = json(`${dir}/discovery.json`);
    const ap = exists(`${dir}/auto-place.json`) ? json(`${dir}/auto-place.json`) : null;
    const uses = exists(`${dir}/uses.json`) ? json(`${dir}/uses.json`) : null;
    const order: string[] = strip.spans.map((s: {pandId: string}) => s.pandId);
    for (const m of disc.members as string[]) if (!order.includes(m)) order.push(m);
    for (const pandId of order) {
      if (seen.has(pandId)) continue;
      seen.add(pandId);
      const apP = ap?.pands.find((x: {pandId: string}) => x.pandId === pandId);
      const use = uses?.pands.find((x: {pandId: string}) => x.pandId === pandId);
      const address: string | null = apP?.address ?? use?.addresses?.[0] ?? null;
      const factsPath = `${dir}/pands/${pandId}/facts.json`;
      const facts = exists(factsPath) ? json(factsPath) : null;
      const groundNAP: number | null = facts?.heights?.groundNAP ?? null;
      // Reads are in the street datum already; 3DBAG heights (above the pand's ground) move by lift.
      const lift = groundNAP === null ? 0 : groundNAP - strip.groundNAP;
      const toStreet = (v: number | undefined | null) => v === undefined || v === null ? null : r2(v);
      const bag = (v: number | undefined) => v === undefined ? null : r2(v + lift);
      const street = disc.street as string;
      const front = (facts?.fronts ?? []).filter((f: {street: string}) => f.street === street).sort((a: {widthM: number}, b: {widthM: number}) => b.widthM - a.widthM)[0];
      const h = facts?.heights ?? {};
      const threeDBag = {frontEavesM: front ? bag(front.eavesM) : null, roofMinM: bag(h.roofMinM), dak50pM: bag(h.dak50pM), dak70pM: bag(h.dak70pM), roofMaxM: bag(h.roofMaxM)};
      const num = Number((address ?? '').match(/\s(\d+)/)?.[1]);
      const pr = reads.get(pandId);
      const rs: Read[] = pr?.reads ?? [];
      const sources: Source[] = [], conflicts: Conflict[] = [], notes: string[] = [];
      const kindOf = (r: Read) => r.by;
      // First stated value per field; later reads more than TOL away (or different) are conflicts, nearer ones agree.
      const pick = <T>(field: string, get: (r: Read) => T | undefined | null, same: (a: T, b: T) => boolean, show: (v: T) => unknown = v => v) => {
        let kept: {v: T; r: Read} | null = null; let agree = 0;
        for (const r of rs) {
          const v = get(r); if (v === undefined || v === null) continue;
          if (!kept) { kept = {v, r}; sources.push({field, ref: refOf(r), kind: kindOf(r)}); continue; }
          if (same(kept.v, v)) agree++;
          else conflicts.push({field, kept: {value: show(kept.v), ref: refOf(kept.r)}, other: {value: show(v), ref: refOf(r)}, note: 'two strip reads disagree'});
        }
        return {v: kept?.v ?? null, agree};
      };
      const near = (a: number, b: number) => Math.abs(a - b) <= TOL;
      const top = pick('frontTopM', r => r.frontTop, near, v => toStreet(v));
      const topKind = rs.find(r => r.frontTop !== undefined)?.frontTopKind ?? null;
      const fam = pick('crown.family', r => r.crown?.family, (a, b) => a === b);
      const cTop = pick('crown.topM', r => r.crown?.topM, near, v => toStreet(v));
      const orn = pick('crown.ornamentTopM', r => r.crown?.ornamentTopM, near, v => toStreet(v));
      const width = pick('crown.widthM', r => r.crown?.widthM, near);
      const neck = pick('crown.neckWidthM', r => r.crown?.neckWidthM, near);
      const attic = pick('crown.atticWindows', r => r.crown?.atticWindows, (a, b) => a === b);
      const hoist = pick('crown.hoist', r => r.crown?.hoist, (a, b) => a === b);
      const dormerRead = rs.find(r => r.crown?.dormer);
      const crownNotes = rs.map(r => r.crown?.note).filter(Boolean) as string[];
      const ground = pick('groundStoreyTopM', r => r.groundTop, near, v => toStreet(v));
      const bays = pick('bays', r => r.bays, (a, b) => a === b);
      // Rows: the first read whose rows are complete for its own storey count, else the longest list.
      const withRows = rs.filter(r => r.rows?.length);
      const rowsRead = withRows.find(r => r.storeys !== undefined && r.rows!.length === r.storeys - 1) ?? [...withRows].sort((a, b) => b.rows!.length - a.rows!.length)[0];
      let storeys = pick('storeys', r => r.storeys, (a, b) => a === b);
      if (rowsRead && storeys.v !== null && rowsRead.rows!.length !== storeys.v - 1 && rowsRead.storeys !== undefined) storeys = {v: rowsRead.storeys, agree: storeys.agree};
      const rows: Row[] = rowsRead ? rowsRead.rows!.map(([s, hd]) => ({sillM: toStreet(s)!, headM: toStreet(hd)!})) : [];
      if (rowsRead) {
        sources.push({field: 'rows', ref: refOf(rowsRead), kind: kindOf(rowsRead)});
        for (const r of withRows) if (r !== rowsRead) {
          const off = r.rows!.length === rowsRead.rows!.length ? Math.max(...r.rows!.map((x, i) => Math.max(Math.abs(x[0] - rowsRead.rows![i][0]), Math.abs(x[1] - rowsRead.rows![i][1])))) : null;
          if (off === null || off > TOL) conflicts.push({field: 'rows', kept: {value: rows, ref: refOf(rowsRead)}, other: {value: r.rows!.map(([s, hd]) => ({sillM: toStreet(s), headM: toStreet(hd)})), ref: refOf(r)},
            note: off === null ? 'the reads count different rows' : `rows differ by up to ${r2(off)} m`});
        }
      }
      const wordOf = (k: 'wallWord' | 'trimWord') => { const r = rs.find(x => x[k]); return r ? {word: r[k]!, ref: refOf(r)} : null; };
      const wallW = wordOf('wallWord'), trimW = wordOf('trimWord');
      const wall = wallOf(walls.get(pandId), wallW, rs, apP?.strip?.wallRaw ?? null, `${dir}/auto-place.json`);
      if (wall.hex) sources.push({field: 'wall.hex', ref: wall.ref!, kind: wall.source === 'reviewed' ? 'lane2-strip-read' : 'strip-measure'});
      const trim: Colour = {hex: null, word: trimW?.word ?? null, ref: trimW?.ref ?? null};
      for (const r of rs) if (r.note) notes.push(`${r.by === 'lane2-strip-read' ? 'lane2' : 'reviewer'}: ${r.note}`);
      if (facts) sources.push({field: 'threeDBag', ref: `${factsPath} (3DBAG ${facts.source?.fetchedAt ?? ''})`.trim(), kind: '3dbag'});
      const frontTopM = toStreet(top.v);
      // An ornament read by one reader below the crown top kept from another is the same crest read lower: drop it.
      if (orn.v !== null && cTop.v !== null && orn.v < cTop.v) { notes.push(`ornament top ${toStreet(orn.v)} m read below the kept crown top ${toStreet(cTop.v)} m: dropped`); orn.v = null; }
      // Confidence: high = the front top read twice within 0.5 m with no family conflict; medium = one read with a family;
      // low = no measured front top.
      const famConflict = conflicts.some(c => c.field === 'crown.family');
      let confidence: Confidence = frontTopM === null ? 'low' : top.agree > 0 && !famConflict && fam.v !== null ? 'high' : 'medium';
      if (pr?.cap === 'medium' && confidence === 'high') confidence = 'medium';
      if (pr?.cap === 'low') confidence = 'low';
      // Hand spec: where the committed spec disagrees with the measured front.
      const specPath = `scripts/house-specs/specs/${pandId}.json`;
      if (exists(specPath)) specConflicts(json(specPath), specPath, {frontTopM, storeys: storeys.v, bays: bays.v, family: fam.v, rows, bagEaves: threeDBag.frontEavesM, lift}, conflicts);
      if (frontTopM !== null && threeDBag.frontEavesM !== null && Math.abs(threeDBag.frontEavesM - frontTopM) > 1)
        notes.push(`3DBAG front eaves ${threeDBag.frontEavesM} m stands ${r2(threeDBag.frontEavesM - frontTopM)} m off the measured front top ${frontTopM} m`);
      if (Math.abs(lift) >= 0.5) notes.push(`the pand's 3DBAG ground (${r2(groundNAP!)} m NAP) stands ${r2(lift)} m off the street ground (${strip.groundNAP} m NAP): heights here are above the street`);
      const rec: FrontRecord = {
        pandId, address, street, face, side: Number.isFinite(num) ? (num % 2 ? 'odd' : 'even') : null,
        builtYear: apP?.builtYear ?? facts?.heights?.builtYear ?? null,
        bagWidthM: front ? r2(front.widthM) : apP?.widthM ?? null,
        datum: 'street', streetGroundNAP: strip.groundNAP, groundNAP: groundNAP === null ? null : r2(groundNAP),
        frontTopM, frontTopKind: frontTopM === null ? null : topKind,
        threeDBag,
        crown: {family: fam.v, widthM: width.v, neckWidthM: neck.v, shoulderM: topKind === 'gable-foot' ? frontTopM : null,
          topM: toStreet(cTop.v), ornamentTopM: toStreet(orn.v),
          dormer: dormerRead ? {kind: dormerRead.crown!.dormer!.kind, topM: toStreet(dormerRead.crown!.dormer!.topM)} : null,
          atticWindows: attic.v, hoist: hoist.v, note: crownNotes.length ? crownNotes.join('; ') : null},
        storeys: storeys.v, groundStoreyTopM: toStreet(ground.v), rows, bays: bays.v, wall, trim, sources,
        confidence, nothingLocal: rs.length === 0, conflicts, notes,
      };
      if (confidence === 'low' || frontTopM === null) rec.fallback = 'row-line';
      if (pr?.fronts?.length) {
        rec.fronts = pr.fronts.map((fr, i) => subFront(fr, walls.get(`${pandId}#${i}`), refOf(fr)));
        notes.push(`${rec.fronts.length} street fronts on this pand: draw rec.fronts, not the pand as one front`);
      }
      const tr = (key: string, f: FrontFields, x0: number, x1: number) => { const t = traceOf(traces[key], key, f, x0, x1, walls.get(key)?.fasciaHex ?? null); if (t) f.trace = t; };
      tr(pandId, rec, 0, rec.bagWidthM ?? 0);
      rec.fronts?.forEach((f, i) => tr(`${pandId}#${i}`, f, f.from, f.to));
      records.push(rec);
    }
  }
  for (const id of reads.keys()) if (!seen.has(id)) throw Error(`reads name ${id}, which is on none of the faces`);
  return {
    schemaVersion: 1, id: 'haarlemmerdijk-block', generatedBy: 'scripts/front-records/build-haarlemmerdijk-block.ts', generatedAt: '2026-11-13',
    datum: 'metres above the street ground of the block face (streetGroundNAP = strip.json groundNAP); 3DBAG heights moved there by groundNAP - streetGroundNAP; above the pand\'s own ground = value + streetGroundNAP - groundNAP',
    notes: [
      'Scope: every pand on the Haarlemmerdijk block faces (2-58, 13-45, 66-120, 67-91, 93-113, 117-143, 126-188, 149-175) and on Haarlemmerstraat 46-96, so the five named spots (Haarlemmerdijk 16, 20, 123, 143 and Haarlemmerstraat 54) are all covered; filter by face.',
      'Calibration: on flat-roofed fronts the strip tops agree with 3DBAG (moved to the street datum) within 0.5 m (Haarlemmerdijk 117: 10.3 vs 10.0; 125: 14.3 vs 14.4; 135A: 13.8 vs 13.8; 139A: 13.2 vs 13.7). On gable and cornice fronts 3DBAG front eaves read the rear roof or the dormer and are not the front top.',
      'Ground: the pands\' 3DBAG ground swings from 0.6 to 2.5 m NAP between neighbours on the dijk (13-45: 23E-27 at 2.5 against 1.0-1.2 around them), so heights are given above the street, not above each pand\'s ground.',
      'Registration: on the 2022-12-15 strips the fronts stand up to 1.5 m off their BAG splits (117-143 about 1.2 m left, 2-58 about 0.6 m right); a read names the front it read, not the BAG span. Widths are BAG widths.',
      'Confidence: high = the front top read twice (this lane and the earlier reviewer) within 0.5 m and one crown family; medium = one numeric read; low = no measured front top (fallback: row-line).',
      'Walls: data/front-records/haarlemmerdijk-walls.json (scripts/front-records/measure-walls.ts), the spandrel median with the capture exposure taken out (lane WC option (c)); wall.source reviewed = a Claude strip read named the wall and its lightness agrees, the label the pale-warm guard skips (reviewedWallSource).',
      'Trim colours are words only: no trim colour has been measured on the strips (the hand specs\' #e8e4d8 stone is the type default).',
    ],
    records,
  };
}

type OpeningIn = Partial<Opening> & {xs?: [number, number][]};
interface TraceIn {ref: string; confidence: Confidence; shopBandTopM?: number | null; fasciaWord?: string | null; corniceM?: number | null;
  bands?: [Band['kind'], number, number, string | null][]; surroundColour?: string | null; outline?: [number, number][]; notes?: string[]; storeys: OpeningIn[][]}
/** Expand one traced front: group shorthands into openings, defaults filled, the outline from the record when not traced. */
function traceOf(t: TraceIn | undefined, key: string, f: FrontFields, x0: number, x1: number, fasciaHex: string | null): FrontTrace | null {
  if (!t) return null;
  const one = (o: Partial<Opening>, x: number, w: number): Opening => ({x: r2(x), w: r2(w), y: r2(o.y!), h: r2(o.h!), kind: o.kind ?? 'other', head: o.head ?? 'flat',
    panes: o.panes ?? null, frame: o.frame ?? 'white', surround: o.surround ?? null, shutters: o.shutters ?? null});
  const storeys = t.storeys.map(row => row.flatMap(o => o.xs ? o.xs.map(([x, w]) => one(o, x, w)) : [one(o, o.x!, o.w!)]).sort((a, b) => a.x - b.x));
  const outline = t.outline ?? outlineOf(f, x0, x1);
  if (!outline) throw Error(`${key}: traced, but no front top for an outline`);
  return {storeys, shopBandTopM: t.shopBandTopM ?? null, fascia: t.fasciaWord || fasciaHex ? {hex: fasciaHex, word: t.fasciaWord ?? null} : null,
    corniceM: t.corniceM ?? null, bands: (t.bands ?? []).map(([kind, bottomM, topM, colour]) => ({kind, bottomM, topM, colour})),
    surroundColour: t.surroundColour ?? null, outline, source: {field: 'trace', ref: `lane2 trace 2026-11-13: ${t.ref} (${TRACES})`, kind: 'lane2-strip-read'},
    confidence: t.confidence, notes: t.notes ?? []};
}

/** A sub-front from its single read: medium with a front top, low without (or when the read caps it). */
function subFront(fr: FrontRead, m: WallMeasure | undefined, ref: string): SubFront {
  const sources: Source[] = [];
  const src = (field: string, v: unknown) => { if (v !== undefined && v !== null) sources.push({field, ref, kind: fr.by}); };
  const v = <T>(x: T | undefined) => x === undefined ? null : x;
  src('frontTopM', fr.frontTop); src('crown.family', fr.crown?.family); src('rows', fr.rows?.length ? 1 : null);
  const frontTopM = v(fr.frontTop) === null ? null : r2(fr.frontTop!);
  const wordR = fr.wallWord ? {word: fr.wallWord, ref} : null;
  const wall = wallOf(m, wordR, [fr], null, '');
  if (wall.hex) sources.push({field: 'wall.hex', ref: wall.ref!, kind: wall.source === 'reviewed' ? 'lane2-strip-read' : 'strip-measure'});
  let confidence: Confidence = frontTopM === null ? 'low' : 'medium';
  if (fr.cap === 'low') confidence = 'low';
  const c = fr.crown ?? {};
  const f: SubFront = {
    from: fr.from, to: fr.to, addresses: fr.addresses ?? [],
    frontTopM, frontTopKind: frontTopM === null ? null : fr.frontTopKind ?? null,
    crown: {family: c.family ?? null, widthM: c.widthM ?? null, neckWidthM: c.neckWidthM ?? null, shoulderM: fr.frontTopKind === 'gable-foot' ? frontTopM : null,
      topM: c.topM ?? null, ornamentTopM: c.ornamentTopM ?? null, dormer: c.dormer ? {kind: c.dormer.kind, topM: c.dormer.topM} : null,
      atticWindows: c.atticWindows ?? null, hoist: c.hoist ?? null, note: c.note ?? null},
    storeys: v(fr.storeys), groundStoreyTopM: v(fr.groundTop), rows: (fr.rows ?? []).map(([sl, hd]) => ({sillM: sl, headM: hd})), bays: v(fr.bays),
    wall, trim: {hex: null, word: fr.trimWord ?? null, ref: fr.trimWord ? ref : null}, sources, confidence, conflicts: [],
    notes: fr.note ? [`lane2: ${fr.note}`] : [],
  };
  if (confidence === 'low' || frontTopM === null) f.fallback = 'row-line';
  return f;
}

interface WallMeasure {pandId: string; fasciaHex?: string | null; rawHex: string | null; hex: string | null; gain: number | null; L: number | null; finishGuess: 'brick' | 'plaster' | null; sample: string | null; note: string | null}
const PALE = /white|cream|beige|pale|light|yellow|render|plaster|stucco|buff/i, DARK = /dark|black/i;
/** The finish a read's word names, if any. */
function finishWord(w: string): WallFinish | null {
  if (/painted brick/i.test(w)) return 'painted-brick';
  if (/plaster|stucco|render/i.test(w)) return 'plaster';
  if (/stone/i.test(w)) return 'stone';
  if (/brick/i.test(w)) return 'brick';
  return null;
}
/**
 * The wall of one record. Measured hex from measure-walls.ts; `reviewed` when a Claude strip read named the wall and its
 * lightness agrees with the measurement (pale word: L >= 0.5; dark word: L < 0.55; otherwise any), then high confidence.
 * A white or grey word also needs a near-neutral sample (Oklab chroma < 0.05) and a brown or red word L < 0.6: a high wall
 * whose word says one colour and whose sample says another is a sign or awning in the sample, not a reviewed wall.
 * No word: strip-measured, medium. A disagreeing word, a scaffolded or multi-front pand, or no measurement: low; except
 * that a traced front's sample (the wall between its traced openings, measure-walls.ts) stands inside that front, so a
 * seam or several-fronts note no longer blocks it, capped at medium.
 */
function wallOf(m: WallMeasure | undefined, word: {word: string; ref: string} | null, rs: Read[], oldRaw: string | null, apRef: string): WallColour {
  const blocked = rs.some(r => /scaffold|wrapped|netted|several fronts|two fronts|pand of|seam/i.test(r.note ?? ''));
  const w = word?.word ?? null;
  const fw = w ? finishWord(w) : null;
  const base: WallColour = {hex: null, rawHex: null, gain: null, word: w, ref: word?.ref ?? null, finish: fw, finishFrom: fw ? 'read' : null, source: null, confidence: 'low'};
  const traced = m?.sample === 'traced-wall';
  if (!m?.hex || (blocked && !traced)) return {...base, ref: blocked ? `${base.ref ?? 'reads'}: not measured (scaffolded, seam or several fronts)` : base.ref};
  const L = m.L ?? 0;
  const [, a, b] = hexToOklab(m.hex), C = Math.hypot(a, b);
  const head = w?.split(',')[0] ?? null; // the wall itself; later clauses name trims
  const agrees = head === null ? null
    : (/white|grey|gray/i.test(head) && C >= 0.05) || (/brown|red/i.test(head) && !PALE.test(head) && L >= 0.6) ? false
    : PALE.test(head) ? L >= 0.5 : DARK.test(head) ? L < 0.55 : true;
  const capped = blocked && agrees === true;
  const finish = fw ?? m.finishGuess;
  const ref = `${WALLS} (lane WC exposure (c) on the strip, raw ${m.rawHex}, gain ${m.gain}${oldRaw ? `; auto-place raw ${oldRaw} in ${apRef}` : ''})`;
  return {hex: m.hex, rawHex: m.rawHex, gain: m.gain, word: w, ref, finish, finishFrom: fw ? 'read' : finish ? 'lightness' : null,
    source: agrees === true ? 'reviewed' : 'strip-measured', confidence: agrees === true && !capped ? 'high' : agrees === null || capped ? 'medium' : 'low'};
}

function expandRef(ref: string, refs: Record<string, string>) {
  const m = ref.match(/^([a-z +]+):\s*(.*)$/);
  if (!m) return ref;
  const files = m[1].split('+').map(s => s.trim()).map(k => refs[k] ?? k);
  return `${files.join(' + ')}: ${m[2]}`;
}

/** Spec heights stand on the pand's own ground: `lift` (pand ground - street ground) moves them to the street datum. */
function specConflicts(spec: any, ref: string, m: {frontTopM: number | null; storeys: number | null; bays: number | null; family: CrownFamily | null; rows: Row[]; bagEaves: number | null; lift: number}, out: Conflict[]) {
  const f = spec.design?.fronts?.[0] ?? {};
  const eaves: number | null = typeof f.eavesHeight === 'number' ? r2(f.eavesHeight + m.lift) : null;
  const add = (field: string, kept: unknown, other: unknown, note: string) => out.push({field, kept: {value: kept, ref: 'this record'}, other: {value: other, ref}, note});
  if (m.storeys !== null && typeof f.storeys === 'number' && f.storeys !== m.storeys) add('storeys', m.storeys, f.storeys, 'hand spec storey count differs from the strip');
  const sb = Array.isArray(f.bays) ? f.bays[1] ?? f.bays[0] : f.bays;
  if (m.bays !== null && typeof sb === 'number' && sb !== m.bays) add('bays', m.bays, f.bays, 'hand spec bays differ from the first upper storey on the strip');
  const sf = typeof f.gable === 'string' ? GABLE_FAMILY[f.gable] ?? 'other' : null;
  if (m.family !== null && sf !== null && sf !== m.family) add('crown.family', m.family, f.gable, 'hand spec gable differs from the strip read');
  // The wall top the spec draws, in the street datum: eavesHeight over the pand's ground, else the 3DBAG front eaves.
  const wallTop: number | null = eaves ?? m.bagEaves;
  if (m.frontTopM !== null && eaves !== null && Math.abs(eaves - m.frontTopM) > 0.3)
    add('frontTopM', m.frontTopM, eaves, `hand spec eavesHeight ${f.eavesHeight} m over the pand's ground puts the front top ${r2(eaves - m.frontTopM)} m off (the pins were copied without the ground difference)`);
  if (m.frontTopM !== null && eaves === null && m.bagEaves !== null && Math.abs(m.bagEaves - m.frontTopM) > 0.5)
    add('frontTopM', m.frontTopM, m.bagEaves, 'hand spec has no eavesHeight, so its wall stands on the 3DBAG front eaves');
  // The spec's own window rows: storeyHeights are weights over the wall top, headLines and windowHeights shares of each storey.
  const sh: number[] | undefined = f.storeyHeights, wh = f.windowHeights, hl: number[] | undefined = f.headLines;
  if (wallTop !== null && Array.isArray(sh) && Array.isArray(wh) && Array.isArray(hl) && m.rows.length && sh.length === f.storeys) {
    const tot = sh.reduce((a, b) => a + b, 0); let z = m.lift; const specRows: Row[] = []; const wall = wallTop - m.lift;
    sh.forEach((w, i) => { const hgt = w / tot * wall, head = z + hl[i] * hgt; if (i > 0) specRows.push({sillM: r2(head - wh[i] * hgt), headM: r2(head)}); z += hgt; });
    const n = Math.min(specRows.length, m.rows.length);
    const off = n ? Math.max(...m.rows.slice(0, n).map((r, i) => Math.max(Math.abs(r.sillM - specRows[i].sillM), Math.abs(r.headM - specRows[i].headM)))) : 0;
    if (specRows.length !== m.rows.length || off > TOL) add('rows', m.rows, specRows, `hand spec rows (storeyHeights x ${r2(wallTop)} m wall, headLines, windowHeights) ${specRows.length !== m.rows.length ? `count ${specRows.length} upper rows against ${m.rows.length}` : `sit up to ${r2(off)} m off`}`);
  }
}

const args = process.argv.slice(2);
const table = build();
const problems = frontTableProblems(table);
const text = JSON.stringify(table, null, 1) + '\n';
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : OUT;
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
if (args.includes('--check')) {
  const cur = fs.readFileSync(path.join(ROOT, OUT), 'utf8');
  if (cur !== text) { console.error(`${OUT} is stale: run node --import tsx scripts/front-records/build-haarlemmerdijk-block.ts`); process.exit(1); }
  console.log(`${OUT} up to date (${table.records.length} records)`);
} else {
  fs.writeFileSync(path.join(ROOT, out), text);
  const by = (k: (r: FrontRecord) => string) => table.records.reduce((a, r) => (a[k(r)] = (a[k(r)] ?? 0) + 1, a), {} as Record<string, number>);
  console.log(`${out}: ${table.records.length} records`);
  console.log('confidence', by(r => r.confidence));
  console.log('crown', by(r => r.crown.family ?? 'null'));
  console.log('nothingLocal', table.records.filter(r => r.nothingLocal).length, 'fallback', table.records.filter(r => r.fallback).length, 'with conflicts', table.records.filter(r => r.conflicts.length).length);
}
