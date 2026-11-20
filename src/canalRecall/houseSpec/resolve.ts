/**
 * Merge partial house specs field by field (house line, docs/house-line.md §1).
 *
 * For every field any part states, the part whose receipt is strongest wins: the evidence ladder of
 * facade/evidence.ts (`SOURCE_STRENGTH`, `author` = `reviewed`), then higher confidence, then the newer evidence
 * date (`resolveField`'s order). A full tie keeps the earlier part, so the merge is deterministic in input order.
 * Nothing is invented: a field absent from every part stays absent, and the output carries one receipt per field.
 */
import { resolveField, type FacadeSource, type Measured } from '../facade/evidence.ts';
import {
  BASED_ON_MAX_DEPTH, emptySpec, provenanceOf, setSpecField, specField, specFields, specStrength, uniqueLimits,
  type HouseSpec, type Prov, type SpecSource,
} from './spec.ts';

/** resolveField speaks FacadeSource: rank `author` as `reviewed` for the comparison, keep the original receipt. */
const asMeasured = (prov: Prov): Measured<Prov> => ({
  value: prov, source: (prov.source === 'author' ? 'reviewed' : prov.source) as FacadeSource,
  confidence: prov.confidence, observationId: prov.ref, measuredAt: prov.at,
});

/** The crown (`fronts/N/gable`): a photo reading outranks the register's gable words (H5h round 4 ruling on #351: the register
 *  type agreed with the street front 36 of 60). Only this pair changes order; the rest of the ladder is SOURCE_STRENGTH. */
export const isGablePath = (path: string | undefined) => !!path && /^fronts\/\d+\/gable$/.test(path);
export const PHOTO_SOURCES: ReadonlySet<string> = new Set(['vision-judge', 'streetlevel-measured', 'reviewed', 'author']);

/** The winning receipt of two for one field (exported for tests and the describe writers); `path` applies the crown order. */
export function strongerProv(a: Prov, b: Prov, path?: string): Prov {
  // `based-on` is not on the facade ladder (resolveField would rank it under `default`): its own rank decides first.
  if ((a.source === 'based-on' || b.source === 'based-on') && specStrength(a.source) !== specStrength(b.source)) return specStrength(b.source) > specStrength(a.source) ? b : a;
  if (isGablePath(path)) {
    if (a.source === 'monument-text' && PHOTO_SOURCES.has(b.source)) return b;
    if (b.source === 'monument-text' && PHOTO_SOURCES.has(a.source)) return a;
  }
  // resolveField breaks a full tie towards `a` only when b's date is not newer; equal strength + confidence + date keeps a.
  return resolveField(asMeasured(a), asMeasured(b)).value;
}

/** One spec from several partial specs of the same pand. Throws when the parts name different pands. */
export function resolveSpecs(parts: readonly HouseSpec[]): HouseSpec {
  if (!parts.length) throw new Error('resolveSpecs: no parts');
  const pandId = parts[0].pandId;
  for (const p of parts) if (p.pandId !== pandId) throw new Error(`resolveSpecs: parts of ${pandId} and ${p.pandId}`);
  const out = emptySpec(pandId, parts.find(p => p.address)?.address);
  const winners = new Map<string, { value: unknown; prov: Prov }>();
  for (const part of parts) for (const [path, value] of specFields(part)) {
    const prov = provenanceOf(part, path);
    if (!prov) continue; // an unreceipted field is not evidence (validateSpec rejects it on the way in)
    const incumbent = winners.get(path);
    if (!incumbent || strongerProv(incumbent.prov, prov, path) !== incumbent.prov) winners.set(path, { value, prov });
  }
  // Stable output order: fronts by index, then sections, as specFields orders them.
  for (const path of [...winners.keys()].sort(fieldOrder)) {
    const w = winners.get(path)!;
    setSpecField(out, path, structuredClone(w.value));
    out.provenance[path] = { ...w.prov };
  }
  const limits = uniqueLimits(parts.flatMap(p => p.schemaLimits ?? []));
  if (limits.length) out.schemaLimits = limits;
  // The first part that names a base keeps it (input order, like a full tie); applyBasedOn merges it.
  const basedOn = parts.find(p => p.basedOn)?.basedOn;
  if (basedOn) out.basedOn = structuredClone(basedOn);
  return out;
}

/** The sections a base lends (its design; notes and facts are evidence about the base, not this house). */
const LENT = /^(fronts\/\d+\/|roof\/|palette\/)/;

/** `sameAs` override semantics (blockFace/intent.ts merge): objects merge key by key, a list of objects element by element. */
const mergeOver = (a: any, b: any): any => {
  if (Array.isArray(a) && Array.isArray(b)) return b.length && typeof b[0] === 'object' && !Array.isArray(b[0]) ? a.map((x, i) => i < b.length ? mergeOver(x, b[i]) : x).concat(b.slice(a.length)) : b;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = k in a ? mergeOver(a[k], v) : v; return out; }
  return b === undefined ? a : b;
};

/** The base chain of a spec, nearest first (throws on a missing base, a cycle, or a chain deeper than BASED_ON_MAX_DEPTH). */
export function basedOnChain(spec: Pick<HouseSpec, 'pandId' | 'basedOn'>, lookup: (pandId: string) => Pick<HouseSpec, 'pandId' | 'basedOn'> | undefined): string[] {
  const chain: string[] = [], seen = new Set([spec.pandId]);
  let at: Pick<HouseSpec, 'pandId' | 'basedOn'> | undefined = spec;
  while (at?.basedOn) {
    const id = at.basedOn.pandId;
    if (seen.has(id)) throw new Error(`basedOn: cycle ${[spec.pandId, ...chain, id].join(' -> ')}`);
    if (chain.length >= BASED_ON_MAX_DEPTH) throw new Error(`basedOn: chain from ${spec.pandId} deeper than ${BASED_ON_MAX_DEPTH} (${[...chain, id].join(' -> ')})`);
    const base = lookup(id);
    if (!base) throw new Error(`basedOn: ${at.pandId} is based on ${id}, which has no spec`);
    seen.add(id); chain.push(id); at = base;
  }
  return chain;
}

/**
 * The spec with its base's design merged in (R4). `lookup` returns a pand's spec as resolved from its own parts (resolveSpecs),
 * with its own `basedOn` when it has one; the base is resolved through its own chain first. Each lent field (the base's
 * resolved fronts/roof/palette, then `overrides` merged over it) is a part at source `based-on`: it fills a field this spec
 * leaves absent or at `default` and loses to every other source. The base's kit limits apply to this house too. A spec
 * without `basedOn` is returned as the same object (byte-identical).
 */
export function applyBasedOn(spec: HouseSpec, lookup: (pandId: string) => HouseSpec | undefined): HouseSpec {
  if (!spec.basedOn) return spec;
  basedOnChain(spec, lookup); // refuse cycles and deep chains before any merge
  const b = spec.basedOn, baseRaw = lookup(b.pandId)!;
  const base = applyBasedOn(baseRaw, lookup);
  const lent = emptySpec(spec.pandId);
  for (const [path, value] of specFields(base)) {
    if (!LENT.test(path)) continue;
    const prov = provenanceOf(base, path);
    setSpecField(lent, path, structuredClone(value));
    lent.provenance[path] = { source: 'based-on', confidence: prov?.confidence ?? 0.5, ref: `based-on ${b.pandId}: ${prov ? `${prov.source} ${prov.ref}` : 'unreceipted'}`, at: prov?.at ?? null };
  }
  for (const [path, value] of specFields({ design: b.overrides ?? {} })) {
    if (!LENT.test(path)) continue;
    const merged = mergeOver(specField(lent, path), value);
    setSpecField(lent, path, structuredClone(merged));
    lent.provenance[path] = { source: 'based-on', confidence: b.confidence ?? 0.8, ref: `based-on ${b.pandId} overrides${b.ref ? `: ${b.ref}` : ''}`, at: null };
  }
  const out = resolveSpecs([spec, lent]);
  if (spec.address) out.address = spec.address;
  const limits = uniqueLimits([...(spec.schemaLimits ?? []), ...(base.schemaLimits ?? [])]);
  if (limits.length) out.schemaLimits = limits;
  out.basedOn = structuredClone(b);
  if (spec.route) out.route = spec.route;
  return out;
}

const SECTION_ORDER = ['fronts', 'roof', 'palette', 'notes', 'facts'];
function fieldOrder(a: string, b: string): number {
  const [ha, ia] = a.split('/'), [hb, ib] = b.split('/');
  const s = SECTION_ORDER.indexOf(ha) - SECTION_ORDER.indexOf(hb);
  if (s) return s;
  if (ha === 'fronts' && ia !== ib) return Number(ia) - Number(ib);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The source that won each field, for the compact extract (`{"fronts/0/gable": "monument-text"}`). */
export const fieldSources = (spec: HouseSpec): Record<string, SpecSource> =>
  Object.fromEntries(specFields(spec).map(([path]) => [path, provenanceOf(spec, path)?.source ?? 'default']));

/** The strongest source among a spec's fields (for coverage reports); `default` for an empty spec. */
export function strongestSource(spec: HouseSpec): SpecSource {
  let best: SpecSource = 'default';
  for (const s of Object.values(fieldSources(spec))) if (specStrength(s) > specStrength(best)) best = s;
  return best;
}
