/**
 * A minimal FlatGeobuf reader, enough to read an index of files.
 *
 * 3DBAG publishes `tile_index.fgb` and nothing else — no JSON, no GeoJSON — and
 * that index is the only place the per-tile CityJSON download URLs and their
 * SHA-256 checksums exist. Guessing tile paths does not work: the Cesium 3D
 * Tiles coordinates are quadtree keys, unrelated to 3DBAG's own tile ids.
 *
 * The alternative is the OGC API, which caps at 100 features per page and so
 * needs a couple of thousand requests and gigabytes of transfer for one city.
 * Reading a 5.7 MB index once is better, and it comes with the checksums the
 * build stages want anyway.
 *
 * This implements only what that job needs: the header's column definitions,
 * a skip over the packed Hilbert R-tree, and a linear pass over features
 * reading each one's bounding box and scalar properties. It does not decode
 * geometry rings, nested parts, Z/M values or the spatial index, because an
 * index of rectangles needs none of them. Point it at a general FlatGeobuf and
 * it will read the properties and the bounds and quietly ignore the shape.
 *
 * Format reference: https://flatgeobuf.org/ — magic, header size, header
 * table, optional index, then length-prefixed feature tables. Everything is
 * little-endian FlatBuffers.
 */

const MAGIC = [0x66, 0x67, 0x62, 0x03, 0x66, 0x67, 0x62]; // "fgb\x03fgb" then a version byte

/** FlatGeobuf column type codes, as far as this reader decodes them. */
const enum ColumnType {
  Byte = 0, UByte = 1, Bool = 2, Short = 3, UShort = 4, Int = 5, UInt = 6,
  Long = 7, ULong = 8, Float = 9, Double = 10, String = 11, Json = 12,
  DateTime = 13, Binary = 14
}

export type FgbValue = string | number | boolean | null;
export type FgbFeature = {
  /** `[minX, minY, maxX, maxY]` over the feature's coordinates, in the file's CRS. */
  bbox: [number, number, number, number];
  properties: Record<string, FgbValue>;
};
export type FlatGeobuf = {
  name: string;
  featureCount: number;
  columns: { name: string; type: number }[];
  features: FgbFeature[];
};

/**
 * A FlatBuffers table reader.
 *
 * A table stores a signed offset back to its vtable, and the vtable holds one
 * 16-bit offset per field — zero meaning absent. Everything else here is
 * reading little-endian scalars at a computed position.
 */
class Table {
  constructor(private readonly view: DataView, private readonly start: number) {}

  /** Byte position of field `index`, or 0 when the field is not present. */
  private field(index: number): number {
    const vtable = this.start - this.view.getInt32(this.start, true);
    const vtableSize = this.view.getUint16(vtable, true);
    const offsetPosition = 4 + index * 2;
    if (offsetPosition >= vtableSize) return 0;
    const offset = this.view.getUint16(vtable + offsetPosition, true);
    return offset === 0 ? 0 : this.start + offset;
  }

  u8(index: number, fallback = 0): number { const p = this.field(index); return p === 0 ? fallback : this.view.getUint8(p); }
  u16(index: number, fallback = 0): number { const p = this.field(index); return p === 0 ? fallback : this.view.getUint16(p, true); }
  /** Feature counts are 64-bit; this project's files are far inside Number.MAX_SAFE_INTEGER. */
  u64(index: number, fallback = 0): number { const p = this.field(index); return p === 0 ? fallback : Number(this.view.getBigUint64(p, true)); }

  string(index: number): string {
    const p = this.field(index);
    if (p === 0) return '';
    const start = p + this.view.getUint32(p, true);
    const length = this.view.getUint32(start, true);
    return new TextDecoder().decode(new Uint8Array(this.view.buffer, this.view.byteOffset + start + 4, length));
  }

  /** Start position and length of a vector field, or null when absent. */
  vector(index: number): { start: number; length: number } | null {
    const p = this.field(index);
    if (p === 0) return null;
    const start = p + this.view.getUint32(p, true);
    return { start: start + 4, length: this.view.getUint32(start, true) };
  }

  /** A table-typed field, resolved through its offset. */
  table(index: number): Table | null {
    const p = this.field(index);
    return p === 0 ? null : new Table(this.view, p + this.view.getUint32(p, true));
  }
}

/** Byte size of the packed Hilbert R-tree that sits between header and features. */
function spatialIndexBytes(featureCount: number, nodeSize: number): number {
  if (nodeSize === 0 || featureCount === 0) return 0;
  const branch = Math.max(2, Math.min(nodeSize, 65535));
  let nodes = featureCount;
  let level = featureCount;
  while (level !== 1) {
    level = Math.ceil(level / branch);
    nodes += level;
  }
  return nodes * 40; // four doubles of bbox plus a uint64 offset
}

/** Decode one feature's property blob against the file's column definitions. */
function readProperties(view: DataView, start: number, length: number, columns: { name: string; type: number }[]): Record<string, FgbValue> {
  const properties: Record<string, FgbValue> = {};
  let at = start;
  const end = start + length;
  while (at + 2 <= end) {
    const column = columns[view.getUint16(at, true)];
    at += 2;
    if (!column) break; // unknown column index: the rest cannot be positioned
    switch (column.type) {
      case ColumnType.Bool: properties[column.name] = view.getUint8(at) !== 0; at += 1; break;
      case ColumnType.Byte: properties[column.name] = view.getInt8(at); at += 1; break;
      case ColumnType.UByte: properties[column.name] = view.getUint8(at); at += 1; break;
      case ColumnType.Short: properties[column.name] = view.getInt16(at, true); at += 2; break;
      case ColumnType.UShort: properties[column.name] = view.getUint16(at, true); at += 2; break;
      case ColumnType.Int: properties[column.name] = view.getInt32(at, true); at += 4; break;
      case ColumnType.UInt: properties[column.name] = view.getUint32(at, true); at += 4; break;
      case ColumnType.Long: properties[column.name] = Number(view.getBigInt64(at, true)); at += 8; break;
      case ColumnType.ULong: properties[column.name] = Number(view.getBigUint64(at, true)); at += 8; break;
      case ColumnType.Float: properties[column.name] = view.getFloat32(at, true); at += 4; break;
      case ColumnType.Double: properties[column.name] = view.getFloat64(at, true); at += 8; break;
      case ColumnType.String: case ColumnType.Json: case ColumnType.DateTime: case ColumnType.Binary: {
        const size = view.getUint32(at, true);
        at += 4;
        const bytes = new Uint8Array(view.buffer, view.byteOffset + at, size);
        properties[column.name] = column.type === ColumnType.Binary ? `<${size} bytes>` : new TextDecoder().decode(bytes);
        at += size;
        break;
      }
      default: return properties; // an unsupported type makes every later offset unknowable
    }
  }
  return properties;
}

/** Read a FlatGeobuf file into column definitions and per-feature bounds and properties. */
export function readFlatGeobuf(bytes: Uint8Array): FlatGeobuf {
  for (const [index, byte] of MAGIC.entries()) {
    if (bytes[index] !== byte) throw new Error('not a FlatGeobuf file: bad magic');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = view.getUint32(8, true);
  const headerStart = 12;
  const header = new Table(view, headerStart + view.getUint32(headerStart, true));

  const name = header.string(0);
  const columnsVector = header.vector(7);
  const columns: { name: string; type: number }[] = [];
  if (columnsVector) {
    for (let index = 0; index < columnsVector.length; index++) {
      const at = columnsVector.start + index * 4;
      const column = new Table(view, at + view.getUint32(at, true));
      columns.push({ name: column.string(0), type: column.u8(1) });
    }
  }
  const featureCount = header.u64(8);
  const nodeSize = header.u16(9, 16);

  let at = headerStart + headerSize + spatialIndexBytes(featureCount, nodeSize);
  const features: FgbFeature[] = [];
  while (at + 4 <= bytes.byteLength && features.length < featureCount) {
    const size = view.getUint32(at, true);
    if (size === 0 || at + 4 + size > bytes.byteLength) break;
    const feature = new Table(view, at + 4 + view.getUint32(at + 4, true));

    let bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    const geometry = feature.table(0);
    const xy = geometry?.vector(1);
    if (xy) {
      for (let index = 0; index < xy.length; index += 2) {
        const x = view.getFloat64(xy.start + index * 8, true);
        const y = view.getFloat64(xy.start + (index + 1) * 8, true);
        bbox = [Math.min(bbox[0], x), Math.min(bbox[1], y), Math.max(bbox[2], x), Math.max(bbox[3], y)];
      }
    }

    const blob = feature.vector(1);
    features.push({ bbox, properties: blob ? readProperties(view, blob.start, blob.length, columns) : {} });
    at += 4 + size;
  }
  return { name, featureCount, columns, features };
}
