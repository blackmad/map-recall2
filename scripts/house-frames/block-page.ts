/**
 * house:block-page (lane 3, 2026-11-13): the Haarlemmerdijk block comparison page, regenerable in about ten minutes.
 *
 * One page David and the reviewer look at: per house row, photo | this morning | now, rule-10 frames (first person 72 deg,
 * 1440 x 900 css at dpr 2, house:frames --rule10: the photo cut to the same window, raised so the crown is in), plus one
 * as-played chase frame per face. Images live in the screenshots repo (blackmad/map-recall2-screenshots, a lane branch);
 * the game repo holds the page (public/canal-drive/haarlemmerdijk-block.html) and its manifest
 * (public/canal-drive/haarlemmerdijk-block.json) only. The page draws images; no engine runs on it.
 *
 * Steps (each one runs alone; `all` = shoot + publish):
 *   rows      the row list from block faces (scripts/block-face/faces/<face>/strip.json spans, left to right)
 *               --faces a,b,c   default the four Haarlemmerdijk/Haarlemmerstraat faces below
 *   shoot     house:frames --lists (one list per face, one browser session, one queue slot) --rule10 --reuse-photos
 *               --run <id>      out dir artifacts/block-page/<id>/<face>/ (default: now-<yyyymmdd-hhmm>)
 *               --before <id>   an earlier run: house:frames compares each frame with it (pose.json compare)
 *   publish   the frames as JPEG into the screenshots worktree (review/haarlemmerdijk-block/<run>/), the manifest updated
 *               --run <id> --column morning|now   which column the run fills
 *               --push          commit and push the screenshots branch (else the page's base URL must point at local files)
 *   all       --run <id> --column now [--before <morning run>] [--push]
 *
 * Common flags: --rows <file> (default scripts/house-frames/block-page/haarlemmerdijk-block.rows.json),
 *   --shots <dir> (the screenshots-repo worktree; default $BLOCK_PAGE_SHOTS, else ~/Code/map-recall2-worktrees/screenshots-block-page-20261113),
 *   --branch <name> (that worktree's branch, used in the raw URLs; default its current branch),
 *   --faces a,b (shoot/publish only those faces; the page keeps the others' frames).
 *
 * Time (2026-11-13, load average 20-46, photo cache warm, dpr pinned at 2): the whole block 1,528 s (browser 1,064 s
 * for 68 poses, the rest prep and the queue wait); one face, haarlemmerdijk-2-58 (21 poses), 386 s end to end
 * including the publish. The ten-minute regeneration on a loaded machine is one or two faces: --faces a,b.
 * Same-build control (now-control-20261113 vs morning-20261113, face 2-58): every frame pixel-identical, ground band
 * 0 % changed, so a difference between the columns is the build's.
 *
 * Numbers above each row (front top, storey count, crown family, game vs photo) come from, in order:
 *   data/front-records/haarlemmerdijk-block.json (lane 2) and --numbers <file> (lane 1), either of the shape
 *     { "fronts": [{ "pandId": "0363...", "photo": { "frontTopM": 12.1, "storeys": 4, "crown": "spout" },
 *                    "game":  { "frontTopM": 11.4, "storeys": 3, "crown": "cornice" } }] }
 *     (also accepted: a top-level array, `records`/`houses` for `fronts`, and keys containing frontTop / storey / crown);
 *   else the frames' own skyline read (pose.json skyline medians, m over the wall foot: front top only, marked "frames").
 *
 * Control (review rule 8-10): before and after are the same pose (house:frames --reuse-photos keeps the pick and pose),
 * the same lens, dpr and query; publish diffs a ground band (the bottom 12 % of each likeness frame) between the
 * morning and now frames and writes the result into the manifest, flagged where over 3 % of the band changed.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const DEFAULT_FACES = ['haarlemmerdijk-2-58', 'haarlemmerdijk-13-45', 'haarlemmerdijk-117-143', 'haarlemmer-46-96'];
export const ROWS_FILE = 'scripts/house-frames/block-page/haarlemmerdijk-block.rows.json';
export const MANIFEST = 'public/canal-drive/haarlemmerdijk-block.json';
export const SHOTS_PREFIX = 'review/haarlemmerdijk-block';
export const DEFAULT_SHOTS = '/Users/blackmad/Code/map-recall2-worktrees/screenshots-block-page-20261113';
export const FRAMES_ROOT = 'artifacts/block-page';
export const FRONT_RECORDS = 'data/front-records/haarlemmerdijk-block.json';
/** Ground band diff over this share of pixels = the pair is not controlled. */
export const GROUND_CHANGED_MAX = 0.03;
const PW_PORT = process.env.PW_PORT ?? '4675';

export type RowGroup = { face: string; street: string; pands: string[] };
/** notPanos: captures (or 'MISSION_*' prefixes) no pick may use, for every pand: see BAD_MISSIONS. */
export type Rows = { title: string; notPanos?: string[]; groups: RowGroup[] };
/**
 * Missions whose panorama positions are metres off on this block (measured 2026-11-13): TMX7316010203-001900
 * (2020-08-31) puts its captures ~9.4 m from the even-side fronts where the image shows ~5.7 m: the BAG outline
 * that fits the game frame covers a third of the house it lands on in the photo, on all 18 even-side picks, while
 * the 2020-01-10, 2021 and 2025 captures fit.
 */
export const BAD_MISSIONS = ['TMX7316010203-001900_*'];
/**
 * The game as David's Mac draws it, whatever this machine's load: the render governor (renderGovernor.ts) stepped 66 of
 * 68 likeness frames down to pixel ratio 0.75 on a loaded machine (2026-11-13), so the pixel ratio is pinned at 2, the
 * governor is off and the quality tier forced high. Every caption carries the measured ratio (likeness.json).
 */
export const FRAME_QUERY = '?dpr=2&governor=0&tier=high';
export type Pair = { game: number | string | null; photo: number | string | null; source: string };
export type Numbers = { frontTopM?: Pair; storeys?: Pair; crown?: Pair };
export type Frame = { src: string; caption: string };
export type ColumnRun = { run: string; label: string; build: string; shotAt: string; query: string; captionBase: string };
export type ManifestRow = {
  pandId: string; street: string; note?: string;
  photo?: Frame; morning?: Frame; now?: Frame;
  ground?: { changedPct: number; meanDelta: number; controlled: boolean };
  numbers?: Numbers; problems?: string[];
  /** house:frames advisory flags from the pano-lens pair (flags only, not for acceptance). */
  flags?: string[];
};
export type Manifest = {
  title: string; base: string; generatedAt: string;
  columns: { morning?: ColumnRun; now?: ColumnRun };
  groups: Array<{ face: string; street: string; asPlayed: { morning?: Frame; now?: Frame }; rows: ManifestRow[] }>;
  noPhoto: string[];
  regenerate: string;
};

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) return argv[i + 1];
  return argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}
const git = (args: string[], cwd = '.') => spawnSync('/usr/bin/git', args, { cwd, encoding: 'utf8' });
const readJson = <T>(file: string): T | null => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; } };
const writeJson = (file: string, v: unknown) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(v, null, 1) + '\n'); };
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');

// ---- rows -----------------------------------------------------------------------------------------------------------
export function rowsFromFaces(faces: string[], facesDir = 'scripts/block-face/faces'): Rows {
  const groups = faces.map(face => {
    const strip = readJson<{ spans: Array<{ pandId: string }> }>(path.join(facesDir, face, 'strip.json'));
    const disc = readJson<{ street: string; members: string[] }>(path.join(facesDir, face, 'discovery.json'));
    if (!strip && !disc) throw new Error(`face ${face}: no strip.json or discovery.json under ${facesDir}`);
    const pands = strip?.spans.map(s => s.pandId) ?? disc!.members;
    return { face, street: disc?.street ?? '', pands: [...new Set(pands)] };
  });
  return { title: 'Haarlemmerdijk block', notPanos: BAD_MISSIONS, groups };
}

// ---- shoot ----------------------------------------------------------------------------------------------------------
export function shoot(rows: Rows, run: string, before?: string): number {
  const root = path.join(FRAMES_ROOT, run), lists: string[] = [];
  for (const g of rows.groups) {
    const list = path.join(root, 'lists', `${g.face}.json`);
    writeJson(list, rows.notPanos?.length ? g.pands.map(pandId => ({ pandId, notPanos: rows.notPanos })) : g.pands);
    lists.push(`${list}:${path.join(root, g.face)}`);
  }
  const argv = ['--import', 'tsx', 'scripts/house-frames/frames.ts', '--lists', lists.join(','), '--rule10', '--reuse-photos',
    '--prefer-obliquity', '30', '--season', 'winter', '--label', run, '--query', FRAME_QUERY, ...(before ? ['--before', path.join(FRAMES_ROOT, before)] : [])];
  console.log(`block-page shoot: node ${argv.join(' ')}  (PW_PORT ${PW_PORT})`);
  const t0 = Date.now(), build = buildOf();
  const r = spawnSync('node', argv, { stdio: 'inherit', env: { ...process.env, PW_PORT } });
  const secs = Math.round((Date.now() - t0) / 1000);
  writeJson(path.join(root, 'run.json'), { run, before: before ?? null, secs, build, shotAt: new Date().toISOString(), status: r.status });
  console.log(`block-page shoot: ${run} took ${secs} s (status ${r.status})`);
  return r.status ?? 1;
}
/** The build the dev server served: the last commit touching public/ (this page's own files excluded), plus dirt. */
function buildOf(): string {
  const sha = git(['log', '-1', '--format=%h', '--abbrev=9', '--', 'public', ':!public/canal-drive/haarlemmerdijk-block.*']).stdout.trim();
  const dirty = git(['status', '--porcelain', '--', 'public', ':!public/canal-drive/haarlemmerdijk-block.*']).stdout.trim() ? '+dirty public/' : '';
  return `${sha}${dirty}`;
}

// ---- publish --------------------------------------------------------------------------------------------------------
/** Share of pixels in the bottom band whose RGB distance exceeds 0.04 (of 255), and the mean distance. */
export async function groundDiff(a: string, b: string, band = 0.12): Promise<{ changedPct: number; meanDelta: number }> {
  const load = async (f: string) => {
    const img = sharp(f); const m = await img.metadata();
    const h = Math.round(m.height! * band);
    return img.extract({ left: 0, top: m.height! - h, width: m.width!, height: h }).resize(720, Math.round(720 * h / m.width!), { fit: 'fill' }).removeAlpha().raw().toBuffer();
  };
  const [x, y] = await Promise.all([load(a), load(b)]);
  let changed = 0, sum = 0; const n = Math.min(x.length, y.length) / 3;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(x[3 * i] - y[3 * i], x[3 * i + 1] - y[3 * i + 1], x[3 * i + 2] - y[3 * i + 2]) / 255;
    sum += d; if (d > 0.04) changed++;
  }
  return { changedPct: +(100 * changed / n).toFixed(2), meanDelta: +(sum / n).toFixed(4) };
}

async function toJpeg(src: string, dst: string, quality = 80): Promise<boolean> {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  await sharp(src).jpeg({ quality, mozjpeg: true }).toFile(dst);
  return true;
}

function pairOf(rec: Record<string, any>, re: RegExp, source: string): Pair | undefined {
  const pick = (o: any) => { if (!o || typeof o !== 'object') return undefined; const k = Object.keys(o).find(k => re.test(k)); return k ? o[k] : undefined; };
  let game = pick(rec.game), photo = pick(rec.photo);
  if (game === undefined && photo === undefined) {
    const flat = Object.keys(rec).filter(k => re.test(k));
    game = rec[flat.find(k => /game|model/i.test(k)) ?? ''];
    photo = rec[flat.find(k => /photo|pano/i.test(k)) ?? ''];
  }
  if (game && typeof game === 'object') game = game.value ?? game.family ?? null;
  if (photo && typeof photo === 'object') photo = photo.value ?? photo.family ?? null;
  return game === undefined && photo === undefined ? undefined : { game: game ?? null, photo: photo ?? null, source };
}
export function numbersFrom(files: string[]): Map<string, Numbers> {
  const out = new Map<string, Numbers>();
  for (const file of files) {
    const j = readJson<any>(file);
    if (!j) continue;
    const recs: any[] = Array.isArray(j) ? j : j.fronts ?? j.records ?? j.houses ?? Object.entries(j.byPand ?? {}).map(([pandId, v]: any) => ({ pandId, ...v }));
    const source = path.basename(file);
    for (const r of recs) {
      const id = String(r.pandId ?? r.id ?? '').replace(/^NL\.IMBAG\.Pand\./, '');
      if (!id) continue;
      const cur = out.get(id) ?? {};
      const ft = pairOf(r, /front.?top|eaves|crownTop/i, source), st = pairOf(r, /storey|floors|bouwlagen/i, source), cr = pairOf(r, /crown(?!Top)|roofFamily|gable/i, source);
      out.set(id, { ...cur, ...(ft ? { frontTopM: ft } : {}), ...(st ? { storeys: st } : {}), ...(cr ? { crown: cr } : {}) });
    }
  }
  return out;
}

export async function publish(rows: Rows, run: string, column: 'morning' | 'now', shots: string, branch: string, extraNumbers: string[]): Promise<Manifest> {
  const root = path.join(FRAMES_ROOT, run), dst = path.join(shots, SHOTS_PREFIX, run);
  const meta = readJson<{ build: string; shotAt: string; secs: number }>(path.join(root, 'run.json')) ?? { build: buildOf(), shotAt: new Date().toISOString(), secs: 0 };
  const base = `https://raw.githubusercontent.com/blackmad/map-recall2-screenshots/${branch}/`;
  const prev = readJson<Manifest>(MANIFEST);
  const m: Manifest = prev && prev.base === base ? prev : { title: `${rows.title}: photo | this morning | now`, base, generatedAt: '', columns: {}, groups: [], noPhoto: [], regenerate: '' };
  m.generatedAt = new Date().toISOString();
  m.regenerate = 'node --import tsx scripts/house-frames/block-page.ts all --column now --before <morning run> --push';
  const nums = numbersFrom([FRONT_RECORDS, ...extraNumbers]);
  const morningRun = m.columns.morning?.run;
  let query = '';
  for (const g of rows.groups) {
    let grp = m.groups.find(x => x.face === g.face);
    if (!grp) { grp = { face: g.face, street: g.street, asPlayed: {}, rows: [] }; m.groups.push(grp); }
    grp.rows = g.pands.map(id => grp!.rows.find(r => r.pandId === id) ?? { pandId: id, street: g.street });
    const gdir = path.join(root, g.face);
    const job = readJson<any>(path.join(gdir, 'job.json')) ?? readJson<any>(path.join(root, rows.groups[0].face, 'batch-job.json'));
    query = job?.query ?? query;
    const ap = readJson<any>(path.join(gdir, 'as-played.json'));
    const apRel = `${SHOTS_PREFIX}/${run}/${g.face}-as-played.jpg`;
    if (await toJpeg(path.join(gdir, 'as-played.png'), path.join(shots, apRel), 78))
      grp.asPlayed[column] = { src: apRel, caption: `chase camera 36.9° vfov | dpr ${ap?.dpr ?? '?'} | engine default (maplibre) | world baked world-v1 | build ${meta.build} | ${run}` };
    for (const row of grp.rows) {
      const kdir = path.join(gdir, row.pandId), pose = readJson<any>(path.join(kdir, 'pose.json')), lk = readJson<any>(path.join(kdir, 'likeness.json'));
      const l = pose?.rule10?.likeness;
      row.street = pose?.street || row.street;
      row.problems = [];
      if (!pose) row.problems.push('no pose: house:frames skipped this pand (no usable panorama or wall)');
      const camera = l ? `first person 72° vfov${l.lp?.shiftPx ? `, raised ${l.lp.shiftPx} px` : ''}` : 'first person 72° vfov';
      if (l) {
        row.note = `panorama ${String(l.pano.timestamp).slice(0, 10)}, ${l.pano.distM} m, obliquity ${l.pano.obliquityDeg}°${l.farBank ? ', far bank' : ''}${l.lp?.clipped?.length ? `, clipped ${l.lp.clipped.join('+')}` : ''}`;
        const pRel = `${SHOTS_PREFIX}/${run}/${row.pandId}-photo.jpg`;
        if (!row.photo || column === 'morning') {
          if (await toJpeg(path.join(kdir, 'likeness-photo.jpg'), path.join(shots, pRel), 80))
            row.photo = { src: pRel, caption: `panorama ${l.pano.panoId}, cut to the game window (${camera}, 1440×900 css ×2)` };
        }
      } else if (pose) row.problems.push('no likeness capture holds the front at 72°');
      if (l?.lp?.clipped?.length) row.problems.push(`no capture holds the whole front at 72°: clipped ${l.lp.clipped.join('+')}`);
      const gRel = `${SHOTS_PREFIX}/${run}/${row.pandId}-game.jpg`;
      if (await toJpeg(path.join(kdir, 'likeness.png'), path.join(shots, gRel), 80)) {
        row[column] = { src: gRel, caption: `${camera} | 1440×900 css | dpr ${lk?.dpr ?? '?'} (measured) | engine own | world baked world-v1 | ${query.replace(/^\?/, '')} | trees hidden | build ${meta.build} | ${run}` };
        if (lk?.dpr != null && Math.abs(lk.dpr - 2) > 0.01) row.problems.push(`${column} frame drew at pixel ratio ${lk.dpr}, not 2`);
      } else row.problems.push(`no ${column} frame`);
      if (column === 'now' && morningRun && morningRun !== run) {
        // The morning PNG when it is still on disk, else the published morning JPEG (intermediates are deleted after a push).
        const png = path.join(FRAMES_ROOT, morningRun, g.face, row.pandId, 'likeness.png');
        const a = fs.existsSync(png) ? png : path.join(shots, SHOTS_PREFIX, morningRun, `${row.pandId}-game.jpg`), b = path.join(kdir, 'likeness.png');
        if (fs.existsSync(a) && fs.existsSync(b)) { const d = await groundDiff(a, b); row.ground = { ...d, controlled: d.changedPct / 100 <= GROUND_CHANGED_MAX }; }
        else if (fs.existsSync(b)) row.problems.push('ground diff not run: morning frames deleted locally');
      }
      const n: Numbers = { ...(nums.get(row.pandId) ?? {}) };
      if (!n.frontTopM && pose?.skyline) {
        const s = pose.skyline;
        const gm = s.offset?.game?.medianM ?? null, pm = s.offset?.photo?.medianM ?? null;
        if (gm != null || pm != null) n.frontTopM = { game: gm, photo: pm, source: `frames skyline (${run}, pano lens)` };
      }
      row.numbers = n;
      row.flags = Object.entries(pose?.flags ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v === true ? 'yes' : v}`);
      if (!row.flags.length) delete row.flags;
      if (!row.problems.length) delete row.problems;
    }
  }
  m.columns[column] = { run, label: column === 'morning' ? 'this morning' : 'now', build: meta.build, shotAt: meta.shotAt, query, captionBase: `rule 10 frames; shoot ${meta.secs} s` };
  m.noPhoto = m.groups.flatMap(g => g.rows.filter(r => !r.photo).map(r => r.pandId));
  writeJson(MANIFEST, m);
  console.log(`block-page publish: ${MANIFEST} (${m.groups.reduce((s, g) => s + g.rows.length, 0)} rows, ${m.noPhoto.length} without a photo), images under ${dst}`);
  return m;
}

function push(shots: string, run: string): void {
  const add = git(['add', SHOTS_PREFIX], shots); if (add.status) throw new Error(add.stderr);
  const c = git(['commit', '-q', '-m', `Haarlemmerdijk block page: ${run}`], shots);
  if (c.status && !/nothing to commit/.test(c.stdout + c.stderr)) throw new Error(c.stderr);
  const p = git(['push', '-q', '-u', 'origin', 'HEAD'], shots); if (p.status) throw new Error(p.stderr);
  console.log(`block-page: pushed ${git(['rev-parse', '--short', 'HEAD'], shots).stdout.trim()} on ${git(['branch', '--show-current'], shots).stdout.trim()}`);
}

export async function main(argv = process.argv.slice(2)) {
  const step = argv[0];
  const rowsFile = flag(argv, 'rows') ?? ROWS_FILE;
  if (step === 'rows') {
    const faces = (flag(argv, 'faces') ?? DEFAULT_FACES.join(',')).split(',').filter(Boolean);
    const rows = rowsFromFaces(faces);
    writeJson(rowsFile, rows);
    console.log(`block-page rows: ${rowsFile}: ${rows.groups.map(g => `${g.face} ${g.pands.length}`).join(', ')}`);
    return;
  }
  const rows = readJson<Rows>(rowsFile);
  if (!rows) throw new Error(`no rows file ${rowsFile}: run the rows step first`);
  // --faces a,b: shoot and publish only those faces (the others keep their frames on the page).
  const only = flag(argv, 'faces')?.split(',').filter(Boolean);
  if (only) {
    const unknown = only.filter(f => !rows.groups.some(g => g.face === f));
    if (unknown.length) throw new Error(`--faces ${unknown.join(',')}: not in ${rowsFile}`);
    rows.groups = rows.groups.filter(g => only.includes(g.face));
  }
  const shots = path.resolve(flag(argv, 'shots') ?? process.env.BLOCK_PAGE_SHOTS ?? DEFAULT_SHOTS);
  const branch = flag(argv, 'branch') ?? (git(['branch', '--show-current'], shots).stdout.trim() || 'main');
  const column = (flag(argv, 'column') ?? 'now') as 'morning' | 'now';
  if (column !== 'morning' && column !== 'now') throw new Error(`--column ${column}: want morning or now`);
  const run = flag(argv, 'run') ?? `${column}-${stamp()}`;
  const before = flag(argv, 'before');
  const numbers = argv.flatMap((a, i) => a === '--numbers' ? [argv[i + 1]] : []);
  const t0 = Date.now();
  if (step === 'shoot' || step === 'all') { const s = shoot(rows, run, before); if (s && step === 'shoot') process.exit(s); }
  if (step === 'publish' || step === 'all') {
    if (!fs.existsSync(shots)) throw new Error(`no screenshots worktree at ${shots} (--shots)`);
    await publish(rows, run, column, shots, branch, numbers);
    if (argv.includes('--push')) push(shots, run);
  }
  if (!['rows', 'shoot', 'publish', 'all'].includes(step)) { console.log('usage: block-page.ts rows|shoot|publish|all [flags]  (see the header)'); process.exit(2); }
  console.log(`block-page ${step}: ${Math.round((Date.now() - t0) / 1000)} s`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
