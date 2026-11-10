/**
 * Compress a GLB for the browser: quantized attributes (KHR_mesh_quantization) and meshopt
 * (EXT_meshopt_compression), the same encoder the landmark pipeline uses. The browser loaders
 * (signature-landmarks-source.js) already register the meshopt decoder, so a compressed file loads
 * through the same GLTFLoader. Triangles are never changed: no weld, no simplify.
 *
 * `enabled: false` returns the input bytes untouched, so callers can thread the option through
 * without changing their output.
 */
import {NodeIO} from '@gltf-transform/core';
import {EXTMeshoptCompression, KHRMeshQuantization} from '@gltf-transform/extensions';
import {quantize} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {createHash} from 'node:crypto';

export interface CompressGlbOptions {
  /** Default true. false returns the input bytes as they are. */
  enabled?: boolean;
  /**
   * Position bits. 16 keeps the quantization error far below the 1 cm bar on any street-scale chunk
   * (a 200 m box is about 1.5 mm per step); the glTF default of 14 is coarser than the survey.
   */
  quantizePosition?: number;
}

/** A NodeIO that can read and write meshopt-compressed and quantized GLBs. */
export async function glbIO(): Promise<NodeIO> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  return new NodeIO()
    .registerExtensions([KHRMeshQuantization, EXTMeshoptCompression])
    .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
}

export async function compressGlb(bytes: Uint8Array, options: CompressGlbOptions = {}): Promise<Uint8Array> {
  if (options.enabled === false) return bytes;
  const io = await glbIO();
  const doc = await io.readBinary(bytes);
  // Not functions.meshopt(): that wrapper runs reorder() first, which permutes vertices AND triangles. The chunk
  // writer's primitive.extras.pandRanges are triangle indices, so a reorder would hand every pand the wrong faces.
  // This is the wrapper's remaining steps (quantize, then the FILTER encoder) without the reorder.
  await doc.transform(quantize({quantizePosition: options.quantizePosition ?? 16}));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.FILTER});
  return io.writeBinary(doc);
}

/**
 * The manifest fields that describe the installed file. Call with the bytes that are actually
 * written: buildChunkManifest hashes the uncompressed staging GLB, so an installed entry must be
 * re-described from the compressed bytes.
 */
export function describeInstalledGlb(entry: {modelUrl: string; sha256: string; bytes: number}, installed: Uint8Array) {
  const sha256 = createHash('sha256').update(installed).digest('hex');
  const base = entry.modelUrl.split('?')[0];
  return {...entry, modelUrl: `${base}?asset=${sha256.slice(0, 16)}`, sha256, bytes: installed.length};
}
