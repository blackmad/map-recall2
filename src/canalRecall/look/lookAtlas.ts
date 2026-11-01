// The pre-painted facade atlas (#129): the look's colour and tint-mask arrays exactly as look/paintLookAtlas.ts
// paints them, without painting ~200 canvas cells on the main thread. Two sources, both falling back to the runtime
// painter (the reference) on any miss:
// - this browser's own painted bytes from an earlier visit (Cache Storage, keyed by the bundle's deploy stamp): the
//   default;
// - a versioned extract built offline by scripts/look-atlas/build-look-atlas.ts
//   (public/data/extracts/amsterdam/look-atlas-v1/; its --check paints in a browser and compares bytes with the
//   published file): opt-in, `?lookAtlas=extract`.
import type { Look } from '../bayTextures.js';
import type { LookAtlasArrays } from './paintLookAtlas.js';

export const LOOK_ATLAS_DIR = 'look-atlas-v1';
/** Bumped when the file layout changes (not when the pixels do: the manifest's sha256 and source hash track those). */
export const LOOK_ATLAS_FORMAT = 1;
export const LOOK_ATLAS_MANIFEST = 'manifest.json';

/** One file per look × cell size × slot layers: the colour RGBA bytes of every layer, then the mask RG bytes. */
export function lookAtlasFile(look: 'procedural' | Look, size: number, slots: boolean): string {
  return `${look}-${size}${slots ? '-slots' : ''}.bin.gz`;
}

/** Exact byte length of a file holding `total` layers of `size`². */
export const lookAtlasByteLength = (size: number, total: number): number => size * size * 6 * total;

export type LookAtlasManifestEntry = { look: 'procedural' | Look; size: number; slots: boolean; layers: number; total: number; bytes: number; gzBytes: number; sha256: string };
export type LookAtlasManifest = { format: number; sourceHash: string; sourceFiles: string[]; files: Record<string, LookAtlasManifestEntry> };

/** Split one file's bytes into the colour and mask views (no copy). */
export function lookAtlasArraysOf(bytes: Uint8Array, size: number, layers: number, total: number): LookAtlasArrays | null {
  if (bytes.byteLength !== lookAtlasByteLength(size, total)) return null;
  const split = size * size * 4 * total;
  return { colour: bytes.subarray(0, split), mask: bytes.subarray(split), size, layers, total };
}

/** Join colour and mask into one file's bytes (the build script). */
export function lookAtlasBytesOf(atlas: LookAtlasArrays): Uint8Array {
  const out = new Uint8Array(atlas.colour.byteLength + atlas.mask.byteLength);
  out.set(atlas.colour, 0); out.set(atlas.mask, atlas.colour.byteLength);
  return out;
}

/**
 * The shipped extract is opt-in, `?lookAtlas=extract` (or `window.__canalRecallLookAtlas = 'extract'`): it trades the
 * main-thread paint for a download that is slower on a real link (measurements below). `?lookAtlas=paint` paints
 * every time (no extract, no stored copy).
 */
export function lookAtlasEnabled(search?: string): boolean {
  try {
    const g = globalThis as { __canalRecallLookAtlas?: boolean | 'extract'; location?: { search?: string } };
    if (search === undefined && g.__canalRecallLookAtlas === 'extract') return true;
    return new URLSearchParams(search ?? g.location?.search ?? '').get('lookAtlas') === 'extract';
  } catch { return false; }
}

const isGzip = (b: Uint8Array) => b.byteLength > 2 && b[0] === 0x1f && b[1] === 0x8b;

/** Inflate gzip bytes off the main thread (DecompressionStream); a server that already decoded them passes through. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (!isGzip(bytes)) return bytes;
  if (typeof DecompressionStream === 'undefined') return null;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type LookAtlasLoad = { atlas: LookAtlasArrays | null; reason: 'loaded' | 'disabled' | 'missing' | 'size' | 'error'; ms: number; file: string };

/**
 * Fetch the pre-painted arrays for a look, or say why not (the caller paints instead). `layers`/`total` come from
 * paintLookAtlas.ts `lookAtlasLayers`, so a file built for another layer count is refused by length.
 */
export async function loadLookAtlas(extractBase: string, look: 'procedural' | Look, size: number, slots: boolean, layers: number, total: number, fetcher: typeof fetch = fetch): Promise<LookAtlasLoad> {
  const file = lookAtlasFile(look, size, slots), started = performance.now();
  const done = (atlas: LookAtlasArrays | null, reason: LookAtlasLoad['reason']): LookAtlasLoad => ({ atlas, reason, ms: performance.now() - started, file });
  if (!lookAtlasEnabled()) return done(null, 'disabled');
  try {
    const response = await fetcher(`${extractBase.replace(/\/$/, '')}/${LOOK_ATLAS_DIR}/${file}`);
    if (!response.ok) return done(null, 'missing');
    const bytes = await inflate(new Uint8Array(await response.arrayBuffer()));
    const atlas = bytes && lookAtlasArraysOf(bytes, size, layers, total);
    return atlas ? done(atlas, 'loaded') : done(null, 'size');
  } catch { return done(null, 'error'); }
}

// ---------------------------------------------------------------------------
// This browser's own painted atlas, kept between visits (Cache Storage)
// ---------------------------------------------------------------------------
//
// Measured 2026-11-01 (#129): the shipped extract costs 6.0 MB (desktop cells) / 1.8 MB (touch) of download, and on a
// 20 Mbit/s link it moved racing from ~6.2 s to ~8.4 s with the settle hold timing out on it. So the default keeps
// the runtime painter on a first visit and stores what it painted; later visits read those bytes back instead of
// painting. Exact by construction (this browser's own painter output). Keyed by the bundle's deploy stamp (the deploy
// rewrites every `?v=` to a content hash, scripts/stamp-canal-assets.ts), so a new painter is a new key; local
// servers (unhashed stamps) skip it unless `?lookAtlas=cache`.

const CACHE_NAME = 'canal-recall-look-atlas';

/** The stamp that versions this bundle's painter: the script URL's `?v=`, or null where it does not track content. */
export function lookAtlasStamp(bundleSrc: string, search?: string): string | null {
  try {
    const url = new URL(bundleSrc);
    const asked = new URLSearchParams(search ?? (globalThis as { location?: { search?: string } }).location?.search ?? '').get('lookAtlas');
    if (asked === 'paint' || asked === 'extract') return null;
    if (asked !== 'cache' && /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(url.hostname)) return null;
    return url.searchParams.get('v');
  } catch { return null; }
}

const cacheKey = (stamp: string, file: string) => `${new URL('/', (globalThis as any).location?.href ?? 'http://localhost/').href}__look-atlas/${encodeURIComponent(stamp)}/${file.replace(/\.gz$/, '')}`;

/** Read this browser's stored atlas for a stamp, or null. */
export async function readCachedLookAtlas(stamp: string | null, look: 'procedural' | Look, size: number, slots: boolean, layers: number, total: number): Promise<LookAtlasArrays | null> {
  if (!stamp || typeof caches === 'undefined') return null;
  try {
    const hit = await (await caches.open(CACHE_NAME)).match(cacheKey(stamp, lookAtlasFile(look, size, slots)));
    return hit ? lookAtlasArraysOf(new Uint8Array(await hit.arrayBuffer()), size, layers, total) : null;
  } catch { return null; }
}

/**
 * Store a painted atlas under the stamp and drop other stamps' entries. The Blob copies the bytes at once, so the
 * caller may release the arrays (texture upload) as soon as this returns; the write itself is asynchronous.
 */
export function storeCachedLookAtlas(stamp: string | null, atlas: LookAtlasArrays, look: 'procedural' | Look, slots: boolean): void {
  if (!stamp || typeof caches === 'undefined') return;
  let blob: Blob;
  try { blob = new Blob([atlas.colour as BlobPart, atlas.mask as BlobPart], { type: 'application/octet-stream' }); } catch { return; }
  const key = cacheKey(stamp, lookAtlasFile(look, atlas.size, slots));
  void (async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      for (const old of await cache.keys()) if (!old.url.includes(`/__look-atlas/${encodeURIComponent(stamp)}/`)) await cache.delete(old);
      await cache.put(key, new Response(blob, { headers: { 'content-length': String(blob.size) } }));
    } catch { /* quota or private mode: paint next time */ }
  })();
}
