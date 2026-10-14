// Register facts the bridge kit reads (src/canalRecall/ownGround/bridgeKit.ts):
// material, era and use per BRU number, and where the unmeasured footprints
// whose look depends on them sit. From the municipal bridge register
// (`scripts/data/amsterdam-bridge-register.json`, Gemeente Amsterdam
// civiele constructies, open data) and the elevation extract's fallback
// footprints. Lane bridge-kit 2026-10-13.
//
//   npx tsx scripts/own-ground/build-bridge-hints.ts           # coverage + diff against the committed module
//   npx tsx scripts/own-ground/build-bridge-hints.ts --write   # write src/canalRecall/ownGround/bridgeHints.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { localToLngLat } from '../../src/canalRecall/elevation/elevationData.ts';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { encodeFacts, encodeHint, type ArchShape, type BridgeFacts, type BridgeFamily, type ParapetClass, type RegisterHint } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { NAMED } from '../bridge-reference/named.ts';

const OUT = 'src/canalRecall/ownGround/bridgeHints.ts';
const register = JSON.parse(readFileSync('scripts/data/amsterdam-bridge-register.json', 'utf8')) as { bridges: [string, string, string, string, number, string, string, unknown][] };
const extract = JSON.parse(readFileSync('public/data/extracts/amsterdam/elevation-v1/bridges.json', 'utf8')) as { measured: { id: string }[]; fallback: { id: string; type: string; ring: number[] }[] };
const index = JSON.parse(readFileSync('public/data/extracts/amsterdam/elevation-v1/index.json', 'utf8'));

const MATERIAL: Record<string, RegisterHint['material']> = { Metselwerk: 'masonry', Staal: 'steel', 'Gewapend beton': 'concrete', Beton: 'concrete', Hout: 'wood' };
const hints = new Map<number, RegisterHint>();
for (const [number, , type, material, year, modality] of register.bridges) {
  const m = /^BRU(\d+)$/.exec(number);
  if (!m) continue;
  hints.set(Number(m[1]), {
    material: MATERIAL[material] ?? 'other',
    // Built before 1940: the canal-belt generation (brick abutments, arched or arch-faced spans).
    classic: year > 0 && year < 1940,
    light: modality === 'Voetganger' || modality === 'Fiets',
    movable: type === 'Beweegbare brug',
  });
}
const max = Math.max(...hints.keys());
let codes = '';
for (let n = 0; n <= max; n++) codes += hints.has(n) ? encodeHint(hints.get(n)!) : '.';

// ------------------------------------------------------------------ per-bridge facts (lane bridge-fidelity 2026-10-14)
// Measured from the Gemeente Amsterdam boat panoramas (CC BY 4.0) aimed along the water at each bridge face
// (scripts/bridge-reference/run.ts: rectified faces, a face reader, accepted where both faces agree), published in
// scripts/data/amsterdam-bridge-facts.json; HAND overrides them for the named canal-belt bridges, read by eye from the
// same rectified faces (artifacts/bridges/<id>/photo-<p|m>.jpg; the pano ids are the source). Openings measured by the
// reader are kept where the hand count agrees.
type Hand = { arches?: number; shapes?: string; family?: BridgeFamily; parapet?: ParapetClass; source: string };
const P = (ids: string) => `hand: boat panoramas ${ids}`;
const brickArches = (n: number, shape: string, ids: string): Hand => ({ arches: n, shapes: shape, family: 'brick-red', parapet: 'iron-rail', source: P(ids) });
const girder = (n: number, ids: string): Hand => ({ arches: n, shapes: 'f', family: 'steel', parapet: 'iron-rail', source: P(ids) });
export const HAND: Record<string, Hand> = {
  // The Seven Bridges stretch of the Reguliersgracht and its junctions.
  BRU0031: brickArches(1, 'r', '000355_pano_0000_001174,000355_pano_0000_000735'),
  BRU0032: brickArches(1, 's', '000355_pano_0000_000736,000355_pano_0000_000730'),
  BRU0038: brickArches(3, 's', '000355_pano_0000_001158,000355_pano_0000_000552'),
  BRU0039: brickArches(1, 's', '000355_pano_0000_000525,000355_pano_0000_001166'),
  BRU0074: brickArches(1, 's', '000355_pano_0000_000570,000355_pano_0000_000520'),
  BRU0073: brickArches(1, 's', '000355_pano_0000_000401,000355_pano_0000_000571'),
  BRU0071: brickArches(3, 's', '000355_pano_0000_000398,000355_pano_0000_000579'),
  BRU0072: brickArches(1, 's', '000355_pano_0000_000508,000355_pano_0000_000404'),
  // Landmarks.
  BRU0009: brickArches(3, 'r', '000354_pano_0001_000123,000354_pano_0001_000112'),
  BRU0236: { arches: 3, shapes: 'sfs', family: 'stone', parapet: 'stone-balustrade', source: P('000355_pano_0001_001567,000354_pano_0001_001572') },
  BRU0242: { arches: 8, shapes: 's', family: 'render-white', parapet: 'iron-rail', source: P('000355_pano_0000_000633,000355_pano_0000_000625') },
  BRU0063: girder(3, '000205_pano_0000_000936'),
  // The Amstel.
  BRU0035: brickArches(3, 's', '000355_pano_0000_000704,000355_pano_0000_000699'),
  BRU0036: brickArches(3, 's', '000355_pano_0000_000646,000355_pano_0000_000680'),
  BRU0076: brickArches(3, 's', '000355_pano_0000_000613,000354_pano_0003_000031'),
  BRU0077: girder(1, '000355_pano_0000_001266,000354_pano_0003_000045'),
  BRU0250: brickArches(3, 's', '000354_pano_0002_000288,000355_pano_0001_001520'),
  // Radial crossings: riveted girders on brick piers (Herengracht, Prinsengracht), brick arches (Keizersgracht 1979-82 rebuilds).
  BRU0022: girder(1, '000355_pano_0000_000991,000355_pano_0000_000981'),
  BRU0024: girder(3, '000355_pano_0000_001003,000355_pano_0000_000997'),
  BRU0025: girder(3, '000355_pano_0000_001017,000355_pano_0000_001025'),
  BRU0026: girder(3, '000355_pano_0000_001042,000355_pano_0000_001035'),
  BRU0027: girder(1, '000355_pano_0000_001045'),
  BRU0029: girder(3, '000355_pano_0000_000787,000355_pano_0000_000796'),
  BRU0034: girder(1, '000355_pano_0000_000726,000355_pano_0000_000717'),
  BRU0037: girder(1, '000355_pano_0000_000543,000355_pano_0000_000661'),
  BRU0041: girder(3, '000355_pano_0000_001130,000355_pano_0000_001140'),
  BRU0043: girder(1, '000355_pano_0000_001089,000355_pano_0000_001081'),
  BRU0042: brickArches(3, 's', '000355_pano_0000_001112,000355_pano_0000_001117'),
  BRU0044: brickArches(1, 's', '000355_pano_0000_001063,000355_pano_0000_000857'),
  BRU0046: brickArches(3, 's', '000355_pano_0000_000865,000355_pano_0000_001066'),
  BRU0047: brickArches(3, 's', '000355_pano_0000_000888,000355_pano_0000_000881'),
  BRU0048: brickArches(3, 's', '000355_pano_0000_000902,000355_pano_0000_000898'),
  BRU0049: brickArches(3, 's', '000355_pano_0000_000918,000355_pano_0000_000926'),
  BRU0051: brickArches(3, 's', '000205_pano_0000_000898,000355_pano_0000_000954'),
  BRU0054: girder(3, '000205_pano_0000_000877'),
  BRU0060: girder(3, '000205_pano_0000_000123'),
  BRU0061: girder(3, '000205_pano_0000_000431'),
  BRU0064: girder(3, '000205_pano_0000_000963'),
  BRU0065: girder(3, '000205_pano_0000_000978'),
  BRU0066: girder(3, '000205_pano_0000_000996,000205_pano_0000_001113'),
  BRU0067: girder(1, '000355_pano_0000_000160,000355_pano_0000_000153'),
  BRU0069: girder(3, '000355_pano_0000_000346,000355_pano_0000_000205'),
  BRU0070: girder(3, '000355_pano_0000_000375,000355_pano_0000_000364'),
  BRU0075: girder(1, '000355_pano_0000_000593,000355_pano_0000_000600'),
  BRU0106: girder(3, '000355_pano_0000_000936,000355_pano_0000_000945'),
};
type AutoFacts = { arches?: number; shape?: ArchShape; family?: BridgeFamily; parapet?: ParapetClass; openings?: [number, number, number][]; source: string };
const FACTS_FILE = 'scripts/data/amsterdam-bridge-facts.json';
const auto: Record<string, AutoFacts> = existsSync(FACTS_FILE) ? JSON.parse(readFileSync(FACTS_FILE, 'utf8')).facts : {};
const facts: Record<number, ReturnType<typeof encodeFacts>> = {};
const bySource: Record<string, number> = { hand: 0, panorama: 0, 'named, register only': 0 };
const letters: Record<string, ArchShape> = { s: 'segmental', r: 'round', f: 'flat' };
for (const id of [...new Set([...Object.keys(auto), ...Object.keys(HAND), ...NAMED])].sort()) {
  const m = /^BRU(\d+)$/.exec(id);
  if (!m) continue;
  const h = HAND[id], a = auto[id], named = NAMED.includes(id);
  let f: BridgeFacts;
  if (h) {
    f = { named, ...(h.arches ? { arches: h.arches } : {}), ...(h.shapes ? { shapes: [...h.shapes].map(c => letters[c]) } : {}), ...(h.family ? { family: h.family } : {}), ...(h.parapet ? { parapet: h.parapet } : {}) };
    if (a?.openings && a.arches === h.arches) f.openings = a.openings;
    bySource.hand++;
  } else if (a?.family && !(hints.get(Number(m[1]))?.material === 'masonry' && (a.family === 'steel' || a.family === 'concrete'))) {
    // (A masonry register bridge read as steel or concrete is shade on brick: the 5 family misses above were all that.)
    // Only the family is taken from the automatic reader: against the 45 hand readings (validate.ts, 2026-10-14) it agreed
    // on the family 18/23 (brick vs brick-dark counted equal), the opening count 5/12, the shape 7/10, the parapet 11/23.
    f = { named, family: a.family };
    bySource.panorama++;
  } else if (named) { f = { named }; bySource['named, register only']++; } else continue;
  facts[Number(m[1])] = encodeFacts(f);
}
console.log(JSON.stringify({ facts: Object.keys(facts).length, bySource, autoWithArches: Object.values(auto).filter(a => a.arches).length }));

// Unmeasured footprints whose look the register changes (masonry, movable): number and ring centroid, game frame, decimetres.
const flat: number[] = [];
const q = index.quantization.xy;
let flatSkipped = 0;
for (const b of extract.fallback) {
  const m = /^BRU(\d+)$/.exec(b.id);
  if (!m) { flatSkipped++; continue; }
  const h = hints.get(Number(m[1]));
  if (!h || !(h.material === 'masonry' || h.movable || b.type === 'Beweegbare brug' || facts[Number(m[1])])) continue;
  let cx = 0, cy = 0;
  const n = b.ring.length / 2;
  for (let i = 0; i < b.ring.length; i += 2) {
    const [lng, lat] = localToLngLat(index, b.ring[i] * q, b.ring[i + 1] * q);
    const [x, y] = toLocal(lng, lat);
    cx += x / n; cy += y / n;
  }
  flat.push(Number(m[1]), Math.round(cx * 10), Math.round(cy * 10));
}
const measured = extract.measured.filter(b => { const m = /^BRU(\d+)$/.exec(b.id); return m && hints.has(Number(m[1])); }).length;
console.log(JSON.stringify({ registerRows: hints.size, maxNumber: max, measuredWithHint: `${measured}/${extract.measured.length}`, flatLocated: flat.length / 3, flatWithoutNumber: flatSkipped, codesBytes: codes.length }));

const body = `// Generated by scripts/own-ground/build-bridge-hints.ts from the municipal bridge register
// (Gemeente Amsterdam, civiele constructies; open data) and elevation-v1/bridges.json. Do not edit.
/** One character per BRU number (bridgeKit.ts decodeHint), '.' where the register has none. */
export const BRIDGE_CODES = ${JSON.stringify(codes)};
/** Unmeasured footprints the register changes: [BRU number, centroid x, centroid y (game frame, dm)] flattened. */
export const FLAT_HINTS: readonly number[] = ${JSON.stringify(flat)};
/** Per-bridge facts by BRU number (bridgeKit.ts decodeFacts): panorama-measured, hand overrides for the named bridges. */
export const BRIDGE_FACTS: Readonly<Record<number, readonly (number | string)[]>> = ${JSON.stringify(facts)};
`;
if (existsSync(OUT)) {
  const old = readFileSync(OUT, 'utf8');
  console.log(old === body ? 'unchanged' : `differs from ${OUT} (${old.length} → ${body.length} bytes)`);
}
if (process.argv.includes('--write')) { writeFileSync(OUT, body); console.log(`wrote ${OUT}`); }
