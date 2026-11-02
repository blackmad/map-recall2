/**
 * Plan sources for the Vijzelstraat landmark lane (#182): the Vijzelbank / Prins en Keizer (Vijzelstraat 66-80, BAG pand
 * 0363100012165685, M.F. Duintjer with J. Trapman, 1969-1973) and the Carlton Hotel (Vijzelstraat 4, BAG pand 0363100012168111,
 * G.J. Rutgers 1926-1928).
 *
 *   node --import tsx scripts/landmarks/vijzelstraat-prepare.ts [--only=vijzelbank|carlton-hotel]
 *
 * Same method as bungehuis-prepare.ts: the BAG outline from PDOK BAG WFS in RD (CC0) and the 3DBAG LoD2.2 shell (CC BY 4.0), both
 * cached, written as scripts/landmarks/<id>-footprints.json in the native frame: x east, z south, y up from the 3DBAG ground,
 * metres, origin = vertex average of the BAG ring (RD). `surfaces` is the LoD2.2 shell (ShellSource format), `nativeRing` the BAG
 * ring, `facadeRing` the ring with near-collinear vertices (< 0.15 m off the chord) merged, `neighbours` the BAG pands of the
 * committed bag tiles (z14) within 3 m of the ring, with their 3DBAG height, so the builder can leave party walls undressed.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat, lngLatToRd} from '../../src/canalRecall/rdCoordinates.ts';
import zlib from 'node:zlib';

const TARGETS: Record<string, string> = {'vijzelbank': '0363100012165685', 'carlton-hotel': '0363100012168111'};
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
/** Douglas-Peucker on a closed ring. */
function simplify(ring: number[][], tol: number): number[][] {
  const keep = new Array(ring.length).fill(false);
  const dist = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-9; return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L; };
  const rec = (i: number, j: number) => {
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) { const d = dist(ring[k % ring.length], ring[i % ring.length], ring[j % ring.length]); if (d > best) { best = d; bi = k; } }
    if (best > tol) { keep[bi % ring.length] = true; rec(i, bi); rec(bi, j); }
  };
  let far = 0, fd = 0; ring.forEach((p, k) => { const d = Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]); if (d > fd) { fd = d; far = k; } });
  keep[0] = keep[far] = true; rec(0, far); rec(far, ring.length);
  return ring.filter((_, k) => keep[k]);
}
for (const [id, PAND] of Object.entries(TARGETS)) {
  if (only && only !== id) continue;
  const wfs = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`;
  const bag = (await cachedJson(wfs)).features[0];
  const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND}`);
  const ringRD = open(bag.geometry.coordinates[0]);
  const holesRD = bag.geometry.coordinates.slice(1).map(open);
  const ax = ringRD.reduce((s: number, p: number[]) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s: number, p: number[]) => s + p[1], 0) / ringRD.length;
  const attrs = d.feature.CityObjects[`NL.IMBAG.Pand.${PAND}`].attributes;
  const ground = attrs.b3_h_maaiveld as number;
  const tr = d.metadata.transform;
  const verts = (d.feature.vertices as number[][]).map(v => { const p = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(p[0] - ax), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - ay))]; });
  const parts = Object.keys(d.feature.CityObjects).filter(k => k.startsWith(`NL.IMBAG.Pand.${PAND}-`));
  const surfaces: {type: string; rings: number[][][]}[] = [];
  for (const part of parts) {
    const g = d.feature.CityObjects[part].geometry.find((x: {lod: string}) => x.lod === '2.2');
    if (!g) continue;
    (g.boundaries[0] as number[][][]).forEach((s, i) => surfaces.push({type: g.semantics.surfaces[g.semantics.values[0][i]].type as string, rings: s.map(r => r.map(k => verts[k]))}));
  }
  const nat = (p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))];
  const out = {
    id, bagId: PAND, bagYear: bag.properties.bouwjaar, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)), groundNAP: ground,
    coordinateConvention: 'native east/south metres from anchor; y above local ground',
    sources: {bag: `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${PAND} (BAG, CC0, fetched 2026-11-01)`, shell: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND} (3DBAG, CC BY 4.0, fetched 2026-11-01)`},
    attributes: {roofMaxNAP: attrs.b3_h_dak_max, roofMinNAP: attrs.b3_h_dak_min, ridgeNAP: attrs.b3_h_nok, roof70pNAP: attrs.b3_h_dak_70p},
    nativeRing: ringRD.map(nat),
    nativeHoles: holesRD.map((h: number[][]) => h.map(nat)),
    facadeRing: [] as number[][],
    surfaces,
  };
  out.facadeRing = simplify(out.nativeRing, 0.15);
  // neighbours from the committed z14 bag tiles around the anchor
  const [lng, lat] = out.anchor, n = 2 ** 14, tx = Math.floor((lng + 180) / 360 * n);
  const ty = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  const seen = new Set<string>();
  const near = (r: number[][]) => r.some(p => out.nativeRing.some((q, i) => { const c = out.nativeRing[(i + 1) % out.nativeRing.length], dx = c[0] - q[0], dz = c[1] - q[1], L2 = dx * dx + dz * dz || 1e-9; const u = Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dz) / L2)); return Math.hypot(p[0] - q[0] - u * dx, p[1] - q[1] - u * dz) < 3; }));
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const f = `public/data/extracts/amsterdam/bag-tiles/14/${tx + dx}/${ty + dy}.geojson.gz`;
    if (!fs.existsSync(f)) continue;
    for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features) {
      const pid = String(ft.properties.id);
      if (seen.has(pid) || pid.endsWith(PAND) || ft.properties.tier !== 3) continue;
      seen.add(pid);
      const g = ft.geometry, ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((p: number[]) => { const [x, y] = lngLatToRd(p[0], p[1]); return [r3(x - ax), r3(-(y - ay))]; });
      if (near(ring)) (out as {neighbours?: unknown[]}).neighbours = [...((out as {neighbours?: unknown[]}).neighbours ?? []), {id: pid, height: ft.properties.height, ring}];
    }
  }
  fs.writeFileSync(`scripts/landmarks/${id}-footprints.json`, JSON.stringify(out) + '\n');
  console.log(id, out.anchor, 'ground', ground, 'ring', out.nativeRing.length, 'holes', out.nativeHoles.length, 'facade ring', out.facadeRing.length, 'surfaces', surfaces.length, 'neighbours', (out as {neighbours?: unknown[]}).neighbours?.length ?? 0, Object.entries(surfaces.reduce((m: Record<string, number>, s) => (m[s.type] = (m[s.type] ?? 0) + 1, m), {})));
}
