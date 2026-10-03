// Street ensembles: measure rhythm on named streets and check the grouping is sane.
//   npx tsx scripts/check-street-ensembles.ts            assertions + a table
//   STREET_OUT=<dir> npx tsx scripts/check-street-ensembles.ts   also write stats.json and SVG elevation strips / plans
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { analyseStreets, type EnsembleBuilding, type EnsembleWay, type Pt, type StreetAnalysis } from '../src/canalRecall/streetEnsembles.ts';
import { FRONT_HIGHWAYS } from '../src/canalRecall/streetFronts.ts';
import { roofPlanForFeature } from '../src/canalRecall/roofMesh.ts';
import { bayLookFor } from '../src/canalRecall/bayLook.ts';
import { facadeStyleFor, footprintAreaM2 } from '../src/canalRecall/genericFacades.ts';

const ROOT = 'public/data/extracts/amsterdam';
const ORIGIN = { lng: 4.9, lat: 52.37 };
const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const proj = (lng: number, lat: number): Pt => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY];
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, r = lat * Math.PI / 180; return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)] as const; };

const STREETS = ['Rozengracht', 'Kinkerstraat', 'Jan Pieter Heijestraat', 'Ferdinand Bolstraat', 'Haarlemmerdijk', 'Javastraat', 'Utrechtsestraat', 'Tweede Constantijn Huygensstraat'];

const routing: Array<{ id: string; name: string; highway: string; path: [number, number][] }> = JSON.parse(fs.readFileSync(`${ROOT}/streets-routing.json`, 'utf8'));
const shopfronts: { buildings: Record<string, number> } = JSON.parse(fs.readFileSync(`${ROOT}/shopfronts.json`, 'utf8'));
const readGz = (file: string) => (fs.existsSync(file) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()) : null);

interface Loaded { buildings: EnsembleBuilding[]; ways: EnsembleWay[] }

/** Buildings and ways within `marginM` of a named street's ways. */
function load(name: string, marginM = 260): Loaded {
  const own = routing.filter(s => s.name === name);
  assert.ok(own.length, `${name} is in the routing extract`);
  const pts = own.flatMap(s => s.path.map(([lat, lng]) => proj(lng, lat)));
  const [x0, x1] = [Math.min(...pts.map(p => p[0])) - marginM, Math.max(...pts.map(p => p[0])) + marginM];
  const [y0, y1] = [Math.min(...pts.map(p => p[1])) - marginM, Math.max(...pts.map(p => p[1])) + marginM];
  const lngOf = (x: number) => ORIGIN.lng + x / KX, latOf = (y: number) => ORIGIN.lat + y / KY;
  const [tx0, ty1] = tileOf(lngOf(x0), latOf(y0)), [tx1, ty0] = tileOf(lngOf(x1), latOf(y1));
  const buildings: EnsembleBuilding[] = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
    const tile = readGz(`${ROOT}/building-tiles/14/${tx}/${ty}.geojson.gz`);
    if (!tile) continue;
    const facts = readGz(`${ROOT}/building-facts/14/${tx}/${ty}.json.gz`)?.buildings ?? {};
    for (const f of tile.features) {
      const g = f.geometry, ring: number[][] = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
      const p = ring.map(c => proj(c[0], c[1]));
      if (p.every(q => q[0] < x0 || q[0] > x1) || p.every(q => q[1] < y0 || q[1] > y1)) continue;
      const row = facts[String(f.properties.id).replace('NL.IMBAG.Pand.', 'P')];
      const year = row && row[0] >= 1200 && row[0] <= 2027 ? row[0] as number : null;
      buildings.push({ id: f.properties.id, ring: p, heightM: Number(f.properties.height), year, shop: shopfronts.buildings[f.properties.id] !== undefined });
    }
  }
  const ways: EnsembleWay[] = routing.filter(s => !s.highway || FRONT_HIGHWAYS.has(s.highway)).map(s => ({ id: s.id, name: s.name, highway: s.highway, points: s.path.map(([lat, lng]) => proj(lng, lat)) }))
    .filter(w => w.points.some(p => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1));
  return { buildings, ways };
}

const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const pct = (a: number, b: number) => (b ? Math.round(1000 * a / b) / 10 : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;

export function measure(name: string, a: StreetAnalysis, buildings: EnsembleBuilding[]) {
  const faces = a.faces.filter(f => f.streetName === name && f.lengthM >= 25);
  const widths: number[] = [], steps: number[] = [], heights: number[] = [];
  let members = 0, shops = 0, withYear = 0, lengthM = 0, shopBandM = 0, longestBand = 0, eaveSteps = 0;
  const runs = (tol: number) => {
    const lens: number[] = []; let inRuns3 = 0, total = 0;
    for (const f of faces) {
      let cur = 0;
      const close = () => { if (cur >= 2) lens.push(cur); if (cur >= 3) inRuns3 += cur; cur = 0; };
      f.members.forEach((m, i) => {
        total++;
        const b = buildings[m.building], p = i ? buildings[f.members[i - 1].building] : null;
        const ok = p && b.year !== null && p.year !== null && Math.abs(b.year - p.year) <= tol && Math.abs(b.heightM - p.heightM) <= 1.6;
        if (ok) cur = cur ? cur + 1 : 2; else close();
      });
      close();
    }
    return { runs: lens.length, meanRunLen: r1(lens.reduce((s, x) => s + x, 0) / Math.max(1, lens.length)), shareInRuns3: pct(inRuns3, total) };
  };
  const years: number[] = [];
  for (const f of faces) {
    lengthM += f.lengthM;
    for (const [from, to] of f.shopBands) { shopBandM += to - from; longestBand = Math.max(longestBand, to - from); }
    f.members.forEach((m, i) => {
      const b = buildings[m.building];
      members++; if (b.shop) shops++; if (b.year !== null) { withYear++; years.push(b.year); }
      widths.push(m.endM - m.startM); heights.push(b.heightM);
      if (i) { const d = Math.abs(b.heightM - buildings[f.members[i - 1].building].heightM); steps.push(d); if (d >= 1.0) eaveSteps++; }
    });
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  const sd = (xs: number[]) => Math.sqrt(mean(xs.map(x => (x - mean(xs)) ** 2)));
  const hist = new Map<number, number>();
  for (const w of widths) hist.set(Math.round(w / 0.5) * 0.5, (hist.get(Math.round(w / 0.5) * 0.5) ?? 0) + 1);
  const modes = [...hist].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([w, n]) => `${w} m x${n}`);
  const ens = a.ensembles.filter(e => faces.some(f => f.id === e.faceId));
  const corners = new Set(a.frontages.filter(f => f.corner && faces.some(face => face.members.includes(f))).map(f => f.building));
  const faceBuildings = new Set(faces.flatMap(f => f.members.map(m => m.building)));
  const cornerDelta: number[] = [];
  for (const f of faces) f.members.forEach((m, i) => {
    if (!corners.has(m.building)) return;
    const nb = [f.members[i - 1], f.members[i + 1]].filter(Boolean).filter(x => !corners.has(x.building)).map(x => buildings[x.building].heightM);
    if (nb.length) cornerDelta.push(buildings[m.building].heightM - mean(nb));
  });
  return {
    street: name, faces: faces.length, lengthM: Math.round(lengthM), buildings: members, uniqueBuildings: faceBuildings.size,
    plotWidthM: { p10: r1(quantileOf(widths, 0.1)), median: r1(med(widths)), p90: r1(quantileOf(widths, 0.9)), cv: r1(sd(widths) / mean(widths)), topModes: modes },
    yearKnownPct: pct(withYear, members), yearMedian: med(years), yearP10: quantileOf(years, 0.1), yearP90: quantileOf(years, 0.9),
    runsExactYear: runs(0), runsPlusMinus2: runs(2),
    ensembles: ens.length, ensemblesOfTwoPlus: ens.filter(e => e.buildings.length >= 2).length, buildingsInEnsemble3Plus: pct(ens.filter(e => e.buildings.length >= 3).reduce((s, e) => s + e.buildings.length, 0), members),
    meanEnsembleLengthM: r1(mean(ens.filter(e => e.buildings.length >= 2).map(e => e.endM - e.startM))),
    shopSharePct: pct(shops, members), shopBandPctOfLength: pct(shopBandM, lengthM), longestShopBandM: Math.round(longestBand), commercialFaces: faces.filter(f => f.commercial).length,
    height: { mean: r1(mean(heights)), sd: r1(sd(heights)), medianAdjStep: r1(med(steps)), adjWithin0_5Pct: pct(steps.filter(s => s < 0.5).length, steps.length), adjWithin1_6Pct: pct(steps.filter(s => s < 1.6).length, steps.length), eaveStepsPer100m: r1(100 * eaveSteps / Math.max(1, lengthM)) },
    corners: { n: corners.size, meanHeightMinusNeighbours: r1(mean(cornerDelta)) },
  };
}
function quantileOf(xs: number[], q: number) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; }

// ---- SVG: the street as the data says it is, one face per strip ------------------------------

const decadeHue = (y: number | null) => (y === null ? '#bbb' : y < 1860 ? '#6b3a2a' : y < 1915 ? '#c06a3c' : y < 1945 ? '#8a4a8a' : y < 1985 ? '#5a8aa8' : '#6fae7c');
function strips(name: string, a: StreetAnalysis, buildings: EnsembleBuilding[]): string {
  const faces = a.faces.filter(f => f.streetName === name && f.lengthM >= 40).sort((x, y) => y.lengthM - x.lengthM).slice(0, 5);
  const scale = 2.4, rowH = 140, W = Math.max(Math.max(...faces.map(f => f.lengthM), 100) * scale + 40, 560);
  let y = 24, svg = '';
  for (const f of faces) {
    const base = y + 100;
    svg += `<text x="4" y="${y - 6}" font-size="11" fill="#333">${name} side ${f.side > 0 ? 'L' : 'R'} ${Math.round(f.lengthM)} m, ${f.members.length} buildings, shop ${Math.round(f.shopShare * 100)}%</text>`;
    const eIdx = new Map<number, number>(); a.ensembles.filter(e => e.faceId === f.id).forEach((e, i) => e.buildings.forEach(b => eIdx.set(b, i)));
    for (const m of f.members) {
      const b = buildings[m.building], x = 20 + (m.startM - f.startM) * scale, w = Math.max(1, (m.endM - m.startM) * scale - 1), h = b.heightM * 3;
      svg += `<rect x="${r1(x)}" y="${r1(base - h)}" width="${r1(w)}" height="${r1(h)}" fill="${decadeHue(b.year)}" stroke="#222" stroke-width=".5"/>`;
      if (b.shop) svg += `<rect x="${r1(x)}" y="${r1(base - 12)}" width="${r1(w)}" height="12" fill="#f2c14e" opacity=".9"/>`;
      if (m.corner) svg += `<circle cx="${r1(x + w / 2)}" cy="${base + 8}" r="3" fill="#d22"/>`;
    }
    // ensemble brackets
    for (const e of a.ensembles.filter(e => e.faceId === f.id && e.buildings.length >= 2)) svg += `<line x1="${20 + (e.startM - f.startM) * scale}" x2="${20 + (e.endM - f.startM) * scale}" y1="${base + 16}" y2="${base + 16}" stroke="#2a7" stroke-width="3"/>`;
    y += rowH;
  }
  const legend = [['<1860', '#6b3a2a'], ['1860-1914', '#c06a3c'], ['1915-44', '#8a4a8a'], ['1945-84', '#5a8aa8'], ['1985+', '#6fae7c'], ['no year', '#bbb']].map(([t, c], i) => `<rect x="${4 + i * 80}" y="${y}" width="10" height="10" fill="${c}"/><text x="${18 + i * 80}" y="${y + 9}" font-size="10">${t}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y + 24}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>${svg}${legend}<text x="${4 + 6 * 80}" y="${y + 9}" font-size="10">gold = shopfront, green bar = ensemble (same year +-2, height +-1.6 m), red dot = corner. Height x3.</text></svg>`;
}

/** A camera spot for the game probe: the middle of the street's longest face, facing along it. */
function probePoint(name: string, a: StreetAnalysis) {
  const face = a.faces.filter(f => f.streetName === name).sort((x, y) => y.lengthM - x.lengthM)[0];
  const chain = a.chains[face.chain], at = (m: number): Pt => {
    for (let i = 1; i < chain.points.length; i++) if (chain.cumM[i] >= m) { const t = (m - chain.cumM[i - 1]) / (chain.cumM[i] - chain.cumM[i - 1] || 1); return [chain.points[i - 1][0] + t * (chain.points[i][0] - chain.points[i - 1][0]), chain.points[i - 1][1] + t * (chain.points[i][1] - chain.points[i - 1][1])]; }
    return chain.points[chain.points.length - 1];
  };
  const mid = (face.startM + face.endM) / 2, [a0, a1, a2] = [at(mid - 14), at(mid + 10), at(mid + 40)];
  const ll = (p: Pt) => [Math.round((ORIGIN.lng + p[0] / KX) * 1e6) / 1e6, Math.round((ORIGIN.lat + p[1] / KY) * 1e6) / 1e6];
  const bearing = Math.round(((Math.atan2(a2[0] - a0[0], a2[1] - a0[1]) * 180 / Math.PI) + 360) % 360);
  return { street: name, AT: ll(a0), FACE: ll(a1), CAM: [...ll(a1), 18.4, 72, bearing] };
}

/**
 * What the game draws today inside one builder's run: the current per-building choices (hash of the id)
 * for roof kind, eave line (height minus the roof's rise), wall colour and window style, counted per ensemble of 3+.
 */
export function drawnVariety(name: string, a: StreetAnalysis, buildings: EnsembleBuilding[], shared = false) {
  const faceIds = new Set(a.faces.filter(f => f.streetName === name).map(f => f.id));
  const ens = a.ensembles.filter(e => faceIds.has(e.faceId) && e.buildings.length >= 3);
  let sameRoof = 0, sameWall = 0, sameBay = 0, sameEaveWithin0_5 = 0, roofKinds = 0, walls = 0, eaveSdSum = 0, rawSdSum = 0, flat = 0, members = 0;
  for (const e of ens) {
    const drawn = e.buildings.map((bi, k) => {
      const b = buildings[bi], h = shared ? e.snappedM[k] : b.heightM;
      const ring = b.ring.map(([x, y]) => [ORIGIN.lng + x / KX, ORIGIN.lat + y / KY]);
      const geometry = { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
      const style = facadeStyleFor({ year: b.year, heightM: b.heightM, minHeightM: 0, footprintM2: footprintAreaM2(geometry) });
      const seed = shared ? e.seed : b.id;
      const feature = { type: 'Feature' as const, properties: { id: seed, height: b.heightM, minHeight: 0, constructionYear: b.year, facadeStyle: style ?? 'c19', facade: 'x' }, geometry };
      const plan = roofPlanForFeature(feature);
      const look = bayLookFor(seed, b.year, b.heightM, 'photo', b.shop ? 'groundShop' : 'quiet');
      return { roof: plan ? `${plan.kind}/${plan.material}` : 'flat', eave: plan ? h - plan.riseM : h, wall: look.wallHex, bay: look.layers.upper };
    });
    const sd = (xs: number[]) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length); };
    const kinds = new Set(drawn.map(d => d.roof)), wallSet = new Set(drawn.map(d => d.wall));
    members += drawn.length; flat += drawn.filter(d => d.roof === 'flat').length;
    if (kinds.size === 1) sameRoof++; if (wallSet.size === 1) sameWall++; if (new Set(drawn.map(d => d.bay)).size === 1) sameBay++;
    roofKinds += kinds.size; walls += wallSet.size;
    const eaves = drawn.map(d => d.eave); eaveSdSum += sd(eaves); rawSdSum += sd(e.buildings.map(bi => buildings[bi].heightM));
    if (Math.max(...eaves) - Math.min(...eaves) <= 0.5) sameEaveWithin0_5++;
  }
  const n = Math.max(1, ens.length);
  return { ensemblesOf3Plus: ens.length, membersInThem: members, allSameRoofKindPct: pct(sameRoof, n), allSameWallColourPct: pct(sameWall, n), allSameWindowStylePct: pct(sameBay, n),
    eaveSpreadWithin0_5mPct: pct(sameEaveWithin0_5, n), meanDistinctRoofKinds: r1(roofKinds / n), meanDistinctWallColours: r1(walls / n), meanEaveSdM: r1(eaveSdSum / n), meanRawHeightSdM: r1(rawSdSum / n) };
}

/** CITY=1: the grouping over every building and street in the extract, to size a published extract. */
function cityRun() {
  const t0 = Date.now();
  const buildings: EnsembleBuilding[] = [];
  const tiles = JSON.parse(fs.readFileSync(`${ROOT}/building-tiles/index-z14.json`, 'utf8')).tileList as string[];
  for (const t of tiles) {
    const [, tx, ty] = t.split('/');
    const tile = readGz(`${ROOT}/building-tiles/${t}.geojson.gz`);
    const facts = readGz(`${ROOT}/building-facts/${t}.json.gz`)?.buildings ?? {};
    if (!tile) continue;
    for (const f of tile.features) {
      const g = f.geometry, ring: number[][] = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
      const row = facts[String(f.properties.id).replace('NL.IMBAG.Pand.', 'P')];
      buildings.push({ id: f.properties.id, ring: ring.map(c => proj(c[0], c[1])), heightM: Number(f.properties.height), year: row && row[0] >= 1200 && row[0] <= 2027 ? row[0] : null, shop: shopfronts.buildings[f.properties.id] !== undefined });
    }
    void tx; void ty;
  }
  const ways: EnsembleWay[] = routing.filter(s => !s.highway || FRONT_HIGHWAYS.has(s.highway)).map(s => ({ id: s.id, name: s.name, highway: s.highway, points: s.path.map(([lat, lng]) => proj(lng, lat)) }));
  const t1 = Date.now();
  const a = analyseStreets(buildings, ways);
  const t2 = Date.now();
  const e2 = a.ensembles.filter(e => e.buildings.length >= 2), e3 = a.ensembles.filter(e => e.buildings.length >= 3);
  const inFace = new Set(a.faces.flatMap(f => f.members.map(m => m.building)));
  const commercial = new Set(a.faces.filter(f => f.commercial).flatMap(f => f.members.map(m => m.building)));
  const terrace = a.faces.filter(f => f.members.length >= 5);
  const share3 = (f: typeof a.faces[number]) => { const ids = new Set(f.members.map(m => m.building)); return a.ensembles.filter(e => e.faceId === f.id && e.buildings.length >= 3).reduce((s, e) => s + e.buildings.length, 0) / ids.size; };
  const regimes = { terrace: 0, mixed: 0, organic: 0 };
  for (const f of terrace) { const x = share3(f); regimes[x >= 0.6 ? 'terrace' : x >= 0.25 ? 'mixed' : 'organic']++; }
  return { buildings: buildings.length, ways: ways.length, loadS: (t1 - t0) / 1000, analyseS: (t2 - t1) / 1000, chains: a.chains.length, faces: a.faces.length, facesOf5Plus: terrace.length, commercialFaces: a.faces.filter(f => f.commercial).length,
    commercialFaceLengthKm: r1(a.faces.filter(f => f.commercial).reduce((s, f) => s + f.lengthM, 0) / 1000), buildingsInFaces: inFace.size, buildingsInCommercialFaces: commercial.size,
    ensembles: a.ensembles.length, ensemblesOf2Plus: e2.length, ensemblesOf3Plus: e3.length, buildingsInEnsembles2Plus: e2.reduce((s, e) => s + e.buildings.length, 0), buildingsInEnsembles3Plus: e3.reduce((s, e) => s + e.buildings.length, 0),
    cornerBuildings: new Set(a.frontages.filter(f => f.corner).map(f => f.building)).size, regimesOfFacesWith5PlusBuildings: regimes };
}
if (process.env.CITY) { console.log(JSON.stringify(cityRun(), null, 1)); process.exit(0); }

// Synthetic block: a street along x, six 5 m houses on its north side. Years 1899-1901 and one height make one
// builder's run; a 1960 block and a 9 m-taller 1900 house each end it; a gap of 12 m ends the face.
{
  const house = (i: number, x0: number, year: number | null, h: number, shop = true): EnsembleBuilding => ({ id: `syn${i}`, ring: [[x0, 9], [x0 + 5, 9], [x0 + 5, 20], [x0, 20], [x0, 9]], heightM: h, year, shop });
  const bs = [house(0, 0, 1899, 15), house(1, 5, 1900, 15.2), house(2, 10, 1901, 15), house(3, 15, 1960, 15), house(4, 20, 1900, 24), house(5, 25, 1900, 15), house(6, 42, 1900, 15, false)];
  const street: EnsembleWay = { id: 'w', name: 'Teststraat', highway: 'residential', points: [[-20, 0], [80, 0]] };
  const a = analyseStreets(bs, [street]);
  assert.equal(a.faces.length, 1, 'the 12 m gap leaves a one-house stub, which is no face');
  assert.deepEqual(a.ensembles.map(e => e.buildings.length), [3, 1, 1, 1], 'a 3-house builder run, then three singles');
  assert.equal(a.ensembles[0].eaveM, 15, 'the run keeps one eave line');
  assert.deepEqual(a.ensembles[0].snappedM, [15, 15, 15], 'the 15.2 m house snaps to the run\'s eave');
  assert.ok(a.ensembleOf[6] === -1, 'the stub after the gap belongs to no face');
  assert.ok(a.faces[0].commercial === false || a.faces[0].shopBands.length > 0, 'shop band found');
}

const results = [];
const probes = [];
const outDir = process.env.STREET_OUT;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
for (const name of STREETS) {
  const { buildings, ways } = load(name);
  const a = analyseStreets(buildings, ways);
  const m = measure(name, a, buildings);
  const faceIds = new Set(a.faces.filter(f => f.streetName === name).map(f => f.id));
  const pins = a.ensembles.filter(e => faceIds.has(e.faceId) && e.buildings.length >= 4).sort((x, y) => (y.endM - y.startM) - (x.endM - x.startM)).slice(0, 2).map(e => {
    const bs = e.buildings.map(i => buildings[i]), c = bs[Math.floor(bs.length / 2)].ring[0];
    return { first: bs[0].id, last: bs[bs.length - 1].id, buildings: bs.length, lengthM: Math.round(e.endM - e.startM), yearMedian: e.year, eaveM: e.eaveM, near: [Math.round((ORIGIN.lng + c[0] / KX) * 1e6) / 1e6, Math.round((ORIGIN.lat + c[1] / KY) * 1e6) / 1e6] };
  });
  results.push({ ...m, pins, drawnToday: drawnVariety(name, a, buildings), drawnWithEnsembleSeed: drawnVariety(name, a, buildings, true) });
  probes.push(probePoint(name, a));
  if (outDir) fs.writeFileSync(`${outDir}/strip-${name.replace(/\s+/g, '-').toLowerCase()}.svg`, strips(name, a, buildings));
}

// Named regressions: the grouping must find real structure on the commercial streets.
const by = Object.fromEntries(results.map(r => [r.street, r]));
for (const s of ['Rozengracht', 'Kinkerstraat', 'Jan Pieter Heijestraat', 'Ferdinand Bolstraat']) {
  assert.ok(by[s].buildings >= 60, `${s}: frontage buildings found (${by[s].buildings})`);
  assert.ok(by[s].plotWidthM.median > 3 && by[s].plotWidthM.median < 20, `${s}: plausible plot width (${by[s].plotWidthM.median})`);
}
for (const s of ['Kinkerstraat', 'Jan Pieter Heijestraat', 'Ferdinand Bolstraat']) assert.ok(by[s].commercialFaces >= 1, `${s} has a commercial face`);
if (outDir) { fs.writeFileSync(`${outDir}/stats.json`, JSON.stringify(results, null, 1)); fs.writeFileSync(`${outDir}/probe-points.json`, JSON.stringify(probes, null, 1)); }
console.log(JSON.stringify(results, null, 1));
console.log('street ensembles: ok');
