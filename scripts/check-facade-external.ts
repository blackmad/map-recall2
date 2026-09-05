/**
 * Check the detector against sources that never saw a photograph.
 *
 * Everything measured here comes from one pipeline reading one set of images,
 * so every check inside it shares that pipeline's mistakes. That is how a 180°
 * yaw error survived a numeric audit: the outputs were checked for being
 * *typical of Amsterdam*, which they were, while being about the wrong side of
 * the canal. Identity is not a distributional property and internal consistency
 * cannot test it.
 *
 * Three independent sources are already cached and had never been used for
 * this. None of them is derived from our imagery, none shares our failure
 * modes, and where they are wrong they are wrong differently:
 *
 *   - **OpenStreetMap `building:levels`** — typed in by a person who stood in
 *     the street. Only 131 of 3,025, but it is the only direct human statement
 *     of storey count anywhere in the pilot.
 *   - **OSM `building:material` and `building:colour`** — again human, and the
 *     sharpest available test of the wall colour we sample from pixels.
 *   - **BAG `dwellings`** — the land registry's count of homes in the building,
 *     for 2,762 of them. Not storeys, but strongly related to them, and
 *     completely independent of both imagery and OSM.
 *
 * This is a *report*, not a gate. Disagreement here is information about which
 * fields to distrust, and the honest response to a low number is to say so
 * rather than to loosen the comparison until it passes.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../src/canalRecall/facade/areas.ts';
import { wallFamily } from '../src/canalRecall/facade/materials.ts';

const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const read = (name: string) => JSON.parse(readFileSync(path.join(STAGING, name), 'utf8'));

const recon = read('recon.json');
const evidence = read('facade-evidence.json');
const measured = new Map<string, any>(evidence.facades.map((f: any) => [f.pandId, f]));
const bag = new Map<string, any>(recon.buildings.map((b: any) => [b.buildingId, b]));
const osm = new Map<string, any>();
for (const s of recon.semantics ?? []) if (s.buildingId && !osm.has(s.buildingId)) osm.set(s.buildingId, s);

const pct = (n: number, d: number) => d ? `${((100 * n) / d).toFixed(0)}%` : '—';
console.log(`Checking ${measured.size} measured façades against sources that never saw a photograph.\n`);

// ── 1. Storey count against a human in the street ───────────────────────────
const levelPairs: Array<[number, number]> = [];
for (const [id, f] of measured) {
  const levels = osm.get(id)?.levels;
  if (levels == null || !f.storeyBands) continue;
  levelPairs.push([f.storeyBands, Number(levels)]);
}
if (levelPairs.length) {
  const diffs = levelPairs.map(([mine, theirs]) => mine - theirs);
  const exact = diffs.filter(d => d === 0).length;
  const within1 = diffs.filter(d => Math.abs(d) <= 1).length;
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  console.log(`OSM building:levels  (n=${levelPairs.length}, human-entered)`);
  console.log(`  exact match    ${exact} (${pct(exact, levelPairs.length)})`);
  console.log(`  within 1       ${within1} (${pct(within1, levelPairs.length)})`);
  console.log(`  mean signed    ${mean >= 0 ? '+' : ''}${mean.toFixed(2)} storeys`);
  console.log(`  ${mean > 0.4 ? '→ we read MORE storeys than people do' : mean < -0.4 ? '→ we read FEWER storeys than people do' : '→ no systematic bias'}`);
} else {
  console.log('OSM building:levels  — no overlap with measured façades');
}

// ── 2. Wall material against a human's description ──────────────────────────
// OSM says "brick", "plaster", "wood"; the vocabulary says `brick-grey`,
// `stucco`, `painted-white`. Compared at family level, which is the level at
// which the two can actually be said to agree.
const familyOf = (material: string | null) => {
  if (!material) return null;
  if (material.startsWith('brick')) return 'brick';
  if (material.startsWith('painted')) return 'paint';
  return 'stone';
};
const osmFamily = (value: string) => {
  const v = value.toLowerCase();
  if (v.includes('brick')) return 'brick';
  if (v.includes('plaster') || v.includes('stucco') || v.includes('render') || v.includes('stone')
      || v.includes('concrete') || v.includes('sandstone')) return 'stone';
  if (v.includes('paint')) return 'paint';
  return null;
};
let matAgree = 0, matTotal = 0;
const matConfusion = new Map<string, number>();
for (const [id, f] of measured) {
  const theirs = osm.get(id)?.material;
  const mine = familyOf(f.wallMaterial ?? null);
  const other = theirs ? osmFamily(theirs) : null;
  if (!mine || !other) continue;
  matTotal++;
  if (mine === other) matAgree++;
  else matConfusion.set(`${other} → ${mine}`, (matConfusion.get(`${other} → ${mine}`) ?? 0) + 1);
}
console.log(`\nOSM building:material  (n=${matTotal}, human-entered)`);
if (matTotal) {
  console.log(`  family agrees  ${matAgree} (${pct(matAgree, matTotal)})`);
  for (const [k, v] of [...matConfusion].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    console.log(`    they say ${k.padEnd(18)} ${v}`);
  }
} else {
  console.log('  no overlap');
}

// ── 3. Storeys against the registry's dwelling count ────────────────────────
// Not a storey count, but a canal house is one or two homes per floor, so a
// four-storey house with eleven dwellings is telling us something.
const dwellingPairs: Array<[number, number]> = [];
for (const [id, f] of measured) {
  const d = bag.get(id)?.dwellings;
  if (!d || !f.storeyBands) continue;
  dwellingPairs.push([f.storeyBands, d]);
}
if (dwellingPairs.length) {
  const perFloor = dwellingPairs.map(([s, d]) => d / s).sort((a, b) => a - b);
  const median = perFloor[Math.floor(perFloor.length / 2)];
  const absurd = perFloor.filter(v => v > 4).length;
  console.log(`\nBAG dwellings per detected storey  (n=${dwellingPairs.length}, land registry)`);
  console.log(`  median         ${median.toFixed(2)} homes per storey`);
  console.log(`  p10 / p90      ${perFloor[Math.floor(perFloor.length * 0.1)].toFixed(2)} / ${perFloor[Math.floor(perFloor.length * 0.9)].toFixed(2)}`);
  console.log(`  over 4 / floor ${absurd} (${pct(absurd, perFloor.length)}) — implies storeys were under-counted`);
}

// ── 4. Frontage against the registry's own plot width ───────────────────────
// The strongest of these, because BAG measures the plot and we measure the
// wall, and they must be the same object.
const widthPairs: Array<[number, number]> = [];
for (const [id, f] of measured) {
  const plot = bag.get(id)?.plotWidthM;
  if (!plot || !f.wallWidthM) continue;
  widthPairs.push([f.wallWidthM, plot]);
}
if (widthPairs.length) {
  const errs = widthPairs.map(([mine, theirs]) => Math.abs(mine - theirs) / theirs).sort((a, b) => a - b);
  const within10 = errs.filter(e => e <= 0.1).length;
  console.log(`\nBAG plot width vs measured frontage  (n=${widthPairs.length})`);
  console.log(`  within 10%     ${within10} (${pct(within10, errs.length)})`);
  console.log(`  median error   ${(100 * errs[Math.floor(errs.length / 2)]).toFixed(1)}%`);
}

console.log(`\nThis is a report, not a gate. A low number here means the field is not `
  + `trustworthy yet,\nnot that the comparison should be loosened.`);
