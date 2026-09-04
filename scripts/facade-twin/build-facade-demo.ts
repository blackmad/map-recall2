/**
 * Pick one well-measured terrace and emit it as a drawable elevation.
 *
 * A terrace, not a scatter of buildings: the thing worth looking at in this
 * fabric is the *run* — how storey heights step from house to house, how bay
 * rhythms differ across a party wall, how a 4.2 m plot sits beside a 7 m one.
 * A single façade shows a measurement; a row shows whether the measurements
 * agree with the street.
 *
 * Selection is by measurement quality and contiguity, never by which row looks
 * best. The chosen run is whichever contiguous group of front walls on a common
 * building line has the most measured openings.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { nearestMaterial, wallFamily, MATERIALS } from '../../src/canalRecall/facade/materials.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { MassingRecord } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
/** Jordaan is west of the Prinsengracht; the local origin sits on the Westermarkt. */
const WEST_OF_M = Number(arg('west-of') ?? -30);
const MIN_HOUSES = Number(arg('min-houses') ?? 8);

interface Measured {
  pandId: string; panoramaId: string; capturedAt: string;
  standoffM: number; obliquityDeg: number;
  wall: [number, number, number, number]; wallWidthM: number;
  wallRgb: [number, number, number] | null;
  storeyBands: number; storeyIntervalsM: number[];
  bays: number; bayOffsetsM: number[];
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
}

const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')) as { facades: Record<string, Measured> };
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const years = new Map<string, number | null>(recon.buildings.map((b: any) => [b.buildingId, b.constructionYear]));
const heritage = new Map<string, string>();
for (const h of recon.heritage) if (h.buildingId && h.description) heritage.set(h.buildingId, h.description);

const origin = AREA.localOrigin;
const all = Object.values(store.facades).filter(f => f.openings.length >= 2);

/** Local metres from the fixed origin, so "west of Prinsengracht" is a number. */
const local = (f: Measured) => ({
  x: (f.wall[0] + f.wall[2]) / 2 - origin.x,
  y: (f.wall[1] + f.wall[3]) / 2 - origin.y,
  bearing: Math.atan2(f.wall[3] - f.wall[1], f.wall[2] - f.wall[0]),
});

const jordaan = all.filter(f => local(f).x < WEST_OF_M);
console.log(`${all.length} measured façades, ${jordaan.length} of them west of the Prinsengracht`);

/**
 * Group into terraces by *building line*, not by touching neighbours.
 *
 * Requiring façades to abut end-to-end finds nothing here, and the reason is not
 * that the terraces are absent — it is that measurement is sparse. Coverage
 * comes from a set cover over panoramas, which serves many buildings per image
 * but scatters them along a street rather than filling it. Demanding eight
 * consecutive measured houses demands eight consecutive lucky ones.
 *
 * A terrace is really a shared building line: façades that are parallel, sit
 * within a few metres of the same line, and run within a block of each other.
 * Neighbours nobody has measured then appear in the drawing as the gaps they
 * are, which is the honest result — a row with holes in it, not a row that
 * pretends the holes are houses.
 */
const remaining = [...jordaan];
const terraces: Measured[][] = [];
while (remaining.length) {
  const seed = remaining.pop()!;
  const s0 = local(seed);
  const ux = Math.cos(s0.bearing), uy = Math.sin(s0.bearing);
  const run = [seed];
  for (let i = remaining.length - 1; i >= 0; i--) {
    const candidate = remaining[i];
    const c = local(candidate);
    let dAngle = Math.abs(c.bearing - s0.bearing) % Math.PI;
    if (dAngle > Math.PI / 2) dAngle = Math.PI - dAngle;
    if (dAngle > 0.3) continue;                                  // not parallel
    const dx = c.x - s0.x, dy = c.y - s0.y;
    const perpendicular = Math.abs(-dx * uy + dy * ux);
    const alongLine = Math.abs(dx * ux + dy * uy);
    if (perpendicular > 4 || alongLine > 70) continue;           // not the same line, or a block away
    run.push(candidate);
    remaining.splice(i, 1);
  }
  if (run.length >= MIN_HOUSES) terraces.push(run);
}

terraces.sort((a, b) =>
  b.reduce((s, f) => s + f.openings.length, 0) - a.reduce((s, f) => s + f.openings.length, 0));
if (!terraces.length) throw new Error(`no contiguous run of ${MIN_HOUSES}+ measured façades found west of ${WEST_OF_M} m`);

const chosen = terraces[0];
// Order along the row, so the drawing reads left to right as the street does.
const first = chosen[0];
const ux = (first.wall[2] - first.wall[0]) / first.wallWidthM;
const uy = (first.wall[3] - first.wall[1]) / first.wallWidthM;
const along = (f: Measured) => (f.wall[0] - first.wall[0]) * ux + (f.wall[1] - first.wall[1]) * uy;
chosen.sort((a, b) => along(a) - along(b));

const houses = chosen.map(f => {
  const mass = massing.get(f.pandId);
  const ground = mass?.groundLevel ?? 0;
  const material = f.wallRgb ? nearestMaterial(f.wallRgb, wallFamily(f.wallRgb)).material : null;
  return {
    pandId: f.pandId,
    widthM: f.wallWidthM,
    eavesM: mass?.eavesHeight != null ? Number((mass.eavesHeight - ground).toFixed(2)) : null,
    ridgeM: mass?.ridgeHeight != null ? Number((mass.ridgeHeight - ground).toFixed(2)) : null,
    roofForm: mass?.roofForm ?? 'unknown',
    constructionYear: years.get(f.pandId) ?? null,
    storeyBands: f.storeyBands,
    storeyIntervalsM: f.storeyIntervalsM,
    bays: f.bays,
    openings: f.openings,
    wallMaterial: material ? { id: material.id, name: material.name, colour: material.colour, texture: material.texture, tileM: material.tileM } : null,
    measuredRgb: f.wallRgb,
    observation: { panoramaId: f.panoramaId, capturedAt: f.capturedAt.slice(0, 10), standoffM: f.standoffM, obliquityDeg: f.obliquityDeg },
    registerSays: heritage.get(f.pandId) ?? null,
  };
});

await mkdir(STAGING, { recursive: true });
const file = path.join(STAGING, 'facade-demo.json');
await writeFile(file, JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-facade-demo.ts',
    attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0); BAG, Kadaster CC0; 3DBAG, TU Delft CC BY 4.0',
    terraceCandidates: terraces.length,
    houses: houses.length,
    totalWidthM: Number(houses.reduce((s, h) => s + h.widthM, 0).toFixed(1)),
    openings: houses.reduce((s, h) => s + h.openings.length, 0),
    caveat: 'Unvalidated. Openings, bays and storey bands come from an automated detector that has not been checked against a hand-labelled building; the registration check is still red at its own bar.',
  },
  materials: MATERIALS,
  houses,
}, null, 2));

console.log(`\n${terraces.length} candidate terraces; chose the one with the most measured openings`);
console.log(`${houses.length} houses, ${houses.reduce((s, h) => s + h.widthM, 0).toFixed(1)} m of frontage, ${houses.reduce((s, h) => s + h.openings.length, 0)} openings`);
for (const h of houses) {
  console.log(`  ${h.pandId}  ${h.widthM.toFixed(2).padStart(5)} m  ${String(h.ridgeM ?? '—').padStart(5)} m ridge  `
    + `${String(h.storeyBands).padStart(2)} bands  ${String(h.bays).padStart(2)} bays  ${String(h.openings.length).padStart(2)} openings  `
    + `${(h.wallMaterial?.id ?? 'unsampled').padEnd(18)} ${h.constructionYear ?? '—'}`);
}
console.log(`\nwrote ${path.relative(process.cwd(), file)}`);
