/**
 * Kiosk footprint (#180): writes scripts/landmarks/<id>-footprints.json for a small freestanding kiosk from the first
 * source that exists, in the brief's order:
 *
 *   --pand=<16-digit BAG pand id>        BAG pand from the building tiles (public/data/extracts/amsterdam/bag-tiles/14)
 *   --osm=<w123>                         OSM building way from the same tiles (tier 4) when BAG has no pand
 *   --standplaats=<16-digit id>          BAG standplaats polygon (api.data.amsterdam.nl/v1/bag/standplaatsen, CC0)
 *   --point=<lat,lng> --size=<w>x<d> --front=<bearing>   measured from panoramas/orthophoto (no registered outline)
 *
 * The anchor is the outline's vertex average; `localEastSouthMetres` is the ring in native model metres (x east, z south);
 * `rect` is the minimum-area rectangle (centre, width along the front, depth, `frontBearing` = outward bearing of the
 * long side named by --front-near=<bearing>, default: the long side nearest that bearing or the first long side).
 *
 *   node --import tsx scripts/landmarks/kiosk-footprint.ts --id=kiosk-dr-falafel --pand=0363100012243757 --front-near=286
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {minimumRectangle, type Pt} from '../../src/canalRecall/kiosks/kioskKit.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const id = arg('id');
if (!id) throw Error('--id=<kiosk id> required');
const ROOT = path.resolve(import.meta.dirname, '../..');
const tileOf = (lng: number, lat: number) => {
  const n = 2 ** 14, r = lat * Math.PI / 180;
  return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)];
};

type Source = {kind: 'bag-pand' | 'osm-way' | 'bag-standplaats' | 'measured'; id: string; url: string; licence: string; properties?: Record<string, unknown>};
let ring: [number, number][] = [];
let source: Source;

async function fromTiles(featureId: string, near: [number, number]) {
  const [tx, ty] = tileOf(near[1], near[0]);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const f = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14', String(tx + dx), `${ty + dy}.geojson.gz`);
    if (!fs.existsSync(f)) continue;
    const g = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8'));
    const hit = g.features.find((x: any) => String(x.properties.id) === featureId);
    if (hit) {
      const geom = hit.geometry, r = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
      return {ring: r as [number, number][], properties: hit.properties};
    }
  }
  throw Error(`${featureId} not in the tiles around ${near}`);
}

const nearArg = arg('near')?.split(',').map(Number) as [number, number] | undefined;
if (arg('pand')) {
  const pid = arg('pand')!;
  if (!nearArg) throw Error('--near=<lat,lng> required with --pand (finds the tile)');
  const t = await fromTiles(`NL.IMBAG.Pand.${pid}`, nearArg);
  ring = t.ring;
  source = {kind: 'bag-pand', id: pid, url: `https://api.data.amsterdam.nl/v1/bag/panden/${pid}/`, licence: 'CC0 (BAG)', properties: t.properties};
} else if (arg('osm')) {
  const w = arg('osm')!;
  if (!nearArg) throw Error('--near=<lat,lng> required with --osm (finds the tile)');
  const t = await fromTiles(w, nearArg);
  ring = t.ring;
  source = {kind: 'osm-way', id: w, url: `https://www.openstreetmap.org/way/${w.slice(1)}`, licence: 'ODbL (OpenStreetMap contributors)', properties: t.properties};
} else if (arg('standplaats')) {
  const sid = arg('standplaats')!;
  const url = `https://api.data.amsterdam.nl/v1/bag/standplaatsen/${sid}/`;
  const cache = path.join(ROOT, '.cache/kiosks', `standplaats-${sid}.json`);
  let body: any;
  if (fs.existsSync(cache)) body = JSON.parse(fs.readFileSync(cache, 'utf8'));
  else {
    const r = await fetch(url);
    if (!r.ok) throw Error(`${r.status} ${url}`);
    body = await r.json();
    fs.mkdirSync(path.dirname(cache), {recursive: true});
    fs.writeFileSync(cache, JSON.stringify(body));
  }
  ring = body.geometrie.coordinates[0].map(([x, y]: number[]) => rdToLngLat({x, y}));
  source = {kind: 'bag-standplaats', id: sid, url, licence: 'CC0 (BAG)', properties: {status: body.statusOmschrijving, gebruiksdoel: body.gebruiksdoel, registratiedatum: body.registratiedatum, documentdatum: body.documentdatum, documentnummer: body.documentnummer}};
} else if (arg('point')) {
  const [lat, lng] = arg('point')!.split(',').map(Number);
  const [w, d] = (arg('size') ?? '').split('x').map(Number);
  const front = Number(arg('front'));
  if (!(w > 0 && d > 0 && Number.isFinite(front))) throw Error('--point needs --size=<w>x<d> and --front=<bearing>');
  const kx = 111320 * Math.cos(lat * Math.PI / 180), b = front * Math.PI / 180;
  // front normal (east, north) and the along-front axis 90 deg clockwise of it seen from above
  const n = [Math.sin(b), Math.cos(b)], a = [Math.cos(b), -Math.sin(b)];
  ring = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([s, t]) => {
    const e = a[0] * s * w / 2 + n[0] * t * d / 2, nn = a[1] * s * w / 2 + n[1] * t * d / 2;
    return [lng + e / kx, lat + nn / 111320] as [number, number];
  });
  source = {kind: 'measured', id: `measured:${lat},${lng}`, url: arg('evidence') ?? '', licence: 'measurement (this repository)'};
} else throw Error('one of --pand, --osm, --standplaats, --point required');

const open = ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
const anchor: [number, number] = [open.reduce((s, p) => s + p[0], 0) / open.length, open.reduce((s, p) => s + p[1], 0) / open.length];
const kx = 111320 * Math.cos(anchor[1] * Math.PI / 180);
const local: Pt[] = open.map(([lng, lat]) => [+((lng - anchor[0]) * kx).toFixed(3), +(-(lat - anchor[1]) * 111320).toFixed(3)]);
const rect = minimumRectangle(local, arg('front-near') ? Number(arg('front-near')) : undefined);
const area = Math.abs(local.reduce((s, p, i) => {const q = local[(i + 1) % local.length]; return s + p[0] * q[1] - q[0] * p[1];}, 0) / 2);
const out = {
  id,
  generatedBy: `node --import tsx scripts/landmarks/kiosk-footprint.ts ${process.argv.slice(2).join(' ')}`,
  source,
  anchor: [+anchor[0].toFixed(7), +anchor[1].toFixed(7)],
  ringLngLat: ring,
  localEastSouthMetres: local,
  areaM2: +area.toFixed(2),
  rect: {centre: rect.centre.map(v => +v.toFixed(3)), widthM: +rect.width.toFixed(3), depthM: +rect.depth.toFixed(3), frontBearing: +rect.frontBearing.toFixed(2)},
};
const file = path.join(ROOT, 'scripts/landmarks', `${id}-footprints.json`);
let prior: Record<string, unknown> = {};
if (fs.existsSync(file)) prior = JSON.parse(fs.readFileSync(file, 'utf8'));
// Hand-written notes in an existing file survive a regeneration.
fs.writeFileSync(file, JSON.stringify({...out, notes: prior.notes ?? []}, null, 1) + '\n');
console.log(file, JSON.stringify(out.rect), 'area', out.areaM2, 'm2', source.kind, source.id);
