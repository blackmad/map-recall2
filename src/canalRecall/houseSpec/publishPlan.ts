/**
 * The pure parts of `house:publish` (house line H3, docs/house-line.md section 3): what a batch changed in the tiled
 * extract, which tiles and cells it touched, which pands it newly suppresses, the suppression guard, and the golden
 * allow-list. No file access; scripts/house-specs/publish.ts feeds these and runs the commands.
 */
import { CoversFile, coversHides } from '../world/tileCovers.ts';

export type TileRecord = Record<string, unknown>;
export type TileFile = { version: number; buildings: Record<string, TileRecord> };

/** Dotted leaf paths of a JSON value that differ, `path: old -> new` (arrays are leaves of their own index). */
export function diffRecord(before: unknown, after: unknown, at = ''): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(before) && isObj(after)) {
    const out: string[] = [];
    for (const k of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) out.push(...diffRecord(before[k], after[k], at ? `${at}.${k}` : k));
    return out;
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) return before.flatMap((v, i) => diffRecord(v, after[i], `${at}[${i}]`));
  const show = (v: unknown) => (v === undefined ? '(absent)' : JSON.stringify(v));
  return [`${at}: ${show(before)} -> ${show(after)}`];
}

export type PandDiff = { pand: string; feature: string; tile: string; change: 'added' | 'changed' | 'removed'; fields: string[] };

/** Every pand whose record differs between the published and the staged tiles, with the touched tile list. */
export function diffTiles(published: ReadonlyMap<string, TileFile>, staged: ReadonlyMap<string, TileFile>): { pands: PandDiff[]; touchedTiles: string[] } {
  const pands: PandDiff[] = [], touched = new Set<string>();
  for (const tile of [...new Set([...published.keys(), ...staged.keys()])].sort()) {
    const a = published.get(tile)?.buildings ?? {}, b = staged.get(tile)?.buildings ?? {};
    for (const feature of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const fields = diffRecord(a[feature], b[feature]);
      if (!fields.length) continue;
      touched.add(tile);
      pands.push({ pand: feature.replace(/^NL\.IMBAG\.Pand\./, ''), feature, tile, change: !a[feature] ? 'added' : !b[feature] ? 'removed' : 'changed', fields });
    }
  }
  return { pands, touchedTiles: [...touched] };
}

/** Pands the extract rebuild changed that no staged spec asked for (and --allow-extra did not name). */
export const extraPands = (diff: readonly PandDiff[], batch: ReadonlySet<string>, allowExtra: ReadonlySet<string>): PandDiff[] =>
  diff.filter(d => !batch.has(d.pand) && !allowExtra.has(d.pand));

/** The cell keys that list any of the tiles (index.json tileCells), sorted. */
export const cellsOfTiles = (tileCells: Record<string, string[]>, tiles: readonly string[]): string[] =>
  [...new Set(tiles.flatMap(t => tileCells[t] ?? []))].sort();

/** Pands (16 digits) that covers.json hides by pand id, per model. */
export function coveredPands(covers: CoversFile): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const h of coversHides(covers).values()) if (h.id.startsWith('NL.IMBAG.Pand.')) out.set(h.id.slice('NL.IMBAG.Pand.'.length), h.models);
  return out;
}

/** Pands a covers.json change newly hides or releases or moves to another model: the batch's installs. */
export function coversDelta(before: CoversFile, after: CoversFile): { added: string[]; removed: string[]; moved: string[] } {
  const a = coveredPands(before), b = coveredPands(after);
  return {
    added: [...b.keys()].filter(p => !a.has(p)).sort(),
    removed: [...a.keys()].filter(p => !b.has(p)).sort(),
    moved: [...b.keys()].filter(p => a.has(p) && a.get(p)!.join() !== b.get(p)!.join()).sort(),
  };
}

/** One wall of the #341 suppressed-faces audit (scripts/house-audit/suppressed-faces.ts, `walls[]` of its JSON). */
export interface AuditWall { pand: string; street: string; lengthM: number; cls: 'blank' | 'stops-short' | 'drawn'; model?: string }
/** What the suppression guard needs from the audit: run it on the current checkout and give back its walls.
 *  The implementation (publish.ts) shells out to the audit script; a fake stands in for it in the tests. */
export interface SuppressionAudit { run(): Promise<AuditWall[]> }

export const MIN_BLANK_WALL_M = 4;

/** Street-facing walls of the suppressed pands that are left blank (no outward geometry, or a bare slab) and at least
 *  `minLenM` long. `stops-short` walls (blank only at the roof maximum) are a setback, not a blank wall: they pass. */
export function suppressionViolations(walls: readonly AuditWall[], suppressed: ReadonlySet<string>, minLenM = MIN_BLANK_WALL_M): AuditWall[] {
  return walls.filter(w => suppressed.has(w.pand) && w.cls === 'blank' && !!w.street && w.lengthM >= minLenM).sort((a, b) => b.lengthM - a.lengthM);
}

export const describeViolation = (w: AuditWall): string => `${w.pand}  ${w.street}  ${w.lengthM} m blank${w.model ? ` (${w.model})` : ''}`;

/** Golden allow-list ids for a batch: its pand ids plus the house directories, block faces and block-kit specs that
 *  mention one (the goldens key on those, not on pand ids). `mentions` maps an id to the pand ids it contains. */
export function allowIdsFor(pands: ReadonlySet<string>, mentions: ReadonlyMap<string, readonly string[]>): string[] {
  const ids = new Set<string>(pands);
  for (const [id, inside] of mentions) if (inside.some(p => pands.has(p))) ids.add(id);
  return [...ids].sort();
}

/** `YYYYMMDD-HHMM` batch names; `--batch` overrides. */
export const defaultBatchName = (now = new Date()): string => `batch-${now.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2')}`;

/** The wall-clock budget the gate is measured against (brief: a 50-spec batch under 15 minutes). */
export const BATCH_BUDGET_MS = 15 * 60 * 1000;

/** held-installs.json with `id` held for a staged spec (stale-installs.ts reads `held[id]`). Pure; the caller writes it. */
export function withHold(held: { held?: Record<string, string>; [k: string]: unknown }, id: string, date: string): { held: Record<string, string>; [k: string]: unknown } {
  return { ...held, held: { ...(held.held ?? {}), [id]: `staged spec ${date}` } };
}

type IntentLike = { id?: string; sources?: Array<{ id: string }>; [k: string]: unknown };
/** The intent for a recipe-route spec that edits an installed house: the spec's complete intent (toRecipe) under the
 *  house's own id, with the house's earlier sources kept in front of the spec's new ones (deduplicated by source id). */
export function mergeRecipeIntent(existing: IntentLike | null, generated: IntentLike, houseId: string): IntentLike {
  const sources = [...(existing?.sources ?? [])];
  for (const s of generated.sources ?? []) if (!sources.some(e => e.id === s.id)) sources.push(s);
  return { ...generated, id: houseId, sources };
}
