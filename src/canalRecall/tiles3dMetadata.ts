/**
 * Read per-feature metadata out of a 3D Tiles GLB.
 *
 * 3DBAG publishes its LoD2.2 city as Cesium 3D Tiles, and every building in a
 * tile carries a row of `EXT_structural_metadata` — including `identificatie`,
 * the BAG `pand_id`. That is the join key this project needs: it means measured
 * appearance can be attached to government geometry by identity rather than by
 * guessing which extrusion sits under which footprint.
 *
 * Two details make this cheap. The property tables are stored as plain
 * bufferViews, and only the geometry bufferViews carry
 * `EXT_meshopt_compression` — so identity, heights, construction year and
 * reconstruction quality can all be read without decompressing a single
 * triangle. And the values are columnar, so reading one property out of a tile
 * costs one slice rather than a parse of every building.
 *
 * This module is deliberately format-level and knows nothing about 3DBAG's
 * field names; `bag3dBuildings()` in the caller layer gives them meaning.
 */

/** A parsed binary glTF container. */
export type Glb = { json: GltfJson; bin: Uint8Array };

type BufferView = {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  extensions?: Record<string, unknown>;
};

type ClassProperty = {
  type: 'STRING' | 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4' | 'BOOLEAN' | 'ENUM';
  componentType?: ComponentType;
  noData?: number | string;
};

type PropertyTable = {
  class: string;
  count: number;
  properties: Record<string, { values: number; stringOffsets?: number; stringOffsetType?: string }>;
};

type GltfJson = {
  bufferViews: BufferView[];
  extensions?: {
    EXT_structural_metadata?: {
      schema: { classes: Record<string, { properties: Record<string, ClassProperty> }> };
      propertyTables: PropertyTable[];
    };
  };
};

type ComponentType = 'INT8' | 'UINT8' | 'INT16' | 'UINT16' | 'INT32' | 'UINT32' | 'FLOAT32' | 'FLOAT64';

const COMPONENT_ARRAYS = {
  INT8: Int8Array, UINT8: Uint8Array, INT16: Int16Array, UINT16: Uint16Array,
  INT32: Int32Array, UINT32: Uint32Array, FLOAT32: Float32Array, FLOAT64: Float64Array
} as const satisfies Record<ComponentType, unknown>;

const GLB_MAGIC = 0x46546c67; // "glTF"

/**
 * Split a `.glb` into its JSON and binary chunks.
 *
 * Chunks are padded to four-byte boundaries, and a GLB may legally carry
 * trailing chunks this project does not use, so the walk is bounded by the
 * header's declared length rather than by the file size.
 */
export function parseGlb(bytes: Uint8Array): Glb {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB: bad magic');
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);
  const declared = Math.min(view.getUint32(8, true), bytes.byteLength);

  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;
  let offset = 12;
  while (offset + 8 <= declared) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body)) as GltfJson;
    else if (type === 0x004e4942) bin = body;
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin: bin ?? new Uint8Array(0) };
}

/** Bytes of one bufferView, refusing the compressed ones rather than returning garbage. */
function bufferViewBytes({ json, bin }: Glb, index: number): Uint8Array {
  const view = json.bufferViews[index];
  if (!view) throw new Error(`bufferView ${index} is missing`);
  if (view.extensions?.EXT_meshopt_compression) {
    throw new Error(`bufferView ${index} is meshopt-compressed; decode it before reading metadata`);
  }
  const start = view.byteOffset ?? 0;
  return bin.subarray(start, start + view.byteLength);
}

/**
 * A bufferView reinterpreted as numbers.
 *
 * The bytes are copied rather than viewed in place: a bufferView's byteOffset
 * carries no alignment guarantee for the component type, and an unaligned
 * TypedArray view throws.
 */
function numericValues(glb: Glb, index: number, componentType: ComponentType, count: number): number[] {
  const bytes = bufferViewBytes(glb, index);
  const Ctor = COMPONENT_ARRAYS[componentType];
  const aligned = new Uint8Array(count * Ctor.BYTES_PER_ELEMENT);
  aligned.set(bytes.subarray(0, aligned.byteLength));
  return Array.from(new Ctor(aligned.buffer));
}

/** One decoded property table: a fixed number of rows, read a column at a time. */
export type MetadataTable = {
  count: number;
  className: string;
  propertyNames: string[];
  /** Column of strings; throws if the property is not a STRING. */
  strings(name: string): string[];
  /**
   * Column of numbers, with the class's `noData` sentinel mapped to `null`.
   * 3DBAG uses FLOAT32_MAX and INT32_MAX as "not reconstructed", which are
   * catastrophic if they reach a height or an area unnoticed.
   */
  numbers(name: string): (number | null)[];
};

/** Decode a property table by index, defaulting to the first one in the file. */
export function readMetadataTable(glb: Glb, tableIndex = 0): MetadataTable {
  const metadata = glb.json.extensions?.EXT_structural_metadata;
  if (!metadata) throw new Error('glTF has no EXT_structural_metadata');
  const table = metadata.propertyTables[tableIndex];
  if (!table) throw new Error(`property table ${tableIndex} is missing`);
  const schema = metadata.schema.classes[table.class];
  if (!schema) throw new Error(`schema has no class "${table.class}"`);
  const { count } = table;

  const definition = (name: string) => {
    const property = table.properties[name];
    const declared = schema.properties[name];
    if (!property || !declared) throw new Error(`property "${name}" is not in class "${table.class}"`);
    return { property, declared };
  };

  return {
    count,
    className: table.class,
    propertyNames: Object.keys(table.properties).sort(),

    strings(name) {
      const { property, declared } = definition(name);
      if (declared.type !== 'STRING') throw new Error(`property "${name}" is ${declared.type}, not STRING`);
      if (property.stringOffsets === undefined) throw new Error(`property "${name}" has no stringOffsets`);
      const values = bufferViewBytes(glb, property.values);
      const offsets = numericValues(glb, property.stringOffsets, (property.stringOffsetType as ComponentType) ?? 'UINT32', count + 1);
      const decoder = new TextDecoder();
      return Array.from({ length: count }, (_, row) => decoder.decode(values.subarray(offsets[row], offsets[row + 1])));
    },

    numbers(name) {
      const { property, declared } = definition(name);
      if (declared.type !== 'SCALAR') throw new Error(`property "${name}" is ${declared.type}, not SCALAR`);
      if (!declared.componentType) throw new Error(`property "${name}" has no componentType`);
      const raw = numericValues(glb, property.values, declared.componentType, count);
      const noData = declared.noData;
      return typeof noData === 'number' ? raw.map(value => (value === noData ? null : value)) : raw;
    }
  };
}
