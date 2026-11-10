/**
 * A staged spec (house line H3, docs/house-line.md section 3): the record `house:stage` writes under
 * `artifacts/house-specs/staging/<pandId>.json` and `house:publish` reads. Pure: validation and shaping only; the
 * scripts own the file access.
 *
 * The receipt is what the preview (H2) measured for this exact spec: its `measure.json` and the `compare.png` beside the
 * photo. A spec staged without one says why (`--no-receipt "<reason>"`), so a reviewer can tell an unchecked spec from a
 * checked one.
 */
import { validateSpec, type HouseSpec } from './spec.ts';

export type Receipt =
  | { kind: 'preview'; measure: Record<string, unknown>; measurePath: string; comparePath: string; verdict: string | null; measureSha256: string; compareSha256: string }
  | { kind: 'none'; reason: string };

export interface StagedSpec {
  version: 1;
  pandId: string;
  spec: HouseSpec;
  /** ISO timestamp. */
  stagedAt: string;
  by: string;
  note?: string;
  receipt: Receipt;
}

/** The verdict word of a preview measure.json (`verdict`, or `likeness.verdict`), when it carries one. */
export function verdictOf(measure: Record<string, unknown>): string | null {
  const v = measure.verdict ?? (measure.likeness as Record<string, unknown> | undefined)?.verdict;
  return typeof v === 'string' ? v : null;
}

export function makeStaged(input: { spec: unknown; by: string; note?: string; receipt: Receipt; now?: Date }): StagedSpec {
  const spec = validateSpec(input.spec);
  if (input.receipt.kind === 'none' && !input.receipt.reason.trim()) throw Error('--no-receipt needs a reason (what stands in for the preview?)');
  return { version: 1, pandId: spec.pandId, spec, stagedAt: (input.now ?? new Date()).toISOString(), by: input.by, ...(input.note ? { note: input.note } : {}), receipt: input.receipt };
}

/** A staged file read back: validates the spec again and the receipt's shape. Throws with the problem. */
export function parseStaged(input: unknown): StagedSpec {
  const o = input as Partial<StagedSpec> | null;
  if (!o || typeof o !== 'object' || o.version !== 1) throw Error('not a staged spec (version 1 expected)');
  const spec = validateSpec(o.spec);
  if (o.pandId !== spec.pandId) throw Error(`staged pandId ${o.pandId} does not match its spec ${spec.pandId}`);
  if (typeof o.stagedAt !== 'string' || Number.isNaN(Date.parse(o.stagedAt))) throw Error(`${spec.pandId}: stagedAt is not a date`);
  if (typeof o.by !== 'string' || !o.by) throw Error(`${spec.pandId}: by is empty`);
  const r = o.receipt as Receipt | undefined;
  if (!r || (r.kind !== 'preview' && r.kind !== 'none')) throw Error(`${spec.pandId}: no receipt (stage again with a preview, or --no-receipt "<reason>")`);
  if (r.kind === 'none' && !r.reason?.trim()) throw Error(`${spec.pandId}: receipt kind none needs a reason`);
  if (r.kind === 'preview' && (!r.measurePath || !r.comparePath || !r.measureSha256 || !r.compareSha256)) throw Error(`${spec.pandId}: the preview receipt is incomplete`);
  return { ...o, spec } as StagedSpec;
}

/** One line per staged spec for the batch table. */
export const describeStaged = (s: StagedSpec): string =>
  `${s.pandId}  ${s.spec.route ?? 'generic'}  ${s.receipt.kind === 'preview' ? `receipt ${s.receipt.verdict ?? 'measured'}` : `no receipt: ${s.receipt.reason}`}  by ${s.by} ${s.stagedAt.slice(0, 10)}`;
