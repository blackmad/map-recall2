/**
 * Design units under option A (#397, approved 2026-11-19), Gordel layer dry run: do the AHN-split segments agree with
 * the published row fronts David liked (Rivierenbuurt, Apollo/Stadion)?
 *
 *   node --import tsx scripts/design-units/build-segments.ts --layers=gordel --tag=gordel
 *   node --import tsx scripts/design-units/gordel-check.ts [--tag=gordel]
 *
 * A unit holding two or more published records disagrees when one segment holds two records the liked look draws as
 * different designs (storeys, crown family, or an eaves step over 0.8 m; the controls.ts rule). Phase 0's estimate for
 * a split at measured steps was 85 of 480 units (18 %). Pands not in a multi-pand segment draw alone (no disagreement).
 * Writes artifacts/design-units/staging/gordel-check.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DesignUnit } from '../../src/canalRecall/designUnits/types.ts';
import type { Segment } from '../../src/canalRecall/designUnits/segments.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const tag = process.argv.find(a => a.startsWith('--tag='))?.slice(6) ?? 'gordel';
const units = (JSON.parse(fs.readFileSync(path.join(STAGING, 'design-units.json'), 'utf8')).units as DesignUnit[]).filter(u => u.object?.key.startsWith('gordel:'));
const segs = JSON.parse(fs.readFileSync(path.join(STAGING, `segments-${tag}.json`), 'utf8')).segments as Segment[];
const segOf = new Map<string, Segment>();
for (const s of segs) for (const m of s.members) segOf.set(m, s);
type Rec = { pandId: string; storeys?: number; eavesM?: number; crown?: { family?: string }; series?: { id: string } };
const norm = (s: string) => s.replace(/^NL\.IMBAG\.Pand\./, '');
const recOf = new Map((JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/front-records/row-front.json'), 'utf8')).records as Rec[]).filter(r => r.series?.id).map(r => [norm(r.pandId), r]));
const differ = (a: Rec, b: Rec) => (a.storeys ?? -1) !== (b.storeys ?? -1) || (a.crown?.family ?? '') !== (b.crown?.family ?? '') || Math.abs((a.eavesM ?? 0) - (b.eavesM ?? 0)) > 0.8;
const why = (a: Rec, b: Rec) => [(a.storeys ?? -1) !== (b.storeys ?? -1) ? `storeys ${a.storeys}/${b.storeys}` : '', (a.crown?.family ?? '') !== (b.crown?.family ?? '') ? `crown ${a.crown?.family}/${b.crown?.family}` : '', Math.abs((a.eavesM ?? 0) - (b.eavesM ?? 0)) > 0.8 ? `eaves ${a.eavesM}/${b.eavesM}` : ''].filter(Boolean).join(', ');

let held = 0, unitDisagree = 0, pandsHeld = 0, pandsInDisagree = 0;
const worst: Array<{ unit: string; segment: string; members: number; recs: number; badPairs: number; why: string }> = [];
for (const u of units) {
  const rs = u.members.filter(m => recOf.has(m));
  if (rs.length < 2) continue;
  held++; pandsHeld += rs.length;
  let bad = 0, worstSeg = '', example = '';
  const bySeg = new Map<string, string[]>();
  for (const m of rs) { const s = segOf.get(m); if (s) (bySeg.get(s.id) ?? bySeg.set(s.id, []).get(s.id)!).push(m); }
  for (const [sid, ms] of bySeg) for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const a = recOf.get(ms[i])!, b = recOf.get(ms[j])!;
    if (differ(a, b)) { bad++; if (!example) { worstSeg = sid; example = `${ms[i].slice(-6)} vs ${ms[j].slice(-6)}: ${why(a, b)}`; } }
  }
  if (bad) { unitDisagree++; pandsInDisagree += rs.length; worst.push({ unit: u.id, segment: worstSeg, members: u.members.length, recs: rs.length, badPairs: bad, why: example }); }
}
worst.sort((a, b) => b.badPairs - a.badPairs);
const out = { layer: 'gordel', units: units.filter(u => u.members.length > 1).length, segments: segs.length,
  unitsHoldingLiked: held, unitsDisagree: unitDisagree, share: +(unitDisagree / Math.max(1, held)).toFixed(3),
  pandsHoldingLiked: pandsHeld, pandsInDisagreeingUnits: pandsInDisagree, phase0Estimate: '85 of 480 (18%)', worst10: worst.slice(0, 10) };
fs.writeFileSync(path.join(STAGING, 'gordel-check.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
