/**
 * The street routing extract as a compact binary file ("road extract").
 *
 * `streets-routing.json` is 14 MB of JSON (2.9 MB gzipped) that every ride
 * start downloads and parses whole. This format carries exactly the same
 * features — same ids, names, classes, flags, centres and paths, down to the
 * last bit of every coordinate — so `fetchRoads` can swap the JSON parse for
 * `decodeRoadExtract` and everything downstream (projection, graph build,
 * routes) stays byte-identical.
 *
 * Why it does not also carry the graph's junctions: the graph build merges
 * endpoints by `Math.round(world / mergeSize)` in world space, and world space
 * is projected about the ride's chosen centre (the x scale is
 * cos(centre latitude), and the network is recentred on its bounding box).
 * Precompiled junctions would match only one centre, so they cannot be
 * byte-equal for every ride. The quantise-and-stitch pass stays in the
 * browser.
 *
 * Layout, little-endian:
 *
 *   header (HEADER_BYTES)
 *     0  magic "CRRX"
 *     4  u16 version, u16 reserved (0)
 *     8  u32 total byte length (must equal the buffer: the leftover check)
 *    12  u32 feature count
 *    16  u32 path count
 *    20  u32 point count (path points, centres excluded)
 *    24  u32 string count
 *    28  u32 exact-coordinate count (Float64 values)
 *    32  u32 strings offset,  36 u32 strings length
 *    40  u32 features offset, 44 u32 features length
 *    48  u32 exact offset,    52 u32 exact length (8-byte aligned)
 *    56  u8[32] SHA-256 of the source JSON bytes
 *
 *   strings: per string, varint UTF-8 byte length + bytes
 *   features: per feature, unsigned varints
 *     id kind (0 `routing_<n>`, 1 `routing_restricted_<n>`, 2 string), id value
 *     name, type, cityId, highway (string indexes)
 *     flags (FLAG_*); railway / bicycle string indexes when flagged
 *     path count when FLAG_PATHS, else one path
 *     per path: point count, then points; then the centre
 *   exact: Float64 coordinates for FLAG_EXACT features, in reading order
 *
 * Grid coordinates are integers of 1e-6 degree (0.11 m north-south, 0.07 m
 * east-west at Amsterdam), zigzag varint deltas from the previous coordinate
 * of the same axis anywhere in the file; the centre is a delta from the
 * feature's first point. `n / 1e6` is a correctly rounded division, so it
 * yields the same double JSON.parse gives for a decimal with at most six
 * places. A feature with any coordinate off that grid (the averaged centres
 * of the hand-added restricted corridors) stores all its coordinates as raw
 * Float64 instead.
 */

export const ROAD_EXTRACT_MAGIC = 'CRRX';
export const ROAD_EXTRACT_VERSION = 1;
export const HEADER_BYTES = 88;
const GRID = 1e6;

const FLAG_BRIDGE = 1;
const FLAG_BICYCLE_RESTRICTED = 2;
const FLAG_PATHS = 4;
const FLAG_EXACT = 8;
const FLAG_RAILWAY = 16;
const FLAG_BICYCLE = 32;
const FLAG_ONEWAY = 64;
const KNOWN_FLAGS = 127;

type Coord = [number, number];

/** One feature of `streets-routing.json`, as the extract writes it. */
export interface RoadExtractFeature {
  id: string;
  name: string;
  type: string;
  cityId: string;
  center: Coord;
  highway: string;
  path: Coord[];
  paths?: Coord[][];
  bridge?: true;
  railway?: string;
  bicycleRestricted?: true;
  bicycle?: string;
  oneway?: true;
}

export interface RoadExtractHeader {
  version: number;
  byteLength: number;
  featureCount: number;
  pathCount: number;
  pointCount: number;
  stringCount: number;
  exactCount: number;
  sourceSha256: string;
}

const FEATURE_KEYS = new Set(['id', 'name', 'type', 'cityId', 'center', 'highway', 'path', 'paths', 'bridge', 'railway', 'bicycleRestricted', 'bicycle', 'oneway']);
const ID_PREFIXES = ['routing_', 'routing_restricted_'];

function onGrid(value: number): boolean {
  return Number.isFinite(value) && Math.round(value * GRID) / GRID === value && Math.abs(value) <= 180;
}

class ByteWriter {
  bytes = new Uint8Array(1 << 16);
  length = 0;
  private ensure(extra: number): void {
    if (this.length + extra <= this.bytes.length) return;
    let size = this.bytes.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.bytes.subarray(0, this.length));
    this.bytes = next;
  }
  uvarint(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`road extract: cannot write ${value} as an unsigned varint`);
    this.ensure(10);
    while (value >= 0x80) {
      this.bytes[this.length++] = (value % 0x80) + 0x80;
      value = Math.floor(value / 0x80);
    }
    this.bytes[this.length++] = value;
  }
  svarint(value: number): void {
    this.uvarint(value < 0 ? -2 * value - 1 : 2 * value);
  }
  raw(data: Uint8Array): void {
    this.ensure(data.length);
    this.bytes.set(data, this.length);
    this.length += data.length;
  }
  result(): Uint8Array { return this.bytes.slice(0, this.length); }
}

/** Parse a feature id into the compact form, or null when it needs the string table. */
function compactId(id: string): [number, number] | null {
  for (let kind = ID_PREFIXES.length - 1; kind >= 0; kind--) {
    const prefix = ID_PREFIXES[kind];
    if (!id.startsWith(prefix)) continue;
    const digits = id.slice(prefix.length);
    if (!/^(0|[1-9][0-9]*)$/.test(digits)) return null;
    const value = Number(digits);
    return Number.isSafeInteger(value) ? [kind, value] : null;
  }
  return null;
}

function featurePaths(feature: RoadExtractFeature): Coord[][] {
  return feature.paths ?? [feature.path];
}

/**
 * Encode the parsed features. Throws on anything the format cannot carry
 * exactly (an unknown key, a flag that is not `true`, a `path` that is not
 * `paths[0]`, a malformed coordinate), so the compile fails instead of
 * shipping a lossy extract.
 */
export function encodeRoadExtract(features: readonly RoadExtractFeature[], sourceSha256: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(sourceSha256)) throw new Error('road extract: source SHA-256 must be 64 lowercase hex digits');
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  const intern = (value: unknown, what: string): number => {
    if (typeof value !== 'string') throw new Error(`road extract: ${what} must be a string`);
    let index = stringIndex.get(value);
    if (index === undefined) { index = strings.length; strings.push(value); stringIndex.set(value, index); }
    return index;
  };
  const body = new ByteWriter();
  const exact: number[] = [];
  let lastLat = 0, lastLon = 0;
  let pathCount = 0, pointCount = 0;

  for (const feature of features) {
    for (const key of Object.keys(feature)) {
      if (!FEATURE_KEYS.has(key)) throw new Error(`road extract: ${feature.id} has unsupported key ${key}`);
    }
    for (const key of ['bridge', 'bicycleRestricted', 'oneway'] as const) {
      if (key in feature && feature[key] !== true) throw new Error(`road extract: ${feature.id} ${key} must be true when present`);
    }
    if (!Array.isArray(feature.path)) throw new Error(`road extract: ${feature.id} has no path`);
    if (feature.paths && JSON.stringify(feature.paths[0]) !== JSON.stringify(feature.path)) {
      throw new Error(`road extract: ${feature.id} path is not paths[0]`);
    }
    const paths = featurePaths(feature);
    const coords: number[] = [];
    for (const path of paths) {
      if (!Array.isArray(path)) throw new Error(`road extract: ${feature.id} has a malformed path`);
      for (const point of path) {
        if (!Array.isArray(point) || point.length !== 2 || typeof point[0] !== 'number' || typeof point[1] !== 'number') {
          throw new Error(`road extract: ${feature.id} has a malformed point`);
        }
        coords.push(point[0], point[1]);
      }
    }
    const center = feature.center;
    if (!Array.isArray(center) || center.length !== 2 || typeof center[0] !== 'number' || typeof center[1] !== 'number') {
      throw new Error(`road extract: ${feature.id} has a malformed center`);
    }
    if (!coords.length) throw new Error(`road extract: ${feature.id} has no points`);
    const isExact = !coords.every(onGrid) || !onGrid(center[0]) || !onGrid(center[1]);

    let flags = 0;
    if (feature.bridge) flags |= FLAG_BRIDGE;
    if (feature.bicycleRestricted) flags |= FLAG_BICYCLE_RESTRICTED;
    if (feature.paths) flags |= FLAG_PATHS;
    if (isExact) flags |= FLAG_EXACT;
    if ('railway' in feature) flags |= FLAG_RAILWAY;
    if ('bicycle' in feature) flags |= FLAG_BICYCLE;
    if (feature.oneway) flags |= FLAG_ONEWAY;

    const id = compactId(feature.id);
    if (id) { body.uvarint(id[0]); body.uvarint(id[1]); } else { body.uvarint(2); body.uvarint(intern(feature.id, 'id')); }
    body.uvarint(intern(feature.name, `${feature.id} name`));
    body.uvarint(intern(feature.type, `${feature.id} type`));
    body.uvarint(intern(feature.cityId, `${feature.id} cityId`));
    body.uvarint(intern(feature.highway, `${feature.id} highway`));
    body.uvarint(flags);
    if (flags & FLAG_RAILWAY) body.uvarint(intern(feature.railway, `${feature.id} railway`));
    if (flags & FLAG_BICYCLE) body.uvarint(intern(feature.bicycle, `${feature.id} bicycle`));
    if (flags & FLAG_PATHS) body.uvarint(paths.length);

    for (const path of paths) {
      body.uvarint(path.length);
      pathCount++;
      pointCount += path.length;
      for (const [lat, lon] of path) {
        if (isExact) { exact.push(lat, lon); continue; }
        const qLat = Math.round(lat * GRID), qLon = Math.round(lon * GRID);
        body.svarint(qLat - lastLat); body.svarint(qLon - lastLon);
        lastLat = qLat; lastLon = qLon;
      }
    }
    if (isExact) {
      exact.push(center[0], center[1]);
    } else {
      // The first point of a feature is never an empty path (checked above),
      // but it can be in a later path when the first is empty; anchor on the
      // first point that exists.
      const first = paths.find(path => path.length)![0];
      body.svarint(Math.round(center[0] * GRID) - Math.round(first[0] * GRID));
      body.svarint(Math.round(center[1] * GRID) - Math.round(first[1] * GRID));
    }
  }

  const stringBytes = new ByteWriter();
  const utf8 = new TextEncoder();
  for (const value of strings) {
    const encoded = utf8.encode(value);
    stringBytes.uvarint(encoded.length);
    stringBytes.raw(encoded);
  }
  const stringsData = stringBytes.result();
  const featuresData = body.result();
  const stringsOffset = HEADER_BYTES;
  const featuresOffset = stringsOffset + stringsData.length;
  const exactOffset = Math.ceil((featuresOffset + featuresData.length) / 8) * 8;
  const total = exactOffset + exact.length * 8;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) out[i] = ROAD_EXTRACT_MAGIC.charCodeAt(i);
  view.setUint16(4, ROAD_EXTRACT_VERSION, true);
  view.setUint16(6, 0, true);
  const u32 = [total, features.length, pathCount, pointCount, strings.length, exact.length,
    stringsOffset, stringsData.length, featuresOffset, featuresData.length, exactOffset, exact.length * 8];
  u32.forEach((value, i) => view.setUint32(8 + i * 4, value, true));
  for (let i = 0; i < 32; i++) out[56 + i] = parseInt(sourceSha256.slice(i * 2, i * 2 + 2), 16);
  out.set(stringsData, stringsOffset);
  out.set(featuresData, featuresOffset);
  for (let i = 0; i < exact.length; i++) view.setFloat64(exactOffset + i * 8, exact[i], true);
  return out;
}

function fail(message: string): never {
  throw new Error(`road extract: ${message}`);
}

/** Read and validate the header without decoding the body. */
export function readRoadExtractHeader(data: ArrayBuffer | Uint8Array): RoadExtractHeader & {
  stringsOffset: number; stringsLength: number; featuresOffset: number; featuresLength: number; exactOffset: number; exactLength: number;
} {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < HEADER_BYTES) fail(`${bytes.length} bytes is shorter than the header`);
  for (let i = 0; i < 4; i++) if (bytes[i] !== ROAD_EXTRACT_MAGIC.charCodeAt(i)) fail('bad magic');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(4, true);
  if (version !== ROAD_EXTRACT_VERSION) fail(`version ${version}, this decoder reads ${ROAD_EXTRACT_VERSION}`);
  if (view.getUint16(6, true) !== 0) fail('reserved header field is not zero');
  const u = (i: number) => view.getUint32(8 + i * 4, true);
  const header = {
    version, byteLength: u(0), featureCount: u(1), pathCount: u(2), pointCount: u(3), stringCount: u(4), exactCount: u(5),
    stringsOffset: u(6), stringsLength: u(7), featuresOffset: u(8), featuresLength: u(9), exactOffset: u(10), exactLength: u(11),
    sourceSha256: Array.from(bytes.subarray(56, 88), b => b.toString(16).padStart(2, '0')).join(''),
  };
  if (header.byteLength !== bytes.length) fail(`header says ${header.byteLength} bytes, buffer has ${bytes.length}`);
  if (header.stringsOffset !== HEADER_BYTES) fail('strings do not follow the header');
  if (header.featuresOffset !== header.stringsOffset + header.stringsLength) fail('features do not follow the strings');
  if (header.exactOffset % 8 || header.exactOffset < header.featuresOffset + header.featuresLength
    || header.exactOffset - (header.featuresOffset + header.featuresLength) >= 8) fail('exact section is misplaced');
  if (header.exactLength !== header.exactCount * 8) fail('exact length does not match its count');
  if (header.exactOffset + header.exactLength !== bytes.length) fail('leftover bytes after the exact section');
  return header;
}

/**
 * Decode a road extract into the feature array `streets-routing.json` parses
 * to. Every section must be consumed exactly; anything short, long or out of
 * range throws.
 */
export function decodeRoadExtract(data: ArrayBuffer | Uint8Array): { header: RoadExtractHeader; features: RoadExtractFeature[] } {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const header = readRoadExtractHeader(bytes);
  let pos = 0;
  let end = 0;
  const uvarint = (): number => {
    let result = 0, scale = 1;
    for (;;) {
      if (pos >= end) fail('truncated varint');
      const byte = bytes[pos++];
      result += (byte & 0x7f) * scale;
      if (byte < 0x80) break;
      scale *= 0x80;
      if (scale > 2 ** 49) fail('varint too long');
    }
    return result;
  };
  const svarint = (): number => {
    const z = uvarint();
    return z % 2 ? -(z + 1) / 2 : z / 2;
  };

  const utf8 = new TextDecoder('utf-8', { fatal: true });
  const strings: string[] = new Array(header.stringCount);
  pos = header.stringsOffset;
  end = header.stringsOffset + header.stringsLength;
  for (let i = 0; i < header.stringCount; i++) {
    const length = uvarint();
    if (pos + length > end) fail('string runs past its section');
    strings[i] = utf8.decode(bytes.subarray(pos, pos + length));
    pos += length;
  }
  if (pos !== end) fail('leftover bytes in the string section');
  const string = (): string => {
    const index = uvarint();
    if (index >= strings.length) fail(`string index ${index} out of range`);
    return strings[index];
  };

  const exactView = new DataView(bytes.buffer, bytes.byteOffset + header.exactOffset, header.exactLength);
  let exactIndex = 0;
  const exactValue = (): number => {
    if (exactIndex >= header.exactCount) fail('exact coordinates exhausted');
    return exactView.getFloat64(8 * exactIndex++, true);
  };

  const features: RoadExtractFeature[] = new Array(header.featureCount);
  pos = header.featuresOffset;
  end = header.featuresOffset + header.featuresLength;
  let lastLat = 0, lastLon = 0;
  let pathCount = 0, pointCount = 0;
  for (let f = 0; f < header.featureCount; f++) {
    const idKind = uvarint();
    let id: string;
    if (idKind === 2) id = string();
    else if (idKind < ID_PREFIXES.length) id = ID_PREFIXES[idKind] + uvarint();
    else fail(`unknown id kind ${idKind}`);
    const name = string();
    const type = string();
    const cityId = string();
    const highway = string();
    const flags = uvarint();
    if (flags & ~KNOWN_FLAGS) fail(`unknown flags ${flags}`);
    const railway = flags & FLAG_RAILWAY ? string() : undefined;
    const bicycle = flags & FLAG_BICYCLE ? string() : undefined;
    const pathTotal = flags & FLAG_PATHS ? uvarint() : 1;
    const isExact = (flags & FLAG_EXACT) !== 0;
    const paths: Coord[][] = new Array(pathTotal);
    let first: Coord | null = null;
    for (let p = 0; p < pathTotal; p++) {
      const count = uvarint();
      if (count > end - pos + header.exactCount) fail('path longer than the file');
      const path: Coord[] = new Array(count);
      for (let i = 0; i < count; i++) {
        if (isExact) {
          path[i] = [exactValue(), exactValue()];
        } else {
          lastLat += svarint();
          lastLon += svarint();
          path[i] = [lastLat / GRID, lastLon / GRID];
        }
        if (!first) first = path[i];
      }
      paths[p] = path;
      pathCount++;
      pointCount += count;
    }
    if (!first) fail(`feature ${id} has no points`);
    const center: Coord = isExact
      ? [exactValue(), exactValue()]
      : [(Math.round(first[0] * GRID) + svarint()) / GRID, (Math.round(first[1] * GRID) + svarint()) / GRID];

    const feature: RoadExtractFeature = { id, name, type, cityId, center, highway, path: paths[0] };
    if (flags & FLAG_PATHS) feature.paths = paths;
    if (flags & FLAG_BRIDGE) feature.bridge = true;
    if (railway !== undefined) feature.railway = railway;
    if (flags & FLAG_BICYCLE_RESTRICTED) feature.bicycleRestricted = true;
    if (bicycle !== undefined) feature.bicycle = bicycle;
    if (flags & FLAG_ONEWAY) feature.oneway = true;
    features[f] = feature;
  }
  if (pos !== end) fail('leftover bytes in the feature section');
  if (exactIndex !== header.exactCount) fail('leftover exact coordinates');
  if (pathCount !== header.pathCount || pointCount !== header.pointCount) fail('path or point count does not match the header');
  return { header, features };
}

/**
 * The published file is gzip-wrapped (`streets-routing.bin.gz`) because
 * hosting compresses JSON but not `application/octet-stream`. A host that
 * does decode it on the way (Content-Encoding) hands over the bare format, so
 * read the magic rather than trusting the name: gzip (1f 8b) is inflated with
 * the platform's DecompressionStream, anything else is decoded as is.
 */
export async function loadRoadExtract(data: ArrayBuffer | Uint8Array): Promise<{ header: RoadExtractHeader; features: RoadExtractFeature[] }> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const inflated = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return decodeRoadExtract(inflated);
  }
  return decodeRoadExtract(bytes);
}
