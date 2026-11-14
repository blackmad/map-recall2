/**
 * Column 3 of the Haarlemmerdijk renderer sheet: canal-house intents (the recipe compiler's input, route C's builder)
 * drawn straight from the front records, so the kit model carries the measured front height, rows, bays, crown and wall
 * colour instead of the type template's. Writes scratch house directories only; never installs or publishes.
 *
 *   node --import tsx <this> --table data/front-records/haarlemmerdijk-block.json --face haarlemmerdijk-2-58 \
 *        --houses <checkout>/scripts/building-recipes/houses [--base <checkout>/scripts/building-recipes/houses/spec-0363100012167816]
 *
 * Each record with a measured front top becomes houses/l2-<pand>/intent.json: the pand's own installed spec intent when
 * one exists (shopfront, palette trims, roof), else the base intent; then the record overrides storeys, storey heights
 * (metres, from the rows), window heights and head lines (from the rows), bays, eavesHeight (the front top on the
 * pand's own ground), the gable, crown rise and the brick (the strip's raw wall median). facts.json is left to
 * scripts/building-recipes/facts.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import type {FrontRecord, FrontRecordTable} from '../../src/canalRecall/houseLine/frontRecord.ts';

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const table: FrontRecordTable = JSON.parse(fs.readFileSync(opt('table')!, 'utf8'));
const houses = opt('houses')!, face = opt('face')!;
const baseDir = opt('base') ?? path.join(houses, 'spec-0363100012167816');
const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const GABLE: Record<string, string> = {'straight-cornice': 'cornice', 'flat-parapet': 'cornice', neck: 'neck', bell: 'bell', point: 'point', step: 'step', spout: 'spout', other: 'cornice', 'raised-dormer-hoist': 'cornice'};

export function intentFor(rec: FrontRecord, base: any): {intent: any; notes: string[]} {
  const notes: string[] = [];
  const intent = structuredClone(base);
  intent.id = `l2-${rec.pandId}`; intent.pandId = rec.pandId; intent.address = rec.address;
  intent.sources = [{id: 'lane2-front-record', kind: 'street-panorama', capturedAt: '2022-12-15'}];
  const f = intent.fronts[0];
  if (rec.street) f.street = rec.street; // the base intent is a Haarlemmerdijk house: facts.ts picks the front wall by this street
  const lift = (rec.groundNAP ?? rec.streetGroundNAP) - rec.streetGroundNAP; // pand ground over the street
  const top = rec.frontTopM!;
  f.eavesHeight = r2(top - lift);
  if (rec.bays) f.bays = rec.bays;
  const gable = GABLE[rec.crown.family ?? 'other'];
  f.gable = gable;
  for (const k of ['crownCap', 'crownCapSpan', 'crownCapRise', 'crownRise', 'atticWindows']) delete f[k];
  if (gable === 'cornice') {
    f.cornice = rec.crown.family === 'flat-parapet' ? 'none' : f.cornice && f.cornice !== 'none' ? f.cornice : 'simple';
    if (rec.crown.dormer && rec.crown.dormer.topM !== null && ['crowned', 'pediment'].includes(rec.crown.dormer.kind)) { f.crownCap = 'pediment'; f.crownCapSpan = 'narrow'; }
  } else {
    f.cornice = 'none';
    if (rec.crown.atticWindows) f.atticWindows = Math.min(rec.crown.atticWindows, 2);
  }
  if (rec.storeys && rec.rows.length === rec.storeys - 1) {
    const rows = rec.rows, n = rec.storeys;
    const bounds = [0, rec.groundStoreyTopM ?? r2(rows[0].sillM - 0.4)];
    for (let i = 0; i < rows.length - 1; i++) bounds.push(r2((rows[i].headM + rows[i + 1].sillM) / 2));
    bounds.push(top);
    const h = bounds.slice(1).map((b, i) => r2(b - bounds[i]));
    if (h.every(x => x > 0.8)) {
      f.storeys = n; f.storeyHeights = h;
      const wh = [Array.isArray(f.windowHeights) ? f.windowHeights[0] : 0.55], hl = [Array.isArray(f.headLines) ? f.headLines[0] : 0.8];
      rows.forEach((r, i) => { const z = bounds[i + 1], hh = h[i + 1]; hl.push(r2(clamp((r.headM - z) / hh, 0.4, 0.98))); wh.push(r2(clamp((r.headM - r.sillM) / hh, 0.15, 0.9))); });
      f.windowHeights = wh; f.headLines = hl;
    } else notes.push(`rows give a storey under 0.8 m (${h}); template storeys kept`);
  } else if (rec.storeys) { f.storeys = rec.storeys; delete f.storeyHeights; f.windowHeights = 'diminishing'; delete f.headLines; notes.push('no complete rows: storeys only'); }
  if (gable !== 'cornice' && rec.crown.topM !== null && f.storeyHeights) {
    const upper = f.storeyHeights.slice(1), mean = upper.reduce((a: number, b: number) => a + b, 0) / upper.length;
    f.crownRise = r2(clamp((rec.crown.topM - top) / mean, 0.3, 3));
  }
  if (rec.wall.hex) intent.palette = {...intent.palette, brick: rec.wall.hex};
  intent.notes = [`lane2 front record ${rec.pandId}: front top ${top} m above the street (${f.eavesHeight} m on the pand's ground), crown ${rec.crown.family}, ${rec.confidence}`];
  return {intent, notes};
}

const base = JSON.parse(fs.readFileSync(path.join(baseDir, 'intent.json'), 'utf8'));
for (const rec of table.records.filter(r => r.face === face && r.frontTopM !== null)) {
  const own = path.join(houses, `spec-${rec.pandId}`, 'intent.json');
  const b = fs.existsSync(own) ? JSON.parse(fs.readFileSync(own, 'utf8')) : base;
  const {intent, notes} = intentFor(rec, b);
  const dir = path.join(houses, `l2-${rec.pandId}`);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
  console.log(rec.pandId, rec.address, fs.existsSync(own) ? 'own spec' : 'base', notes.join('; '));
}
