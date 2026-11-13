/**
 * house:frames (lane H10, #358): the game's first-person camera where a street panorama was taken, its frame beside the
 * panorama cut to the same pose, the BAG wall outline drawn on both, and advisory flags. Builder lanes are accepted on
 * these pairs (docs/house-line.md §7).
 *
 * Node does the panorama side (pick, pose, cut, checks, sheets); tests/e2e/house-frames.spec.ts drives one game page
 * for the whole list through /tmp/canal-pw.sh. Why a spec and not a bare chromium script: the spec reuses helpers.ts
 * (openRoute, settleWorld, BUNDLES_DIR/WORLD_DIR) and playwright.config.ts's dev-server handling on PW_PORT, so the
 * frames are taken exactly as every other ride frame is.
 */
import './env.ts';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { findPands, lngLatToRd, loadRoads, nearestOnSeg, neighbourhood, normId, pointInRing, type Footprint } from '../pand-reference/core.ts';
import { exposedWalls, FACADE_WINDOW, listPanos, pickWall, rankPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { isLeaf } from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { aimPose, fpsFor, frameFor, gridConvergenceDeg, hfovDeg, wallOutline, wallPoint, CROWN_EXTRA_M, FRAME_H, FRAME_W, type FramePose, type WallQuad } from './pose.ts';
import { cutPerspective, loadEquirect, type PanoSize, type Rgb8 } from './photo.ts';
import { wallChange, wallLab, WALL_SAME_PCT } from './analyse.ts';
import { bare, edgeOffsets, flagsFor, measureHalf, openingsNote, pickSamples, relativeColour, readPicks, skyline, skylineMedian, type EdgeRead, type Hit, type PickSample } from './analyse.ts';

export const HELP = `npm run house:frames -- <input> [flags]

Puts the game's first-person camera where a street panorama was taken, looking where the panorama looks, renders the
frame and sets it beside the panorama cut to the same heading, pitch and field of view. The BAG wall outline is drawn on
both halves; its distance from the photo's facade edges is the alignment check. Advisory flags go on the caption.

Input (one of)
  --pands <id,id>        BAG pand ids (16 digits, with or without NL.IMBAG.Pand.)
  --face <id>            a block face (scripts/block-face/faces/<id>/intent.json houses[].pandId)
  --buurt <code>         every pand of a CBS buurt (AB07, BU0363AB07 or the name; house-crops/buurt.ts); use --max
  --list <file.json>     ["id", ...] or [{"pandId": "id", "bearing": 90, "at": [lng, lat], "key": "name"}, ...]
                         (bearing: prefer the wall facing it; at: the wall nearest this point, facing within 40 deg
                         of bearing; key: the output folder, for several walls of one pand;
                         notPanos: ["panoId", ...] skips those captures (re-pick a pose flagged otherBuilding);
                         maxDistM: this entry's --max-dist (a canal front from the far quay, a narrow street at 35 m);
                         chord: [[lng, lat], [lng, lat]], the wall's two end points, for a front stepped in edges under 3 m
                         that the exposed-wall rule drops: Nassaukade 146, 0363100012160704;
                         pano: "panoId", use that capture when it is in range)
                         Pinned poses: a pand in scripts/house-line/benchmark/eyeball-poses.json (the eyeball set) takes
                         its pinned pano and notPanos under --list and --pands; --no-pinned-poses ignores the file

Flags
  --year <yyyy>          only panoramas of that mission year
  --season winter|any    winter: Nov-Mar captures first (bare trees); default any
  --prefer-obliquity <deg>  after the season, captures whose pose fits the whole wall (not clipped), then those that see
                         the wall within <deg> of square, squarest first (the belt rule: winter, then under 30 deg; 45 deg
                         and more only as a second view); default off
  --max-dist <m>         panoramas up to <m> from the wall (default 35); 60 reaches across a canal, with --prefer-obliquity
                         a capture that fits the whole wall wins over a nearer clipped one
  --query '<q>'          game query; ?engine=own&cam=fps is added. Before/after of a spec change: '?world=live&houseSpecs=0'
                         vs '?world=live' (the baked world-v1 cells carry the specs already, so houseSpecs=0 alone
                         changes nothing), or a staged world through WORLD_DIR / BUNDLES_DIR (tests/e2e/helpers.ts)
  --label before|after   written on the caption and into pose.json
  --out <dir>            default artifacts/house-frames/<label or 'run'>
  --pano-size small|medium|full   panorama used for the cut (default medium, 4000 px)
  --bearing <deg>        prefer the wall facing this bearing (+-50 deg) for every pand
  --max <n>              at most n pands (after the input order)
  --reopen-every <n>     re-open the game page after n poses (default 40; it also re-opens after a crash)
  --before <dir>         a before/after: compare each game frame with <dir>/<key>/game.png (an earlier run of the same
                         list) on the target wall. pose.json gets compare {pct of target-wall pixels changed (OKLab
                         distance > 0.02), meanDE, wall OKLab L/C/hue before, after and photo, what the page decorated
                         the pand with in each run}; <out>/<key>/triple.jpg sets photo | before | after side by side;
                         a pair under 2 % changed is flagged sameAsBefore and printed as a WARNING: the flag compared
                         did not reach the pixels (a baked world, a flag the mesh worker never sees, a guard holding the
                         pand), and the pair proves nothing. With --lists, each list's before is <dir>/<basename of out>.
  --prep-only            pick, pose and cut, write <out>/job.json, no browser
  --post-only            redo the checks, pairs and sheets from <out> (after a browser run)
  --lists <a.json:outA,b.json:outB>
                         batch: several --list files in one browser session (one queue slot, one page, one dev
                         server); each list's pairs, sheets and summary go to its own out dir, exactly as a separate
                         --list run would write them (the page re-opens at each list, so frames match a separate
                         run). The batch job is <first out>/batch-job.json. Other flags apply
                         to every list; --out is ignored
  --reuse-photos         take the pick, pose and photo cut from the cache when this entry was framed before with the
                         same flags and the same frames/pose/photo code (a before/after re-run renders only game
                         frames). Every run writes the cache: HOUSE_FRAMES_CACHE, default the main checkout's
                         .cache/house-frames (prep/<entry hash>.json, photos/<pose hash>.jpg)
  --help

Per pand: <out>/<pand>/{photo.jpg, game.png, pair.jpg, pose.json}; per 6 pairs: <out>/contact-N.jpg; <out>/summary.json.

Pose: the street wall is pand-reference/select.ts pickWall; the panorama rankPanos (5-35 m, obliquity <= 55 deg),
re-ordered winter first (--season winter); a 2000 px pre-pass rejects sun glare (> 12 % of the frame 0-20 deg below the
horizon blown out) and a washed-out wall (> 30 % bright and colourless where another year reads 25 % less: scaffold sheeting,
overexposure; a white front is kept), then lowest foliage on the wall, then rank. The camera
stands at the panorama's position at its eye height (2.44 m over the ground, lensFor's datum), heads at the wall centre,
looks 5-30 deg down (the game camera cannot look up: MAX_PITCH_DEG 85) and opens its vertical FOV (45-120 deg) until the
wall and 1.5 m above it fit; a wall too tall for 120 deg is listed as clipped.

Browser: tests/e2e/house-frames.spec.ts through /tmp/canal-pw.sh (CANAL_PW overrides) on PW_PORT (default:
.worktree-port); never wrap house:frames in canal-pw.sh yourself (it takes its own slot). One page: open
the route once; per pose teleport, hand the engine the pose (the view's solveFps is replaced on the live instance; no
src/ change), settleWorld, hide the HUD, screenshot, pick the wall's surfaces (inspectBuilding).

Checks (pose.json)
  edges        photo and game: the facade's vertical ends and crown line against the projected outline, % of the
               width (a consistent-gradient search +-6 %); 'found' when the edge stands 1.8x over its window
  picks        the game's surfaces at 35 wall points and 14 over the crown: this pand, its cover model, another
               building, or sky/ground; 'drew' names the model or path (generic houses pick as footprint prisms)
  skyline      per column over the wall, where each half's sky ends (m on the wall plane); medians vs the crown line
  openings     photo and game counts (H2d houseLine profile), advisory only: a 'possible blank wall' note where the game
               reads <= 1 and the photo >= 3; no flag until checked against the H5h hand counts
  flags        missing (>= 50 % sky or
               ground), other building (>= 50 % another building or model), roof offset (the game's skyline > 1 m from the crown line
               where the photo's is within 1 m; or a model drawn >= 1.2 m over it on 2 of 7 columns), wall colour (the pand's wall L over its two neighbours' in the same
               half, photo vs game: an inversion across 1.0 (each side > 10 % from it) fires, else |ln ratio| > 0.35; one strip is used when only one
               reads (the caption says which), 'no ref' when none does; the picks must say the wall is this pand's).
               --post-only re-runs every check and flag on an existing frame dir (prepared.json + the frames)

Review: docs/house-line.md §7. Builders are accepted on these pairs, read by opus or a human.
`;

type Entry = { id: string; key?: string; bearing?: number; at?: [number, number]; chord?: [[number, number], [number, number]]; notPanos?: string[]; maxDistM?: number; pano?: string };

/** The eyeball set's pinned captures (lane PR1): one good panorama per pand, and the captures judged bad. */
export const PINNED_POSES = 'scripts/house-line/benchmark/eyeball-poses.json';
export function withPinnedPoses(pands: Entry[], file = PINNED_POSES): Entry[] {
  if (!fs.existsSync(file)) return pands;
  const pins = (JSON.parse(fs.readFileSync(file, 'utf8')).pands ?? {}) as Record<string, { pano?: string; notPanos?: string[] }>;
  return pands.map(e => {
    const pin = pins[e.id];
    if (!pin) return e;
    const notPanos = [...new Set([...(e.notPanos ?? []), ...(pin.notPanos ?? [])])];
    return { ...e, pano: e.pano ?? pin.pano, ...(notPanos.length ? { notPanos } : {}) };
  });
}
type Args = { pands: Entry[]; year?: number; season: 'winter' | 'any'; query: string; label: string; out: string; panoSize: PanoSize; bearing?: number; preferObliquityDeg?: number; maxDistM?: number; max: number; reopenEvery: number; prepOnly: boolean; postOnly: boolean; reusePhotos: boolean; before?: string; inputName: string };

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find(a => a.startsWith(`--${name}=`));
  return eq?.slice(name.length + 3);
}

async function parseArgs(argv: string[]): Promise<Args> {
  const label = arg(argv, 'label') ?? 'run';
  const out = path.resolve(arg(argv, 'out') ?? path.join('artifacts/house-frames', label));
  const bearing = arg(argv, 'bearing') !== undefined ? Number(arg(argv, 'bearing')) : undefined;
  let pands: Args['pands'] = [], inputName = '';
  if (arg(argv, 'pands')) { pands = arg(argv, 'pands')!.split(',').filter(Boolean).map(id => ({ id: bare(id.trim()) })); inputName = 'pands'; }
  else if (arg(argv, 'face')) {
    const face = arg(argv, 'face')!, intent = JSON.parse(fs.readFileSync(path.join('scripts/block-face/faces', face, 'intent.json'), 'utf8'));
    pands = (intent.houses ?? []).map((h: any) => ({ id: bare(String(h.pandId)) })).filter((p: { id: string }) => p.id); inputName = `face ${face}`;
  } else if (arg(argv, 'buurt')) {
    const { loadBuurt, pandsInBuurt } = await import('../house-crops/buurt.ts');
    const b = await loadBuurt(arg(argv, 'buurt')!);
    pands = (await pandsInBuurt(b)).map(f => ({ id: bare(f.id) })); inputName = `buurt ${b.code} ${b.name}`;
  } else if (arg(argv, 'list')) {
    const list = JSON.parse(fs.readFileSync(arg(argv, 'list')!, 'utf8'));
    pands = list.map((e: any) => typeof e === 'string' ? { id: bare(e) } : { id: bare(String(e.pandId ?? e.id)), key: e.key, bearing: e.bearing, at: e.at, chord: e.chord, notPanos: e.notPanos, maxDistM: e.maxDistM, pano: e.pano }); inputName = `list ${path.basename(arg(argv, 'list')!)}`;
  }
  if ((arg(argv, 'list') || arg(argv, 'pands')) && !argv.includes('--no-pinned-poses')) pands = withPinnedPoses(pands);
  const season = arg(argv, 'season') === 'winter' ? 'winter' : 'any';
  const max = Number(arg(argv, 'max') ?? Infinity);
  return { pands: pands.slice(0, max), year: arg(argv, 'year') ? Number(arg(argv, 'year')) : undefined, season, ...(arg(argv, 'prefer-obliquity') !== undefined ? { preferObliquityDeg: Number(arg(argv, 'prefer-obliquity')) } : {}), ...(arg(argv, 'max-dist') !== undefined ? { maxDistM: Number(arg(argv, 'max-dist')) } : {}), query: arg(argv, 'query') ?? '', label, out, panoSize: (arg(argv, 'pano-size') as PanoSize) ?? 'medium', bearing, max, reopenEvery: Number(arg(argv, 'reopen-every') ?? 40), prepOnly: argv.includes('--prep-only'), postOnly: argv.includes('--post-only'), reusePhotos: argv.includes('--reuse-photos'), before: arg(argv, 'before') ? path.resolve(arg(argv, 'before')!) : undefined, inputName };
}

// ---- what the game draws for a pand (route) -------------------------------------------------------------------------
let covers: Record<string, { p?: string[] }> | null = null;
export function coverOf(pandId: string): string | null {
  covers ??= JSON.parse(fs.readFileSync('public/canal-drive/models/covers.json', 'utf8')).models as Record<string, { p?: string[] }>;
  for (const [key, v] of Object.entries(covers)) if ((v.p ?? []).includes(bare(pandId))) return key;
  return null;
}
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, s = Math.sin(lat * Math.PI / 180); return { x: Math.floor((lng + 180) / 360 * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) }; };
const specTiles = new Map<string, any>();
/** The HouseSpec extract's entry for the pand (route 'r', runtime view 'v'), or null. */
export function specOf(pandId: string, lngLat: [number, number]): { r: string; v: Record<string, unknown> } | null {
  const t = tileOf(lngLat[0], lngLat[1]), key = `${t.x}/${t.y}`;
  if (!specTiles.has(key)) {
    let json: any = null;
    try { const b = fs.readFileSync(`public/data/extracts/amsterdam/house-specs/14/${t.x}/${t.y}.json.gz`); json = JSON.parse((b[0] === 0x1f ? zlib.gunzipSync(b) : b).toString('utf8')); } catch { /* no specs here */ }
    specTiles.set(key, json);
  }
  return specTiles.get(key)?.buildings?.[normId(pandId)] ?? null;
}
export function routeOf(pandId: string, lngLat: [number, number], query: string): string {
  const cover = coverOf(pandId);
  if (cover) return `installed ${cover}`;
  const spec = specOf(pandId, lngLat), off = /houseSpecs=0/.test(query);
  if (!spec) return 'generic';
  const fields = Object.keys(spec.v ?? {}).filter(k => k !== 'src');
  return `${spec.r === 'recipe' ? 'spec recipe' : 'generic'}${fields.length ? ` + spec (${fields.join(', ')})${off ? ' [houseSpecs=0: off]' : ''}` : ''}`;
}

// ---- prepare: wall, panorama, pose, photo cut -----------------------------------------------------------------------
type Prepared = {
  pandId: string; key: string; street: string; wall: WallQuad; wallLenM: number; pick: Omit<PanoPick, 'record'> & { url: string }; pose: FramePose; hfovDeg: number;
  samples: PickSample[]; foliage: number | null; candidates: number; route: string; why: string[];
};
type Skipped = { pandId: string; key?: string; skip: string };

/** The wall nearest `at` whose outward normal faces within 40 deg of `bearing` (exposed walls first, then any ring edge). */
function wallAt(fp: Footprint, others: Footprint[], at: [number, number], bearing?: number): { wall: Wall | null; note: string } {
  const p = lngLatToRd(at);
  const faces = (w: Wall) => bearing === undefined || Math.abs(((Math.atan2(w.nx, w.ny) * 180 / Math.PI - bearing + 540) % 360) - 180) < 40;
  const dist = (w: Wall) => nearestOnSeg(p, { a: w.a, b: w.b }).d;
  const exposed = exposedWalls(fp, others).filter(faces).sort((a, b) => dist(a) - dist(b));
  if (exposed[0] && dist(exposed[0]) < 3) return { wall: exposed[0], note: `the exposed wall at ${at.join(',')}` };
  const all = exposedWalls(fp, []).filter(faces).sort((a, b) => dist(a) - dist(b));
  if (all[0] && dist(all[0]) < 3) return { wall: all[0], note: `the ring edge at ${at.join(',')} (not exposed by select.ts's rule)` };
  // A front drawn as a bay or in jogs (each piece under exposedWalls' length): the chord of the longest run of consecutive
  // ring edges facing within 50 deg of `bearing`, when it passes within 3 m of `at` (Nassaukade 146, 160704).
  if (bearing !== undefined) {
    const r = fp.ring.length > 1 && fp.ring[0].x === fp.ring[fp.ring.length - 1].x && fp.ring[0].y === fp.ring[fp.ring.length - 1].y ? fp.ring.slice(0, -1) : fp.ring;
    const area = r.reduce((s, p, i) => s + p.x * r[(i + 1) % r.length].y - r[(i + 1) % r.length].x * p.y, 0), sign = area > 0 ? 1 : -1; // outward normal for either winding
    const facesB = (i: number) => { const a = r[i], b = r[(i + 1) % r.length], len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 0.05) return true; const nx = sign * (b.y - a.y) / len, ny = -sign * (b.x - a.x) / len; return Math.abs(((Math.atan2(nx, ny) * 180 / Math.PI - bearing + 540) % 360) - 180) < 50; };
    let best: Wall | null = null;
    for (let i = 0; i < r.length; i++) {
      if (!facesB(i) || facesB((i - 1 + r.length) % r.length)) continue; // the start of a run
      let j = i; while (j - i < r.length - 1 && facesB((j + 1) % r.length)) j++;
      const a = r[i], b = r[(j + 1) % r.length], len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 2) continue;
      const w: Wall = { a, b, len, nx: sign * (b.y - a.y) / len, ny: -sign * (b.x - a.x) / len, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, roadDistM: NaN, facing: NaN };
      if (dist(w) < 3 && (!best || w.len > best.len)) best = w;
    }
    if (best) return { wall: best, note: `the chord of the ring edges facing ${bearing} at ${at.join(',')} (a bay or jogged front)` };
  }
  return { wall: null, note: `no wall within 3 m of ${at.join(',')} facing ${bearing}` };
}

/**
 * A wall given as its two end points (a `--list` entry's `chord`, lng/lat, viewer's left first is not required): for a front
 * whose ring is stepped in edges under 3 m (a stoop or bay line: Nassaukade 146, 0363100012160704), which `exposedWalls`
 * drops. The outward normal is the chord's perpendicular nearer `bearing` (else the one pointing away from the pand's centre).
 */
function wallChord(fp: Footprint, chord: [[number, number], [number, number]], bearing?: number): { wall: Wall; note: string } {
  const a = lngLatToRd(chord[0]), b = lngLatToRd(chord[1]), dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  let nx = dy / len, ny = -dx / len;
  const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const away = bearing === undefined ? (mid.x - centre.x) * nx + (mid.y - centre.y) * ny > 0 : Math.cos((Math.atan2(nx, ny) * 180 / Math.PI - bearing) * Math.PI / 180) > 0;
  if (!away) { nx = -nx; ny = -ny; }
  // Keep ccw order (a to b with the outside on the right), as exposedWalls hands them out.
  const wall: Wall = Math.abs(nx * dy - ny * dx - len) < 1e-6 ? { a, b, len, nx, ny, mid, roadDistM: 0, facing: 1 } : { a: b, b: a, len, nx, ny, mid, roadDistM: 0, facing: 1 };
  return { wall, note: `the chord ${chord.map(c => c.join(',')).join(' - ')} (${len.toFixed(1)} m, outward ${((Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360).toFixed(0)} deg)` };
}

const WINTER = new Set([11, 12, 1, 2, 3]);
const monthOf = (ts: string) => Number(String(ts).slice(5, 7));

/** Pose pick: a panorama is rejected when this share of its frame 0-GLARE_BAND_DEG below the horizon is blown out (sun glare, flare). */
export const GLARE_MAX = 0.12, GLARE_BAND_DEG = 20;
/** ... or when this share of the wall is bright and colourless (scaffold sheeting, overexposure) and another candidate's
 * wall reads WASHED_MARGIN less (a white front is washed out in every year and is not rejected). */
export const WASHED_MAX = 0.3, WASHED_MARGIN = 0.25;
type PanoQuality = { leaf: number | null; glare: number | null; washed: number | null };

/** A small cut (2000 px panorama, 360 px wide frame): foliage and washed-out shares on the projected wall, blown-out share below the horizon. */
async function panoQuality(p: PanoPick, wall: WallQuad): Promise<PanoQuality> {
  const img = await loadEquirect(p.record, 'small');
  if (!img) return { leaf: null, glare: null, washed: null };
  const ll: [number, number] = [p.record.geometry.coordinates[0], p.record.geometry.coordinates[1]];
  const pose = aimPose({ lngLat: ll }, wall, { width: 360, height: 225 }), f = frameFor(pose), W = pose.width, H = pose.height;
  const cut = cutPerspective(img, f, gridConvergenceDeg(ll)), len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  let n = 0, leaf = 0, wn = 0, wash = 0;
  for (let i = 1; i < 12; i++) for (let j = 1; j < 10; j++) {
    const s = wallPoint(f, pose, wall, len * i / 12, wall.heightM * j / 10);
    if (s.depth <= 0 || s.x < 0 || s.y < 0 || s.x >= W || s.y >= H) continue;
    const o = (Math.floor(s.y) * W + Math.floor(s.x)) * 3, r = cut.data[o], g = cut.data[o + 1], b = cut.data[o + 2]; n++;
    if (isLeaf(r, g, b)) leaf++;
    if (j >= 2 && j <= 8) { wn++; const hi = Math.max(r, g, b), lo = Math.min(r, g, b); if (lo > 150 && hi - lo < 55) wash++; } // rectify.ts washedOutFraction's rule, mid-wall
  }
  // 0-20 deg below the horizon: street level, clear of the recording car's bonnet (white on some captures) further down.
  const horizon = Math.max(0, Math.ceil(H / 2 - f.focal * Math.tan(pose.lookDownDeg * Math.PI / 180)));
  let below = 0, blown = 0;
  for (let y = horizon; y < H; y++) {
    if (Math.atan((y + 0.5 - H / 2) / f.focal) * 180 / Math.PI + pose.lookDownDeg > GLARE_BAND_DEG) break;
    for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; below++; if (Math.min(cut.data[o], cut.data[o + 1], cut.data[o + 2]) > 225) blown++; }
  }
  return { leaf: n ? leaf / n : null, glare: below ? blown / below : null, washed: wn ? wash / wn : null };
}

/** The named street the wall faces: the nearest centreline point within 40 m that lies in front of the wall. */
async function streetName(wall: Wall): Promise<string> {
  const streets: any[] = (globalThis as any).__hfStreets ??= ['streets.json', 'streets-routing.json'].flatMap(f => JSON.parse(fs.readFileSync(path.join('public/data/extracts/amsterdam', f), 'utf8')));
  let best = { d: Infinity, name: '' };
  for (const s of streets) {
    if (!s.name) continue;
    for (const p of (s.paths ?? [s.path]) as number[][][]) {
      if (!p?.length || Math.abs(p[0][1] - 4.9) > 0.3) continue;
      const pts = p.map(q => lngLatToRd([q[1], q[0]]));
      for (let i = 0; i + 1 < pts.length; i++) {
        if (Math.abs(pts[i].x - wall.mid.x) > 200 || Math.abs(pts[i].y - wall.mid.y) > 200) continue;
        const r = nearestOnSeg(wall.mid, { a: pts[i], b: pts[i + 1] });
        const front = ((r.q.x - wall.mid.x) * wall.nx + (r.q.y - wall.mid.y) * wall.ny) / Math.max(r.d, 1e-6);
        if (r.d < 40 && front > 0.5 && r.d < best.d) best = { d: r.d, name: s.name };
      }
    }
  }
  return best.name;
}

async function prepare(entry: Entry, fp: Footprint | undefined, args: Args): Promise<Prepared | Skipped> {
  const pandId = entry.id, key = entry.key ?? entry.id;
  if (!fp) return { pandId, skip: 'pand not in the building tiles' };
  const { options } = await import('../pand-reference/select.ts');
  options.preferBearingDeg = entry.bearing ?? args.bearing;
  const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
  const near = await neighbourhood(centre);
  const picked = entry.chord ? wallChord(fp, entry.chord, entry.bearing) : entry.at ? wallAt(fp, near, entry.at, entry.bearing) : await pickWall(fp, near);
  const wall = picked.wall; let note = picked.note;
  if (!wall) return { pandId, key, skip: note };
  const quad: WallQuad = { a: wall.a, b: wall.b, heightM: fp.height || 10 };
  // --max-dist widens the 35 m window (the far quay of a canal: Keizersgracht fronts fit there, not from the 5 m near quay).
  const maxD = entry.maxDistM ?? args.maxDistM ?? FACADE_WINDOW.maxD;
  let ranked = rankPanos(wall, await listPanos(wall.mid, maxD), { ...FACADE_WINDOW, maxD }).filter(c => c.surface !== 'W');
  if (args.year) ranked = ranked.filter(c => c.missionYear === args.year);
  if (entry.notPanos?.length) ranked = ranked.filter(c => !entry.notPanos!.includes(c.panoId));
  // A pinned capture (an entry's pano; the eyeball set's eyeball-poses.json) wins when it is in range; the sight-line
  // filter below is skipped for it (it was picked by eye).
  const pinned = entry.pano ? ranked.find(c => c.panoId === entry.pano) : undefined;
  if (entry.pano) note += pinned ? `; pinned capture ${entry.pano}` : `; pinned capture ${entry.pano} not in range, picked as usual`;
  if (pinned) ranked = [pinned];
  // --prefer-obliquity / --max-dist reach squarer, farther captures, and in a narrow street those stand on the next street
  // with houses between them and the wall (lane F4, #379: 36 of 37 Jordaan poses). With either flag, a capture whose
  // sight line to the wall (to its middle and both quarter points, 1 m up) crosses another footprint is dropped.
  if (!pinned && (args.preferObliquityDeg !== undefined || maxD !== FACADE_WINDOW.maxD)) {
    const before = ranked.length, boxes = near.filter(o => o.id !== fp.id).map(o => ({ o, x0: Math.min(...o.ring.map(q => q.x)), x1: Math.max(...o.ring.map(q => q.x)), y0: Math.min(...o.ring.map(q => q.y)), y1: Math.max(...o.ring.map(q => q.y)) }));
    const blocked = (c: PanoPick) => {
      const cam = lngLatToRd([c.record.geometry.coordinates[0], c.record.geometry.coordinates[1]]);
      let hits = 0;
      for (const t of [0.25, 0.5, 0.75]) {
        const w = { x: wall.a.x + (wall.b.x - wall.a.x) * t + wall.nx * 0.6, y: wall.a.y + (wall.b.y - wall.a.y) * t + wall.ny * 0.6 };
        const len = Math.hypot(w.x - cam.x, w.y - cam.y), n = Math.ceil(len / 0.75);
        for (let i = 1; i < n; i++) {
          const q = { x: cam.x + (w.x - cam.x) * i / n, y: cam.y + (w.y - cam.y) * i / n };
          if (boxes.some(b => q.x >= b.x0 && q.x <= b.x1 && q.y >= b.y0 && q.y <= b.y1 && pointInRing(q, b.o.ring))) { hits++; break; }
        }
      }
      return hits >= 2;
    };
    ranked = ranked.filter(c => !blocked(c));
    if (ranked.length < before) note += `; ${before - ranked.length} capture(s) without a line of sight dropped`;
  }
  if (!ranked.length) return { pandId, skip: args.year ? `no panorama of ${args.year} in 5-35 m` : 'no panorama in 5-35 m (obliquity <= 55)' };
  const why: string[] = [note];
  // Winter first; glare and washed-out walls rejected (pre-pass over the first 3, extended to 8 while fewer than 2 pass);
  // then lowest foliage on the wall, then rank.
  const seasonKey = (c: PanoPick) => args.season === 'winter' && !WINTER.has(monthOf(c.timestamp)) ? 1 : 0;
  // --prefer-obliquity: inside a season, the captures within the limit first, squarest first (absent = rank order).
  const lim = args.preferObliquityDeg, oblKey = (c: PanoPick) => lim === undefined ? 0 : c.obliquityDeg <= lim ? c.obliquityDeg : 1000 + c.obliquityDeg;
  // ... and with it, captures whose pose fits the whole wall (no 'clipped top'/'sides') before the squarest: the squarest
  // capture of a tall canal house is often 5 m in front of it, where 120 deg cannot hold the crown (lane F4, #379).
  const clipMemo = new Map<PanoPick, number>();
  const clipKey = (c: PanoPick) => {
    if (lim === undefined) return 0;
    if (!clipMemo.has(c)) { const pub = Number(c.record.geometry.coordinates[2]); clipMemo.set(c, aimPose({ lngLat: [c.record.geometry.coordinates[0], c.record.geometry.coordinates[1]], cameraNap: pub > 0 ? pub - 43.5 : null }, quad).clipped.length ? 1 : 0); }
    return clipMemo.get(c)!;
  };
  const order = ranked.map((c, i) => ({ c, i })).sort((a, b) => seasonKey(a.c) - seasonKey(b.c) || clipKey(a.c) - clipKey(b.c) || oblKey(a.c) - oblKey(b.c) || a.i - b.i);
  const pool: { c: PanoPick; i: number; q: PanoQuality; reject?: string }[] = [];
  const judge = () => {
    const minWash = Math.min(...pool.map(p => p.q.washed ?? 1));
    for (const p of pool) p.reject = (p.q.glare ?? 0) > GLARE_MAX ? `glare ${((p.q.glare ?? 0) * 100).toFixed(0)}%`
      : (p.q.washed ?? 0) > WASHED_MAX && (p.q.washed ?? 0) - minWash > WASHED_MARGIN ? `washed out ${((p.q.washed ?? 0) * 100).toFixed(0)}%` : undefined;
    return pool.filter(p => !p.reject).length;
  };
  for (const o of order) {
    if (pool.length >= 8 || (pool.length >= 3 && judge() >= 2)) break;
    pool.push({ ...o, q: await panoQuality(o.c, quad).catch(() => ({ leaf: null, glare: null, washed: null })) });
  }
  judge();
  const rejected = pool.filter(p => p.reject), live = pool.filter(p => !p.reject).length ? pool.filter(p => !p.reject) : [...pool].sort((a, b) => (a.q.glare ?? 0) - (b.q.glare ?? 0));
  live.sort((a, b) => (lim === undefined ? 0 : seasonKey(a.c) - seasonKey(b.c) || clipKey(a.c) - clipKey(b.c) || Number(a.c.obliquityDeg > lim) - Number(b.c.obliquityDeg > lim)) || Math.round((a.q.leaf ?? 1) * 10) - Math.round((b.q.leaf ?? 1) * 10) || seasonKey(a.c) - seasonKey(b.c) || oblKey(a.c) - oblKey(b.c) || a.i - b.i);
  const chosen = live[0], pick = chosen.c, foliage: number | null = chosen.q.leaf;
  why.push(`panorama ${pick.panoId}: rank ${chosen.i + 1} of ${ranked.length}${args.season === 'winter' ? `, ${WINTER.has(monthOf(pick.timestamp)) ? 'winter' : 'no winter capture'}` : ''}, foliage ${foliage == null ? '?' : (foliage * 100).toFixed(0) + '%'}, glare ${chosen.q.glare == null ? '?' : (chosen.q.glare * 100).toFixed(0) + '%'} (pre-pass over ${pool.length}${rejected.length ? `; rejected ${rejected.map(p => `${p.c.timestamp.slice(0, 10)} ${p.reject}`).join(', ')}` : ''}${chosen.reject ? '; every candidate rejected, least glare kept' : ''})`);
  const ll: [number, number] = [pick.record.geometry.coordinates[0], pick.record.geometry.coordinates[1]];
  const published = Number(pick.record.geometry.coordinates[2]);
  const pose = aimPose({ lngLat: ll, cameraNap: published > 0 ? published - 43.5 : null }, quad);
  const frame = frameFor(pose);
  const dir = path.join(args.out, key);
  fs.mkdirSync(dir, { recursive: true });
  const photoFile = path.join(cacheDir('photos'), `${hashOf({ pano: pick.record._links?.equirectangular_medium?.href ?? pick.panoId, size: args.panoSize, pose, code: codeHash() })}.jpg`);
  if (args.reusePhotos && fs.existsSync(photoFile)) fs.copyFileSync(photoFile, path.join(dir, 'photo.jpg'));
  else {
    const img = await loadEquirect(pick.record, args.panoSize);
    if (!img) return { pandId, skip: `panorama ${pick.panoId} did not load` };
    const cut = cutPerspective(img, frame, gridConvergenceDeg(ll));
    await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: 3 } }).jpeg({ quality: 85 }).toFile(path.join(dir, 'photo.jpg'));
    fs.copyFileSync(path.join(dir, 'photo.jpg'), photoFile);
  }
  const { record, ...rest } = pick;
  return {
    pandId, key, street: await streetName(wall), wall: quad, wallLenM: +wall.len.toFixed(2), pick: { ...rest, url: record._links?.equirectangular_medium?.href ?? '' }, pose, hfovDeg: +hfovDeg(pose).toFixed(1),
    samples: pickSamples(frame, pose, quad), foliage, candidates: ranked.length, route: routeOf(pandId, ll, args.query), why,
  };
}

// ---- cache (--reuse-photos) ----------------------------------------------------------------------------------------
// prep/<entry hash>.json: a Prepared record (route recomputed per run: it depends on --query); photos/<pose hash>.jpg: the
// cut. Both keys include a hash of this tool's own pose/photo/pick code, so a change there misses the cache.
const CACHE = process.env.HOUSE_FRAMES_CACHE ?? path.join(os.homedir(), 'Code/map-recall2/.cache/house-frames');
function cacheDir(sub: string): string { const d = path.join(CACHE, sub); fs.mkdirSync(d, { recursive: true }); return d; }
const hashOf = (v: unknown) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 20);
let codeHashMemo = '';
function codeHash(): string {
  if (!codeHashMemo) {
    const h = crypto.createHash('sha1'), here = path.dirname(new URL(import.meta.url).pathname);
    for (const f of ['frames.ts', 'pose.ts', 'photo.ts', '../pand-reference/select.ts']) h.update(fs.readFileSync(path.join(here, f)));
    codeHashMemo = h.digest('hex').slice(0, 12);
  }
  return codeHashMemo;
}
// notPanos, --prefer-obliquity and --max-dist change the pick, so they key the cache too (absent = undefined, dropped by JSON: the same keys as before).
const prepKey = (e: Entry, args: Args) => hashOf({ e: { id: e.id, key: e.key, bearing: e.bearing, at: e.at, chord: e.chord, notPanos: e.notPanos, maxDistM: e.maxDistM, pano: e.pano }, bearing: args.bearing, year: args.year, season: args.season, size: args.panoSize, preferObliquityDeg: args.preferObliquityDeg, maxDistM: args.maxDistM, code: codeHash() });
/** A cached Prepared for the entry with its photo copied into <out>/<key>, or null. */
function cachedPrep(e: Entry, args: Args): Prepared | null {
  const f = path.join(cacheDir('prep'), `${prepKey(e, args)}.json`);
  if (!fs.existsSync(f)) return null;
  const c = JSON.parse(fs.readFileSync(f, 'utf8')) as Prepared & { photo: string };
  if (!fs.existsSync(c.photo)) return null;
  const dir = path.join(args.out, c.key);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(c.photo, path.join(dir, 'photo.jpg'));
  const { photo: _photo, ...prep } = c;
  return { ...prep, route: routeOf(prep.pandId, prep.pose.lngLat, args.query), why: [...prep.why.filter(w => !w.startsWith('reused')), 'reused the cached pick, pose and photo cut (--reuse-photos)'] };
}
function storePrep(e: Entry, args: Args, prep: Prepared) {
  const photo = path.join(cacheDir('photos'), `${hashOf({ pano: prep.pick.url || prep.pick.panoId, size: args.panoSize, pose: prep.pose, code: codeHash() })}.jpg`);
  if (!fs.existsSync(photo)) fs.copyFileSync(path.join(args.out, prep.key, 'photo.jpg'), photo);
  fs.writeFileSync(path.join(cacheDir('prep'), `${prepKey(e, args)}.json`), JSON.stringify({ ...prep, photo }));
}

/** Greedy nearest-neighbour order, so the page streams neighbouring tiles from one pose to the next. */
function spatialOrder<T extends { pose: FramePose }>(items: T[]): T[] {
  const left = [...items], out: T[] = [];
  let cur = left.shift();
  while (cur) {
    out.push(cur);
    let bi = -1, bd = Infinity;
    left.forEach((c, i) => { const d = Math.hypot(c.pose.rd.x - cur!.pose.rd.x, c.pose.rd.y - cur!.pose.rd.y); if (d < bd) { bd = d; bi = i; } });
    cur = bi >= 0 ? left.splice(bi, 1)[0] : undefined;
  }
  return out;
}

// ---- pairs and sheets -----------------------------------------------------------------------------------------------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** A frame at the pose's size (a game.png taken at another viewport is resized, as post() does for the game half). */
async function readSized(file: string, width: number, height: number): Promise<Rgb8> {
  const { data, info } = await sharp(file).removeAlpha().resize(width, height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

async function readRgb(file: string): Promise<Rgb8> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/** The crop both halves share: the outline (with the crown allowance) plus 30 % context, square where the frame allows. */
export function cropBox(pose: FramePose, wall: WallQuad): { left: number; top: number; width: number; height: number } {
  const f = frameFor(pose), pts = [...wallOutline(f, pose, wall), ...wallOutline(f, pose, { ...wall, heightM: wall.heightM + CROWN_EXTRA_M })].filter(Boolean) as Array<{ x: number; y: number }>;
  if (!pts.length) return { left: 0, top: 0, width: pose.width, height: pose.height };
  let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
  const pad = 0.3 * Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const side = Math.max(x1 - x0, y1 - y0) + 2 * pad;
  const w = Math.min(pose.width, Math.max(side, 360)), h = Math.min(pose.height, Math.max(side, 360));
  const left = Math.max(0, Math.min(pose.width - w, cx - w / 2)), top = Math.max(0, Math.min(pose.height - h, cy - h / 2));
  return { left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(h) };
}

export function outlineSvg(pose: FramePose, wall: WallQuad): string {
  const f = frameFor(pose), o = wallOutline(f, pose, wall);
  if (o.some(p => !p)) return `<svg width="${pose.width}" height="${pose.height}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  const pts = o.map(p => `${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(' ');
  return `<svg width="${pose.width}" height="${pose.height}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="none" stroke="#00e5ff" stroke-width="2" stroke-opacity="0.9"/></svg>`;
}

async function half(file: string, pose: FramePose, wall: WallQuad, size: number): Promise<Buffer> {
  const box = cropBox(pose, wall);
  const base = await sharp(file).resize(pose.width, pose.height, { fit: 'fill' }).composite([{ input: Buffer.from(outlineSvg(pose, wall)) }]).png().toBuffer();
  return sharp(base).extract(box).resize(size, size, { fit: 'contain', background: '#1d1d1d' }).png().toBuffer();
}

function captionLines(r: any): string[] {
  const e = (list: EdgeRead[]) => list.map(x => `${x.side[0].toUpperCase()}${x.found ? (x.offsetPct >= 0 ? '+' : '') + x.offsetPct.toFixed(1) + '%' : '?'}`).join(' ') || '-';
  const flags = Object.entries(r.flags ?? {}).filter(([, v]) => v).map(([k, v]) => v === true ? k : `${k}: ${v}`);
  return [
    `${r.key !== r.pandId ? r.key + ' ' : ''}${r.pandId}  ${r.street || '?'}  |  pano ${String(r.pick.timestamp).slice(0, 10)}  ${r.pick.distM.toFixed(1)} m  obl ${r.pick.obliquityDeg.toFixed(0)}°  |  vfov ${r.pose.vfovDeg.toFixed(0)}°${r.pose.clipped.length ? ` clipped ${r.pose.clipped.join('+')}` : ''}`,
    `drew: ${r.route}${r.picks?.drawnBy ? ` (picked ${r.picks.drawnBy})` : ''}  |  ${r.query || '(default world)'}${r.label && r.label !== 'run' ? `  |  ${r.label}` : ''}`,
    (flags.length ? `FLAGS ${flags.join(', ')}` : 'no flags') + (r.colour && r.colour.ref === 'no ref' ? '  |  wall colour: no ref (no neighbour strip reads)' : ''),
    `edges photo ${e(r.edges.photo)}  game ${e(r.edges.game)}  |  openings (advisory) photo ${r.measure.photo.openings ?? '?'} game ${r.measure.game.openings ?? '?'}${r.advisory?.openings ? ' ' + r.advisory.openings : ''}  |  rel L photo ${r.colour?.photo?.rel ?? '?'} game ${r.colour?.game?.rel ?? '?'} (${r.colour?.ref ?? '?'})  |  skyline game ${r.skyline?.offset?.game?.medianM ?? (r.skyline?.offset?.game?.clipped ? 'clipped' : '?')} photo ${r.skyline?.offset?.photo?.medianM ?? (r.skyline?.offset?.photo?.clipped ? 'clipped' : '?')} crown ${r.wall.heightM} m`,
  ];
}

async function pairImage(dir: string, r: any, halfPx: number, fontPx: number): Promise<Buffer> {
  const pose: FramePose = r.pose, wall: WallQuad = r.wall;
  const [ph, gm] = await Promise.all([half(path.join(dir, 'photo.jpg'), pose, wall, halfPx), half(path.join(dir, 'game.png'), pose, wall, halfPx)]);
  const lines = captionLines(r), capH = Math.round(fontPx * 1.45 * lines.length + fontPx * 0.8), W = halfPx * 2 + 6;
  const flagged = Object.values(r.flags ?? {}).some(Boolean);
  const svg = `<svg width="${W}" height="${capH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/>${lines.map((l, i) => `<text x="8" y="${Math.round(fontPx * 1.2 + i * fontPx * 1.45)}" font-family="Helvetica, Arial, sans-serif" font-size="${fontPx}" fill="${i === 2 && flagged ? '#ffb347' : '#eee'}">${esc(l)}</text>`).join('')}</svg>`;
  const labels = `<svg width="${W}" height="${halfPx}" xmlns="http://www.w3.org/2000/svg"><text x="8" y="${fontPx + 6}" font-family="Helvetica, Arial, sans-serif" font-size="${fontPx}" fill="#fff" stroke="#000" stroke-width="0.6">panorama</text><text x="${halfPx + 14}" y="${fontPx + 6}" font-family="Helvetica, Arial, sans-serif" font-size="${fontPx}" fill="#fff" stroke="#000" stroke-width="0.6">game</text></svg>`;
  return sharp({ create: { width: W, height: halfPx + capH, channels: 3, background: '#111' } })
    .composite([{ input: ph, left: 0, top: 0 }, { input: gm, left: halfPx + 6, top: 0 }, { input: Buffer.from(labels), left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: halfPx }]).jpeg({ quality: 82 }).toBuffer();
}

const labText = (l: any) => l ? `L ${l.L.toFixed(2)} C ${l.C.toFixed(3)} h ${l.h}°` : '?';
/** photo | before | after at gallery size (3 x 520 px, <= 1600 px wide), the wall outline on each, the change on the caption. */
async function tripleImage(dir: string, beforeDir: string, r: any, halfPx = 520, fontPx = 14): Promise<Buffer> {
  const pose: FramePose = r.pose, wall: WallQuad = r.wall, c = r.compare;
  const [ph, bf, af] = await Promise.all([half(path.join(dir, 'photo.jpg'), pose, wall, halfPx), half(path.join(beforeDir, 'game.png'), pose, wall, halfPx), half(path.join(dir, 'game.png'), pose, wall, halfPx)]);
  const W = halfPx * 3 + 12, d = (k: 'before' | 'after') => { const x = c.drawn?.[k]; return x ? (x.specRecipeWall ? `spec ${x.specRecipeWall}` : x.heldBrick ? 'held brick' : 'period') : '?'; };
  const lines = [
    `${r.key !== r.pandId ? r.key + ' ' : ''}${r.pandId}  ${r.street || '?'}  |  target wall ${c.pct}% of pixels changed (mean OKLab dE ${c.meanDE})${c.same ? '  SAME: the flag did not reach the pixels' : ''}`,
    `wall OKLab  photo ${labText(c.lab.photo)}  |  before ${labText(c.lab.before)} (${d('before')})  |  after ${labText(c.lab.after)} (${d('after')})`,
  ];
  const capH = Math.round(fontPx * 1.45 * lines.length + fontPx * 0.8);
  const svg = `<svg width="${W}" height="${capH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/>${lines.map((l, i) => `<text x="8" y="${Math.round(fontPx * 1.2 + i * fontPx * 1.45)}" font-family="Helvetica, Arial, sans-serif" font-size="${fontPx}" fill="${i === 0 && c.same ? '#ffb347' : '#eee'}">${esc(l)}</text>`).join('')}</svg>`;
  const label = (t: string, x: number) => `<text x="${x}" y="${fontPx + 6}" font-family="Helvetica, Arial, sans-serif" font-size="${fontPx}" fill="#fff" stroke="#000" stroke-width="0.6">${esc(t)}</text>`;
  const labels = `<svg width="${W}" height="${halfPx}" xmlns="http://www.w3.org/2000/svg">${label('panorama', 8)}${label(`before ${path.basename(path.dirname(beforeDir))}`, halfPx + 14)}${label(`after ${r.label}`, 2 * halfPx + 20)}</svg>`;
  return sharp({ create: { width: W, height: halfPx + capH, channels: 3, background: '#111' } })
    .composite([{ input: ph, left: 0, top: 0 }, { input: bf, left: halfPx + 6, top: 0 }, { input: af, left: 2 * halfPx + 12, top: 0 }, { input: Buffer.from(labels), left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: halfPx }]).jpeg({ quality: 80 }).toBuffer();
}

async function contactSheets(out: string, results: any[], title: string): Promise<string[]> {
  const files: string[] = [], per = 6, cols = 2, halfPx = 390, fontPx = 11; // 1596 px wide: the screenshots repo takes <= 1600 px, <= 400 kB
  for (let s = 0; s * per < results.length; s++) {
    const slice = results.slice(s * per, (s + 1) * per);
    const tiles = await Promise.all(slice.map(r => pairImage(path.join(out, r.key), r, halfPx, fontPx)));
    const metas = await Promise.all(tiles.map(t => sharp(t).metadata()));
    const tw = metas[0].width!, th = Math.max(...metas.map(m => m.height!)), gap = 8, head = 34;
    const W = cols * tw + (cols + 1) * gap, H = head + Math.ceil(slice.length / cols) * (th + gap) + gap;
    const t = `<svg width="${W}" height="${head}" xmlns="http://www.w3.org/2000/svg"><text x="${gap}" y="23" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#fff">${esc(`${title} — sheet ${s + 1} of ${Math.ceil(results.length / per)}  (left: panorama cut, right: game; cyan: BAG wall outline)`)}</text></svg>`;
    const file = path.join(out, `contact-${s + 1}.jpg`);
    await sharp({ create: { width: W, height: H, channels: 3, background: '#222' } })
      .composite([{ input: Buffer.from(t), left: 0, top: 0 }, ...tiles.map((tile, i) => ({ input: tile, left: gap + (i % cols) * (tw + gap), top: head + Math.floor(i / cols) * (th + gap) }))])
      .jpeg({ quality: 70, mozjpeg: true }).toFile(file);
    files.push(file);
  }
  return files;
}

// ---- post: checks per pand ------------------------------------------------------------------------------------------
async function post(prep: Prepared, args: Args, job: any): Promise<any> {
  const dir = path.join(args.out, prep.key);
  const gamePath = path.join(dir, 'game.png'), gameJson = path.join(dir, 'game.json');
  if (!fs.existsSync(gamePath) || !fs.existsSync(gameJson)) return { ...prep, error: 'no game frame (browser run failed for this pose)' };
  const g = JSON.parse(fs.readFileSync(gameJson, 'utf8'));
  const photo = await readRgb(path.join(dir, 'photo.jpg')), gameRaw = await readRgb(gamePath);
  const game = gameRaw.width === prep.pose.width ? gameRaw : await (async () => { const { data, info } = await sharp(gamePath).removeAlpha().resize(prep.pose.width, prep.pose.height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }); return { width: info.width, height: info.height, data: new Uint8Array(data) }; })();
  const frame = frameFor(prep.pose);
  const edges = { photo: edgeOffsets(photo, frame, prep.pose, prep.wall), game: edgeOffsets(game, frame, prep.pose, prep.wall) };
  // A model's hit carries landmarkId (the model key; frames from before the spec returned it name it by its keys).
  const hits: Hit[] = (g.picks?.hits ?? []).map((h: any) => h && !h.model && String(h.keys ?? '').includes('landmarkId') ? { ...h, model: coverOf(prep.pandId) ?? 'model' } : h);
  const picks = readPicks(prep.samples, hits, prep.pandId, coverOf(prep.pandId));
  const cols = new Set<number>();
  prep.samples.forEach((s, i) => { const h = hits[i]; if (s.zone === 'above' && s.v >= prep.wall.heightM + 1.2 && h && (bare(h.id) === prep.pandId || (coverOf(prep.pandId) && (h.id === coverOf(prep.pandId) || h.model === coverOf(prep.pandId))))) cols.add(Math.round(s.u * 10)); });
  const measure = { photo: measureHalf(photo, frame, prep.pose, prep.wall), game: measureHalf(game, frame, prep.pose, prep.wall) };
  const sky = { photo: skyline(photo, frame, prep.pose, prep.wall), game: skyline(game, frame, prep.pose, prep.wall) };
  const skyOff = { game: skylineMedian(sky.game), photo: skylineMedian(sky.photo), crownM: prep.wall.heightM };
  const colour = relativeColour(photo, game, frame, prep.pose, prep.wall);
  const flags = flagsFor(picks, measure.game, measure.photo, { crownM: prep.wall.heightM, game: skyOff.game.medianM, photo: skyOff.photo.medianM, above: cols.size }, colour);
  const advisory = { openings: openingsNote(measure.game, measure.photo, flags.missing) };
  const fpsUsed = g.picks?.fps ?? null;
  // The pand's wall colour (OKLab) in each half, and with --before the same wall in the earlier run's frame.
  const lab = { photo: wallLab(photo, frame, prep.pose, prep.wall), game: wallLab(game, frame, prep.pose, prep.wall) };
  let compare: Record<string, unknown> | null = null;
  if (args.before) {
    const beforePng = path.join(args.before, prep.key, 'game.png'), beforeJson = path.join(args.before, prep.key, 'game.json');
    if (!fs.existsSync(beforePng)) compare = { before: args.before, error: 'no before frame' };
    else {
      const before = await readSized(beforePng, prep.pose.width, prep.pose.height), change = wallChange(before, game, frame, prep.pose, prep.wall);
      compare = { before: args.before, ...(change ?? { error: 'wall off frame' }), lab: { photo: lab.photo, before: wallLab(before, frame, prep.pose, prep.wall), after: lab.game },
        drawn: { before: fs.existsSync(beforeJson) ? JSON.parse(fs.readFileSync(beforeJson, 'utf8')).drawn ?? null : null, after: g.drawn ?? null } };
      if (change?.same) {
        (flags as Record<string, unknown>).sameAsBefore = `target wall ${change.pct}% changed vs ${path.basename(args.before)} (< ${WALL_SAME_PCT}%): the compared flag did not reach these pixels`;
        console.warn(`WARNING ${prep.pandId} ${prep.key}: before == after on the target wall (${change.pct}% of its pixels changed, mean OKLab dE ${change.meanDE}); this pair proves nothing`);
      }
    }
  }
  const r = { pandId: prep.pandId, key: prep.key, street: prep.street, label: args.label, query: job.query, route: prep.route, why: prep.why, wall: prep.wall, wallLenM: prep.wallLenM, pick: prep.pick, pose: prep.pose, hfovDeg: prep.hfovDeg, fps: fpsFor(prep.pose), fpsUsed, foliage: prep.foliage, candidates: prep.candidates, edges, skyline: { ...sky, offset: skyOff }, picks, measure, colour, lab, ...(compare ? { compare } : {}), drawn: g.drawn ?? null, flags, advisory, settle: g.settle, ms: g.ms };
  fs.writeFileSync(path.join(dir, 'pose.json'), JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(dir, 'pair.jpg'), await pairImage(dir, r, 720, 15));
  if (compare && !compare.error) fs.writeFileSync(path.join(dir, 'triple.jpg'), await tripleImage(dir, path.join(args.before!, prep.key), r));
  return r;
}

function quantile(xs: number[], q: number) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; }

type Job = { out: string; query: string; width: number; height: number; reopenEvery: number; settleMs: number; poses: Array<{ key: string; pandId?: string; out?: string; lngLat: [number, number]; headingDeg: number; fps: Record<string, unknown>; picks: Array<[number, number]> }> };
const jobFor = (args: Args, prepared: Prepared[]): Job => ({ out: args.out, query: args.query, width: FRAME_W, height: FRAME_H, reopenEvery: args.reopenEvery, settleMs: 1200, poses: prepared.map(p => ({ key: p.key, pandId: p.pandId, out: args.out, lngLat: p.pose.lngLat, headingDeg: p.pose.headingDeg, fps: fpsFor(p.pose) as Record<string, unknown>, picks: p.samples.map(s => [s.x, s.y] as [number, number]) })) });

/** Pick, pose and cut every entry of one input; writes <out>/prepared.json and <out>/job.json. */
async function prepareAll(args: Args): Promise<{ prepared: Prepared[]; skipped: Skipped[] }> {
  const prepared: Prepared[] = [], skipped: Skipped[] = [];
  const t0 = Date.now();
  fs.mkdirSync(args.out, { recursive: true });
  const hits = new Map<Entry, Prepared>();
  if (args.reusePhotos) for (const e of args.pands) { const c = cachedPrep(e, args); if (c) hits.set(e, c); }
  const misses = args.pands.filter(e => !hits.has(e));
  if (misses.length) await loadRoads();
  const found = misses.length ? await findPands(misses.map(p => p.id)) : new Map();
  for (const e of args.pands) {
    const hit = hits.get(e);
    if (hit) { prepared.push(hit); console.log(`${e.id}: cached pick, pose and photo (${hit.street} pano ${hit.pick.timestamp.slice(0, 10)}), ${hit.route}`); continue; }
    try {
      const r = await prepare(e, found.get(normId(e.id)), args);
      if ('skip' in r) { skipped.push(r); console.log(`${e.id}: skipped (${r.skip})`); }
      else { prepared.push(r); storePrep(e, args, r); console.log(`${e.id}: ${r.street} pano ${r.pick.timestamp.slice(0, 10)} ${r.pick.distM.toFixed(1)} m, heading ${r.pose.headingDeg.toFixed(0)}, look-down ${r.pose.lookDownDeg.toFixed(1)}, vfov ${r.pose.vfovDeg}${r.pose.clipped.length ? ` (clipped ${r.pose.clipped})` : ''}, ${r.route}`); }
    } catch (err) { skipped.push({ pandId: e.id, skip: `error: ${(err as Error).message}` }); console.log(`${e.id}: error ${(err as Error).message}`); }
  }
  const ordered = spatialOrder(prepared);
  fs.writeFileSync(path.join(args.out, 'prepared.json'), JSON.stringify({ prepared: ordered, skipped }, null, 1));
  fs.writeFileSync(path.join(args.out, 'job.json'), JSON.stringify(jobFor(args, ordered)));
  console.log(`prepared ${ordered.length}, skipped ${skipped.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s${hits.size ? ` (${hits.size} from the cache)` : ''}; job ${path.join(args.out, 'job.json')}`);
  return { prepared: ordered, skipped };
}

/** One browser session for a job file, in a queue slot (the canal-pw.sh nesting guard keeps a wrapped caller in its slot). */
function runBrowser(jobFile: string): void {
  const port = process.env.PW_PORT ?? (fs.existsSync('.worktree-port') ? fs.readFileSync('.worktree-port', 'utf8').trim() : '');
  if (!port) { console.error('set PW_PORT (a private port): Playwright reuses whatever server holds its port'); process.exit(2); }
  const res = spawnSync(process.env.CANAL_PW ?? '/tmp/canal-pw.sh', ['npx', 'playwright', 'test', 'tests/e2e/house-frames.spec.ts', '--project=desktop', '--reporter=line'], { stdio: 'inherit', env: { ...process.env, PW_PORT: port, HOUSE_FRAMES_JOB: path.resolve(jobFile) } });
  if (res.status !== 0) console.error(`browser run exited ${res.status}; posting whatever frames exist`);
}

/** Checks, pairs, sheets and summary for one input's out dir (after its frames exist). */
async function postAll(args: Args, prepared: Prepared[], skipped: Skipped[]): Promise<void> {
  const job = JSON.parse(fs.readFileSync(path.join(args.out, 'job.json'), 'utf8'));
  const results: any[] = [];
  for (const p of prepared) { const r = await post(p, args, job); results.push(r); if (r.error) console.log(`${p.pandId}: ${r.error}`); }
  const ok = results.filter(r => !r.error);
  const photoEdges = ok.flatMap(r => r.edges.photo.filter((e: EdgeRead) => e.found && e.side !== 'crown').map((e: EdgeRead) => Math.abs(e.offsetPct)));
  const gameEdges = ok.flatMap(r => r.edges.game.filter((e: EdgeRead) => e.found && e.side !== 'crown').map((e: EdgeRead) => Math.abs(e.offsetPct)));
  const timings = fs.existsSync(path.join(args.out, 'browser-timings.json')) ? JSON.parse(fs.readFileSync(path.join(args.out, 'browser-timings.json'), 'utf8')) : null;
  const sheets = await contactSheets(args.out, ok, `house:frames ${args.inputName || ''} ${args.label !== 'run' ? args.label : ''} ${args.query}`.trim());
  const summary = {
    input: args.inputName, label: args.label, query: args.query, pands: args.pands.length, prepared: prepared.length, skipped, framed: ok.length,
    alignment: { photoEdges: photoEdges.length, medianPct: +quantile(photoEdges, 0.5).toFixed(2), p90Pct: +quantile(photoEdges, 0.9).toFixed(2), over3: ok.flatMap(r => r.edges.photo.filter((e: EdgeRead) => e.found && e.side !== 'crown' && Math.abs(e.offsetPct) > 3).map((e: EdgeRead) => `${r.pandId} ${e.side} ${e.offsetPct}%`)), gameEdges: gameEdges.length, gameMedianPct: +quantile(gameEdges, 0.5).toFixed(2) },
    flags: Object.fromEntries(['missing', 'otherBuilding', 'roofOffset', 'wallColour', 'sameAsBefore'].map(k => [k, ok.filter(r => r.flags[k]).map(r => r.pandId)])),
    advisory: { possibleBlankWall: ok.filter(r => r.advisory?.openings).map(r => r.pandId) },
    colourScores: ok.map(r => [r.pandId, r.colour?.score ?? null]),
    ...(args.before ? { compare: { before: args.before, pairs: ok.filter(r => r.compare && !r.compare.error).length, same: ok.filter(r => r.compare?.same).map(r => r.key), changedPct: ok.map(r => [r.key, r.compare?.pct ?? null]) } } : {}),
    throughput: timings ? { poses: timings.poses, wallS: +(timings.wallMs / 1000).toFixed(1), pairsPerMin: +(timings.poses / (timings.wallMs / 60000)).toFixed(2), opened: timings.opened, settleMedianS: +(quantile(timings.timings.map((t: any) => t.settle), 0.5) / 1000).toFixed(1), ...(timings.batch ? { batch: timings.batch } : {}) } : null,
    sheets,
  };
  fs.writeFileSync(path.join(args.out, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ ...summary, skipped: skipped.length }, null, 1));
  const same = (summary as any).compare?.same as string[] | undefined;
  if (same?.length) console.warn(`WARNING: ${same.length} of ${(summary as any).compare.pairs} before/after pairs are the same on the target wall (${same.join(', ')}): the compared flag did not reach their pixels. Check the world (baked cells ignore runtime flags), the mesh worker's flags (engine/workerPool.ts withWorkerFlags) and the pand's guard before reading these pairs as a result.`);
}

/** `--lists a.json:outA,b.json:outB`: one argv per list (`--list a.json --out outA` plus the shared flags). */
export function splitLists(argv: string[]): string[][] {
  const spec = arg(argv, 'lists')!;
  const shared: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lists' || a === '--out' || a === '--list') { i++; continue; }
    if (a.startsWith('--lists=') || a.startsWith('--out=') || a.startsWith('--list=')) continue;
    shared.push(a);
  }
  return spec.split(',').filter(Boolean).map(pair => {
    const i = pair.lastIndexOf(':');
    if (i <= 0 || i === pair.length - 1) throw new Error(`--lists entry "${pair}": want <list.json>:<out dir>`);
    return ['--list', pair.slice(0, i), '--out', pair.slice(i + 1), ...shared];
  });
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || !argv.length) { console.log(HELP); return; }
  if (arg(argv, 'lists')) return batch(argv);
  const args = await parseArgs(argv);
  fs.mkdirSync(args.out, { recursive: true });
  let prepared: Prepared[] = [], skipped: Skipped[] = [];
  if (args.postOnly) ({ prepared, skipped } = JSON.parse(fs.readFileSync(path.join(args.out, 'prepared.json'), 'utf8')));
  else {
    if (!args.pands.length) { console.error('no pands: give --pands, --face, --buurt or --list\n\n' + HELP); process.exit(2); }
    ({ prepared, skipped } = await prepareAll(args));
    if (args.prepOnly || !prepared.length) return;
    runBrowser(path.join(args.out, 'job.json'));
  }
  await postAll(args, prepared, skipped);
}

/** Several lists, one browser session: every pose in one job, list after list, each written to its list's out. */
async function batch(argv: string[]) {
  const runs: Array<{ args: Args; prepared: Prepared[]; skipped: Skipped[] }> = [];
  for (const one of splitLists(argv)) {
    const args = await parseArgs(one);
    if (args.before) args.before = path.join(args.before, path.basename(args.out));
    console.log(`== ${args.inputName} -> ${args.out}`);
    if (args.postOnly) { const p = JSON.parse(fs.readFileSync(path.join(args.out, 'prepared.json'), 'utf8')); runs.push({ args, ...p }); continue; }
    if (!args.pands.length) { console.error(`${args.inputName}: no pands`); process.exit(2); }
    runs.push({ args, ...(await prepareAll(args)) });
  }
  const first = runs[0].args;
  if (!first.postOnly && !first.prepOnly) {
    // List by list, each in its own spatial order: the spec re-opens the page where the out dir changes, so a list's
    // frames start from a fresh page exactly as in a separate run (interleaving lists would re-open at every switch).
    const poses = runs.flatMap(r => jobFor(r.args, r.prepared).poses);
    if (poses.length) {
      const jobFile = path.join(first.out, 'batch-job.json');
      fs.writeFileSync(jobFile, JSON.stringify({ ...jobFor(first, []), poses }));
      console.log(`batch: ${poses.length} poses from ${runs.length} lists in one browser session; job ${jobFile}`);
      runBrowser(jobFile);
    }
  }
  if (first.prepOnly) return;
  for (const r of runs) { console.log(`== post ${r.args.inputName} -> ${r.args.out}`); await postAll(r.args, r.prepared, r.skipped); }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'house-frames', 'frames.ts'))) {
  main().catch(e => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
}
