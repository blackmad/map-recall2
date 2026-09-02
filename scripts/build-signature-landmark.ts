// Turns a downloaded landmark mesh into something a browser game can afford.
//
// Source assets are built to be looked at one at a time in a model viewer. The
// Palace arrives as 31 MB: half a million triangles and three 2–4K textures,
// for a building the player sees from 150 m away while cycling past it. This
// script is the offline reduction, and it is a script rather than a one-off
// command so that the next landmark — Rijksmuseum, Centraal, Westerkerk — costs
// an entry in the manifest instead of an afternoon.
//
// It deliberately does not change the model artistically. It removes data the
// renderer will not read (spare UV sets, tangents), collapses duplicate
// vertices, decimates, and shrinks textures. That distinction matters for
// licensing: CC BY and CC BY-SA require modifications to be declared, and a
// NoDerivatives asset may only be format-converted. What was done is written
// into the manifest so `NOTICE.md` can state it.
//
//   npx tsx scripts/build-signature-landmark.ts --id=royal-palace --source=<file.glb>
//
// Reads the placement spec from `src/canalRecall/landmarks/signatureModels.ts`,
// writes the runtime GLB into `public/canal-drive/models/`, and writes measured
// bounds and byte counts back into the generated manifest.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { NodeIO, type Document, type Node as GltfNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import { SIGNATURE_MODELS } from '../src/canalRecall/landmarks/signatureModels';
import {
  placementFor,
  scaledExtent,
  type ModelBounds,
  type SignatureModelSpec,
} from '../src/canalRecall/landmarks/signaturePlacement';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_DIRECTORY = path.join(REPOSITORY_ROOT, 'public', 'canal-drive', 'models');
const MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, 'signature-landmarks.json');

/** Triangles we are willing to spend on one building. The whole city-wide
 *  3D BAG tileset streams at a comparable budget, so a single landmark that
 *  costs more than this would be the most expensive thing on screen. */
const TRIANGLE_BUDGET = 60_000;

/** Longest texture edge. The player never gets closer than the pavement, and
 *  4K on a 80 m facade is roughly 50 px per metre of stonework. */
const MAX_TEXTURE_SIZE = 1024;

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

/** Multiplies two column-major 4×4 matrices. */
function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let k = 0; k < 4; k += 1) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return out;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/**
 * The scene's bounding box in world units, with every node transform applied.
 *
 * Reading `POSITION.min/max` off the accessors is not the same thing and is the
 * easy mistake here: this Palace ships under a chain of nodes that scales by
 * 100 and then by 0.01 and swaps Z-up for Y-up. Accessor bounds would report a
 * 4-metre building lying on its side.
 */
function measureBounds(document: Document): ModelBounds {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const visit = (node: GltfNode, parentMatrix: number[]): void => {
    const matrix = multiply(parentMatrix, node.getMatrix() as number[]);
    const mesh = node.getMesh();
    if (mesh) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (!position) continue;
        const element: [number, number, number] = [0, 0, 0];
        for (let index = 0; index < position.getCount(); index += 1) {
          position.getElement(index, element);
          const [x, y, z] = element;
          const world: [number, number, number] = [
            matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
            matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
            matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
          ];
          for (let axis = 0; axis < 3; axis += 1) {
            if (world[axis] < min[axis]) min[axis] = world[axis];
            if (world[axis] > max[axis]) max[axis] = world[axis];
          }
        }
      }
    }
    for (const child of node.listChildren()) visit(child, matrix);
  };
  for (const node of scene.listChildren()) visit(node, IDENTITY);
  return { min, max };
}

function countTriangles(document: Document): number {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : (primitive.getAttribute('POSITION')?.getCount() ?? 0);
      triangles += count / 3;
    }
  }
  return Math.round(triangles);
}

/** Attribute sets a downloaded mesh carries that this renderer never samples.
 *  The Palace ships three UV sets; the material reads one. */
const UNUSED_ATTRIBUTES = ['TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3', 'COLOR_0', 'TANGENT'];

function dropUnusedAttributes(document: Document): string[] {
  const dropped = new Set<string>();
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      for (const name of UNUSED_ATTRIBUTES) {
        if (!primitive.getAttribute(name)) continue;
        primitive.setAttribute(name, null);
        dropped.add(name);
      }
    }
  }
  return [...dropped];
}

async function main(): Promise<void> {
  const id = argument('id');
  const source = argument('source');
  if (!id || !source) {
    throw new Error('Usage: build-signature-landmark.ts --id=<model id> --source=<downloaded .glb>');
  }
  const spec: SignatureModelSpec | undefined = SIGNATURE_MODELS.find(model => model.id === id);
  if (!spec) {
    throw new Error(`No signature model called "${id}". Known: ${SIGNATURE_MODELS.map(m => m.id).join(', ')}`);
  }
  if (!fs.existsSync(source)) throw new Error(`Source mesh not found: ${source}`);

  // The encoder has to be registered on the IO as well as handed to the
  // transform: the transform marks the document as meshopt-compressed, but it
  // is the writer that actually encodes, and it looks the encoder up here.
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const document = await io.read(source);

  const sourceBytes = fs.statSync(source).size;
  const sourceTriangles = countTriangles(document);
  const sourceBounds = measureBounds(document);
  console.log(`source: ${(sourceBytes / 1e6).toFixed(2)} MB, ${sourceTriangles.toLocaleString()} triangles`);
  console.log(
    `source extent (m, model units): ${sourceBounds.max
      .map((value, axis) => (value - sourceBounds.min[axis]).toFixed(3))
      .join(' × ')}`,
  );

  // Both meshoptimizer entry points are WASM and hand back a promise that has
  // to settle before the first call, or they fail deep inside the writer with
  // an undefined-property error rather than a useful message.
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;

  const droppedAttributes = dropUnusedAttributes(document);
  await document.transform(
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: TRIANGLE_BUDGET / sourceTriangles, error: 0.002 }),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
    }),
    prune(),
    // EXT_meshopt_compression, not Draco. Both would shrink the file, but the
    // page already loads a Meshopt decoder for the 3D BAG tiles, so this costs
    // no extra bytes of decoder; Draco would need a second one.
    meshopt({ encoder: MeshoptEncoder }),
  );

  const bounds = measureBounds(document);
  const triangles = countTriangles(document);
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const outputPath = path.join(OUTPUT_DIRECTORY, `${id}.glb`);
  await io.write(outputPath, document);
  const outputBytes = fs.statSync(outputPath).size;

  const placement = placementFor(spec, bounds);
  const extent = scaledExtent(bounds, placement.scale, spec.footprint);
  console.log(`runtime: ${(outputBytes / 1e6).toFixed(2)} MB, ${triangles.toLocaleString()} triangles`);
  console.log(
    `reduction: ${(sourceBytes / outputBytes).toFixed(1)}× smaller, `
    + `${(sourceTriangles / triangles).toFixed(1)}× fewer triangles`,
  );
  console.log(
    `fitted to ${spec.footprint.lengthMetres.toFixed(2)} m footprint width: scale ${placement.scale.toFixed(5)}, `
    + `facade bearing ${placement.facadeBearingDegrees.toFixed(1)}°`,
  );
  console.log(
    `  height ${extent.heightMetres.toFixed(1)} m (expected ${spec.heightMetres} ± ${spec.heightToleranceMetres})`,
  );
  console.log(
    `  depth  ${extent.depthMetres.toFixed(1)} m of ${spec.footprint.widthMetres.toFixed(1)} m footprint `
    + `(${(extent.depthCoverage * 100).toFixed(0)}% coverage)`,
  );

  const manifest = {
    generatedBy: 'scripts/build-signature-landmark.ts',
    models: {
      ...readExistingManifest(),
      [id]: {
        name: spec.name,
        landmarkId: spec.landmarkId,
        modelUrl: spec.modelUrl,
        bounds,
        placement,
        extent,
        triangles,
        bytes: outputBytes,
        sourceBytes,
        sourceTriangles,
        droppedAttributes,
        maxTextureSize: MAX_TEXTURE_SIZE,
        attribution: spec.attribution,
      },
    },
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${path.relative(REPOSITORY_ROOT, outputPath)} and the manifest`);
}

function readExistingManifest(): Record<string, unknown> {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  return parsed.models ?? {};
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
