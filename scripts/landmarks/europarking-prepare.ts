/**
 * Europarking (Marnixstraat car park) plan source: the BAG footprints of the car park and the four small pands in its
 * undercroft, one native frame, and the fitted plan shapes the builder sweeps (two ramp drums, the deck block).
 *
 *   node --import tsx scripts/landmarks/europarking-prepare.ts [--out=scripts/landmarks/europarking-marnixstraat-footprints.json]
 *
 * Pands (api.data.amsterdam.nl BAG, CC0; cached in .cache/bag-panden/):
 *   0363100012185422  the car park, 1972 (block 71.0 x 38.6 m, two drums r 9.30 m with 3.85 m open cores)
 *   0363100012243632  Waterkant (2016, bijeenkomstfunctie 145 m2) under the drum pinch
 *   0363100012243633  2016 store under drum A's north-east side (26 m2)
 *   0363100012243634  2016 container along the block's canal face south of drum B (43 m2, 3DBAG 3.0 m)
 *   0363100012245310  2018 kiosk under the block (15 m2)
 * Frame: x east, z south, y up, metres; origin = vertex average of the car park's BAG ring (RD).
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

export const EUROPARKING_PANDS = {
  carPark: '0363100012185422', waterkant: '0363100012243632', store: '0363100012243633', container: '0363100012243634', kiosk: '0363100012245310',
} as const;

async function bagRing(pand: string): Promise<number[][]> {
  const file = path.join('.cache', 'bag-panden', `${pand}.json`);
  let j: {geometrie: {coordinates: number[][][]}};
  if (fs.existsSync(file)) j = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    const r = await fetch(`https://api.data.amsterdam.nl/v1/bag/panden/${pand}/?_format=json`);
    if (!r.ok) throw Error(`BAG ${pand}: ${r.status}`);
    j = await r.json();
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(j));
  }
  const ring = j.geometrie.coordinates[0];
  return ring.slice(0, -1);
}

/** Algebraic (Kasa) circle fit: centre, radius and the worst residual. */
function fitCircle(pts: number[][]) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) { const u = p[0] - mx, v = p[1] - my; suu += u * u; svv += v * v; suv += u * v; suuu += u ** 3; svvv += v ** 3; suvv += u * v * v; svuu += v * u * u; }
  const det = suu * svv - suv * suv, b0 = (suuu + suvv) / 2, b1 = (svvv + svuu) / 2;
  const uc = (b0 * svv - b1 * suv) / det, vc = (suu * b1 - suv * b0) / det;
  const c = [mx + uc, my + vc], r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  return {c, r, worst: Math.max(...pts.map(p => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - r)))};
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;

async function main() {
  const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'scripts/landmarks/europarking-marnixstraat-footprints.json';
  const rings = Object.fromEntries(await Promise.all(Object.entries(EUROPARKING_PANDS).map(async ([k, p]) => [k, await bagRing(p)] as const)));
  const main = rings.carPark;
  const ax = main.reduce((s, p) => s + p[0], 0) / main.length, ay = main.reduce((s, p) => s + p[1], 0) / main.length;
  const L = (p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))];
  // The car park ring: the four block corners are the vertices with the longest edges; every other vertex lies on a
  // drum arc or one of the four short fillets where the drums meet the block's canal face.
  const n = main.length, len = (i: number) => Math.hypot(main[(i + 1) % n][0] - main[i][0], main[(i + 1) % n][1] - main[i][1]);
  const long = [...Array(n).keys()].filter(i => len(i) > 30);
  // Four: the canal face from drum B's fillet to the S corner, then S -> E, E -> N, N -> W.
  if (long.length !== 4) throw Error(`expected four long block edges, found ${long.length}`);
  const corners = [long[1], (long[1] + 1) % n, long[3], (long[3] + 1) % n].map(i => main[i]);
  // Drum arcs: the vertices off the block, assigned to the drum whose core they surround.
  const arcPts = main.filter((_, i) => !long.includes(i) && !long.includes((i - 1 + n) % n));
  const holes: number[][][] = [];
  // The open core wells: the BAG API returns the outer ring only; the 3DBAG LoD0 keeps them as holes, cached in the
  // large recipe's facts file (bagFootprintRD rings 1 and 2).
  const facts = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/marnixstraat-248-185422/facts.json', 'utf8'));
  for (const h of (facts.bagFootprintRD as number[][][]).slice(1)) holes.push(h.slice(0, -1));
  const cores = holes.map(fitCircle);
  const drums = cores.map(core => {
    const own = arcPts.filter(p => Math.abs(Math.hypot(p[0] - core.c[0], p[1] - core.c[1]) - 9.3) < 0.4);
    const fit = fitCircle(own);
    return {centre: L(fit.c), radius: r3(fit.r), worstResidual: r3(fit.worst), arcVertices: own.length, core: {centre: L(core.c), radius: r3(core.r), worstResidual: r3(core.worst)}};
  });
  const json = {
    id: 'europarking-marnixstraat', anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)),
    coordinateConvention: 'native east/south metres from anchor (RD axes), y above the 3DBAG ground (0.50 m NAP)',
    source: 'https://api.data.amsterdam.nl/v1/bag/panden/<id>/ (BAG, CC0); core wells from the 3DBAG LoD0 rings (CC BY 4.0)',
    pands: Object.fromEntries(Object.entries(rings).map(([k, r]) => [k, {pand: EUROPARKING_PANDS[k as keyof typeof EUROPARKING_PANDS], ring: r.map(L)}])),
    block: {corners: corners.map(L), note: 'S, E, N, W corners; the canal face is W -> S (bearing 247), Marnixstraat face E -> N (67), Lijnbaansgracht end N -> W (337), south end S -> E (157)'},
    drums,
  };
  fs.writeFileSync(out, JSON.stringify(json, null, 1));
  console.log(out, 'anchor', json.anchor, 'drums', drums.map(d => `${d.centre} r${d.radius} (±${d.worstResidual}, ${d.arcVertices} pts) core r${d.core.radius}`).join('; '));
}
await main();
