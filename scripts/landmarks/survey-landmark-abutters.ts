/**
 * Landmark abutter survey: city buildings that share a wall with a placed
 * landmark, sit in its angles/notches (convex hull), or partly overlap it below
 * the osm-under-models threshold, scored with BAG/3DBAG, monument-register and
 * OSM evidence. Pure geometry and scoring: src/canalRecall/landmarks/landmarkAbutters.ts.
 *
 *   tsx scripts/landmarks/survey-landmark-abutters.ts [--refresh-facts] [--min-score=2] [model-id ...]
 *
 * --refresh-facts rebuilds scripts/landmarks/landmark-abutters-facts.json (the committed
 * evidence snapshot the gate reads) from the 3DBAG CityJSON cache (.cache/3dbag), the
 * roof-facts tiles, scripts/data/amsterdam-monument-register and the OSM building export
 * (.cache/osm-source/derived/amsterdam-buildings.geojsonseq).
 *
 * Writes scripts/landmarks/landmark-abutters-report.json and
 * docs/landmark-abutters-survey-20261016.md (reviews from landmark-abutters-allowlist.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import {ROOT, readJson, tileXY} from '../lib/placedFootprints';
import {ALLOWLIST, FACTS, candidatesFor, claimedIds, landmarkModels, readFacts, scoreCandidates, type Candidate, type FactsSnapshot, type LandmarkModel, type PandRow, type ScoredCandidate} from '../lib/landmarkAbutterCandidates';
import {overlapFraction, ringsFootprint, type Ring, type LngLat} from '../../src/canalRecall/landmarks/osmUnderModels';
import {NOTCH_GATE_SCORE, type AbutterReview} from '../../src/canalRecall/landmarks/landmarkAbutters';
import {mutualShare as bagMutualShare, PAND_PREFIX, roofCode} from '../../src/canalRecall/bagTiles';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates';
import {decodeRoofFactTile} from '../../src/canalRecall/roofs/roofSlots';

const REPORT = `${ROOT}/scripts/landmarks/landmark-abutters-report.json`;
const DOC = `${ROOT}/docs/landmark-abutters-survey-20261016.md`;
const cacheRoot = ['.cache', '../../../.cache'].map(p => path.resolve(ROOT, p)).find(p => fs.existsSync(path.join(p, '3dbag')));

const args = process.argv.slice(2), only = args.filter(a => !a.startsWith('--'));
const minScore = Number(args.find(a => a.startsWith('--min-score='))?.slice(12) ?? 2);

/** bagTiles.mutualShare over this module's readonly rings. */
const mutualShare = (a: readonly Ring[], b: readonly Ring[]) => bagMutualShare(a as Parameters<typeof bagMutualShare>[0], b as Parameters<typeof bagMutualShare>[1]);

// ---- facts refresh --------------------------------------------------------------------------------------------
type Bag = {id: string; rings: Ring[]; row: PandRow};

/** 3DBAG pands whose footprint centre falls in one of `boxes` (lng/lat), from every cached CityJSON tile. */
function scan3dbag(boxes: {w: number; s: number; e: number; n: number}[]): Map<string, Bag> {
  const rdBoxes = boxes.map(b => { const [x0, y0] = lngLatToRd(b.w, b.s), [x1, y1] = lngLatToRd(b.e, b.n); return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]; });
  const CELL = 200, grid = new Map<string, number[][]>();
  for (const b of rdBoxes) for (let i = Math.floor(b[0] / CELL); i <= Math.floor(b[2] / CELL); i++) for (let j = Math.floor(b[1] / CELL); j <= Math.floor(b[3] / CELL); j++) { const k = `${i},${j}`; if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(b); }
  const hit = (x: number, y: number) => (grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []).some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
  const out = new Map<string, Bag>();
  const root = path.join(cacheRoot!, '3dbag');
  for (const version of fs.readdirSync(root).filter(v => fs.existsSync(path.join(root, v, 'tiles'))).sort().reverse()) {
    const dir = path.join(root, version, 'tiles');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.city.json.gz'));
    let n = 0;
    for (const file of files) {
      if (++n % 50 === 0) console.log(`  3dbag ${version} ${n}/${files.length}`);
      const cj = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, file))).toString('utf8'));
      const {scale, translate} = cj.transform;
      for (const obj of Object.values<any>(cj.CityObjects)) {
        if (obj.type !== 'Building') continue;
        const a = obj.attributes ?? {}, id = String(a.identificatie ?? '');
        if (!id.startsWith(PAND_PREFIX) || out.has(id.slice(14))) continue;
        const lod0 = obj.geometry?.find((g: any) => g.lod === '0' && g.type === 'MultiSurface');
        const surface = lod0?.boundaries?.[0]?.[0] as number[] | undefined;
        if (!surface?.length) continue;
        let cx = 0, cy = 0;
        const rd = surface.map(i => [cj.vertices[i][0] * scale[0] + translate[0], cj.vertices[i][1] * scale[1] + translate[1]]);
        for (const [x, y] of rd) { cx += x / rd.length; cy += y / rd.length; }
        if (!hit(cx, cy)) continue;
        const ring = rd.map(([x, y]) => rdToLngLat(x, y) as LngLat);
        const g = Number(a.b3_h_maaiveld), dm = (v: unknown) => (Number.isFinite(Number(v)) && Number.isFinite(g) && Number(v) - g > 0 ? Math.round((Number(v) - g) * 10) : 0);
        const year = Number(a.oorspronkelijkbouwjaar) || 0;
        out.set(id.slice(14), {id: id.slice(14), rings: [ring], row: [year, roofCode(a.b3_dak_type), dm(a.b3_h_dak_min), dm(a.b3_h_nok ?? a.b3_h_dak_max), '']});
      }
    }
  }
  return out;
}

function roofSlots(pands: Map<string, Bag>) {
  const dir = `${ROOT}/public/data/extracts/amsterdam/roof-facts/14`, done = new Set<string>();
  for (const b of pands.values()) {
    const [x, y] = tileXY(b.rings[0][0][0], b.rings[0][0][1]), key = `${x}/${y}`;
    if (done.has(key)) continue;
    done.add(key);
    const file = `${dir}/${key}.json.gz`;
    if (!fs.existsSync(file)) continue;
    for (const [id, fact] of decodeRoofFactTile(JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()))) { const p = pands.get(id); if (p) p.row[4] = fact.slot; }
  }
}

function monumentIndex(pandIds: Set<string>) {
  const archive = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${ROOT}/scripts/data/amsterdam-monument-register/records.json.gz`)).toString('utf8'));
  const monuments: Record<string, string[]> = {}, names: Record<string, string> = {}, vbos: Record<string, string[]> = {};
  const add = (p: string, key: string) => { if (!pandIds.has(p)) return; (monuments[p] ??= []).includes(key) || monuments[p].push(key); };
  for (const m of archive.municipal) {
    if (m.withdrawnAt) continue;
    const key = `gm:${m.monumentNumber}`;
    for (const p of m.bagPandIds ?? []) add(p, key);
    if ((m.bagPandIds ?? []).some((p: string) => pandIds.has(p))) {
      const md = m.metadata ?? {}, years = [md.jaarBeginVan, md.jaarBeginTot].filter(Boolean).join('-');
      names[key] = [md.naam, md.adressering].filter(Boolean).join(', ') + (years ? ` (${years})` : '') + (m.status ? ` [${m.status}]` : '');
    }
  }
  for (const r of archive.rce) {
    const key = `rce:${r.monumentNumber}`;
    for (const p of r.bagPandIds ?? []) { add(p, key); if (pandIds.has(p)) vbos[p] = [...new Set([...(vbos[p] ?? []), ...(r.bagVboIds ?? [])])].sort(); }
    if ((r.bagPandIds ?? []).some((p: string) => pandIds.has(p))) names[key] = String(r.descriptions?.[0]?.text ?? '').slice(0, 140);
  }
  for (const k of Object.keys(monuments)) monuments[k].sort();
  return {monuments, names, vbos};
}

async function osmTags(ids: Set<string>) {
  const out: Record<string, [string, number, string]> = {};
  const file = path.join(cacheRoot!, 'osm-source/derived/amsterdam-buildings.geojsonseq');
  if (!fs.existsSync(file)) return out;
  const want = new Set([...ids].filter(i => /^[wr]\d+$/.test(i)));
  for await (const raw of readline.createInterface({input: fs.createReadStream(file), crlfDelay: Infinity})) {
    const m = /"@type":"(way|relation)","@id":(\d+)/.exec(raw);
    if (!m) continue;
    const id = `${m[1] === 'way' ? 'w' : 'r'}${m[2]}`;
    if (!want.has(id)) continue;
    const p = JSON.parse(raw.replace(/^\u001e/, '')).properties ?? {};
    out[id] = [String(p.building ?? ''), p['building:part'] && !p.building ? 1 : 0, String(p.name ?? '')];
  }
  return out;
}

async function refreshFacts(models: LandmarkModel[], cands: Map<string, Candidate[]>): Promise<FactsSnapshot> {
  const boxes = models.map(m => { const b = m.footprint.bounds, dx = 30 / 68_000, dy = 30 / 111_320; return {w: b.w - dx, s: b.s - dy, e: b.e + dx, n: b.n + dy}; });
  console.log(`refresh: scanning 3DBAG for ${boxes.length} landmark areas`);
  const bag = scan3dbag(boxes);
  roofSlots(bag);
  const bagList = [...bag.values()];
  const near = (b: {w: number; s: number; e: number; n: number}) => bagList.filter(p => p.rings[0].some(([x, y]) => x >= b.w && x <= b.e && y >= b.s && y <= b.n));
  const tilePands: Record<string, string[]> = {}, landmarkPands: Record<string, string[]> = {}, used = new Set<string>();
  for (const m of models) {
    const local = near({...m.footprint.bounds, w: m.footprint.bounds.w - 0.0005, e: m.footprint.bounds.e + 0.0005, s: m.footprint.bounds.s - 0.0003, n: m.footprint.bounds.n + 0.0003});
    const own = new Set([...m.suppress].filter(i => i.startsWith(PAND_PREFIX)).map(i => i.slice(14)));
    for (const p of local) if (overlapFraction(p.rings[0], m.footprint) >= 0.5) own.add(p.id);
    landmarkPands[m.id] = [...own].sort();
    own.forEach(p => used.add(p));
    for (const c of cands.get(m.id) ?? []) {
      if (tilePands[c.tile.id]) continue;
      const ps = c.tile.id.startsWith(PAND_PREFIX) ? [c.tile.id.slice(14)] : local.filter(p => mutualShare(c.tile.rings, p.rings) >= 0.5).map(p => p.id);
      // Largest share first so the main pand leads.
      tilePands[c.tile.id] = ps.sort((a, b) => mutualShare(c.tile.rings, bag.get(b)?.rings ?? []) - mutualShare(c.tile.rings, bag.get(a)?.rings ?? []) || a.localeCompare(b));
      ps.forEach(p => used.add(p));
    }
  }
  const {monuments, names, vbos} = monumentIndex(used);
  const tileIds = new Set([...cands.values()].flat().map(c => c.tile.id));
  console.log(`refresh: ${bag.size} 3DBAG pands near landmarks, ${used.size} used; reading OSM tags for ${tileIds.size} tiles`);
  const osm = await osmTags(tileIds);
  const pands: Record<string, PandRow> = {};
  for (const id of [...used].sort()) { const b = bag.get(id); if (b) pands[id] = b.row; }
  const sortObj = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  return {
    version: 1, generatedAt: new Date().toISOString().slice(0, 10),
    sources: {
      '3dbag': '3DBAG v20250903 CityJSON tiles (CC BY 4.0), .cache/3dbag: oorspronkelijkbouwjaar, b3_dak_type, b3_h_dak_min/b3_h_nok minus b3_h_maaiveld',
      roofFacts: 'public/data/extracts/amsterdam/roof-facts (PDOK luchtfoto CC BY 4.0)',
      monuments: 'scripts/data/amsterdam-monument-register records.json.gz (Amsterdam monumenten API, RCE linked data)',
      osm: 'OpenStreetMap (ODbL) amsterdam-buildings.geojsonseq, .cache/osm-source/derived',
    },
    pands: pands, tilePands: sortObj(tilePands), landmarkPands: sortObj(landmarkPands), monuments: sortObj(monuments), monumentNames: sortObj(names), vbos: sortObj(vbos), osm: sortObj(osm),
  };
}

// ---- report ---------------------------------------------------------------------------------------------------
const centroid = (rings: Ring[]): LngLat => { const r = rings[0]; let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [+(x / r.length).toFixed(6), +(y / r.length).toFixed(6)]; };

function row(c: ScoredCandidate) {
  const g = c.geometry, id = c.identity;
  return {
    id: c.tile.id, score: c.score, categories: g.categories, centre: centroid(c.tile.rings),
    overlap: +g.overlap.toFixed(2), inHull: +g.inHull.toFixed(2), sharedWallM: +g.sharedWallM.toFixed(1), sharedShare: +g.sharedShare.toFixed(2), sides: g.sides, areaM2: Math.round(g.areaM2),
    pands: id.pands, year: id.year ?? null, landmarkYear: id.landmarkYear ?? null, sharedMonuments: id.sharedMonuments ?? [], monuments: id.monumentNames,
    sharedVbos: id.sharedVbos ?? [], bagRoof: id.bagRoof ?? null, bagRidgeM: id.bagRidgeM ?? null, tileHeightM: id.tileHeightM ?? null, tileRoofShape: id.tileRoofShape ?? null,
    osmBuilding: id.osmBuilding ?? null, osmBuildingPart: !!id.osmBuildingPart,
    terms: c.terms.map(t => `${t.signal} ${t.points > 0 ? '+' : ''}${t.points}: ${t.note}`),
  };
}

async function main() {
  const {models, skipped} = await landmarkModels(only);
  const claimed = claimedIds(), cands = new Map<string, Candidate[]>();
  for (const m of models) cands.set(m.id, candidatesFor(m, claimed));
  let facts = readFacts();
  if (args.includes('--refresh-facts') || !facts) {
    if (!cacheRoot) throw new Error('no .cache/3dbag: cannot refresh facts');
    facts = await refreshFacts(models, cands);
    if (only.length) { console.log('(model filter: facts kept in memory, snapshot not written)'); }
    else fs.writeFileSync(FACTS, JSON.stringify(facts));
    if (!only.length) console.log(`wrote ${path.relative(ROOT, FACTS)} (${(fs.statSync(FACTS).size / 1024).toFixed(0)} KB)`);
  }
  const reviews: Record<string, Record<string, AbutterReview>> = fs.existsSync(ALLOWLIST) ? readJson(ALLOWLIST) : {};
  const out = models.map(m => ({model: m.id, name: m.name, kind: m.kind, footprint: m.source, landmarkPands: facts!.landmarkPands[m.id] ?? [],
    candidates: scoreCandidates(m, cands.get(m.id) ?? [], facts).map(c => ({...row(c), review: reviews[m.id]?.[c.tile.id] ?? null}))}));
  const all = out.flatMap(m => m.candidates.map(c => ({model: m.model, name: m.name, ...c})));
  const count = (pred: (c: typeof all[number]) => boolean) => all.filter(pred).length;
  const summary = {
    models: models.length, skippedNoFootprint: skipped, candidates: all.length,
    byCategory: {wall: count(c => c.categories.includes('wall')), notch: count(c => c.categories.includes('notch')), partial: count(c => c.categories.includes('partial'))},
    atOrAboveMinScore: count(c => c.score >= minScore), notchAtGate: count(c => c.categories.includes('notch') && c.score >= NOTCH_GATE_SCORE),
    reviewed: count(c => !!c.review), verdicts: Object.fromEntries(['fold-in', 'separate-but-wrong', 'fine', 'unclear'].map(v => [v, count(c => c.review?.verdict === v)])),
  };
  if (!only.length) {
    fs.writeFileSync(REPORT, JSON.stringify({generatedAt: facts!.generatedAt, gateScore: NOTCH_GATE_SCORE, summary, models: out.filter(m => m.candidates.length)}, null, 1) + '\n');
    fs.mkdirSync(path.dirname(DOC), {recursive: true});
    fs.writeFileSync(DOC, renderDoc(out, summary, all));
    console.log(`wrote ${path.relative(ROOT, REPORT)} and ${path.relative(ROOT, DOC)}`);
  }
  console.log(JSON.stringify(summary));
  for (const c of all.filter(c => c.score >= minScore).sort((a, b) => b.score - a.score).slice(0, only.length ? 999 : 40))
    console.log(`${c.score.toFixed(1).padStart(5)} ${c.model} ${c.id} [${c.categories.join(',')}] ${c.review?.verdict ?? ''} | ${c.terms.join('; ')}`);
}

function renderDoc(out: {model: string; name: string; kind: string; candidates: (ReturnType<typeof row> & {review: AbutterReview | null})[]}[], summary: Record<string, unknown>, all: (ReturnType<typeof row> & {model: string; name: string; review: AbutterReview | null})[]) {
  const L: string[] = [];
  const s = summary as {models: number; candidates: number; byCategory: Record<string, number>; atOrAboveMinScore: number; notchAtGate: number; verdicts: Record<string, number>};
  L.push('# Landmark abutter survey (2026-10-16)', '',
    'City buildings that belong with a placed landmark but are still drawn by the kit: buildings that share a wall with the model,',
    'sit in an angle/notch/courtyard of it (inside its convex hull), or partly overlap it below the 50% check:osm-under-models threshold.',
    'Generated by `scripts/landmarks/survey-landmark-abutters.ts`; geometry and scoring in `src/canalRecall/landmarks/landmarkAbutters.ts`;',
    'reviews and photo evidence in `scripts/landmarks/landmark-abutters-allowlist.json`; gate `scripts/check-landmark-abutters.ts`.', '',
    `Landmark models: ${s.models}. Candidates: ${s.candidates} (wall ${s.byCategory.wall}, notch ${s.byCategory.notch}, partial ${s.byCategory.partial}; a candidate can be in several).`,
    `Score >= ${minScore}: ${s.atOrAboveMinScore}. Notch candidates at or above the gate score ${NOTCH_GATE_SCORE}: ${s.notchAtGate}.`,
    `Reviewed verdicts: ${Object.entries(s.verdicts).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '',
    '## Score', '',
    '| signal | points |', '|---|---|',
    '| shares a municipal/RCE monument record with the landmark pands | +4 |', '| shares an RCE verblijfsobject | +2 |',
    '| bouwjaar within 2 / 25 / 75 years of the landmark (more than 150 years newer: -1) | +3 / +2 / +1 |',
    '| notch (>= 50% in hull): >= 85% in hull / otherwise; or 25-50% in hull | +3 / +2; +1 |', '| shared wall, per 6 m (max 3) | up to +3 |',
    '| shared walls on two or more distinct sides (wraps round it) | +1.5 |', '| partial overlap >= 20% / >= 5% | +1 / +0.5 |',
    '| OSM building:part / OSM building=church etc. | +2 / +1 |', '| 3DBAG slanted roof but the tile draws a flat box | +1 |', '| tile height more than 3 m off the 3DBAG ridge | +0.5 |',
    '| terrace damping: shared wall on one side only, under 25% in the hull, no overlap, no shared monument, not a building:part | -1.5 |', '');
  L.push('## Noise to tune against', '',
    '- Terraced shop and canal houses along the street front of a block a landmark sits in (Kalverstraat beside the Amsterdam Museum and the Nieuwezijds Kapel, Singel beside the Singelkerk, Zeedijk beside He Hua): wall + notch because the landmark wraps the block, but separate buildings.',
    '- Complex-wide monument records ("e.o.", whole plein or gasworks): Mercatorplein rce 527135, Westergasfabriek gm:337504, Nieuwezijds Kapel gm:518455, DeLaMar gm:209012 give the monument bonus to separate neighbours.',
    '- Same-era development: 1885-1930 blocks round a church built with the street (Gerard Dou, Aron Schuster, Jeruzalemkerk, Willem de Zwijgerkerk) score the year bonus with nothing else in common.',
    '- Big irregular models (RAI, Centraal, Rijksmuseum, Heineken) have convex hulls that sweep in whole neighbouring buildings.',
    '- A candidate is a tile feature: OSM building:parts on the church pand (Oude Kerk, Sint Nicolaas, Noorderkerk) inherit the church\'s own bouwjaar and are the real hits; BAG pands with year 0 lose the year signal.', '');
  const reviewed = all.filter(c => c.review).sort((a, b) => b.score - a.score);
  const fold = reviewed.filter(c => c.review!.verdict === 'fold-in');
  L.push('## Fold-in queue', '', 'Each entry is part of the monument and should be suppressed and modelled in the landmark builder (integrator turns these into handoffs).', '');
  if (!fold.length) L.push('_None reviewed yet._', '');
  const byModel = new Map<string, typeof fold>();
  for (const c of fold) byModel.set(c.model, [...(byModel.get(c.model) ?? []), c]);
  let k = 0;
  for (const [model, cs] of [...byModel].sort((a, b) => Math.max(...b[1].map(c => c.score)) - Math.max(...a[1].map(c => c.score)))) {
    L.push(`${++k}. **${cs[0].name}** (\`${model}\`): ${cs.map(c => `\`${c.id}\`${c.pands.length ? ` (pand ${c.pands.join(', ')})` : ''} score ${c.score}`).join('; ')}.`);
    for (const c of cs) L.push(`   - \`${c.id}\`: ${c.review!.reason}${c.review!.evidence ? ` Evidence: ${c.review!.evidence}` : ''}`);
  }
  L.push('', '## Other reviewed verdicts', '', '| landmark | candidate | score | verdict | reason | evidence |', '|---|---|---|---|---|---|');
  for (const c of reviewed.filter(c => c.review!.verdict !== 'fold-in')) L.push(`| ${c.model} | \`${c.id}\` | ${c.score} | ${c.review!.verdict} | ${c.review!.reason.replace(/\|/g, '/')} | ${(c.review!.evidence ?? '').replace(/\|/g, '/')} |`);
  L.push('', '## Ranked candidates per landmark', '', `Only candidates scoring >= ${minScore}. Full list in \`scripts/landmarks/landmark-abutters-report.json\`.`, '');
  for (const m of out.filter(m => m.candidates.some(c => c.score >= minScore)).sort((a, b) => Math.max(...b.candidates.map(c => c.score)) - Math.max(...a.candidates.map(c => c.score)))) {
    L.push(`### ${m.name} (\`${m.model}\`, ${m.kind})`, '', '| candidate | score | cat | in hull | wall m | year | roof 3DBAG / tile | monument | verdict | evidence |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const c of m.candidates.filter(c => c.score >= minScore))
      L.push(`| \`${c.id}\`${c.pands.length && !c.id.includes(c.pands[0]) ? `<br>${c.pands.slice(0, 3).join('<br>')}` : ''} | ${c.score} | ${c.categories.join(', ')} | ${Math.round(c.inHull * 100)}% | ${c.sharedWallM} | ${c.year ?? '?'} / ${c.landmarkYear ?? '?'} | ${c.bagRoof ?? '?'} ${c.bagRidgeM ?? '?'}m / ${c.tileRoofShape ?? 'flat'} ${c.tileHeightM ?? '?'}m | ${c.sharedMonuments.join(', ') || '-'} | ${c.review?.verdict ?? ''} | ${c.terms.map(t => t.split(':')[0]).join(', ')} |`);
    L.push('');
  }
  return L.join('\n') + '\n';
}

await main();
