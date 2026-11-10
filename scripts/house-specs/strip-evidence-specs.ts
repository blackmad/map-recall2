/**
 * Strip-evidence HouseSpecs for a block face's held pands (house line, belt lanes): what the rectified street panorama
 * measured per pand (`auto-place.json` pands[].strip) written as a small spec, so the generic path draws the house's own
 * window columns and wall colour instead of the type default. Register facts (gable, year, finish) join at publish
 * (build-house-specs resolves them), so none are copied here. Existing specs in scripts/house-specs/specs/ are never
 * overwritten. Fields: `fronts/0/bays` (strip columns, only where the strip read 1..8 columns and the front is not a
 * curtain wall), `palette/brick` (the trim-normalised wall, only for a brick-family front: not stucco, not near-neutral).
 *
 *   node --import tsx scripts/house-specs/strip-evidence-specs.ts <face,face,...> [--dry]
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {specProblems, type HouseSpec} from '../../src/canalRecall/houseSpec/spec.ts';

const HELP = `strip-evidence-specs: write measured strip evidence of a block face's pands as HouseSpecs.

  node --import tsx scripts/house-specs/strip-evidence-specs.ts <face,face,...> [--dry]
  --dry    print the specs, write nothing
  --help   this text

Reads scripts/block-face/faces/<face>/auto-place.json; writes scripts/house-specs/specs/<pandId>.json for every pand with
no spec file yet (source streetlevel-measured, confidence 0.5, ref = the face's strip). Fields: fronts/0/bays, palette/brick.`;
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const dry = process.argv.includes('--dry');
const faces = (process.argv.slice(2).find(a => !a.startsWith('--')) ?? '').split(',').filter(Boolean);
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
let wrote = 0, kept = 0, empty = 0;
for (const face of faces) {
  const ap = JSON.parse(readFileSync(`scripts/block-face/faces/${face}/auto-place.json`, 'utf8'));
  for (const p of ap.pands as Array<{pandId: string; address: string; stripDate?: string; strip?: {wall?: string; columns?: number | null; frontClass?: string; stucco?: boolean}}>) {
    const file = `scripts/house-specs/specs/${p.pandId}.json`;
    if (existsSync(file)) { kept++; continue; }
    const s = p.strip;
    if (!s) { empty++; continue; }
    const front: Record<string, unknown> = {};
    const provenance: HouseSpec['provenance'] = {};
    const at = (ap.stripDate as string | undefined) ?? null;
    const prov = (what: string) => ({source: 'streetlevel-measured' as const, confidence: 0.5, ref: `strip ${face} ${at ?? ''} ${what}`.trim(), at});
    if (typeof s.columns === 'number' && s.columns >= 1 && s.columns <= 8 && s.frontClass !== 'curtain') { front.bays = s.columns; provenance['fronts/0/bays'] = prov('columns'); }
    const design: Record<string, unknown> = {};
    if (s.wall && !s.stucco) {
      const [r, g, b] = hex(s.wall), chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (r >= b && chroma >= 14 && s.frontClass !== 'curtain') { design.palette = {brick: s.wall}; provenance['palette/brick'] = prov('wall'); }
    }
    if (!Object.keys(front).length && !design.palette) { empty++; continue; }
    const spec: HouseSpec = {schemaVersion: 1, pandId: p.pandId, address: p.address, design: {...(Object.keys(front).length ? {fronts: [front]} : {}), ...design} as HouseSpec['design'], provenance};
    const problems = specProblems(spec);
    if (problems.length) { console.log(`${p.pandId} ${p.address}: ${problems.join('; ')}`); continue; }
    if (!dry) writeFileSync(file, JSON.stringify(spec, null, 1) + '\n');
    wrote++;
  }
}
console.log(`${dry ? 'would write' : 'wrote'} ${wrote}, kept ${kept} existing, ${empty} with no usable strip evidence`);
