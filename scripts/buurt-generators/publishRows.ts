/**
 * A subset publish (publish.ts --rows=): only the staged records of the named generator rows. A record's row is its
 * series id's row part (`legmeerplein-095655:s0` -> `legmeerplein-095655`), the id the district library's rowNotes
 * use. A named row with no staged record is an error, so a typo never publishes nothing silently.
 */
export type StagedRecord = { pandId: string; series?: { id?: unknown }; [k: string]: unknown };

/** The generator row a staged record belongs to (null when it carries no series id). */
export const rowOfRecord = (r: StagedRecord): string | null => typeof r.series?.id === 'string' ? r.series.id.split(':')[0] : null;

/** The records of `rows` only, in their staged order; throws on a row with no record. */
export function recordsOfRows<T extends StagedRecord>(records: readonly T[], rows: readonly string[]): T[] {
  const want = new Set(rows), seen = new Set<string>();
  const out = records.filter(r => { const row = rowOfRecord(r); if (row && want.has(row)) { seen.add(row); return true; } return false; });
  const missing = rows.filter(r => !seen.has(r));
  if (missing.length) throw new Error(`no staged records for row(s) ${missing.join(', ')}`);
  return out;
}
