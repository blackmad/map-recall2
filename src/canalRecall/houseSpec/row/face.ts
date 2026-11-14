/**
 * House rows: what a block-face intent states per house front, in the row vocabulary (lane D, #386). Pure.
 *
 * The face's per-house design comes through `fromBlockFace` (the type, its crown and palette, the house overrides,
 * modules as fronts), so this reads the spec design it returns plus the face record's measured eaves.
 */
import type { BlockFaceIntent } from '../../blockFace/intent.ts';
import type { HouseSpec } from '../spec.ts';
import type { FaceFront } from './solve.ts';
import type { RowCorniceKind, RowCrownKind, RowDormerKind, RowGround, RowHeads, RowWallMaterial, RowWindowKind } from './types.ts';
import type { JudgedFamily } from '../judgedColour.ts';

/** A face palette name -> the judged family (programme brief: the type palette or the reader's words). */
export const PALETTE_FAMILY: Readonly<Record<string, JudgedFamily>> = {
  'red-brown': 'red-brown-brick', red: 'orange-red-brick', 'orange-red': 'orange-red-brick', brown: 'brown-brick', 'dark-brown': 'purple-brown-brick',
  purple: 'purple-brown-brick', 'purple-brown': 'purple-brown-brick', buff: 'buff-brick', yellow: 'buff-brick', white: 'painted-white', cream: 'cream-render',
  grey: 'pale-grey-stucco', stucco: 'pale-grey-stucco', black: 'painted-dark', dark: 'painted-dark', sandstone: 'sandstone',
};
const CROWN: Record<string, RowCrownKind> = { cornice: 'cornice', flat: 'cornice', neck: 'neck', 'raised-neck': 'neck', shouldered: 'neck', bell: 'bell', point: 'point', step: 'step', spout: 'spout' };

/** A strip row (px from the top) as metres above the street ground: strip heightM is the top of the image. */
export const stripRowM = (strip: { heightM: number; pixelsPerMetre: number }, row: number) => Math.round((strip.heightM - row / strip.pixelsPerMetre) * 100) / 100;

/** Head dressing a face front states: a painted head band (the dotted white block course), keystones on flat heads, a
 *  segmental head with a stone tympanum. Undefined when the face states none (the type default is unstated). */
export function faceHeads(f: Record<string, any>): RowHeads | undefined {
  const wh = f.windowHead;
  if (wh?.kind === 'segmental' && wh.tympanum) return { shape: 'segmental', dressing: 'segmental-tympanum', ...(wh.storeys ? { storeys: wh.storeys } : {}) };
  if (wh?.archRing?.keystone) return { shape: wh.kind ?? 'flat', dressing: 'keystone', ...(wh.storeys ? { storeys: wh.storeys } : {}) };
  if (f.bands === 'painted' && (f.bandLines ?? []).includes('head')) return { shape: wh?.kind ?? 'flat', dressing: 'block-course' };
  if (f.windowSurround === 'jack-blocks') return { shape: wh?.kind ?? 'flat', dressing: 'jack-blocks' };
  if (f.windowSurround === 'dentil-lintel') return { shape: wh?.kind ?? 'flat', dressing: 'dentil-lintel' };
  if (wh?.kind === 'round' && wh.archRing) return { shape: 'round', dressing: 'arch-ring' };
  return undefined;
}

/**
 * The fronts a face states for one pand (a module pand gives one per module). `spec` is `fromBlockFace(face, pandId)`.
 * `strip` turns the measured eaves' strip rows into metres.
 */
export function faceFronts(face: BlockFaceIntent, pandId: string, spec: HouseSpec, strip?: { heightM: number; pixelsPerMetre: number } | null): FaceFront[] {
  const h = face.houses.find(x => x.pandId === pandId);
  if (!h) return [];
  const t = (h.type ?? {}) as Record<string, any>;
  const fronts = (spec.design.fronts ?? []) as Array<Record<string, any>>;
  const eaves = ((face.continuity as { measuredEaves?: Array<{ pand: string; front?: string; stripRow?: number; evidence?: string }> } | undefined)?.measuredEaves ?? []).filter(e => e.pand === pandId);
  const evidence = eaves.map(e => e.evidence ?? '').join(' ');
  const roofKind = /mansard/i.test(evidence) ? 'mansard' as const : undefined;
  const hf = h as unknown as { groundFloor?: { use?: string } };
  const sampled = t.measuredPalette?.brick as string | undefined;
  const limits = (h.rhythm as { schemaLimits?: string[] } | undefined)?.schemaLimits ?? [];
  return fronts.map((f, i) => {
    const e = eaves.find(x => x.front === f.id) ?? (fronts.length === 1 ? eaves[0] : undefined);
    const shop = f.shopfront as Record<string, any> | undefined;
    const use = hf.groundFloor?.use;
    const ground: RowGround = {
      use: shop ? (use === 'cafe' || use === 'restaurant' ? use : 'shop') : use === 'dwelling' ? 'dwelling' : 'other',
      ...(shop?.residentialDoor?.side ? { doorSide: shop.residentialDoor.side } : {}),
      ...(shop?.colour ? { shopPaint: String(shop.colour) } : {}),
      ...(f.basement ? { basement: f.basement === 'none' ? 'none' : 'souterrain' } : {}),
    };
    const out: FaceFront = {
      type: t.type,
      ...(f.gable ? { crown: CROWN[f.gable] } : {}),
      ...(f.cornice ? { cornice: f.cornice as RowCorniceKind } : {}),
      ...(f.storeys ? { storeys: f.storeys } : {}),
      ...(f.bays ? { bays: f.bays } : {}),
      ...(f.windows ? { windows: f.windows as RowWindowKind } : {}),
      ...(faceHeads(f) ? { heads: faceHeads(f)! } : {}),
      wallMaterial: (spec.design.palette?.wallMaterial as RowWallMaterial | undefined) ?? 'brick',
      ...(t.palette && PALETTE_FAMILY[t.palette] ? { wallFamily: PALETTE_FAMILY[t.palette] } : {}),
      ...(roofKind ? { roofKind } : {}),
      ...(spec.design.roof?.material ? { roofMaterial: spec.design.roof.material as 'slate' } : {}),
      dormers: f.dormers ?? 0,
      ...(f.dormerStyle ? { dormerKind: (f.dormerStyle === 'pediment' || f.dormerStyle === 'pointed' ? 'pediment' : 'plain') as RowDormerKind } : {}),
      ...(e?.stripRow !== undefined && strip ? { corniceTopM: stripRowM(strip, e.stripRow) } : {}),
      ground,
      ...(i === 0 && sampled ? { sampledHex: sampled } : {}),
      ...(i === 0 && limits.length ? { limits } : {}),
    };
    return out;
  });
}
