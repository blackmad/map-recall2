/**
 * Barbizon Palace shell source: BAG outlines (RD) and 3DBAG LoD2.2 attributes and roof surfaces of the six panden on the
 * Prins Hendrikkade front of the NH Collection Barbizon Palace (Prins Hendrikkade 59 and 66-72), in the native landmark
 * frame and in the builder's front frame.
 *
 *   node --import tsx scripts/landmarks/barbizon-palace-prepare.ts
 *
 * BAG rings from the PDOK BAG WFS (CC0); 3DBAG items (CC BY 4.0) cached under .cache/3dbag/. Native frame: x east,
 * z south, y up, metres; anchor = vertex average of the six BAG rings (RD). Front frame (church-kit `local`): x along
 * the Prins Hendrikkade front from the Sint-Nicolaas side (PH 72 / 73 party line) to the west end of the 1988 hotel
 * (PH 59 / 58), z out of the front towards the street, the building at z <= 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

export const PANDS = ['0363100012182721', '0363100012182719', '0363100012182720', '0363100012182718', '0363100012171455', '0363100012165693'];
/** Enclosed 1741 back house between the PH fronts and the Zeedijk panden, hotel use only (VBO 0363010000783023): drawn from
 *  its 3DBAG shell, but kept out of the anchor and the front fit so the frame of the six street panden stays as measured. */
export const ENCLOSED = ['0363100012249789'];
type Item = {feature: {CityObjects: Record<string, {type: string; attributes?: Record<string, unknown>; geometry?: {lod: string | number; boundaries: unknown; semantics?: {surfaces: {type: string}[]; values: number[][]}}[]}>; vertices: number[][]}; metadata: {transform: {scale: number[]; translate: number[]}}};

async function cached(file: string, url: string) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(url);
  if (!r.ok) throw Error(`${url}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j;
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Pavement datum on the Prins Hendrikkade (3DBAG maaiveld of the five historic fronts, 2.28-2.32 NAP). The 1988 pand's own
 *  maaiveld (0.19 NAP) is sampled in its sunken service yard, so every pand's heights are taken from this street datum. */
const STREET_NAP = 2.29;

const bagUrl = (p: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;

const rings: Record<string, number[][]> = {}, years: Record<string, number> = {};
const items: Record<string, Item> = {};
for (const p of [...PANDS, ...ENCLOSED]) {
  const g = await cached(path.join('.cache', 'bag-wfs', `${p}.json`), bagUrl(p));
  const f = g.features[0];
  rings[p] = f.geometry.coordinates[0].slice(0, -1);
  years[p] = Number(f.properties.bouwjaar);
  items[p] = await cached(path.join('.cache', '3dbag', `${p}.json`), `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p}`);
}
const all = PANDS.flatMap(p => rings[p]);
const ax = all.reduce((s, q) => s + q[0], 0) / all.length, ay = all.reduce((s, q) => s + q[1], 0) / all.length;
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
const N = (q: number[]) => [q[0] - ax, -(q[1] - ay)];

// Front line: the street edges of the five historic fronts and the 1988 front (BAG), fitted as one line. The edges are
// the ring segments whose outward normal points to the street (bearing 325-345) and that lie on the Prins Hendrikkade.
const frontPts: number[][] = [];
for (const p of PANDS) {
  const r = rings[p];
  const area = r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0); // > 0: counter-clockwise
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 2) continue;
    // outward normal: (dy, -dx) on a counter-clockwise ring, (-dy, dx) on a clockwise one (x east, y north)
    const s = area > 0 ? 1 : -1, nb = (Math.atan2(s * dy, -s * dx) * 180 / Math.PI + 360) % 360;
    if (nb > 320 && nb < 350) frontPts.push(a, b);
  }
}
// orientation: bearing of the along-front axis (viewer's right facing the front), 244.4 on the strip frame
const AX_B = 244.4 * Math.PI / 180, u = [Math.sin(AX_B), Math.cos(AX_B)], n = [u[1], -u[0]]; // n: outward, bearing 334.4
const along = (q: number[]) => (q[0] - ax) * u[0] + (q[1] - ay) * u[1], out = (q: number[]) => (q[0] - ax) * n[0] + (q[1] - ay) * n[1];
const outMed = frontPts.map(out).sort((a, b) => a - b)[Math.floor(frontPts.length / 2)];
// x = 0 at the PH 72 / 73 party corner: the most-negative along value of pand 182721's front
const x0 = Math.min(...rings['0363100012182721'].filter(q => Math.abs(out(q) - outMed) < 1.2).map(along));
const toFront = (q: number[]) => [r3(along(q) - x0), r3(out(q) - outMed)];
// church-kit local(): native = rotateY(th)(local) + origin; local +x has native bearing 90 - th
const th = 90 - 244.4;
const originRD = [ax + u[0] * x0 + n[0] * outMed, ay + u[1] * x0 + n[1] * outMed];

const pands: Record<string, unknown> = {};
for (const p of [...PANDS, ...ENCLOSED]) {
  const it = items[p], t = it.metadata.transform, verts = it.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
  let at: Record<string, unknown> = {};
  const roofs: number[][][] = [], shellOut: {type: string; rings: number[][][]}[] = [];
  for (const o of Object.values(it.feature.CityObjects)) {
    if (o.type === 'Building') at = o.attributes ?? {};
    for (const g of o.geometry ?? []) {
      if (String(g.lod) !== '2.2' || !g.semantics) continue;
      (g.boundaries as number[][][][]).forEach((shell, si) => shell.forEach((surface, j) => {
        const type = g.semantics!.surfaces[g.semantics!.values[si][j]]?.type ?? 'WallSurface';
        if (type !== 'GroundSurface') shellOut.push({type, rings: surface.map(r => r.map(i => { const v = verts[i]; return [r3(v[0] - ax), r3(Math.max(0, v[2] - STREET_NAP)), r3(-(v[1] - ay))]; }))});
        if (type !== 'RoofSurface') return;
        roofs.push(surface[0].map(i => verts[i]));
      }));
    }
  }
  const ground = STREET_NAP, ownGround = Number(at.b3_h_maaiveld);
  pands[p] = {
    bagYear: years[p],
    ringRD: rings[p].map(q => q.map(r3)),
    ringNative: rings[p].map(q => N(q).map(r3)),
    ringFront: rings[p].map(toFront),
    groundNAP: ownGround, datumNAP: STREET_NAP,
    roofMaxM: r3(Number(at.b3_h_dak_max) - ground), roof70M: r3(Number(at.b3_h_dak_70p) - ground), roofMinM: r3(Number(at.b3_h_dak_min) - ground),
    ridgeM: at.b3_h_nok != null ? r3(Number(at.b3_h_nok) - ground) : null,
    shellNative: p === '0363100012165693' || ENCLOSED.includes(p) ? shellOut : undefined,
    enclosed: ENCLOSED.includes(p) || undefined,
    roofsFront: roofs.map(r => r.map(v => { const f = toFront(v); return [f[0], r3(v[2] - ground), f[1]]; })),
  };
  console.log(p.slice(-6), years[p], 'ground', ground, 'max', (pands[p] as {roofMaxM: number}).roofMaxM, '70p', (pands[p] as {roof70M: number}).roof70M, 'roofs', roofs.length);
}
const json = {
  id: 'barbizon-palace',
  address: 'Prins Hendrikkade 59 (hotel, pand 0363100012165693, 1988) and the historic fronts Prins Hendrikkade 66 (0363100012171455), 67 (0363100012182718), 68 (0363100012182720), 69 (0363100012182719) and 72 (0363100012182721), 1012AD Amsterdam',
  sources: [
    {what: 'BAG pand rings', url: 'https://service.pdok.nl/lv/bag/wfs/v2_0 (typeName bag:pand, srsName EPSG:28992)', retrieved: '2026-11-01', licence: 'CC0'},
    {what: '3DBAG LoD2.2 roof surfaces and height attributes', url: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<pand>', retrieved: '2026-11-01', licence: 'CC BY 4.0'},
    {what: 'Hotel VBO Prins Hendrikkade 59 (logiesfunctie, 14,502 m2) and the fourteen panden it lies in', url: 'https://api.data.amsterdam.nl/v1/bag/verblijfsobjecten/0363010000783023/', retrieved: '2026-11-01', licence: 'CC0'},
  ],
  frame: 'Front frame: x along the BAG Prins Hendrikkade front (bearing 244.4, the rectified strip axis) from the PH 72 / 73 party corner, z out of the front (bearing 334.4), y up from the pavement (3DBAG maaiveld per pand). church-kit local(th, origin) with th = 90 - 244.4; origin = the front frame origin in native metres. Native: metres east/south of the anchor (RD).',
  anchorRD: [r3(ax), r3(ay)], anchor,
  axisDeg: r3(th), origin: N(originRD).map(r3),
  frontFacingBearing: 334.4,
  pands,
};
fs.writeFileSync('scripts/landmarks/barbizon-palace-footprints.json', JSON.stringify(json, null, 1));
console.log('anchor', anchor, 'origin', json.origin, 'axisDeg', json.axisDeg, 'front points', frontPts.length);
