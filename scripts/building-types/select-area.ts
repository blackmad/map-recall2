/**
 * Pick a pilot area and stage its inputs: the BAG footprints and 3DBAG attributes of N members of each type
 * (nearest to the area centre), the OSM highways around them, and neighbouring buildings for context renders.
 *
 *   node --import tsx scripts/building-types/select-area.ts --nw=<survey dir with clusters.json, raw/, 3dbag/> \
 *     --area=slotermeer-north --lng=4.809 --lat=52.3775 --t1=14 --t6=12
 *
 * Writes staging/building-types/<area>/instances.json (+ context.json). The survey (scratchpad nieuw-west/) was
 * made by the clustering session: raw/bag-panden.json (PDOK BAG, WGS84 rings), 3dbag/all.jsonl (b3_* attributes).
 */
import fs from 'node:fs';
import path from 'node:path';
import {lngLatToLocal, minimumRotatedRectangle, rectIoU, type Anchor, type Pt} from '../../src/canalRecall/buildingTypes/geometry.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const nw = arg('nw'), area = arg('area', 'slotermeer-north');
const anchor: Anchor = {lng: Number(arg('lng', '4.809')), lat: Number(arg('lat', '52.3775'))};
const want: Record<string, number> = {'nw-portiek-brick-pitched': Number(arg('t1', '14')), 'nw-pilotis-panel-flat': Number(arg('t6', '12'))};
const RADIUS_M = Number(arg('radius', '700')), CONTEXT_M = 500;
if (!nw) throw new Error('--nw=<survey dir> required');

const clusters = JSON.parse(fs.readFileSync(path.join(nw, 'clusters.json'), 'utf8'));
const members: Record<string, any[]> = {'nw-portiek-brick-pitched': clusters.pp_big[0].pandIds, 'nw-pilotis-panel-flat': clusters.pp_big[5].pandIds};
const attrs = new Map<string, any>();
for (const l of fs.readFileSync(path.join(nw, '3dbag/all.jsonl'), 'utf8').split('\n')) if (l) { const r = JSON.parse(l); attrs.set(r.id, r); }
const bag = JSON.parse(fs.readFileSync(path.join(nw, 'raw/bag-panden.json'), 'utf8')) as any[];
const ringOf = (f: any): [number, number][] => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]);
const byId = new Map<string, any>();
for (const f of bag) byId.set(f.properties.identificatie, f);

const round1 = (p: Pt): Pt => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
const instances: any[] = [];
for (const [type, list] of Object.entries(members)) {
  const ranked = list.map(m => ({m, d: Math.hypot(...lngLatToLocal(anchor, m.lon, m.lat))})).filter(x => x.d < RADIUS_M).sort((a, b) => a.d - b.d).slice(0, want[type]);
  for (const {m, d} of ranked) {
    const f = byId.get(m.id), a = attrs.get(m.id);
    if (!f || !a || a.miss) { console.warn('skip (no BAG/3DBAG record)', m.id); continue; }
    const ring = ringOf(f).map(([lng, lat]) => lngLatToLocal(anchor, lng, lat));
    const rect = minimumRotatedRectangle(ring);
    instances.push({
      pandId: m.id, type, bouwjaar: m.bj, distFromCentreM: Math.round(d), centreLngLat: [m.lon, m.lat],
      ringLngLat: ringOf(f).map(([lng, lat]) => [Math.round(lng * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7]),
      rectIoU: Math.round(rectIoU(ring, rect) * 1000) / 1000, nVertices: ring.length - 1,
      attrs: {b3_bouwlagen: a.b3_bouwlagen, b3_dak_type: a.b3_dak_type, b3_h_dak_max: a.b3_h_dak_max, b3_h_dak_50p: a.b3_h_dak_50p, b3_h_dak_min: a.b3_h_dak_min, b3_h_maaiveld: a.b3_h_maaiveld, b3_h_nok: a.b3_h_nok},
    });
  }
}

// Highways within reach of the area (local metres, rounded to 10 cm).
const routing = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[];
const streets = routing.flatMap(s => (s.paths ?? [s.path]).map((p: [number, number][]) => ({name: s.name || '', highway: s.highway as string, path: p.map(([lat, lng]) => round1(lngLatToLocal(anchor, lng, lat)))})))
  .filter(s => s.path.some(p => Math.hypot(p[0], p[1]) < RADIUS_M + 150));

// Context: every other BAG pand near the instances (for the aerial render).
const ids = new Set(instances.map(i => i.pandId)), context: any[] = [];
for (const f of bag) {
  if (f.properties.status !== 'Pand in gebruik' || ids.has(f.properties.identificatie)) continue;
  const ring = ringOf(f).map(([lng, lat]) => lngLatToLocal(anchor, lng, lat));
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  if (Math.hypot(cx, cz) > CONTEXT_M + 150) continue;
  const a = attrs.get(f.properties.identificatie);
  context.push({id: f.properties.identificatie, heightM: a && !a.miss && a.b3_h_dak_max != null ? Math.round((a.b3_h_dak_max - (a.b3_h_maaiveld ?? 0)) * 10) / 10 : 7, ring: ring.map(round1)});
}

const out = path.join('staging/building-types', area);
fs.mkdirSync(out, {recursive: true});
const names = new Map<string, number>();
for (const s of streets) if (s.name && s.path.some(p => Math.hypot(p[0], p[1]) < 400)) names.set(s.name, (names.get(s.name) ?? 0) + 1);
fs.writeFileSync(path.join(out, 'instances.json'), JSON.stringify({area, anchor, source: 'Amsterdam BAG (PDOK) rings + 3DBAG b3_* attributes via the Nieuw-West survey; OSM highways from public/data/extracts/amsterdam/streets-routing.json', instances, streets}) + '\n');
fs.writeFileSync(path.join(out, 'context.json'), JSON.stringify({area, anchor, buildings: context}) + '\n');
console.log(`${instances.length} instances (${Object.entries(want).map(([t]) => `${t}: ${instances.filter(i => i.type === t).length}`).join(', ')}), ${streets.length} highway paths, ${context.length} context buildings`);
console.log('streets within 400 m:', [...names.keys()].sort().join(', '));
