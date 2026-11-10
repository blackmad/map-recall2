/**
 * The facade atlas for the Node preview: look/paintLookAtlas.ts painted under the nodeDom stubs, cached on disk as
 * artifacts/house-preview/atlas-<look>-<size>-<painter hash>.bin (the colour RGBA bytes then the mask RG bytes,
 * look/lookAtlas.ts lookAtlasBytesOf). The hash is sha256 over the painter's import closure (esbuild's inputs, as
 * scripts/look-atlas/build-look-atlas.ts fingerprints it) plus the brick photo, so a painter edit repaints.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';
import { installNodeDom, assertImageLoaded, REPO_ROOT } from './nodeDom.ts';
import { lookAtlasArraysOf, lookAtlasBytesOf } from '../../src/canalRecall/look/lookAtlas.ts';
import { lookAtlasLayers, type LookAtlasArrays } from '../../src/canalRecall/look/paintLookAtlas.ts';
import type { Look } from '../../src/canalRecall/bayTextures.ts';

export const ATLAS_DIR = path.join(REPO_ROOT, 'artifacts/house-preview');
const PAINTER = 'src/canalRecall/look/paintLookAtlas.ts';
/** Files the painting depends on besides the painter's closure: the brick photo, and the Node stubs that hand it over. */
const PAINTER_ASSETS = ['public/canal-drive/materials/ambientcg/Bricks057/colour.jpg', 'scripts/house-preview/nodeDom.ts', 'scripts/house-preview/atlas.ts'];

/** sha256 (first 16 hex) of the painter's import closure and assets. */
export async function painterHash(): Promise<string> {
  const result = await esbuild.build({ entryPoints: [path.join(REPO_ROOT, PAINTER)], bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', logLevel: 'silent', absWorkingDir: REPO_ROOT });
  const files = [...Object.keys(result.metafile!.inputs).filter(f => !f.includes('node_modules')), ...PAINTER_ASSETS].sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update('\0').update(fs.readFileSync(path.join(REPO_ROOT, f))).update('\0');
  return hash.digest('hex').slice(0, 16);
}

export type AtlasLoad = { atlas: LookAtlasArrays; file: string; painted: boolean; ms: number };

/** The look's atlas at `size` px: from the cache when the painter hash matches, else painted (seconds) and cached. */
export async function loadAtlas(look: 'procedural' | Look = 'photo', size = 256): Promise<AtlasLoad> {
  const t0 = performance.now();
  const hash = await painterHash();
  const { layers, total } = lookAtlasLayers(look, false);
  const file = path.join(ATLAS_DIR, `atlas-${look}-${size}-${hash}.bin`);
  if (fs.existsSync(file)) {
    const buf = fs.readFileSync(file);
    const atlas = lookAtlasArraysOf(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), size, layers, total);
    if (atlas) return { atlas, file, painted: false, ms: performance.now() - t0 };
  }
  installNodeDom();
  const { paintLookArrays } = await import('../../src/canalRecall/look/paintLookAtlas.ts');
  const atlas = await paintLookArrays(look, size, { sliceMs: 1e9 });
  if (look === 'photo') assertImageLoaded('Bricks057');
  fs.mkdirSync(ATLAS_DIR, { recursive: true });
  fs.writeFileSync(file, lookAtlasBytesOf(atlas));
  return { atlas, file, painted: true, ms: performance.now() - t0 };
}
