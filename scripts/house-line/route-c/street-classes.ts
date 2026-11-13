/**
 * Writes src/canalRecall/houseSpec/street-classes.json: the named streets the street-template ranking treats as MAIN
 * (streetClass.ts). A street is main when any one of these holds:
 *   osm   any of its named ways (routing extract) is trunk, primary, secondary or tertiary (or a _link) or a busway; or its
 *         unclassified ways outnumber its residential and living_street ways (Haarlemmerdijk; Nicolaas Witsenstraat, 1 to 1,
 *         stays side); or half or more of its ways are pedestrian (Kalverstraat);
 *   tram  tram track runs along it: OSM railway=tram (rail-v1, kind `tram`) or a GVB tram shape (transit-network.json) within
 *         about 10 m of TRAM_MIN_M (60 m) and TRAM_MIN_SHARE (30 %) of its length, so a crossing never counts (Leidsestraat);
 *   ride  it ranks high for rides: the mean ride passes along it (ride-visibility.ts, 300 routes, seed 7, the 5 m samples
 *         within about 5 m) is at least RIDE_MIN_PASSES (5: about the top 2 % of the named streets of 100 m or more, P98 5.3),
 *         whatever its highway tag (Vijzelstraat, 18 passes; neither OSM nor GVB has tram track along it).
 * Every other named street is a side street.
 *
 *   node --max-old-space-size=8192 --import tsx scripts/house-line/route-c/street-classes.ts [--write]
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { lngLatToRd } from '../../../src/canalRecall/facade/rdNew.ts';
import { decodeRail } from '../../../src/canalRecall/ownGround/railTracks.ts';
import { fromLocal } from '../../../src/canalRecall/ownGround/groundStore.ts';
import { sampleRoutes } from '../../building-recipes/ride-visibility.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
export const TRAM_MIN_M = 60, TRAM_MIN_SHARE = 0.3, RIDE_MIN_PASSES = 5;
const MAIN = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'busway']);
const SKIP = new Set(['cycleway', 'footway', 'path', 'service', 'motorway', 'motorway_link', 'trunk_link']);
const rd = (lng: number, lat: number) => { const r = lngLatToRd([lng, lat]) as unknown as { x: number; y: number }; return [r.x, r.y] as const; };

// Tram track: a 10 m grid of points along every OSM tram way and GVB tram shape (RD metres).
const C = 10, tram = new Set<string>();
const addLine = (pts: (readonly [number, number])[]) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 0; s <= L; s += 3) { const t = L ? s / L : 0; tram.add(`${Math.floor((x0 + (x1 - x0) * t) / C)},${Math.floor((y0 + (y1 - y0) * t) / C)}`); }
  }
};
for (const key of JSON.parse(fs.readFileSync(`${EXTRACT}/rail-v1/cells.json`, 'utf8')).cells as string[]) {
  const cell = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${EXTRACT}/rail-v1/cells/${key}.json.gz`)).toString());
  for (const w of decodeRail(cell)) if (w.kind === 'tram') addLine(w.points.map(p => { const [lng, lat] = fromLocal(p[0], p[1]); return rd(lng, lat); }));
}
for (const l of JSON.parse(fs.readFileSync(`${EXTRACT}/transit-network.json`, 'utf8')).lines as { mode: string; path: [number, number][] }[])
  if (l.mode === 'tram') addLine(l.path.map(([lat, lng]) => rd(lng, lat)));
const nearTram = (x: number, y: number) => { const gx = Math.floor(x / C), gy = Math.floor(y / C); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (tram.has(`${gx + i},${gy + j}`)) return true; return false; };

// Ride passes on a 5 m grid.
const ride = new Map<string, number>();
for (const s of sampleRoutes(300, 7).samples) ride.set(`${Math.round(s.x / 5)},${Math.round(s.y / 5)}`, s.passes);
const passesAt = (x: number, y: number) => { let b = 0; const gx = Math.round(x / 5), gy = Math.round(y / 5); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) b = Math.max(b, ride.get(`${gx + i},${gy + j}`) ?? 0); return b; };

const ways = JSON.parse(fs.readFileSync(`${EXTRACT}/streets-routing.json`, 'utf8')) as { name: string; highway: string; path: [number, number][] }[];
const by = new Map<string, { hw: Map<string, number>; len: number; tramM: number; passM: number }>();
for (const w of ways) {
  if (!w.name) continue;
  const e = by.get(w.name) ?? { hw: new Map(), len: 0, tramM: 0, passM: 0 };
  e.hw.set(w.highway, (e.hw.get(w.highway) ?? 0) + 1);
  if (!SKIP.has(w.highway)) for (let i = 0; i + 1 < w.path.length; i++) {
    const [x0, y0] = rd(w.path[i][1], w.path[i][0]), [x1, y1] = rd(w.path[i + 1][1], w.path[i + 1][0]), L = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 2.5; s < L; s += 5) { const t = s / L, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; e.len += 5; if (nearTram(x, y)) e.tramM += 5; e.passM += 5 * passesAt(x, y); }
  }
  by.set(w.name, e);
}
const main: string[] = [], why: Record<string, string[]> = {};
for (const [name, e] of by) {
  const m = e.hw, n = [...m.values()].reduce((a, b) => a + b, 0), r: string[] = [];
  if ([...m.keys()].some(h => MAIN.has(h)) || (m.get('unclassified') ?? 0) > (m.get('residential') ?? 0) + (m.get('living_street') ?? 0) || (m.get('pedestrian') ?? 0) * 2 >= n) r.push('osm');
  if (e.tramM >= TRAM_MIN_M && e.tramM >= TRAM_MIN_SHARE * e.len) r.push('tram');
  if (e.len && e.passM / e.len >= RIDE_MIN_PASSES) r.push('ride');
  if (r.length) { main.push(name); why[name] = r; }
}
main.sort();
const count = (k: string) => main.filter(n => why[n].includes(k)).length, only = (k: string) => main.filter(n => why[n].length === 1 && why[n][0] === k).length;
const out = { v: 2, generated: 'scripts/house-line/route-c/street-classes.ts', rule: { tramMinM: TRAM_MIN_M, tramMinShare: TRAM_MIN_SHARE, rideMinPasses: RIDE_MIN_PASSES, rideRoutes: 300, rideSeed: 7 }, named: by.size, main, why };
console.log(JSON.stringify({ named: by.size, main: main.length, osm: count('osm'), tram: count('tram'), ride: count('ride'), tramOnly: only('tram'), rideOnly: only('ride') }));
for (const n of ['Vijzelstraat', 'Leidsestraat', 'Weteringschans', 'Den Texstraat', 'Nicolaas Witsenstraat', 'Prinsengracht', 'Kerkstraat', 'Nieuwe Spiegelstraat', 'Spiegelgracht', 'Vijzelgracht']) console.log(n, why[n] ?? 'side');
if (process.argv.includes('--write')) fs.writeFileSync('src/canalRecall/houseSpec/street-classes.json', JSON.stringify(out) + '\n');
