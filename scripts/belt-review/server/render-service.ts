/**
 * Belt review render service (plan R2), in the server process: hashes a pand's design, serves a cached front from
 * `<cacheDir>/<hash>/front.png`, and otherwise asks the long-lived render worker (render-worker.ts) for it. Row strips
 * (the renders, and the picked photos) are composed with sharp at the face's fixed px/m, bottoms aligned on the ground.
 *
 * The cache is derived data (a spec hash names its render), so it lives under `.cache/belt-review/renders` and may be swept.
 */
import { fork, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

/** 2 (2026-11-21, render wiring): the photo read's plot (roof, dormers, white parts, door) and the released window look draw. */
export const RENDER_VERSION = 2;
export interface RenderMeta { hash: string; pandId: string; file: string; ms: number; cached: boolean; measure: Record<string, any>; widthPx: number; heightPx: number }
export interface RenderStat { at: string; pandId: string; ms: number; cached: boolean; cold: boolean }

const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 24);
export const designHash = (pandId: string, design: unknown, ppm: number, sliceM?: [number, number]) => sha(sliceM ? { v: RENDER_VERSION, pandId, design, ppm, sliceM } : { v: RENDER_VERSION, pandId, design, ppm });

export class RenderService {
  private worker: ChildProcess | null = null;
  private ready: Promise<void> | null = null;
  private seq = 0;
  private waiting = new Map<number, { resolve: (m: any) => void; reject: (e: Error) => void }>();
  private inflight = new Map<string, Promise<RenderMeta>>();
  private rendered = 0;
  readonly stats: RenderStat[] = [];

  constructor(readonly cacheDir: string, readonly repoRoot: string) {}

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const w = fork(path.join(this.repoRoot, 'scripts/belt-review/server/render-worker.ts'), [], { cwd: this.repoRoot, execArgv: ['--import', 'tsx'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      this.worker = w;
      w.on('message', (m: any) => {
        if (m?.ready) { resolve(); return; }
        const p = this.waiting.get(m?.id);
        if (!p) return;
        this.waiting.delete(m.id);
        if (m.ok) p.resolve(m); else p.reject(new Error(m.error));
      });
      const down = (why: string) => {
        this.worker = null; this.ready = null; this.rendered = 0;
        for (const p of this.waiting.values()) p.reject(new Error(`render worker ${why}`));
        this.waiting.clear();
        reject(new Error(`render worker ${why}`));
      };
      w.on('exit', code => down(`exited (${code})`));
      w.on('error', e => down(e.message));
    });
    return this.ready;
  }

  stop() { this.worker?.kill(); this.worker = null; this.ready = null; }

  private async ask(job: { pandId: string; design: unknown; ppm: number; out: string }): Promise<any> {
    await this.start();
    const id = ++this.seq;
    return new Promise((resolve, reject) => { this.waiting.set(id, { resolve, reject }); this.worker!.send({ id, ...job }); });
  }

  /** The pand's front at `ppm` for `design`; cached by hash. `force` re-renders into a fresh directory (tests). A split
   *  house (`<pand>#n`) renders its pand (`base`) with its own design and keeps the slice `sliceM` (metres from the BAG
   *  span start, clamped to the drawn front): the renderer draws whole pands, so the slice is the honest approximation. */
  async front(pandId: string, design: unknown, ppm: number, opts: { force?: boolean; base?: string; sliceM?: [number, number] } = {}): Promise<RenderMeta> {
    const hash = designHash(pandId, design, ppm, opts.sliceM);
    const dir = path.join(this.cacheDir, opts.force ? `${hash}-${Date.now()}-${++this.seq}` : hash);
    if (!opts.force) {
      const hit = await fs.readFile(path.join(dir, 'meta.json'), 'utf8').then(JSON.parse, () => null);
      if (hit) { this.note(pandId, 0, true); return { ...hit, file: path.join(dir, 'front.png'), cached: true }; }
      const running = this.inflight.get(hash);
      if (running) return running;
    }
    const job = (async () => {
      await fs.mkdir(dir, { recursive: true });
      const r = await this.ask({ pandId: opts.base ?? pandId, design, ppm, out: dir });
      if (opts.sliceM) {
        const whole = await sharp(r.file).metadata(), W = whole.width ?? 1;
        const left = Math.max(0, Math.min(W - 1, Math.round(opts.sliceM[0] * ppm))), right = Math.max(left + 1, Math.min(W, Math.round(opts.sliceM[1] * ppm)));
        const buf = await sharp(r.file).extract({ left, top: 0, width: right - left, height: whole.height ?? 1 }).png().toBuffer();
        await fs.writeFile(r.file, buf);
        r.measure = { ...r.measure, slice: { sliceM: opts.sliceM, leftPx: left, rightPx: right, wholeWidthPx: W } };
      }
      const img = await sharp(r.file).metadata();
      const meta = { hash, pandId, ms: r.ms, measure: r.measure, widthPx: img.width ?? 0, heightPx: img.height ?? 0, timings: r.timings };
      await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
      this.note(pandId, r.ms, false);
      return { ...meta, file: path.join(dir, 'front.png'), cached: false } as RenderMeta;
    })();
    if (!opts.force) { this.inflight.set(hash, job); job.finally(() => this.inflight.delete(hash)).catch(() => {}); }
    return job;
  }

  private note(pandId: string, ms: number, cached: boolean) {
    const cold = !cached && this.rendered++ === 0;
    this.stats.push({ at: new Date().toISOString(), pandId, ms, cached, cold });
    if (this.stats.length > 500) this.stats.shift();
  }

  /** Latency summary: the cold first render, and the warm renders' median and p90. */
  summary() {
    const warm = this.stats.filter(s => !s.cached && !s.cold).map(s => s.ms).sort((a, b) => a - b);
    const q = (p: number) => warm.length ? warm[Math.min(warm.length - 1, Math.floor(p * warm.length))] : null;
    return { renders: this.stats.filter(s => !s.cached).length, cacheHits: this.stats.filter(s => s.cached).length, coldMs: this.stats.find(s => s.cold)?.ms ?? null, warmMedianMs: q(0.5), warmP90Ms: q(0.9), warmCount: warm.length };
  }
}

/** A row piece: the image drawn at `widthPx`×`heightPx`, `dx` into a slot `slotW` wide (default: the image's width). An
 *  `extract` crops the source first (pixels of the source image). */
export interface RowPiece { pandId: string; file: string | null; widthPx: number; heightPx: number; dx?: number; slotW?: number; extract?: { left: number; width: number } }
export interface RowLayout { width: number; height: number; pands: Array<{ pandId: string; x: number; w: number; h: number }> }

/** Pieces side by side, bottoms aligned (the ground), a missing piece as a dark slot of its width. */
export async function composeRow(pieces: RowPiece[], background = { r: 160, g: 180, b: 200 }): Promise<{ png: Buffer; layout: RowLayout }> {
  const slot = (p: RowPiece) => Math.max(1, p.slotW ?? p.widthPx);
  const height = Math.max(1, ...pieces.map(p => p.heightPx)), width = Math.max(1, pieces.reduce((n, p) => n + slot(p), 0));
  const layout: RowLayout = { width, height, pands: [] };
  const over: OverlayOptions[] = [];
  let x = 0;
  for (const p of pieces) {
    layout.pands.push({ pandId: p.pandId, x, w: slot(p), h: p.heightPx });
    const w = Math.max(1, Math.min(p.widthPx, slot(p))), dx = Math.max(0, Math.min(slot(p) - w, Math.round(p.dx ?? 0)));
    let src = p.file ? sharp(p.file) : null;
    if (src && p.extract) {
      const m = await sharp(p.file!).metadata(), W = m.width ?? 1;
      const left = Math.max(0, Math.min(W - 1, Math.round(p.extract.left))), ew = Math.max(1, Math.min(W - left, Math.round(p.extract.width)));
      src = sharp(await src.extract({ left, top: 0, width: ew, height: m.height ?? 1 }).toBuffer());
    }
    const input = src ? await src.resize(w, p.heightPx, { fit: 'fill' }).png().toBuffer()
      : await sharp({ create: { width: w, height: Math.max(1, p.heightPx), channels: 3, background: '#2a2d31' } }).png().toBuffer();
    over.push({ input, left: x + dx, top: height - p.heightPx });
    x += slot(p);
  }
  const png = await sharp({ create: { width, height, channels: 3, background } }).composite(over).png().toBuffer();
  return { png, layout };
}
