/**
 * Node stand-ins for the few browser globals the game's painters read (lane node-world-frames): `document.createElement
 * ('canvas')`, `document.baseURI` and `Image` with `src` + `decode()`, all over @napi-rs/canvas, so look/paintLookAtlas.ts
 * and the slot-layer painter run unchanged in Node. File URLs and paths under `publicDir` are read from disk; nothing is
 * fetched from the network. Installed once per process by the node-frame script, never by a module import.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, Image as NapiImage } from '@napi-rs/canvas';

/** The canal-drive page directory the painters resolve relative URLs against. */
export const PAGE_DIR = 'public/canal-drive/';

function fileOf(src: string, root: string): string {
  if (src.startsWith('file:')) return fileURLToPath(src);
  if (/^https?:/.test(src)) {
    const u = new URL(src);
    return path.join(root, 'public', decodeURIComponent(u.pathname));
  }
  return path.isAbsolute(src) ? src : path.join(root, PAGE_DIR, src);
}

/** An `Image` whose `src` is a URL or path and whose `decode()` reads the file. */
export function imageClass(root: string): typeof NapiImage {
  // napi's `src` is an accessor on its prototype; the subclass keeps a string URL until decode() reads the file.
  const srcOf = Object.getOwnPropertyDescriptor(NapiImage.prototype, 'src');
  const Base = NapiImage as unknown as new () => { onload: unknown; onerror: unknown };
  class NodeImage extends Base {
    private pending: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set src(value: any) { if (typeof value === 'string') this.pending = value; else srcOf?.set?.call(this, value); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get src(): any { return this.pending ?? srcOf?.get?.call(this); }
    async decode(): Promise<void> {
      if (this.pending === null) return;
      const file = fileOf(this.pending, root);
      const bytes = fs.readFileSync(file);
      await new Promise<void>((resolve, reject) => { this.onload = () => resolve(); this.onerror = (e: unknown) => reject(e); srcOf?.set?.call(this, bytes); });
    }
  }
  return NodeImage as unknown as typeof NapiImage;
}

let installed = false;
/** Put `document`, `Image` and `OffscreenCanvas` on globalThis (idempotent). `root` is the checkout. */
export function installCanvasShims(root = process.cwd()): void {
  if (installed) return;
  installed = true;
  const g = globalThis as Record<string, unknown>;
  const baseURI = 'file://' + path.join(root, PAGE_DIR);
  g.document ??= {
    baseURI,
    createElement: (tag: string) => { if (tag !== 'canvas') throw new Error(`node-frame shim: createElement(${tag})`); return createCanvas(1, 1); },
  };
  g.Image ??= imageClass(root);
  g.OffscreenCanvas ??= class { constructor(w: number, h: number) { return createCanvas(w, h); } };
}
