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
  emptySpec, provenanceOf, setSpecField, specFields, specStrength, uniqueLimits,
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
