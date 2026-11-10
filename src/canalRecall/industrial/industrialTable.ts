/**
 * The industrial table (industrialClass.ts, built offline by scripts/industrial/build-industrial-buildings.ts) and its
 * tile enricher: stamps `industrial: 'tank' | 'silo' | 'shed' | 'office'` on each building it names. The enricher is
 * composed into gameTileEnricher.ts, so the own engine's live tiles and the world compiler's baked cells agree. A
 * missing or malformed table changes nothing.
 */
import { INDUSTRIAL_KINDS, type IndustrialKind } from './industrialClass.js';

export const INDUSTRIAL_FILE = 'industrial-buildings.json';

export interface IndustrialTable {
  version: 1;
  source: string;
  /** Building id (tile feature id) -> kind. */
  ids: Record<string, IndustrialKind>;
}

export const isIndustrialTable = (t: unknown): t is IndustrialTable =>
  !!t && typeof t === 'object' && (t as IndustrialTable).version === 1 && typeof (t as IndustrialTable).ids === 'object' && (t as IndustrialTable).ids !== null;

interface Feature { properties: Record<string, unknown> }

/** Stamp the table's kinds on one tile's features in place; returns how many were stamped. */
export function applyIndustrial(features: Feature[], table: IndustrialTable): number {
  let n = 0;
  for (const f of features) {
    const kind = table.ids[String(f.properties?.id ?? '')];
    if (kind && (INDUSTRIAL_KINDS as readonly string[]).includes(kind)) { f.properties.industrial = kind; n++; }
  }
  return n;
}

type Enricher = (tile: { z: number; x: number; y: number }, signal: AbortSignal) => Promise<((features: Feature[]) => void) | undefined | void>;

/** The table, fetched once per extract path. */
export function industrialEnricher(extractPath: string, fetchJson: (url: string) => Promise<unknown> = url => fetch(url).then(r => (r.ok ? r.json() : null))): Enricher {
  let table: Promise<IndustrialTable | null> | null = null;
  return async () => {
    table ??= fetchJson(`${extractPath.replace(/\/$/, '')}/${INDUSTRIAL_FILE}`).then(t => (isIndustrialTable(t) ? t : null)).catch(() => null);
    const t = await table;
    return t ? (features: Feature[]) => { applyIndustrial(features, t); } : undefined;
  };
}
