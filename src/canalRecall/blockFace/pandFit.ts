/**
 * Per-pand fit for canal-belt one-offs (Nieuwmarkt/Lastage pilot, 2026-11-10). The belt has few repeated rows, so a
 * library type per family places almost nothing (Jordaan 23 of 495, Rapenburg 2 of 7 after hand pins). Instead each pand
 * gets its own drafted house type from its own strip span: storey lines and window rows (typeDraft.ts storeyProfile), window
 * columns and width, the photo eaves, the crown kind from the register (monument-facts.json) or the skyline, the door side
 * read on the photo, the ground storey (white/shop pui or a house door), and the measured palette. The likeness and GLB
 * gates then decide install or hold, and a reviewer samples the sheets.
 *
 * Pure: no I/O. The strip reading is scripts/block-face/pand-fit.ts. Nothing here changes how an existing type compiles.
 */
import type {HouseTypeIntent, HousePlacement} from './houseType.ts';
import type {StoreyProfile} from './typeDraft.ts';

export const PAND_FIT = {
  /** Window-column count read on the photo is trusted from 1 to this; else bays by width. */
  maxBays: 6,
  /** A gap from the top window storey to the eaves over this is a frieze/cornice band (entablature), under it a simple cornice. */
  friezeFromM: 0.8,
  /** Ground band (m over the strip foot) where a white or glazed pui is read. */
  groundBandM: [0.4, 3.2] as [number, number],
  /** Light-accent share of the ground band over which the ground storey is a painted pui. */
  whiteGround: 0.35,
  /** Top-storey windows' gap under the eaves is at most this before the profile is distrusted (a roof storey the windows do not show). */
  maxTopGapM: 2.6,
  minWidthM: 3.0, maxWidthM: 9.0,
  /** Storey heights the photo rows may give before the reading is distrusted (merged or split window rows). */
  groundM: [2.4, 5.2] as [number, number],
  upperM: [2.3, 4.2] as [number, number],
} as const;

export type RegisterGable = 'cornice' | 'bell' | 'neck' | 'step' | 'plain' | 'spout' | null;

export interface PandFitInput {
  pandId: string;
  address: string;
  /** The face and strip date the measures come from (the type's evidence citation). */
  face: string;
  stripDate: string | null;
  widthM: number;
  /** 3DBAG/PDOK eaves (m). */
  eavesM: number;
  /** The photo eaves the strip skyline read under clean sky (null: unread). */
  skylineEavesM: number | null;
  /** The skyline crown over the eaves (null: none or unread). */
  crown: {widthM: number; riseM: number} | null;
  storey: StoreyProfile | null;
  windowCols: number | null;
  windowWidthM: number | null;
  palette: {wall: string | null; frame: string | null; stucco: boolean};
  /** Door side read on the photo's ground band (auto-place.ts doorSide). */
  doorSide: 'left' | 'right' | null;
  /** Share of light accent pixels in the ground band (PAND_FIT.groundBandM). */
  groundAccent: number;
  /** BAG/OSM ground use is trading (shop, horeca). */
  trading: boolean;
  /** Register gable (monument-facts.json `gable.key`), null when not a monument or not stated. */
  registerGable: RegisterGable;
}

export interface PandFitResult {
  /** The drafted type (inline in the face intent) and its placement, or null with the hold reason. */
  type: HouseTypeIntent | null;
  placement: HousePlacement | null;
  hold: string | null;
  /** Everything the draft measured or decided, for the CSV. */
  measured: Record<string, string | number | boolean | null>;
  /** The crown should be refined from the photo at compile time (continuity.crownFromPhoto). */
  crownFromPhoto: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The gable a pand is drafted with: the register when it states one, else the skyline's crown shape. */
export function gableFor(register: RegisterGable, crown: PandFitInput['crown'], widthM: number): {gable: 'cornice' | 'bell' | 'neck' | 'step' | 'flat' | 'spout'; source: string} {
  if (register === 'cornice' || register === 'bell' || register === 'neck' || register === 'step' || register === 'spout') return {gable: register, source: 'register'};
  if (register === 'plain') return {gable: 'cornice', source: 'register (plain front: drawn as a cornice line)'};
  if (crown && crown.riseM >= 1.5 && crown.widthM <= widthM * 0.85) return {gable: 'bell', source: `skyline crown ${r2(crown.riseM)} m over ${r2(crown.widthM)} m (no register gable)`};
  return {gable: 'cornice', source: crown ? `skyline crown ${r2(crown.riseM)} m read as a cornice` : 'no crown over the eaves'};
}

/** Bays: the photo's window columns when read and plausible for the width, else by width (2 under 4.6 m, 3 under 7.4 m, else 4). */
export function baysFor(windowCols: number | null, widthM: number): {bays: number; source: string} {
  const byWidth = widthM < 4.6 ? 2 : widthM < 7.4 ? 3 : 4;
  if (windowCols && windowCols >= 1 && windowCols <= PAND_FIT.maxBays && windowCols * 0.9 <= widthM) return {bays: windowCols, source: 'photo window columns'};
  return {bays: byWidth, source: `by width ${r2(widthM)} m (columns ${windowCols ?? 'unread'})`};
}

/** Draft one pand's own house type from its strip measures. */
export function draftPandType(i: PandFitInput, id = `pf-${i.pandId.slice(-6)}`): PandFitResult {
  const measured: PandFitResult['measured'] = {pand: i.pandId, address: i.address, widthM: r2(i.widthM), bagEavesM: r2(i.eavesM), skylineEavesM: i.skylineEavesM, doorSide: i.doorSide, groundAccent: r2(i.groundAccent), trading: i.trading, registerGable: i.registerGable};
  const hold = (why: string): PandFitResult => ({type: null, placement: null, hold: why, measured, crownFromPhoto: false});
  if (i.widthM < PAND_FIT.minWidthM || i.widthM > PAND_FIT.maxWidthM) return hold(`frontage ${r2(i.widthM)} m outside ${PAND_FIT.minWidthM}-${PAND_FIT.maxWidthM} m (one front per pand)`);
  const p = i.storey;
  if (!p) return hold('storey rows unread on the strip (no window contrast, trees or a blank front)');
  const g = gableFor(i.registerGable, i.crown, i.widthM);
  // The eaves the front is drawn to: the photo's line (a gable's foot, a cornice's top) when read, else 3DBAG.
  const eaves = i.skylineEavesM ?? i.eavesM;
  const upper = p.sillM.length, top = p.floorM[upper];
  const gap = eaves - top;
  if (gap < -0.3) return hold(`window rows reach ${r2(top)} m over the eaves ${r2(eaves)} m`);
  if (g.gable === 'cornice' && gap > PAND_FIT.maxTopGapM) return hold(`${r2(gap)} m of blank front over the top window storey (a roof storey or a misread eaves)`);
  // Storey heights: the ground storey to the first floor line, then floor to floor; the top storey to the top line.
  const heights = [p.floorM[0], ...p.floorM.slice(1).map((f, k) => f - p.floorM[k])].map(r2);
  if (heights[0] < PAND_FIT.groundM[0] || heights[0] > PAND_FIT.groundM[1]) return hold(`ground storey ${heights[0]} m outside ${PAND_FIT.groundM.join('-')} m (the first window row is not the first floor)`);
  const odd = heights.slice(1).find(h => h < PAND_FIT.upperM[0] || h > PAND_FIT.upperM[1]);
  if (odd !== undefined) return hold(`storey heights ${heights.join('/')} m: an upper storey outside ${PAND_FIT.upperM.join('-')} m (window rows merged or split)`);
  const windowHeights = [0.5], headLines = [0.85];
  for (let s = 0; s < upper; s++) {
    const H = heights[s + 1], h = clamp((p.headM[s] - p.sillM[s]) / H, 0.15, 0.9);
    let head = clamp((p.headM[s] - p.floorM[s]) / H, 0.4, 0.98);
    if (head - h < 0.04) head = Math.min(0.98, h + 0.05);
    windowHeights.push(r2(h)); headLines.push(r2(Math.max(head, h + 0.04)));
  }
  const b = baysFor(i.windowCols, i.widthM);
  const windowShare = r2(clamp(i.windowWidthM ? i.windowWidthM * b.bays / i.widthM : 0.5, 0.3, 0.8));
  const gabled = g.gable !== 'cornice' && g.gable !== 'flat';
  // Cornice fronts: a band over the top window storey deeper than PAND_FIT.friezeFromM is a white frieze (entablature).
  const entablature = !gabled && gap >= PAND_FIT.friezeFromM ? {rise: r2(clamp(gap, 0.4, 2.4)), cap: 0.35, frieze: 'trim' as const} : undefined;
  const storeys = upper + 1;
  const whiteGround = i.groundAccent >= PAND_FIT.whiteGround;
  const doorBay = i.doorSide === 'right' ? b.bays - 1 : 0;
  const groundBays = Math.max(2, Math.min(4, b.bays));
  const puiBays: ('door' | 'window')[] = Array.from({length: groundBays}, (_, k) => (i.doorSide === 'right' ? k === groundBays - 1 : k === 0) ? 'door' : 'window');
  const ground = whiteGround || i.trading
    ? {doorBay: null as number | null, basement: 'none' as const, groundFront: {kind: 'pui' as const, bays: puiBays, colour: whiteGround ? '#ece9e0' : (i.palette.frame ?? '#ece9e0'), evidence: `pand-fit: ground band accent ${Math.round(i.groundAccent * 100)} %${i.trading ? ', trading ground use' : ''}; door ${i.doorSide ?? 'unread (left)'}`}}
    : {doorBay, basement: 'none' as const};
  if (ground.groundFront) ground.doorBay = null;
  const crownVariant = gabled
    ? {gable: g.gable, atticWindows: 1, ...(i.crown ? {crownRise: r2(clamp(i.crown.riseM / heights[storeys - 1], 0.6, 2.2))} : {}), note: g.source}
    : {gable: 'cornice' as const, note: g.source};
  const brick = i.palette.wall ?? '#5a3d33';
  const frameLight = !!i.palette.frame && parseInt(i.palette.frame.slice(1, 3), 16) > 170;
  const type = {
    schemaVersion: 1, kind: 'house-type', id, description: `${i.address}: drafted per pand from its own strip span (pand-fit)`,
    body: {storeys, bays: b.bays, storeyHeights: heights, windows: 'sash', windowSurround: 'sill', windowHeights, headLines, windowShare,
      cornice: gabled ? 'none' : 'simple', ...(entablature ? {entablature} : {})},
    crowns: {main: crownVariant},
    grounds: {main: ground},
    palettes: {measured: {brick, frame: frameLight || !i.palette.frame ? 'white-painted' : i.palette.frame, door: '#26302a', stone: '#ebe8df', cornice: '#ebe8df', stoneMaterial: 'painted'}},
    roof: {material: 'red-tile', squareSaddle: true},
    rhythm: {bays: `${b.bays} (${b.source})`, windowsPerStorey: `upper: ${b.bays} per storey, ${upper} window storeys`, symmetry: 'per the strip', groundFloor: ground.groundFront ? 'pui' : `house door ${i.doorSide ?? 'left (unread)'}`,
      signage: i.trading ? 'per shop' : 'none', roofline: g.gable, photoRows: [1, ...Array(upper).fill(b.bays)]},
    evidence: [{face: i.face, pands: [i.pandId], citation: `strip ${i.stripDate ?? 'undated'}: pand-fit storey lines ${p.floorM.join('/')} m, sills ${p.sillM.join('/')} m, ${b.bays} bays (${b.source}), ${g.source}, door ${i.doorSide ?? 'unread'}, ground accent ${Math.round(i.groundAccent * 100)} %`}],
  } as unknown as HouseTypeIntent;
  Object.assign(measured, {storeys, heights: heights.join('/'), sills: p.sillM.join('/'), heads: p.headM.join('/'), bays: b.bays, baysSource: b.source, windowShare, gable: g.gable, gableSource: g.source,
    eavesDrawnM: r2(eaves), frieze: entablature ? entablature.rise : null, ground: ground.groundFront ? 'pui' : 'door', brick, frame: i.palette.frame});
  return {type, placement: {type: id}, hold: null, measured, crownFromPhoto: gabled};
}
