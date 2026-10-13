/**
 * Research (throwaway, 2026-10-10): how much of each authored block face could share geometry if a house were split
 * into a repeated UPPER module (storeys, bays, balconies, bay windows, bands, cornice, crown) and a per-house GROUND
 * module (shopfront / groundFront / door / basement), vs today's whole-house rule (blockFace/instancing.ts).
 *
 *   node --import tsx scripts/research/upper-module-sharing.ts [--tolerance=0.3]
 *
 * Reads scripts/block-face/faces/<face>/{intent,strip}.json and staging/block-face/<face>/report.json (run
 * scripts/block-face/compile.ts --face=<face> first). Prints, per face:
 *   whole   = houses in groups of identical whole-house design at the same fitted size (today's plan)
 *   upper   = houses whose upper module (ground fields + palette removed; mirror allowed) is shared at the same size
 *   typeAny = houses whose upper module shares a TYPE regardless of size (generator reuse: author once, fit per house)
 *   body    = houses whose BODY (upper minus the crown slot, bay weights to 0.1) is shared at the same size; crowns counted apart
 * Not a gate. No outputs written.
 */
import fs from 'node:fs';
import path from 'node:path';
import {houseIntents, type BlockFaceIntent} from '../../src/canalRecall/blockFace/intent.ts';
import {canonicalIntentKey} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {mirrorIntent} from '../../src/canalRecall/buildingRecipe/instances.ts';
import type {CanalHouseIntent} from '../../src/canalRecall/buildingRecipe/intent.ts';

const tol = Number(process.argv.find(a => a.startsWith('--tolerance='))?.slice(12)) || 0.3;
const FACES = 'scripts/block-face/faces';

/** Upper module: drop everything that belongs to the ground storey or to colour. */
function upperOnly(intent: CanalHouseIntent): CanalHouseIntent {
  return {...intent, palette: {} as any, fronts: intent.fronts.map(f => {
    const {shopfront, groundFront, doorBay, basement, shutters, ...rest} = f as any;
    return {...rest, doorBay: null, basement: 'none'};
  })};
}
const CROWN = ['gable', 'crownCap', 'crownCapSpan', 'crownCapRise', 'crownAt', 'crownBays', 'crownRise', 'crownSteps', 'crownFinial', 'atticWindows', 'atticShape', 'dormers', 'dormerStyle', 'gableOrnament', 'roofFront', 'crownGroups', 'tower', 'hoist'];
/** Body module: upper storeys only (crown slot removed); bay weights quantised to 0.1 so authoring noise does not split a type. */
function bodyOnly(intent: CanalHouseIntent): CanalHouseIntent {
  return {...intent, roof: {} as any, fronts: intent.fronts.map(f => {
    const out: any = {...f};
    for (const k of CROWN) delete out[k];
    if (out.bayWidths) { const t = out.bayWidths.reduce((a: number, b: number) => a + b, 0); out.bayWidths = out.bayWidths.map((w: number) => Math.round(10 * w / t) / 10); }
    return out;
  })};
}
function crownOnly(intent: CanalHouseIntent): string {
  return JSON.stringify(intent.fronts.map(f => Object.fromEntries(CROWN.filter(k => (f as any)[k] !== undefined).map(k => [k, (f as any)[k]]))));
}
const keyOf = (i: CanalHouseIntent) => canonicalIntentKey(i);
const mirrorKey = (i: CanalHouseIntent) => { const m = mirrorIntent(i); return m ? keyOf(m) : null; };

let tot = {houses: 0, whole: 0, upper: 0, typeAny: 0, body: 0, tris: 0};
const rows: string[] = [];
for (const face of fs.readdirSync(FACES).sort()) {
  const reportPath = path.join('staging/block-face', face, 'report.json');
  if (!fs.existsSync(reportPath)) { rows.push(`${face}: no staging report (compile it first)`); continue; }
  const intent = JSON.parse(fs.readFileSync(path.join(FACES, face, 'intent.json'), 'utf8')) as BlockFaceIntent;
  const strip = JSON.parse(fs.readFileSync(path.join(FACES, face, 'strip.json'), 'utf8'));
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  let intents: CanalHouseIntent[];
  try { intents = houseIntents(intent); } catch (e) { rows.push(`${face}: ${(e as Error).message}`); continue; }
  const width = new Map<string, number>(strip.spans.map((s: any) => [s.pandId, s.x1M - s.x0M]));
  const per = new Map<string, any>(report.perPand.map((p: any) => [p.pand, p]));
  const n = intents.length;
  const up = intents.map(upperOnly), upKey = up.map(keyOf), upMirror = up.map(mirrorKey);
  const sameType = (a: number, b: number) => upKey[a] === upKey[b] || upMirror[b] === upKey[a];
  const sameSize = (a: number, b: number) => {
    const A = per.get(intents[a].pandId), B = per.get(intents[b].pandId);
    const wa = width.get(intents[a].pandId) ?? NaN, wb = width.get(intents[b].pandId) ?? NaN;
    return Math.abs(wa - wb) <= tol && Math.abs(A.eavesM - B.eavesM) <= tol;
  };
  const groupCount = (pred: (a: number, b: number) => boolean) => {
    const taken = new Set<number>(); let shared = 0, groups = 0;
    for (let i = 0; i < n; i++) {
      if (taken.has(i)) continue;
      const m = [i];
      for (let j = i + 1; j < n; j++) if (!taken.has(j) && pred(i, j)) { m.push(j); taken.add(j); }
      if (m.length > 1) { shared += m.length; groups++; }
    }
    return {shared, groups};
  };
  const whole = report.instancing.groups.reduce((s: number, g: any) => s + g.members.length, 0);
  const upper = groupCount((a, b) => sameType(a, b) && sameSize(a, b));
  const typeAny = groupCount(sameType);
  const body = up.map(bodyOnly), bodyKey = body.map(keyOf), bodyMirror = body.map(mirrorKey);
  const bodyShared = groupCount((a, b) => (bodyKey[a] === bodyKey[b] || bodyMirror[b] === bodyKey[a]) && sameSize(a, b));
  const crowns = new Set(intents.map(crownOnly)).size, bodies = new Set(bodyKey).size;
  const shops = intents.filter(i => i.fronts[0].shopfront || i.fronts[0].groundFront).length;
  const widths = intents.map(i => (width.get(i.pandId) ?? 0).toFixed(1)).join(' ');
  rows.push(`${face.padEnd(22)} houses ${String(n).padStart(2)}  shops ${String(shops).padStart(2)}  whole ${String(whole).padStart(2)}  upper@size ${String(upper.shared).padStart(2)} (${upper.groups} grp)  type-any-size ${String(typeAny.shared).padStart(2)} (${typeAny.groups} grp)  body@size ${String(bodyShared.shared).padStart(2)} (${bodies} bodies, ${crowns} crowns)  tris ${report.triangles.chunk} prims ${report.primitives.chunk}  widths ${widths}`);
  tot = {houses: tot.houses + n, whole: tot.whole + whole, upper: tot.upper + upper.shared, typeAny: tot.typeAny + typeAny.shared, body: tot.body + bodyShared.shared, tris: tot.tris + report.triangles.chunk};
}
console.log(rows.join('\n'));
console.log(`TOTAL houses ${tot.houses}: whole-house shared ${tot.whole}, upper-module shared at size ${tot.upper}, upper type shared any size ${tot.typeAny}, body (crown split off) shared at size ${tot.body}; ${tot.tris} chunk tris`);
