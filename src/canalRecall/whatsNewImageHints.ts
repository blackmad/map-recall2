/**
 * What's New picture gate: the typed shape of the notes file's image entries, the optional per-image `guard` hints,
 * the date window, the removed-images denylist, and the plan of which pictures are measured how. Pure; the IO (finding
 * the files, decoding, running whatsNewPairGuard.ts) lives in scripts/whats-new/check-images.ts.
 *
 * Why (user, 2026-11-22/23): pairs whose before was half-loaded or a plot-clearing underlay shot, pairs where almost
 * nothing changes, and pairs whose after is worse kept reaching the page from other sessions, and regenerated notes
 * re-added pictures that had been taken out. `npm run check:whats-new-images` (in check:canal) now refuses them.
 *
 * Image entry (public/canal-drive/whats-new-notes.json `notes[].images[]`):
 *
 *   { "src": "whats-new/2026-11-23-slug.jpg", "alt": "...", "caption": "...", "guard": { ...hints } }
 *
 * `src` is a path in github.com/blackmad/map-recall2-screenshots or a full https URL. `guard` is optional; without it
 * the picture is taken to be a before/after composite (panels found from the gutters, the last two compared over the
 * whole frame), or one half of a split pair when a sibling entry differs only by `before` -> `after`.
 *
 * `guard` hints, all optional:
 *   kind      "pair" (default) | "single" | "grid".
 *             "single": one frame, after-only, or photo beside model: only its existence is checked.
 *             "grid": many panels with no one before/after (four sides, a contact sheet); needs `reason`.
 *   reason    why the picture is not measured as a pair (required for "grid"; welcome on "single").
 *   panels    split a composite into this many equal panels (2..12) instead of finding the gutters.
 *   gutter    px between equal panels when `panels` is given (default 6).
 *   vertical  panels stacked top to bottom.
 *   pair      [before, after] panel indexes, 0-based (default the last two).
 *   target    [x, y, w, h] fractions of a panel: the part the note is about. Also turns on the context checks
 *             (missing buildings, a moved pose) outside the box.
 *   frame     [x, y, w, h] fractions of a panel to judge at all (trims HUD or caption bands).
 *   after     on a split pair's before entry: the src of its after (when the names do not pair by themselves).
 */

export type Box4 = [number, number, number, number];

export interface GuardHints {
  kind?: 'pair' | 'single' | 'grid';
  reason?: string;
  panels?: number;
  gutter?: number;
  vertical?: boolean;
  pair?: [number, number];
  target?: Box4;
  frame?: Box4;
  after?: string;
}

export interface ImageEntry { src: string; alt?: string; caption?: string; guard?: GuardHints }
export interface Note { date: string; title: string; images?: Array<ImageEntry | string> }
export interface NotesFile { notes: Note[] }

export interface RemovedImage { src: string; date: string; why: string }

export interface Problem { note: string; src: string | null; message: string }

export const SHOTS_REPO_URL = 'https://github.com/blackmad/map-recall2-screenshots';
export const SHOTS_RAW_BASE = 'https://raw.githubusercontent.com/blackmad/map-recall2-screenshots/main/';
export const WINDOW_DAYS = 14;

const HINT_KEYS = new Set(['kind', 'reason', 'panels', 'gutter', 'vertical', 'pair', 'target', 'frame', 'after']);
const ENTRY_KEYS = new Set(['src', 'alt', 'caption', 'guard']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const noteLabel = (n: Pick<Note, 'date' | 'title'>): string => `${n.date} "${n.title}"`;

function boxProblem(v: unknown, name: string): string | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(n => typeof n === 'number' && Number.isFinite(n))) return `guard.${name} must be [x, y, w, h] fractions`;
  const [x, y, w, h] = v as number[];
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return `guard.${name} [${v.join(', ')}] must lie inside 0..1 with positive size`;
  return null;
}

/** Problems with one `guard` object (empty when valid). */
export function validateHints(g: unknown): string[] {
  if (g == null || typeof g !== 'object' || Array.isArray(g)) return ['guard must be an object'];
  const h = g as Record<string, unknown>, out: string[] = [];
  for (const k of Object.keys(h)) if (!HINT_KEYS.has(k)) out.push(`guard.${k} is not a known hint (${[...HINT_KEYS].join(', ')})`);
  const kind = h.kind ?? 'pair';
  if (kind !== 'pair' && kind !== 'single' && kind !== 'grid') out.push(`guard.kind "${String(h.kind)}" must be pair, single or grid`);
  if (h.reason !== undefined && (typeof h.reason !== 'string' || !h.reason.trim())) out.push('guard.reason must be a non-empty string');
  if (kind === 'grid' && (typeof h.reason !== 'string' || !h.reason.trim())) out.push('guard.kind "grid" needs a reason');
  if (kind !== 'pair') {
    for (const k of ['panels', 'gutter', 'vertical', 'pair', 'target', 'frame', 'after']) if (h[k] !== undefined) out.push(`guard.${k} only applies to kind "pair"`);
  }
  if (h.panels !== undefined && !(Number.isInteger(h.panels) && (h.panels as number) >= 2 && (h.panels as number) <= 12)) out.push('guard.panels must be an integer 2..12');
  if (h.gutter !== undefined && !(Number.isInteger(h.gutter) && (h.gutter as number) >= 0)) out.push('guard.gutter must be a non-negative integer (px)');
  if (h.gutter !== undefined && h.panels === undefined) out.push('guard.gutter needs guard.panels');
  if (h.vertical !== undefined && typeof h.vertical !== 'boolean') out.push('guard.vertical must be true or false');
  if (h.pair !== undefined) {
    const p = h.pair;
    if (!Array.isArray(p) || p.length !== 2 || !p.every(i => Number.isInteger(i) && i >= 0) || p[0] === p[1]) out.push('guard.pair must be [before, after], two different panel indexes');
    else if (typeof h.panels === 'number' && Math.max(...(p as number[])) >= h.panels) out.push(`guard.pair [${p.join(', ')}] is past guard.panels ${h.panels}`);
  }
  for (const k of ['target', 'frame'] as const) if (h[k] !== undefined) { const p = boxProblem(h[k], k); if (p) out.push(p); }
  if (h.after !== undefined && (typeof h.after !== 'string' || !h.after)) out.push('guard.after must be the src of the after image');
  return out;
}

/** Problems with the notes file's shape as far as the picture gate reads it. */
export function validateNotes(file: unknown): Problem[] {
  const out: Problem[] = [];
  if (!file || typeof file !== 'object' || !Array.isArray((file as NotesFile).notes)) return [{ note: '(file)', src: null, message: 'whats-new-notes.json has no notes array' }];
  for (const n of (file as NotesFile).notes) {
    const label = noteLabel({ date: String(n?.date), title: String(n?.title) });
    if (typeof n?.date !== 'string' || !DATE_RE.test(n.date)) out.push({ note: label, src: null, message: 'date must be YYYY-MM-DD' });
    if (n?.images === undefined) continue;
    if (!Array.isArray(n.images)) { out.push({ note: label, src: null, message: 'images must be an array' }); continue; }
    for (const img of n.images) {
      if (typeof img === 'string') continue; // legacy bare URL, not rendered by whats-new.html; see imageEntries
      if (!img || typeof img !== 'object' || typeof img.src !== 'string' || !img.src) { out.push({ note: label, src: null, message: 'an image entry has no src' }); continue; }
      for (const k of Object.keys(img)) if (!ENTRY_KEYS.has(k)) out.push({ note: label, src: img.src, message: `unknown image field "${k}" (${[...ENTRY_KEYS].join(', ')})` });
      if (img.guard !== undefined) for (const m of validateHints(img.guard)) out.push({ note: label, src: img.src, message: m });
    }
  }
  return out;
}

/** The entries whats-new.html renders: objects with a src. Bare strings are legacy and never shown. */
export const imageEntries = (n: Note): ImageEntry[] => (n.images ?? []).filter((i): i is ImageEntry => !!i && typeof i === 'object' && typeof i.src === 'string');

const dayNumber = (d: string): number => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/**
 * Notes inside the window: dated within `days` calendar days of the newest note, newest included (14 days from
 * 2026-11-23 is 2026-11-10..2026-11-23). Relative to the file's newest date, not the clock, so a re-run is deterministic.
 * `from` (YYYY-MM-DD) also drops notes older than that date: a floor for pictures published before the gate existed,
 * which stops mattering once the window has moved past it.
 */
export function notesInWindow(notes: Note[], days = WINDOW_DAYS, from: string | null = null): Note[] {
  const dated = notes.filter(n => typeof n.date === 'string' && DATE_RE.test(n.date));
  if (!dated.length) return [];
  const newest = Math.max(...dated.map(n => dayNumber(n.date)));
  return dated.filter(n => newest - dayNumber(n.date) < days && (from == null || n.date >= from));
}

/** A src as a path in the screenshots repo (raw.githubusercontent URLs of that repo too); null for other hosts. */
export function repoPath(src: string): string | null {
  if (src.startsWith(SHOTS_RAW_BASE)) return decodeURIComponent(src.slice(SHOTS_RAW_BASE.length));
  if (/^[a-z]+:/i.test(src)) return null;
  return src.replace(/^\/+/, '');
}

const globRe = (pattern: string): RegExp => new RegExp(`^${pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

export function validateRemoved(list: unknown): string[] {
  if (!Array.isArray(list)) return ['removed-images.json must be an array'];
  const out: string[] = [];
  list.forEach((r, i) => {
    if (!r || typeof r !== 'object') { out.push(`entry ${i} must be an object`); return; }
    const e = r as Record<string, unknown>;
    if (typeof e.src !== 'string' || !e.src) out.push(`entry ${i}: src missing`);
    if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) out.push(`entry ${i} (${String(e.src)}): date must be YYYY-MM-DD`);
    if (typeof e.why !== 'string' || !e.why.trim()) out.push(`entry ${i} (${String(e.src)}): why missing`);
  });
  return out;
}

/** The denylist entry a src matches (`*` globs over the repo path), or null. Checked over every note, not just the window. */
export function removedMatch(src: string, removed: RemovedImage[]): RemovedImage | null {
  const path = repoPath(src);
  if (path == null) return null;
  return removed.find(r => globRe(r.src).test(path)) ?? null;
}

export function deniedImages(notes: Note[], removed: RemovedImage[]): Problem[] {
  const out: Problem[] = [];
  for (const n of notes) for (const img of n.images ?? []) {
    const src = typeof img === 'string' ? img : img?.src;
    if (typeof src !== 'string') continue;
    const r = removedMatch(src, removed);
    if (r) out.push({ note: noteLabel(n), src, message: `was removed on ${r.date} (scripts/whats-new/removed-images.json: ${r.why}); take it out of the note` });
  }
  return out;
}

/** What the checker does with one picture. */
export type PlanItem =
  | { kind: 'composite'; note: Note; image: ImageEntry; hints: GuardHints }
  | { kind: 'split'; note: Note; image: ImageEntry; after: ImageEntry; hints: GuardHints }
  | { kind: 'covered'; note: Note; image: ImageEntry; by: string }
  | { kind: 'single'; note: Note; image: ImageEntry; reason: string | null }
  | { kind: 'grid'; note: Note; image: ImageEntry; reason: string | null };

/**
 * A split pair's role from its file name: `x-before.jpg` / `x-after.jpg`, or `x.png` / `x-after.jpg` (the bare stem is
 * the before). `stem` is the name with the before/after token and the extension removed.
 */
export function splitRole(src: string): { stem: string; role: 'before' | 'after' | 'plain' } {
  const base = src.replace(/\.[a-z0-9]+$/i, '');
  const m = /(?:^|[-_])(before|after)(?=$|[-_])/i.exec(base.slice(base.lastIndexOf('/') + 1));
  if (!m) return { stem: base, role: 'plain' };
  const at = base.lastIndexOf('/') + 1 + m.index;
  return { stem: base.slice(0, at) + base.slice(at + m[0].length), role: m[1].toLowerCase() as 'before' | 'after' };
}

/** Before -> after pairs among one note's entries: an explicit guard.after, else names that pair by splitRole. */
export function splitPairs(images: ImageEntry[]): Map<string, ImageEntry> {
  const out = new Map<string, ImageEntry>(), taken = new Set<string>(), bySrc = new Map(images.map(i => [i.src, i]));
  const pairable = (i: ImageEntry) => (i.guard?.kind ?? 'pair') === 'pair';
  for (const img of images) {
    const a = img.guard?.after ? bySrc.get(img.guard.after) : undefined;
    if (a && a !== img && pairable(img)) { out.set(img.src, a); taken.add(a.src); }
  }
  const roles = images.map(i => ({ i, ...splitRole(i.src) }));
  for (const want of ['before', 'plain'] as const) {
    for (const b of roles) {
      if (b.role !== want || out.has(b.i.src) || taken.has(b.i.src) || !pairable(b.i) || b.i.guard?.after) continue;
      const a = roles.find(r => r.role === 'after' && r.stem === b.stem && !taken.has(r.i.src) && !out.has(r.i.src));
      if (a) { out.set(b.i.src, a.i); taken.add(a.i.src); }
    }
  }
  return out;
}

export function planNote(note: Note): PlanItem[] {
  const images = imageEntries(note), afterOf = splitPairs(images);
  const covered = new Map<string, string>();
  for (const [b, a] of afterOf) covered.set(a.src, b);
  return images.map((image): PlanItem => {
    const kind = image.guard?.kind ?? 'pair';
    if (kind === 'single') return { kind, note, image, reason: image.guard?.reason ?? null };
    if (kind === 'grid') return { kind, note, image, reason: image.guard?.reason ?? null };
    const after = afterOf.get(image.src);
    if (after) return { kind: 'split', note, image, after, hints: image.guard ?? {} };
    const by = covered.get(image.src);
    if (by && !image.guard) return { kind: 'covered', note, image, by };
    return { kind: 'composite', note, image, hints: image.guard ?? {} };
  });
}

export const toBox = (b: Box4 | undefined) => (b ? { x: b[0], y: b[1], w: b[2], h: b[3] } : { x: 0, y: 0, w: 1, h: 1 });
