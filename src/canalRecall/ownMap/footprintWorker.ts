// Worker: fetch a z14 building tile, inflate, and build its footprint arrays
// off the main thread (the game's three.js buildings already have a worker;
// the own map's footprints were the last main-thread mesh build).
//
// Build: npx esbuild src/canalRecall/ownMap/footprintWorker.ts --bundle --format=iife --minify \
//          --outfile=public/canal-drive/js/own-map-footprints.worker.js
import { toLocal } from './frame';
import { footprintArrays, type FootprintFeature } from './footprints';

export interface FootprintRequest { id: number; url: string; top: string; wall: string }
export type FootprintReply =
  | { id: number; ok: true; position: Float32Array; color: Float32Array; index: Uint32Array | Uint16Array; bytes: number; decoded: number; buildMs: number; features: number }
  | { id: number; ok: false; error: string };

async function inflate(b: Uint8Array): Promise<string> {
  if (b[0] === 0x1f && b[1] === 0x8b) return new Response(new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return new TextDecoder().decode(b);
}

const scope = self as unknown as { location: Location; onmessage: (e: MessageEvent<FootprintRequest>) => void; postMessage: (m: FootprintReply, t?: Transferable[]) => void };
scope.onmessage = async (e) => {
  const { id, url, top, wall } = e.data;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    const b = new Uint8Array(await r.arrayBuffer());
    const entry = performance.getEntriesByName(new URL(url, scope.location.href).href).pop() as PerformanceResourceTiming | undefined;
    const fc = JSON.parse(await inflate(b)) as { features: FootprintFeature[] };
    const t = performance.now();
    const a = footprintArrays(fc.features, toLocal, top, wall);
    scope.postMessage({ id, ok: true, ...a, bytes: entry && entry.transferSize > 0 ? entry.transferSize : b.length, decoded: b.length, buildMs: performance.now() - t, features: fc.features.length },
      [a.position.buffer, a.color.buffer, a.index.buffer]);
  } catch (err) {
    scope.postMessage({ id, ok: false, error: String(err) });
  }
};
