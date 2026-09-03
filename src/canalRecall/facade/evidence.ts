/**
 * Provenance for every façade parameter the twin renders.
 *
 * `AMSTERDAM_FACADE_TWIN.md` sets two rules that decide whether this project
 * teaches geography or fabricates it:
 *
 * > A building whose façade has never been observed does not get a façade.
 *
 * > They never carry a neighbour's answer across a party wall.
 *
 * Neither survives as a convention. A convention is what an assembly engine
 * quietly breaks at 3am on the four hundredth house in a terrace, and nothing
 * downstream can tell afterwards, because a number that was measured and a
 * number that was assumed look identical once they are both just a number.
 *
 * So a façade value is never a bare number here. It is a {@link Measured},
 * which carries where it came from, how sure we are, and — the part that makes
 * the party-wall rule enforceable — *which observation of which `pand_id`* it
 * was read off. {@link auditFields} then checks that ledger against the
 * observations it claims, and QA-EVIDENCE has something to run rather than
 * something to believe.
 *
 * This mirrors what `BUILDING_ENRICHMENT.md` already requires of roof colour,
 * generalised from one field to thirty.
 */

/**
 * Where a value came from, strongest first. The order is the source hierarchy
 * in `AMSTERDAM_FACADE_TWIN.md` Part 1, and {@link isStrongerSource} reads it,
 * so a resolver that has two answers for one field prefers the more direct
 * observation without each caller re-deciding what "more direct" means.
 */
export const SOURCE_STRENGTH = [
  /** Nothing was observed. The only source that may carry no observation. */
  'default',
  /** OSM tags: semantics and hand-mapped structure, not a measurement of this façade. */
  'osm',
  /** 3DBAG LoD2.2 reconstructed wall and roof surfaces. */
  '3dbag',
  /** AHN height model: eaves, ridge, and a terrace's stepped roofline. */
  'ahn',
  /** PDOK orthophoto: roof colour and material, measured not chosen. */
  'pdok-ortho',
  /** BAG: authoritative identity, footprint and bouwjaar. */
  'bag',
  /** A Rijksmonument description naming gable type, bays, cornice or date. */
  'monument-text',
  /** A rectified street-level view of this elevation, measured. */
  'streetlevel-measured',
  /** A human looked at this building and corrected it. Outranks everything. */
  'reviewed',
] as const;

export type FacadeSource = (typeof SOURCE_STRENGTH)[number];

const STRENGTH = new Map<FacadeSource, number>(SOURCE_STRENGTH.map((source, index) => [source, index]));

/** True when `candidate` is a more direct observation than `incumbent`. */
export const isStrongerSource = (candidate: FacadeSource, incumbent: FacadeSource): boolean =>
  (STRENGTH.get(candidate) ?? -1) > (STRENGTH.get(incumbent) ?? -1);

/**
 * One field of one building, with the receipt attached.
 *
 * `measuredAt` is the date of the *evidence*, not of the pipeline run. A façade
 * measured from 2021 panorama imagery is a 2021 observation however often the
 * extract is rebuilt, and a shopfront replaced in 2023 should therefore look
 * stale rather than current.
 */
export interface Measured<T> {
  value: T;
  source: FacadeSource;
  /** 0…1. Calibrated against held-out hand-verified buildings, not asserted. */
  confidence: number;
  /** The {@link Observation} this was read off; null only when defaulted. */
  observationId: string | null;
  /** ISO date of the imagery or record, `YYYY-MM-DD`. */
  measuredAt: string | null;
}

/**
 * A single act of looking at a building. Observations are shared — one
 * panorama image measures several houses — but each is bound to the `pand_id`
 * it was taken *of*, which is what lets the audit catch a value that walked
 * across a party wall.
 */
export interface Observation {
  id: string;
  /** The BAG pand this observation is an observation *of*. */
  pandId: string;
  kind: ObservationKind;
  /** Which elevation it shows; `roof` for nadir imagery. */
  elevation: Elevation;
  /** ISO date the imagery was captured or the record was published. */
  capturedAt: string;
  /** Where it came from, for attribution and for re-checking a disputed field. */
  sourceUrl: string | null;
  /** The licence the source is available under, recorded at observation time. */
  license: string | null;
}

export type ObservationKind =
  | 'street-panorama'
  | 'oblique-aerial'
  | 'ortho-nadir'
  | 'archive-photo'
  | 'monument-record'
  | 'registry-record'
  | 'human-review';

export type Elevation = 'front' | 'rear' | 'left' | 'right' | 'roof';

export const ELEVATIONS: readonly Elevation[] = ['front', 'rear', 'left', 'right', 'roof'];

/** Build a measured value. Throws rather than let an unobserved value claim a source. */
export function measured<T>(
  value: T,
  source: Exclude<FacadeSource, 'default'>,
  confidence: number,
  observation: Pick<Observation, 'id' | 'capturedAt'>,
): Measured<T> {
  if (!(confidence >= 0 && confidence <= 1)) throw new RangeError(`confidence ${confidence} is outside 0…1`);
  return { value, source, confidence, observationId: observation.id, measuredAt: observation.capturedAt };
}

/**
 * Build an unobserved value.
 *
 * Deliberately awkward to reach for, and deliberately zero-confidence: the
 * renderer may use a default, but nothing downstream may mistake one for a
 * measurement. Every defaulted field is counted in {@link summariseCoverage}
 * and reported per field and per neighbourhood.
 */
export const defaulted = <T>(value: T): Measured<T> =>
  ({ value, source: 'default', confidence: 0, observationId: null, measuredAt: null });

/** True when this field was actually observed, rather than filled in. */
export const wasObserved = <T>(field: Measured<T>): boolean => field.source !== 'default';

/**
 * Read a field only if it was observed, otherwise fall back.
 *
 * The assembly engine draws openings through this, so a building nobody has
 * looked at renders without windows instead of with plausible invented ones —
 * a gap rather than a lie the player memorises.
 */
export const observedValue = <T>(field: Measured<T> | undefined): T | null =>
  field && wasObserved(field) ? field.value : null;

/**
 * Prefer the more directly observed of two answers for the same field.
 *
 * Ties break on confidence, then on recency of the evidence — an older
 * measurement of the same strength is more likely to predate an alteration.
 */
export function resolveField<T>(a: Measured<T>, b: Measured<T>): Measured<T> {
  if (isStrongerSource(a.source, b.source)) return a;
  if (isStrongerSource(b.source, a.source)) return b;
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? a : b;
  return (b.measuredAt ?? '') > (a.measuredAt ?? '') ? b : a;
}

/** A ledger violation, in the terms QA-EVIDENCE reports them. */
export interface EvidenceViolation {
  pandId: string;
  field: string;
  /**
   * `laundered-default` is the one this whole module exists to catch: a value
   * that never came from an observation, wearing a source that says it did.
   */
  code:
    | 'laundered-default'
    | 'default-claims-observation'
    | 'default-claims-confidence'
    | 'missing-observation'
    | 'foreign-observation'
    | 'confidence-out-of-range'
    | 'stale-measurement-date';
  detail: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Audit one building's fields against the observations they cite.
 *
 * `observations` is the registry the extract publishes; a field citing an id
 * that is not in it, or one recorded against a different `pand_id`, is exactly
 * the neighbour's-answer failure the per-building rule forbids. Returns every
 * violation rather than the first, because a correction pass wants the whole
 * list for a building, not a bisect.
 */
export function auditFields(
  pandId: string,
  fields: Readonly<Record<string, Measured<unknown> | undefined>>,
  observations: ReadonlyMap<string, Observation>,
  today = new Date().toISOString().slice(0, 10),
): EvidenceViolation[] {
  const violations: EvidenceViolation[] = [];
  const report = (field: string, code: EvidenceViolation['code'], detail: string) =>
    violations.push({ pandId, field, code, detail });

  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const { source, confidence, observationId, measuredAt } = value;

    if (!(confidence >= 0 && confidence <= 1)) {
      report(field, 'confidence-out-of-range', `confidence ${confidence}`);
    }

    if (source === 'default') {
      // A default is honest as long as it stays labelled as one.
      if (observationId !== null) report(field, 'default-claims-observation', `cites ${observationId}`);
      if (confidence !== 0) report(field, 'default-claims-confidence', `confidence ${confidence}`);
      continue;
    }

    if (observationId === null) {
      report(field, 'laundered-default', `source ${source} with no observation`);
      continue;
    }

    const observation = observations.get(observationId);
    if (!observation) {
      report(field, 'missing-observation', `observation ${observationId} is not in the registry`);
      continue;
    }
    if (observation.pandId !== pandId) {
      report(field, 'foreign-observation', `observation ${observationId} is of pand ${observation.pandId}`);
    }
    if (measuredAt !== null && (!ISO_DATE.test(measuredAt) || measuredAt > today)) {
      report(field, 'stale-measurement-date', `measuredAt ${measuredAt}`);
    }
  }
  return violations;
}

/** Per-field coverage, the number the QA report publishes beside every score. */
export interface FieldCoverage {
  field: string;
  measured: number;
  defaulted: number;
  /** measured / (measured + defaulted), or 0 when the field appears nowhere. */
  share: number;
  /** Mean confidence across the measured values only. */
  meanConfidence: number;
  bySource: Partial<Record<FacadeSource, number>>;
}

/**
 * Summarise how much of a population was actually observed.
 *
 * The doc's framing, kept deliberately: *a boundary that is 70% frontally
 * observed and honest about it is a better result than one that is 100%
 * detailed and 30% invented.* This function is how the honesty gets published.
 */
export function summariseCoverage(
  records: readonly Readonly<Record<string, Measured<unknown> | undefined>>[],
): FieldCoverage[] {
  const tally = new Map<string, { measured: number; defaulted: number; confidence: number; bySource: Map<FacadeSource, number> }>();

  for (const record of records) {
    for (const [field, value] of Object.entries(record)) {
      if (!value) continue;
      let entry = tally.get(field);
      if (!entry) tally.set(field, (entry = { measured: 0, defaulted: 0, confidence: 0, bySource: new Map() }));
      entry.bySource.set(value.source, (entry.bySource.get(value.source) ?? 0) + 1);
      if (wasObserved(value)) {
        entry.measured += 1;
        entry.confidence += value.confidence;
      } else {
        entry.defaulted += 1;
      }
    }
  }

  return [...tally.entries()]
    .map(([field, entry]) => ({
      field,
      measured: entry.measured,
      defaulted: entry.defaulted,
      share: entry.measured + entry.defaulted === 0 ? 0 : entry.measured / (entry.measured + entry.defaulted),
      meanConfidence: entry.measured === 0 ? 0 : entry.confidence / entry.measured,
      bySource: Object.fromEntries(entry.bySource) as Partial<Record<FacadeSource, number>>,
    }))
    .sort((a, b) => a.share - b.share || a.field.localeCompare(b.field));
}
