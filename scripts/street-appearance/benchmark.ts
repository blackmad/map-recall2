/** Compare current profile on/off costs separately from the frozen historical worker. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { ORIGIN, type Feature } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { decorateFacade } from '../../src/canalRecall/genericFacades.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';
import { streetSegments } from '../../src/canalRecall/streetFronts.ts';
import { validateStreetAppearanceCatalog } from '../../src/canalRecall/streetAppearance.ts';
import { sha256 } from './pipeline.ts';
import { BAY_LAYER_COUNT } from '../../src/canalRecall/bayLook.ts';
import { CELL_LAYER_COUNT } from '../../src/canalRecall/facadeCells.ts';

const flag = (name: string, fallback: string) => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const oldCode = await fs.readFile(flag('baseline-worker', 'artifacts/street-appearance/baseline/bundles/three-buildings-worker.bundle.js'), 'utf8');
let captured: any;
const self: any = { postMessage: (result: any) => { captured = result.chunk; } };
vm.runInNewContext(oldCode, { self, performance, console });
let candidateCaptured: any;
const candidateSelf: any = { postMessage: (result: any) => { candidateCaptured = result.chunk; } };
const candidateWorker = flag('candidate-worker', 'public/canal-drive/js/three-buildings-worker.bundle.js');
const candidateCode=await fs.readFile(candidateWorker,'utf8');
vm.runInNewContext(candidateCode, { self: candidateSelf, performance, console });
const catalogBytes=await fs.readFile('public/data/street-appearance/profiles.json');
const catalog = validateStreetAppearanceCatalog(JSON.parse(catalogBytes.toString()));
if(!catalog.streetFrontPaths?.length)throw Error('Benchmark requires actual baked appearance street geometry');
const streets = streetSegments(catalog.streetFrontPaths, ORIGIN);
const targets = [
  { id: 'overtoom', center: [4.8687372, 52.3608814], tile: '8413/5385' },
  { id: 'de-wallen', center: [4.8979412, 52.3713544], tile: '8414/5384' },
  { id: 'marcantilaan', center: [4.86853, 52.37534], tile: '8413/5384' },
];
const results: any[] = [], rounds = Number(flag('rounds', '21'));
for (const target of targets) {
  const tile = JSON.parse(gunzipSync(await fs.readFile(`public/data/extracts/amsterdam/building-tiles/14/${target.tile}.geojson.gz`)).toString());
  const facts = JSON.parse(gunzipSync(await fs.readFile(`public/data/extracts/amsterdam/building-facts/14/${target.tile}.json.gz`)).toString());
  const distance = (f: Feature) => {
    const ring = (f.geometry as any).coordinates[0];
    const point = Array.isArray(ring[0][0]) ? ring[0][0] : ring[0];
    return Math.hypot((point[0] - target.center[0]) * 68000, (point[1] - target.center[1]) * 110540);
  };
  const features: Feature[] = tile.features.sort((a: Feature, b: Feature) => distance(a) - distance(b)).slice(0, 128).map((f: Feature) => {
    const row = facts.buildings[shortBuildingId(String(f.properties.id))];
    // Cached survey footprints lack the live stream's identity-palette marker.
    // Without it decorateFacade deliberately leaves them bare, which would
    // benchmark empty profile work rather than the detailed game renderer.
    return decorateFacade({ ...f, properties: { ...f.properties, appearanceStyleSource: 'citywide-identity-palette-v3-not-measured', ...(row ? { constructionYear: row[0] } : {}) } });
  });
  for (const look of ['photo', 'storybook', 'cartoon', 'procedural'] as const) for (const mode of ['walls', 'extras'] as const) {
    const before = () => { captured=undefined;self.onmessage({ data: { key: 'benchmark', gen: 1, look, mode, features, streets } }); return captured; };
    const currentOff = () => { candidateCaptured=undefined;candidateSelf.onmessage({ data: { key: 'benchmark', gen: 1, look, mode, features, streets, profiles: [], appearanceRevision: 'empty' } }); return candidateCaptured; };
    const after = () => { candidateCaptured=undefined;candidateSelf.onmessage({ data: { key: 'benchmark', gen: 1, look, mode, features, streets, profiles: catalog.profiles, appearanceRevision: catalog.revision } }); return candidateCaptured; };
    const times = { before: [] as number[], currentOff: [] as number[], after: [] as number[] };
    let oldChunk: any, newChunk: any, unprofiled: any;
    for (let i = 0; i < rounds + 5; i++) {
      // Rotate all three orders to reduce GC/temperature drift; discard warmup.
      const series=['before','currentOff','after'] as const;
      for (const which of [...series.slice(i%3),...series.slice(0,i%3)]) {
        const start = performance.now(), chunk = which === 'before' ? before() : which==='currentOff'?currentOff():after();
        if(!chunk)throw Error(`Worker did not return chunk: ${target.id}/${look}/${mode}/${which}`);
        if (i >= 5) times[which].push(performance.now() - start);
        if (which === 'before') oldChunk = chunk; else if(which==='after')newChunk = chunk;
        if(which==='currentOff')unprofiled=chunk;
      }
    }
    const median = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
    const beforeMs = median(times.before), currentOffMs=median(times.currentOff), afterMs = median(times.after);
    const iqr=(v:number[])=>[v[Math.floor(v.length*.25)],v[Math.floor(v.length*.75)]];
    const profileChangedBuildings = newChunk.ranges.filter((range: any) => {
      const other = unprofiled.ranges.find((r: any) => r.id === range.id);
      return !other || range.count !== other.count ||
        !Buffer.from(newChunk.tints.slice(range.start * 4, (range.start + range.count) * 4).buffer).equals(Buffer.from(unprofiled.tints.slice(other.start * 4, (other.start + other.count) * 4).buffer)) ||
        !Buffer.from(newChunk.layers.slice(range.start, range.start + range.count).buffer).equals(Buffer.from(unprofiled.layers.slice(other.start, other.start + other.count).buffer));
    }).length;
    if (mode === 'walls' && !profileChangedBuildings) throw Error(`Benchmark failed to exercise street profiles: ${target.id}/${look}`);
    results.push({ target: target.id, look, mode, buildings: features.length, beforeMs, currentOffMs, afterMs,beforeIqrMs:iqr(times.before),currentOffIqrMs:iqr(times.currentOff),afterIqrMs:iqr(times.after), ratio: afterMs / beforeMs, currentProfileRatio:afterMs/currentOffMs, beforeVertices: oldChunk.vertexCount, currentOffVertices:unprofiled.vertexCount, afterVertices: newChunk.vertexCount,
      profileChangedBuildings,
      appearanceChanged: !Buffer.from(oldChunk.tints.buffer).equals(Buffer.from(newChunk.tints.buffer)) || !Buffer.from(oldChunk.layers.buffer).equals(Buffer.from(newChunk.layers.buffer)) });
  }
}
const totalRatio=(selected:any[])=>selected.reduce((sum,r)=>sum+r.afterMs,0)/selected.reduce((sum,r)=>sum+r.currentOffMs,0);
const summary={currentProfileWeightedRatio:totalRatio(results),wallsCurrentProfileWeightedRatio:totalRatio(results.filter(r=>r.mode==='walls')),extrasCurrentProfileWeightedRatio:totalRatio(results.filter(r=>r.mode==='extras')),casesOver10Percent:results.filter(r=>r.currentProfileRatio>1.1).map(r=>`${r.target}/${r.look}/${r.mode}`)};
const report = { version: 2, profileRevision: catalog.revision,catalogSha256:sha256(catalogBytes),candidateWorker,candidateWorkerSha256:sha256(candidateCode),baselineWorkerSha256:sha256(oldCode), rounds,streetSegments:streets.length/4,atlasLayers:{bay:BAY_LAYER_COUNT,procedural:CELL_LAYER_COUNT+4+BAY_LAYER_COUNT},summary,results,
  limits: 'CPU chunk compilation microbenchmark using the same detailed decorated city footprints and actual baked appearance street graph for all three series. currentProfileRatio compares current worker with profiles enabled versus disabled; ratio separately compares the frozen historical worker. This excludes startup, worker transfer, textures and GPU frame timing; passing CPU checks alone does not establish overall rendering performance.' };
const output = flag('output', 'artifacts/street-appearance/compilation-benchmark.json');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(results.map(r => ({ target: r.target, look: r.look, mode: r.mode, historicalRatio: +r.ratio.toFixed(3), currentProfileRatio:+r.currentProfileRatio.toFixed(3), vertices: r.afterVertices - r.currentOffVertices })), null, 2));
