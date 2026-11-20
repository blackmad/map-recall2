/**
 * Belt review render adapter (plan R2): the design a pand is drawn from = its description fields (lane C) with David's
 * edits on top, through the grouping links (`sameAs`: the target's fields; `basedOn`: the target's fields plus the link's
 * overrides), mapped onto the HouseSpec design vocabulary that house preview's `overridePatch` reads.
 *
 * `resolveLinked` is the one place links are resolved. When lane C's HouseSpec `basedOn` (R4) lands, swap it for a call to
 * houseSpec/resolve.ts; the page and the render service only see `pandDesign`.
 */
import { FAMILY_TONE } from '../houseSpec/wallColour.ts';
import { DESC_FIELDS, type DescField } from './fields.ts';
import type { DescFieldValue, DescriptionFile, EditsFile, FaceFile, GroupingFile } from './types.ts';

/** Family -> drawn wall tone: houseSpec/wallColour.ts FAMILY_TONE, plus lane C's describer names for two brick families. */
export const FAMILY_HEX: Record<string, string> = { ...FAMILY_TONE, 'red-brown-brick': FAMILY_TONE['red-brown'], 'purple-brown-brick': FAMILY_TONE.brown };
const WHITE_FRAME = '#f1efe8';

/** One field as drawn: the value and where it came from (`edit` = David's or Claude's edit, `link:<pand>` via a link). */
export interface FieldUse { value: unknown; source: string; ref?: string; edited?: boolean; via?: string }
export type FieldSet = Partial<Record<DescField, FieldUse>>;

export interface PandDesign {
  pandId: string;
  fields: FieldSet;
  /** HouseSpec-shaped design (design.fronts[0], palette, facts) for house preview. */
  design: { fronts: Record<string, unknown>[]; palette: Record<string, unknown>; facts: Record<string, unknown> };
  /** The link chain followed, e.g. ['basedOn:0363…']; empty when none. */
  chain: string[];
  /** Why a link was not followed (cycle, depth, target unknown). */
  notes: string[];
}

const MAX_CHAIN = 4;

/** The pand's own fields: description, then edits (field names) on top. */
export function ownFields(pandId: string, description: DescriptionFile | null, edits: EditsFile): FieldSet {
  const out: FieldSet = {};
  const d = description?.pands.find(p => p.pandId === pandId);
  for (const f of DESC_FIELDS) {
    const v = d?.fields?.[f] as DescFieldValue | undefined;
    if (v) out[f] = { value: v.value, source: v.source, ref: v.ref };
  }
  const e = edits.edits[pandId]?.fields ?? {};
  for (const f of DESC_FIELDS) if (e[f]) out[f] = { value: e[f].value, source: 'edit', edited: true, ...(e[f].note ? { ref: e[f].note } : {}) };
  return out;
}

/**
 * Follow sameAs / basedOn links: the target's resolved fields, then (basedOn) the link's overrides, then this pand's own
 * edits. Own description fields are replaced by the target's (that is what the link says). Refuses cycles and chains
 * deeper than 4 (as R4 does).
 */
export function resolveLinked(pandId: string, description: DescriptionFile | null, edits: EditsFile, grouping: GroupingFile, seen: string[] = []): { fields: FieldSet; chain: string[]; notes: string[] } {
  const own = ownFields(pandId, description, edits);
  const link = grouping.links.find(l => l.pandId === pandId);
  if (!link) return { fields: own, chain: [], notes: [] };
  if (seen.includes(link.target) || link.target === pandId) return { fields: own, chain: [], notes: [`${link.kind} ${link.target}: a cycle; not followed`] };
  if (seen.length >= MAX_CHAIN) return { fields: own, chain: [], notes: [`${link.kind} chain deeper than ${MAX_CHAIN}; not followed`] };
  if (!description?.pands.some(p => p.pandId === link.target) && !edits.edits[link.target]) return { fields: own, chain: [], notes: [`${link.kind} ${link.target}: not on this face; library targets arrive with lane C's basedOn`] };
  const base = resolveLinked(link.target, description, edits, grouping, [...seen, pandId]);
  const fields: FieldSet = {};
  for (const f of DESC_FIELDS) if (base.fields[f]) fields[f] = { ...base.fields[f]!, via: link.target, source: `${link.kind}:${base.fields[f]!.source}` };
  if (link.kind === 'basedOn') for (const [k, v] of Object.entries(link.overrides ?? {})) if ((DESC_FIELDS as readonly string[]).includes(k)) fields[k as DescField] = { value: v, source: 'override' };
  // A pand's own edits still win: "identical to that one, except what I corrected here".
  const mine = edits.edits[pandId]?.fields ?? {};
  for (const f of DESC_FIELDS) if (mine[f]) fields[f] = own[f]!;
  // Fields only measured on this pand (its eaves, its year) stay its own.
  for (const f of ['eavesM', 'facadeYear'] as const) if (own[f]) fields[f] = own[f];
  return { fields, chain: [`${link.kind}:${link.target}`, ...base.chain], notes: base.notes };
}

/** Description fields -> the HouseSpec design that house preview draws (houseSpec/spec.ts SpecDesign shape). */
export function fieldsToDesign(fields: FieldSet): PandDesign['design'] {
  const v = (f: DescField) => fields[f]?.value;
  const front: Record<string, unknown> = {}, palette: Record<string, unknown> = {}, facts: Record<string, unknown> = {};
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : undefined;
  if (num(v('storeys'))) front.storeys = v('storeys');
  if (num(v('bays'))) front.bays = v('bays');
  if (typeof v('crown') === 'string') front.gable = v('crown');
  if (typeof v('cornice') === 'string') front.cornice = v('cornice');
  const rs = v('roofStorey');
  if (rs === 'mansard' || rs === 'attic' || rs === 'none') front.roofStorey = rs;
  const dormers = v('dormers') as { count?: number; kind?: string } | undefined;
  if (dormers && typeof dormers === 'object' && Number.isInteger(dormers.count)) front.readDormers = { count: dormers.count, kind: dormers.count ? (dormers.kind === 'gabled' ? 'gabled' : 'plain') : 'none' };
  if (typeof v('heads') === 'string') front.windowHead = { kind: v('heads') };
  if (typeof v('windows') === 'string') front.windows = v('windows');
  if (typeof v('windowSurround') === 'string') front.windowSurround = v('windowSurround');
  const finish = v('wallFinish');
  if (typeof finish === 'string') palette.wallMaterial = finish === 'paint' ? 'painted-brick' : finish;
  const colour = v('wallColour');
  if (typeof colour === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(colour)) palette.brick = colour.toLowerCase();
    else if (FAMILY_HEX[colour]) { palette.brick = FAMILY_HEX[colour]; facts.wallFamily = colour.replace(/-brick$/, ''); }
  }
  if (v('whiteFrames') === true) palette.frame = WHITE_FRAME;
  const ground = v('ground');
  if (ground === 'shop' || ground === 'shopfront') { front.shopfront = {}; facts.groundKind = 'shop'; }
  else if (typeof ground === 'string') facts.groundKind = ground;
  const door = v('door');
  if (typeof door === 'number') front.doorBay = door;
  else if (door && typeof door === 'object') {
    const d = door as { bay?: number; surround?: boolean };
    if (Number.isInteger(d.bay)) front.doorBay = d.bay;
    if (d.surround) front.readDoorSurround = true;
  }
  if (typeof v('stoop') === 'string') front.basement = v('stoop');
  if (num(v('facadeYear'))) facts.facadeYear = v('facadeYear');
  return { fronts: [front], palette, facts };
}

export function pandDesign(face: FaceFile, pandId: string, description: DescriptionFile | null, edits: EditsFile, grouping: GroupingFile): PandDesign {
  void face;
  const r = resolveLinked(pandId, description, edits, grouping);
  return { pandId, fields: r.fields, design: fieldsToDesign(r.fields), chain: r.chain, notes: r.notes };
}
