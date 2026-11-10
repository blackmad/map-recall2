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
import { rasterise, type RasterAtlas, type RasterImage, type RasterMesh, type LitShading, type Vec3 } from '../../src/canalRecall/houseSpec/softRaster.ts';
import { previewVerdict, storeyLines, blurRgb, PRE_BLUR_PX, type PreviewVerdict } from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import { cityLitShading } from '../../src/canalRecall/houseSpec/previewLight.ts';
import { measureFacade, openingSplitFromArgs, MEASURE_PROFILES, profileName, type FacadeImage, type FacadeMeasurement } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { gameColour } from '../../src/canalRecall/buildingRecipe/likeness.ts';
import { renderElevation } from '../../src/canalRecall/landmarks/facadeCompare.ts';
import { pickWall } from '../pand-reference/select.ts';
import { pickWall as pickFootprintWall } from './wallSelect.ts';
import { loadMaterialSoup } from '../landmarks/material-soup.ts';
import type { MaterialSoup } from '../../src/canalRecall/landmarks/facadeCompare.ts';
import { loadAtlas, ATLAS_DIR } from './atlas.ts';
import { REPO_ROOT } from './nodeDom.ts';

/** house-line measuring profile (all four H2d parts) unless a flag picks another reading; printed in every sheet header and measure.json */
export const houseLineSplit = () => ({ openingSplit: MEASURE_PROFILES.houseLine as boolean | Partial<import('../../src/canalRecall/buildingRecipe/measureFacade.ts').OpeningSplit>, ...openingSplitFromArgs(process.argv) });
export const profileUsed = () => profileName(houseLineSplit().openingSplit);

export const HELP = `npm run house:preview -- <pandId | spec.json> [flags]

Renders one house's front elevation in Node through the route the game draws it by: the installed GLB (chunk or
ordinary model) when models/covers.json covers the pand, else the game's own chunk builder (threeBuildingFeatures
buildFeatureChunk, the decorator chain of scripts/world/pipeline.ts) and facade atlas painter. A software rasteriser
(src/canalRecall/houseSpec/softRaster.ts) draws it in the ride's lit city look. No dev server, no browser.

  <pandId>            BAG pand id (0363100012164843 or NL.IMBAG.Pand.0363100012164843)
  <spec.json>         a house spec file: { "pandId": "...", "design": { fronts, roof, palette, ... } }
                      (same as --spec <file>)

Flags
  --route <route>     generic | spec | installed. Default: spec when --spec/--intent is given, else installed when
                      models/covers.json covers the pand with a chunk-* or ordinary-* model, else generic (what the
                      game draws). A landmark cover is not rendered (generic, with a note)
  --spec <path>       apply a house spec's design to the pand before the decorators run (see "Overrides")
  --intent <path>     apply a CanalHouseIntent (scripts/building-recipes/houses/<id>/intent.json or a block-face
                      house intent) the same way; its pandId names the pand when no pand id is given
  --photo             add the reference photo: staging/pand-reference/<pand>/front.jpg, else the block-face strip
                      crop of the pand's wall (scripts/block-face/faces/*/strip.json), else the house:crops crop
                      (--crops); writes compare.png and prints the likeness verdict (wall dL/hue, glazing, columns,
                      window shape) of render vs photo
  --crops <dir>       the house:crops archive (a map-recall2-source-data checkout holding pand-crops/<pand>/front.jpg;
                      default env HOUSE_CROPS_ARCHIVE); the describe envelope's best-of-years pick is used when present
  --prefer-crop       take the house:crops crop before the block-face strip
  --strip <dir>       take this strip first (a directory holding strip.json + strip.jpg, e.g. a leaf-off capture day
                      from scripts/block-face/intake.ts --date, staged under staging/block-face/<face>-w<year>)
  --chunk <face>      render the block face compiled by scripts/block-face/compile.ts --face=<face> and not installed
                      (staging/block-face/<face>/chunk.glb, placed by its manifest-entry.json) instead of the route the
                      game draws today: the after frame of a chunk change before the integrator installs it
  --threeq            add a three-quarter perspective view (threeq.png): 20 degree field of view, flat ground at
                      the median ground height of the drawn buildings
  --recipe [<id>]     the recipe route: compile scripts/building-recipes/houses/<id> (default: the house whose
                      intent names this pand) with the recipe compiler and render its GLB
  --unlit             the legacy unlit look: the near-tier facade shader with its baked shade for generic chunks,
                      renderElevation in flat game colours for GLBs (default: the lit city look for generic chunks,
                      sun and sky of the ride's sunny rig, wall gain, sky tint on glazing)
  --no-wall-vs-trim   measure the wall as before lane H2c: a pale thin band may be picked as the wall on a dark front
                      (default: wallTrim.ts, the dark body outweighing the bands is the wall)
  --opening-split=<p> measure with the named opening-split parts only (groups, core, solidBody, clusterWall; comma-separated)
                      instead of the house-line profile (all four parts); every sheet header names the profile used
  --no-opening-split  measure as before lane H2d: every storey of a dark front fills into one frame, the wall colour is the
                      median of the body cluster with the most interior cells (default: each opening is its glass plus
                      a one-cell frame, lintels and sills are trim, the wall is the median over the picked wall cluster)
  --glb-lit           draw a GLB route's front through the rig's Lambert too (default: flat game colours,
                      which matched the ride frame; the Lambert drew an installed wall 0.11 L dark)
  --wall <edge|deg>   frame this footprint wall: an edge index of the outer ring (the audit's edge field) or the edge whose outward
                      normal bearing is nearest, e.g. 215deg. Sets the front and the 3/4 view's wall; overrides the reference's wall;
                      "face": the frontage of the block face that lists the pand (its facts.json fronts[0], the chord over an erker)
  --set <set.json>    render every pand of a house-line set (scripts/house-specs/sets/*.json, e.g. the standing
                      easy-houses-20261110 acceptance set) in one session, each into <out>/<pand> (default
                      artifacts/house-preview/sets/<set name>/<pand>), other flags applied to each
  --whole-tile        build the chunk from every building of the pand's z14 tile, exactly as the runtime groups
                      it (~4 s a render); by default the chunk holds the tile's buildings within 30 m of the pand,
                      which drew the same pixels as the whole tile at Nassaukade (0363100012164843)
  --watch             keep tile, neighbours, streets and atlas in memory and re-render whenever the spec/intent
                      file changes (needs --spec or --intent)
  --look <look>       atlas look (default photo)
  --ppm <n>           pixels per metre of the front elevation (default 50, the rectified photos' scale)
  --out <dir>         output directory (default artifacts/house-preview/<pand>)
  --help              this text

Verdict: wall colour family (dL, hue), window column count, storey count and window shape decide; glazing is printed
(information), never a PASS or a FAIL.

Output: <out>/front.png, threeq.png (--threeq), photo.png + compare.png (--photo), measure.json (route, timings, wall,
overrides, measurements, verdict). The sheet header names the route and the look. Render and photo are both blurred
by PRE_BLUR_PX (1.5 px Gaussian sigma at 50 px/m) before measureFacade. Atlas cache:
artifacts/house-preview/atlas-<look>-<size>-<painter hash>.bin (first run paints, later runs load).

Overrides (until the HouseSpec resolver of lane H1 lands): fronts[0].gable -> monumentGable, palette.wall (or
palette.brick) hex -> facadeMappedColour; every other design field is listed under overrides.notApplied in
measure.json (the generic path has no property for it yet).

Not reproduced: the far and roof distance tiers, mipmaps, cast shadows (a wall in another building's shadow draws
sunlit), fog, the analytic window SDF, the ground lift, post-processing, the GLB slot cells (an installed GLB draws
its game colours flat). When those matter, fall back to scripts/building-recipes/render.ts (headless
Chromium) or a ride frame.`;

// ---------------------------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------------------------
export type Route = 'generic' | 'spec' | 'installed' | 'recipe';
type Args = { target?: string; spec?: string; intent?: string; wall?: string; route?: Exclude<Route, 'recipe'>; unlit: boolean; glbLit: boolean; photo: boolean; threeq: boolean; recipe: string | boolean; wholeTile: boolean; watch: boolean; look: string; ppm: number; out?: string; crops?: string; preferCrop: boolean; chunk?: string; strip?: string; set?: string; help: boolean };
export function parseArgs(argv: string[]): Args {
  const a: Args = { unlit: false, glbLit: false, photo: false, threeq: false, recipe: false, wholeTile: false, watch: false, look: 'photo', ppm: 50, preferCrop: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case '--help': case '-h': a.help = true; break;
      case '--photo': a.photo = true; break;
      case '--threeq': a.threeq = true; break;
      case '--unlit': a.unlit = true; break;
      case '--glb-lit': a.glbLit = true; break;
      case '--no-wall-vs-trim': case '--no-opening-split': case '--opening-split': break; // read by measureBlurred
      case '--route': {
        const r = value();
        if (r !== 'generic' && r !== 'spec' && r !== 'installed') throw new Error(`--route ${r}: generic, spec or installed`);
        a.route = r; break;
      }
      case '--watch': a.watch = true; break;
      case '--whole-tile': a.wholeTile = true; break;
      case '--recipe': a.recipe = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') && !/^(NL\.IMBAG\.Pand\.)?\d{16}$/.test(argv[i + 1]) ? argv[++i] : true); break;
      case '--spec': a.spec = value(); break;
      case '--wall': a.wall = value(); break;
      case '--intent': a.intent = value(); break;
      case '--look': a.look = value(); break;
      case '--ppm': a.ppm = Number(value()); break;
      case '--out': a.out = value(); break;
      case '--crops': a.crops = value(); break;
      case '--prefer-crop': a.preferCrop = true; break;
      case '--chunk': a.chunk = value(); break;
      case '--strip': a.strip = value(); break;
      case '--set': a.set = value(); break;
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
  // The stated bays, as the game's decorator writes them once released (houseSpec/decorate.ts specRecipe.bays): the
  // mesher fits the street run to them (whole cells, or half-cell axis units for an odd count, H1c #350).
  const bays = Number.isInteger(front.axisGrid) ? front.axisGrid as number : Number.isInteger(front.bays) ? front.bays as number : undefined;
  if (bays && bays > 0) { patch.specRecipe = { bays }; applied.push(`fronts[0].${Number.isInteger(front.axisGrid) ? 'axisGrid' : 'bays'} -> specRecipe.bays=${bays}`); }
  for (const k of Object.keys(front)) if (k !== 'gable' && k !== 'id' && !(bays && (k === 'bays' || k === 'axisGrid'))) notApplied.push(`fronts[0].${k}`);
  // The wall colour: threeBuildingFeatures meshBuildingFor takes `facadeMappedColour` as the sourced wall in the photo look.
  const palette = (o.design.palette ?? {}) as Record<string, unknown>;
  const wallKey = ['wall', 'brick'].find(k => typeof palette[k] === 'string' && /^#[0-9a-f]{6}$/i.test(palette[k] as string));
  if (wallKey) { patch.facadeMappedColour = palette[wallKey]; applied.push(`palette.${wallKey} -> facadeMappedColour=${palette[wallKey]}`); }
  for (const k of Object.keys(palette)) if (k !== wallKey) notApplied.push(`palette.${k}`);
  for (const k of Object.keys(o.design)) if (k !== 'fronts' && k !== 'palette') notApplied.push(k);
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
  /** The ride's lit city look (sunny rig) for this atlas look. */
  readonly light: LitShading;
  constructor(readonly look: string) { this.light = cityLitShading('sunny', look as 'photo'); }

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

async function frontWall(pandId: string, own: Feature, neighbours: Feature[], wallSpec?: string): Promise<FrontWall> {
  if (wallSpec === 'face') {
    // --wall face (lane H7 round 2): the street frontage of the block face that lists the pand (its facts.json fronts[0]
    // endpoints: the chord over a BAG erker, Nassaukade 146), not one footprint edge of it.
    const faces = path.join(REPO_ROOT, 'scripts/block-face/faces');
    for (const face of fs.existsSync(faces) ? fs.readdirSync(faces).sort() : []) {
      const f = path.join(faces, face, 'pands', bare(pandId), 'facts.json');
      if (!fs.existsSync(f)) continue;
      const fr = readJson(f).fronts?.[0];
      if (!fr?.endpointsRD) continue;
      let [a, b] = fr.endpointsRD as [number, number][];
      // wallFrame's outward normal is (right.y, -right.x): order a -> b so it agrees with the face's outward normal.
      const n = fr.outwardNormalRD as [number, number] | undefined, r = [b[0] - a[0], b[1] - a[1]];
      if (n && r[1] * n[0] - r[0] * n[1] < 0) [a, b] = [b, a];
      return { a: rdToLngLat({ x: a[0], y: a[1] }), b: rdToLngLat({ x: b[0], y: b[1] }), lengthM: Math.hypot(b[0] - a[0], b[1] - a[1]), source: `--wall face: ${face} frontage (${fr.street ?? ''})` };
    }
    throw new Error(`${pandId}: --wall face: no block face lists the pand`);
  }
  if (wallSpec) {
    // --wall: the framed wall is a footprint edge (index or bearing), not the reference's or pickWall's choice.
    const outer = (asPolygons(own.geometry)[0]?.[0] ?? []) as LngLat[];
    const p = pickFootprintWall(outer, wallSpec);
    return { a: p.a, b: p.b, lengthM: p.lengthM, source: `--wall ${wallSpec}: footprint edge ${p.edge} (outward ${p.bearingDeg.toFixed(0)} deg)` };
  }
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
async function referencePhoto(pandId: string, wall: FrontWall, ppm: number, opts: { crops?: string; preferCrop?: boolean; strip?: string } = {}): Promise<Photo | null> {
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
  // house:crops (lane H7): <archive>/pand-crops/<pand>/front.jpg, rectified by the same pickWall + rectifyWall as the
  // pand-reference crop (x along the wall seen from the street, 50 px/m, or 40 px/m on the strip route). The best-of-years
  // pick named by the describe envelope (scripts/house-specs/generated/<buurt>/<pand>.json crop.file) wins when it exists.
  const cropPhoto = async (): Promise<Photo | null> => {
    if (!opts.crops) return null;
    const cdir = path.join(opts.crops, 'pand-crops', bare(pandId)), fj = path.join(cdir, 'front.json');
    if (!fs.existsSync(fj)) return null;
    const j = readJson(fj), crop = j.crop;
    if (!crop?.pixelsPerMetre || !crop?.wallHeightM) return null;
    // The crop's wall must be the preview's wall (both pickWall): endpoints within 1 m, either order.
    const pa = lngLatToRd(wall.a), pb = lngLatToRd(wall.b), d = (p: { x: number; y: number }, q: number[]) => Math.hypot(p.x - q[0], p.y - q[1]);
    if (j.wall?.a && Math.min(Math.max(d(pa, j.wall.a), d(pb, j.wall.b)), Math.max(d(pa, j.wall.b), d(pb, j.wall.a))) > 1) return null;
    let file = path.join(cdir, 'front.jpg');
    const gen = path.join(REPO_ROOT, 'scripts/house-specs/generated');
    for (const b of fs.existsSync(gen) ? fs.readdirSync(gen) : []) {
      const env = path.join(gen, b, `${bare(pandId)}.json`);
      if (fs.existsSync(env)) { const cf = readJson(env).crop?.file; if (cf && fs.existsSync(path.join(cdir, cf))) file = path.join(cdir, cf); break; }
    }
    if (!fs.existsSync(file)) return null;
    return toImage(fs.readFileSync(file), crop.wallHeightM, file, `house:crops ${j.method ?? 'wall'} ${j.missionDate ?? ''} (${crop.pixelsPerMetre} px/m)`, undefined, ppm / crop.pixelsPerMetre);
  };
  if (opts.preferCrop) { const c = await cropPhoto(); if (c) return c; }
  // Block-face strips: the face whose spans list the pand; crop the wall's [a, b] along the strip's u axis.
  const fromStrip = (s: { frame: { midRD: number[]; uRD: number[] }; x0M: number; pixelsPerMetre: number; width: number; heightM: number; date?: string }, img: string, label: string): Photo | null => {
    const along = (ll: LngLat) => { const p = lngLatToRd(ll); return (p.x - s.frame.midRD[0]) * s.frame.uRD[0] + (p.y - s.frame.midRD[1]) * s.frame.uRD[1]; };
    let x0 = along(wall.a), x1 = along(wall.b);
    if (x1 < x0) [x0, x1] = [x1, x0];
    const left = Math.max(0, Math.round((x0 - s.x0M) * s.pixelsPerMetre)), right = Math.min(s.width, Math.round((x1 - s.x0M) * s.pixelsPerMetre));
    if (right - left < 10) return null;
    return toImage(fs.readFileSync(img), s.heightM, img, `block-face strip ${label} ${s.date ?? ''} (${s.pixelsPerMetre} px/m)`, { left, width: right - left }, ppm / s.pixelsPerMetre);
  };
  // `--strip <dir>` (lane H7 round 2): an explicit strip (strip.json + strip.jpg in one directory, e.g. a leaf-off capture
  // day from intake.ts --date) before the face strips.
  if (opts.strip) {
    const sj = path.join(opts.strip, 'strip.json'), img = path.join(opts.strip, 'strip.jpg');
    if (fs.existsSync(sj) && fs.existsSync(img)) {
      const text = fs.readFileSync(sj, 'utf8');
      if (text.includes(bare(pandId))) { const got = fromStrip(JSON.parse(text), img, path.basename(opts.strip)); if (got) return got; }
    }
  }
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
    const got = fromStrip(s, img, face);
    if (got) return got;
  }
  return opts.preferCrop ? null : cropPhoto();
}

export type PreviewResult = { pandId: string; out: string; files: string[]; timings: Record<string, number>; measure: Record<string, unknown> };
type Timer = { t: Record<string, number>; mark: (k: string) => void };
const timer = (): Timer => { let t0 = performance.now(); const t: Record<string, number> = {}; return { t, mark: k => { t[k] = Math.round(performance.now() - t0); t0 = performance.now(); } }; };

/** measureFacade after the shared pre-blur (previewVerdict.ts PRE_BLUR_PX), so render and photo measure alike. */
export function measureBlurred(image: FacadeImage, box: Parameters<typeof measureFacade>[0]['box'], lines: number[]): FacadeMeasurement {
  return measureFacade({ image: { ...image, rgb: blurRgb(image.rgb, image.width, image.height, PRE_BLUR_PX) }, box, lines, ...(process.argv.includes('--no-wall-vs-trim') ? { wallVsTrim: false } : {}), ...houseLineSplit() });
}

// ---------------------------------------------------------------------------------------------------------------
// Routes: what the game draws for a pand (models/covers.json), and the override (spec) route
// ---------------------------------------------------------------------------------------------------------------
export type Cover = { key: string; kind: 'chunk' | 'ordinary' | 'landmark' };
let coversCache: Record<string, { p?: string[] }> | null = null;
/** The installed model covering the pand in public/canal-drive/models/covers.json (what the runtime suppresses the generic building for). */
export function coverOf(pandId: string): Cover | null {
  coversCache ??= readJson(path.join(REPO_ROOT, 'public/canal-drive/models/covers.json')).models as Record<string, { p?: string[] }>;
  for (const [key, v] of Object.entries(coversCache)) if ((v.p ?? []).includes(bare(pandId))) return { key, kind: key.startsWith('chunk-') ? 'chunk' : key.startsWith('ordinary-') ? 'ordinary' : 'landmark' };
  return null;
}

/** The route a render takes, and why. */
export function resolveRoute(asked: Args['route'], hasOverride: boolean, cover: Cover | null): { route: Exclude<Route, 'recipe'>; why: string } {
  const drawable = cover && cover.kind !== 'landmark';
  if (asked === 'installed') {
    if (!cover) throw new Error('--route installed: models/covers.json covers no model for this pand');
    if (!drawable) throw new Error(`--route installed: the pand is covered by landmark ${cover.key}; the preview renders chunk-* and ordinary-* models only`);
    return { route: 'installed', why: `--route installed (${cover.key})` };
  }
  if (asked === 'spec') {
    if (!hasOverride) throw new Error('--route spec needs --spec or --intent');
    return { route: 'spec', why: '--route spec' };
  }
  if (asked === 'generic') return { route: 'generic', why: `--route generic${cover ? ` (the game draws ${cover.key})` : ''}` };
  if (hasOverride) return { route: 'spec', why: `default: --spec/--intent given${cover ? ` (the game draws ${cover.key} today)` : ''}` };
  if (drawable) return { route: 'installed', why: `default: models/covers.json ${cover!.key}` };
  if (cover) return { route: 'generic', why: `default: covered by landmark ${cover.key}, which the preview does not render; showing the generic path` };
  return { route: 'generic', why: 'default: no installed model covers the pand' };
}

type Placement = { key: string; glb: string; anchor: LngLat; northOffsetDegrees: number; mirror: boolean; source: string };
/** Where the runtime puts an installed model: chunks.json for chunk-*, the ordinary catalogue for ordinary-*. */
export function placementOf(cover: Cover): Placement {
  const data = path.join(REPO_ROOT, 'public/canal-drive/ordinary-buildings-data');
  const glbOf = (url: string) => path.join(REPO_ROOT, 'public/canal-drive', url.replace(/^\.\//, '').replace(/\?.*$/, ''));
  if (cover.kind === 'chunk') {
    const e = (readJson(path.join(data, 'chunks.json')).chunks as { id: string; modelUrl: string; instance: { anchor: LngLat; northOffsetDegrees?: number; mirror?: boolean } }[]).find(c => c.id === cover.key);
    if (!e) throw new Error(`${cover.key}: not in ordinary-buildings-data/chunks.json`);
    return { key: cover.key, glb: glbOf(e.modelUrl), anchor: e.instance.anchor, northOffsetDegrees: e.instance.northOffsetDegrees ?? 0, mirror: !!e.instance.mirror, source: 'ordinary-buildings-data/chunks.json' };
  }
  if (cover.kind === 'ordinary') {
    const models = readJson(path.join(data, 'catalogue.json')).models;
    const e = (Array.isArray(models) ? models : Object.values(models) as never[]).find((m: { id: string }) => m.id === cover.key) as { modelUrl: string; anchor: LngLat; instance?: { anchor?: LngLat; northOffsetDegrees?: number; mirror?: boolean } } | undefined;
    if (!e) throw new Error(`${cover.key}: not in ordinary-buildings-data/catalogue.json`);
    return { key: cover.key, glb: glbOf(e.modelUrl), anchor: e.instance?.anchor ?? e.anchor, northOffsetDegrees: e.instance?.northOffsetDegrees ?? 0, mirror: !!e.instance?.mirror, source: 'ordinary-buildings-data/catalogue.json' };
  }
  throw new Error(`${cover.key}: landmarks are not rendered by the preview`);
}

/** A block face compiled by scripts/block-face/compile.ts --face=<face> and not installed: its chunk.glb placed by the
 *  manifest-entry.json the install would write into chunks.json (lane H7: the before|after of a chunk extension). */
export function stagedChunkPlacement(face: string): Placement {
  const dir = path.join(REPO_ROOT, 'staging/block-face', face), e = readJson(path.join(dir, 'manifest-entry.json'));
  return { key: e.id, glb: path.join(dir, 'chunk.glb'), anchor: e.instance.anchor, northOffsetDegrees: e.instance.northOffsetDegrees ?? 0, mirror: !!e.instance.mirror, source: `staging/block-face/${face}/manifest-entry.json` };
}

/**
 * GLB local (x, y up, z; -z north at offset 0, +x toward bearing 90 + offset, mirror flips x) to chunk metres
 * (x east, y north, z up), as the runtime instances ordinary models and chunks.
 */
function placedToEnu(p: Placement): (x: number, y: number, z: number) => Vec3 {
  const [ex, ny] = chunkMetres(p.anchor[0], p.anchor[1]), th = p.northOffsetDegrees * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  return (x, y, z) => { const xm = p.mirror ? -x : x; return [ex + xm * c - z * s, ny - xm * s - z * c, y]; };
}
/** Recipe GLB (x east, y up, z south, RD metres from anchorRD) to chunk metres, through RD -> WGS84 per vertex. */
function recipeToEnu(anchorRD: [number, number]): (x: number, y: number, z: number) => Vec3 {
  return (x, y, z) => { const [lng, lat] = rdToLngLat({ x: anchorRD[0] + x, y: anchorRD[1] - z }); const [e, n] = chunkMetres(lng, lat); return [e, n, y]; };
}
function soupToEnu(soup: MaterialSoup, f: (x: number, y: number, z: number) => Vec3): MaterialSoup {
  const P = soup.positions, out: number[] = new Array(P.length);
  for (let v = 0; v * 3 < P.length; v++) { const q = f(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); out[v * 3] = q[0]; out[v * 3 + 1] = q[1]; out[v * 3 + 2] = q[2]; }
  const { normals: _n, ...rest } = soup;
  return { ...rest, positions: out };
}
/** One texel, mask (0, 1): the colour is the vertex accent, untouched by the wall gain (GLB materials are not chunk walls). */
const FLAT_ATLAS: RasterAtlas = { colour: Uint8Array.of(255, 255, 255, 255), mask: Uint8Array.of(0, 255), size: 1, total: 1 };
/** A placed soup as a raster mesh: vertices unshared, each triangle's game colour (likeness.ts gameColour) as accent. */
function soupMesh(soup: MaterialSoup): RasterMesh {
  const nt = soup.indices.length / 3, colours = soup.materials.map(m => gameColour(m as never));
  const m: RasterMesh = { positions: new Float32Array(nt * 9), uvs: new Float32Array(nt * 6), layers: new Uint8Array(nt * 3), tints: new Uint8Array(nt * 12).fill(255), accents: new Uint8Array(nt * 12), indices: new Uint32Array(nt * 3) };
  for (let t = 0; t < nt; t++) {
    const c = colours[soup.triMaterial[t]] ?? [128, 128, 128];
    for (let k = 0; k < 3; k++) {
      const v = soup.indices[t * 3 + k], o = t * 3 + k;
      m.positions.set([soup.positions[v * 3], soup.positions[v * 3 + 1], soup.positions[v * 3 + 2]], o * 3);
      m.accents.set([c[0], c[1], c[2], 255], o * 4);
      m.indices[o] = o;
    }
  }
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Shared: the 3/4 view, measurement, photo and sheet
// ---------------------------------------------------------------------------------------------------------------
const PAVEMENT: Vec3 = [143, 138, 128];
/** The ground plane's colour: pavement under the rig's sun and sky (lit), or the albedo (unlit). */
function groundRgb(light: LitShading | undefined): Vec3 {
  if (!light) return PAVEMENT;
  const lin = (b: number) => { const s = b / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const enc = (x: number) => Math.round(255 * Math.min(1, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
  return [0, 1, 2].map(k => enc(lin(PAVEMENT[k]) * (light.sun[k] * Math.max(0, light.sunDir[2]) + light.sky[k]) / Math.PI)) as unknown as Vec3;
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
export const THREEQ_FOV_DEG = 20;
function threeqView(frame: ReturnType<typeof wallFrame>, top: number, groundZ: number) {
  const mid: Vec3 = [frame.origin[0] + frame.right[0] * frame.len / 2, frame.origin[1] + frame.right[1] * frame.len / 2, groundZ + top * 0.45];
  const size = Math.max(frame.len * 1.6, top) * 1.25, dist = size / 2 / Math.tan(THREEQ_FOV_DEG / 2 * Math.PI / 180), yaw = 38 * Math.PI / 180;
  const [nx, ny] = frame.normal, dx = nx * Math.cos(yaw) - ny * Math.sin(yaw), dy = nx * Math.sin(yaw) + ny * Math.cos(yaw);
  return { kind: 'perspective' as const, eye: [mid[0] + dx * dist, mid[1] + dy * dist, groundZ + top * 0.9] as Vec3, target: mid, fovDeg: THREEQ_FOV_DEG, width: 640, height: 800 };
}

type Finish = { pandId: string; route: Route; why: string; args: Args; out: string; files: string[]; front: { width: number; height: number; rgba: Uint8ClampedArray }; top: number; eaves: number; lines: number[]; frameLen: number; wall: FrontWall; label: string; measure: Record<string, unknown>; tm: Timer; shader?: string };
async function finish(f: Finish): Promise<PreviewResult> {
  const { args, front, top, eaves, lines, wall, tm } = f;
  const look = f.shader ?? (args.unlit ? 'unlit (legacy)' : 'lit city look (sunny rig)');
  const mbox = { u0: Math.min(0.2, f.frameLen / 4), u1: f.frameLen - Math.min(0.2, f.frameLen / 4), v0: 0, v1: eaves };
  const renderM = measureBlurred(facadeImage(front, args.ppm, top), mbox, lines);
  const measure: Record<string, unknown> = { profile: profileUsed(), pandId: bare(f.pandId), route: f.route, routeWhy: f.why, shader: f.shader ?? (args.unlit ? 'unlit' : 'lit'), preBlurPx: PRE_BLUR_PX, ...f.measure, heights: { topM: +top.toFixed(2), eavesM: +eaves.toFixed(2), lines }, render: summary(renderM) };
  if (args.photo) {
    const photo = await referencePhoto(f.pandId, wall, args.ppm, { crops: args.crops ?? process.env.HOUSE_CROPS_ARCHIVE, preferCrop: args.preferCrop, strip: args.strip });
    if (!photo) measure.photo = { missing: `no staging/pand-reference/${bare(f.pandId)}/front.jpg, no block-face strip lists the pand and no house:crops crop (--crops <archive>/pand-crops/${bare(f.pandId)}/front.jpg; run npm run house:crops -- --buurt <code> --pand ${bare(f.pandId)})` };
    else {
      const photoM = measureBlurred(photo.image, { ...mbox, v1: Math.min(mbox.v1, photo.image.topM) }, lines.filter(l => l <= photo.image.topM));
      const verdict = previewVerdict(renderM, photoM);
      measure.photo = { file: path.relative(REPO_ROOT, photo.file), kind: photo.kind, measure: summary(photoM) };
      measure.verdict = verdict;
      fs.writeFileSync(path.join(f.out, 'photo.png'), photo.png); f.files.push(path.join(f.out, 'photo.png'));
      f.files.push(path.join(f.out, 'compare.png'));
      await compareSheet([{ png: await sharp(f.files[0]).png().toBuffer(), label: f.label, topM: top }, { png: photo.png, label: photo.kind, topM: photo.image.topM }], args.ppm, verdict, f.files[f.files.length - 1], `route ${f.route} (${f.why}) · ${look}`);
      tm.mark('photo');
    }
  }
  measure.timings = tm.t;
  fs.writeFileSync(path.join(f.out, 'measure.json'), JSON.stringify(measure, null, 1));
  f.files.push(path.join(f.out, 'measure.json'));
  return { pandId: bare(f.pandId), out: f.out, files: f.files, timings: tm.t, measure };
}

/** One render of one pand by the route the game draws it (see resolveRoute): front.png (+ threeq.png, compare.png) and measure.json in `out`. */
export async function renderPand(session: PreviewSession, pandId: string, args: Args, override?: Override): Promise<PreviewResult> {
  if (args.chunk) return renderInstalled(session, pandId, stagedChunkPlacement(args.chunk), args, `--chunk ${args.chunk}: the compiled, not installed staging/block-face chunk`);
  const cover = coverOf(pandId), { route, why } = resolveRoute(args.route, !!override, cover);
  if (route === 'installed') return renderInstalled(session, pandId, placementOf(cover!), args, why);
  return renderGeneric(session, pandId, args, route === 'spec' ? override : undefined, route, why);
}

/** The generic streamed path (and the spec route: the same path with the override on the source properties). */
export async function renderGeneric(session: PreviewSession, pandId: string, args: Args, override: Override | undefined, route: Route = 'generic', why = 'generic'): Promise<PreviewResult> {
  const tm = timer();
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
  tm.mark('tiles');
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
  tm.mark('context');
  const look = session.look as 'photo';
  const walls = buildFeatureChunk(features as never, look, 'walls', streets, profiles, context as never);
  const extras = buildFeatureChunk(features as never, look, 'extras', streets, profiles, context as never);
  const mesh = concatChunks([walls, extras]);
  const ownRanges = mesh.ranges.filter(r => r.id === own.properties.id);
  const inOwn = new Uint8Array(mesh.layers.length);
  for (const r of ownRanges) inOwn.fill(1, r.start, r.start + r.count);
  tm.mark('chunk');
  const atlas = (await session.ensureAtlas()).atlas;
  tm.mark('atlas');

  const wall = await frontWall(pandId, own, neighbours, args.wall);
  const frame = wallFrame(wall);
  let zMax = 0;
  for (let v = 0; v < inOwn.length; v++) if (inOwn[v]) zMax = Math.max(zMax, mesh.positions[v * 3 + 2]);
  const top = Math.ceil((zMax + 0.5) * 2) / 2;
  const lit = args.unlit ? undefined : session.light;
  const front = rasterise(mesh, atlas, { kind: 'ortho', origin: frame.origin, right: frame.right, normal: frame.normal, u0: 0, u1: frame.len, v0: 0, v1: top, pxPerM: args.ppm }, { supersample: 2, background: SKY, keep: v => inOwn[v] === 1, lit });
  tm.mark('raster');
  const out = path.resolve(args.out ?? path.join(ATLAS_DIR, bare(pandId)));
  fs.mkdirSync(out, { recursive: true });
  const files = [path.join(out, 'front.png')];
  await png(front, files[0]);
  // The shared ground: the median of each drawn building's lowest vertex.
  const lows = new Map<string, number>();
  for (const r of mesh.ranges) for (let v = r.start; v < r.start + r.count; v++) lows.set(r.id, Math.min(lows.get(r.id) ?? Infinity, mesh.positions[v * 3 + 2]));
  const groundZ = median([...lows.values()]);
  if (args.threeq) {
    // The 3/4 view shows the row the chunk holds (every building within ROW_M of the pand).
    const threeq = rasterise(mesh, atlas, threeqView(frame, top, groundZ), { supersample: 2, background: SKY, lit, ground: { z: groundZ, rgb: groundRgb(lit) } });
    files.push(path.join(out, 'threeq.png'));
    await png(threeq, files[files.length - 1]);
    tm.mark('threeq');
  }
  // Measurement on the wall below the eaves, with storey lines from the pand's own heights.
  const p = own.properties, eaves = Math.min(top, wallTopHeightM(p));
  return finish({
    pandId, route, why, args, out, files, front, top, eaves, lines: storeyLines(eaves, Number(p.groundFloorHeightM) || 3.2), frameLen: frame.len, wall, tm,
    label: route === 'spec' ? 'preview (spec route: generic path + overrides)' : 'preview (generic path)',
    measure: {
      tile, look: session.look, ppm: args.ppm, wall: { ...wall, lengthM: +frame.len.toFixed(2) }, groundZ: +groundZ.toFixed(2),
      chunk: { buildings: features.length, contextNeighbours: context.length, vertices: mesh.layers.length, ownVertices: ownRanges.reduce((s, r) => s + r.count, 0), triangles: mesh.indices.length / 3, wholeTile: args.wholeTile },
      atlas: { file: path.relative(REPO_ROOT, session.atlas!.file), painted: session.atlas!.painted },
      properties: p, overrides: ov ? { source: override!.source, applied: ov.applied, notApplied: ov.notApplied } : null,
    },
  });
}

/** The summary fields a reader compares (the full FacadeMeasurement is large). */
export function summary(m: FacadeMeasurement) {
  return { wall: m.wall.hex, wallRaw: m.wall.rawHex, material: m.material?.family ?? null, glazing: m.glazing, storeyGlazing: m.storeyGlazing, columns: m.columns, windowColumns: m.windowColumns ?? null, pitchM: m.pitchM, window: m.window, frontClass: m.frontClass, usable: +m.usableFraction.toFixed(3), foliage: +m.foliageFraction.toFixed(3), washedOut: +m.washedOutFraction.toFixed(3) };
}

/** Side by side at one scale, ground lines aligned, a header (route and look) and the verdict on top. */
export async function compareSheet(panels: { png: Buffer; label: string; topM: number }[], ppm: number, verdict: PreviewVerdict | null, file: string, header = '') {
  const metas = await Promise.all(panels.map(p => sharp(p.png).metadata()));
  const ground = Math.max(...panels.map(p => p.topM)) * ppm, head = 82, gap = 16;
  const width = Math.max(metas.reduce((s, m) => s + m.width!, 0) + gap * (panels.length + 1), 560);
  const height = Math.round(head + ground + 24);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const title = verdict ? [`${verdict.verdict} · wall ${verdict.wall.a} vs ${verdict.wall.b} · dL ${verdict.wall.dL}${verdict.wall.dHue !== null ? ` · hue ${verdict.wall.dHue}°` : ''}`,
    `glazing (info) ${verdict.glazing.a.toFixed(2)} vs ${verdict.glazing.b.toFixed(2)} · storeys ${verdict.storeys.a} vs ${verdict.storeys.b} · cols ${verdict.columns.a ?? '-'} vs ${verdict.columns.b ?? '-'} · window ${verdict.window.a ?? '-'} vs ${verdict.window.b ?? '-'}`] : ['', ''];
  const comps: { input: Buffer; left: number; top: number }[] = [];
  let x = gap;
  panels.forEach((p, i) => {
    const w = metas[i].width!;
    comps.push({ input: p.png, left: x, top: Math.round(head + ground - p.topM * ppm) });
    comps.push({ input: Buffer.from(`<svg width="${w}" height="20"><text x="0" y="15" font-family="Helvetica, Arial" font-size="13" fill="#1f2328">${esc(p.label)}</text></svg>`), left: x, top: head - 22 });
    x += w + gap;
  });
  comps.push({ input: Buffer.from(`<svg width="${width}" height="60"><text x="${gap}" y="15" font-family="Helvetica, Arial" font-size="12" fill="#57606a">${esc(`${header} · measure profile ${profileUsed()}`)}</text><text x="${gap}" y="34" font-family="Helvetica, Arial" font-size="13" font-weight="bold" fill="#1f2328">${esc(title[0])}</text><text x="${gap}" y="52" font-family="Helvetica, Arial" font-size="13" fill="#1f2328">${esc(title[1])}</text></svg>`), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: '#f4f4f2' } }).composite(comps).png().toFile(file);
}

// ---------------------------------------------------------------------------------------------------------------
// GLB routes: the installed model (covers.json) and the recipe compiler's model
// ---------------------------------------------------------------------------------------------------------------
type GlbJob = { soup: MaterialSoup; route: Route; why: string; label: string; measure: Record<string, unknown>; eavesHint?: number };
async function renderGlb(session: PreviewSession, pandId: string, job: GlbJob, args: Args, tm: Timer): Promise<PreviewResult> {
  const tile = session.tileOf(pandId), rows = await session.rows(tile);
  const own = rows.find(r => r.raw.properties.id === full(pandId))?.styled;
  if (!own) throw new Error(`${pandId} not in tile ${tile}`);
  const wall = await frontWall(pandId, own, [], args.wall);
  const frame = wallFrame(wall), soup = job.soup, P = soup.positions;
  // The wall's own slab: within the wall's span and no more than 3 m in front of its line (stoops, balconies).
  const along = (v: number) => (P[v * 3] - frame.origin[0]) * frame.right[0] + (P[v * 3 + 1] - frame.origin[1]) * frame.right[1];
  const out_ = (v: number) => (P[v * 3] - frame.origin[0]) * frame.normal[0] + (P[v * 3 + 1] - frame.origin[1]) * frame.normal[1];
  let zMax = 0, zMin = Infinity;
  for (let v = 0; v * 3 < P.length; v++) { const a = along(v); if (a >= 0 && a <= frame.len && Math.abs(out_(v)) < 30) { zMax = Math.max(zMax, P[v * 3 + 2]); zMin = Math.min(zMin, P[v * 3 + 2]); } }
  const groundZ = Number.isFinite(zMin) ? zMin : 0;
  const top = Math.ceil((zMax - groundZ + 0.5) * 2) / 2;
  const lit = args.unlit ? undefined : session.light;
  const mesh = soupMesh(soup);
  // keep() takes the raster mesh's (unshared) vertex index.
  const MP = mesh.positions, nearFace = (v: number) => (MP[v * 3] - frame.origin[0]) * frame.normal[0] + (MP[v * 3 + 1] - frame.origin[1]) * frame.normal[1] < 3;
  let front: { width: number; height: number; rgba: Uint8ClampedArray };
  // GLB fronts default to flat game colours: they matched the ride frame (the Nassaukade face of
  // chunk-face-clercq-236681: ride L 0.453, flat 0.461, the rig's Lambert on game colours 0.347), the game lights
  // installed models with more than the chunk rig's sky. --glb-lit draws them through the Lambert instead.
  if (args.unlit || !args.glbLit) {
    // renderElevation in its frame (x east, y up, z south): flat game colours x its facing shade, as the recipe route always drew.
    const el = soupElevation(soup, frame, args.ppm, groundZ, top);
    front = el;
  } else {
    front = rasterise(mesh, FLAT_ATLAS, { kind: 'ortho', origin: [frame.origin[0], frame.origin[1], groundZ], right: frame.right, normal: frame.normal, u0: 0, u1: frame.len, v0: 0, v1: top, pxPerM: args.ppm }, { supersample: 2, background: SKY, lit, twoSided: true, keep: nearFace });
  }
  tm.mark('raster');
  const out = path.resolve(args.out ?? path.join(ATLAS_DIR, bare(pandId)));
  fs.mkdirSync(out, { recursive: true });
  const files = [path.join(out, 'front.png')];
  await png(front, files[0]);
  if (args.threeq) {
    const threeq = rasterise(mesh, FLAT_ATLAS, threeqView({ ...frame, origin: [frame.origin[0], frame.origin[1], groundZ] }, top, groundZ), { supersample: 2, background: SKY, lit, twoSided: true, ground: { z: groundZ, rgb: groundRgb(lit) } });
    files.push(path.join(out, 'threeq.png'));
    await png(threeq, files[files.length - 1]);
    tm.mark('threeq');
  }
  const eaves = Math.min(top, job.eavesHint || wallTopHeightM(own.properties) || top);
  return finish({ pandId, route: job.route, why: job.why, args, out, files, front, top, eaves, lines: storeyLines(eaves, Number(own.properties.groundFloorHeightM) || 3.2), frameLen: frame.len, wall, tm, label: job.label, shader: args.unlit || !args.glbLit ? 'GLB flat game colours' : 'GLB, rig Lambert on game colours', measure: { tile, ppm: args.ppm, wall: { ...wall, lengthM: +frame.len.toFixed(2) }, groundZ: +groundZ.toFixed(2), ...job.measure } });
}

/** renderElevation of an ENU soup along the wall: [left, right] = the wall's span, rows from groundZ up to top. */
function soupElevation(soup: MaterialSoup, frame: ReturnType<typeof wallFrame>, ppm: number, groundZ: number, top: number) {
  // renderElevation's frame: x east, y up, z south.
  const P = soup.positions, Q: number[] = new Array(P.length);
  for (let v = 0; v * 3 < P.length; v++) { Q[v * 3] = P[v * 3]; Q[v * 3 + 1] = P[v * 3 + 2] - groundZ; Q[v * 3 + 2] = -P[v * 3 + 1]; }
  const ax = frame.origin[0], az = -frame.origin[1], nx = frame.normal[0], nz = -frame.normal[1];
  const bearing = (Math.atan2(nx, -nz) * 180 / Math.PI + 360) % 360;
  const tA = ax * nz + az * -nx; // facadeCompare: t = x * nz + z * (-nx), the viewer's right
  const cell = 1 / ppm;
  const el = renderElevation({ ...soup, positions: Q }, { name: 'front', bearing, span: [tA, tA + frame.len] } as never, cell);
  const colours = soup.materials.map(m => gameColour(m as never));
  // Onto the preview's canvas: width = wall length, height = top, ground at the bottom (renderElevation's rows run yMax .. min(0, yMin)).
  const W = Math.max(1, Math.round(frame.len * ppm)), H = Math.max(1, Math.round(top * ppm)), rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, ey = Math.round((el.yMax - (top - (y + 0.5) / ppm)) / cell - 0.5), ex = Math.round((tA + (x + 0.5) / ppm - el.tMin) / cell - 0.5);
    const i = ey >= 0 && ey < el.H && ex >= 0 && ex < el.W ? ey * el.W + ex : -1, m = i >= 0 ? el.mat[i] : -1;
    if (m < 0) { rgba.set([...SKY, 0], o); continue; }
    const c = colours[m], s = el.shade[i];
    rgba.set([c[0] * s, c[1] * s, c[2] * s, 255], o);
  }
  return { width: W, height: H, rgba };
}

export async function renderInstalled(session: PreviewSession, pandId: string, place: Placement, args: Args, why: string): Promise<PreviewResult> {
  const tm = timer();
  const soup = soupToEnu(await loadMaterialSoup(place.glb), placedToEnu(place));
  tm.mark('glb');
  return renderGlb(session, pandId, { soup, route: 'installed', why, label: `preview (installed ${place.key})`, measure: { installed: { ...place, glb: path.relative(REPO_ROOT, place.glb), triangles: soup.indices.length / 3 } } }, args, tm);
}

function recipeHouseFor(pandId: string): string | null {
  const dir = path.join(REPO_ROOT, 'scripts/building-recipes/houses');
  for (const id of fs.readdirSync(dir)) {
    const f = path.join(dir, id, 'intent.json');
    if (fs.existsSync(f) && bare(String(readJson(f).pandId ?? '')) === bare(pandId)) return id;
  }
  return null;
}

export async function renderRecipe(session: PreviewSession, pandId: string, house: string, args: Args): Promise<PreviewResult> {
  const tm = timer();
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/building-recipes/compile.ts', `--house=${house}`], { cwd: REPO_ROOT, stdio: 'pipe' });
  tm.mark('compile');
  const dir = path.join(REPO_ROOT, 'artifacts/building-recipes', house), report = readJson(path.join(dir, 'report.json'));
  const soup = soupToEnu(await loadMaterialSoup(path.join(dir, 'model.glb')), recipeToEnu(report.anchorRD));
  const eavesHint = Math.max(...(report.fit?.fronts ?? []).map((f: { eavesM?: number; crownBaseM?: number }) => f.eavesM ?? f.crownBaseM ?? 0), 0);
  return renderGlb(session, pandId, { soup, route: 'recipe', why: `--recipe ${house}`, label: `preview (recipe ${house})`, eavesHint, measure: { house, glb: path.relative(REPO_ROOT, path.join(dir, 'model.glb')), triangles: report.triangles } }, args, tm);
}

// ---------------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------------
function report(r: PreviewResult, ms: number) {
  const v = r.measure.verdict as PreviewVerdict | undefined, m = r.measure.render as ReturnType<typeof summary>;
  console.log(`${r.pandId} (route ${r.measure.route}: ${r.measure.routeWhy}; ${r.measure.shader}) ${Math.round(ms)} ms  [${Object.entries(r.timings).map(([k, x]) => `${k} ${x}`).join(', ')}]`);
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
  if (args.help || (!args.target && !args.spec && !args.intent && !args.set)) { console.log(HELP); return; }
  if (args.set) {
    // A house-line set (lane H9): every pand in one session, the same flags.
    const set = readJson(args.set) as { name: string; pands: { pandId: string }[] };
    const root = args.out ?? path.join(ATLAS_DIR, 'sets', set.name);
    const session = new PreviewSession(args.look);
    for (const { pandId } of set.pands) {
      const t1 = performance.now();
      report(await renderPand(session, pandId, { ...args, out: path.join(root, bare(pandId)) }), performance.now() - t1);
    }
    console.log(`  ${set.pands.length} pands, total ${Math.round(performance.now() - t0)} ms`);
    return;
  }
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
