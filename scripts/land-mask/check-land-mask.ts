// Named land-mask regressions (feedback 2026-11-09, desktop Free Ride): water the mask draws over land that exists.
//   - Gevlebrug / Karlskrona-eiland (Houthaven): the basin the OSM/BGT snapshot still shows as water is filled land
//     (AHN dtm_05m +1.0..+1.6 m NAP, orthophoto 2025); the road must not run over open water for most of its length.
//   - Haparandadam: BAG pand 0363100012240915 is a moored houseboat (OSM w96706553): it stays on water (no land patch).
//
//   npx tsx scripts/land-mask/check-land-mask.ts [--water-dir=public/data/extracts/amsterdam/elevation-v1] [--expect=fixed|unfixed]
// Default expectation is `fixed`; `--expect=unfixed` documents the failing state of the published extract (exit 0 when any pin fails).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cellKey, lngLatToLocal, type ElevationIndex, type WaterCell } from '../../src/canalRecall/elevation/elevationData.ts';

const flag = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const dir = flag('water-dir', 'public/data/extracts/amsterdam/elevation-v1');
const expectFixed = flag('expect', 'fixed') === 'fixed';
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as ElevationIndex;
const q = index.quantization.xy, size = index.cellSizeM;

type Ring = [number, number][];
const cache = new Map<string, Ring[][]>();
function cellPolys(cx: number, cy: number): Ring[][] {
  const key = cellKey(cx, cy);
  let polys = cache.get(key);
  if (!polys) {
    let cell: WaterCell | null = null;
    try { cell = JSON.parse(readFileSync(join(dir, 'cells', `${key}.json`), 'utf8')) as WaterCell; } catch { /* no water in this cell */ }
    polys = (cell?.water ?? []).map(poly => poly.map(ring => { const r: Ring = []; for (let i = 0; i < ring.length; i += 2) r.push([cx * size + ring[i] * q, cy * size + ring[i + 1] * q]); return r; }));
    cache.set(key, polys);
  }
  return polys;
}
const inRing = (x: number, y: number, ring: Ring) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
/** True when the lng/lat lies in the water mask (water cells are 1 km, polygons cut at cell edges). */
export function isWater(lng: number, lat: number): boolean {
  const [x, y] = lngLatToLocal(index, lng, lat);
  const polys = cellPolys(Math.floor(x / size), Math.floor(y / size));
  return polys.some(poly => { let inside = false; for (const ring of poly) if (inRing(x, y, ring)) inside = !inside; return inside; });
}

const failures: string[] = [];
const expect = (ok: boolean, what: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };

// Karlskrona-eiland / Libau-eiland filled basin (AHN medians +1.07, +1.43, +1.62 m NAP).
for (const [name, lng, lat] of [['Houthaven filled basin W (Libau-eiland)', 4.881714, 52.391858], ['Houthaven filled basin (Karlskrona-eiland N)', 4.883934, 52.393058], ['Houthaven filled basin (Karlskrona-eiland E)', 4.884336, 52.392675]] as const) expect(!isWater(lng, lat), `${name} is land`);

// Gevlebrug (OSM way 991513319, BRU2430, 75 m): the measured deck must span the water the road crosses. The AHN deck was
// 28 m (23.8-52.1) against water over 0.46-72.56, so ~23 m of road at each end ran over open water ("Gevlebrug stub").
{
  const bridges = JSON.parse(readFileSync(join(dir, 'bridges.json'), 'utf8')) as { measured: { id: string; name: string; deck: [number, number]; water: [number, number] | null }[] };
  const g = bridges.measured.find(b => b.id === 'BRU2430');
  expect(!!g && g.name === 'Gevlebrug' && !!g.water, 'Gevlebrug (BRU2430) is a measured bridge over water');
  if (g?.water) {
    const uncovered = Math.max(0, g.deck[0] - g.water[0]) + Math.max(0, g.water[1] - g.deck[1]);
    console.log(`  Gevlebrug deck ${g.deck.join('-')} m, water ${g.water.join('-')} m: ${uncovered.toFixed(1)} m of water crossing without a deck`);
    expect(uncovered <= 3, 'Gevlebrug deck spans the water crossing (at most 3 m bare)');
  }
}

// Haparandadam pand 0363100012240915 (909 m2, 1966) is OSM way 96706553, tagged as a houseboat: a moored vessel that really floats.
// The mask must leave it on water (houseboat-land regression, ownGround.test.ts); the user's "building floating on water" is correct.
{
  const ring: [number, number][] = [[4.88044, 52.396988], [4.879924, 52.396721], [4.880112, 52.396585], [4.880628, 52.396853]];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const wet = [[cx, cy], ...ring.map(p => [p[0] + (cx - p[0]) * 0.2, p[1] + (cy - p[1]) * 0.2])].filter(([x, y]) => isWater(x, y)).length;
  console.log(`  Haparandadam pand samples over water: ${wet}/5`);
  expect(wet === 5, 'Haparandadam pand (houseboat w96706553) stays on water');
}

if (expectFixed ? failures.length : !failures.length) { console.error(expectFixed ? `${failures.length} land-mask pin(s) failed` : 'expected the unfixed extract to fail'); process.exit(1); }
