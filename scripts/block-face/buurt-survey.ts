/**
 * Buurt survey: every BAG pand of one CBS/municipal buurt, its streets and the block faces that cover it, as the
 * input of auto-placement (scripts/block-face/auto-place.ts). Open data only: the municipal gebieden API (buurt
 * outline), PDOK BAG (addresses, gebruiksdoel) and 3DBAG (footprints, heights, build year, storeys).
 *
 *   node --import tsx scripts/block-face/buurt-survey.ts --buurt=Bellamybuurt-Zuid --slug=bellamybuurt-zuid [--intake] [--only=<face>,...]
 *
 * Writes scripts/block-face/buurten/<slug>.json:
 *   pands  every pand whose BAG units lie inside the buurt: street + numbers per street, year, 3DBAG width/eaves/ridge/
 *          storeys, ground gebruiksdoel, and the existing block face that already covers it (if any);
 *   faces  proposed faces (blockFace/buurtFaces.ts `proposeFaces`: per street side, pands joined by shared party walls),
 *          each with its seed and the from/to trim to the buurt's own pands.
 * With --intake every proposed face not covered yet runs scripts/block-face/intake.ts (strip, uses, facts), trimmed
 * to the buurt.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {buildFacts, decodeThreeDBag, type CityJsonItem, type RD, type StreetPath} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {pointInPolygon, proposeFaces, type BuurtPand} from '../../src/canalRecall/blockFace/buurtFaces.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
import {cachedJson} from '../pand-reference/core.ts';
import {FACES, intake} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const buurtName = arg('buurt') ?? 'Bellamybuurt-Zuid', slug = arg('slug') ?? buurtName.toLowerCase();
const OUT = path.join('scripts/block-face/buurten', `${slug}.json`);
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/28992';
const toRD = (p: [number, number]): RD => { const r = lngLatToRd(p); return [r.x, r.y]; };
const round = (v: number, d = 2) => +v.toFixed(d);

export async function buurtOutline(name: string): Promise<{code: string; id: string; ring: RD[]}> {
  const json: any = await cachedJson(`https://api.data.amsterdam.nl/v1/gebieden/buurten/?naam=${encodeURIComponent(name)}&_format=json`);
  const b = (json._embedded?.buurten ?? []).find((x: any) => !x.eindGeldigheid);
  if (!b) throw Error(`no current buurt named ${name}`);
  return {code: b.code, id: b.identificatie, ring: b.geometrie.coordinates[0]};
}

async function threeDBagBbox(min: RD, max: RD): Promise<CityJsonItem[]> {
  const items: CityJsonItem[] = [];
  // 3DBAG pages at 100 items; tile the bbox so no single query runs past its page limit.
  for (let x = min[0]; x < max[0]; x += 200) for (let y = min[1]; y < max[1]; y += 200) {
    let url: string | null = `https://api.3dbag.nl/collections/pand/items?bbox=${x.toFixed(0)},${y.toFixed(0)},${Math.min(max[0], x + 200).toFixed(0)},${Math.min(max[1], y + 200).toFixed(0)}&limit=100`;
    for (let page = 0; url && page < 30; page++) {
      const json: any = await cachedJson(url);
      for (const feature of json.features ?? []) items.push({feature, metadata: json.metadata});
      url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
    }
  }
  const seen = new Set<string>();
  return items.filter(i => { const id = Object.keys(i.feature.CityObjects).find(k => i.feature.CityObjects[k].type === 'Building')!; if (seen.has(id)) return false; seen.add(id); return true; });
}

async function bagUnits(min: RD, max: RD) {
  const out: {rd: RD; street: string; number: number; letter: string | null; suffix: string | null; use: string; status: string}[] = [];
  let url: string | null = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${min[0].toFixed(0)},${min[1].toFixed(0)},${max[0].toFixed(0)},${max[1].toFixed(0)}&bbox-crs=${CRS}&crs=${CRS}&f=json&limit=1000`;
  for (let page = 0; url && page < 40; page++) {
    const json: any = await cachedJson(url);
    for (const f of json.features ?? []) {
      const p = f.properties;
      if (/ingetrokken|niet gerealiseerd/i.test(String(p.status))) continue;
      out.push({rd: f.geometry.coordinates.slice(0, 2), street: p.openbare_ruimte_naam, number: p.huisnummer, letter: p.huisletter ?? null, suffix: p.toevoeging ?? null, use: String(p.gebruiksdoel ?? ''), status: p.status});
    }
    url = json.links?.find((l: any) => l.rel === 'next')?.href ?? null;
  }
  return out;
}

if (process.argv[1]?.endsWith('block-face/buurt-survey.ts')) {
  const t0 = performance.now();
  const outline = await buurtOutline(buurtName);
  const xs = outline.ring.map(p => p[0]), ys = outline.ring.map(p => p[1]);
  const min: RD = [Math.min(...xs) - 20, Math.min(...ys) - 20], max: RD = [Math.max(...xs) + 20, Math.max(...ys) + 20];
  const [items, units] = await Promise.all([threeDBagBbox(min, max), bagUnits(min, max)]);
  const streets: StreetPath[] = (JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[]).map(s => ({name: s.name, paths: s.paths ?? [s.path]}));
  // Pands that are already a member of a block face.
  const covered = new Map<string, string>();
  for (const f of (await fs.readdir(FACES)).filter(f => !f.startsWith('_'))) {
    const d = path.join(FACES, f, 'discovery.json');
    // Faces generated for this buurt (auto-place.json or a run of one) are not authored covers.
    if (existsSync(d) && !existsSync(path.join(FACES, f, 'auto-place.json')) && !JSON.parse(await fs.readFile(d, 'utf8')).runOf) for (const m of JSON.parse(await fs.readFile(d, 'utf8')).members) covered.set(m, f);
  }
  const decoded = items.map(item => {
    const id = Object.keys(item.feature.CityObjects).find(k => item.feature.CityObjects[k].type === 'Building')!.replace('NL.IMBAG.Pand.', '');
    return {id, item, rings: decodeThreeDBag(item).bag};
  });
  const pands: BuurtPand[] = [];
  for (const d of decoded) {
    const mine = units.filter(u => d.rings.some(r => pointInPolygon(u.rd, r)) && pointInPolygon(u.rd, outline.ring));
    if (!mine.length) continue;
    const byStreet = new Map<string, number[]>();
    for (const u of mine) byStreet.set(u.street, [...new Set([...(byStreet.get(u.street) ?? []), u.number])].sort((a, b) => a - b));
    const ranked = [...byStreet.entries()].sort((a, b) => mine.filter(u => u.street === b[0]).length - mine.filter(u => u.street === a[0]).length);
    const street = ranked[0][0];
    let facts: ReturnType<typeof buildFacts> | undefined, factsError: string | undefined;
    try { facts = buildFacts(d.id, d.item, streets, [street], toRD, {threeDBag: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${d.id}`, fetchedAt: new Date().toISOString().slice(0, 10), streets: 'public/data/extracts/amsterdam/streets-routing.json'}, {terrainAt: sharedTerrain()}); }
    catch (e) { factsError = (e as Error).message.slice(0, 100); }
    const f = facts?.fronts[0];
    const ground = mine.filter(u => !u.suffix || /^(h|hs|a)$/i.test(u.suffix) || u.letter === null);
    pands.push({pandId: d.id, street, numbers: byStreet.get(street)!, otherStreets: Object.fromEntries(ranked.slice(1)), side: byStreet.get(street)![0] % 2 ? 'odd' : 'even',
      builtYear: facts?.heights.builtYear ?? null, storeys3dbag: facts?.heights.storeys ?? null, units: mine.length, groundUses: [...new Set(ground.map(u => u.use))],
      ...(f ? {frontWidthM: round(f.widthM, 1), eavesM: round(f.eavesM, 1), ridgeM: round(facts!.heights.ridgeM, 1), roofMaxM: round(facts!.heights.roofMaxM, 1), normal: f.outwardNormalRD.map(v => round(v, 3)) as [number, number],
        frontMidRD: [round((f.endpointsRD[0][0] + f.endpointsRD[1][0]) / 2), round((f.endpointsRD[0][1] + f.endpointsRD[1][1]) / 2)] as [number, number]} : {factsError}),
      rings: d.rings.map(r => r.map(p => [round(p[0]), round(p[1])] as RD)), ...(covered.has(d.id) ? {face: covered.get(d.id)} : {})});
  }
  pands.sort((a, b) => a.street.localeCompare(b.street) || a.numbers[0] - b.numbers[0]);
  const faces = proposeFaces(pands);
  const doc = {buurt: buurtName, code: outline.code, identificatie: outline.id, slug,
    sources: {outline: 'api.data.amsterdam.nl gebieden/buurten (CC0)', bag: 'PDOK BAG OGC API v2 verblijfsobject (CC0)', threeDBag: '3DBAG api.3dbag.nl (CC BY 4.0)'},
    surveyedAt: new Date().toISOString().slice(0, 10), outlineRD: outline.ring,
    facesRule: 'blockFace/buurtFaces.ts proposeFaces: per street and side, pands with a frontage on their address street joined by shared BAG party walls (>= 1 m, front normals within 0.8 dot); faces already authored are kept, not proposed',
    faces, pands: pands.map(({rings, ...p}) => p)};
  await fs.mkdir(path.dirname(OUT), {recursive: true});
  await fs.writeFile(OUT, JSON.stringify(doc, null, 1) + '\n');
  const byStreet = new Map<string, number>();
  for (const p of pands) byStreet.set(p.street, (byStreet.get(p.street) ?? 0) + 1);
  console.log(`${buurtName} (${outline.code}): ${pands.length} pands, ${pands.filter(p => p.face).length} already on a face; ${faces.length} proposed faces; ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  console.log([...byStreet.entries()].map(([s, n]) => `${s} ${n}`).join(' | '));
  for (const f of faces) console.log(`  ${f.id.padEnd(30)} ${f.street.padEnd(24)} ${f.side.padEnd(5)} ${String(f.members.length).padStart(3)} pands ${f.lengthM} m ${f.covered ? 'covered by ' + f.covered : ''}`);
  if (process.argv.includes('--intake')) {
    const only = arg('only')?.split(',');
    for (const f of faces) {
      if (f.covered || f.members.length < 2 || (only && !only.includes(f.id))) continue;
      if (existsSync(path.join(FACES, f.id, 'strip.json')) && !process.argv.includes('--force')) { console.log(`${f.id}: intake exists`); continue; }
      // Trim to the buurt's own pands; discover.ts may drop an end pand the proposal kept (a corner whose sightline
      // crosses its neighbour), so the trim falls back to the outermost proposal members it did discover.
      const run = async (from: string, to: string) => intake({face: f.id, street: f.street, seed: f.seed, from, to});
      try {
        try { await run(f.members[0], f.members.at(-1)!); }
        catch (e) {
          const m = /not on the face \(([^)]*)\)/.exec((e as Error).message);
          if (!m) throw e;
          const found = new Set(m[1].split(' ')), kept = f.members.filter(id => found.has(id.slice(-6)));
          if (kept.length < 2) throw e;
          (f as any).dropped = f.members.filter(id => !found.has(id.slice(-6)));
          await run(kept[0], kept.at(-1)!);
        }
      } catch (e) { console.log(`${f.id}: INTAKE FAILED ${(e as Error).message.slice(0, 200)}`); (f as any).intakeError = (e as Error).message.slice(0, 200); }
    }
    await fs.writeFile(OUT, JSON.stringify(doc, null, 1) + '\n');
  }
}
