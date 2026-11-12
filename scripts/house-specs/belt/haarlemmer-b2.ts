// Haarlemmerbuurt belt lane (#356), batch 2: HouseSpecs for the shop-houses the lane's reviewers held on Haarlemmerdijk.
// Base = fromBlockFace of the auto-placed b2 runs (scripts/block-face/faces/*-b2r<k>/intent.json, written by
// auto-place.ts --buurt=haarlemmerbuurt-west-b2 with the review holds reduced to the hard ones: infill, scaffolds, strip seams,
// shadow). Where a reviewer held a pand for a reason the kit cannot draw, the reason travels as a schema limit.
// Writes scripts/house-specs/specs/<pandId>.json. Run: node --import tsx scripts/house-specs/belt/haarlemmer-b2.ts [--help]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fromBlockFace } from '../../../src/canalRecall/houseSpec/adapters.ts';
import { withRoute } from '../../../src/canalRecall/houseSpec/toRecipe.ts';
import { setSpecField, specProblems, type SpecLimit } from '../../../src/canalRecall/houseSpec/spec.ts';
import { EAVES_PINS, roofBehindCrown } from './haarlemmer.ts';

const NINE = new Set(['0363100012167818', '0363100012167817', '0363100012167816', '0363100012176172', '0363100012176174', '0363100012171144', '0363100012171145', '0363100012173479', '0363100012173480']);
const PLACEMENT = 'scripts/block-face/buurten/haarlemmerbuurt-west-b2-placement.json';
const REVIEW = 'scripts/block-face/buurten/haarlemmerbuurt-west-review-holds.json';
/** house:preview --recipe --photo failed the wall (dL or hue: "miss") on these with the type/auto-place brick (e.g. 182 drew #b6bfc6 blue-grey against a #50473b photo); the pand's own
 *  raw strip wall reading (auto-place.json strip.wallRaw) replaces it, the way the nine of batch 1 took their winter walls. Measured, not tuned. */
const WALL_FROM_STRIP = new Set(['0363100012165073', '0363100012171346', '0363100012173469', '0363100012172755', '0363100012169538', '0363100012253819', '0363100012177659', '0363100012177590', '0363100012176104', '0363100012176103']);
/** Held after the recipe-preview contact sheet (lane read, to be confirmed by the integrator): the kit draws these as a plainer house than the photo shows. */
const HELD = new Map<string, string>([
 [
  "0363100012176573",
  "face-end cornice house outside every strip: no photo reference, the recipe preview renders blank (glazing 0)"
 ],
 [
  "0363100012171347",
  "eclectic tower front to 16.5 m, crenellated cornice and spire dormer: drawn as a plain cornice house (kit gap: tower/spire)"
 ],
 [
  "0363100012171346",
  "wide front with horizontal balcony bands and a flat roof, drawn as a neck-gable house (curtain-wall ribbon; kit gap)"
 ],
 [
  "0363100012173469",
  "beige band front with ribbon windows, drawn as a point gable (kit gap: ribbon band front)"
 ],
 [
  "0363100012173482",
  "five-storey dark front with a cornice at 13.3 m: the kit has no five-storey shop type (drawn four)"
 ],
 [
  "0363100012172757",
  "five storeys under a heavy cornice at 15.2 m, taller than the four-storey type"
 ],
 [
  "0363100012172754",
  "tall glazed front with a point gable to 20 m (kit gap: height)"
 ],
 [
  "0363100012172847",
  "balconies over a two-storey erker (kit gap: erker)"
 ],
 [
  "0363100012173014",
  "wide five-storey front with round attic lights (kit gap: round lights)"
 ],
 [
  "0363100012169538",
  "ornate stucco ornament on every storey (kit gap: stucco ornament)"
 ],
 [
  "0363100012171358",
  "ornate Jugendstil top over a neck-gable body (kit gap: ornament)"
 ],
 [
  "0363100012176572",
  "yellow-brick Jugendstil tower front (kit gap)"
 ],
 [
  "0363100012167795",
  "low front with a balustrade at 7.3-8.2 m and a set-back dormer (drawn ribbon cornice, photo punched)"
 ],
 [
  "0363100012253818",
  "modern balconied front to 15 m (kit gap: balconies)"
 ],
 [
  "0363100012167804",
  "white Jugendstil front with a tower dormer (kit gap)"
 ],
 [
  "0363100012176277",
  "orange-glazed Jugendstil front to 15 m (kit gap)"
 ],
 [
  "0363100012177584",
  "tall gold-crowned (tower) front, drawn as a plain cornice house"
 ],
 [
  "0363100012177590",
  "flat crenellated parapet over modern ribbon windows (kit gap: crenellation)"
 ],
 [
  "0363100012176104",
  "two storeys of projecting timber erkers over the shop (kit gap: erker)"
 ],
 [
  "0363100012176103",
  "ornate front with an oriel and a raised attic (kit gap: oriel)"
 ]
]);
/** Gable crowns the reviewers read (buurten/haarlemmerbuurt-west-review-holds.json) that the type default drew as a cornice. */
const GABLES: Record<string, { gable: string; evidence: string }> = {
  '0363100012167794': { gable: 'point', evidence: 'Haarlemmerdijk 31: brick point gable, shoulders 10.0 m, apex 12.6 m (west review holds)' },
  '0363100012172755': { gable: 'neck', evidence: 'Haarlemmerdijk 182: neck gable over three upper rows (west review holds)' },
  '0363100012169539': { gable: 'bell', evidence: 'Haarlemmerdijk 143: wide bell gable over two storeys (west review holds)' },
  '0363100012176280': { gable: 'neck', evidence: 'Haarlemmerdijk 50: east-end three axes under a neck gable (west review holds)' },
};
const b2Name = (run: string) => run.replace(/-r(\d+)$/, '-b2r$1');

export const b2Holds = () => [...HELD.entries()];
export function batch2Pands(): { pandId: string; face: string }[] {
  const placement = JSON.parse(readFileSync(PLACEMENT, 'utf8'));
  const out: { pandId: string; face: string }[] = [];
  for (const f of placement.faces) for (const r of f.runs as { face: string; pands: string[] }[])
    for (const p of r.pands) if (!NINE.has(p) && !HELD.has(p)) out.push({ pandId: p, face: b2Name(r.face) });
  return out;
}

export function build(pandId: string, faceId: string) {
  const face = JSON.parse(readFileSync(`scripts/block-face/faces/${faceId}/intent.json`, 'utf8'));
  const spec = fromBlockFace(face, pandId)!;
  if (WALL_FROM_STRIP.has(pandId)) {
    const parent = faceId.replace(/-b2r\d+$/, '');
    const ap = JSON.parse(readFileSync(`scripts/block-face/faces/${parent}/auto-place.json`, 'utf8'));
    const wall = ap.pands.find((q: { pandId: string }) => q.pandId === pandId)?.strip?.wallRaw as string | undefined;
    if (wall) {
      setSpecField(spec, 'palette/brick', wall);
      spec.provenance['palette/brick'] = { source: 'streetlevel-measured', confidence: 0.6, ref: `scripts/block-face/faces/${parent}/auto-place.json strip.wallRaw (raw strip median; the white-balanced strip.wall overshoots on these: 182 reads #b6bfc6 against a #5a5144 raw and a #50473b photo)`, at: spec.provenance['']?.at ?? null };
    }
  }
  const g = GABLES[pandId];
  if (g) { setSpecField(spec, 'fronts/0/gable', g.gable); spec.provenance['fronts/0/gable'] = { source: 'author', confidence: 0.8, ref: `scripts/block-face/buurten/haarlemmerbuurt-west-review-holds.json: ${g.evidence}`, at: spec.provenance['']?.at ?? null }; }
  const held = (JSON.parse(readFileSync(REVIEW, 'utf8')).holds as { pandId: string; reason: string }[]).find(h => h.pandId === pandId);
  if (held) spec.schemaLimits = [...(spec.schemaLimits ?? []), { component: 'reviewer hold (batch 1 review)', what: `${spec.address}: ${held.reason}` }];
  const pin = EAVES_PINS.find(p => p.pandId === pandId);
  if (pin) {
    setSpecField(spec, 'fronts/0/eavesHeight', pin.eavesM);
    spec.provenance['fronts/0/eavesHeight'] = { source: 'author', confidence: 0.85, ref: `scripts/block-face/buurten/haarlemmerbuurt-*-review-eaves.json: ${pin.reason}`, at: spec.provenance['']?.at ?? null };
  }
  const roofLimit = roofBehindCrown(pandId, spec);
  if (roofLimit) spec.schemaLimits = [...(spec.schemaLimits ?? []), roofLimit];
  return spec;
}

export const HELP = `belt/haarlemmer-b2.ts: write the batch-2 HouseSpecs of the Haarlemmerbuurt belt lane (#356).

  node --import tsx scripts/house-specs/belt/haarlemmer-b2.ts [--list] [--help]

Pands = the runs of ${PLACEMENT} (minus the nine of batch 1); base = fromBlockFace of the b2 run intents.
--list prints pandId, address, face and does not write.`;

if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const { pandId, face } of batch2Pands()) {
    if (!existsSync(`scripts/block-face/faces/${face}/intent.json`)) { console.error(pandId, 'missing', face); process.exitCode = 1; continue; }
    const spec = withRoute(build(pandId, face));
    if (process.argv.includes('--list')) { console.log(pandId, spec.address, face); continue; }
    const problems = specProblems(spec);
    if (problems.length) { console.error(pandId, problems); process.exitCode = 1; }
    writeFileSync(`scripts/house-specs/specs/${pandId}.json`, JSON.stringify(spec, null, 1) + '\n');
    const f = spec.design.fronts?.[0] as any;
    console.log(pandId, spec.address, face, 'gable', f?.gable, 'storeys', f?.storeys, 'route', (spec as any).route ?? '');
  }
}
