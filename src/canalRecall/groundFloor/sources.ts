// Adapters: each source's ground-floor facts as a GroundFloorPart (types.ts), for the merge (merge.ts). Every adapter
// states only what its source states; nothing is guessed to fill a field.
import type { StorefrontSpec } from '../storefronts.js';
import type { GroundFrontIntent } from '../buildingRecipe/intent.js';
import { groundHead, type DescriberAnswer } from '../houseSpec/describer.js';
import { isHex, piersBetween, type GfHead, type GfOpening, type GfOpeningKind, type GroundFloorPart } from './types.js';

const DOOR_HEAD_M = 2.4;

/** A hand storefront spec (storefrontSpecs.ts): its `bays` over `span` (metres along a front `frontM` long) as openings;
 *  `P`/`B` bays are piers, `W` shop windows, `D`/`C`/`d` doors, `O` a passage. Null without bays or span. */
export function fromStorefrontSpec(spec: StorefrontSpec, frontM: number, ref?: string): GroundFloorPart | null {
  if (!spec.bays || spec.bays === 'none' || !spec.span || !(frontM > 0)) return null;
  const [s0, s1] = spec.span, tokens = spec.bays.trim().split(/\s+/).map(t => { const [k, w] = t.split(':'); return { k, w: w ? Number(w) : undefined }; });
  const fixed = tokens.reduce((s, t) => s + (t.w ?? 0), 0), free = tokens.filter(t => t.w === undefined).length;
  const each = free ? Math.max(0, (s1 - s0 - fixed) / free) : 0;
  const top = spec.heightM ?? 4, head: GfHead = spec.windows === 'arched' ? 'round' : 'flat';
  const openings: GfOpening[] = [];
  let x = s0;
  for (const t of tokens) {
    const w = t.w ?? each, a0 = Math.max(0, x / frontM), a1 = Math.min(1, (x + w) / frontM);
    x += w;
    const kind: GfOpeningKind | null = t.k === 'W' ? 'shop' : t.k === 'D' || t.k === 'C' || t.k === 'd' ? 'door' : t.k === 'O' ? 'passage' : null;
    if (!kind || a1 - a0 < 0.02) continue;
    const headM = kind === 'door' ? Math.min(top - 0.4, Math.max(DOOR_HEAD_M, top - 1.0)) : top - 0.5;
    openings.push({ a0, a1, sillM: kind === 'shop' ? 0.5 : 0, headM, head: kind === 'shop' ? head : 'flat', kind });
  }
  if (!openings.length) return null;
  const wall = spec.wall && isHex(spec.wall) ? spec.wall.toLowerCase() : undefined;
  return {
    source: 'hand', confidence: 0.9, ...(ref ? { ref } : {}),
    openings, piers: piersBetween(openings, spec.pilaster ? 'stucco' : 'timber'),
    ...(spec.plinth && isHex(spec.plinth) ? { plinth: { kind: 'stone-band' as const, heightM: 0.4 } } : {}),
    ...(wall ? { groundFinish: { material: 'painted-pui' as const, hex: wall } } : {}),
    fascia: spec.fascia === false ? { kind: 'none' } : { kind: 'band', heightM: spec.fasciaH ?? 0.6, ...(typeof spec.fascia === 'string' && isHex(spec.fascia) ? { hex: spec.fascia.toLowerCase() } : {}) },
    sign: { kind: spec.archSign ? 'board-in-opening' : spec.fascia === false ? (spec.signs?.length ? 'wall-letters' : 'none') : 'fascia' },
    ...(spec.heightM ? { groundTopM: spec.heightM } : {}),
  };
}

/** A recipe's ground front (buildingRecipe/intent.ts GroundFrontIntent): its bays as openings over the whole front, with
 *  `bayWeights` as their widths; an arcade's bays are round-headed passages, a pui's glazed. */
export function fromGroundFront(g: GroundFrontIntent, groundM: number, ref?: string): GroundFloorPart | null {
  if (!g.bays.length) return null;
  const weights = g.bayWeights?.length === g.bays.length ? g.bayWeights : g.bays.map(() => 1), sum = weights.reduce((s, w) => s + w, 0);
  const pier = 0.06, openings: GfOpening[] = [];
  let x = 0;
  g.bays.forEach((bay, i) => {
    const w = weights[i] / sum, a0 = x + pier * w, a1 = x + w - pier * w;
    x += w;
    if (bay === 'blank' || bay === 'panel') return;
    const kind: GfOpeningKind = bay === 'door' || bay === 'glazed-door' ? 'door' : g.kind === 'arcade' ? 'passage' : 'shop';
    openings.push({ a0, a1, sillM: kind === 'shop' ? 0.4 : 0, headM: kind === 'door' ? Math.min(groundM - 0.3, DOOR_HEAD_M + 0.4) : groundM - 0.35, head: g.kind === 'arcade' ? 'round' : 'flat', kind });
  });
  return openings.length ? { source: 'recipe', confidence: 0.8, ...(ref ? { ref } : {}), openings, piers: piersBetween(openings, g.kind === 'pui' ? 'timber' : 'brick'), groundTopM: groundM } : null;
}

/** The describer's ground row (prompt v4.3): `heads[0]` (the ground openings' head, kept by groundHead), `groundBays` or
 *  `columns[0]` openings, `doorIndex` the door among them, `ground` shopfront or not. Equal openings: the describer
 *  states counts, not widths, so its geometry is weak (confidence 0.35) and any photo read outranks it. */
export function fromDescriber(a: DescriberAnswer, groundM = 3.2): GroundFloorPart | null {
  if (!a.readable) return null;
  const n = a.groundBays ?? a.columns?.[0];
  if (!Number.isInteger(n) || !n || n > 12) return null;
  const head = groundHead(a.heads), shop = a.ground === 'shopfront';
  const gh: GfHead = head === 'segmental' || head === 'round' ? head : head === 'pointed' ? 'round' : 'flat';
  const w = 1 / n, pier = Math.min(0.12, 0.25 * w), openings: GfOpening[] = [];
  for (let i = 0; i < n; i++) {
    const door = a.doorIndex === i;
    openings.push({ a0: i * w + pier / 2, a1: (i + 1) * w - pier / 2, sillM: door || shop ? 0 : 0.8, headM: door ? DOOR_HEAD_M + (gh === 'flat' ? 0 : 0.3) : groundM - 0.5, head: gh, kind: door ? 'door' : shop ? 'shop' : 'window' });
  }
  return { source: 'describer', confidence: 0.35, ref: a.image.ref, openings };
}

/** Monument register facts: the ground storey's finish and base where the description names them (Dutch register text:
 *  "hardstenen plint", "rustica"/"bossage", "natuurstenen onderpui"). States no openings, so it never makes a record. */
export function fromRegisterText(text: string, ref?: string): GroundFloorPart | null {
  const t = text.toLowerCase(), part: GroundFloorPart = { source: 'register', confidence: 0.5, ...(ref ? { ref } : {}) };
  if (/rustica|bossage|geblokt/.test(t)) part.plinth = { kind: 'rusticated', heightM: 0.6 };
  else if (/(hard|natuur)stenen?\s+(plint|onderbouw|sokkel)/.test(t)) part.plinth = { kind: 'stone-band', heightM: 0.45 };
  if (/(natuur|zand|hard)stenen?\s+(onderpui|benedenpui|begane grond)/.test(t)) part.groundFinish = { material: 'stone' };
  return part.plinth || part.groundFinish ? part : null;
}
