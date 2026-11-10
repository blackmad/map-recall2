/**
 * A block-face house as a hand HouseSpec (belt builder lanes, docs/house-line.md §6c). Pure.
 *
 * `fromBlockFace` gives one receipt for the whole record (`provenance['']`). A hand spec that a reviewer corrects has to
 * say which fields came from the strip and which from the reading of the photo, so every face field gets its own key
 * with the face's receipt, and each fix is written as source `author` with the reviewer's reason. Fields the face
 * marked as a type default (`default`) keep that receipt unless a fix restates them.
 */
import { setSpecField, specFields, uniqueLimits, provenanceOf, type HouseSpec, type Prov, type SpecLimit } from './spec.ts';

/** The reviewer's corrections for one pand (house:from-face `--fixes`). */
export interface FaceFixes {
  /** Field path -> value, written as source `author`. A path under `fronts/<n>/`, `roof/`, `palette/`, `facts/` or `notes`. */
  fields?: Record<string, unknown>;
  /** Field path -> what the photo shows (the receipt's ref text). */
  why?: Record<string, string>;
  /** The photo the fields were read from (strip, panorama id, crop path). */
  ref: string;
  /** The capture date of that photo (YYYY-MM-DD). */
  at: string;
  /** What the photo shows that the kit cannot say. */
  limits?: SpecLimit[];
  /** Face fields to remove (a wrong type default with no better value). */
  drop?: string[];
  /** Replaces the spec's address (the face's is BAG's number with a letter). */
  address?: string;
}

/** Confidence of a reviewer's reading of the photo (house line convention: author 0.9). */
export const AUTHOR_CONFIDENCE = 0.9;

function unset(spec: HouseSpec, p: string): void {
  const [head, a, b] = p.split('/');
  const d = spec.design as Record<string, any>;
  if (head === 'fronts') delete d.fronts?.[Number(a)]?.[b];
  else if (head === 'facts') delete (spec.facts as Record<string, unknown> | undefined)?.[a];
  else if (head === 'notes') delete d.notes;
  else delete d[head]?.[a];
}

/** The face's spec with a receipt per field, then the fixes as `author` fields. */
export function specFromFace(base: HouseSpec, fixes?: FaceFixes): HouseSpec {
  const spec: HouseSpec = structuredClone(base);
  const whole = base.provenance[''];
  const provenance: Record<string, Prov> = {};
  for (const [p] of specFields(spec)) {
    const prov = provenanceOf(base, p) ?? whole;
    if (prov) provenance[p] = prov;
  }
  spec.provenance = provenance;
  if (fixes) {
    for (const p of fixes.drop ?? []) { unset(spec, p); delete spec.provenance[p]; }
    for (const [p, v] of Object.entries(fixes.fields ?? {})) {
      setSpecField(spec, p, v);
      spec.provenance[p] = { source: 'author', confidence: AUTHOR_CONFIDENCE, ref: `${fixes.ref}: ${fixes.why?.[p] ?? 'read on the photo'}`, at: fixes.at };
    }
    if (fixes.limits?.length) spec.schemaLimits = uniqueLimits([...(spec.schemaLimits ?? []), ...fixes.limits]);
    if (fixes.address) spec.address = fixes.address;
  }
  return spec;
}
