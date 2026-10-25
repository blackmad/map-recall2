/**
 * Stage the classified terraces of one coverage buurt (survey-buurt.ts + survey-terraces.ts --area-bbox) as building-type areas,
 * straight from the cached PDOK 3D Basisvoorziening blades (pdok-items.ts; no api.3dbag.nl round trips).
 *
 *   node --import tsx scripts/building-types/stage-buurt.ts --slug=gein-3 --classes=staging/building-types/gein-3-survey/classes.json --prefix=zo-g3
 *
 * classes.json: {"terraces": {"<terrace index>": {"type", "variant", "via": "photo" | "signature", "flip"?, "repMirror"?, "note"?}}, "pands"?: {"<pand id>": {"variant"?, "hold"?,
 * "note"}}}: the per-pand entries correct single houses after the build review. `flip: true` takes the terrace's panorama from
 * terraces-r0/terraces-flip.json (survey-terraces.ts --only --flip: the survey shot the garden side, the re-shot looks at the front).
 * `repMirror` is the photographed representative's handedness (alternateMirror designs): build.ts fixes its row's parity with it. Terraces not listed stay
 * generic. Terraces are grouped into ~0.45 x 0.45 km cells; each cell becomes staging/building-types/<prefix>-NN/ with the files
 * stage-panden.ts writes (instances.json, context.json) plus variants.json (design, variant, photo/signature note, front bearing of the
 * photographed side). Writes <survey>/staged.json: per area and design, the pands staged.
 */
import fs from 'node:fs';
import path from 'node:path';
import {cacheItems, blade} from './pdok-items.ts';
import {lngLatToLocal, minimumRotatedRectangle, rectIoU, type Anchor, type Pt} from '../../src/canalRecall/buildingTypes/geometry.ts';
import {bladeFor} from '../../src/canalRecall/buildingRecipe/pdokLod2.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const slug = arg('slug'), survey = `staging/building-types/${slug}-survey`, prefix = arg('prefix', `zo-${slug}`);
const classesFile = JSON.parse(fs.readFileSync(arg('classes', path.join(survey, 'classes.json')), 'utf8'));
const classes = classesFile.terraces as Record<string, {type: string; variant: string; via: string; flip?: boolean; repMirror?: boolean; note?: string}>;
// per-pand corrections on top of the terrace class (a survey terrace that joins two rows of different eaves, a house held after review)
const pandOverrides = (classesFile.pands ?? {}) as Record<string, {variant?: string; hold?: string; note: string}>;
const terraces = JSON.parse(fs.readFileSync(path.join(survey, 'terraces-r0/terraces.json'), 'utf8')).terraces as any[];
// re-shot terraces (flip): the front panorama replaces the garden-side one where classes.json says so
const flipFile = path.join(survey, 'terraces-r0/terraces-flip.json');
const flipped = new Map<number, any>(fs.existsSync(flipFile) ? (JSON.parse(fs.readFileSync(flipFile, 'utf8')).terraces as any[]).filter(Boolean).map(t => [t.terrace, t]) : []);
for (const [k, t] of terraces.entries()) {
  if (!classes[String(t.terrace)]?.flip) continue;
  const f = flipped.get(t.terrace);
  if (!f?.shot) throw new Error(`terrace ${t.terrace}: flip asked but no re-shot panorama in ${flipFile}`);
  terraces[k] = {...t, shot: f.shot, reShot: true};
}
const pands = new Map((JSON.parse(fs.readFileSync(path.join(survey, 'pands.json'), 'utf8')).pands as any[]).map(p => [p.id, p]));
const CELL_LNG = Number(arg('cell-lng', '0.0066')), CELL_LAT = Number(arg('cell-lat', '0.004')), CONTEXT_M = Number(arg('context', '400'));
const ATTRS = ['b3_bouwlagen', 'b3_dak_type', 'b3_h_dak_max', 'b3_h_dak_50p', 'b3_h_dak_min', 'b3_h_maaiveld', 'b3_h_nok', 'b3_h_dak_70p', 'oorspronkelijkbouwjaar'];

type Fp = {id: string; ringRd: [number, number][]; attrs: Record<string, any>};
function footprint(feature: any, transform: {scale: number[]; translate: number[]}): Fp | null {
  for (const [id, o] of Object.entries(feature.CityObjects) as [string, any][]) {
    if (o.type !== 'Building') continue;
    const g = (o.geometry ?? []).find((g: any) => String(g.lod) === '0');
    if (!g) return null;
    const ring = (g.boundaries as number[][][])[0][0].map(k => [feature.vertices[k][0] * transform.scale[0] + transform.translate[0], feature.vertices[k][1] * transform.scale[1] + transform.translate[1]] as [number, number]);
    return {id: id.replace('NL.IMBAG.Pand.', ''), ringRd: [...ring, ring[0]], attrs: o.attributes ?? {}};
  }
  return null;
}

const cells = new Map<string, {terrace: any; cls: any}[]>();
for (const t of terraces) {
  const cls = classes[String(t.terrace)];
  if (!cls) continue;
  const key = `${Math.floor(t.centreLngLat[0] / CELL_LNG)},${Math.floor(t.centreLngLat[1] / CELL_LAT)}`;
  (cells.get(key) ?? cells.set(key, []).get(key)!).push({terrace: t, cls});
}
const ordered = [...cells.entries()].sort(([a], [b]) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return ay - by || ax - bx; });
const routing = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[];
const round1 = (p: Pt): Pt => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
const r7 = (v: number) => Math.round(v * 1e7) / 1e7;
const summary: any[] = [];
for (const [idx, [, list]] of ordered.entries()) {
  const area = `${prefix}-${String(idx + 1).padStart(2, '0')}`, dir = path.join('staging/building-types', area);
  const members = list.flatMap(({terrace, cls}) => terrace.members.map((m: any) => ({id: m.id as string, terrace, cls})));
  const missing = await cacheItems(members.map(m => ({id: m.id, lngLat: pands.get(m.id).lngLat})));
  const fps: {fp: Fp; m: typeof members[number]}[] = [];
  for (const m of members) {
    if (missing.includes(m.id)) { console.warn(area, m.id, 'not in the PDOK blades: stays generic'); continue; }
    const item = JSON.parse(fs.readFileSync(`.cache/building-types/3dbag/${m.id}.json`, 'utf8'));
    const fp = footprint(item.feature, item.metadata.transform);
    if (fp) fps.push({fp, m}); else console.warn(area, m.id, 'no LoD0 footprint: stays generic');
  }
  const ll = fps.map(({fp}) => fp.ringRd.map(([x, y]) => rdToLngLat(x, y)));
  const all = ll.flat();
  const anchor: Anchor = {lng: +(all.reduce((s, p) => s + p[0], 0) / all.length).toFixed(5), lat: +(all.reduce((s, p) => s + p[1], 0) / all.length).toFixed(5)};
  const instances = fps.map(({fp, m}, k) => {
    const ring = ll[k].map(([lng, lat]) => lngLatToLocal(anchor, lng, lat)), rect = minimumRotatedRectangle(ring);
    const c = ll[k].slice(0, -1).reduce((s, p) => [s[0] + p[0] / (ll[k].length - 1), s[1] + p[1] / (ll[k].length - 1)], [0, 0]);
    return {pandId: fp.id, type: m.cls.type, bouwjaar: fp.attrs.oorspronkelijkbouwjaar, distFromCentreM: Math.round(Math.hypot(...lngLatToLocal(anchor, c[0], c[1]))), centreLngLat: [r7(c[0]), r7(c[1])],
      ringLngLat: ll[k].map(([lng, lat]) => [r7(lng), r7(lat)]), rectIoU: Math.round(rectIoU(ring, rect) * 1000) / 1000, nVertices: ring.length - 1,
      attrs: Object.fromEntries(ATTRS.map(a => [a, fp.attrs[a] ?? null]))};
  });
  const streets = routing.flatMap(s => (s.paths ?? [s.path]).map((p: [number, number][]) => ({name: s.name || '', highway: s.highway as string, path: p.map(([lat, lng]) => round1(lngLatToLocal(anchor, lng, lat)))})))
    .filter(s => s.path.some((p: Pt) => Math.hypot(p[0], p[1]) < CONTEXT_M + 150));
  // Context: every other Building of the blades around the anchor (aerial renders, party-wall tests).
  const [ax, ay] = lngLatToRd(anchor.lng, anchor.lat), own = new Set(instances.map(i => i.pandId)), context: any[] = [];
  for (const name of new Set([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => bladeFor(ax + dx * CONTEXT_M, ay + dy * CONTEXT_M)))) {
    let tile; try { tile = await blade(name); } catch { continue; }
    for (const [id, o] of Object.entries(tile.CityObjects) as [string, any][]) {
      if (o.type !== 'Building' || own.has(id.replace('NL.IMBAG.Pand.', ''))) continue;
      const fp = footprint({CityObjects: {[id]: o}, vertices: tile.vertices}, tile.transform);
      if (!fp || Math.hypot(fp.ringRd[0][0] - ax, fp.ringRd[0][1] - ay) > CONTEXT_M) continue;
      const a = fp.attrs, h = a.b3_h_dak_max != null && a.b3_h_maaiveld != null ? a.b3_h_dak_max - a.b3_h_maaiveld : 7;
      context.push({id: fp.id, heightM: Math.round(h * 10) / 10, ring: fp.ringRd.map(([x, y]) => round1(lngLatToLocal(anchor, ...rdToLngLat(x, y))))});
    }
  }
  const variants: Record<string, any> = {};
  for (const {fp, m} of fps) {
    const shot = m.terrace.shot, photo = (m.cls.via === 'photo' || m.terrace.reShot) && shot && (!m.terrace.flipped || m.terrace.reShot); // a re-shot's bearing is the opposite of the photographed garden side
    variants[fp.id] = {type: m.cls.type, variant: m.cls.variant, ...(photo ? {frontBearingDeg: shot.frontBearing} : {}),
      note: `${slug} terrace #${m.terrace.terrace} (${m.terrace.size} houses) via ${m.cls.via}${shot ? `; ${m.terrace.reShot ? 'front re-shot' : 'survey'} panorama ${shot.panoId} ${String(shot.timestamp).slice(0, 10)} of representative ${m.terrace.rep}` : ''}${m.cls.note ? `; ${m.cls.note}` : ''}`};
    if (m.cls.repMirror !== undefined && fp.id === m.terrace.rep) variants[fp.id].mirrorAnchor = m.cls.repMirror;
    const po = pandOverrides[fp.id];
    if (po) Object.assign(variants[fp.id], po.variant ? {variant: po.variant} : {}, po.hold ? {hold: po.hold} : {}, {note: `${variants[fp.id].note}; ${po.note}`});
  }
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'instances.json'), JSON.stringify({area, anchor, source: 'PDOK 3D Basisvoorziening 2025 (3DBAG reconstruction, CC BY 4.0) LoD0 footprints + attributes; OSM highways from public/data/extracts/amsterdam/streets-routing.json', instances, streets}) + '\n');
  fs.writeFileSync(path.join(dir, 'context.json'), JSON.stringify({area, anchor, buildings: context}) + '\n');
  fs.writeFileSync(path.join(dir, 'variants.json'), JSON.stringify(variants, null, 1) + '\n');
  const per: Record<string, number> = {};
  for (const {m} of fps) per[`${m.cls.type}/${m.cls.variant}/${m.cls.via}`] = (per[`${m.cls.type}/${m.cls.variant}/${m.cls.via}`] ?? 0) + 1;
  summary.push({area, anchor, pands: fps.length, missing: missing.length, per});
  console.log(area, fps.length, 'pands', JSON.stringify(per), `${context.length} context`);
}
fs.writeFileSync(path.join(survey, 'staged.json'), JSON.stringify(summary, null, 1) + '\n');
