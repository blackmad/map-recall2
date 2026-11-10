/**
 * The browser globals the facade atlas painter (look/paintLookAtlas.ts paintLookArrays) reaches for, stubbed in Node
 * with @napi-rs/canvas (house line H2, docs/house-line.md §2):
 *   document.createElement('canvas') -> createCanvas (getContext('2d', {willReadFrequently}) is accepted as is);
 *   document.baseURI                 -> file URL of public/canal-drive/ (the page the game runs from);
 *   new Image()                      -> a napi Image whose `src` setter reads a file: URL from disk.
 * The painter swallows an image failure (`catch { neutral drawn brick }`), so every image the shim loads or fails to
 * load is recorded and `assertImageLoaded(name)` throws when the named one did not decode. Nothing in src/ imports this.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas, Image as NapiImage } from '@napi-rs/canvas';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** What the shim saw: url -> 'requested' (bytes read), 'decoded', or the error message. */
export const imageLoads = new Map<string, string>();

/** napi's own `src` accessor (a prototype property), called with the file's bytes. */
const napiSrc = Object.getOwnPropertyDescriptor(NapiImage.prototype, 'src')!;

class NodeImage extends NapiImage {
  private failure: Error | null = null;
  private url = '';
  // @ts-expect-error the napi accessor takes a Buffer; the page hands a URL string.
  override set src(url: string | Buffer) {
    if (typeof url !== 'string') { napiSrc.set!.call(this, url); return; }
    this.url = url;
    try {
      const u = new URL(url);
      if (u.protocol !== 'file:') throw new Error(`nodeDom Image: only file: URLs load in Node (${url})`);
      napiSrc.set!.call(this, fs.readFileSync(fileURLToPath(u)));
      imageLoads.set(url, 'requested');
    } catch (e) {
      this.failure = e as Error;
      imageLoads.set(url, (e as Error).message);
    }
  }
  override get src(): string { return this.url; }
  /** napi decodes off-thread: drawImage before decode() draws nothing (2026-11-10), so the painter's own await is load-bearing. */
  override async decode(): Promise<void> {
    if (this.failure) throw this.failure;
    await super.decode();
    if (!this.width || !this.height) { const e = new Error(`nodeDom Image: ${this.url} decoded to ${this.width}x${this.height}`); imageLoads.set(this.url, e.message); throw e; }
    if (this.url) imageLoads.set(this.url, 'decoded');
  }
}

let installed: { document?: unknown; Image?: unknown } | null = null;
/** Install the stubs on globalThis (idempotent). Returns an uninstall function that restores what was there. */
export function installNodeDom(root = REPO_ROOT): () => void {
  const g = globalThis as Record<string, unknown>;
  if (installed) return () => {};
  installed = { document: g.document, Image: g.Image };
  const baseURI = pathToFileURL(path.join(root, 'public/canal-drive') + '/').href;
  g.document = {
    baseURI,
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`nodeDom: document.createElement('${tag}') is not stubbed`);
      return createCanvas(1, 1);
    },
  };
  g.Image = NodeImage;
  return () => {
    if (!installed) return;
    for (const k of ['document', 'Image'] as const) if (installed[k] === undefined) delete g[k]; else g[k] = installed[k];
    installed = null;
  };
}

/** Throws unless an image whose URL contains `name` was read and decoded through the shim. */
export function assertImageLoaded(name: string): void {
  const hits = [...imageLoads].filter(([url]) => url.includes(name));
  if (!hits.length) throw new Error(`nodeDom: no image matching '${name}' was requested (the painter did not ask for it)`);
  const bad = hits.filter(([, state]) => state !== 'decoded');
  if (bad.length) throw new Error(`nodeDom: '${name}' did not decode: ${bad.map(([u, s]) => `${u}: ${s}`).join('; ')}`);
}
