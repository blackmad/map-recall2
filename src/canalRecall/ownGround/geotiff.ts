// Minimal GeoTIFF reader for PDOK's AHN WCS responses (pure, no DOM, no deps).
//
// PDOK serves `dtm_05m` / `dsm_05m` coverages as little-endian, single-band
// float32 TIFFs: strips (or tiles), deflate (8) or none (1), and predictor 3
// (floating point) or 1. That is all this reader supports; anything else
// throws, so a format change at PDOK fails the build loudly instead of
// producing garbage heights. Inflate is injected (node:zlib in scripts,
// tests may pass their own).

export type Inflate = (bytes: Uint8Array) => Uint8Array;

export interface Raster {
  width: number;
  height: number;
  /** Row-major, north row first, as the TIFF stores it. NaN where nodata. */
  data: Float32Array;
  /** RD New (or whatever the TIFF says) of the top-left pixel corner. */
  originX: number;
  originY: number;
  pixelX: number;
  pixelY: number;
  nodata: number | null;
}

const TAG = {
  width: 256, height: 257, bits: 258, compression: 259, stripOffsets: 273, rowsPerStrip: 278,
  stripByteCounts: 279, predictor: 317, tileWidth: 322, tileLength: 323, tileOffsets: 324,
  tileByteCounts: 325, sampleFormat: 339, samplesPerPixel: 277, pixelScale: 33550, tiepoint: 33922, gdalNodata: 42113,
} as const;

type Entry = number[] | string;

function readIfd(view: DataView, bytes: Uint8Array): Map<number, Entry> {
  const le = view.getUint16(0) === 0x4949;
  if (!le) throw new Error('geotiff: only little-endian TIFFs are supported');
  if (view.getUint16(2, true) !== 42) throw new Error('geotiff: not a classic TIFF (BigTIFF unsupported)');
  const ifd = view.getUint32(4, true);
  const count = view.getUint16(ifd, true);
  const tags = new Map<number, Entry>();
  const size: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 };
  for (let i = 0; i < count; i++) {
    const at = ifd + 2 + i * 12;
    const tag = view.getUint16(at, true), type = view.getUint16(at + 2, true), n = view.getUint32(at + 4, true);
    const bytesPer = size[type];
    if (!bytesPer) continue;
    const inline = bytesPer * n <= 4;
    const off = inline ? at + 8 : view.getUint32(at + 8, true);
    if (type === 2) { tags.set(tag, new TextDecoder().decode(bytes.subarray(off, off + n)).replace(/\0+$/, '')); continue; }
    const values: number[] = [];
    for (let k = 0; k < n; k++) {
      const p = off + k * bytesPer;
      values.push(type === 1 ? view.getUint8(p) : type === 3 ? view.getUint16(p, true) : type === 4 || type === 16 ? view.getUint32(p, true)
        : type === 5 ? view.getUint32(p, true) / view.getUint32(p + 4, true) : type === 11 ? view.getFloat32(p, true) : view.getFloat64(p, true));
    }
    tags.set(tag, values);
  }
  return tags;
}

/** Undo TIFF predictor 3 on one row of float32 samples (bytes in, little-endian floats out). */
export function undoFloatPredictor(row: Uint8Array, width: number, out: Float32Array, outOffset: number): void {
  for (let i = 1; i < row.length; i++) row[i] = (row[i] + row[i - 1]) & 0xff;
  const tmp = new Uint8Array(4), f = new Float32Array(tmp.buffer);
  for (let x = 0; x < width; x++) {
    // Byte planes are stored most-significant first.
    tmp[3] = row[x]; tmp[2] = row[width + x]; tmp[1] = row[2 * width + x]; tmp[0] = row[3 * width + x];
    out[outOffset + x] = f[0];
  }
}

export function readGeoTiff(buffer: ArrayBuffer | Uint8Array, inflate: Inflate): Raster {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tags = readIfd(view, bytes);
  const num = (t: number, d?: number) => { const v = tags.get(t); if (Array.isArray(v)) return v[0]; if (d === undefined) throw new Error(`geotiff: missing tag ${t}`); return d; };
  const arr = (t: number) => { const v = tags.get(t); return Array.isArray(v) ? v : []; };
  const width = num(TAG.width), height = num(TAG.height);
  if (num(TAG.bits) !== 32 || num(TAG.sampleFormat, 1) !== 3 || num(TAG.samplesPerPixel, 1) !== 1) throw new Error('geotiff: expected single-band float32');
  const compression = num(TAG.compression, 1), predictor = num(TAG.predictor, 1);
  if (compression !== 1 && compression !== 8 && compression !== 32946) throw new Error(`geotiff: compression ${compression} unsupported`);
  if (predictor !== 1 && predictor !== 3) throw new Error(`geotiff: predictor ${predictor} unsupported`);
  const data = new Float32Array(width * height);
  const decodeBlock = (offset: number, length: number, bw: number, bh: number, put: (row: number, values: Float32Array) => void) => {
    const raw = bytes.subarray(offset, offset + length);
    const plain = compression === 1 ? raw.slice() : inflate(raw);
    const rowValues = new Float32Array(bw);
    for (let r = 0; r < bh; r++) {
      const rowBytes = plain.subarray(r * bw * 4, (r + 1) * bw * 4);
      if (rowBytes.length < bw * 4) break;
      if (predictor === 3) undoFloatPredictor(rowBytes, bw, rowValues, 0);
      else { const copy = rowBytes.slice(); rowValues.set(new Float32Array(copy.buffer, 0, bw)); }
      put(r, rowValues);
    }
  };
  if (tags.has(TAG.tileOffsets)) {
    const tw = num(TAG.tileWidth), th = num(TAG.tileLength), offs = arr(TAG.tileOffsets), lens = arr(TAG.tileByteCounts);
    const across = Math.ceil(width / tw);
    offs.forEach((o, t) => {
      const x0 = (t % across) * tw, y0 = Math.floor(t / across) * th;
      decodeBlock(o, lens[t], tw, th, (r, v) => {
        const y = y0 + r; if (y >= height) return;
        const n = Math.min(tw, width - x0);
        data.set(v.subarray(0, n), y * width + x0);
      });
    });
  } else {
    const rps = num(TAG.rowsPerStrip, height), offs = arr(TAG.stripOffsets), lens = arr(TAG.stripByteCounts);
    offs.forEach((o, s) => {
      const y0 = s * rps, rows = Math.min(rps, height - y0);
      decodeBlock(o, lens[s], width, rows, (r, v) => data.set(v, (y0 + r) * width));
    });
  }
  const nodataTag = tags.get(TAG.gdalNodata);
  const nodata = typeof nodataTag === 'string' && nodataTag.trim() ? Number(nodataTag) : null;
  // Float32 cannot hold 3.4028234663852886e+38 exactly; compare in float32.
  const nd = nodata === null ? null : Math.fround(nodata);
  for (let i = 0; i < data.length; i++) if ((nd !== null && data[i] === nd) || !Number.isFinite(data[i]) || Math.abs(data[i]) > 1e30) data[i] = NaN;
  const scale = arr(TAG.pixelScale), tie = arr(TAG.tiepoint);
  return { width, height, data, originX: tie[3] ?? 0, originY: tie[4] ?? 0, pixelX: scale[0] ?? 1, pixelY: scale[1] ?? 1, nodata };
}
