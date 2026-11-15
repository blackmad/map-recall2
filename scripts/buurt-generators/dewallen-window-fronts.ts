/**
 * De Wallen window fronts (lane R, round 17): the audit of OSM's redLight pands on open panoramas, staged as buurt kit
 * records whose ground storey is the red-light window front (src/canalRecall/groundParts/redLightFront.ts).
 *
 *   node --import tsx scripts/buurt-generators/dewallen-window-fronts.ts            dry run: counts and records
 *   node --import tsx scripts/buurt-generators/dewallen-window-fronts.ts --write    write the staged copy
 *
 * Input: data/buurt-generators/dewallen/audit.json, one row per tagged pand: a window row read on its nearest
 * street-side capture (front line, panorama, measured wall colour, the window front's span and spec), held as "read,
 * not drawn" with the reason, closed or not a window, or without a usable view.
 * Output: data/buurt-generators/dewallen/row-front.json, the staged copy publish.ts takes (`--districts=dewallen`).
 * Lanes stop here; publishing and the world recompile are the integrator's.
 *
 * Only the window front is read. The rest of each record is a plain period default, never dice: a simple cornice at
 * the 3DBAG height (at most a 3.4 m ground storey and 3.0 m uppers), storeys from that height, bays from the width
 * (one per 1.6 m), the measured wall colour, white frames.
 *
 * A kit record restyles the whole house onto the cornice series, so a front whose house has a gable is held (listed
 * as read, not drawn) until the kit can keep the house's own crown: the blind test lost on a flattened gable.
 * `--with-gables` stages them anyway.
 */
import fs from 'node:fs';
import path from 'node:path';
import { redLightFrontOf, type RedLightFront } from '../../src/canalRecall/groundParts/redLightFront.ts';

type LngLat = [number, number];
type AuditFront = {
  pandId: string; frontLine: [LngLat, LngLat]; lenM: number; heightM: number; panorama: string; capturedAt: string; cameraM: number;
  wall: { hex: string; finish: 'brick' | 'paint'; source: string };
  windowFront: { a0: number; a1: number } & RedLightFront; note?: string; confidence?: string; tunedOn?: boolean;
  /** The crown read on the full-height capture; 'unread' when the capture cuts the top off. */
  crown?: 'cornice' | 'gable' | 'hip' | 'unread';
};
export type DeWallenAudit = {
  version: 1; generatedAt: string; source: string; counts: Record<string, number>;
  fronts: AuditFront[]; readNotDrawn: Array<{ pandId: string; why: string }>; notWindow: Array<{ pandId: string; why: string }>; noView: Array<{ pandId: string; why: string }>;
};

export const DEWALLEN_DIR = 'data/buurt-generators/dewallen';
/** Period defaults for the parts the audit does not read. */
export const DEWALLEN_DEFAULTS = { groundM: 3.4, upperM: 3.0, bayM: 1.6, maxBays: 4, minStoreys: 2, maxStoreys: 6, year: 1880 } as const;

export function storeysFor(heightM: number): number {
  const D = DEWALLEN_DEFAULTS;
  return Math.max(D.minStoreys, Math.min(D.maxStoreys, Math.round((heightM - D.groundM) / D.upperM) + 1));
}

/** One staged record for an audited window front; null when the read front does not validate. */
export function recordFor(f: AuditFront, generatedAt: string): Record<string, unknown> | null {
  const D = DEWALLEN_DEFAULTS, spec = redLightFrontOf(f.windowFront), { a0, a1 } = f.windowFront;
  if (!spec || !(a0 >= 0 && a1 <= 1 && a1 - a0 > 0.05) || !(f.heightM > 5)) return null;
  const storeys = storeysFor(f.heightM), topM = +Math.min(f.heightM, D.groundM + (storeys - 1) * D.upperM).toFixed(2);
  const bays = Math.max(1, Math.min(D.maxBays, Math.round(f.lenM / D.bayM)));
  const id = f.pandId.slice(-6);
  return {
    pandId: f.pandId, topM, eavesM: topM, crown: { family: 'cornice' }, storeys, bays, confidence: f.confidence === 'low' ? 0.2 : 0.3,
    sources: {
      record: `buurt-generator dewallen ${generatedAt}: window front read on ${f.panorama} (${f.capturedAt}, ${f.cameraM} m)`,
      windowFront: `read: span ${a0}-${a1}, ${spec.doors ?? 'fitted'} doors, tube ${spec.tube ?? 'run'}, curtains ${spec.curtains ?? 'drawn'}${f.note ? `; ${f.note}` : ''}`,
      eaves: `period-default: simple cornice at the 3DBAG height ${f.heightM} m, at most ${D.groundM} m + ${D.upperM} m a storey`,
      series: `period-default: ${storeys} storeys from the height, ${bays} bays from ${f.lenM} m, white frames`,
      wall: f.wall.source,
    },
    series: { id: `dewallen-${id}:s0`, cornice: 'simple', roofStorey: { kind: 'none', riseM: 0, dormers: [] }, windowShare: 0.6,
      look: { bays, year: D.year, heightM: topM, seed: `dewallen-${id}`, whiteFrames: true, sash: 'transom' } },
    wall: { hex: f.wall.hex, source: 'measured', finish: f.wall.finish },
    buurtKit: { frontLine: f.frontLine, erkers: [], copingHex: f.wall.hex, windowFronts: [{ a0, a1, ...spec }] },
  };
}

/** Why a read front is held rather than staged; null when it is staged. */
export function heldWhy(f: AuditFront, withGables = false): string | null {
  return f.crown === 'gable' && !withGables
    ? 'gable: a kit record restyles the house onto a flat cornice, and the blind test lost on a flattened gable' : null;
}

/** The staged records and the held fronts for an audit. */
export function stage(audit: DeWallenAudit, withGables = false) {
  const records: Array<Record<string, unknown>> = [], held: Array<{ pandId: string; why: string }> = [];
  for (const f of audit.fronts) {
    const why = heldWhy(f, withGables), r = why ? null : recordFor(f, audit.generatedAt);
    if (r) records.push(r); else held.push({ pandId: f.pandId, why: why ?? 'front does not validate' });
  }
  return { records, held };
}

function main(): void {
  const audit = JSON.parse(fs.readFileSync(path.join(DEWALLEN_DIR, 'audit.json'), 'utf8')) as DeWallenAudit;
  const { records, held } = stage(audit, process.argv.includes('--with-gables'));
  console.log(JSON.stringify(audit.counts), `staged ${records.length}/${audit.fronts.length} window fronts`);
  for (const h of held) console.log(`  held: ${h.pandId} (${h.why})`);
  if (!process.argv.includes('--write')) return;
  fs.writeFileSync(path.join(DEWALLEN_DIR, 'row-front.json'), JSON.stringify({ version: 1, district: 'dewallen', generatedAt: audit.generatedAt, held, records }, null, 1) + '\n');
  console.log(`wrote ${DEWALLEN_DIR}/row-front.json`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
