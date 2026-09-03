// Shrinks a player-vehicle GLB without breaking the parts the game animates.
//
// The bicycle shipped at 1.92 MB: 73,921 triangles across 280 primitives and
// 686 nodes, with no textures at all, quantized but never actually compressed.
// That is 280 draw calls and two megabytes for an object drawn at chase-camera
// distance, and almost all of it is avoidable without touching the model as a
// model.
//
// The one thing this must not do is flatten the scene. `player-vehicles.js`
// looks up `Lenker`, `RadVorn` and `RadHinten` by name to steer the bars and
// roll the wheels, so the usual "join everything into one mesh" pass would cut
// the draw calls to one and leave a bicycle whose handlebars no longer turn.
// Named nodes are protected; everything else is fair game.
//
//   npx tsx scripts/build-vehicle-model.ts --source=<in.glb> --out=<out.glb> \
//     [--triangles=20000] [--keep=Lenker,RadVorn,RadHinten]

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, join, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
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

function countDrawCalls(document: Document): number {
  let calls = 0;
  for (const mesh of document.getRoot().listMeshes()) calls += mesh.listPrimitives().length;
  return calls;
}

/**
 * Strips names from everything the game does not animate.
 *
 * `join({ keepNamed: true })` is the only merge pass that respects names, but
 * it respects *all* of them, and this bicycle names all 278 of its meshes. So
 * the first run merged nothing: 280 draw calls in, 278 out. Clearing the names
 * it does not need turns the same pass loose on the other 275.
 *
 * Names are kept inside the animated subtrees as well as on their roots.
 * `Lenker` carries the fork, bars and front wheel beneath it, and merging its
 * descendants into the frame would weld the handlebars solid just as surely as
 * losing the node itself.
 */
function stripUnprotectedNames(document: Document, protectedNames: ReadonlySet<string>): number {
  let cleared = 0;
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  const visit = (node: ReturnType<typeof scene.listChildren>[number], insideProtected: boolean): void => {
    const isProtected = insideProtected || protectedNames.has(node.getName());
    if (!isProtected && node.getName()) {
      node.setName('');
      const mesh = node.getMesh();
      if (mesh?.getName()) mesh.setName('');
      cleared += 1;
    }
    for (const child of node.listChildren()) visit(child, isProtected);
  };
  for (const node of scene.listChildren()) visit(node, false);
  return cleared;
}

/** Multiplies two column-major 4x4 matrices. */
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
 * Lifts every mesh the game does not animate to the scene root, carrying its
 * world transform with it.
 *
 * This is what unlocks the rest. `join` only merges meshes that are siblings,
 * and this bicycle spreads 280 primitives over 686 nodes, so almost nothing is
 * a sibling of anything and merging achieved 280 draw calls down to 267.
 * Decimation was stuck for the same reason: a 264-triangle primitive has very
 * little it can afford to lose, so simplifying 280 of them separately barely
 * moved the total no matter how far the error bound was opened.
 *
 * `flatten()` does exactly this and is not usable here, because it hoists the
 * animated nodes too. So the hoist is done by hand, skipping any node that is
 * protected, contains something protected, or sits beneath something
 * protected — the three cases in which moving it would either lose the node
 * the game looks up or silently change where its children end up.
 */
function hoistUnprotectedMeshes(document: Document, protectedNames: ReadonlySet<string>): number {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  type SceneNode = ReturnType<typeof scene.listChildren>[number];

  const containsProtected = (node: SceneNode): boolean =>
    protectedNames.has(node.getName())
    || node.listChildren().some(child => containsProtected(child));

  const movable: { node: SceneNode; world: number[] }[] = [];
  const collect = (node: SceneNode, parentWorld: number[], insideProtected: boolean): void => {
    const world = multiply(parentWorld, node.getMatrix() as number[]);
    const isProtected = insideProtected || protectedNames.has(node.getName());
    if (!isProtected && node.getMesh() && !containsProtected(node)) {
      movable.push({ node, world });
      // Its descendants move with it, so do not consider them separately.
      return;
    }
    for (const child of node.listChildren()) collect(child, world, isProtected);
  };
  for (const node of scene.listChildren()) collect(node, IDENTITY, false);

  for (const { node, world } of movable) {
    for (const parent of document.getRoot().listNodes()) {
      if (parent.listChildren().includes(node)) parent.removeChild(node);
    }
    scene.removeChild(node);
    node.setMatrix(world as never);
    scene.addChild(node);
  }
  return movable.length;
}

/** Names the game animates, which must still resolve after the rewrite. */
function assertNamedNodesSurvive(document: Document, names: readonly string[]): void {
  const present = new Set(document.getRoot().listNodes().map(node => node.getName()));
  const missing = names.filter(name => !present.has(name));
  if (missing.length) {
    throw new Error(
      `Optimisation removed nodes the game animates: ${missing.join(', ')}. `
      + 'Loosen the join/flatten pass rather than shipping a bicycle whose wheels do not turn.',
    );
  }
}

async function main(): Promise<void> {
  const source = argument('source');
  const out = argument('out');
  if (!source || !out) throw new Error('Usage: --source=<in.glb> --out=<out.glb>');
  const budget = Number(argument('triangles') ?? 20_000);
  const simplifyError = Number(argument('error') ?? 0.01);
  const keep = (argument('keep') ?? '').split(',').map(name => name.trim()).filter(Boolean);

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const document = await io.read(source);
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;

  const beforeBytes = fs.statSync(source).size;
  const beforeTriangles = countTriangles(document);
  const beforeCalls = countDrawCalls(document);

  // No `flatten()` here, and the guard below is why: it hoists every node it
  // can to the scene root, and it took `Lenker`, `RadVorn` and `RadHinten`
  // with it on the first run. It has no notion of a node being load-bearing
  // for reasons outside the file. `join({ keepNamed: true })` does respect
  // names, so merging is left to it alone.
  const protectedNames = new Set(keep);
  const cleared = stripUnprotectedNames(document, protectedNames);
  const hoisted = hoistUnprotectedMeshes(document, protectedNames);
  await document.transform(
    dedup(),
    join({ keepNamed: true }),
    weld(),
    ...(beforeTriangles > budget
      ? [simplify({ simplifier: MeshoptSimplifier, ratio: budget / beforeTriangles, error: simplifyError })]
      : []),
    prune(),
    meshopt({ encoder: MeshoptEncoder }),
  );
  assertNamedNodesSurvive(document, [...protectedNames]);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  await io.write(out, document);
  const afterBytes = fs.statSync(out).size;
  console.log(`${path.basename(source)} → ${path.basename(out)}`);
  console.log(`  bytes      ${(beforeBytes / 1024).toFixed(0)} KB → ${(afterBytes / 1024).toFixed(0)} KB  (${(beforeBytes / afterBytes).toFixed(1)}× smaller)`);
  console.log(`  triangles  ${beforeTriangles.toLocaleString()} → ${countTriangles(document).toLocaleString()}`);
  console.log(`  drawcalls  ${beforeCalls} → ${countDrawCalls(document)}`);
  console.log(`  cleared ${cleared} names and hoisted ${hoisted} meshes so they could merge`);
  if (keep.length) console.log(`  kept named nodes: ${keep.join(', ')}`);
}

main().catch(error => {
  console.error(error.message ?? error);
  process.exit(1);
});
