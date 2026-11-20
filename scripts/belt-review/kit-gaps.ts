/**
 * belt-review:kit-gaps (R6, lane C, 2026-11-20): harvest the kit limits the repo already states into the structured gap
 * list `review-data/belt-review/kit-gaps.json` (src/canalRecall/beltReview/kitGaps.ts).
 *
 *   node --import tsx scripts/belt-review/kit-gaps.ts [--check] [--since YYYY-MM-DD]
 *
 * Sources: curated entries from docs/handoffs/kit-gaps.md whose status can be told (CURATED below); every block-face
 * intent's `schemaLimits` and `limitations` (houses by the 6-digit pand suffixes the text names); the published HouseSpecs'
 * kit limits (house-specs tiles `l`); hand-written specs' `schemaLimits`; the house rows' limits.json. An existing entry
 * keeps its status, fixedBy, examplePin and since (people edit those); harvests only add houses and refs. --check prints
 * the counts and writes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { mergeKitGaps, parseKitGaps, componentField, type KitGap, type KitGapFile, type LimitStatement } from '../../src/canalRecall/beltReview/kitGaps.ts';
import { toSpecLimit } from '../../src/canalRecall/houseSpec/spec.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(REPO, 'review-data/belt-review/kit-gaps.json');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const SINCE = arg('since') ?? new Date().toISOString().slice(0, 10);
const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const MD = 'docs/handoffs/kit-gaps.md';

/** kit-gaps.md items whose status is known (2026-11-20 reading). Large-kit landmark rows whose fix is unclear are left in the md. */
const CURATED: KitGap[] = [
  { id: 'stoop-flights', component: 'stoop', gap: 'a side or double flight, an iron railing and the souterrain under the landing (the kit had plain front steps)', housesBlocked: [], status: 'closed', fixedBy: 'K-stoep #360 (buildingRecipe/stoop.ts)', since: '2026-11-10', refs: [`${MD} Stoops`] },
  { id: 'stoop-curved-flights', component: 'stoop', gap: 'curved or winged flights', housesBlocked: ['0363100012167958'], examplePin: '0363100012167958 (Herengracht)', status: 'open', since: '2026-11-10', refs: [`${MD} Stoops`] },
  { id: 'stoop-portal-stair', component: 'stoop', gap: 'a stair inside a portal recess', housesBlocked: ['0363100012164843'], examplePin: '0363100012164843 (Nassaukade 150)', status: 'open', since: '2026-11-10', refs: [`${MD} Stoops`] },
  { id: 'stoop-scroll-newels', component: 'stoop', gap: 'cast-iron scroll newels and urns', housesBlocked: ['0363100012167492', '0363100012167958'], examplePin: '0363100012167958 (Herengracht)', status: 'open', since: '2026-11-10', refs: [`${MD} Stoops`] },
  { id: 'stoop-souterrain-shop', component: 'stoop', gap: 'a souterrain shopfront under the landing', housesBlocked: [], status: 'open', since: '2026-11-10', refs: [`${MD} Stoops`] },
  { id: 'chamfer-corner', component: 'corner chamfer', gap: 'a canted corner between two street fronts (0.3-6 m) with its own door or shop entrance, window axes, balconies, and the cornice and roof turning with it; 2,167 pands citywide, 947 ride-priority 1850-1940', housesBlocked: ['0363100012116526'], examplePin: '0363100012116526 (Nassaukade 152 / De Clercqstraat)', status: 'open', since: '2026-11-10', refs: [`${MD} Corner chamfer (#354)`] },
  { id: 'large-balcony-rail-colour', component: 'balcony', gap: 'balcony rails in their own colour (black iron read white)', housesBlocked: [], status: 'closed', fixedBy: '#35 balconies.colour', since: '2026-10-24', refs: [`${MD} Large kit stone dressings (#31)`, `${MD} Large kit giant order (#35)`] },
  { id: 'large-giant-pilasters', component: 'pilaster', gap: 'fluted giant pilasters with capitals', housesBlocked: [], status: 'closed', fixedBy: '#35 dressings.piers capital/flutes', since: '2026-10-24', refs: [`${MD} Large kit stone dressings (#31)`, `${MD} Large kit giant order (#35)`] },
  { id: 'large-corbel-tables', component: 'cornice', gap: 'brick corbel tables', housesBlocked: [], status: 'closed', fixedBy: '#35 dressings.corbels', since: '2026-10-24', refs: [`${MD} Large kit stone dressings (#31)`, `${MD} Large kit giant order (#35)`] },
  { id: 'large-balustrades-ironwork', component: 'balcony', gap: 'balustrades and open ironwork (rails are a solid sheet)', housesBlocked: [], examplePin: 'Hirschpassage', status: 'open', since: '2026-10-24', refs: [`${MD} Large kit giant order (#35)`] },
  { id: 'window-shape-per-storey', component: 'window', gap: 'a window shape per storey (large kit)', housesBlocked: [], status: 'open', since: '2026-10-24', refs: [`${MD} Large kit stone dressings (#31)`, `${MD} Large kit giant order (#35)`] },
  { id: 'large-multi-bay-opening', component: 'window', gap: 'one opening spanning several bays, and a bay grid offset from the panel edge', housesBlocked: [], examplePin: 'Damrak 77 (Beurspassage arch)', status: 'open', since: '2026-10-24', refs: [`${MD} Large kit giant order (#35)`] },
  { id: 'storey1-ribbon', component: 'ground', gap: 'a storey-1 ribbon (shopfront strip, balcony band) under punched upper storeys; the kit draws windows under it (28 unreviewed landmark pands)', housesBlocked: [], examplePin: 'pand 079326 (Papaverweg)', status: 'open', since: '2026-11-06', refs: [`${MD} Landmark factory (#234)`] },
  { id: 'curtain-wall', component: 'facade', gap: 'curtain walls, sawtooth/folded/parabolic roofs, metal rib or louvre cladding, timber slats', housesBlocked: [], status: 'open', since: '2026-10-24', refs: [`${MD} Kit review round 4`] },
].map(g => ({ ...g, field: componentField(g.component) }) as KitGap);

const harvested: LimitStatement[] = [];
const counts = { faces: 0, faceSchemaLimits: 0, faceLimitations: 0, specTileLimits: 0, handSpecLimits: 0, rowLimits: 0 };

// 1. block-face intents
const FACES = path.join(REPO, 'scripts/block-face/faces');
for (const dir of fs.readdirSync(FACES).sort()) {
  const f = path.join(FACES, dir, 'intent.json');
  if (!fs.existsSync(f)) continue;
  const face = json(f) as { houses?: Array<{ pandId: string }>; schemaLimits?: Array<{ component: string; what: string }>; limitations?: string[] };
  counts.faces++;
  const bySuffix = new Map((face.houses ?? []).map(h => [h.pandId.slice(-6), h.pandId]));
  const named = (text: string) => [...new Set([...text.matchAll(/\b(\d{6})\b/g)].map(m => bySuffix.get(m[1])).filter((x): x is string => !!x))];
  const ref = `scripts/block-face/faces/${dir}/intent.json`;
  for (const l of face.schemaLimits ?? []) { harvested.push({ component: l.component, what: l.what, pands: named(l.what), ref, since: SINCE }); counts.faceSchemaLimits++; }
  for (const s of face.limitations ?? []) {
    const pand = /^(\d{6}):/.exec(s.trim())?.[1], l = toSpecLimit(s);
    if (!l) continue;
    harvested.push({ component: l.component, what: l.what, pands: pand && bySuffix.has(pand) ? [bySuffix.get(pand)!] : named(s), ref: `${ref} limitations`, since: SINCE });
    counts.faceLimitations++;
  }
}

// 2. published HouseSpecs (their limits come from faces, recipes, rows and hand specs, resolved per pand)
const TILES = path.join(REPO, 'public/data/extracts/amsterdam/house-specs/14');
if (fs.existsSync(TILES)) for (const x of fs.readdirSync(TILES).sort()) for (const y of fs.readdirSync(path.join(TILES, x)).sort()) {
  const t = JSON.parse(gunzipSync(fs.readFileSync(path.join(TILES, x, y))).toString('utf8')) as { buildings: Record<string, { l?: Array<{ component: string; what: string }> }> };
  for (const [id, rec] of Object.entries(t.buildings).sort()) for (const l of rec.l ?? []) {
    harvested.push({ component: l.component, what: l.what, pands: [id.slice(-16)], ref: 'public/data/extracts/amsterdam/house-specs (published spec l)', since: SINCE });
    counts.specTileLimits++;
  }
}

// 3. hand-written specs
const HAND = path.join(REPO, 'scripts/house-specs/specs');
for (const f of fs.readdirSync(HAND).filter(n => n.endsWith('.json')).sort()) {
  const s = json(path.join(HAND, f)) as { pandId: string; schemaLimits?: unknown[] };
  for (const raw of s.schemaLimits ?? []) { const l = toSpecLimit(raw); if (l) { harvested.push({ component: l.component, what: l.what, pands: [s.pandId], ref: `scripts/house-specs/specs/${f}`, since: SINCE }); counts.handSpecLimits++; } }
}

// 4. house rows' limits
const ROW_LIMITS = path.join(REPO, 'scripts/house-specs/rows/limits.json');
if (fs.existsSync(ROW_LIMITS)) for (const [row, list] of Object.entries(json(ROW_LIMITS) as Record<string, unknown>)) {
  if (!Array.isArray(list)) continue;
  for (const l of list as Array<{ fronts: string[]; component: string; what: string; ref?: string }>) {
    harvested.push({ component: l.component, what: l.what, pands: [...new Set(l.fronts.map(f => f.slice(0, 16)))], ref: `scripts/house-specs/rows/limits.json ${row}${l.ref ? ` (${l.ref})` : ''}`, since: SINCE });
    counts.rowLimits++;
  }
}

const existing: KitGap[] = fs.existsSync(OUT) ? parseKitGaps(json(OUT)).gaps : [];
const curatedIds = new Set(existing.map(g => g.id));
const gaps = mergeKitGaps([...existing, ...CURATED.filter(g => !curatedIds.has(g.id))], harvested);
const file: KitGapFile = {
  version: 1,
  about: 'Belt review R6: what the kit cannot draw, the houses each gap blocks, and who is on it. New gaps go here (status open, since, refs); docs/handoffs/kit-gaps.md stays as history. Harvested by scripts/belt-review/kit-gaps.ts, which keeps status, fixedBy, examplePin and since of existing entries. Typed in src/canalRecall/beltReview/kitGaps.ts.',
  gaps,
};
parseKitGaps(file);
const by = (k: (g: KitGap) => string) => Object.entries(gaps.reduce<Record<string, number>>((a, g) => { a[k(g)] = (a[k(g)] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({ harvested: counts, gaps: gaps.length, byStatus: Object.fromEntries(by(g => g.status)), byField: Object.fromEntries(by(g => g.field ?? 'other')), housesBlocked: new Set(gaps.flatMap(g => g.housesBlocked)).size }, null, 1));
if (!process.argv.includes('--check')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n');
  console.log(`wrote ${path.relative(REPO, OUT)}`);
}
