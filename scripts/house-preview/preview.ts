/**
 * House line station 2: see one house in half a second, in Node, through the game's own geometry and painters.
 * The command, its flags and what it cannot show are documented in docs/house-line.md §2 (the HELP text below is the
 * same text). No dev server, no Playwright.
 */
// The world pipeline bakes with the browser's Math.cos/sin (scripts/world/browserMath.ts): first import.
import '../world/useBrowserMath.ts';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { gameChain, loadTile, EXTRACT, type Chain, type Feature, type Row } from '../world/pipeline.ts';
import { shellProfiles, shellStreets } from '../world/shellBake.ts';
import { buildFeatureChunk, asPolygons } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { wallTopHeightM, type Chunk } from '../../src/canalRecall/threeBuildingMesh.ts';
import { chunkMetres } from '../../src/canalRecall/world/shellMesh.ts';
import { BuildingContextIndex } from '../../src/canalRecall/buildingContextIndex.ts';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.ts';
import { GABLE_SHAPES } from '../../src/canalRecall/roofMesh.ts';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { rasterise, type RasterImage, type RasterMesh, type Vec3 } from '../../src/canalRecall/houseSpec/softRaster.ts';
import { previewVerdict, storeyLines, type PreviewVerdict } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { measureFacade, type FacadeImage, type FacadeMeasurement } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { gameColour } from '../../src/canalRecall/buildingRecipe/likeness.ts';
import { renderElevation } from '../../src/canalRecall/landmarks/facadeCompare.ts';
import { pickWall } from '../pand-reference/select.ts';
import { loadMaterialSoup } from '../landmarks/material-soup.ts';
import { loadAtlas, ATLAS_DIR } from './atlas.ts';
import { REPO_ROOT } from './nodeDom.ts';

export const HELP = `npm run house:preview -- <pandId | spec.json> [flags]

Renders one house's front elevation in Node through the game's own chunk builder (threeBuildingFeatures
buildFeatureChunk, the decorator chain of scripts/world/pipeline.ts) and facade atlas painter, with a software
rasteriser (src/canalRecall/houseSpec/softRaster.ts). No dev server, no browser.

  <pandId>            BAG pand id (0363100012164843 or NL.IMBAG.Pand.0363100012164843)
  <spec.json>         a house spec file: { "pandId": "...", "design": { fronts, roof, palette, ... } }
                      (same as --spec <file>)

Flags
  --spec <path>       apply a house spec's design to the pand before the decorators run (see "Overrides")
  --intent <path>     apply a CanalHouseIntent (scripts/building-recipes/houses/<id>/intent.json or a block-face
                      house intent) the same way; its pandId names the pand when no pand id is given
  --photo             add the reference photo: staging/pand-reference/<pand>/front.jpg, else the block-face strip
                      crop of the pand's wall (scripts/block-face/faces/*/strip.json); writes compare.png and prints
                      the likeness verdict (wall dL/hue, glazing, columns, window shape) of render vs photo
  --threeq            add a three-quarter perspective view (threeq.png)
  --recipe [<id>]     the recipe route: compile scripts/building-recipes/houses/<id> (default: the house whose
                      intent names this pand) with the recipe compiler and render its GLB (renderElevation,
                      flat game colours) instead of the streamed generic path
  --whole-tile        build the chunk from every building of the pand's z14 tile, exactly as the runtime groups
                      it (~4 s a render); by default the chunk holds the tile's buildings within 30 m of the pand,
                      which drew the same pixels as the whole tile at Nassaukade (0363100012164843)
  --watch             keep tile, neighbours, streets and atlas in memory and re-render whenever the spec/intent
                      file changes (needs --spec or --intent)
  --look <look>       atlas look (default photo)
  --ppm <n>           pixels per metre of the front elevation (default 50, the rectified photos' scale)
  --out <dir>         output directory (default artifacts/house-preview/<pand>)
  --help              this text

Output: <out>/front.png, threeq.png (--threeq), compare.png (--photo), measure.json (timings, wall, overrides,
measurements, verdict). Atlas cache: artifacts/house-preview/atlas-<look>-<size>-<painter hash>.bin (first run
paints, later runs load; a painter source change repaints).

Overrides (until the HouseSpec resolver of lane H1 lands): front gable -> monumentGable; every other design field is
listed under overrides.notApplied in measure.json (the generic path has no property for it yet).

Not reproduced: the far and roof distance tiers, mipmaps, the lit/city-look shaders (sun, wall gain, grain),
analytic window SDF, shadows, the ground lift, post-processing. When those matter (a lighting or tier question), fall back to
scripts/building-recipes/render.ts (headless Chromium) or a ride frame.`;

// ---------------------------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------------------------
type Args = { target?: string; spec?: string; intent?: string; photo: boolean; threeq: boolean; recipe: string | boolean; wholeTile: boolean; watch: boolean; look: string; ppm: number; out?: string; help: boolean };
export function parseArgs(argv: string[]): Args {
  const a: Args = { photo: false, threeq: false, recipe: false, wholeTile: false, watch: false, look: 'photo', ppm: 50, help: false };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case '--help': case '-h': a.help = true; break;
      case '--photo': a.photo = true; break;
      case '--threeq': a.threeq = true; break;
      case '--watch': a.watch = true; break;
      case '--whole-tile': a.wholeTile = true; break;
      case '--recipe': a.recipe = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') && !/^(NL\.IMBAG\.Pand\.)?\d{16}$/.test(argv[i + 1]) ? argv[++i] : true); break;
      case '--spec': a.spec = value(); break;
      case '--intent': a.intent = value(); break;
      case '--look': a.look = value(); break;
      case '--ppm': a.ppm = Number(value()); break;
      case '--out': a.out = value(); break;
      default:
        if (flag.startsWith('--')) throw new Error(`unknown flag ${flag} (see --help)`);
        if (a.target) throw new Error(`two targets: ${a.target} and ${flag}`);
        a.target = flag;
    }
  }
  if (a.target?.endsWith('.json')) { a.spec ??= a.target; a.target = undefined; }
  return a;
}

const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
const full = (id: string) => `NL.IMBAG.Pand.${bare(id)}`;
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------------------------------------------------------------------------------------------------------------
// Overrides: a spec's design or an intent, written onto the pand's source properties before the decorators run
// ---------------------------------------------------------------------------------------------------------------
type Design = { fronts?: Record<string, unknown>[]; roof?: unknown; palette?: unknown; [k: string]: unknown };
export type Override = { source: string; pandId?: string; design: Design };
const GABLE_WORDS: Record<string, string> = { trap: 'step', trapgevel: 'step', hals: 'neck', halsgevel: 'neck', klok: 'bell', klokgevel: 'bell', tuit: 'spout', tuitgevel: 'spout', lijst: 'cornice', lijstgevel: 'cornice' };

export function readOverride(file: string, kind: 'spec' | 'intent'): Override {
  const j = readJson(file);
  if (kind === 'spec') return { source: file, pandId: j.pandId, design: j.design ?? {} };
  const { schemaVersion: _s, kind: _k, id: _i, pandId, address: _a, sources: _src, ...design } = j;
  return { source: file, pandId, design };
}

/** The property patch an override makes on the generic path, and the design fields it cannot express there. */
export function overridePatch(o: Override): { patch: Record<string, unknown>; applied: string[]; notApplied: string[] } {
  const patch: Record<string, unknown> = {}, applied: string[] = [], notApplied: string[] = [];
  const front = o.design.fronts?.[0] ?? {};
  const g = typeof front.gable === 'string' ? GABLE_WORDS[front.gable] ?? front.gable : undefined;
  if (g && (GABLE_SHAPES as readonly string[]).includes(g)) { patch.monumentGable = g; applied.push(`fronts[0].gable -> monumentGable=${g}`); }
  else if (front.gable !== undefined) notApplied.push(`fronts[0].gable (${String(front.gable)}: not a GableShape)`);
  for (const k of Object.keys(front)) if (k !== 'gable' && k !== 'id') notApplied.push(`fronts[0].${k}`);
  for (const k of Object.keys(o.design)) if (k !== 'fronts') notApplied.push(k);
  if ((o.design.fronts?.length ?? 0) > 1) notApplied.push(`fronts[1..${o.design.fronts!.length - 1}]`);
  return { patch, applied, notApplied };
}

// ---------------------------------------------------------------------------------------------------------------
// The warm state: chain, tiles, neighbours, atlas
// ---------------------------------------------------------------------------------------------------------------
const TILE_INDEX = path.join(ATLAS_DIR, 'pand-tiles.json');
const tileOfLngLat = (lng: number, lat: number) => {
  const n = 2 ** 14, rad = lat * Math.PI / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)] as const;
};

export class PreviewSession {
  readonly chain: Chain = gameChain();
  private tiles = new Map<string, Row[]>();
  private index: Record<string, string> | null = null;
  atlas: Awaited<ReturnType<typeof loadAtlas>> | null = null;
  constructor(readonly look: string) {}

  /** z14 tile (`x/y`) holding the pand: from artifacts/house-preview/pand-tiles.json, built by one scan of the extract. */
  tileOf(pandId: string): string {
    if (!this.index && fs.existsSync(TILE_INDEX)) this.index = readJson(TILE_INDEX);
    const hit = this.index?.[bare(pandId)];
    if (hit) return hit;
    const root = path.join(EXTRACT, 'building-tiles/14'), index: Record<string, string> = {};
    for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
      const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, x, f))).toString('utf8'));
      for (const feat of fc.features ?? []) { const id = String(feat.properties?.id ?? ''); if (id.startsWith('NL.IMBAG.Pand.')) index[bare(id)] ??= `${x}/${f.split('.')[0]}`; }
    }
    fs.mkdirSync(ATLAS_DIR, { recursive: true });
    fs.writeFileSync(TILE_INDEX, JSON.stringify(index));
    this.index = index;
    const found = index[bare(pandId)];
    if (!found) throw new Error(`pand ${pandId} is in no building tile of ${path.relative(REPO_ROOT, root)}`);
    return found;
  }

  async rows(tile: string): Promise<Row[]> {
    let r = this.tiles.get(tile);
    if (!r) this.tiles.set(tile, r = await loadTile(tile, this.chain));
    return r;
  }

  async ensureAtlas() { return this.atlas ??= await loadAtlas(this.look as 'photo', 256); }
}

const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};

// ---------------------------------------------------------------------------------------------------------------
// Front wall: the reference crop's wall when there is one (photo and render then share one axis), else the rule
// rectifyWall's callers use (pand-reference/select.ts pickWall: longest exposed wall on the nearest road)
// ---------------------------------------------------------------------------------------------------------------
type LngLat = [number, number];
export type FrontWall = { a: LngLat; b: LngLat; lengthM: number; source: string; reference?: string };

async function frontWall(pandId: string, own: Feature, neighbours: Feature[]): Promise<FrontWall> {
  const ref = path.join(REPO_ROOT, 'staging/pand-reference', bare(pandId), 'reference.json');
  if (fs.existsSync(ref)) {
    const r = readJson(ref);
    if (r.wall?.startLngLat) return { a: r.wall.startLngLat, b: r.wall.endLngLat, lengthM: r.wall.lengthM, source: 'staging/pand-reference reference.json', reference: ref };
  }
  const fp = (f: Feature) => ({ id: String(f.properties.id), ring: (asPolygons(f.geometry)[0]?.[0] ?? []).map(([lng, lat]) => lngLatToRd([lng, lat])), height: Number(f.properties.height) || 0 });
  const picked = await pickWall(fp(own), [own, ...neighbours].map(fp));
  if (!picked.wall) throw new Error(`${pandId}: ${picked.note}`);
  return { a: rdToLngLat(picked.wall.a) as LngLat, b: rdToLngLat(picked.wall.b) as LngLat, lengthM: picked.wall.len, source: `pand-reference/select.ts pickWall: ${picked.note}` };
}

/** The wall in chunk metres: origin a (viewer's left), unit right a->b, outward normal, length. */
function wallFrame(w: FrontWall) {
  const [ax, ay] = chunkMetres(w.a[0], w.a[1]), [bx, by] = chunkMetres(w.b[0], w.b[1]);
  const len = Math.hypot(bx - ax, by - ay), right: Vec3 = [(bx - ax) / len, (by - ay) / len, 0], normal: Vec3 = [right[1], -right[0], 0];
  return { origin: [ax, ay, 0] as Vec3, right, normal, len };
}

// ---------------------------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------------------------
function concatChunks(parts: (RasterMesh & { ranges: Chunk['ranges'] })[]): RasterMesh & { ranges: { id: string; start: number; count: number }[] } {
  const vn = parts.reduce((s, p) => s + p.layers.length, 0), tn = parts.reduce((s, p) => s + p.indices.length, 0);
  const out = { positions: new Float32Array(vn * 3), uvs: new Float32Array(vn * 2), layers: new Uint8Array(vn), tints: new Uint8Array(vn * 4), accents: new Uint8Array(vn * 4), indices: new Uint32Array(tn), ranges: [] as { id: string; start: number; count: number }[] };
  let v = 0, t = 0;
  for (const p of parts) {
    out.positions.set(p.positions, v * 3); out.uvs.set(p.uvs, v * 2); out.layers.set(p.layers, v); out.tints.set(p.tints, v * 4); out.accents.set(p.accents, v * 4);
    for (let k = 0; k < p.indices.length; k++) out.indices[t + k] = p.indices[k] + v;
    for (const r of p.ranges) out.ranges.push({ id: r.id, start: r.start + v, count: r.count });
    v += p.layers.length; t += p.indices.length;
  }
  return out;
}

const SKY: Vec3 = [159, 184, 207];
/** Buildings of the pand's tile within this many metres of it share its chunk (see renderPand). */
export const ROW_M = 30;
async function png(img: { width: number; height: number; rgba: Uint8ClampedArray | Uint8Array }, file: string) {
  await sharp(Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } }).flatten({ background: { r: SKY[0], g: SKY[1], b: SKY[2] } }).png().toFile(file);
}
const facadeImage = (img: { width: number; height: number; rgba: Uint8ClampedArray | Uint8Array }, ppm: number, topM: number): FacadeImage => {
  const n = img.width * img.height, rgb = new Uint8Array(n * 3), valid = new Uint8Array(n);
  for (let i = 0; i < n; i++) { rgb[i * 3] = img.rgba[i * 4]; rgb[i * 3 + 1] = img.rgba[i * 4 + 1]; rgb[i * 3 + 2] = img.rgba[i * 4 + 2]; valid[i] = img.rgba[i * 4 + 3]; }
  return { width: img.width, height: img.height, rgb, valid, ppm, topM };
};

type Photo = { image: FacadeImage; file: string; kind: string; png: Buffer };
/** The reference photo on the wall's axis at `ppm`: the pand-reference crop, else the block-face strip crop. */
async function referencePhoto(pandId: string, wall: FrontWall, ppm: number): Promise<Photo | null> {
  const toImage = async (buf: Buffer, topM: number, file: string, kind: string, extract?: { left: number; width: number }, scale = 1): Promise<Photo> => {
    let s = sharp(buf);
    if (extract) { const meta = await sharp(buf).metadata(); s = sharp(await s.extract({ left: extract.left, top: 0, width: extract.width, height: meta.height! }).toBuffer()); }
    const meta = await s.metadata();
    const width = Math.max(1, Math.round(meta.width! * scale)), height = Math.max(1, Math.round(meta.height! * scale));
    const { data } = await s.resize(width, height, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgb = new Uint8Array(data);
    return { image: { width, height, rgb, ppm, topM }, file, kind, png: await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer() };
  };
  const dir = path.join(REPO_ROOT, 'staging/pand-reference', bare(pandId));
  if (fs.existsSync(path.join(dir, 'front.jpg')) && fs.existsSync(path.join(dir, 'reference.json'))) {
    const r = readJson(path.join(dir, 'reference.json')), crop = r.primary?.crop;
    if (crop) return toImage(fs.readFileSync(path.join(dir, 'front.jpg')), crop.wallHeightM, path.join(dir, 'front.jpg'), `pand-reference ${r.primary.timestamp?.slice(0, 10) ?? ''} (${crop.pixelsPerMetre} px/m)`, undefined, ppm / crop.pixelsPerMetre);
  }
  // Block-face strips: the face whose spans list the pand; crop the wall's [a, b] along the strip's u axis.
  const faces = path.join(REPO_ROOT, 'scripts/block-face/faces');
  for (const face of fs.existsSync(faces) ? fs.readdirSync(faces) : []) {
    const sj = path.join(faces, face, 'strip.json');
    if (!fs.existsSync(sj)) continue;
    const text = fs.readFileSync(sj, 'utf8');
    if (!text.includes(bare(pandId))) continue;
    const s = JSON.parse(text);
    const candidates = [path.join(REPO_ROOT, s.image), process.env.MAP_RECALL_SOURCE_DATA && path.join(process.env.MAP_RECALL_SOURCE_DATA, 'block-face-strips', face, 'strip.jpg'), path.join(REPO_ROOT, '../../map-recall2-source-data/block-face-strips', face, 'strip.jpg'), path.join(path.dirname(REPO_ROOT), '../map-recall2-source-data/block-face-strips', face, 'strip.jpg')].filter(Boolean) as string[];
    const img = candidates.find(f => fs.existsSync(f));
    if (!img) continue;
    const along = (ll: LngLat) => { const p = lngLatToRd(ll); return (p.x - s.frame.midRD[0]) * s.frame.uRD[0] + (p.y - s.frame.midRD[1]) * s.frame.uRD[1]; };
    let x0 = along(wall.a), x1 = along(wall.b);
    if (x1 < x0) [x0, x1] = [x1, x0];
    const left = Math.max(0, Math.round((x0 - s.x0M) * s.pixelsPerMetre)), right = Math.min(s.width, Math.round((x1 - s.x0M) * s.pixelsPerMetre));
    if (right - left < 10) continue;
    return toImage(fs.readFileSync(img), s.heightM, img, `block-face strip ${face} ${s.date ?? ''} (${s.pixelsPerMetre} px/m)`, { left, width: right - left }, ppm / s.pixelsPerMetre);
  }
  return null;
}

export type PreviewResult = { pandId: string; out: string; files: string[]; timings: Record<string, number>; measure: Record<string, unknown> };

/** One render of one pand: front.png (+ threeq.png, compare.png) and measure.json in `out`. */
export async function renderPand(session: PreviewSession, pandId: string, args: Args, override?: Override): Promise<PreviewResult> {
  const t: Record<string, number> = {}, mark = (k: string, t0: number) => { t[k] = Math.round(performance.now() - t0); return performance.now(); };
  let t0 = performance.now();
  const tile = session.tileOf(pandId);
  const rows = await session.rows(tile);
  const raw = rows.find(r => r.raw.properties.id === full(pandId));
  if (!raw) throw new Error(`${pandId} is not drawn by the generic path in tile ${tile} (nested duplicate or no cell)`);
  // Neighbours across a tile edge: load the adjacent tiles the pand's box comes within 60 m of.
  const box = boxOf(raw.raw), padLng = 60 / (111_320 * Math.cos(52.37 * Math.PI / 180)), padLat = 60 / 110_540;
  const tiles = new Set<string>([tile]);
  for (const [lng, lat] of [[box[0] - padLng, box[1] - padLat], [box[2] + padLng, box[1] - padLat], [box[0] - padLng, box[3] + padLat], [box[2] + padLng, box[3] + padLat]]) tiles.add(tileOfLngLat(lng, lat).join('/'));
  const all: Row[] = [];
  for (const tl of tiles) all.push(...await session.rows(tl));
  t0 = mark('tiles', t0);
  // The override goes onto the source properties, then the chain decorates as it does for every building.
  const ov = override ? overridePatch(override) : null;
  const own = ov && Object.keys(ov.patch).length ? session.chain.decorate({ ...raw.raw, properties: { ...raw.raw.properties, ...ov.patch } }) : raw.styled;
  const styled = all.map(r => r === raw ? own : r.styled);
  const kitHide = new Set(KIT_HIDE_IDS);
  const ctx = new BuildingContextIndex(styled, boxOf);
  const neighbours = ctx.neighbors([own], f => f.properties.id === own.properties.id || kitHide.has(String(f.properties.id)));
  // The chunk: the runtime builds one per z14 group tile, and a building's mesh depends on which buildings share its
  // chunk (a pand alone, with its row only as context, lost its window heads and balconies: 172 vs 164 wall and
  // 684 vs 690 extra vertices at Nassaukade 0363100012164843). The buildings of the pand's tile within ROW_M of it,
  // in tile order, gave the whole tile's vertex counts there (R30 = R100 = R300 = tile); --whole-tile builds the tile.
  const ownBox = boxOf(own), rowLng = ROW_M / (111_320 * Math.cos(52.37 * Math.PI / 180)), rowLat = ROW_M / 110_540;
  const nearOwn = (f: Feature) => { const b = boxOf(f); return b[0] <= ownBox[2] + rowLng && b[2] >= ownBox[0] - rowLng && b[1] <= ownBox[3] + rowLat && b[3] >= ownBox[1] - rowLat; };
  const features = rows.map(r => r === raw ? own : r.styled).filter(f => !kitHide.has(String(f.properties.id)) && (args.wholeTile || nearOwn(f)));
  const inChunk = new Set(features);
  const context = ctx.neighbors(features, f => inChunk.has(f) || kitHide.has(String(f.properties.id)));
  const streets = shellStreets(REPO_ROOT, features as never), profiles = shellProfiles(REPO_ROOT);
  t0 = mark('context', t0);
  const look = session.look as 'photo';
  const walls = buildFeatureChunk(features as never, look, 'walls', streets, profiles, context as never);
  const extras = buildFeatureChunk(features as never, look, 'extras', streets, profiles, context as never);
  const mesh = concatChunks([walls, extras]);
  const ownRanges = mesh.ranges.filter(r => r.id === own.properties.id);
  const inOwn = new Uint8Array(mesh.layers.length);
  for (const r of ownRanges) inOwn.fill(1, r.start, r.start + r.count);
  t0 = mark('chunk', t0);
  const atlas = (await session.ensureAtlas()).atlas;
  t0 = mark('atlas', t0);

  const wall = await frontWall(pandId, own, neighbours);
  const frame = wallFrame(wall);
  let zMax = 0;
  for (let v = 0; v < inOwn.length; v++) if (inOwn[v]) zMax = Math.max(zMax, mesh.positions[v * 3 + 2]);
  const top = Math.ceil((zMax + 0.5) * 2) / 2;
  const front = rasterise(mesh, atlas, { kind: 'ortho', origin: frame.origin, right: frame.right, normal: frame.normal, u0: 0, u1: frame.len, v0: 0, v1: top, pxPerM: args.ppm }, { supersample: 2, background: SKY, keep: v => inOwn[v] === 1 });
  t0 = mark('raster', t0);
  const out = path.resolve(args.out ?? path.join(ATLAS_DIR, bare(pandId)));
  fs.mkdirSync(out, { recursive: true });
  const files = [path.join(out, 'front.png')];
  await png(front, files[0]);
  let threeq: RasterImage | null = null;
  if (args.threeq) {
    const mid: Vec3 = [frame.origin[0] + frame.right[0] * frame.len / 2, frame.origin[1] + frame.right[1] * frame.len / 2, top * 0.45];
    const size = Math.max(frame.len * 1.6, top) * 1.25, dist = size / 2 / Math.tan(15 * Math.PI / 180), yaw = 38 * Math.PI / 180;
    const [nx, ny] = frame.normal, dx = nx * Math.cos(yaw) - ny * Math.sin(yaw), dy = nx * Math.sin(yaw) + ny * Math.cos(yaw);
    // The 3/4 view shows the row the chunk holds (every building within ROW_M of the pand).
    threeq = rasterise(mesh, atlas, { kind: 'perspective', eye: [mid[0] + dx * dist, mid[1] + dy * dist, top * 0.9], target: mid, fovDeg: 30, width: 640, height: 800 }, { supersample: 2, background: SKY });
    files.push(path.join(out, 'threeq.png'));
    await png(threeq, files[files.length - 1]);
    t0 = mark('threeq', t0);
  }

  // Measurement on the wall below the eaves, with storey lines from the pand's own heights.
  const p = own.properties, eaves = Math.min(top, wallTopHeightM(p));
  const lines = storeyLines(eaves, Number(p.groundFloorHeightM) || 3.2);
  const mbox = { u0: Math.min(0.2, frame.len / 4), u1: frame.len - Math.min(0.2, frame.len / 4), v0: 0, v1: eaves };
  const renderM = measureFacade({ image: facadeImage(front, args.ppm, top), box: mbox, lines });
  const measure: Record<string, unknown> = {
    pandId: bare(pandId), tile, route: 'generic', look: session.look, ppm: args.ppm,
    wall: { ...wall, lengthM: +frame.len.toFixed(2) }, heights: { topM: top, eavesM: +eaves.toFixed(2), lines },
    chunk: { buildings: features.length, contextNeighbours: context.length, vertices: mesh.layers.length, ownVertices: ownRanges.reduce((s, r) => s + r.count, 0), triangles: mesh.indices.length / 3, wholeTile: args.wholeTile },
    atlas: { file: path.relative(REPO_ROOT, session.atlas!.file), painted: session.atlas!.painted },
    properties: p, overrides: ov ? { source: override!.source, applied: ov.applied, notApplied: ov.notApplied } : null,
    render: summary(renderM),
  };
  if (args.photo) {
    const photo = await referencePhoto(pandId, wall, args.ppm);
    if (!photo) measure.photo = { missing: `no staging/pand-reference/${bare(pandId)}/front.jpg and no block-face strip lists the pand (run scripts/pand-reference/run.ts --ids=${bare(pandId)})` };
    else {
      const photoM = measureFacade({ image: photo.image, box: { ...mbox, v1: Math.min(mbox.v1, photo.image.topM) }, lines: lines.filter(l => l <= photo.image.topM) });
      const verdict = previewVerdict(renderM, photoM);
      measure.photo = { file: path.relative(REPO_ROOT, photo.file), kind: photo.kind, measure: summary(photoM) };
      measure.verdict = verdict;
      files.push(path.join(out, 'compare.png'));
      await compareSheet([{ png: await sharp(files[0]).png().toBuffer(), label: `preview (generic path)`, topM: top }, { png: photo.png, label: photo.kind, topM: photo.image.topM }], args.ppm, verdict, files[files.length - 1]);
      t0 = mark('photo', t0);
    }
  }
  measure.timings = t;
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(measure, null, 1));
  files.push(path.join(out, 'measure.json'));
  return { pandId: bare(pandId), out, files, timings: t, measure };
}

/** The verdict fields a reader compares (the full FacadeMeasurement is large). */
export function summary(m: FacadeMeasurement) {
  return { wall: m.wall.hex, wallRaw: m.wall.rawHex, material: m.material?.family ?? null, glazing: m.glazing, storeyGlazing: m.storeyGlazing, columns: m.columns, windowColumns: m.windowColumns ?? null, pitchM: m.pitchM, window: m.window, frontClass: m.frontClass, usable: +m.usableFraction.toFixed(3), foliage: +m.foliageFraction.toFixed(3), washedOut: +m.washedOutFraction.toFixed(3) };
}

/** Side by side at one scale, ground lines aligned, a verdict line on top. */
export async function compareSheet(panels: { png: Buffer; label: string; topM: number }[], ppm: number, verdict: PreviewVerdict | null, file: string) {
  const metas = await Promise.all(panels.map(p => sharp(p.png).metadata()));
  const ground = Math.max(...panels.map(p => p.topM)) * ppm, head = 64, gap = 16;
  const width = metas.reduce((s, m) => s + m.width!, 0) + gap * (panels.length + 1);
  const height = Math.round(head + ground + 24);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const title = verdict ? [`${verdict.verdict} · wall ${verdict.wall.a} vs ${verdict.wall.b} · dL ${verdict.wall.dL}${verdict.wall.dHue !== null ? ` · hue ${verdict.wall.dHue}°` : ''}`,
    `glazing ${verdict.glazing.a.toFixed(2)} vs ${verdict.glazing.b.toFixed(2)} · cols ${verdict.columns.a ?? '-'} vs ${verdict.columns.b ?? '-'} · window ${verdict.window.a ?? '-'} vs ${verdict.window.b ?? '-'}`] : ['', ''];
  const comps: { input: Buffer; left: number; top: number }[] = [];
  let x = gap;
  panels.forEach((p, i) => {
    const w = metas[i].width!, h = metas[i].height!;
    comps.push({ input: p.png, left: x, top: Math.round(head + ground - p.topM * ppm) });
    comps.push({ input: Buffer.from(`<svg width="${w}" height="20"><text x="0" y="15" font-family="Helvetica, Arial" font-size="13" fill="#1f2328">${esc(p.label)}</text></svg>`), left: x, top: head - 22 });
    void h; x += w + gap;
  });
  comps.push({ input: Buffer.from(`<svg width="${width}" height="42"><text x="${gap}" y="17" font-family="Helvetica, Arial" font-size="13" font-weight="bold" fill="#1f2328">${esc(title[0])}</text><text x="${gap}" y="35" font-family="Helvetica, Arial" font-size="13" fill="#1f2328">${esc(title[1])}</text></svg>`), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: '#f4f4f2' } }).composite(comps).png().toFile(file);
}

// ---------------------------------------------------------------------------------------------------------------
// Recipe route: compile the house's recipe, render its GLB with renderElevation (flat game colours)
// ---------------------------------------------------------------------------------------------------------------
function recipeHouseFor(pandId: string): string | null {
  const dir = path.join(REPO_ROOT, 'scripts/building-recipes/houses');
  for (const id of fs.readdirSync(dir)) {
    const f = path.join(dir, id, 'intent.json');
    if (fs.existsSync(f) && bare(String(readJson(f).pandId ?? '')) === bare(pandId)) return id;
  }
  return null;
}

export async function renderRecipe(session: PreviewSession, pandId: string, house: string, args: Args): Promise<PreviewResult> {
  const t: Record<string, number> = {}, mark = (k: string, t0: number) => { t[k] = Math.round(performance.now() - t0); return performance.now(); };
  let t0 = performance.now();
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/building-recipes/compile.ts', `--house=${house}`], { cwd: REPO_ROOT, stdio: 'pipe' });
  t0 = mark('compile', t0);
  const dir = path.join(REPO_ROOT, 'artifacts/building-recipes', house), report = readJson(path.join(dir, 'report.json'));
  const soup = await loadMaterialSoup(path.join(dir, 'model.glb'));
  const tile = session.tileOf(pandId), rows = await session.rows(tile);
  const own = rows.find(r => r.raw.properties.id === full(pandId))?.styled;
  if (!own) throw new Error(`${pandId} not in tile ${tile}`);
  const wall = await frontWall(pandId, own, []);
  // GLB frame: x east, y up, z south, RD offsets from report.anchorRD (render.ts rdToRecipeLocal).
  const A = lngLatToRd(wall.a), B = lngLatToRd(wall.b), anchor = report.anchorRD;
  const ax = A.x - anchor[0], az = anchor[1] - A.y, bx = B.x - anchor[0], bz = anchor[1] - B.y, len = Math.hypot(bx - ax, bz - az);
  const rx = (bx - ax) / len, rz = (bz - az) / len, nx = -rz, nz = rx; // outward normal: viewer's right turned 90° (x east, z south)
  const bearing = (Math.atan2(nx, -nz) * 180 / Math.PI + 360) % 360;
  const tA = ax * nz + az * -nx; // facadeCompare: t = x * nz + z * (-nx), the viewer's right
  const cell = 1 / args.ppm;
  const el = renderElevation(soup, { name: 'front', bearing, span: [tA - 0.01, tA + len + 0.01] } as never, cell);
  t0 = mark('raster', t0);
  const colours = soup.materials.map(m => gameColour(m as never));
  const rgba = new Uint8ClampedArray(el.W * el.H * 4);
  for (let i = 0; i < el.W * el.H; i++) {
    const m = el.mat[i];
    if (m < 0) { rgba.set([...SKY, 0], i * 4); continue; }
    const c = colours[m], s = el.shade[i];
    rgba.set([c[0] * s, c[1] * s, c[2] * s, 255], i * 4);
  }
  const out = path.resolve(args.out ?? path.join(ATLAS_DIR, bare(pandId)));
  fs.mkdirSync(out, { recursive: true });
  const files = [path.join(out, 'front.png')];
  const front = { width: el.W, height: el.H, rgba };
  await png(front, files[0]);
  const top = el.yMax, eaves = Math.min(top, Math.max(...(report.fit?.fronts ?? []).map((f: { eavesM?: number; crownBaseM?: number }) => f.eavesM ?? f.crownBaseM ?? 0), 0) || top);
  const lines = storeyLines(eaves);
  const mbox = { u0: 0.2, u1: el.W * cell - 0.2, v0: 0, v1: eaves };
  const renderM = measureFacade({ image: facadeImage(front, args.ppm, top), box: mbox, lines });
  const measure: Record<string, unknown> = { pandId: bare(pandId), route: 'recipe', house, glb: path.relative(REPO_ROOT, path.join(dir, 'model.glb')), triangles: report.triangles, wall, heights: { topM: +top.toFixed(2), eavesM: +eaves.toFixed(2), lines }, render: summary(renderM) };
  if (args.photo) {
    const photo = await referencePhoto(pandId, wall, args.ppm);
    if (photo) {
      const photoM = measureFacade({ image: photo.image, box: { ...mbox, v1: Math.min(mbox.v1, photo.image.topM) }, lines: lines.filter(l => l <= photo.image.topM) });
      const verdict = previewVerdict(renderM, photoM);
      measure.photo = { file: path.relative(REPO_ROOT, photo.file), kind: photo.kind, measure: summary(photoM) };
      measure.verdict = verdict;
      files.push(path.join(out, 'compare.png'));
      await compareSheet([{ png: await sharp(files[0]).png().toBuffer(), label: `preview (recipe ${house}, flat game colours)`, topM: top }, { png: photo.png, label: photo.kind, topM: photo.image.topM }], args.ppm, verdict, files[files.length - 1]);
    } else measure.photo = { missing: `no reference photo for ${bare(pandId)}` };
    t0 = mark('photo', t0);
  }
  measure.timings = t;
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(measure, null, 1));
  files.push(path.join(out, 'measure.json'));
  return { pandId: bare(pandId), out, files, timings: t, measure };
}

// ---------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------
function report(r: PreviewResult, ms: number) {
  const v = r.measure.verdict as PreviewVerdict | undefined, m = r.measure.render as ReturnType<typeof summary>;
  console.log(`${r.pandId} (${r.measure.route}) ${Math.round(ms)} ms  [${Object.entries(r.timings).map(([k, x]) => `${k} ${x}`).join(', ')}]`);
  console.log(`  render: wall ${m.wall} glazing ${m.glazing} columns ${m.windowColumns ?? m.columns ?? '-'} window ${m.window?.shape ?? '-'} class ${m.frontClass}`);
  const ph = r.measure.photo as { measure?: ReturnType<typeof summary>; missing?: string; kind?: string } | undefined;
  if (ph?.missing) console.log(`  photo: ${ph.missing}`);
  if (ph?.measure) console.log(`  photo:  wall ${ph.measure.wall} glazing ${ph.measure.glazing} columns ${ph.measure.windowColumns ?? ph.measure.columns ?? '-'} window ${ph.measure.window?.shape ?? '-'} class ${ph.measure.frontClass}  (${ph.kind})`);
  if (v) console.log(`  verdict ${v.verdict}: wall dL ${v.wall.dL} hue ${v.wall.dHue ?? '-'} (${v.wall.pass ? 'ok' : 'miss'}), glazing diff ${v.glazing.diff} (${v.glazing.pass ? 'ok' : 'miss'}), columns ${v.columns.a ?? '-'} vs ${v.columns.b ?? '-'} (${v.columns.pass ?? 'n/a'}), window ${v.window.a ?? '-'} vs ${v.window.b ?? '-'} (${v.window.pass ?? 'n/a'})${v.reasons.length ? `\n  reasons: ${v.reasons.join('; ')}` : ''}${v.warns.length ? `\n  warns: ${v.warns.join('; ')}` : ''}`);
  const ov = r.measure.overrides as { applied: string[]; notApplied: string[] } | null | undefined;
  if (ov) console.log(`  overrides applied: ${ov.applied.join(', ') || 'none'}; not expressible yet: ${ov.notApplied.length} field(s) (measure.json)`);
  for (const f of r.files) console.log(`  ${path.relative(process.cwd(), f)}`);
}

async function main() {
  const t0 = performance.now();
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.target && !args.spec && !args.intent)) { console.log(HELP); return; }
  const overrideFile = args.spec ?? args.intent;
  const readOv = () => overrideFile ? readOverride(overrideFile, args.spec ? 'spec' : 'intent') : undefined;
  let ov = readOv();
  const pandId = args.target ?? ov?.pandId;
  if (!pandId) throw new Error('no pand id: give one, or a spec/intent with a pandId');
  const session = new PreviewSession(args.look);
  const once = async () => {
    const t1 = performance.now();
    const house = args.recipe === true ? recipeHouseFor(pandId) : args.recipe || null;
    if (args.recipe && !house) throw new Error(`--recipe: no scripts/building-recipes/houses/*/intent.json names pand ${bare(pandId)}`);
    const r = house ? await renderRecipe(session, pandId, house, args) : await renderPand(session, pandId, args, ov);
    report(r, performance.now() - t1);
  };
  await once();
  console.log(`  total ${Math.round(performance.now() - t0)} ms (process start to here, excluding Node/tsx start-up)`);
  if (!args.watch) return;
  if (!overrideFile) throw new Error('--watch re-renders when the spec/intent file changes: give --spec or --intent');
  console.log(`watching ${overrideFile} (ctrl-c to stop)`);
  let pending: NodeJS.Timeout | null = null;
  // Watch the directory, not the file: editors that save by rename would end a file watch after the first save.
  const base = path.basename(overrideFile);
  fs.watch(path.dirname(path.resolve(overrideFile)), (_event, name) => {
    if (name !== base || !fs.existsSync(overrideFile)) return;
    if (pending) clearTimeout(pending);
    pending = setTimeout(async () => { try { ov = readOv(); await once(); } catch (e) { console.error(String((e as Error).stack ?? e)); } }, 50);
  });
  await new Promise(() => {});
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(REPO_ROOT, 'scripts/house-preview/preview.ts')) {
  main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
