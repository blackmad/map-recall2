/** Discover and survey low canal bridges. Cached rebuilds need no network. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fromArrayBuffer } from 'geotiff';
import { lngLatToRd, rdToLngLat } from '../src/canalRecall/rdCoordinates.ts';
import { discoverBridges } from './bridges/discovery.ts';
import { validateBridgeSurfaceFile, bridgeProfileAt, insideBridgeOutline } from '../src/canalRecall/bridgeSurface.ts';
import { preflightBridge } from './bridges/preflight.ts';

const cache = '.cache/bridge-surfaces';
const registerFile = 'scripts/data/amsterdam-bridge-register.json';
const roadsFile = 'public/data/extracts/amsterdam/streets-routing.json';
const catalogFile='public/data/extracts/amsterdam/bridges.json';
const pedestrianFile='scripts/data/amsterdam-bridge-paths.json';
const register = JSON.parse(await readFile(registerFile, 'utf8'));
const cyclingRoads = JSON.parse(await readFile(roadsFile, 'utf8'));
const pedestrian=JSON.parse(await readFile(pedestrianFile,'utf8'));
const roads=[...cyclingRoads,...pedestrian.paths];
const catalog=JSON.parse(await readFile(catalogFile,'utf8'));
const waters=JSON.parse(await readFile('public/data/extracts/amsterdam/water.json','utf8'));
const scope=process.argv.find(a=>a.startsWith('--scope='))?.slice(8)||'all';
if(!['canal-belt','all'].includes(scope))throw Error('Scope must be canal-belt or all');
const discovery=discoverBridges(register.bridges,roads,scope,catalog,waters.flatMap((w:any)=>w.paths||[w.path]));
const reportFile=process.argv.find(a=>a.startsWith('--report='))?.slice(9)||'public/data/extracts/amsterdam/bridge-surface-review.json';
const report={version:1,scope,registerSnapshot:register.fetched,entries:discovery.entries,summary:{} as Record<string,number>};
async function writeReport(){report.summary={};for(const entry of report.entries)report.summary[entry.status]=(report.summary[entry.status]||0)+1;await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');}
if(process.argv.includes('--discover-only')){await writeReport();console.log(JSON.stringify(report.summary));process.exit(0);}
type Point = [number, number];
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (n: number) => Math.round(n * 1000) / 1000;
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const sourceHashes=Object.fromEntries(await Promise.all([registerFile,roadsFile,catalogFile,pedestrianFile,'public/data/extracts/amsterdam/water.json'].map(async file=>[file,hash(await readFile(file))])));
const paths: Point[][] = roads.filter((r: any) => !r.bridge && !r.tunnel && r.highway !== 'steps')
  .flatMap((r: any) => r.paths || [r.path]).filter((p: any) => p?.length >= 2)
  .map((p: number[][]) => p.map(([lat, lng]) => lngLatToRd(lng, lat)));
const stairEnds:Point[]=pedestrian.paths.filter((r:any)=>r.highway==='steps').flatMap((r:any)=>[r.path[0],r.path.at(-1)]).map(([lat,lng]:number[])=>lngLatToRd(lng,lat));

// Follow connected roads, rather than extending a bridge's chord into houses.
function approach(end: Point, inside: Point, length: number): Point[] {
  const result = [end];
  let remaining = length, previous = inside;
  const visited = new Set<string>();
  for (let step = 0; step < 30 && remaining > .01; step++) {
    const current = result.at(-1)!;
    const candidates = paths.flatMap(path => path.flatMap((p, i) => {
      if (distance(p, current) > .8) return [];
      return [path[i - 1], path[i + 1]].filter(Boolean).map(next => {
        const incoming = [current[0] - previous[0], current[1] - previous[1]];
        const outgoing = [next[0] - current[0], next[1] - current[1]];
        const cosine = (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) /
          (Math.hypot(...incoming) * Math.hypot(...outgoing));
        return { next, cosine, key: next.join(',') };
      });
    }).concat(path.slice(1).flatMap((b,i)=>{
      const a=path[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;
      if(!l)return[];const t=((current[0]-a[0])*dx+(current[1]-a[1])*dy)/l;
      if(t<=1e-6||t>=1-1e-6||Math.hypot(current[0]-a[0]-dx*t,current[1]-a[1]-dy*t)>.3)return[];
      return[a,b].map(next=>{const ix=current[0]-previous[0],iy=current[1]-previous[1],ox=next[0]-current[0],oy=next[1]-current[1];
        return{next,cosine:(ix*ox+iy*oy)/(Math.hypot(ix,iy)*Math.hypot(ox,oy)),key:next.join(',')};});
    }))).filter(c => c.cosine > -.15 && !visited.has(c.key)).sort((a, b) => b.cosine - a.cosine);
    const candidate = candidates[0];
    if (!candidate) throw Error(stairEnds.some(p=>distance(p,current)<.8)?'Stair approach needs a pedestrian stair model':'No connected approach at ' + rdToLngLat(...current));
    visited.add(candidate.key);
    const segmentLength = distance(current, candidate.next);
    if (segmentLength < .01) continue;
    const t = Math.min(1, remaining / segmentLength);
    result.push([current[0] + (candidate.next[0] - current[0]) * t,
      current[1] + (candidate.next[1] - current[1]) * t]);
    remaining -= segmentLength; previous = current;
  }
  return result;
}

await mkdir(cache, { recursive: true });
const bridges = [];
for (const candidate of discovery.candidates) {
  const {row,road,deck,outline}=candidate;
  const name=row[1]||(/brug|sluis/i.test(road.name)?road.name:'')||`Bridge ${row[0].replace('BRU','')}`;
  const entry=report.entries.find(e=>e.id===row[0])!;
  try {
  if(row[2]==='Beweegbare brug')throw Error('Movable structure needs reference-led modelling');
  if(!['Metselwerk','Staal','Hout'].includes(row[3])&&!/beton/i.test(row[3]))throw Error('Structural material needs review');
  const before = approach(deck[0], deck[1], 24).reverse();
  const after = approach(deck.at(-1)!, deck.at(-2)!, 24);
  const crossingLength=deck.slice(1).reduce((sum,p,i)=>sum+distance(deck[i],p),0);
  const line = [...before, ...deck.slice(1), ...after.slice(1)];
  const bbox = [Math.floor(Math.min(...line.map(p => p[0]), ...outline.map(p => p[0])) - 6),
    Math.floor(Math.min(...line.map(p => p[1]), ...outline.map(p => p[1])) - 6),
    Math.ceil(Math.max(...line.map(p => p[0]), ...outline.map(p => p[0])) + 6),
    Math.ceil(Math.max(...line.map(p => p[1]), ...outline.map(p => p[1])) + 6)];
  const urlFor = (coverage: string) => 'https://service.pdok.nl/rws/ahn/wcs/v1_0?' + new URLSearchParams({
    SERVICE: 'WCS', VERSION: '1.0.0', REQUEST: 'GetCoverage', COVERAGE: coverage,
    CRS: 'EPSG:28992', BBOX: bbox.join(','), RESX: '0.5', RESY: '0.5', FORMAT: 'GEOTIFF',
  });
  const rasterSources = [];
  const readers = new Map<string, (x: number, y: number) => number>();
  for (const coverage of ['dsm_05m', 'dtm_05m']) {
    const file = `${cache}/${row[0]}-${coverage}.tif`, url = urlFor(coverage);
    const existing=await readFile(`${file}.json`,'utf8').then(JSON.parse).catch(()=>null);
    if (process.argv.includes('--fetch')&&(!existing||existing.url!==url||process.argv.includes('--refresh'))) {
      const response = await fetch(url,{signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw Error(`PDOK ${response.status}: ${name}`);
      await writeFile(file, new Uint8Array(await response.arrayBuffer()));
      await writeFile(`${file}.json`, JSON.stringify({ url, retrievedAt: new Date().toISOString() }));
    }
    const bytes = await readFile(file), source = JSON.parse(await readFile(`${file}.json`, 'utf8'));
    if (source.url !== url) throw Error('Cached raster bounds do not match: ' + name);
    rasterSources.push({ ...source, coverage, sha256: hash(bytes) });
    const tiff = await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const image = await tiff.getImage(), raster = await image.readRasters({ interleave: true });
    const bounds = image.getBoundingBox(), resolution = image.getResolution();
    readers.set(coverage, (x: number, y: number) => {
    const col = Math.floor((x - bounds[0]) / resolution[0]);
    const row = Math.floor((bounds[3] - y) / Math.abs(resolution[1]));
    return col < 0 || row < 0 || col >= image.getWidth() || row >= image.getHeight()
      ? NaN : Number(raster[row * image.getWidth() + col]);
    });
  }
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push(lengths[i - 1] + distance(line[i], line[i - 1]));
  const total = lengths.at(-1)!;
  const stations = [];
  const count = Math.ceil(total / 1.5);
  for (let k = 0; k <= count; k++) {
    const s = k * total / count;
    let i = lengths.findIndex(value => value >= s && value > 0);
    if (i < 0) i = line.length - 1;
    const a = line[i - 1], b = line[i], length = distance(a, b);
    const t = (s - lengths[i - 1]) / length;
    const point: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const normal: Point = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    const coverage = s < 22 || s > 26 + crossingLength ? 'dtm_05m' : 'dsm_05m';
    const pixel = readers.get(coverage)!;
    const values = [];
    const onDeck=coverage==='dsm_05m'&&insideBridgeOutline(point,outline);
    for (let along = -.5; along <= .5; along += .5) for (let across = -1.5; across <= 1.5; across += .5) {
      const at:Point=[point[0] + normal[0] * across + (b[0] - a[0]) / length * along,
        point[1] + normal[1] * across + (b[1] - a[1]) / length * along];
      if(onDeck&&!insideBridgeOutline(at,outline))continue;
      const h=pixel(...at);
      // NAP can be negative in the polders. Screen absolute outliers here;
      // the relative rise and grade checks gate publication below.
      if (Number.isFinite(h) && h >= -8 && h <= 15) values.push(h);
    }
    values.sort((a, b) => a - b);
    stations.push({ s: round(s), rd: point,
      rawNAP: values.length >= 8 ? round(values[Math.floor(values.length * .3)]) : null, count: values.length, coverage });
  }
  const missing = stations.filter(p => p.rawNAP === null);
  if (missing.length > stations.length * .2 || stations[0].rawNAP === null || stations.at(-1)!.rawNAP === null)
    throw Error(`Insufficient profile coverage: ${name}, ${missing.length}/${stations.length} missing stations`);
  const measured = stations.map((p, i) => {
    if (p.rawNAP !== null) return p.rawNAP;
    const left = stations.slice(0, i).findLast(q => q.rawNAP !== null)!;
    const right = stations.slice(i + 1).find(q => q.rawNAP !== null)!;
    if (right.s - left.s > 6) throw Error('Unsupported profile gap: ' + name);
    return left.rawNAP! + (right.rawNAP! - left.rawNAP!) * (p.s - left.s) / (right.s - left.s);
  });
  // Median removes isolated objects; small smoothing preserves the measured hump/asymmetry.
  const median = measured.map((_, i) => {
    const neighbors = measured.slice(Math.max(0, i - 1), i + 2).sort((a, b) => a - b);
    return neighbors[Math.floor(neighbors.length / 2)];
  });
  const smooth = median.map((h, i) => (median[Math.max(0, i - 1)] + 2 * h + median[Math.min(median.length - 1, i + 1)]) / 4);
  const baseline = [smooth[0], smooth.at(-1)!];
  const relative = smooth.map((h, i) => {
    const s = stations[i].s;
    const ground = baseline[0] + (baseline[1] - baseline[0]) * s / total;
    // Flat game ground: explicitly model the datum blend in the outer 8m of each approach.
    const t = Math.max(0, Math.min(1, s / 8, (total - s) / 8));
    const fade = t * t * (3 - 2 * t);
    return Math.max(0, h - ground) * fade;
  });
  const origin = rdToLngLat(...deck[0]);
  const toLocal = (p: Point): Point => {
    const ll = rdToLngLat(...p);
    return [round((ll[0] - origin[0]) * 111320 * Math.cos(origin[1] * Math.PI / 180)),
      round((ll[1] - origin[1]) * 111320)];
  };
  const localOutline = outline.map(toLocal);
  const localDeck = deck.map(toLocal), deckLength = distance(localDeck[0], localDeck.at(-1)!);
  const tangent = [(localDeck.at(-1)![0] - localDeck[0][0]) / deckLength,
    (localDeck.at(-1)![1] - localDeck[0][1]) / deckLength];
  const along = localOutline.map(p => p[0] * tangent[0] + p[1] * tangent[1]);
  const across = localOutline.map(p => -p[0] * tangent[1] + p[1] * tangent[0]);
  const dx = localOutline.map(p => p[0]), dy = localOutline.map(p => p[1]);
  const width = Math.abs(outline.reduce((area, p, i) => {
    const q = outline[(i + 1) % outline.length]; return area + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2 / (Math.max(...along) - Math.min(...along));
  const result={ id: row[0], name, roadId: road.id, roadIds:candidate.roadIds, origin, outline: localOutline,
    deckRangeM: [round(24 + Math.min(...along)), round(24 + Math.max(...along))], widthM: round(width),
    roadwayRangeM: [24, round(total-24)],
    deckAxis: tangent, deckAcrossM: [round(Math.min(...across)), round(Math.max(...across))],
    approachHalfWidthM: Math.min(3.5, Math.max(2.5, width / 2)),
    family: row[3] === 'Metselwerk' ? 'masonry-arch' : row[3]==='Hout'?'wooden-deck':/beton/i.test(row[3])?'concrete-deck':'steel-deck', material: row[3],
    bridgeType:row[2],review:{status:'ready',match:candidate.match,structure:'procedural'},
    samples: stations.map((p, i) => ({ s: p.s, point: toLocal(p.rd), rawNAP: p.rawNAP,
      surfaceNAP: round(smooth[i]), heightM: round(relative[i]), validPixels: p.count, coverage: p.coverage })),
    bounds: [Math.min(...dx) - 30, Math.min(...dy) - 30, Math.max(...dx) + 30, Math.max(...dy) + 30],
    provenance: { footprint: { file: registerFile, sha256: sourceHashes[registerFile], objectNumber: row[0] },
      alignment: { file: road.source==='bridge-catalogue'?catalogFile:(road.originalSource||road.source)==='osm-all-bridge-paths'?pedestrianFile:roadsFile, sha256: sourceHashes[road.source==='bridge-catalogue'?catalogFile:(road.originalSource||road.source)==='osm-all-bridge-paths'?pedestrianFile:roadsFile], roadId: road.id, roadIds:candidate.roadIds,match:candidate.match, sources:sourceHashes },
      elevation: { rasters: rasterSources, resolutionM: .5, horizontalCRS: 'EPSG:28992',
        heightDatum: 'NAP', method: 'DSM-footprint-clipped-deck-DTM-approaches-road-corridor-q30-median3-weighted3',
        interpolatedStations: missing.length, confidence: 'raster-supported' },
      renderDatum: { method: 'linear-endpoint-baseline-with-8m-approach-blend', endpointNAP: baseline.map(round) },
      structure: { source: 'municipal material plus procedural family', confidence: 'illustrative',
        deckThicknessM: .35, archOpeningFraction: .7, railHeightM: .95 } },
  };
  validateBridgeSurfaceFile({version:1,renderHeightDatum:'local-game-ground',bridges:[result]});
  const validated=result as any;
  const maxGrade=Math.max(...validated.samples.flatMap((p:any,i:number)=>{
    const next=validated.samples[Math.min(i+1,validated.samples.length-1)];
    return[0,.25,.5,.75,1].map(t=>Math.abs(bridgeProfileAt(validated,p.s+(next.s-p.s)*t).grade));
  }));
  if(width<2||width>45||Math.max(...along)-Math.min(...along)>65||maxGrade>.22||Math.max(...relative)>4)
    throw Error('Dimensions, elevation or grade outside low canal bridge limits');
  // Material alone cannot describe a drawbridge mechanism or multiple spans.
  const geometry=preflightBridge(validated);
  result.review={...result.review,...geometry};
  bridges.push(result);entry.status='ready';
  console.log(`${name}: ${round(width)}m wide, ${round(Math.max(...relative))}m rise above approach datum`);
  }catch(error){entry.status=String(error).includes('fetch failed')||String(error).includes('TimeoutError')?'pending':'review';entry.reasons.push(String(error).replace(/^Error: /,''));console.log(`${name}: ${entry.status} — ${entry.reasons.at(-1)}`);}
}
if(!bridges.length)throw Error('No surveyed bridges built; retaining the installed surfaces');
await writeReport();
await writeFile('public/data/extracts/amsterdam/bridge-surfaces.json', JSON.stringify({
  version: 1, renderHeightDatum: 'local-game-ground', bridges,
}, null, 2) + '\n');
