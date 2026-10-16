/**
 * Stage named panden as a building-type area straight from 3DBAG (no Nieuw-West survey directory needed): the LoD0
 * footprint and b3_* attributes of each listed pand, the OSM highways around them and the 3DBAG neighbours for the
 * aerial context. Writes the same instances.json / context.json that select-area.ts writes, so build.ts and
 * camera-sheets.ts run unchanged.
 *
 *   node --import tsx scripts/building-types/stage-panden.ts --area=sloterplas-towers --type=nw-slab-tower-15st \
 *     --ids=0363100012063809,0363100012095578,0363100012151987 [--context=450]
 *
 * 3DBAG items are cached under .cache/building-types/3dbag/ (the file build.ts reads), bbox pages under
 * .cache/building-types/3dbag-bbox/<area>/.
 */
import fs from 'node:fs';
import path from 'node:path';
import {lngLatToLocal, minimumRotatedRectangle, rectIoU, type Anchor, type Pt} from '../../src/canalRecall/buildingTypes/geometry.ts';
import type {CityJsonItem} from '../../src/canalRecall/buildingTypes/facts.ts';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const area = arg('area'), type = arg('type'), ids = arg('ids').split(',').filter(Boolean), CONTEXT_M = Number(arg('context', '450'));
if (!area || !type || !ids.length) throw new Error('--area, --type and --ids required');

async function cachedJson(url: string, file: string): Promise<any> {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(90000)});
      if (!r.ok) throw new Error(String(r.status));
      const text = await r.text();
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text);
      return JSON.parse(text);
    } catch (e) { if (attempt >= 3) throw new Error(`${url}: ${(e as Error).message}`); await new Promise(res => setTimeout(res, 1500 * (attempt + 1))); }
  }
}

type Feature = {CityObjects: CityJsonItem['feature']['CityObjects']; vertices: number[][]};
/** LoD0 outer ring (RD) and the building's attributes of one CityJSON feature. */
function footprint(feature: Feature, transform: {scale: number[]; translate: number[]}): {id: string; ringRd: [number, number][]; attrs: Record<string, any>} | null {
  for (const [id, o] of Object.entries(feature.CityObjects)) {
    if (o.type !== 'Building') continue;
    const g = (o.geometry ?? []).find(g => String(g.lod) === '0');
    if (!g) return null;
    const ring = (g.boundaries as number[][][])[0][0].map(k => [feature.vertices[k][0] * transform.scale[0] + transform.translate[0], feature.vertices[k][1] * transform.scale[1] + transform.translate[1]] as [number, number]);
    return {id: id.replace('NL.IMBAG.Pand.', ''), ringRd: ring, attrs: o.attributes ?? {}};
  }
  return null;
}
const ATTRS = ['b3_bouwlagen', 'b3_dak_type', 'b3_h_dak_max', 'b3_h_dak_50p', 'b3_h_dak_min', 'b3_h_maaiveld', 'b3_h_nok', 'b3_h_dak_70p', 'oorspronkelijkbouwjaar'];

const fps = [];
for (const id of ids) {
  const item = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${id}`, `.cache/building-types/3dbag/${id}.json`) as CityJsonItem;
  const fp = footprint(item.feature, item.metadata.transform);
  if (!fp) throw new Error(`${id}: no LoD0 footprint`);
  fps.push(fp);
}
const ll = fps.map(f => f.ringRd.map(([x, y]) => rdToLngLat(x, y)));
const all = ll.flat();
const anchor: Anchor = arg('lng') ? {lng: Number(arg('lng')), lat: Number(arg('lat'))} : {lng: +(all.reduce((s, p) => s + p[0], 0) / all.length).toFixed(5), lat: +(all.reduce((s, p) => s + p[1], 0) / all.length).toFixed(5)};
const round1 = (p: Pt): Pt => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
const r7 = (v: number) => Math.round(v * 1e7) / 1e7;
const instances = fps.map((f, k) => {
  const ring = ll[k].map(([lng, lat]) => lngLatToLocal(anchor, lng, lat)), rect = minimumRotatedRectangle(ring);
  const c = ll[k].slice(0, -1).reduce((s, p) => [s[0] + p[0] / (ll[k].length - 1), s[1] + p[1] / (ll[k].length - 1)], [0, 0]);
  return {pandId: f.id, type, bouwjaar: f.attrs.oorspronkelijkbouwjaar, distFromCentreM: Math.round(Math.hypot(...lngLatToLocal(anchor, c[0], c[1]))), centreLngLat: [r7(c[0]), r7(c[1])],
    ringLngLat: ll[k].map(([lng, lat]) => [r7(lng), r7(lat)]), rectIoU: Math.round(rectIoU(ring, rect) * 1000) / 1000, nVertices: ring.length - 1,
    attrs: Object.fromEntries(ATTRS.map(a => [a, f.attrs[a] ?? null]))};
});

const routing = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[];
const streets = routing.flatMap(s => (s.paths ?? [s.path]).map((p: [number, number][]) => ({name: s.name || '', highway: s.highway as string, path: p.map(([lat, lng]) => round1(lngLatToLocal(anchor, lng, lat)))})))
  .filter(s => s.path.some((p: Pt) => Math.hypot(p[0], p[1]) < CONTEXT_M + 150));

// Context: 3DBAG neighbours within CONTEXT_M of the anchor (paged bbox query), heights above their own ground.
const [ax, ay] = (await import('../../src/canalRecall/rdCoordinates.ts')).lngLatToRd(anchor.lng, anchor.lat);
const bbox = [ax - CONTEXT_M, ay - CONTEXT_M, ax + CONTEXT_M, ay + CONTEXT_M].map(v => Math.round(v)).join(',');
const context: any[] = [], own = new Set(ids);
let url: string | null = `https://api.3dbag.nl/collections/pand/items?bbox=${bbox}&limit=100`;
for (let page = 0; url && page < 80; page++) {
  const d = await cachedJson(url, `.cache/building-types/3dbag-bbox/${area}/${page}.json`);
  for (const feature of d.features ?? []) {
    const fp = footprint(feature, d.metadata.transform);
    if (!fp || own.has(fp.id)) continue;
    const h = fp.attrs.b3_h_dak_max != null && fp.attrs.b3_h_maaiveld != null ? fp.attrs.b3_h_dak_max - fp.attrs.b3_h_maaiveld : 7;
    context.push({id: fp.id, heightM: Math.round(h * 10) / 10, ring: fp.ringRd.map(([x, y]) => round1(lngLatToLocal(anchor, ...rdToLngLat(x, y))))});
  }
  url = (d.links ?? []).find((l: any) => l.rel === 'next')?.href ?? null;
}

const out = path.join('staging/building-types', area);
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'instances.json'), JSON.stringify({area, anchor, source: '3DBAG v2 LoD0 footprints + b3_* attributes (api.3dbag.nl, CC BY 4.0); OSM highways from public/data/extracts/amsterdam/streets-routing.json', instances, streets}) + '\n');
fs.writeFileSync(path.join(out, 'context.json'), JSON.stringify({area, anchor, buildings: context}) + '\n');
console.log(`${instances.length} instances, ${streets.length} highway paths, ${context.length} context buildings; anchor`, anchor);
for (const i of instances) console.log(i.pandId, 'IoU', i.rectIoU, 'verts', i.nVertices, JSON.stringify(i.attrs));
