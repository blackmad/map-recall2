/**
 * Audit of the industrial table's works/shed tags against BAG housing (lane FD, 2026-11-13). Pure, no DOM.
 *
 * Why it exists: `fetch-bag-uses.ts` keeps only VBOs whose gebruiksdoel is not plain woonfunctie, so the registered
 * floor area `classifyIndustrial` sees never contains an apartment and its HOUSING_SHARE veto cannot fire for a pand
 * whose homes are plain-woonfunctie VBOs. The 2004 block 0363100012091500 (40 woonfunctie VBOs, 2 industrie, 1
 * bijeenkomst) was tagged `works` and drawn as a windowless metal hall with roller doors. This module re-reads a tag
 * against the full use list (`fetch-bag-housing.ts`) and says which tagged pands are mainly residential.
 */
import { HOUSING_SHARE, MAIN_SHARE, type IndustrialKind } from './industrialClass.js';

export type AuditUses = Record<string, number>;
export interface TaggedPand {
  id: string;
  kind: IndustrialKind;
  stadsdeel: string;
  areaM2: number;
  heightM: number;
  year: number | null;
  /** Floor area per BAG gebruiksdoel over ALL in-use VBOs (woonfunctie included); absent: no VBO known. */
  uses?: AuditUses;
  vbos?: number;
  woonVbos?: number;
}
export type HousingClass = 'mainly-residential' | 'mixed-residential' | 'not-residential' | 'no-vbo-data';
export interface AuditRow extends TaggedPand {
  woonShare: number;
  housing: HousingClass;
  /** The tag once the housing veto sees the homes (null: the pand would keep the house grammar). */
  revisedKind: IndustrialKind | null;
}

export function woonShare(uses: AuditUses | undefined): number {
  if (!uses) return 0;
  const total = Object.values(uses).reduce((s, v) => s + v, 0);
  return total > 0 ? (uses.woonfunctie ?? 0) / total : 0;
}

export function housingClass(uses: AuditUses | undefined): HousingClass {
  if (!uses || !Object.keys(uses).length) return 'no-vbo-data';
  const s = woonShare(uses);
  return s >= MAIN_SHARE ? 'mainly-residential' : s >= HOUSING_SHARE ? 'mixed-residential' : 'not-residential';
}

/**
 * The classifier's housing veto (HOUSING_SHARE of the registered floor area, industrialClass.ts) applied to the full
 * use list: the tag survives only when homes are under that share. Every other rule keeps the table's verdict.
 */
export function auditRow(p: TaggedPand): AuditRow {
  const share = woonShare(p.uses);
  return { ...p, woonShare: share, housing: housingClass(p.uses), revisedKind: share >= HOUSING_SHARE ? null : p.kind };
}

export interface AuditSummary {
  tagged: number;
  byKind: Record<string, number>;
  mainly: number;
  mixed: number;
  noData: number;
  perStadsdeel: Record<string, { tagged: number; mainly: number; mixed: number; noData: number }>;
}

export function summarise(rows: readonly AuditRow[]): AuditSummary {
  const s: AuditSummary = { tagged: rows.length, byKind: {}, mainly: 0, mixed: 0, noData: 0, perStadsdeel: {} };
  for (const r of rows) {
    s.byKind[r.kind] = (s.byKind[r.kind] ?? 0) + 1;
    const d = (s.perStadsdeel[r.stadsdeel] ??= { tagged: 0, mainly: 0, mixed: 0, noData: 0 });
    d.tagged++;
    if (r.housing === 'mainly-residential') { s.mainly++; d.mainly++; }
    else if (r.housing === 'mixed-residential') { s.mixed++; d.mixed++; }
    else if (r.housing === 'no-vbo-data') { s.noData++; d.noData++; }
  }
  return s;
}
