/**
 * Garden-room survey (src/canalRecall/gardenRooms.ts, lane #169): which shed pands in the centre box
 * (4.86-4.93 E, 52.35-52.39 N) become garden rooms, per rule, and what their roofs read as, so the rule is
 * measured rather than assumed. Runs the runtime's own default building path (scripts/world/pipeline.ts: years and
 * roof facts enrichers, the game decorator) and the chunk builder's own shed test, with the streets that can carry
 * a front door from the full OSM ground extract (as scripts/check-garden-sheds.ts).
 *
 * Usage: node --import tsx scripts/survey-garden-rooms.ts [--json=out.json] [--spots]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { gameChain, loadTile } from './world/pipeline.ts';
import { SegmentGrid, streetSegments } from '../src/canalRecall/streetFronts.ts';
import { ORIGIN } from '../src/canalRecall/threeBuildingFeatures.ts';
import { isGardenShed, ringAreaM2 } from '../src/canalRecall/gardenSheds.ts';
import { GARDEN_ROOM_FROM_YEAR, GARDEN_ROOM_MIN_AREA_M2, GARDEN_ROOM_ROOF_CONFIDENCE, GARDEN_ROOM_ROOF_SLOTS, gardenRoomDesign, gardenRoomRule } from '../src/canalRecall/gardenRooms.ts';

const BASE = 'public/data/extracts/amsterdam';
const BOX = { w: 4.86, e: 4.93, s: 52.35, n: 52.39 };
const jsonGz = (path: string) => JSON.parse(gunzipSync(readFileSync(path)).toString());
const tx = (lng: number) => Math.floor((lng + 180) / 360 * 2 ** 14);
const ty = (lat: number) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** 14); };

const paths: Array<{ highway?: string; points: Array<[number, number]> }> = [];
for (const file of readdirSync(`${BASE}/own-ground-osm-v1/cells`)) for (const way of jsonGz(`${BASE}/own-ground-osm-v1/cells/${file}`).ways ?? []) paths.push({ highway: way.tags?.highway, points: way.g });
const streets = new SegmentGrid(streetSegments(paths, ORIGIN), 25);

const chain = gameChain();
type Band = 'pre1990' | '1990-2004' | '2005+' | 'no year';
const bandOf = (y: number | null): Band => y === null ? 'no year' : y < 1990 ? 'pre1990' : y < GARDEN_ROOM_FROM_YEAR ? '1990-2004' : '2005+';
const sheds: Record<Band, number> = { 'pre1990': 0, '1990-2004': 0, '2005+': 0, 'no year': 0 };
const slots: Record<Band, Record<string, number>> = { 'pre1990': {}, '1990-2004': {}, '2005+': {}, 'no year': {} };
const small: Record<Band, number> = { 'pre1990': 0, '1990-2004': 0, '2005+': 0, 'no year': 0 };
const strongNew: Record<Band, number> = { 'pre1990': 0, '1990-2004': 0, '2005+': 0, 'no year': 0 };
const brief = { year: 0, roof: 0, sedum: 0 };
const rules = { year: 0, 'roof (pre-1990)': 0, 'roof (1990-2004)': 0, 'roof (no year)': 0 };
let slat = 0, black = 0, accent = 0, horizontal = 0;
const rooms: Array<{ id: string; lng: number; lat: number; rule: string; year: number | null; slot: string | null; areaM2: number; family: string }> = [];
for (let x = tx(BOX.w); x <= tx(BOX.e); x++) for (let y = ty(BOX.n); y <= ty(BOX.s); y++) {
  for (const row of await loadTile(`${x}/${y}`, chain)) {
    const f = row.styled, p = f.properties;
    const ring: number[][] | undefined = f.geometry?.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry?.coordinates?.[0]?.[0];
    if (!ring) continue;
    const lng = ring.reduce((s, q) => s + q[0], 0) / ring.length, lat = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    if (lng < BOX.w || lng > BOX.e || lat < BOX.s || lat > BOX.n) continue;
    if (!isGardenShed(f, streets, ORIGIN)) continue;
    const year = p.constructionYear == null || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
    const band = bandOf(year);
    sheds[band]++;
    const slot = typeof p.roofSlot === 'string' ? p.roofSlot : null, conf = Number(p.roofConfidence);
    const key = slot ? `${slot}${conf >= GARDEN_ROOM_ROOF_CONFIDENCE ? '' : ' (weak)'}` : 'unread';
    slots[band][key] = (slots[band][key] ?? 0) + 1;
    if (slot && GARDEN_ROOM_ROOF_SLOTS.has(slot) && conf >= GARDEN_ROOM_ROOF_CONFIDENCE) strongNew[band]++;
    if (ringAreaM2(ring) < GARDEN_ROOM_MIN_AREA_M2) small[band]++;
    const rule = gardenRoomRule(p, ringAreaM2(ring));
    // The brief's first-draft rule, for the report: any area, sedum counted as a new roof.
    if (band === '2005+') brief.year++;
    else if (slot && (slot === 'sedum' || GARDEN_ROOM_ROOF_SLOTS.has(slot)) && conf >= GARDEN_ROOM_ROOF_CONFIDENCE) { brief.roof++; if (slot === 'sedum') brief.sedum++; }
    if (!rule) continue;
    const label = rule === 'year' ? 'year' : `roof (${band === 'no year' ? 'no year' : band === 'pre1990' ? 'pre-1990' : '1990-2004'})`;
    rules[label as keyof typeof rules]++;
    const d = gardenRoomDesign(String(p.id), year);
    if (d.family === 'slat') { slat++; if (d.horizontal) horizontal++; } else { black++; if (d.accent) accent++; }
    rooms.push({ id: String(p.id), lng, lat, rule: label, year, slot, areaM2: +ringAreaM2(ring).toFixed(1), family: d.family });
  }
}
const total = Object.values(sheds).reduce((a, b) => a + b, 0), roomsN = rooms.length;
console.log(`centre box ${BOX.w}-${BOX.e} E, ${BOX.s}-${BOX.n} N: ${total} garden sheds`);
for (const b of Object.keys(sheds) as Band[]) console.log(`  ${b.padEnd(10)} ${String(sheds[b]).padStart(5)}  under ${GARDEN_ROOM_MIN_AREA_M2} m2 ${small[b]}  new-roof slot (membrane/glass, conf >= ${GARDEN_ROOM_ROOF_CONFIDENCE}): ${strongNew[b]} (${(100 * strongNew[b] / Math.max(1, sheds[b])).toFixed(1)}%)`);
console.log('roof slots per band:');
for (const b of Object.keys(slots) as Band[]) console.log(`  ${b.padEnd(10)} ${Object.entries(slots[b]).sort((a, z) => z[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`garden rooms ${roomsN} (${(100 * roomsN / Math.max(1, total)).toFixed(1)}% of sheds): ${Object.entries(rules).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`brief's draft rule (any area, sedum counts): year ${brief.year}, roof ${brief.roof} (of which sedum ${brief.sedum}) = ${brief.year + brief.roof}`);
console.log(`design: slat ${slat} (horizontal ${horizontal}), black ${black} (ochre accent wall ${accent})`);
const json = process.argv.find(a => a.startsWith('--json='))?.slice(7);
if (json) writeFileSync(json, JSON.stringify({ box: BOX, brief, small, sheds, slots, strongNew, rules, rooms }, null, 1));
