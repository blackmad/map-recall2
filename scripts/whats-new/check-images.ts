/**
 * What's New picture gate (in check:canal). Fails when a note references a picture that is removed
 * (scripts/whats-new/removed-images.json, every note), missing, or, for notes within 14 days of the newest note,
 * refused by the before/after guard (src/canalRecall/whatsNewPairGuard.ts: under 3 % target mean difference at 260 px,
 * or a frame missing its surroundings). Per-image hints are the optional `guard` object on the image entry; their
 * schema and meaning are in src/canalRecall/whatsNewImageHints.ts.
 *
 *   npm run check:whats-new-images [-- --notes file.json] [--days 14] [--from YYYY-MM-DD] [--json] [--propose] [--offline]
 *
 * Pictures come from the screenshots clone ($MAP_RECALL_SCREENSHOTS, else ~/Code/map-recall2-screenshots); a file not
 * in the clone (or no clone at all) is fetched once from raw.githubusercontent.com into .cache/whats-new-images/. With
 * neither the clone nor the network the check skips the measurement with a loud warning and passes.
 * --from skips the pixel guard for notes dated before it (pictures published before the gate; inert once the window
 * has passed it); the denylist and existence checks still cover every note.
 * --propose prints a suggested `guard` hint per refused picture (for review, never applied automatically).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DEFAULT_THRESHOLDS, detectPanels, pairMetrics, pixelChecks, splitPanels, type PairMetrics, type RawImage, type Refusal } from '../../src/canalRecall/whatsNewPairGuard.ts';
import {
  deniedImages, noteLabel, notesInWindow, planNote, repoPath, SHOTS_RAW_BASE, SHOTS_REPO_URL, toBox, validateNotes, validateRemoved,
  WINDOW_DAYS, type GuardHints, type NotesFile, type PlanItem, type Problem, type RemovedImage,
} from '../../src/canalRecall/whatsNewImageHints.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const USER_AGENT = `map-recall2-whats-new-check (+https://github.com/blackmad/map-recall2)`;

/** Finds a picture's bytes: the clone first, then the cache, then the network. */
export interface ImageSource {
  /** Bytes, or 'missing' (no such file: the clone lacks it and the server says 404), or 'unavailable' (cannot tell). */
  get(path: string): Promise<Buffer | 'missing' | 'unavailable'>;
  readonly offline: boolean;
  readonly clone: string | null;
}

export function defaultSource(opts: { clone?: string | null; cacheDir?: string; network?: boolean; fetchImpl?: typeof fetch } = {}): ImageSource {
  const clone = opts.clone !== undefined ? opts.clone : (process.env.MAP_RECALL_SCREENSHOTS || join(homedir(), 'Code/map-recall2-screenshots'));
  const hasClone = !!clone && existsSync(join(clone, 'whats-new'));
  const cacheDir = opts.cacheDir ?? join(ROOT, '.cache/whats-new-images');
  const doFetch = opts.fetchImpl ?? fetch;
  let network = opts.network ?? true;
  return {
    get clone() { return hasClone ? clone : null; },
    get offline() { return !hasClone && !network; },
    async get(path) {
      if (hasClone && existsSync(join(clone!, path))) return readFileSync(join(clone!, path));
      const cached = join(cacheDir, path);
      if (existsSync(cached)) return readFileSync(cached);
      if (!network) return 'unavailable';
      try {
        const res = await doFetch(SHOTS_RAW_BASE + path.split('/').map(encodeURIComponent).join('/'), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
        if (res.status === 404) return 'missing';
        if (!res.ok) return 'unavailable';
        const buf = Buffer.from(await res.arrayBuffer());
        mkdirSync(dirname(cached), { recursive: true });
        writeFileSync(cached, buf);
        return buf;
      } catch {
        network = false; // one network failure: stop trying, say so once at the end
        return 'unavailable';
      }
    },
  };
}

export async function decode(buf: Buffer, size?: { width: number; height: number }): Promise<RawImage> {
  let s = sharp(buf).removeAlpha();
  if (size) s = s.resize(size.width, size.height, { fit: 'fill' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, channels: info.channels, data };
}

export interface ImageResult {
  note: string;
  src: string;
  how: PlanItem['kind'];
  status: 'ok' | 'refused' | 'skipped' | 'unavailable' | 'missing' | 'error';
  panels?: number;
  metrics?: PairMetrics;
  refusals?: Refusal[];
  detail?: string;
}

/** Splits a composite into its before and after panels, as the hints say. */
export function pairFromComposite(sheet: RawImage, hints: GuardHints): { panels: number; pair: [RawImage, RawImage] | null } {
  const panels = hints.panels ? splitPanels(sheet, hints.panels, hints.gutter ?? 6, !!hints.vertical) : detectPanels(sheet, !!hints.vertical);
  if (panels.length < 2) return { panels: panels.length, pair: null };
  const [i, j] = hints.pair ?? [panels.length - 2, panels.length - 1];
  if (!panels[i] || !panels[j]) return { panels: panels.length, pair: null };
  return { panels: panels.length, pair: [panels[i], panels[j]] };
}

export function measure(before: RawImage, after: RawImage, hints: GuardHints): { metrics: PairMetrics; refusals: Refusal[] } {
  const metrics = pairMetrics(before, after, toBox(hints.target), toBox(hints.frame));
  return { metrics, refusals: pixelChecks(metrics, DEFAULT_THRESHOLDS) };
}

async function fetchBytes(source: ImageSource, src: string): Promise<Buffer | 'missing' | 'unavailable' | 'external'> {
  const path = repoPath(src);
  if (path == null) return 'external';
  return path.split('/').includes('..') ? 'missing' : source.get(path);
}

export async function checkItem(item: PlanItem, source: ImageSource): Promise<ImageResult> {
  const base = { note: noteLabel(item.note), src: item.image.src, how: item.kind };
  const bytes = await fetchBytes(source, item.image.src);
  if (bytes === 'missing') return { ...base, status: 'missing', detail: `no such file in ${SHOTS_REPO_URL}` };
  if (bytes === 'unavailable') return { ...base, status: 'unavailable' };
  if (bytes === 'external') return { ...base, status: 'skipped', detail: 'not in the screenshots repo' };
  if (item.kind === 'single' || item.kind === 'grid') return { ...base, status: 'skipped', detail: `${item.kind}${item.reason ? `: ${item.reason}` : ''}` };
  if (item.kind === 'covered') return { ...base, status: 'skipped', detail: `after of ${item.by}` };
  try {
    if (item.kind === 'split') {
      const afterBytes = await fetchBytes(source, item.after.src);
      if (afterBytes === 'missing') return { ...base, status: 'missing', detail: `its after ${item.after.src} does not exist` };
      if (afterBytes === 'unavailable' || afterBytes === 'external') return { ...base, status: afterBytes === 'external' ? 'skipped' : 'unavailable', detail: `after ${item.after.src}` };
      const before = await decode(bytes);
      const after = await decode(afterBytes, { width: before.width, height: before.height });
      return { ...base, panels: 2, ...withStatus(measure(before, after, item.hints)), detail: `with ${item.after.src}` };
    }
    const sheet = await decode(bytes);
    const { panels, pair } = pairFromComposite(sheet, item.hints);
    if (!pair) {
      return { ...base, status: 'refused', panels, refusals: [{ code: 'too-similar', message: `found ${panels} panel(s), no before/after pair to compare; give guard.panels (and gutter), or guard.kind "single" / "grid" with a reason` }] };
    }
    return { ...base, panels, ...withStatus(measure(pair[0], pair[1], item.hints)) };
  } catch (e) {
    return { ...base, status: 'error', detail: (e as Error).message };
  }
}

function withStatus(r: { metrics: PairMetrics; refusals: Refusal[] }): Pick<ImageResult, 'metrics' | 'refusals' | 'status'> {
  return { ...r, status: r.refusals.length ? 'refused' : 'ok' };
}

export interface Report { problems: Problem[]; results: ImageResult[]; unavailable: number; offline: boolean; windowFrom: string | null }

/** Runs every check; `problems` non-empty means the gate fails. */
export async function checkNotes(file: NotesFile, removed: RemovedImage[], source: ImageSource, opts: { days?: number; from?: string | null } = {}): Promise<Report> {
  const problems: Problem[] = [...validateNotes(file)];
  for (const m of validateRemoved(removed)) problems.push({ note: '(removed-images.json)', src: null, message: m });
  if (problems.length) return { problems, results: [], unavailable: 0, offline: source.offline, windowFrom: null };
  problems.push(...deniedImages(file.notes, removed));
  const windowNotes = notesInWindow(file.notes, opts.days ?? WINDOW_DAYS, opts.from ?? null);
  const items = windowNotes.flatMap(planNote);
  const results: ImageResult[] = new Array(items.length);
  let next = 0;
  // Fetch/decoding overlaps across a few workers; the pixel loops stay on the main thread.
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < items.length) { const k = next++; results[k] = await checkItem(items[k], source); } }));
  // Existence beyond the window: only when the clone can answer cheaply.
  const inWindow = new Set(windowNotes);
  if (source.clone) {
    for (const n of file.notes) {
      if (inWindow.has(n)) continue;
      for (const img of n.images ?? []) {
        if (typeof img === 'string') continue;
        const path = repoPath(img.src);
        if (path != null && !existsSync(join(source.clone, path))) {
          const got = await source.get(path); // the clone may be behind origin
          if (got === 'missing') problems.push({ note: noteLabel(n), src: img.src, message: `no such file in ${SHOTS_REPO_URL}` });
        }
      }
    }
  }
  for (const r of results) {
    if (r.status === 'missing') problems.push({ note: r.note, src: r.src, message: r.detail ?? 'missing' });
    if (r.status === 'error') problems.push({ note: r.note, src: r.src, message: `could not read: ${r.detail}` });
    if (r.status === 'refused') problems.push({ note: r.note, src: r.src, message: `refused (${fmtMetrics(r)}): ${(r.refusals ?? []).map(x => `${x.code}: ${x.message}`).join('; ')}` });
  }
  const windowFrom = windowNotes.length ? windowNotes.map(n => n.date).sort()[0] : null;
  return { problems, results, unavailable: results.filter(r => r.status === 'unavailable').length, offline: source.offline, windowFrom };
}

const pct = (v: number | null | undefined): string => (v == null ? '-' : `${(v * 100).toFixed(1)}%`);
export const fmtMetrics = (r: ImageResult): string => (r.metrics
  ? `target mean diff ${pct(r.metrics.targetMeanDiff)} (bar ${pct(DEFAULT_THRESHOLDS.minTargetMeanDiff)}), context changed ${pct(r.metrics.contextChanged)}, edges ${pct(r.metrics.edgeBefore)}/${pct(r.metrics.edgeAfter)}, panels ${r.panels}`
  : `panels ${r.panels ?? '-'}`);

/** A starting point for a refused picture's hint; a person still looks at the picture. */
export function proposeHint(r: ImageResult): GuardHints | null {
  if (r.status !== 'refused') return null;
  if (r.panels === 1 || r.panels === 0) return { kind: 'single', reason: 'one frame: no before/after in this picture' };
  if ((r.panels ?? 0) >= 4) return { kind: 'grid', reason: `${r.panels} panels with no one before/after` };
  return null; // a real pair that measured weak: drop the picture or draw guard.target round the change
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opt = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
  const flag = (name: string): boolean => args.includes(`--${name}`);
  const t0 = Date.now();
  const notesPath = resolve(opt('notes') ?? join(ROOT, 'public/canal-drive/whats-new-notes.json'));
  const file = JSON.parse(readFileSync(notesPath, 'utf8')) as NotesFile;
  const removed = JSON.parse(readFileSync(join(ROOT, 'scripts/whats-new/removed-images.json'), 'utf8')) as RemovedImage[];
  const source = defaultSource({ network: !flag('offline') });
  const from = opt('from') ?? null;
  if (from != null && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error(`--from ${from}: want YYYY-MM-DD`);
  const report = await checkNotes(file, removed, source, { days: Number(opt('days') ?? WINDOW_DAYS), from });
  if (flag('json')) console.log(JSON.stringify(report, null, 1));
  else {
    console.log(`What's New pictures: ${report.results.length} in notes from ${report.windowFrom ?? '-'} on; clone ${source.clone ?? 'none'}`);
    for (const r of report.results) {
      const mark = { ok: 'ok     ', refused: 'REFUSED', skipped: 'skip   ', unavailable: 'n/a    ', missing: 'MISSING', error: 'ERROR  ' }[r.status];
      console.log(`  ${mark} ${r.src}  ${r.metrics || r.status === 'refused' ? fmtMetrics(r) : ''}${r.detail ? `  [${r.detail}]` : ''}`);
    }
  }
  if (flag('propose')) {
    const proposals = report.results.map(r => ({ note: r.note, src: r.src, guard: proposeHint(r) })).filter(p => p.guard);
    console.log(JSON.stringify(proposals, null, 1));
  }
  if (report.unavailable) {
    const why = report.offline ? 'no screenshots clone and no network' : 'the network failed';
    console.warn(`\n!!! WARNING: ${report.unavailable} What's New picture(s) NOT CHECKED (${why}). Set MAP_RECALL_SCREENSHOTS to a clone of ${SHOTS_REPO_URL}. !!!\n`);
  }
  if (report.problems.length) {
    console.error(`\nWhat's New picture gate FAILED (${report.problems.length}):`);
    for (const p of report.problems) console.error(`  ${p.note}${p.src ? ` ${p.src}` : ''}: ${p.message}`);
    console.error('\nHints go in the image entry\'s "guard" object (src/canalRecall/whatsNewImageHints.ts); removed pictures stay out (scripts/whats-new/removed-images.json).');
    process.exitCode = 1;
  } else console.log(`What's New picture gate passed${report.unavailable ? ` WITH ${report.unavailable} PICTURE(S) UNCHECKED` : ''} (${((Date.now() - t0) / 1000).toFixed(1)} s).`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
