/**
 * Belt review: the files under `review-data/belt-review/` (Node only). Locked, atomic JSON writes, the face bundle, and
 * path-guarded image resolution. Claude-side commands should write through `lockedJson` too, so the lock file keeps a
 * command and the page server from interleaving.
 */
import { parseCandidates, parsePicks } from './logic.ts';
import { expandFace, type HouseFace } from './houses.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ReviewError, deriveLedger } from './logic.ts';
import {
  ID_PATTERN, initialDocs, type CandidatesFile, type DescriptionFile, type DocName, type FaceBundle, type FaceFile,
  type FaceSummary, type LedgerFile,
} from './types.ts';

export const DEFAULT_DATA_ROOT = path.join(process.cwd(), 'review-data', 'belt-review');
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function atomicJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tmp, file);
}

/** Read-modify-write under `<file>.lock` (exclusive create; waits up to 10 s, never steals a lock). */
export async function lockedJson<T, R>(file: string, initial: T, change: (value: T) => R | Promise<R>): Promise<R> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const lockPath = `${file}.lock`, start = Date.now();
  let lock: fs.FileHandle | undefined;
  while (!lock) {
    try { lock = await fs.open(lockPath, 'wx'); } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (Date.now() - start > 10_000) throw new ReviewError(`State lock busy; inspect ${lockPath}`, 503);
      await new Promise(r => setTimeout(r, 15));
    }
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    const value = await readJson<T>(file, structuredClone(initial));
    const result = await change(value);
    await atomicJson(file, value);
    return result;
  } finally { await lock.close(); await fs.unlink(lockPath).catch(() => {}); }
}

/**
 * Resolve `rel` inside `root`, refusing anything that escapes it (`..`, absolute paths, symlinks out of the root) and
 * anything that is not an image. Returns the real path or throws ReviewError 400/404.
 */
export async function resolveInside(root: string, rel: string, extensions = IMAGE_EXTENSIONS): Promise<string> {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || path.isAbsolute(rel)) throw new ReviewError('Invalid path', 400);
  const realRoot = await fs.realpath(root).catch(() => { throw new ReviewError('Image root not found', 404); });
  const joined = path.resolve(realRoot, rel);
  if (joined !== realRoot && !joined.startsWith(realRoot + path.sep)) throw new ReviewError('Path escapes its root', 400);
  if (!extensions.has(path.extname(joined).toLowerCase())) throw new ReviewError('Not an image', 400);
  const real = await fs.realpath(joined).catch(() => { throw new ReviewError('Image not found', 404); });
  if (!real.startsWith(realRoot + path.sep)) throw new ReviewError('Path escapes its root', 400);
  return real;
}

export class BeltReviewStore {
  constructor(readonly dataRoot = DEFAULT_DATA_ROOT, readonly imageRoot: string | null = process.env.BELT_REVIEW_IMAGE_ROOT || null) {}

  faceDir(faceId: string): string {
    if (!ID_PATTERN.test(faceId)) throw new ReviewError('Invalid face id', 400);
    return path.join(this.dataRoot, faceId);
  }
  docPath(faceId: string, doc: DocName | 'face' | 'candidates' | 'description'): string { return path.join(this.faceDir(faceId), `${doc}.json`); }

  async face(faceId: string): Promise<FaceFile> {
    const face = await readJson<FaceFile | null>(this.docPath(faceId, 'face'), null);
    if (!face) throw new ReviewError(`No face ${faceId}`, 404);
    face.pands = [...face.pands].sort((a, b) => a.order - b.order);
    return face;
  }
  async candidates(faceId: string) { return parseCandidates(await readJson<unknown>(this.docPath(faceId, 'candidates'), null)); }
  /** The houses stages 2–4 review: the face with split pands expanded (houses.ts). */
  async houseFace(faceId: string): Promise<HouseFace> { const [f, p] = await Promise.all([this.face(faceId), this.doc(faceId, 'picks')]); return expandFace(f, p); }
  async description(faceId: string) { return readJson<DescriptionFile | null>(this.docPath(faceId, 'description'), null); }
  async doc<N extends DocName>(faceId: string, name: N): Promise<ReturnType<typeof initialDocs[N]>> {
    const v = await readJson(this.docPath(faceId, name), initialDocs[name](faceId) as ReturnType<typeof initialDocs[N]>);
    return (name === 'picks' ? parsePicks(v, faceId) : v) as ReturnType<typeof initialDocs[N]>;
  }

  async listFaces(): Promise<FaceSummary[]> {
    const names = await fs.readdir(this.dataRoot).catch(() => [] as string[]);
    const out: FaceSummary[] = [];
    for (const name of names) {
      if (!ID_PATTERN.test(name)) continue;
      const face = await readJson<FaceFile | null>(path.join(this.dataRoot, name, 'face.json'), null);
      if (!face) continue;
      const state = await this.doc(name, 'state');
      const has = async (f: string) => fs.access(path.join(this.dataRoot, name, f)).then(() => true, () => false);
      out.push({ faceId: name, street: face.street, side: face.side, pands: face.pands.length, fixture: !!face.fixture, stage: state.stage, status: state.status, updatedAt: state.updatedAt, candidates: await has('candidates.json'), description: await has('description.json') });
    }
    return out.sort((a, b) => Number(a.fixture) - Number(b.fixture) || a.faceId.localeCompare(b.faceId));
  }

  async bundle(faceId: string, token: string): Promise<FaceBundle> {
    this.faceDir(faceId);
    const [face, candidates, description, picks, edits, grouping, pins, marks, state, ledger] = await Promise.all([
      this.face(faceId), this.candidates(faceId), this.description(faceId), this.doc(faceId, 'picks'), this.doc(faceId, 'edits'),
      this.doc(faceId, 'grouping'), this.doc(faceId, 'pins'), this.doc(faceId, 'marks'), this.doc(faceId, 'state'), this.doc(faceId, 'ledger'),
    ]);
    return { token, face, candidates, description, picks, edits, grouping, pins, marks, state, ledger };
  }

  /** Rewrite the ledger's derived sections from the current docs (after any write). */
  async refreshLedger(faceId: string, change?: (l: LedgerFile) => void): Promise<LedgerFile> {
    this.faceDir(faceId);
    const [face, candidates, description, picks, edits, grouping, pins, marks, state] = await Promise.all([
      this.face(faceId), this.candidates(faceId), this.description(faceId), this.doc(faceId, 'picks'), this.doc(faceId, 'edits'),
      this.doc(faceId, 'grouping'), this.doc(faceId, 'pins'), this.doc(faceId, 'marks'), this.doc(faceId, 'state'),
    ]);
    return lockedJson(this.docPath(faceId, 'ledger'), initialDocs.ledger(faceId), ledger => {
      change?.(ledger);
      deriveLedger(ledger, { face, candidates, description, picks, edits, grouping, pins, marks, state });
      ledger.revision += 1;
      ledger.updatedAt = new Date().toISOString();
      return structuredClone(ledger);
    });
  }

  /** The file a candidate points at: `file` under BELT_REVIEW_IMAGE_ROOT (else the face directory), or its remote URL. */
  async candidateImage(faceId: string, pandId: string, candidateId: string): Promise<{ file: string } | { url: string }> {
    const candidates = await this.candidates(faceId);
    const c = candidates?.pands.find(p => p.pandId === pandId)?.candidates.find(k => k.id === candidateId);
    if (!c) throw new ReviewError('Unknown candidate', 404);
    // Lane B names its archive in candidates.json (`imageRoot`); that wins when it exists here, so faces built from
    // different archives work under one server. Else BELT_REVIEW_IMAGE_ROOT, else the face directory.
    const own = (candidates as { imageRoot?: unknown } | null)?.imageRoot;
    const root = typeof own === 'string' && path.isAbsolute(own) && await fs.stat(own).then(st => st.isDirectory(), () => false) ? own : this.imageRoot ?? this.faceDir(faceId);
    if (c.file) return { file: await resolveInside(root, c.file) };
    if (c.url && /^https?:\/\//.test(c.url)) return { url: c.url };
    throw new ReviewError('Candidate has no image', 404);
  }
}
