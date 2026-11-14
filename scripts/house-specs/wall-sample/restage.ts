/**
 * Wall sample v2 on an already staged D1 batch (lane d1-wall-colour, 2026-11-14): every staged spec keeps all its fields but
 * the wall colour, which is restaged from the pand's captures (captures.ts) or its pinned sample (cuts.json `w1`, with `w1.ref`
 * when the cut has one) through src/canalRecall/houseSpec/wallSample.ts, with the receipt `facts/wallSample`. The D1 belt's
 * pale guard (lane/d1-tranche-belt-20261114 cdd0bdc6e: no colour when the reader says pale and the brick is under HSL L 0.45)
 * is applied to the v2 brick. Stage only: writes <out>/<pandId>.json and <out>/restage.json; never publishes.
 *
 *   node --import tsx scripts/house-specs/wall-sample/restage.ts --staged <dir> --answers <dir> --cuts <cuts.json>
 *        [--captures <file>[,<file>]] [--ids <file>] --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadAnswers } from '../describer-d1/score.ts';
import { wallSampleFor } from '../describer-d1/stage.ts';
import { setSpecField, specProblems, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { labOf, type CaptureSample } from '../../../src/canalRecall/houseSpec/wallSample.ts';
import { hexToRgb } from '../../../src/canalRecall/look/palette.ts';
import { rgbToHsl } from '../../../src/canalRecall/blockFace/wallColour.ts';

/** The belt pale guard's threshold (HSL L of the staged brick), as on lane/d1-tranche-belt-20261114. */
export const PALE_MIN_BRICK_L = 0.45;

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const stagedDir = opt('staged'), out = opt('out');
  if (!stagedDir || !out || !opt('answers') || !opt('cuts')) { console.error('restage.ts --staged <dir> --answers <dir> --cuts <cuts.json> [--captures f[,f]] [--ids f] --out <dir>'); process.exit(2); }
  const A = loadAnswers(opt('answers')!);
  const cuts = new Map<string, any>(JSON.parse(fs.readFileSync(opt('cuts')!, 'utf8')).rows.map((r: any) => [r.pandId, r]));
  const caps = new Map<string, CaptureSample[]>();
  for (const f of (opt('captures') ?? '').split(',').filter(Boolean)) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).rows) {
    caps.set(r.pandId, r.captures.map((c: any) => ({ hex: c.w1.hex, refs: c.refs ?? null, pinned: !!c.pinned, captured: c.captured, panoId: c.panoId })));
  }
  const ids = opt('ids') ? new Set(fs.readFileSync(opt('ids')!, 'utf8').split(/\s+/).filter(Boolean)) : null;
  fs.mkdirSync(out, { recursive: true });
  const report: any = { v: 1, specs: 0, restaged: 0, fromCaptures: 0, fromPinned: 0, paleGuarded: 0, noSample: 0, problems: {}, walls: {} };
  for (const f of fs.readdirSync(stagedDir).filter(f => /^\d{16}\.json$/.test(f))) {
    const id = f.slice(0, 16);
    if (ids && !ids.has(id)) continue;
    const spec = JSON.parse(fs.readFileSync(path.join(stagedDir, f), 'utf8')) as HouseSpec;
    report.specs++;
    const a = A.get(id) as any, w1 = cuts.get(id)?.w1;
    const before = spec.design.palette?.brick ?? null;
    if (spec.design.palette) delete spec.design.palette.brick;
    delete spec.provenance['palette/brick'];
    if (spec.facts) delete (spec.facts as any).wallExposure;
    delete spec.provenance['facts/wallExposure'];
    if (!a?.readable || !w1?.hex) { report.noSample++; if (before) { setSpecField(spec, 'palette/brick', before); } }
    else {
      const own = caps.get(id);
      const fact = wallSampleFor(w1.hex.toLowerCase(), w1.ref ?? null, own ?? null)!;
      const pale = a.pale === true && rgbToHsl(hexToRgb(fact.brick))[2] < PALE_MIN_BRICK_L;
      if (pale) report.paleGuarded++;
      else {
        const prov = { source: 'streetlevel-measured' as const, confidence: 0.6, ref: a.image?.ref, at: spec.provenance['fronts/0/storeys']?.at ?? null };
        setSpecField(spec, 'palette/brick', fact.brick); spec.provenance['palette/brick'] = { ...prov };
        setSpecField(spec, 'facts/wallSample', fact); spec.provenance['facts/wallSample'] = { ...prov };
        report.restaged++; own?.length ? report.fromCaptures++ : report.fromPinned++;
      }
      report.walls[id] = { before, raw: labOf(fact.raw), estimate: labOf(fact.estimate), drawn: labOf(fact.drawn), brick: fact.brick, captures: fact.captures.length, pale };
    }
    if (spec.design.palette && !Object.keys(spec.design.palette).length) delete spec.design.palette;
    const pr = specProblems(spec);
    if (pr.length) report.problems[id] = pr;
    fs.writeFileSync(path.join(out, f), `${JSON.stringify(spec, null, 1)}\n`);
  }
  fs.writeFileSync(path.join(out, 'restage.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ ...report, walls: Object.keys(report.walls).length, problems: Object.keys(report.problems).length }));
}
