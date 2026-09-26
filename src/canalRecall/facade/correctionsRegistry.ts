/**
 * Typed, validated registry for the per-case façade correction studies under
 * `scripts/review/`.
 *
 * Each study used to be read as bespoke JSON by address. These files actually
 * share one envelope (`caseId` / `buildingId` / `observationId` plus feature,
 * surface, assembly and topology arrays) and one of them
 * (`case25-source-corrections.json`) ships the same facts as a `cases` bundle
 * keyed by `caseId`. This module captures that shape once, validates it without
 * throwing, and offers deterministic merge/group helpers so downstream code can
 * stop hand-parsing per-address documents.
 *
 * The module is deliberately I/O-free except for the opt-in
 * {@link loadCorrections} reader.
 */

export interface FacadeBoundsPx {
  left: number;
  right: number;
  bottom: number;
  top?: number;
  [key: string]: unknown;
}

/** One `set`/`remove` appearance override against a source feature. */
export interface CorrectionFeatureOverride {
  featureId: string;
  source?: string;
  sourceCropSha256?: string;
  expectedFeatureSha256?: string;
  expectedResultFeatureSha256?: string;
  set?: Record<string, unknown>;
  remove?: unknown;
  basis?: string;
  [key: string]: unknown;
}

/** A flat surface (wall/roof/etc.) drawn in source pixel space. */
export interface ComponentSurface {
  name: string;
  type?: string;
  role?: string;
  colour?: string;
  basis?: string;
  vertices?: unknown;
  [key: string]: unknown;
}

/** A repeated assembly such as a balcony front. */
export interface ComponentAssembly {
  name: string;
  type?: string;
  boundsPx?: unknown;
  projectionM?: number;
  slabThicknessPx?: number;
  verticalRailCount?: number;
  railWidthPx?: number;
  railColour?: string;
  slabColour?: string;
  observedBasis?: string;
  inferredDepthBasis?: string;
  [key: string]: unknown;
}

/** A surface that replaces/binds a native topology surface. */
export interface NativeTopologyJoin {
  name: string;
  type?: string;
  role?: string;
  colour?: string;
  replaceSurfaceIndex?: number;
  vertices?: unknown;
  facets?: unknown;
  basis?: string;
  [key: string]: unknown;
}

/** A same-frame geometry repair entry (`case30` only). */
export interface SourceGeometryRepair {
  featureId: string;
  expectedStyledFeatureSha256?: string;
  expectedResultFeatureSha256?: string;
  set?: Record<string, unknown>;
  basis?: string;
  [key: string]: unknown;
}

/**
 * The common envelope of a correction study. Only `caseId`, `buildingId` and
 * `observationId` are required; everything else mirrors fields that really
 * appear in the files. Free-form sections (`source`, `placement`, …) stay
 * `unknown` because their internal shape is not shared across studies.
 */
export interface CorrectionRecord {
  id?: string;
  version?: number;
  caseId: string;
  buildingId: string;
  observationId: string;
  scopeNote?: string;
  sourceNote?: string;
  extractionVersion?: string;
  coordinateConvention?: string;
  tier?: string;
  reason?: string;
  source?: unknown;
  facadeBoundsPx?: FacadeBoundsPx;
  silhouetteTopPx?: Array<[number, number]>;
  placement?: unknown;
  nativeTopologyBinding?: unknown;
  concaveMaterialPreview?: unknown;
  sourceFeatureOverrides?: CorrectionFeatureOverride[];
  sourceGeometryRepair?: SourceGeometryRepair[];
  componentSurfaces?: ComponentSurface[];
  componentAssemblies?: ComponentAssembly[];
  nativeTopologyJoins?: NativeTopologyJoin[];
  replace?: Record<string, unknown>;
  add?: unknown[];
  [key: string]: unknown;
}

const CORRECTION_FILES = [
  'scripts/review/case20-dormer-correction.json',
  'scripts/review/case22-stepped-gable-correction.json',
  'scripts/review/case25-flat-parapet-correction.json',
  'scripts/review/case25-source-corrections.json',
  'scripts/review/case30-glazed-balcony-door-correction.json',
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

function requireNonEmptyString(object: Record<string, unknown>, field: string, errors: string[]): void {
  if (!isNonEmptyString(object[field])) errors.push(`${field} must be a non-empty string`);
}

function requireIdArray(
  object: Record<string, unknown>,
  field: string,
  idKey: string,
  errors: string[],
): void {
  const value = object[field];
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  value.forEach((entry, index) => {
    if (!isObject(entry)) {
      errors.push(`${field}[${index}] must be an object`);
      return;
    }
    if (!isNonEmptyString(entry[idKey])) {
      errors.push(`${field}[${index}].${idKey} must be a non-empty string`);
    }
  });
}

/**
 * Validate an untrusted value against {@link CorrectionRecord}. Collects every
 * problem instead of throwing so callers can report all issues at once.
 */
export function validateCorrection(
  value: unknown,
): { ok: true; record: CorrectionRecord } | { ok: false; errors: string[] } {
  if (!isObject(value)) return { ok: false, errors: ['correction must be a JSON object'] };

  const errors: string[] = [];
  requireNonEmptyString(value, 'caseId', errors);
  requireNonEmptyString(value, 'buildingId', errors);
  requireNonEmptyString(value, 'observationId', errors);
  if (value.id !== undefined) requireNonEmptyString(value, 'id', errors);
  if (value.version !== undefined && typeof value.version !== 'number') {
    errors.push('version must be a number');
  }
  if (value.scopeNote !== undefined && typeof value.scopeNote !== 'string') {
    errors.push('scopeNote must be a string');
  }
  if (value.silhouetteTopPx !== undefined && !Array.isArray(value.silhouetteTopPx)) {
    errors.push('silhouetteTopPx must be an array');
  }
  requireIdArray(value, 'sourceFeatureOverrides', 'featureId', errors);
  requireIdArray(value, 'sourceGeometryRepair', 'featureId', errors);
  requireIdArray(value, 'componentSurfaces', 'name', errors);
  requireIdArray(value, 'componentAssemblies', 'name', errors);
  requireIdArray(value, 'nativeTopologyJoins', 'name', errors);
  requireIdArray(value, 'add', 'id', errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, record: value as unknown as CorrectionRecord };
}

function compareRecords(a: CorrectionRecord, b: CorrectionRecord): number {
  return a.caseId.localeCompare(b.caseId) || (a.id ?? '').localeCompare(b.id ?? '');
}

/**
 * Collapse records that describe the same building/observation. The first
 * occurrence of a `buildingId|observationId` key wins and every losing id is
 * reported. Output order is deterministic (caseId, then id).
 */
export function mergeCorrections(records: CorrectionRecord[]): {
  records: CorrectionRecord[];
  conflicts: { key: string; ids: string[] }[];
} {
  const byKey = new Map<string, CorrectionRecord>();
  const conflicts = new Map<string, { key: string; ids: string[] }>();

  for (const record of records) {
    const key = `${record.buildingId}|${record.observationId}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      continue;
    }
    let conflict = conflicts.get(key);
    if (!conflict) {
      conflict = { key, ids: [] };
      conflicts.set(key, conflict);
    }
    for (const duplicate of [existing, record]) {
      const id = duplicate.id ?? key;
      if (!conflict.ids.includes(id)) conflict.ids.push(id);
    }
  }

  return {
    records: [...byKey.values()].sort(compareRecords),
    conflicts: [...conflicts.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

/** Group records by `caseId`, deterministically ordered. */
export function correctionsByCase(records: CorrectionRecord[]): Record<string, CorrectionRecord[]> {
  const grouped: Record<string, CorrectionRecord[]> = {};
  for (const record of [...records].sort(compareRecords)) {
    (grouped[record.caseId] ??= []).push(record);
  }
  return grouped;
}

interface OwnerIds {
  buildingId: string;
  observationId: string;
}

function ownerIndex(documents: unknown[]): Map<string, OwnerIds> {
  const owners = new Map<string, OwnerIds>();
  for (const document of documents) {
    if (!isObject(document)) continue;
    const { caseId, buildingId, observationId } = document;
    if (isNonEmptyString(caseId) && isNonEmptyString(buildingId) && isNonEmptyString(observationId) && !owners.has(caseId)) {
      owners.set(caseId, { buildingId, observationId });
    }
  }
  return owners;
}

/**
 * A flat study is returned as-is. A `cases` bundle (`case25-source-corrections`)
 * is lifted per case, borrowing `buildingId`/`observationId` from whichever flat
 * study shares its `caseId` and mapping its `reason` onto `scopeNote`.
 */
function expandDocument(document: unknown, owners: Map<string, OwnerIds>): unknown[] {
  if (!isObject(document) || !Array.isArray(document.cases)) return [document];
  return document.cases.map((entry) => {
    if (!isObject(entry)) return entry;
    const caseId = isNonEmptyString(entry.caseId) ? entry.caseId : undefined;
    const owner = caseId ? owners.get(caseId) : undefined;
    return {
      ...entry,
      id: isNonEmptyString(entry.id) ? entry.id : caseId ? `bundle:${caseId}` : entry.id,
      buildingId: isNonEmptyString(entry.buildingId) ? entry.buildingId : owner?.buildingId,
      observationId: isNonEmptyString(entry.observationId) ? entry.observationId : owner?.observationId,
      scopeNote: typeof entry.scopeNote === 'string' ? entry.scopeNote : entry.reason,
    };
  });
}

/**
 * Read the five review studies beneath `root`, skipping any that are absent.
 * Throws only if a present document yields records that fail validation, so the
 * caller never receives a half-formed registry.
 */
export async function loadCorrections(root = '.'): Promise<CorrectionRecord[]> {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');

  const documents: unknown[] = [];
  for (const relative of CORRECTION_FILES) {
    let text: string;
    try {
      text = await readFile(resolve(root, relative), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    documents.push(JSON.parse(text));
  }

  const owners = ownerIndex(documents);
  const records: CorrectionRecord[] = [];
  const errors: string[] = [];
  for (const document of documents) {
    for (const candidate of expandDocument(document, owners)) {
      const result = validateCorrection(candidate);
      if (result.ok) records.push(result.record);
      else errors.push(...result.errors);
    }
  }

  if (errors.length > 0) throw new Error(`Invalid façade correction records:\n${errors.join('\n')}`);
  return records.sort(compareRecords);
}
