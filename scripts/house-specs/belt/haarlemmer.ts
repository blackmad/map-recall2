// Haarlemmerbuurt belt lane (#356): the branch's nine placed shop-houses as HouseSpecs.
// Base = fromBlockFace of the lane's own r1/r2 face intents (strip-measured, photo-checked in
// docs/reports/haarlemmer-strip-verdict-20261110.md); AMEND = the author corrections made after house:preview.
// Writes scripts/house-specs/specs/<pandId>.json. Run: node --import tsx scripts/house-specs/belt/haarlemmer.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { fromBlockFace } from '../../../src/canalRecall/houseSpec/adapters.ts';
import { withRoute } from '../../../src/canalRecall/houseSpec/toRecipe.ts';
import { setSpecField, specProblems, type HouseSpec, type SpecLimit } from '../../../src/canalRecall/houseSpec/spec.ts';

const FACES: Record<string, string> = {
  '0363100012167818': 'haarlemmerdijk-2-58-r1', '0363100012167817': 'haarlemmerdijk-2-58-r1', '0363100012167816': 'haarlemmerdijk-2-58-r1',
  '0363100012176172': 'haarlemmerdijk-2-58-r2', '0363100012176174': 'haarlemmerdijk-2-58-r2',
  '0363100012171144': 'haarlemmer-46-96-r1', '0363100012171145': 'haarlemmer-46-96-r1',
  '0363100012173479': 'haarlemmerdijk-117-143-r1', '0363100012173480': 'haarlemmerdijk-117-143-r1',
};
const REPORT = 'docs/reports/haarlemmer-strip-verdict-20261110.md';
type Amend = {
  fields?: Record<string, unknown>; // field path -> value (author, confidence 0.85)
  evidence: string;                  // the strip / review / register line the amendment cites
  at: string;                        // photo date
  limits?: SpecLimit[];
};
/** Reviewer eaves pins of the lane (scripts/block-face/buurten/haarlemmerbuurt-{west,oost}-review-eaves.json), m above the pand's ground. */
export const EAVES_PINS = ['west', 'oost'].flatMap(b => JSON.parse(readFileSync(`scripts/block-face/buurten/haarlemmerbuurt-${b}-review-eaves.json`, 'utf8')).pins as {pandId: string; eavesM: number; reason: string}[]);

export const AMEND: Record<string, Amend> = {
  // Haarlemmerdijk 133A: the 2020-01-10 pose (house:frames, 5 deg obliquity) reads the shoulders at 9.9-10.1 m and a dark-brick bell crown to
  // 12.3 m at the middle columns (photo skyline 9.9, 10.1, 10.7, 12.1, 12.3, 12.0, 10.5); the 1 m grid pin 9.2 m was the gable foot under it.
  '0363100012173480': {
    fields: {'fronts/0/gable': 'bell', 'fronts/0/eavesHeight': 10, 'fronts/0/crownRise': 0.9},
    evidence: 'house:frames 2020-01-10 pose, photo skyline over the wall (belt-after/0363100012173480/pose.json): shoulders 10.0 m, crown 12.3 m; roofOffset flagged the game (skyline 8.75 m vs crown 10.57 m)',
    at: '2020-01-10',
  },
  // Haarlemmerdijk 131: RCE register says stucco (monument-text, palette/wallMaterial), the photo (2022-12-15, 2020-01-10) shows a dark olive-brown
  // painted front; the generic path draws register stucco as white plaster whatever wallHex says (decorate.ts measuredPaint needs painted-brick).
  '0363100012173479': {
    fields: {'palette/wallMaterial': 'painted-brick', 'roof/stepWeld': true},
    evidence: 'strip 2022-12-15 span 1249-1463 and 2020-01-10 capture: a dark olive-brown painted front; register finish stucco (monument-text) outvoted; roof/stepWeld closes the 4-6 cm jog of the BAG rear footprint (open-edges 3 -> 0)',
    at: '2022-12-15',
  },
  // Haarlemmerdijk 16/18/20: the 2022-12-15 strip is under-exposed (wall medians #30-#34), the 2020-01-10 capture is not. Measured, not tuned.
  '0363100012167818': {
    fields: {'palette/brick': '#4e4641'},
    evidence: 'winter re-capture 2020-01-10 (well exposed; the 2022-12-15 strip is under-exposed): palette-from-strip wall #4e4641, reproduce with intake.ts --face=zz-wint-dijk --street=Haarlemmerdijk --seed=0363100012167817 --from=0363100012167818 --to=0363100012167816 --date=2020-01-10',
    at: '2020-01-10',
  },
  '0363100012167817': {
    fields: {'palette/brick': '#463e3a'},
    evidence: 'winter re-capture 2020-01-10 (well exposed; the 2022-12-15 strip is under-exposed): palette-from-strip wall #463e3a, reproduce with intake.ts --face=zz-wint-dijk --street=Haarlemmerdijk --seed=0363100012167817 --from=0363100012167818 --to=0363100012167816 --date=2020-01-10',
    at: '2020-01-10',
  },
  '0363100012167816': {
    fields: {'palette/brick': '#473936'},
    evidence: 'winter re-capture 2020-01-10 (well exposed; the 2022-12-15 strip is under-exposed): palette-from-strip wall #473936, reproduce with intake.ts --face=zz-wint-dijk --street=Haarlemmerdijk --seed=0363100012167817 --from=0363100012167818 --to=0363100012167816 --date=2020-01-10',
    at: '2020-01-10',
  },
  // Haarlemmerstraat 52: the photo's ground storey is three stone-framed bays with the door in the middle (type default: door left).
  '0363100012171145': {
    fields: {'fronts/0/doorBay': 1},
    evidence: 'strip 2024-11-21 span 3634-3818, 1 m grid: three ground bays, door in bay 1 of 0..2, wrought-iron window rails either side',
    at: '2024-11-21',
    limits: [{component: 'gable ornament', what: '52 (171145): carved sandstone crown with a pedimented neck light over a bell gable; the kit draws a plain neck gable'},
      {component: 'ground storey', what: '52: tall residential ground storey in stone with arched-head rails and a pilaster order; drawn as a plain tall window ground storey'}],
  },
  // Haarlemmerdijk 4: the reviewer reads a narrow (1.9 m) neck over sandstone scrolls, not the type's wide bell.
  '0363100012176174': {
    fields: {'fronts/0/gable': 'neck'},
    evidence: 'strip-sheet verdict 176174: photo has a narrower neck, about 1.9 m, with sandstone scrolls',
    at: '2022-12-15',
  },
};

/** A gabled front's 3DBAG saddle stands behind the crown in the recipe route; the strips show sky behind the crowns (roofs from the front). */
export function roofBehindCrown(pandId: string, spec: HouseSpec): SpecLimit | null {
  const f = spec.design.fronts?.[0] as {gable?: string} | undefined;
  if (!f?.gable || (f.gable === 'cornice' && pandId !== '0363100012176172')) return null; // the other cornice fronts draw flat behind the crown
  return {component: 'roof behind crown', what: `${spec.address}: the recipe route draws the 3DBAG roof behind the ${f.gable} crown unless roof.source is 'front' (houseFrontRoof.ts); the strip shows sky behind it`};
}

export function build(pandId: string): HouseSpec {
  const face = JSON.parse(readFileSync(`scripts/block-face/faces/${FACES[pandId]}/intent.json`, 'utf8'));
  const spec = fromBlockFace(face, pandId)!;
  const a = AMEND[pandId];
  if (a) {
    for (const [path, v] of Object.entries(a.fields ?? {})) {
      setSpecField(spec, path, v);
      spec.provenance[path] = { source: 'author', confidence: 0.85, ref: `${REPORT}; ${a.evidence}`, at: a.at };
    }
    if (a.limits?.length) spec.schemaLimits = [...(spec.schemaLimits ?? []), ...a.limits];
  }
  const pin = EAVES_PINS.find(p => p.pandId === pandId);
  if (pin && !(a?.fields && 'fronts/0/eavesHeight' in a.fields)) {
    setSpecField(spec, 'fronts/0/eavesHeight', pin.eavesM);
    spec.provenance['fronts/0/eavesHeight'] = {source: 'author', confidence: 0.85, ref: `scripts/block-face/buurten/haarlemmerbuurt-*-review-eaves.json: ${pin.reason}`, at: spec.provenance['']?.at ?? null};
  }
  const roofLimit = roofBehindCrown(pandId, spec);
  if (roofLimit) spec.schemaLimits = [...(spec.schemaLimits ?? []), roofLimit];
  return spec;
}

export const HELP = `belt/haarlemmer.ts: write the Haarlemmerbuurt belt lane's nine HouseSpecs (#356).

  node --import tsx scripts/house-specs/belt/haarlemmer.ts [--help]

Base = fromBlockFace of the lane's own faces (haarlemmerdijk-2-58-r1/-r2, haarlemmer-46-96-r1, haarlemmerdijk-117-143-r1);
AMEND = author corrections cited to docs/reports/haarlemmer-strip-verdict-20261110.md; fronts/0/eavesHeight = the reviewer
eaves pins (buurten/haarlemmerbuurt-{west,oost}-review-eaves.json). Writes scripts/house-specs/specs/<pandId>.json with
route derived (withRoute). Then: recipe-dir.ts <pand...> -> house:preview <pand> --recipe --photo -> house:stage <pand>.`;

if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const id of Object.keys(FACES)) {
    const spec = withRoute(build(id));
    const problems = specProblems(spec);
    if (problems.length) { console.error(id, problems); process.exitCode = 1; }
    writeFileSync(`scripts/house-specs/specs/${id}.json`, JSON.stringify(spec, null, 1) + '\n');
    const f = spec.design.fronts?.[0] as any;
    console.log(id, spec.address, 'bays', JSON.stringify(f?.bays), 'storeys', f?.storeys, 'gable', f?.gable, 'wall', JSON.stringify(spec.design.palette), 'limits', spec.schemaLimits?.length ?? 0);
  }
}
