/**
 * Block-face intake: facts for every pand on one side of a street between two
 * cross streets, their ground-floor uses (BAG + OSM), and ONE rectified facade
 * strip of the whole face with each pand's frontage span marked.
 *
 *   node --import tsx scripts/block-face/intake.ts --face=bilder-124-136 --street=Bilderdijkstraat --seed=0363100012156287 \
 *        [--from=<pand> --to=<pand>] [--date=YYYY-MM-DD] [--span-date=<pand6>:YYYY-MM-DD,...] [--ppm=40] [--no-strip]
 *
 * Writes (committed, small, derived):
 *   scripts/block-face/faces/<face>/discovery.json         members in street order, why the face ends, rejected pands
 *   scripts/block-face/faces/<face>/pands/<pand>/{3dbag.json,facts.json}
 *   scripts/block-face/faces/<face>/uses.json               BAG units (gebruiksdoel, address) + OSM businesses per pand
 *   scripts/block-face/faces/<face>/strip.json              strip geometry: scale, ground, per-pand pixel spans, panoramas, dates
 * and (untracked, cited by the intent): staging/block-face/<face>/{strip.jpg,strip-labelled.png}.
 * Raw API responses are cached under .cache/pand-reference (URL-keyed) and .cache/block-face/<face>/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {decodeThreeDBag, type CityJsonItem, type RD, type StreetPath} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {AMSTERDAM_WORLD_ALIGNED, rectifyFacade} from '../../src/canalRecall/facade/rectify.ts';
import {chunkFrame} from '../../src/canalRecall/streetChunks/compileChunk.ts';
import {discoverBlockFace} from '../../src/canalRecall/blockFace/discover.ts';
import {medianFuse, planStrip, type FrontSpan, type PanoRecord} from '../../src/canalRecall/blockFace/strip.ts';
import {assignUses, type OsmBusiness, type BagUnit} from '../../src/canalRecall/blockFace/uses.ts';
import {cachedJson} from '../pand-reference/core.ts';
import {listPanos} from '../pand-reference/select.ts';
import {loadPano} from '../pand-reference/rectify.ts';
import {lensFor} from '../da-costa-block/neighbourhood-core.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
export const FACES = 'scripts/block-face/faces', STAGING = 'staging/block-face';
const toRD = (p: [number, number]): RD => { const r = lngLatToRd(p); return [r.x, r.y]; };
const round = (v: number, d = 2) => +v.toFixed(d);

async function threeDBagBbox(min: RD, max: RD): Promise<CityJsonItem[]> {
  let url: string | null = `https://api.3dbag.nl/collections/pand/items?bbox=${min[0].toFixed(0)},${min[1].toFixed(0)},${max[0].toFixed(0)},${max[1].toFixed(0)}&limit=100`;
  const items: CityJsonItem[] = [];
  for (let page = 0; url && page < 20; page++) {
    const json: any = await cachedJson(url);
    for (const feature of json.features ?? []) items.push({feature, metadata: json.metadata});
    url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
  }
  return items;
}

async function overpass(face: string, bboxLatLng: number[]): Promise<OsmBusiness[]> {
  const file = path.join('.cache/block-face', face, 'overpass.json');
  let json: any = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => null);
  if (!json) {
    const b = bboxLatLng.join(',');
    const q = `[out:json][timeout:60];(nwr["shop"](${b});nwr["amenity"](${b});nwr["craft"](${b});nwr["office"](${b});nwr["healthcare"](${b});nwr["tourism"](${b}););out center tags;`;
    for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
      try {
        const r = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall/1.0 (block-face intake)'}, body: new URLSearchParams({data: q})});
        if (!r.ok) continue;
        json = {...(await r.json()), fetchedAt: new Date().toISOString(), endpoint, query: q};
        break;
      } catch { /* next endpoint */ }
    }
    if (!json) throw Error('Overpass unavailable');
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, JSON.stringify(json));
  }
  return (json.elements ?? []).filter((e: any) => e.tags && (e.lat ?? e.center?.lat)).map((e: any) => ({type: e.type, id: e.id, lngLat: [e.lon ?? e.center.lon, e.lat ?? e.center.lat], tags: e.tags, fetchedAt: json.fetchedAt}));
}

async function bagUnits(min: RD, max: RD): Promise<BagUnit[]> {
  const crs = 'http://www.opengis.net/def/crs/EPSG/0/28992';
  let url: string | null = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${min[0].toFixed(0)},${min[1].toFixed(0)},${max[0].toFixed(0)},${max[1].toFixed(0)}&bbox-crs=${crs}&crs=${crs}&f=json&limit=1000`;
  const out: BagUnit[] = [];
  for (let page = 0; url && page < 10; page++) {
    const json: any = await cachedJson(url);
    for (const f of json.features ?? []) {
      const p = f.properties;
      out.push({id: p.identificatie, rd: f.geometry.coordinates.slice(0, 2), use: String(p.gebruiksdoel ?? ''), street: p.openbare_ruimte_naam, number: p.huisnummer, letter: p.huisletter ?? null, suffix: p.toevoeging ?? null, areaM2: p.oppervlakte, status: p.status});
    }
    url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
  }
  return out;
}

export async function intake(o: {face: string; street: string; seed: string; from?: string; to?: string; date?: string; spanDates?: Record<string, string>; ppm?: number; strip?: boolean}) {
  const t0 = performance.now(), timings: Record<string, number> = {};
  const lap = (k: string, t: number) => { timings[k] = round((performance.now() - t) / 1000, 1); return performance.now(); };
  const streets: StreetPath[] = (JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[]).map(s => ({name: s.name, paths: s.paths ?? [s.path]}));
  const seedItem: any = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${o.seed}`);
  const seedBag = decodeThreeDBag({feature: seedItem.feature, metadata: seedItem.metadata}).bag[0];
  const c: RD = [seedBag.reduce((s, p) => s + p[0], 0) / seedBag.length, seedBag.reduce((s, p) => s + p[1], 0) / seedBag.length];
  // Grow the area until the face stops short of its edge (a face can run a few hundred metres).
  let r = 90, found: ReturnType<typeof discoverBlockFace>, items: CityJsonItem[];
  for (;;) {
    items = await threeDBagBbox([c[0] - r, c[1] - r], [c[0] + r, c[1] + r]);
    found = discoverBlockFace(items, streets, {street: o.street, seed: o.seed, from: o.from, to: o.to, toRD, meta: id => ({threeDBag: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${id}`, fetchedAt: new Date().toISOString().slice(0, 10), streets: 'public/data/extracts/amsterdam/streets-routing.json'})});
    const ext = found.pands.flatMap(p => p.facts.bagFootprintRD.flat()), reach = Math.max(...ext.map(p => Math.max(Math.abs(p[0] - c[0]), Math.abs(p[1] - c[1]))));
    if (reach < r - 15 || r >= 360) break;
    r *= 2;
  }
  let t = lap('discoverS', t0);
  const dir = path.join(FACES, o.face);
  await fs.mkdir(dir, {recursive: true});
  for (const p of found.pands) {
    const pd = path.join(dir, 'pands', p.pandId);
    await fs.mkdir(pd, {recursive: true});
    await fs.writeFile(path.join(pd, '3dbag.json'), JSON.stringify({...p.item, fetchedAt: p.facts.source.fetchedAt}) + '\n');
    await fs.writeFile(path.join(pd, 'facts.json'), JSON.stringify(p.facts, null, 1) + '\n');
  }
  await fs.writeFile(path.join(dir, 'discovery.json'), JSON.stringify({...found.report, areaHalfSizeM: r, pands: found.pands.map(p => ({pandId: p.pandId, alongM: p.alongM, widthM: round(p.facts.fronts[0].widthM), eavesM: round(p.facts.fronts[0].eavesM), roofMaxM: round(p.facts.heights.roofMaxM), storeys3dbag: p.facts.heights.storeys, builtYear: p.facts.heights.builtYear, uncertainty: p.facts.fronts[0].uncertainty}))}, null, 1) + '\n');
  console.log(`${o.face}: ${found.pands.length} pands ${found.pands.map(p => p.pandId.slice(-6)).join(' ')}; ends: ${found.report.ends.map(e => `${e.side}: ${e.reason}`).join(' | ')}`);

  // Uses: BAG units (address + gebruiksdoel) and OSM businesses, per pand.
  const all = found.whole.flatMap(p => p.facts.bagFootprintRD.flat());
  const min: RD = [Math.min(...all.map(p => p[0])) - 12, Math.min(...all.map(p => p[1])) - 12], max: RD = [Math.max(...all.map(p => p[0])) + 12, Math.max(...all.map(p => p[1])) + 12];
  const [w, s] = rdToLngLat({x: min[0], y: min[1]}), [e, n] = rdToLngLat({x: max[0], y: max[1]});
  const units = await bagUnits(min, max), osm = await overpass(o.face, [s, w, n, e]);
  const members = new Set(found.pands.map(p => p.pandId));
  // Assign over the whole face (a business near a party wall goes to the nearer pand), then keep the members.
  const uses = assignUses(found.whole.map(p => ({pandId: p.pandId, rings: p.facts.bagFootprintRD, front: p.facts.fronts[0]})), units, osm.map(b => ({...b, rd: toRD(b.lngLat)})), o.street).filter(u => members.has(u.pandId));
  await fs.writeFile(path.join(dir, 'uses.json'), JSON.stringify({street: o.street, sources: {bag: 'PDOK BAG OGC API v2 verblijfsobject (gebruiksdoel, address)', osm: `OpenStreetMap via Overpass, fetched ${osm[0]?.fetchedAt ?? 'n/a'} (ODbL)`}, pands: uses}, null, 1) + '\n');
  for (const u of uses) console.log(`  ${u.pandId.slice(-6)} ${u.addresses.join(', ')} | ground: ${u.groundUnits.map(g => g.use).join('+') || '-'} | osm: ${u.osm.map(b => `${b.tags.name ?? '?'} (${b.tags.shop ?? b.tags.amenity ?? b.tags.craft ?? b.tags.office ?? ''})`).join('; ') || '-'}`);
  t = lap('usesS', t);
  if (o.strip === false) return {found, timings};

  // Facade strip in the chunk frame: x along the face (left→right from the street), one ground line.
  const frame = chunkFrame(found.pands.map(p => ({id: p.pandId, intent: {} as any, facts: p.facts})));
  const xOf = (q: number[]) => (q[0] - frame.midRD[0]) * frame.uRD[0] + (q[1] - frame.midRD[1]) * frame.uRD[1];
  const spans: FrontSpan[] = found.pands.map(p => ({pandId: p.pandId, a: p.facts.fronts[0].endpointsRD[0], b: p.facts.fronts[0].endpointsRD[1], normal: p.facts.fronts[0].outwardNormalRD}));
  const groundNAP = [...found.pands.map(p => p.facts.heights.groundNAP)].sort((a, b) => a - b)[found.pands.length >> 1];
  const topM = Math.max(...found.pands.map(p => p.facts.heights.roofMaxM)) + 2;
  const ppm = o.ppm ?? 40;
  const midAll: RD = [frame.midRD[0], frame.midRD[1]];
  const raw = await listPanos({x: midAll[0], y: midAll[1]}, Math.max(45, (Math.max(...spans.map(s => xOf(s.b))) - Math.min(...spans.map(s => xOf(s.a)))) / 2 + 30));
  const panos: PanoRecord[] = raw.map((p: any) => ({panoId: p.pano_id, timestamp: p.timestamp, rd: toRD([p.geometry.coordinates[0], p.geometry.coordinates[1]]), record: p}));
  const plan = planStrip(spans, panos, {date: o.date, spanDates: o.spanDates});
  const x0 = Math.min(...spans.map(s => xOf(s.a))), x1 = Math.max(...spans.map(s => xOf(s.b)));
  const W = Math.round((x1 - x0) * ppm), H = Math.round(topM * ppm);
  const canvas = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { canvas[i * 4] = canvas[i * 4 + 1] = canvas[i * 4 + 2] = 128; canvas[i * 4 + 3] = 255; }
  const byId = new Map(panos.map(p => [p.panoId, p]));
  const spanRecords = [];
  for (const [i, sp] of plan.spans.entries()) {
    const s = spans[i], crops: Uint8ClampedArray[] = [];
    let dims = {width: 0, height: 0}, missing: number[] = [];
    for (const choice of sp.panos) {
      const rec = byId.get(choice.panoId)!.record as any;
      const pano = await loadPano({panoId: choice.panoId, record: rec} as any);
      if (!pano) continue;
      const lens = lensFor(rec, groundNAP);
      if (!lens) continue;
      const out = rectifyFacade(pano.img, {...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0}, {start: {x: s.a[0], y: s.a[1]}, end: {x: s.b[0], y: s.b[1]}, baseZ: groundNAP, topZ: groundNAP + topM}, {pixelsPerMetre: ppm, camera: AMSTERDAM_WORLD_ALIGNED, maxPixels: 4_000_000});
      dims = {width: out.width, height: out.height}; crops.push(out.data); missing.push(round(out.missingFraction));
    }
    const left = Math.round((xOf(s.a) - x0) * ppm), widthPx = Math.round((xOf(s.b) - xOf(s.a)) * ppm);
    if (crops.length) {
      const fused = medianFuse(crops, dims.width, dims.height);
      // Resample the span crop onto its pixel span of the strip (chord vs frame projection differ by mm).
      const scaled = await sharp(Buffer.from(fused), {raw: {width: dims.width, height: dims.height, channels: 4}}).resize(widthPx, H, {fit: 'fill'}).raw().toBuffer();
      for (let y = 0; y < H; y++) for (let x = 0; x < widthPx; x++) {
        const si = (y * widthPx + x) * 4, di = (y * W + left + x) * 4;
        if (left + x < 0 || left + x >= W || scaled[si + 3] < 128) continue;
        canvas[di] = scaled[si]; canvas[di + 1] = scaled[si + 1]; canvas[di + 2] = scaled[si + 2];
      }
    }
    spanRecords.push({pandId: s.pandId, x0M: round(xOf(s.a)), x1M: round(xOf(s.b)), px: [left, left + widthPx], date: sp.date, fallbackDate: sp.fallback, panoramas: sp.panos.map((p, k) => ({...p, missingFraction: missing[k] ?? null}))});
    console.log(`  strip ${s.pandId.slice(-6)}: ${sp.panos.length} panoramas ${sp.date}${sp.fallback ? ' (fallback date)' : ''} obl ${sp.panos.map(p => p.obliquityDeg).join('/')}`);
  }
  const stage = path.join(STAGING, o.face);
  await fs.mkdir(stage, {recursive: true});
  await sharp(Buffer.from(canvas), {raw: {width: W, height: H, channels: 4}}).removeAlpha().jpeg({quality: 88}).toFile(path.join(stage, 'strip.jpg'));
  const strip = {face: o.face, image: path.join(stage, 'strip.jpg'), pixelsPerMetre: ppm, width: W, height: H, groundNAP: round(groundNAP, 3), heightM: round(topM), frame: {midRD: frame.midRD, uRD: frame.uRD, nRD: frame.nRD}, x0M: round(x0), x1M: round(x1),
    date: plan.date, coverage: round(plan.coverage), spans: spanRecords, candidatesByDate: plan.candidatesByDate,
    description: 'Rectified orthographic elevation of the whole face on the frontage planes: x = chunk-frame metres along the face (left→right seen from the street) from x0M, y = metres above the shared ground (groundNAP) from the bottom; grey = no panorama data. Per-pand spans list the panoramas median-fused for that frontage.',
    attribution: 'Gemeente Amsterdam, Panoramabeelden (CC BY 4.0; faces and number plates blurred by the publisher)'};
  await fs.writeFile(path.join(dir, 'strip.json'), JSON.stringify(strip, null, 1) + '\n');
  await labelledStrip(strip, path.join(stage, 'strip-labelled.png'), uses);
  lap('stripS', t);
  timings.totalS = round((performance.now() - t0) / 1000, 1);
  console.log(JSON.stringify({face: o.face, timings, strip: `${W}x${H}`, date: plan.date, coverage: plan.coverage}));
  return {found, timings};
}

/** The strip with pand boundaries, short ids, BAG addresses and a metre scale: what the intent author reads. */
export async function labelledStrip(strip: any, out: string, uses: {pandId: string; addresses: string[]}[]) {
  const img = await sharp(strip.image).toBuffer(), H = strip.height, W = strip.width, ppm = strip.pixelsPerMetre;
  const lines = strip.spans.map((s: any) => `<line x1="${s.px[0]}" y1="0" x2="${s.px[0]}" y2="${H}" stroke="#ff2d55" stroke-width="2"/>`).join('');
  const labels = strip.spans.map((s: any, i: number) => { const u = uses.find(x => x.pandId === s.pandId); return `<rect x="${s.px[0] + 2}" y="${H + 2}" width="${s.px[1] - s.px[0] - 4}" height="44" fill="${i % 2 ? '#2b2f36' : '#3a3f47'}"/><text x="${s.px[0] + 6}" y="${H + 20}" font-family="Helvetica" font-size="15" fill="#fff">${i + 1}. ${s.pandId.slice(-6)}</text><text x="${s.px[0] + 6}" y="${H + 39}" font-family="Helvetica" font-size="12" fill="#ddd">${(u?.addresses ?? []).slice(0, 2).join(', ').replace(/&/g, '&amp;')} · ${s.date}</text>`; }).join('');
  const ticks = Array.from({length: Math.floor(strip.heightM)}, (_, m) => `<line x1="0" y1="${H - m * ppm}" x2="${m % 5 ? 6 : 14}" y2="${H - m * ppm}" stroke="#fff" stroke-width="1"/>`).join('');
  const svg = `<svg width="${W}" height="${H + 48}" xmlns="http://www.w3.org/2000/svg">${lines}${ticks}${labels}</svg>`;
  await sharp({create: {width: W, height: H + 48, channels: 3, background: '#1f2328'}}).composite([{input: img, left: 0, top: 0}, {input: Buffer.from(svg), left: 0, top: 0}]).png().toFile(out);
}

if (process.argv[1]?.endsWith('block-face/intake.ts')) {
  const face = arg('face'), street = arg('street'), seed = arg('seed');
  if (!face || !street || !seed) throw Error('Use --face --street --seed [--from --to --date --ppm --no-strip]');
  await intake({face, street, seed: seed.length === 6 ? `0363100012${seed}` : seed, from: arg('from') && (arg('from')!.length === 6 ? `0363100012${arg('from')}` : arg('from')), to: arg('to') && (arg('to')!.length === 6 ? `0363100012${arg('to')}` : arg('to')), date: arg('date'), spanDates: arg('span-date') ? Object.fromEntries(arg('span-date')!.split(',').map(x => x.split(':'))) : undefined, ppm: Number(arg('ppm')) || undefined, strip: !process.argv.includes('--no-strip')});
}
