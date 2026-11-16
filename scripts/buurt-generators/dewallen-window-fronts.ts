/**
 * De Wallen window fronts (lane R, rounds 17-18): the audit of OSM's redLight pands on open panoramas, as buurt kit
 * records whose ground storey is the red-light window front (src/canalRecall/groundParts/redLightFront.ts).
 *
 *   node --import tsx scripts/buurt-generators/dewallen-window-fronts.ts            dry run: counts and records
 *   node --import tsx scripts/buurt-generators/dewallen-window-fronts.ts --write    write a preview copy (artifacts/)
 *
 * Input: data/buurt-generators/dewallen/audit.json, one row per tagged pand: a window row read on its nearest
 * street-side capture (front line, panorama, measured wall colour, the window front's span and spec, and since round 18
 * the bays and the crown read on the full-height crop), held as "read, not drawn" with the reason, closed or not a
 * window, or without a usable view.
 * Round 18: De Wallen is not staged for publishing (the retail lane draws these fronts ground-only from the audit); the
 * records here are the renderer's pins for a kit record that keeps its own crown (177899, 178478) and takes its bays
 * from the read, and the preview copy goes to artifacts/buurt-generators/dewallen/row-front.json for the sheets.
 *
 * Every part is read or a plain period default, never dice: a gable read on the crop is the record's crown (its foot
 * the eaves, its apex the top, the storeys under the foot as read); a hipped roof with dormers over the cornice is the
 * series' roof storey; otherwise a simple cornice at the 3DBAG height (at most a 3.4 m ground storey and 3.0 m uppers),
 * storeys from that height. Bays as read, else one per 1.6 m of width. The measured wall colour, white frames.
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
  /** Round 18: the window axes on the first upper storey, read on the full-height crop. */
  bays?: number;
  /** Round 18: the gable read on the crop: its shape, foot and apex over the pavement (m), the storeys under the foot. */
  gable?: { shape: 'neck' | 'bell' | 'point' | 'step'; footM: number; topM: number; storeys: number };
  /** Round 18: a hipped roof with dormers over the cornice, read on the crop (eaves, the rise as seen, the tile tone). */
  roof?: { kind: 'hip'; eavesM: number; riseM: number; dormers: number; storeys: number; roofHex: string };
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

/** One record for an audited window front; null when the read front does not validate. */
export function recordFor(f: AuditFront, generatedAt: string): Record<string, unknown> | null {
  const D = DEWALLEN_DEFAULTS, spec = redLightFrontOf(f.windowFront), { a0, a1 } = f.windowFront;
  if (!spec || !(a0 >= 0 && a1 <= 1 && a1 - a0 > 0.05) || !(f.heightM > 5)) return null;
  const g = f.gable, hip = f.roof;
  const storeys = g ? g.storeys : hip ? hip.storeys : storeysFor(f.heightM);
  const eavesM = g ? g.footM : hip ? hip.eavesM : +Math.min(f.heightM, D.groundM + (storeys - 1) * D.upperM).toFixed(2);
  const topM = g ? g.topM : eavesM;
  const bays = f.bays ?? Math.max(1, Math.min(D.maxBays, Math.round(f.lenM / D.bayM)));
  const id = f.pandId.slice(-6);
  const roofStorey = hip ? { kind: 'mansard', riseM: hip.riseM, material: 'tile', dormers: Array.from({ length: hip.dormers }, (_, i) => ({ a: +((i + 0.5) / hip.dormers).toFixed(3), kind: 'plain' })) } : { kind: 'none', riseM: 0, dormers: [] };
  return {
    pandId: f.pandId, topM, eavesM, crown: { family: g ? g.shape : 'cornice' }, storeys, bays, confidence: f.confidence === 'low' ? 0.2 : 0.3,
    sources: {
      record: `buurt-generator dewallen ${generatedAt}: window front read on ${f.panorama} (${f.capturedAt}, ${f.cameraM} m)`,
      windowFront: `read: span ${a0}-${a1}, ${spec.doors ?? 'fitted'} doors, tube ${spec.tube ?? 'run'}, curtains ${spec.curtains ?? 'drawn'}${f.note ? `; ${f.note}` : ''}`,
      eaves: g ? `read: a ${g.shape} gable, foot ${g.footM} m and apex ${g.topM} m on the full-height crop` : hip ? `read: the cornice at ${hip.eavesM} m under a hipped tile roof (seen rise ${hip.riseM} m, ${hip.dormers} dormer)` : `period-default: simple cornice at the 3DBAG height ${f.heightM} m, at most ${D.groundM} m + ${D.upperM} m a storey`,
      series: `${g || hip ? `read: ${storeys} storeys` : `period-default: ${storeys} storeys from the height`}, ${f.bays ? `${bays} bays read on the crop` : `period-default: ${bays} bays from ${f.lenM} m`}, white frames`,
      wall: f.wall.source,
    },
    series: { id: `dewallen-${id}:s0`, cornice: 'simple', roofStorey, windowShare: 0.6,
      look: { bays, year: D.year, heightM: eavesM, seed: `dewallen-${id}`, whiteFrames: true, sash: 'transom' } },
    wall: { hex: f.wall.hex, source: 'measured', finish: f.wall.finish },
    buurtKit: { frontLine: f.frontLine, erkers: [], ...(hip ? { roof: { pitchDeg: 45, riseM: hip.riseM, roofHex: hip.roofHex } } : { copingHex: f.wall.hex }), windowFronts: [{ a0, a1, ...spec }] },
  };
}

/** The records for an audit (every audited front, gabled or not: round 18 keeps the crown). */
export function stage(audit: DeWallenAudit) {
  const records: Array<Record<string, unknown>> = [], held: Array<{ pandId: string; why: string }> = [];
  for (const f of audit.fronts) { const r = recordFor(f, audit.generatedAt); if (r) records.push(r); else held.push({ pandId: f.pandId, why: 'front does not validate' }); }
  return { records, held };
}

function main(): void {
  const audit = JSON.parse(fs.readFileSync(path.join(DEWALLEN_DIR, 'audit.json'), 'utf8')) as DeWallenAudit;
  const { records, held } = stage(audit);
  console.log(JSON.stringify(audit.counts), `${records.length}/${audit.fronts.length} window fronts as records (not staged for publishing)`);
  for (const h of held) console.log(`  held: ${h.pandId} (${h.why})`);
  if (!process.argv.includes('--write')) return;
  const out = 'artifacts/buurt-generators/dewallen/row-front.json';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ version: 1, district: 'dewallen', generatedAt: audit.generatedAt, held, records }, null, 1) + '\n');
  console.log(`wrote ${out} (a preview copy; publish.ts never reads it)`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
