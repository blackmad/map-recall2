/**
 * Recipe tile compiler (migration step 3, docs/plans/digital-twin-direction-20261013.md §2; schema and decisions in
 * docs/buildings-pipeline.md "Recipe tiles").
 *
 *   node --import tsx scripts/building-tiles/compile-recipes.ts --stage=recipes            # authoring → building-recipes/14/x/y.json
 *   node --import tsx scripts/building-tiles/compile-recipes.ts --stage=mesh --tile=16/x/y # one z16 tile (one process)
 *   node --import tsx scripts/building-tiles/compile-recipes.ts --stage=mesh --all [--jobs=6]
 *   node --import tsx scripts/building-tiles/compile-recipes.ts --stage=assemble           # fitted → recipe tiles, index.json, summary
 *   node --import tsx scripts/building-tiles/compile-recipes.ts --stage=all [--jobs=6]
 *   node --import tsx scripts/building-tiles/compile-recipes.ts --stage=review --before=<out> [--out=<out>]
 *
 * Output (staging, never published by this script): artifacts/recipe-tiles/ (or --out=)
 *   building-recipes/14/x/y.json   building-mesh/16/x/y.glb   units/<hash>.glb   reports/16/x/y.json   index.json   summary.json
 *   review/index.html              (review stage: only the pands whose triangle hash or gate numbers changed)
 *
 * Pilot (defaults; --faces=, --houses=, --models= override): Bilderdijkstraat block faces, the Bilderdijkstraat house
 * recipes no face covers, every `kind: large` house recipe, every building-types instance (Nieuw-West), ten landmarks.
 * Faces with `continuity.crownFromPhoto` need their strip photos (staging/block-face/<face>/strip.jpg or
 * BLOCK_FACE_SOURCE_PACK, defaulting to the map-recall2-source-data archive).
 */
import fs from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

process.env.BLOCK_FACE_SOURCE_PACK ??= '/Users/blackmad/Code/map-recall2-source-data/models';

const {compileBlockFace} = await import('../../src/canalRecall/blockFace/compile.ts');
const {validateBlockFace, houseIntents} = await import('../../src/canalRecall/blockFace/intent.ts');
const {compileChunk, groupBlockFaces} = await import('../../src/canalRecall/streetChunks/index.ts');
const {compileBuilding} = await import('../../src/canalRecall/buildingRecipe/compile.ts');
const {fitIntent} = await import('../../src/canalRecall/buildingRecipe/fit.ts');
const {evaluateGates} = await import('../../src/canalRecall/buildingRecipe/gates.ts');
const {evaluateLargeGates} = await import('../../src/canalRecall/buildingRecipe/largeGates.ts');
const {validateLargeIntent} = await import('../../src/canalRecall/buildingRecipe/largeIntent.ts');
const {groupToBuckets} = await import('../../src/canalRecall/streetChunks/soup.ts');
const {rdToLngLat} = await import('../../src/canalRecall/facade/rdNew.ts');
const {GAME_BUILDING_MODELS} = await import('../../src/canalRecall/landmarks/browser.ts');
const {geometryAudit} = await import('../../src/canalRecall/landmarks/geometryAudit.ts');
const {canalhouseGroupToGlb} = await import('../canalhouse-recipes/export-glb.ts');
const {loadIntent, slotFor, decodeTriangles, HOUSES} = await import('../building-recipes/compile.ts');
const schema = await import('../../src/canalRecall/tileBuildings/schema.ts');
const tiles = await import('../../src/canalRecall/tileBuildings/tiles.ts');
const soup = await import('../../src/canalRecall/tileBuildings/soup.ts');
const writer = await import('../../src/canalRecall/tileBuildings/writeTile.ts');
const reader = await import('../../src/canalRecall/tileBuildings/readTile.ts');
const placement = await import('../../src/canalRecall/tileBuildings/placement.ts');
const {yawOf} = await import('../../src/canalRecall/buildingTypes/runtime.ts');

type BucketMap = import('../../src/canalRecall/tileBuildings/soup.ts').BucketMap;
type PandRecipe = import('../../src/canalRecall/tileBuildings/schema.ts').PandRecipe;
type RecipeTile = import('../../src/canalRecall/tileBuildings/schema.ts').RecipeTile;
type PartRole = import('../../src/canalRecall/tileBuildings/schema.ts').PartRole;
type Mat4 = number[];

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg('out') ?? 'artifacts/recipe-tiles';
const FACES_DIR = 'scripts/block-face/faces', PUBLIC = 'public/canal-drive';
const PILOT = {
  faces: (arg('faces') ?? 'bilder-').split(','),
  houses: (arg('houses') ?? 'bilder-').split(','),
  models: (arg('models') ?? 'westerkerk,anne-frank-house,palace-on-the-dam,nieuwe-kerk,national-monument-on-the-dam,magna-plaza,rijksmuseum,de-hallen,hoofdbureau-elandsgracht,huis-bartolotti').split(',').filter(Boolean),
  types: arg('types') !== '0',
};
/** A repeated part becomes an instanced unit only if it saves at least this many triangles in its tile (a draw call is not free). */
const INSTANCE_MIN_SAVED_TRIANGLES = Number(arg('min-saved') ?? 1000);
/** Bumped when the unit conversion changes, so content-addressed units of installed GLBs are rebuilt. */
const CONVERTER_VERSION = 'unit-v3';

const readJson = async (f: string) => JSON.parse(await fs.readFile(f, 'utf8'));
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const short = (p: string) => p.replace(/^NL\.IMBAG\.Pand\./, '');
const full = (p: string) => (/^\d{16}$/.test(p) ? `NL.IMBAG.Pand.${p}` : p);
const r3 = (v: number) => Math.round(v * 1000) / 1000;
async function writeFileMkdir(file: string, data: string | Uint8Array) { await fs.mkdir(path.dirname(file), {recursive: true}); await fs.writeFile(file, data); }

// ---------------------------------------------------------------------------------------------------------------
// Inputs

const centroidLngLat = (facts: any): [number, number] => {
  const ring = facts.bagFootprintRD[0], n = ring.length - (ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? 1 : 0);
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  const ll = rdToLngLat({x: x / n, y: y / n});
  return [ll[0], ll[1]];
};
const meanLngLat = (pts: [number, number][]): [number, number] => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

async function loadFace(faceId: string) {
  const dir = path.join(FACES_DIR, faceId), discovery = await readJson(path.join(dir, 'discovery.json'));
  const face = validateBlockFace(await readJson(path.join(dir, 'intent.json')), discovery.members);
  const facts = new Map<string, any>();
  for (const h of face.houses) facts.set(h.pandId, await readJson(path.join(dir, 'pands', h.pandId, 'facts.json')));
  return {face, facts, dir};
}

const sidecarCache = new Map<string, any>();
function sidecarMid(pand: string, at: [number, number]): number[] {
  const t = tiles.tileOf(at[0], at[1], 14), file = `public/data/extracts/amsterdam/bag-facts/14/${t.x}/${t.y}.json.gz`;
  if (!sidecarCache.has(file)) sidecarCache.set(file, existsSync(file) ? JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) : null);
  return sidecarCache.get(file)?.pands?.[pand] ?? [0, 1, 0, 0, 0, 0, 0];
}
const baysOf = (b: number | number[] | undefined) => (Array.isArray(b) ? Math.max(...b) : b ?? 0);
function canalMid(pand: string, at: [number, number], intent: any): PandRecipe['mid'] {
  const f = intent.fronts[0];
  return [...sidecarMid(pand, at), baysOf(f.bays), schema.wallCode(intent.palette?.wallMaterial === 'stucco' ? 'stucco' : 'brick'), schema.gableCode(f.gable), f.shopfront ? 1 : 0] as PandRecipe['mid'];
}
function largeMid(pand: string, at: [number, number], intent: any): PandRecipe['mid'] {
  const bays = Math.max(0, ...intent.walls.map((w: any) => w.baysPerStorey ?? 0)), shop = intent.walls.some((w: any) => w.ground === 'plinth-shopfronts' || w.system === 'plinth-shopfronts') ? 1 : 0;
  return [...sidecarMid(pand, at), bays, schema.wallCode(intent.palette?.wallMaterial === 'stucco' ? 'stucco' : 'brick'), 0, shop] as PandRecipe['mid'];
}
const plainMid = (pand: string, at: [number, number], wall: 'brick' | null = null): PandRecipe['mid'] => [...sidecarMid(pand, at), 0, schema.wallCode(wall), 0, 0] as PandRecipe['mid'];

interface Entry { key: string; recipe: Omit<PandRecipe, 'mesh'>; anchor: [number, number]; group: string }

/** Stage 1: every authoring source of the pilot → entries (pand → recipe), grouped atomically (a face, a chunk, a model). */
async function collectEntries(): Promise<{entries: Entry[]; sources: Record<string, string>}> {
  const entries: Entry[] = [], seen = new Map<string, string>(), sources: Record<string, string> = {};
  const add = (e: Entry) => {
    if (seen.has(e.key)) { console.warn(`  ${e.key}: already ${seen.get(e.key)}; ${e.recipe.intent ?? e.recipe.sameAs} skipped`); return; }
    seen.set(e.key, e.recipe.intent ?? `sameAs ${e.recipe.sameAs}`); entries.push(e);
  };
  // Block faces.
  const faceIds = (await fs.readdir(FACES_DIR)).filter(f => PILOT.faces.some(p => f.startsWith(p))).sort();
  const facePands = new Set<string>(), faceHash = createHash('sha256');
  for (const faceId of faceIds) {
    const {face, facts} = await loadFace(faceId);
    faceHash.update(JSON.stringify(face));
    const intents = houseIntents(face), anchors = face.houses.map(h => centroidLngLat(facts.get(h.pandId)));
    const group = `face:${faceId}`, groupAnchor = meanLngLat(anchors);
    face.houses.forEach((h, i) => {
      facePands.add(h.pandId);
      const common = {kind: 'canal-house' as const, mid: canalMid(h.pandId, anchors[i], intents[i]), covers: [full(h.pandId)]};
      const recipe = h.sameAs ? {...common, sameAs: h.sameAs, ...(h.overrides ? {overrides: h.overrides as Record<string, unknown>} : {})} : {...common, intent: `face:${faceId}/${i}`};
      add({key: h.pandId, recipe, anchor: groupAnchor, group});
    });
  }
  sources.faces = faceHash.digest('hex').slice(0, 16);
  // House recipes: canal houses no face covers (grouped into chunks like scripts/street-chunks/build.ts), and every large one.
  const houseHash = createHash('sha256'), canal: {id: string; intent: any; facts: any}[] = [];
  for (const id of (await fs.readdir(HOUSES)).sort()) {
    const file = path.join(HOUSES, id, 'intent.json');
    if (!existsSync(file) || !existsSync(path.join(HOUSES, id, 'facts.json'))) continue;
    const raw = await readJson(file);
    if (raw.kind === 'large') {
      const intent = validateLargeIntent(raw), facts = await readJson(path.join(HOUSES, id, 'facts.json')), at = centroidLngLat(facts);
      houseHash.update(JSON.stringify(raw));
      add({key: intent.pandId, recipe: {kind: 'large', intent: `house:${id}`, mid: largeMid(intent.pandId, at, intent), covers: [full(intent.pandId)]}, anchor: at, group: `house:${id}`});
    } else if (PILOT.houses.some(p => id.startsWith(p)) && /\d$/.test(id)) {
      const {intent} = await loadIntent(id);
      if (facePands.has(intent.pandId)) continue;
      houseHash.update(JSON.stringify(raw));
      canal.push({id, intent, facts: await readJson(path.join(HOUSES, id, 'facts.json'))});
    }
  }
  for (const g of groupBlockFaces(canal)) {
    const anchors = g.map(h => centroidLngLat(h.facts)), group = `chunk:${g.map(h => h.id).sort().join('+')}`;
    g.forEach((h, i) => add({key: h.intent.pandId, recipe: {kind: 'canal-house', intent: `house:${h.id}`, mid: canalMid(h.intent.pandId, anchors[i], h.intent), covers: [full(h.intent.pandId)]}, anchor: meanLngLat(anchors), group}));
  }
  sources.houses = houseHash.digest('hex').slice(0, 16);
  // Building types.
  if (PILOT.types) {
    const raw = await fs.readFile(`${PUBLIC}/building-types/instances.json`, 'utf8'), list = JSON.parse(raw);
    sources.types = sha(raw).slice(0, 16);
    for (const inst of list) add({key: inst.pand, recipe: {kind: 'type', intent: `type:${inst.unit}`, mid: plainMid(inst.pand, inst.anchor, /brick/.test(inst.variant) ? 'brick' : null), covers: [full(inst.pand)]}, anchor: inst.anchor, group: `type:${inst.pand}`});
  }
  // Landmarks / installed models as kind glb.
  const covers = await readJson(`${PUBLIC}/models/covers.json`), modelHash = createHash('sha256');
  for (const id of PILOT.models) {
    const spec: any = (GAME_BUILDING_MODELS as any[]).find(m => m.id === id);
    if (!spec) { console.warn(`  model ${id}: not in GAME_BUILDING_MODELS`); continue; }
    const c = covers.models[id] ?? {p: [], o: spec.suppressOsmIds ?? []};
    const pands = [...c.p, ...(c.o ?? []).filter((o: string) => o.startsWith('NL.IMBAG.Pand.')).map(short)];
    const key = pands[0] ?? `m:${id}`, at = (spec.surveyed?.anchor ?? spec.footprint?.centre) as [number, number];
    modelHash.update(`${id}:${spec.modelUrl}`);
    add({key, recipe: {kind: 'glb', intent: `model:${id}`, mid: plainMid(pands[0] ?? '', at), covers: [...new Set([...c.p.map(full), ...(c.o ?? [])])]}, anchor: at, group: `model:${id}`});
  }
  sources.models = modelHash.digest('hex').slice(0, 16);
  return {entries, sources};
}

async function stageRecipes() {
  const {entries, sources} = await collectEntries();
  const byTile = new Map<string, RecipeTile>();
  for (const e of entries) {
    const t16 = tiles.tileOf(e.anchor[0], e.anchor[1], 16), t14 = tiles.parentAt(t16, 14), id = tiles.tileId(t14);
    if (!byTile.has(id)) byTile.set(id, {version: 1, z: 14, x: t14.x, y: t14.y, sources, pands: {}});
    byTile.get(id)!.pands[e.key] = {...e.recipe, mesh: [t16.x, t16.y]} as PandRecipe;
  }
  await fs.rm(path.join(OUT, 'building-recipes'), {recursive: true, force: true});
  for (const [id, tile] of byTile) {
    schema.validateRecipeTile(tile);
    await writeFileMkdir(path.join(OUT, 'building-recipes', `${id}.json`), schema.stableJson(tile, 1) + '\n');
  }
  const meshTiles = new Set(entries.map(e => tiles.tileId(tiles.tileOf(e.anchor[0], e.anchor[1], 16))));
  console.log(`recipes: ${entries.length} pands in ${byTile.size} z14 recipe tiles, ${meshTiles.size} z16 mesh tiles (${Object.entries(countBy(entries.map(e => e.recipe.kind))).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  return [...meshTiles].sort();
}
const countBy = (v: string[]) => v.reduce<Record<string, number>>((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});

async function readRecipeTiles(): Promise<RecipeTile[]> {
  const dir = path.join(OUT, 'building-recipes/14'), out: RecipeTile[] = [];
  for (const x of await fs.readdir(dir)) for (const f of await fs.readdir(path.join(dir, x))) out.push(schema.validateRecipeTile(await readJson(path.join(dir, x, f))));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Mesh stage: one z16 tile

interface PandSource {
  key: string; recipe: PandRecipe; name: string;
  /** Recipe kinds: buckets in the source frame, the source → tile matrix, and the split context. */
  buckets?: BucketMap; toTile?: Mat4; split?: {groundTopM: number; eavesM: number} | null;
  /** Placed kinds: unit + matrix. */
  unit?: {hash: string; file: string; bounds: {min: number[]; max: number[]}; triangles: number}; matrix?: Mat4;
  gates: Record<string, unknown>; failed: string[];
  fitted: NonNullable<PandRecipe['fitted']>;
  specs: string[];
}

const chunkManifest = () => readJson(`${PUBLIC}/ordinary-buildings-data/chunks.json`);
const catalogue = () => readJson(`${PUBLIC}/ordinary-buildings-data/catalogue.json`);

/** Chunk/catalogue spec ids the landmark loader would draw for a pand (the near tier replaces them while resident). */
function specsForPand(pand: string, manifest: any, cat: any): string[] {
  const out = [`ordinary-${pand}`].filter(id => cat.models.some((m: any) => m.id === id));
  for (const c of manifest.chunks) if (c.suppress.includes(full(pand))) out.push(c.id);
  return out;
}

/** Bounds as three.js `Box3.setFromObject` computes them on the loaded scene: each mesh's local box, corners through its world matrix. */
async function loaderBounds(bytes: Uint8Array): Promise<{min: number[]; max: number[]}> {
  const doc = await (await writer.tileIO()).readBinary(bytes), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = Array.from(node.getWorldMatrix()), lmin = [Infinity, Infinity, Infinity], lmax = [-Infinity, -Infinity, -Infinity], p: number[] = [];
    const inst = node.getExtension('EXT_mesh_gpu_instancing');
    if (inst) throw Error('instanced landmark GLB: bounds not supported');
    for (const prim of mesh.listPrimitives()) { const a = prim.getAttribute('POSITION')!; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, p); for (let k = 0; k < 3; k++) { lmin[k] = Math.min(lmin[k], p[k]); lmax[k] = Math.max(lmax[k], p[k]); } } }
    for (const cx of [lmin[0], lmax[0]]) for (const cy of [lmin[1], lmax[1]]) for (const cz of [lmin[2], lmax[2]]) {
      const q = soup.apply(w, cx, cy, cz);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
    }
  }
  return {min, max};
}

async function ensureUnit(hash: string, make: () => Promise<{bytes: Uint8Array}>): Promise<string> {
  const file = path.join(OUT, 'units', `${hash}.glb`);
  if (!existsSync(file)) { const {bytes} = await make(); await writeFileMkdir(file + `.${process.pid}.tmp`, bytes); await fs.rename(file + `.${process.pid}.tmp`, file); }
  return file;
}

async function glbUnit(sourceFile: string, extras: Record<string, unknown>) {
  const bytes = new Uint8Array(await fs.readFile(sourceFile)), hash = 'g' + sha(Buffer.concat([Buffer.from(CONVERTER_VERSION), bytes])).slice(0, 15);
  const file = await ensureUnit(hash, async () => {
    const r = await writer.convertGlbUnit(bytes, {hash, ...extras});
    await writeFileMkdir(path.join(OUT, 'units', `${hash}.report.json`), JSON.stringify(r.report) + '\n');
    return r;
  });
  // The conversion report lives beside the unit, so a cached unit reports the same numbers (review diffs stay quiet).
  const report = await readJson(path.join(OUT, 'units', `${hash}.report.json`)).catch(() => null);
  const decoded = await reader.decodeUnit(new Uint8Array(await fs.readFile(file)));
  const bounds = writer.boundsOf(decoded.flatMap(t => t.p));
  return {hash, file, bounds, triangles: decoded.length, report, sourceBytes: bytes};
}

const auditCounts = (b: BucketMap) => {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [], materials: any[] = [];
  for (const x of b.values()) {
    const mi = materials.push({name: x.key, rgb: [0, 0, 0], slot: x.slot, materialSlot: x.slot, tint: x.tint}) - 1;
    for (let v = 0; v < x.positions.length / 3; v++) { indices.push(positions.length / 3); positions.push(x.positions[v * 3], x.positions[v * 3 + 1], x.positions[v * 3 + 2]); }
    for (let t = 0; t < x.positions.length / 9; t++) triMaterial.push(mi);
  }
  const r = geometryAudit({positions, indices, triMaterial, materials}, {skipRhythm: true});
  return {'zfight-m2': r.counts['zfight-m2'], 'opening-floating-fail': r.counts['opening-floating-fail'], 'opening-overhang-fail': r.counts['opening-overhang-fail'], 'opening-buried': r.counts['opening-buried']};
};

async function stageMeshTile(tileArg: string) {
  const t0 = performance.now();
  const T = tiles.parseTileId(tileArg), frame = tiles.tileFrame(T), t14 = tiles.parentAt(T, 14);
  const recipeFile = path.join(OUT, 'building-recipes', `14/${t14.x}/${t14.y}.json`);
  const recipeTile = schema.validateRecipeTile(await readJson(recipeFile));
  const mine = Object.entries(recipeTile.pands).filter(([, p]) => p.mesh[0] === T.x && p.mesh[1] === T.y);
  if (!mine.length) throw Error(`${tileArg}: no pands`);
  const manifest = await chunkManifest(), cat = await catalogue();
  const sources: PandSource[] = [];
  const timings: Record<string, number> = {};
  const tick = (k: string, s: number) => { timings[k] = Math.round((timings[k] ?? 0) + performance.now() - s); };
  const base = (key: string, recipe: PandRecipe, name: string): PandSource => ({key, recipe, name, gates: {}, failed: [], fitted: {}, specs: []});

  // --- faces (all houses of a face are in this tile: groups are atomic)
  const faceOf = (p: PandRecipe, key: string): string | null => {
    if (p.intent?.startsWith('face:')) return p.intent.slice(5).split('/')[0];
    if (p.sameAs) { const t = recipeTile.pands[p.sameAs]; return t?.intent?.startsWith('face:') ? t.intent.slice(5).split('/')[0] : null; }
    return null;
  };
  const faces = [...new Set(mine.map(([k, p]) => faceOf(p, k)).filter((f): f is string => !!f))].sort();
  const installedMatch: Record<string, boolean | null> = {};
  for (const faceId of faces) {
    let s = performance.now();
    const {face, facts} = await loadFace(faceId);
    let strip: any, photoGables: any;
    if (face.continuity.measuredEaves?.length || face.continuity.crownFromPhoto?.length) { const st = await readJson(path.join(FACES_DIR, faceId, 'strip.json')); strip = {heightPx: st.height, pixelsPerMetre: st.pixelsPerMetre, groundNAP: st.groundNAP}; }
    if (face.continuity.crownFromPhoto?.length) photoGables = await (await import('../block-face/gable-from-photo.ts')).photoReadings(faceId);
    const result = await compileBlockFace(face, facts, `face-${faceId}`, {strip, photoGables});
    tick('compileFaces', s); s = performance.now();
    const installed = `${PUBLIC}/models/ordinary-buildings/chunks/chunk-face-${faceId}.glb`;
    installedMatch[faceId] = existsSync(installed) ? Buffer.compare(await fs.readFile(installed), Buffer.from(result.chunk.glb)) === 0 : null;
    const {pands, minY} = await reader.chunkPandBuckets(result.chunk.glb, result.chunk.pands.length);
    const toTile = placement.tileFromModel(placement.surveyedSpec(faceId, result.chunk.frame.anchor, result.chunk.frame.northOffsetDegrees), {min: [0, minY, 0], max: [0, 0, 0]}, frame);
    result.chunk.pands.forEach((pm, i) => {
      const entry = recipeTile.pands[pm.pandId];
      if (!entry) throw Error(`${faceId}: ${pm.pandId} has no recipe entry`);
      const per = result.perPand.find(p => p.pand === pm.pandId)!, src = base(pm.pandId, entry, pm.address);
      src.buckets = pands[i]; src.toTile = toTile;
      src.split = {groundTopM: per.storeyHeightsM[0], eavesM: per.eavesM};
      src.fitted = {eavesM: per.eavesM, storeyHeightsM: per.storeyHeightsM, frontWidthM: per.fronts[0]?.widthM, roofMaxM: per.roofMaxM, groundShiftM: pm.groundShiftM};
      for (const g of result.gates.filter(g => g.pand === pm.pandId.slice(-6))) { src.gates[g.id] = g.value; if (!g.pass) src.failed.push(g.id); }
      for (const x of result.interference.filter(x => x.left === pm.pandId || x.right === pm.pandId)) {
        const side = x.left === pm.pandId ? 'right' : 'left';
        src.gates[`interference-${side}`] = {gap: x.frontGapM, zFight: x.zFightM2, roofZFight: x.roofZFightM2, cornice: x.corniceVerdict};
        if (!x.pass) src.failed.push(`interference-${side}`);
      }
      src.specs = [`chunk-face-${faceId}`, ...specsForPand(pm.pandId, manifest, cat)];
      sources.push(src);
    });
    tick('decodeFaces', s);
  }

  // --- house recipes: canal houses (as chunks, like street-chunks/build.ts) and large
  const houseCanal = mine.filter(([, p]) => p.kind === 'canal-house' && p.intent?.startsWith('house:'));
  const byGroup = new Map<string, {id: string; intent: any; facts: any}[]>();
  if (houseCanal.length) {
    const inputs = [];
    for (const [, p] of houseCanal) { const id = p.intent!.slice(6), {intent} = await loadIntent(id); inputs.push({id, intent, facts: await readJson(path.join(HOUSES, id, 'facts.json'))}); }
    for (const g of groupBlockFaces(inputs)) byGroup.set(g.map(h => h.id).join('+'), g);
  }
  for (const g of byGroup.values()) {
    let s = performance.now();
    const name = `bilder-${g.map(h => h.intent.pandId.slice(-6)).sort()[0]}-x${g.length}`;
    const result = await compileChunk(g, {name});
    const {pands, minY} = await reader.chunkPandBuckets(result.glb, result.pands.length);
    const toTile = placement.tileFromModel(placement.surveyedSpec(name, result.frame.anchor, result.frame.northOffsetDegrees), {min: [0, minY, 0], max: [0, 0, 0]}, frame);
    const installed = `${PUBLIC}/models/ordinary-buildings/chunks/chunk-${name}.glb`;
    installedMatch[name] = existsSync(installed) ? Buffer.compare(await fs.readFile(installed), Buffer.from(result.glb)) === 0 : null;
    for (const [i, pm] of result.pands.entries()) {
      const h = g.find(x => x.intent.pandId === pm.pandId)!, src = base(pm.pandId, recipeTile.pands[pm.pandId], pm.address);
      const fit = fitIntent(h.intent, h.facts), f0 = fit.report.fronts[0];
      src.buckets = pands[i]; src.toTile = toTile; src.split = {groundTopM: f0.storeyHeightsM[0], eavesM: pm.eavesM};
      src.fitted = {eavesM: pm.eavesM, storeyHeightsM: f0.storeyHeightsM, frontWidthM: f0.widthM, groundShiftM: pm.groundShiftM};
      // Per-house gates (buildingRecipe/gates.ts) on the house compiled alone, as scripts/building-recipes/compile.ts does.
      const built = compileBuilding(h.intent, h.facts), glb = await canalhouseGroupToGlb(h.id, built.group, {metreUvs: true, slotFor: slotFor(h.intent)});
      const {gates} = evaluateGates(await decodeTriangles(glb.bytes), built.facts, built.fit, built.recipe.footprint.value.map((p: any) => p.outer), built.anchorRD);
      for (const gt of gates) { src.gates[gt.id] = gt.value; if (!gt.pass) src.failed.push(gt.id); }
      src.specs = specsForPand(pm.pandId, manifest, cat);
      sources.push(src);
    }
    tick('compileHouses', s);
  }
  for (const [key, p] of mine.filter(([, p]) => p.kind === 'large')) {
    const s = performance.now(), id = p.intent!.slice(6);
    const intent = validateLargeIntent(await readJson(path.join(HOUSES, id, 'intent.json'))), facts = await readJson(path.join(HOUSES, id, 'facts.json'));
    const built: any = compileBuilding(intent, facts);
    const buckets = groupToBuckets(built.group, new (await import('three')).Matrix4(), (m: any) => m.userData.materialSlot as string);
    const ys = [...buckets.values()].flatMap(b => b.positions.filter((_, i) => i % 3 === 1)), minY = Math.min(...ys);
    const ll = rdToLngLat({x: built.anchorRD[0], y: built.anchorRD[1]});
    const src = base(key, p, intent.address);
    src.buckets = buckets; src.split = null;
    src.toTile = placement.tileFromModel(placement.surveyedSpec(id, [ll[0], ll[1]], 0), {min: [0, minY, 0], max: [0, 0, 0]}, frame);
    const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: (m: any) => m.userData.materialSlot as string, maxBytes: 2_000_000});
    const {gates} = evaluateLargeGates(await decodeTriangles(glb.bytes), built);
    for (const gt of gates) { src.gates[gt.id] = gt.value; if (!gt.pass) src.failed.push(gt.id); }
    src.fitted = {roofMaxM: r3(Math.max(...ys) - minY)};
    src.specs = specsForPand(key, manifest, cat);
    sources.push(src);
    tick('compileLarge', s);
  }

  // --- types (units straight from the building-types GLBs; placement as buildingTypes/runtime.ts instanceMatrix)
  const typeEntries = mine.filter(([, p]) => p.kind === 'type');
  if (typeEntries.length) {
    const s = performance.now(), list = await readJson(`${PUBLIC}/building-types/instances.json`), byPand = new Map(list.map((i: any) => [i.pand, i]));
    const units = new Map<string, Awaited<ReturnType<typeof glbUnit>>>();
    for (const [key, p] of typeEntries) {
      const inst: any = byPand.get(key), unitName = p.intent!.slice(5);
      if (!units.has(unitName)) units.set(unitName, await glbUnit(`${PUBLIC}/building-types/${unitName}.glb`, {kind: 'type', source: unitName}));
      const u = units.get(unitName)!, [e, so] = tiles.toFrame(frame, inst.anchor[0], inst.anchor[1]);
      const src = base(key, p, unitName.split('__')[0]);
      src.unit = u; src.matrix = soup.mul(soup.mul(soup.translation(e, inst.groundAltitudeMetres, so), soup.rotationY(yawOf(inst.northOffsetDegrees))), soup.scaling(inst.scale[0], inst.scale[1], inst.scale[2]));
      src.fitted = {placement: {anchor: inst.anchor, yawDeg: r3(yawOf(inst.northOffsetDegrees) * 180 / Math.PI), scale: inst.scale}};
      src.specs = [];
      sources.push(src);
    }
    tick('types', s);
  }

  // --- installed models as kind glb (placement baked exactly as the landmark loader computes it)
  for (const [key, p] of mine.filter(([, p]) => p.kind === 'glb')) {
    const s = performance.now(), id = p.intent!.slice(6), spec: any = (GAME_BUILDING_MODELS as any[]).find(m => m.id === id);
    const file = path.join(PUBLIC, spec.modelUrl.replace(/^\.\//, '').replace(/\?.*$/, ''));
    const u = await glbUnit(file, {kind: 'glb', source: id});
    const bounds = await loaderBounds(u.sourceBytes);
    const src = base(key, p, spec.name ?? id);
    src.unit = u; src.matrix = placement.tileFromModel(spec, bounds, frame);
    const pl = (await import('../../src/canalRecall/landmarks/signaturePlacement.ts')).placementFor(spec, bounds);
    src.fitted = {placement: {anchor: [pl.anchor[0], pl.anchor[1]], yawDeg: r3(pl.modelRotationDegrees), scale: [pl.scale, pl.scale, pl.scale], ...(pl.mirror ? {mirror: true} : {})}};
    if (u.report) src.gates.unitConversion = {passthrough: u.report.passthrough.length, inferredSlots: u.report.inferred, cityTriangles: u.report.cityTriangles, triangles: u.report.triangles};
    src.specs = [id];
    sources.push(src);
    tick('models', s);
  }

  // --- split, hash, decide instancing
  let s = performance.now();
  sources.sort((a, b) => (a.key < b.key ? -1 : 1));
  const pandIndex = new Map(sources.map((x, i) => [x.key, i]));
  interface Part { pand: number; role: PartRole; buckets: BucketMap; hash: string; origin: [number, number, number]; toTile: Mat4; triangles: number }
  const parts: Part[] = [];
  for (const [i, x] of sources.entries()) {
    if (!x.buckets) continue;
    const roles = x.split ? soup.splitRoles(x.buckets, x.split) : new Map<PartRole, BucketMap>([['whole', x.buckets]]);
    for (const [role, b] of roles) { const h = soup.partHash(b); parts.push({pand: i, role, buckets: b, hash: 'p' + h.hash.slice(0, 15), origin: h.origin, toTile: x.toTile!, triangles: soup.triangles(b)}); }
  }
  const byHash = new Map<string, Part[]>();
  for (const p of parts) if (soup.isInstanceable(p.role)) (byHash.get(p.hash) ?? byHash.set(p.hash, []).get(p.hash)!).push(p);
  const instancedHashes = new Set([...byHash].filter(([, v]) => v.length >= 2 && v[0].triangles * (v.length - 1) >= INSTANCE_MIN_SAVED_TRIANGLES).map(([h]) => h));
  const uniques = new Map<number, BucketMap[]>(), instances = new Map<string, {bounds: any; items: {matrix: Mat4; pand: number}[]}>();
  for (const p of parts) {
    if (instancedHashes.has(p.hash)) {
      if (!instances.has(p.hash)) {
        const canonical = soup.toCanonical(p.buckets, p.origin);
        let bounds: any;
        await ensureUnit(p.hash, async () => { const r = await writer.writeBucketUnit(p.hash, canonical, {kind: 'recipe-part', role: p.role}); bounds = r.bounds; return r; });
        bounds ??= writer.boundsOf((await reader.decodeUnit(new Uint8Array(await fs.readFile(path.join(OUT, 'units', `${p.hash}.glb`))))).flatMap(t => t.p));
        instances.set(p.hash, {bounds, items: []});
      }
      instances.get(p.hash)!.items.push({matrix: soup.mul(p.toTile, soup.translation(...p.origin)), pand: p.pand});
    } else (uniques.get(p.pand) ?? uniques.set(p.pand, []).get(p.pand)!).push(soup.transformBuckets(p.buckets, p.toTile));
  }
  for (const [i, x] of sources.entries()) if (x.unit) {
    if (!instances.has(x.unit.hash)) instances.set(x.unit.hash, {bounds: x.unit.bounds, items: []});
    instances.get(x.unit.hash)!.items.push({matrix: x.matrix!, pand: i});
  }
  tick('split', s); s = performance.now();

  // --- write the tile
  const meta = {
    version: schema.MESH_TILE_VERSION, tile: [T.z, T.x, T.y] as [number, number, number], anchor: frame.anchor,
    pands: sources.map(x => x.key), covers: sources.map(x => x.recipe.covers), specs: [...new Set(sources.flatMap(x => x.specs))].sort(),
    units: [...instances.keys()].sort().map(hash => ({hash, triangles: 0})), names: sources.map(x => x.name),
  };
  const unitTris = new Map<string, number>();
  for (const h of instances.keys()) unitTris.set(h, (await reader.decodeUnit(new Uint8Array(await fs.readFile(path.join(OUT, 'units', `${h}.glb`))))).length);
  for (const u of meta.units) u.triangles = unitTris.get(u.hash)!;
  const written = await writer.writeMeshTile(meta, [...uniques].map(([pand, maps]) => ({pand, buckets: soup.mergeBuckets(...maps)})), [...instances].map(([hash, v]) => ({hash, ...v})));
  const tileFile = path.join(OUT, 'building-mesh', `${tileArg}.glb`);
  await writeFileMkdir(tileFile, written.bytes);
  tick('write', s); s = performance.now();

  // --- gates: instanced ≡ merged (decode what was written, compare per pand), geometry audit per recipe pand
  const decoded = await reader.decodeMeshTile(written.bytes, async h => new Uint8Array(await fs.readFile(path.join(OUT, 'units', `${h}.glb`))));
  const pandReports: Record<string, any> = {};
  for (const [i, x] of sources.entries()) {
    let source: import('../../src/canalRecall/tileBuildings/readTile.ts').DecodedTri[];
    if (x.buckets) source = reader.bucketTris(soup.transformBuckets(x.buckets, x.toTile!));
    else source = (await reader.decodeUnit(new Uint8Array(await fs.readFile(x.unit!.file)))).map(t => ({layer: t.layer, p: [0, 3, 6].flatMap(o => soup.apply(x.matrix!, t.p[o], t.p[o + 1], t.p[o + 2]))}));
    // Recipe pands: within float32 + the unit's 16-bit grid; placed units are compared with themselves through the TRS.
    const cmp = reader.compareTriangles(source, decoded.pands[i], 0.004);
    x.gates['instanced-equals-merged'] = cmp;
    if (!cmp.pass) x.failed.push('instanced-equals-merged');
    if (x.buckets) x.gates.audit = auditCounts(soup.transformBuckets(x.buckets, x.toTile!));
    const myParts = parts.filter(p => p.pand === i);
    x.fitted.triangles = decoded.pands[i].length;
    pandReports[x.key] = {
      kind: x.recipe.kind, intent: x.recipe.intent ?? null, sameAs: x.recipe.sameAs ?? null, name: x.name,
      triangles: decoded.pands[i].length, triangleHash: soup.fnv64(decoded.pands[i].map(t => Int32Array.from(t.p.map(v => Math.round(v / 0.001))))),
      parts: Object.fromEntries(myParts.map(p => [p.role, {hash: p.hash, triangles: p.triangles, instanced: instancedHashes.has(p.hash)}])),
      unit: x.unit?.hash ?? null, gates: x.gates, failed: x.failed, fitted: x.fitted, specs: x.specs,
    };
  }
  tick('gates', s);
  const repeated = [...byHash.values()].filter(v => v.length >= 2);
  const report = {
    tile: tileArg, seconds: +((performance.now() - t0) / 1000).toFixed(1), timingsMs: timings, bytes: written.bytes.length,
    triangles: {merged: written.triangles, drawn: decoded.pands.reduce((s, p) => s + p.length, 0)},
    drawPrimitives: decoded.drawPrimitives, units: meta.units,
    instancing: {candidateParts: [...byHash.values()].reduce((s, v) => s + v.length, 0), repeatedHashes: repeated.length, repeatedParts: repeated.reduce((s, v) => s + v.length, 0),
      instancedHashes: instancedHashes.size, instancedParts: [...instancedHashes].reduce((s, h) => s + byHash.get(h)!.length, 0),
      savedTriangles: [...instancedHashes].reduce((s, h) => s + byHash.get(h)![0].triangles * (byHash.get(h)!.length - 1), 0)},
    installedChunksIdentical: installedMatch,
    failed: Object.fromEntries(sources.filter(x => x.failed.length).map(x => [x.key, x.failed])),
    pands: pandReports,
  };
  await writeFileMkdir(path.join(OUT, 'reports', `${tileArg}.json`), JSON.stringify(report, null, 1) + '\n');
  console.log(`${tileArg}: ${sources.length} pands, ${report.triangles.drawn} tris drawn (${report.triangles.merged} merged), ${report.drawPrimitives} draws, ${(written.bytes.length / 1024).toFixed(0)} KB, units ${meta.units.length}, instanced parts ${report.instancing.instancedParts}, failed ${Object.keys(report.failed).length}, ${report.seconds} s`);
  return report;
}

// ---------------------------------------------------------------------------------------------------------------
// All tiles in parallel processes, assemble, review

async function runAll(tileIds: string[], jobs: number) {
  const script = fileURLToPath(import.meta.url), queue = [...tileIds], failures: string[] = [];
  const one = (id: string) => new Promise<void>(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', script, '--stage=mesh', `--tile=${id}`, `--out=${OUT}`, ...process.argv.filter(a => /^--(min-saved)=/.test(a))], {stdio: ['ignore', 'inherit', 'inherit']});
    child.on('exit', code => { if (code) failures.push(id); resolve(); });
  });
  await Promise.all(Array.from({length: Math.min(jobs, queue.length)}, async () => { while (queue.length) await one(queue.shift()!); }));
  if (failures.length) throw Error(`mesh stage failed for ${failures.join(', ')}`);
}

async function listMeshTiles(): Promise<string[]> {
  const set = new Set<string>();
  for (const t of await readRecipeTiles()) for (const p of Object.values(t.pands)) set.add(`16/${p.mesh[0]}/${p.mesh[1]}`);
  return [...set].sort();
}

async function stageAssemble() {
  const recipeTiles = await readRecipeTiles(), index = {version: 1, tiles: {} as Record<string, any>, units: {} as Record<string, any>, specs: {} as Record<string, string>};
  const totals = {pands: 0, tiles: 0, bytes: 0, unitBytes: 0, triangles: 0, mergedTriangles: 0, draws: 0, failedPands: 0, instancedParts: 0, repeatedParts: 0, candidateParts: 0, savedTriangles: 0, byKind: {} as Record<string, number>, installedChunksIdentical: {} as Record<string, boolean | null>};
  const reports = new Map<string, any>();
  for (const id of await listMeshTiles()) {
    const r = await readJson(path.join(OUT, 'reports', `${id}.json`));
    reports.set(id, r);
    index.tiles[id] = {bytes: r.bytes, pands: Object.keys(r.pands).length, triangles: r.triangles.drawn, draws: r.drawPrimitives, units: r.units.map((u: any) => u.hash)};
    for (const s of new Set(Object.values(r.pands).flatMap((p: any) => p.specs))) index.specs[s as string] = id;
    for (const u of r.units) if (!index.units[u.hash]) { const bytes = (await fs.stat(path.join(OUT, 'units', `${u.hash}.glb`))).size; index.units[u.hash] = {bytes, triangles: u.triangles}; totals.unitBytes += bytes; }
    totals.tiles++; totals.bytes += r.bytes; totals.triangles += r.triangles.drawn; totals.mergedTriangles += r.triangles.merged; totals.draws += r.drawPrimitives;
    totals.failedPands += Object.keys(r.failed).length; totals.instancedParts += r.instancing.instancedParts; totals.repeatedParts += r.instancing.repeatedParts; totals.candidateParts += r.instancing.candidateParts; totals.savedTriangles += r.instancing.savedTriangles;
    Object.assign(totals.installedChunksIdentical, r.installedChunksIdentical);
    for (const p of Object.values(r.pands) as any[]) { totals.pands++; totals.byKind[p.kind] = (totals.byKind[p.kind] ?? 0) + 1; }
  }
  for (const t of recipeTiles) {
    for (const [key, p] of Object.entries(t.pands)) { const r = reports.get(`16/${p.mesh[0]}/${p.mesh[1]}`)?.pands?.[key]; if (r) p.fitted = r.fitted; }
    schema.validateRecipeTile(t, {strict: true});
    await writeFileMkdir(path.join(OUT, 'building-recipes', `14/${t.x}/${t.y}.json`), schema.stableJson(t, 1) + '\n');
  }
  await writeFileMkdir(path.join(OUT, 'index.json'), schema.stableJson(index, 1) + '\n');
  await writeFileMkdir(path.join(OUT, 'summary.json'), JSON.stringify(totals, null, 1) + '\n');
  console.log(JSON.stringify(totals));
}

/** Front elevation of a pand as inline SVG (orthographic along its longest horizontal axis, flat colours by slot ordinal). */
function elevationSvg(tris: {p: number[]; layer: number}[], w = 220, h = 160): string {
  if (!tris.length) return '<svg/>';
  const pts = tris.flatMap(t => [0, 3, 6].map(o => [t.p[o], t.p[o + 1], t.p[o + 2]]));
  const ext = [0, 2].map(k => Math.max(...pts.map(p => p[k])) - Math.min(...pts.map(p => p[k]))), ax = ext[0] >= ext[1] ? 0 : 2, dz = ax === 0 ? 2 : 0;
  const xs = pts.map(p => p[ax]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(w / (x1 - x0 || 1), h / (y1 - y0 || 1));
  const colour = ['#a4523b', '#ded8cb', '#cfc8b8', '#f1ede2', '#4a3b30', '#2a3a42', '#9c5a40', '#555b66', '#8f8a83'];
  const sorted = [...tris].sort((a, b) => (a.p[dz] + a.p[dz + 3] + a.p[dz + 6]) - (b.p[dz] + b.p[dz + 3] + b.p[dz + 6]));
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${sorted.map(t => `<polygon points="${[0, 3, 6].map(o => `${((t.p[o + ax] - x0) * k).toFixed(1)},${(h - (t.p[o + 1] - y0) * k).toFixed(1)}`).join(' ')}" fill="${colour[t.layer] ?? '#999'}"/>`).join('')}</svg>`;
}

async function stageReview(before: string) {
  const changed: {pand: string; tile: string; why: string[]; before: any; after: any}[] = [];
  const after = OUT, ids = new Set<string>();
  for (const root of [before, after]) for (const x of await fs.readdir(path.join(root, 'reports/16')).catch(() => [])) for (const y of await fs.readdir(path.join(root, 'reports/16', x))) ids.add(`16/${x}/${y.replace('.json', '')}`);
  const gateNumbers = (p: any) => JSON.stringify(p?.gates ?? {}, (k, v) => (k === 'maxDistM' ? undefined : v));
  for (const id of [...ids].sort()) {
    const a = await readJson(path.join(before, 'reports', `${id}.json`)).catch(() => ({pands: {}})), b = await readJson(path.join(after, 'reports', `${id}.json`)).catch(() => ({pands: {}}));
    for (const pand of new Set([...Object.keys(a.pands), ...Object.keys(b.pands)])) {
      const pa = a.pands[pand], pb = b.pands[pand], why: string[] = [];
      if (!pa) why.push('new'); else if (!pb) why.push('removed');
      else { if (pa.triangleHash !== pb.triangleHash) why.push(`triangles ${pa.triangles} → ${pb.triangles} (hash changed)`); if (gateNumbers(pa) !== gateNumbers(pb)) why.push('gate numbers changed'); }
      if (why.length) changed.push({pand, tile: id, why, before: pa, after: pb});
    }
  }
  const decodeFor = async (root: string, tile: string, pand: string) => {
    const file = path.join(root, 'building-mesh', `${tile}.glb`);
    if (!existsSync(file)) return [];
    const d = await reader.decodeMeshTile(new Uint8Array(await fs.readFile(file)), async h => new Uint8Array(await fs.readFile(path.join(root, 'units', `${h}.glb`))));
    const i = d.meta.pands.indexOf(pand);
    return i < 0 ? [] : d.pands[i];
  };
  const rows: string[] = [];
  for (const c of changed.slice(0, 200)) {
    const diffGates = Object.keys({...c.before?.gates, ...c.after?.gates}).filter(k => JSON.stringify(c.before?.gates?.[k]) !== JSON.stringify(c.after?.gates?.[k]) && k !== 'instanced-equals-merged');
    rows.push(`<tr><td>${c.pand}<br><small>${c.after?.name ?? c.before?.name ?? ''}<br>${c.tile}</small></td><td>${c.why.join('<br>')}<br><small>${diffGates.map(k => `${k}: ${JSON.stringify(c.before?.gates?.[k])} → ${JSON.stringify(c.after?.gates?.[k])}`).join('<br>')}</small></td><td>${elevationSvg(await decodeFor(before, c.tile, c.pand))}</td><td>${elevationSvg(await decodeFor(after, c.tile, c.pand))}</td></tr>`);
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Recipe tiles: changed pands</title><style>body{font:13px system-ui;margin:16px}td{border-top:1px solid #ccc;padding:6px;vertical-align:top}small{color:#666}</style>
<h1>${changed.length} changed pand${changed.length === 1 ? '' : 's'}</h1><p>before: ${before}<br>after: ${after}<br>Only pands whose triangle hash or gate numbers differ are listed (${[...ids].length} tiles compared).</p>
<table><tr><th>pand</th><th>why</th><th>before</th><th>after</th></tr>${rows.join('\n')}</table>`;
  await writeFileMkdir(path.join(OUT, 'review', 'index.html'), html);
  await writeFileMkdir(path.join(OUT, 'review', 'changed.json'), JSON.stringify(changed.map(c => ({pand: c.pand, tile: c.tile, why: c.why})), null, 1) + '\n');
  console.log(`review: ${changed.length} changed pands → ${path.join(OUT, 'review', 'index.html')}`);
  return changed;
}

// ---------------------------------------------------------------------------------------------------------------

const stage = arg('stage') ?? 'all', jobs = Number(arg('jobs') ?? 6);
if (stage === 'recipes') await stageRecipes();
else if (stage === 'mesh') { if (arg('tile')) await stageMeshTile(arg('tile')!); else await runAll(await listMeshTiles(), jobs); }
else if (stage === 'assemble') await stageAssemble();
else if (stage === 'review') await stageReview(arg('before') ?? (() => { throw Error('--before=<out dir>'); })());
else if (stage === 'all') { const t = performance.now(); const ids = await stageRecipes(); await runAll(ids, jobs); await stageAssemble(); console.log(`all: ${((performance.now() - t) / 1000).toFixed(0)} s`); }
else throw Error(`unknown --stage=${stage}`);
