/**
 * Lane 1 (Haarlemmerdijk renderer, 2026-11-13): the ordinary generic house drawn from its front record, behind ONE flag
 * (`?rowFront=1`, ROW_FRONT=1 in Node), only for pands that carry a record (the block's list).
 *
 * Step a, front height: the street wall rises to the record's measured cornice top or gable foot, above or below 3DBAG
 *   (house-line.md "Not wired" item 1: Haarlemmerdijk 18 drew 7.94 m against an 11.0 m measured cornice).
 * Step b, roof from the front: a cornice front has a flat lid at its top (no roof face over the cornice, #87); a gabled
 *   front gets the planner's saddle with its eaves at the measured foot, the gable profile in front of it.
 *
 * The record type meets lane 2's front records (`src/canalRecall/houseLine/frontRecord.ts`, `data/front-records/`):
 * `rowFrontFromRecord` is the one adapter. Flag off, or no record: the same feature object back (byte-identical).
 */
import { interimBoxes } from './boxPlacement.js';
import { GABLE_SHAPES, roofPlanForFeature, type GableShape } from '../roofMesh.js';
import { heightAbovePandGround, type FrontRecord, type FrontRecordTable } from './frontRecord.js';
import { hexToOklab, oklabToHex, paleWarmHeld } from '../houseSpec/wallColour.js';
import { ROW_CROWN_SHAPES, rowCrownRoofRise, type RowCrown, type RowCrownShape } from './crownProfile.js';

export type RowCrownFamily = 'cornice' | 'neck' | 'bell' | 'point' | 'step' | 'spout' | 'raised-cornice-dormer';
export interface RowFrontRecord {
  pandId: string;
  face?: string;
  /** The front's highest line above its ground (m): a cornice top, or a gable's apex. */
  topM: number | null;
  /** Where the crown starts (m): a cornice front's top (= topM), a gable's foot. */
  eavesM: number | null;
  crown: { family: RowCrownFamily; riseM?: number; widthM?: number; neckWidthM?: number; atticWindows?: number; hoist?: boolean;
    /** A raised centre piece on a cornice front (lane 2's dormer or raised attic): its top (pand datum), kind and width. */
    piece?: { topM: number; kind: string; widthM?: number } };
  /** Storey lines above the ground (m), from measured window heights or stated storey heights. */
  rowLines?: number[];
  /** Measured upper window rows (sill, head) and the ground storey's top, above the pand's own ground (m). */
  rows?: Array<{ sillM: number; headM: number }>;
  groundTopM?: number;
  /** Window axes on the first upper storey (lane 2 `bays`). */
  bays?: number;
  /** Lane 2's wall colour (exposure taken out), its source and finish; absent = no hex (blocked or unread). */
  wall?: { hex: string; source: 'reviewed' | 'strip-measured'; finish?: string };
  storeys?: number;
  confidence: number;
  /** Low confidence: the row line from measured neighbours and a plain cornice. */
  fallback?: 'row-line';
  /** A fallback front whose crown is the skyline's gable (skylineGable), not a plain cornice. */
  crownFromSkyline?: true;
  skyline?: Record<string, number | null>;
  sources: Record<string, string>;
}

export const ROW_FRONT_DEFAULT = false;
/**
 * Step e, subtract before adding: the only wall extras a front record's house draws unless a register or spec states
 * more. Gone: flower boxes, iron and Juliet balconies, corner pilasters and pale masonry quoins, cornice vases (the roof
 * finials), door canopies, 3D shutters, shop canopies, stucco hoods, floor cornices; the Haarlemmerdijk strips show none.
 */
export const ROW_FRONT_EXTRAS: readonly string[] = ['window-sills', 'white-window-frames', 'door-surround', 'wall-anchors', 'plinth', 'downpipe'];
/** A record house's shopfront paint (sign, fascia, awning accent): the photo's shopfronts are dark and muted. */
export const ROW_FRONT_SHOP_HEX = '#2e2b29';
export function rowFrontEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]rowFront=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? ROW_FRONT_DEFAULT : v === '1';
}
let flagNow: boolean | undefined;
export function rowFrontOn(): boolean {
  if (flagNow !== undefined) return flagNow;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (flagNow = rowFrontEnabled(g.location?.search ?? null, g.process?.env?.ROW_FRONT ?? null));
}
/** Tests and harnesses: forget the cached flag. */
export const resetRowFront = () => { flagNow = undefined; };

/** Lane 2 crown family -> this renderer's family; a flat parapet, an unplaced crown and no read draw a plain cornice. */
const LANE2_FAMILY: Readonly<Record<string, RowCrownFamily>> = {
  neck: 'neck', bell: 'bell', step: 'step', spout: 'spout', point: 'point', 'straight-cornice': 'cornice', 'flat-parapet': 'cornice',
  'raised-dormer-hoist': 'raised-cornice-dormer', other: 'cornice',
};
const CONFIDENCE = { high: 0.9, medium: 0.7, low: 0.3 } as const;
const r2 = (v: number) => Math.round(v * 100) / 100;
/**
 * Lane 2's datum: every height is above the face's street ground (`streetGroundNAP`); the renderer's is the pand's own
 * 3DBAG ground. On the dijk the two differ by up to 1.9 m between neighbours. Pand height = value + street - ground.
 */
export const toPandDatum = (r: Pick<FrontRecord, 'streetGroundNAP' | 'groundNAP'>, value: number): number => heightAbovePandGround(r, value);

/**
 * The one adapter from lane 2's front record to this renderer's record. A record without a measured front top
 * (`fallback: 'row-line'`) takes the row line: the median front top of its measured neighbours on the same face (two
 * either side, in the table's street order), in the street datum, then moved to its own ground; with no measured
 * neighbour, `interim` (lane 1's skyline read) if given; else the record keeps a null top and the house its 3DBAG wall.
 */
export function rowFrontFromRecord(fr: FrontRecord, neighbours: readonly FrontRecord[] = [], interim?: RowFrontRecord | null): RowFrontRecord {
  const at = (v: number | null) => v === null ? null : toPandDatum(fr, v);
  const sources: Record<string, string> = { record: `front-records ${fr.face} ${fr.confidence}` };
  const family: RowCrownFamily = fr.fallback ? 'cornice' : LANE2_FAMILY[fr.crown.family ?? 'other'];
  let eavesM = at(fr.frontTopM), topM: number | null = null;
  if (eavesM !== null) sources.eaves = `front record ${fr.frontTopKind}`;
  else {
    const near = neighbours.filter(n => n.pandId !== fr.pandId && n.face === fr.face && !n.fallback && n.frontTopM !== null).map(n => n.frontTopM!).sort((a, b) => a - b);
    if (near.length) { eavesM = at(near[Math.floor(near.length / 2)]); sources.eaves = `row line (median of ${near.length} measured neighbours, street datum)`; }
    else if (interim?.eavesM != null) { eavesM = interim.eavesM; sources.eaves = `interim ${interim.sources.eaves ?? 'skyline'}`; }
  }
  const gabled = family !== 'cornice' && family !== 'raised-cornice-dormer';
  if (gabled && eavesM !== null) topM = at(fr.crown.topM) ?? r2(eavesM + 1.5);
  else topM = eavesM;
  const crown: RowFrontRecord['crown'] = { family };
  if (gabled && topM !== null && eavesM !== null) crown.riseM = r2(topM - eavesM);
  if (gabled && fr.crown.widthM !== null) crown.widthM = fr.crown.widthM;
  if (gabled && fr.crown.neckWidthM !== null) crown.neckWidthM = fr.crown.neckWidthM;
  // A cornice front's raised centre: a crowned, lantern, pediment or box dormer (or a raised attic) standing on the
  // cornice, 0.4 to 4 m over it. Not a set-back dormer (behind the cornice) nor a mansard face.
  const pieceTop = fr.crown.dormer?.topM ?? fr.crown.topM;
  if (!gabled && !fr.fallback && fr.frontTopM !== null && pieceTop !== null && pieceTop - fr.frontTopM >= 0.4 && pieceTop - fr.frontTopM <= 4
    && fr.crown.dormer?.kind !== 'set-back' && !/mansard/i.test(fr.crown.note ?? '')) {
    crown.piece = { topM: at(pieceTop)!, kind: fr.crown.dormer?.kind ?? 'raised', ...(fr.crown.widthM ?? fr.crown.neckWidthM ? { widthM: (fr.crown.widthM ?? fr.crown.neckWidthM)! } : {}) };
  }
  if (fr.crown.atticWindows !== null) crown.atticWindows = fr.crown.atticWindows;
  if (fr.crown.hoist !== null) crown.hoist = fr.crown.hoist;
  const out: RowFrontRecord = { pandId: fr.pandId, face: fr.face, topM, eavesM, crown, confidence: CONFIDENCE[fr.confidence], sources };
  if (fr.storeys !== null && !fr.fallback) out.storeys = fr.storeys;
  if (fr.rows.length && !fr.fallback) out.rows = fr.rows.map(r => ({ sillM: at(r.sillM)!, headM: at(r.headM)! }));
  if (fr.bays !== null && !fr.fallback) out.bays = fr.bays;
  if (fr.groundStoreyTopM !== null && !fr.fallback) out.groundTopM = at(fr.groundStoreyTopM)!;
  if (fr.wall?.hex && fr.wall.source) out.wall = { hex: fr.wall.hex, source: fr.wall.source, ...(fr.wall.finish ? { finish: fr.wall.finish } : {}) };
  if (fr.fallback) out.fallback = 'row-line';
  // A fallback keeps lane 1's skyline read: a gable standing over the row line still draws (skylineGable).
  if (fr.fallback && interim?.skyline) out.skyline = interim.skyline;
  return out;
}

/** Every record of a lane 2 table through the adapter; `interim` fills only where the table has no height at all. */
export function rowFrontsFromTable(table: Pick<FrontRecordTable, 'records'>, interim: readonly RowFrontRecord[] = []): RowFrontRecord[] {
  const byPand = new Map(interim.map(r => [key(r.pandId), r]));
  return table.records.map((fr, i) => {
    const sameFace = table.records.filter((n, j) => n.face === fr.face && Math.abs(j - i) <= 2);
    return rowFrontFromRecord(fr, sameFace, byPand.get(key(fr.pandId)));
  });
}
/** A records file: lane 2's table (records carry `streetGroundNAP`) or lane 1's interim list. */
export function rowFrontsFromFile(json: { records?: unknown[] }, interim: readonly RowFrontRecord[] = []): RowFrontRecord[] {
  const list = (json.records ?? []) as Array<Record<string, unknown>>;
  return list.length && typeof list[0].streetGroundNAP === 'number' ? rowFrontsFromTable(json as FrontRecordTable, interim) : list as unknown as RowFrontRecord[];
}

const records = new Map<string, RowFrontRecord>();
const key = (id: string) => String(id).replace(/^NL\.IMBAG\.Pand\./, '').slice(-16);
/** Install the block's records (Node: scripts/world/pipeline.ts from ROW_FRONT_RECORDS; tests directly). */
export function setRowFrontRecords(list: readonly RowFrontRecord[]): void { records.clear(); for (const r of list) records.set(key(r.pandId), r); }
export function rowFrontFor(id: unknown): RowFrontRecord | null { return typeof id === 'string' || typeof id === 'number' ? records.get(key(String(id))) ?? null : null; }

/** Crown family -> the roof planner's gable profile. */
export const FAMILY_GABLE: Readonly<Record<RowCrownFamily, GableShape | null>> = {
  cornice: null, 'raised-cornice-dormer': null, neck: 'neck', bell: 'bell', point: 'plain', step: 'step', spout: 'spout',
};
/** The lowest front the planner roofs (planBuildingRoof refuses under 6.5 m); a record below it keeps a flat lid. */
const MIN_PLANNED_M = 6.5;

type Feature = { type?: string; properties: Record<string, unknown>; geometry: unknown };

/**
 * The record's wall as measured (exposure-corrected, no display lift). A `reviewed` wall (a strip
 * measurement a read checked against the photo) skips the pale-warm guard, as `reviewedWallSource` does; a
 * `strip-measured` one goes through it and is held (null: today's wall) when it trips. Plaster and stucco are renders.
 */
export function recordWall(rec: RowFrontRecord): string | null {
  const w = rec.wall;
  if (!w || !/^#[0-9a-f]{6}$/i.test(w.hex)) return null;
  // Lane 2's hex already has the capture's exposure taken out (lane WC option c): no second lift (the spec display's
  // lift drew 167816 at L 0.40 for a 0.36 reading and 176101 at 0.62 for 0.53).
  const drawn = w.hex.toLowerCase();
  if (w.source === 'reviewed') return drawn;
  const render = w.finish === 'plaster';
  return paleWarmHeld(drawn, { render, readingL: hexToOklab(w.hex)[0] }) ? null : drawn;
}

/** The measured windows' height as a share of their storey (sill-to-sill pitch; the top row's storey runs to the wall top). */
export function windowShare(rec: RowFrontRecord, eavesM: number): number | null {
  const rows = rec.rows ?? [];
  if (!rows.length) return null;
  const shares = rows.map((r, i) => { const next = rows[i + 1]?.sillM ?? Math.min(eavesM, r.headM + (r.sillM - (rows[i - 1]?.headM ?? rec.groundTopM ?? r.sillM - 0.6))); return (r.headM - r.sillM) / Math.max(0.5, next - r.sillM); });
  const v = shares.reduce((a, b) => a + b, 0) / shares.length;
  return Number.isFinite(v) && v > 0.3 && v < 0.95 ? Math.round(v * 100) / 100 : null;
}

/**
 * Step d, levels: a measured record's storey count is drawn exactly (`storeysFit`), its ground storey at the measured
 * shop or fascia top, and its rows up to the wall top: the cornice's, or a gable's foot, so the roof storey is the gable's
 * light and never a full row (`roofStorey` dropped). A type preset's count (haarlemmer-shop-cornice-*) gives way, and so
 * does the structure prior (it only runs without a stated count). A row-line record keeps today's count.
 */
/** Interim window width as a share of the bay (coordinator: about 60-70 %). */
export const ROW_FRONT_WINDOW_SHARE = 0.64;

export function levels(sr: Record<string, unknown> | null, rec: RowFrontRecord, eavesM: number, corniceCrown: boolean): { specRecipe?: Record<string, unknown> } {
  const measured = !rec.fallback && rec.storeys !== undefined && rec.storeys >= 1, wallHex = recordWall(rec);
  if (!sr && !measured && !wallHex) return {};
  const out: Record<string, unknown> = { ...(sr ?? {}), eavesM, ...(corniceCrown ? { corniceCrown: true } : {}) };
  if (wallHex) { out.wallHex = wallHex; delete out.heldBrick; }
  if (measured) {
    out.storeys = rec.storeys; out.storeysFit = true; out.storeysSrc = 'front-record';
    delete out.roofStorey; delete out.souterrain;
    if (rec.bays) out.bays = rec.bays;
    const h = windowShare(rec, eavesM);
    if (h !== null) out.windowH = h;
    // Step d (option c): the boxes the mesher places cells on. Interim: each measured row x the bay count, centred in
    // its bay at ROW_FRONT_WINDOW_SHARE of it (fractions of the front); lane 2's traced boxes replace these.
    if (rec.rows?.length && rec.bays) out.windowBoxes = interimBoxes(rec.rows, rec.bays, 1, ROW_FRONT_WINDOW_SHARE);
    if (rec.groundTopM !== undefined && rec.groundTopM > 2.4 && rec.groundTopM < eavesM - 2) out.groundM = rec.groundTopM; else delete out.groundM;
  }
  return { specRecipe: out };
}

/** How far a photo's shopfront colour is muted for the fascia: chroma kept, lightness cap. */
export const ROW_FRONT_SHOP_MUTE = { chroma: 0.55, maxL: 0.82 } as const;

/**
 * The shopfront band's colour on a record's front: the photo's own shopfront colour (the HouseSpec's `shopHex`, read
 * from the ground-floor band) muted, so the row keeps its variety without the saturated brand paint; without one, the
 * plain dark band.
 */
export function rowFrontShopHex(photoHex: unknown): string {
  if (typeof photoHex !== 'string' || !/^#[0-9a-f]{6}$/i.test(photoHex)) return ROW_FRONT_SHOP_HEX;
  const [L, a, b] = hexToOklab(photoHex);
  return oklabToHex([Math.min(L, ROW_FRONT_SHOP_MUTE.maxL), a * ROW_FRONT_SHOP_MUTE.chroma, b * ROW_FRONT_SHOP_MUTE.chroma]);
}

/** Skyline gable thresholds: a peak this far over the front top, over this share of the front's width. */
export const SKYLINE_GABLE = { riseM: 1.5, share: 0.4 } as const;

/**
 * A low-confidence front (no strip read: seam, scaffold) whose skyline still shows a gable standing over the row line
 * (167820, Haarlemmerdijk 26: peak 2.2 m over the front top across 60 % of it) draws a neck gable from the skyline's
 * foot to its peak instead of a flat cornice. Its levels stay on the grid (it is still a fallback).
 */
export function skylineGable(rec: RowFrontRecord): RowFrontRecord | null {
  const sk = rec.skyline, peak = sk?.peakM, foot = sk?.footM ?? sk?.frontTopM, top = sk?.frontTopM, share = sk?.crownShare;
  if (!rec.fallback || peak == null || foot == null || top == null || share == null) return null;
  if (!(peak - top >= SKYLINE_GABLE.riseM && share >= SKYLINE_GABLE.share)) return null;
  return { ...rec, eavesM: foot, topM: peak, crown: { family: 'neck' }, crownFromSkyline: true };
}

/**
 * Decorator step after withHouseSpecCrown, before decorateRoof (galleryPipeline.ts). Applies steps a and b to a pand
 * with a record when the flag is on; otherwise returns the same object.
 */
export function withRowFront<T extends Feature>(feature: T): T {
  if (!rowFrontOn()) return feature;
  const found = rowFrontFor(feature.properties.id);
  const rec = found && skylineGable(found) || found;
  if (!rec || rec.eavesM === null || !(rec.eavesM > 2)) return feature;
  const p = feature.properties;
  const family: RowCrownFamily = rec.fallback && !rec.crownFromSkyline ? 'cornice' : rec.crown.family;
  const gable = FAMILY_GABLE[family];
  const { monumentGable, roofShapeTag: _tag, ...rest } = p;
  const held = typeof monumentGable === 'string' ? { historicGable: monumentGable } : {};
  const sr = p.specRecipe && typeof p.specRecipe === 'object' ? p.specRecipe as Record<string, unknown> : null;
  const piece = !rec.fallback && (family === 'cornice' || family === 'raised-cornice-dormer') ? rec.crown.piece : undefined;
  if (piece && rec.topM !== null && rec.eavesM >= MIN_PLANNED_M + 0.5) {
    // Step c, cornice with a raised centre (HD22, HD12, HD6): a gable plate that is a full-width cornice band with the
    // piece standing on it, a low saddle hidden behind the band. The wall stops a band under the measured top.
    const band = 0.5, eaves = +(rec.eavesM - band).toFixed(2);
    const crown: RowCrown = { shape: 'raised', riseM: +(piece.topM - eaves).toFixed(2), bandM: band,
      cap: piece.kind === 'pediment' ? 'pediment' : piece.kind === 'box' ? 'flat' : 'segmental' };
    if (piece.widthM) crown.neckW = piece.widthM;
    if (rec.crown.atticWindows !== undefined) crown.attic = rec.crown.atticWindows;
    if (rec.crown.hoist) crown.hoist = true;
    const ptrial = (h: number) => roofPlanForFeature({ ...feature, properties: { ...rest, height: h, monumentGable: 'cornice', roofPlanned: true } } as never);
    const probe = ptrial(eaves + 3), W = probe?.pieces?.[0]?.rect.wid;
    if (probe && W) {
      const R = rowCrownRoofRise(crown, W), h = +(eaves + R).toFixed(3);
      if (ptrial(h)?.kind === 'gable') return { ...feature, properties: { ...rest, ...held, height: h, monumentGable: 'cornice', roofPlanned: true, roofShape: 'gable', roofEavesHeightM: eaves,
        rowFront: family, ...(rec.crown.hoist ? { rowFrontHoist: true } : {}), rowCrown: crown, rowCrownRoofRiseM: R, roofDormer: false, ...levels(sr, rec, eaves, true) } };
    }
  }
  if (!gable || rec.eavesM < MIN_PLANNED_M) {
    // A cornice (or a fallback) front: the wall to the measured top, a flat lid there, nothing over it from the street.
    const top = rec.topM ?? rec.eavesM;
    return { ...feature, properties: { ...rest, ...held, height: top, roofEavesHeightM: top, roofPlanned: false, roofShape: 'flat', rowFront: family,
      ...levels(sr, rec, top, true) } };
  }
  const trial = (h: number) => roofPlanForFeature({ ...feature, properties: { ...rest, height: h, monumentGable: gable, roofPlanned: true } } as never);
  // Step c: a crown the record sizes (neck, bell, point, step) is drawn from its own measured profile, the saddle
  // lowered inside it (houseLine/crownProfile.ts); the chimney stub and the dice dormers go.
  const shape = (family === 'point' ? 'point' : family) as RowCrownShape;
  if ((ROW_CROWN_SHAPES as readonly string[]).includes(shape) && rec.topM !== null && rec.topM - rec.eavesM > 0.5) {
    const crown: RowCrown = { shape, riseM: +(rec.topM - rec.eavesM).toFixed(2) };
    if (rec.crown.widthM) crown.footW = rec.crown.widthM;
    if (rec.crown.neckWidthM) crown.neckW = rec.crown.neckWidthM;
    if (rec.crown.atticWindows !== undefined) crown.attic = rec.crown.atticWindows;
    if (rec.crown.hoist) crown.hoist = true;
    const probe = trial(rec.eavesM + 3), W = probe?.pieces?.[0]?.rect.wid;
    if (probe && W) {
      const R = rowCrownRoofRise(crown, W), h = +(rec.eavesM + R).toFixed(3);
      const plan = trial(h);
      if (plan?.kind === 'gable') return { ...feature, properties: { ...rest, ...held, height: h, monumentGable: gable, roofPlanned: true, roofShape: 'gable', roofEavesHeightM: rec.eavesM,
        rowFront: family, ...(rec.crown.hoist ? { rowFrontHoist: true } : {}), rowCrown: crown, rowCrownRoofRiseM: R, roofDormer: false, ...levels(sr, rec, rec.eavesM, false) } };
    }
  }
  // A gabled front: the planner's saddle behind the record's gable, its eaves on the measured foot.
  let height = rec.topM ?? rec.eavesM + 3;
  let plan = trial(height);
  for (let i = 0; i < 3 && plan; i++) { const next = rec.eavesM + plan.riseM; if (Math.abs(next - height) < 0.01) break; height = next; plan = trial(height); }
  if (!plan || !(GABLE_SHAPES as readonly string[]).includes(gable)) return feature;
  return { ...feature, properties: { ...rest, ...held, height, monumentGable: gable, roofPlanned: true, roofShape: plan.kind, roofEavesHeightM: height - plan.riseM, rowFront: family,
    ...levels(sr, rec, rec.eavesM, false) } };
}
