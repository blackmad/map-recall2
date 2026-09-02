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
  modelExtent,
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
const DEFAULT_TRIANGLE_BUDGET = 60_000;

/** Longest texture edge. The player never gets closer than the pavement, and
 *  4K on a 80 m facade is roughly 50 px per metre of stonework. */
const DEFAULT_MAX_TEXTURE_SIZE = 1024;

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

/**
 * Cleans up what a SketchUp export brings with it.
 *
 * The City of Amsterdam's survey models are geometrically excellent and
 * presentationally hostile, in two specific ways that both read as "the model
 * is broken" on screen.
 *
 * The first is edge geometry. SketchUp exports its construction edges as LINE
 * primitives in a sibling node — on the Palace an `Edge` node with no triangles
 * at all, spanning 3.3 km. It draws as stray hairlines across the city and it
 * silently wrecks every measurement taken from the scene bounding box: it is
 * the entire reason that model appeared to be 136 m wide when the building is
 * 85 m.
 *
 * The second is face winding. SketchUp has a front and a back face and its
 * exporter honours that, so a model authored without care for winding arrives
 * with inward-facing normals over much of its surface. Forcing every material
 * double-sided fixes it outright, because three.js flips the normal for
 * back-facing fragments. A building is only ever seen from outside, so nothing
 * is lost.
 *
 * The third is why the Palace rendered as a black cut-out. Every material came
 * back `metallicFactor 1.0` — not because anyone chose it, but because that is
 * glTF's *default* when an exporter omits the field, and SketchUp omits it. A
 * fully metallic surface has no diffuse response at all: it shows only what it
 * reflects, and with no environment map to reflect it reflects nothing and
 * renders black. Stone is not metal, so this sets what the exporter should
 * have.
 */
const STONE_METALLIC = 0;
const STONE_ROUGHNESS = 0.85;

/**
 * What to paint the surfaces SketchUp left unpainted.
 *
 * `default_face_material` is not a colour anyone chose — it is SketchUp's "no
 * material assigned", exported as near-white. On the Palace those surfaces are
 * the insides of its two internal courtyards, and at 0.98 white they read from
 * above as two glowing rectangles punched through the roof. A dark neutral
 * reads as what they actually are: shaded interior wall the player is seeing
 * down into. This is the one place this script assigns an appearance rather
 * than correcting one, so it is deliberately joyless — no hue, just shadow.
 */
const UNPAINTED_FACE_COLOUR: [number, number, number, number] = [0.16, 0.16, 0.17, 1];
const UNPAINTED_MATERIAL_PATTERN = /^default_face_material/i;

/**
 * The aerial photograph these models are traced over, and its backing.
 *
 * Every one of these was modelled on top of a Google Earth snapshot, and the
 * snapshot ships inside the export: a flat photo-textured plane, 700 m across
 * on Centraal, lying at ground level. It is why Centraal measured 751 m wide
 * and NEMO 296 m, and on the map it draws as a huge grey rectangle of someone
 * else's satellite imagery pasted over the basemap.
 *
 * Two rules, because it arrives as two surfaces. The material name catches the
 * photo itself. The size test catches its unpainted back face, which has no
 * distinguishing name — anything essentially flat and larger across than any
 * real building here is ground, not architecture.
 */
const SNAPSHOT_MATERIAL_PATTERN = /google earth|snapshot/i;
/**
 * Ground is enormous and almost empty; architecture is not.
 *
 * Flatness was the wrong test. The site under the Rijksmuseum is not flat — it
 * is a terrain patch 239 x 201 m with 11.5 m of relief, sloping below the
 * building — and Centraal's is a photo plane. What they have in common, and
 * what no real roof shares, is that they cover a couple of hundred metres with
 * eight triangles. The Rijksmuseum's own roof covers a comparable area with
 * 1,702.
 *
 * So the test is density: bigger across than any single building here, and
 * simpler than any real surface that size would be.
 */
const GROUND_PLANE_MIN_SPAN_METRES = 60;
const GROUND_PLANE_MAX_TRIANGLES = 64;

/**
 * World-space bounds for every primitive, keyed by primitive.
 *
 * Measuring a primitive's own POSITION accessor is not the same thing and was
 * actively wrong here: a roof plane sits at y≈0 *within its own node* and is
 * lifted 20 m by that node's transform. Judged locally it looks exactly like a
 * ground slab, which is how a first attempt at this deleted the Palace's roof
 * and shortened the building from 60.9 m to 56.6 m.
 */
function primitiveWorldBounds(
  document: Document,
): Map<ReturnType<Document['createPrimitive']>, { width: number; height: number; depth: number; baseY: number }> {
  const bounds = new Map<
    ReturnType<Document['createPrimitive']>,
    { width: number; height: number; depth: number; baseY: number }
  >();
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  const visit = (node: GltfNode, parentMatrix: number[]): void => {
    const matrix = multiply(parentMatrix, node.getMatrix() as number[]);
    const mesh = node.getMesh();
    if (mesh) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (!position) continue;
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        const element: [number, number, number] = [0, 0, 0];
        for (let index = 0; index < position.getCount(); index += 1) {
          position.getElement(index, element);
          const [x, y, z] = element;
          const world = [
            matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
            matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
            matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
          ];
          for (let axis = 0; axis < 3; axis += 1) {
            if (world[axis] < min[axis]) min[axis] = world[axis];
            if (world[axis] > max[axis]) max[axis] = world[axis];
          }
        }
        bounds.set(primitive, {
          width: max[0] - min[0],
          height: max[1] - min[1],
          depth: max[2] - min[2],
          baseY: min[1],
        });
      }
    }
    for (const child of node.listChildren()) visit(child, matrix);
  };
  for (const node of scene.listChildren()) visit(node, IDENTITY);
  return bounds;
}

function cleanSketchUpExport(document: Document): {
  droppedPrimitives: number;
  droppedGround: number;
  doubleSided: number;
  demetallised: number;
  unpainted: number;
} {
  let droppedPrimitives = 0;
  let droppedGround = 0;
  const worldBounds = primitiveWorldBounds(document);
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      // 4 is TRIANGLES. Points and lines are construction leftovers.
      if (primitive.getMode() !== 4) {
        mesh.removePrimitive(primitive);
        primitive.dispose();
        droppedPrimitives += 1;
        continue;
      }
      const materialName = primitive.getMaterial()?.getName() ?? '';
      const span = worldBounds.get(primitive) ?? null;
      const isSnapshot = SNAPSHOT_MATERIAL_PATTERN.test(materialName);
      const indices = primitive.getIndices();
      const triangles = (indices ? indices.getCount() : (primitive.getAttribute('POSITION')?.getCount() ?? 0)) / 3;
      const isGroundPlane = span !== null
        && Math.min(span.width, span.depth) >= GROUND_PLANE_MIN_SPAN_METRES
        && triangles <= GROUND_PLANE_MAX_TRIANGLES;
      if (!isSnapshot && !isGroundPlane) continue;
      mesh.removePrimitive(primitive);
      primitive.dispose();
      droppedGround += 1;
    }
  }
  let doubleSided = 0;
  let demetallised = 0;
  let unpainted = 0;
  for (const material of document.getRoot().listMaterials()) {
    if (!material.getDoubleSided()) {
      material.setDoubleSided(true);
      doubleSided += 1;
    }
    if (material.getMetallicFactor() !== STONE_METALLIC) {
      material.setMetallicFactor(STONE_METALLIC);
      material.setRoughnessFactor(STONE_ROUGHNESS);
      demetallised += 1;
    }
    if (UNPAINTED_MATERIAL_PATTERN.test(material.getName()) && !material.getBaseColorTexture()) {
      material.setBaseColorFactor(UNPAINTED_FACE_COLOUR);
      unpainted += 1;
    }
  }
  return { droppedPrimitives, droppedGround, doubleSided, demetallised, unpainted };
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
  const TRIANGLE_BUDGET = Number(argument('triangles') ?? DEFAULT_TRIANGLE_BUDGET);
  const MAX_TEXTURE_SIZE = Number(argument('texture') ?? DEFAULT_MAX_TEXTURE_SIZE);
  const outputName = argument('out') ?? id;
  const SIMPLIFY_ERROR = Number(argument('error') ?? 0.002);
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

  const cleaned = argument('profile') === 'sketchup' ? cleanSketchUpExport(document) : null;
  if (cleaned) {
    console.log(
      `sketchup cleanup: dropped ${cleaned.droppedPrimitives} non-triangle primitives, `
      + `${cleaned.droppedGround} ground/snapshot planes, `
      + `made ${cleaned.doubleSided} materials double-sided, `
      + `de-metallised ${cleaned.demetallised}, darkened ${cleaned.unpainted} unpainted`,
    );
    const cleanedBounds = measureBounds(document);
    console.log(
      `extent after cleanup: ${cleanedBounds.max
        .map((value, axis) => (value - cleanedBounds.min[axis]).toFixed(2))
        .join(' × ')} m`,
    );
  }

  const droppedAttributes = dropUnusedAttributes(document);
  await document.transform(
    dedup(),
    weld(),
    // A ratio at or above 1 is not "leave it alone", it trips an assertion
    // inside the simplifier. Survey models arrive well under budget already —
    // the Palace is 12,357 triangles — so decimation is simply skipped.
    ...(sourceTriangles > TRIANGLE_BUDGET
      ? [simplify({ simplifier: MeshoptSimplifier, ratio: TRIANGLE_BUDGET / sourceTriangles, error: SIMPLIFY_ERROR })]
      : []),
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
  const outputPath = path.join(OUTPUT_DIRECTORY, `${outputName}.glb`);
  await io.write(outputPath, document);
  const outputBytes = fs.statSync(outputPath).size;

  const placement = placementFor(spec, bounds);
  const extent = spec.footprint ? scaledExtent(bounds, placement.scale, spec.footprint) : null;
  console.log(`runtime: ${(outputBytes / 1e6).toFixed(2)} MB, ${triangles.toLocaleString()} triangles`);
  console.log(
    `reduction: ${(sourceBytes / outputBytes).toFixed(1)}× smaller, `
    + `${(sourceTriangles / triangles).toFixed(1)}× fewer triangles`,
  );
  const measured = modelExtent(bounds);
  if (spec.surveyed) {
    console.log(
      `surveyed placement at ${spec.surveyed.anchor[1].toFixed(6)}, ${spec.surveyed.anchor[0].toFixed(6)}, `
      + `scale 1, north-up`,
    );
    console.log(
      `  measured ${(measured.width * placement.scale).toFixed(1)} × `
      + `${(measured.depth * placement.scale).toFixed(1)} m, `
      + `${(measured.height * placement.scale).toFixed(1)} m tall`,
    );
  } else if (spec.footprint && extent) {
    console.log(
      `fitted to ${spec.footprint.lengthMetres.toFixed(2)} m footprint width: scale ${placement.scale.toFixed(5)}, `
      + `facade bearing ${placement.facadeBearingDegrees.toFixed(1)}°`,
    );
    console.log(
      `  depth  ${extent.depthMetres.toFixed(1)} m of ${spec.footprint.widthMetres.toFixed(1)} m footprint `
      + `(${(extent.depthCoverage * 100).toFixed(0)}% coverage)`,
    );
  }
  if (extent && spec.heightMetres !== undefined) {
    const tolerance = spec.heightToleranceMetres ?? 2;
    const off = Math.abs(extent.heightMetres - spec.heightMetres);
    console.log(`  height ${extent.heightMetres.toFixed(1)} m (expected ${spec.heightMetres} ± ${tolerance})`);
    // Hard failure, not a warning. A surveyed model is placed at scale 1, so a
    // height that disagrees with the survey means geometry was lost or the
    // wrong file was built — both of which a warning in a 9-model loop scrolls
    // straight past. The over-eager ground-plane rule that ate the Palace's
    // roof got through exactly that way.
    if (off > tolerance) {
      throw new Error(
        `${spec.id}: built model is ${extent.heightMetres.toFixed(1)} m, expected `
        + `${spec.heightMetres} ± ${tolerance}. Cleanup probably removed real geometry.`,
      );
    }
  }
  if (spec.footprint && spec.surveyed) {
    const coverage = (measured.depth * placement.scale) / spec.footprint.widthMetres;
    console.log(
      `  footprint ${spec.footprint.lengthMetres.toFixed(1)} × ${spec.footprint.widthMetres.toFixed(1)} m `
      + `from OSM; survey covers ${(coverage * 100).toFixed(0)}% of its depth`,
    );
  }

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
