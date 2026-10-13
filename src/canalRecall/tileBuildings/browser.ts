/**
 * Browser entry for the recipe-tile near tier (`?recipeTiles=1`). Bundle (integrator: add to scripts/build-3d-bundles.mjs
 * or package.json; THREE comes from window.CanalRecallThree, so no shim is needed):
 *   esbuild src/canalRecall/tileBuildings/browser.ts --bundle --format=iife --global-name=CanalRecallTileBuildings \
 *     --outfile=public/canal-drive/js/tile-buildings.bundle.js --minify
 *
 * `mountRecipeTiles(vectorMap)` is the whole adapter: vector-map.js only loads the bundle and calls it. Everything the
 * near tier needs from the legacy page goes through the host object built here.
 */
import {getCityLook} from '../look/cityLook.ts';
import {TileBuildings, recipeTilesEnabled, type TileBuildingsHost} from './runtime.ts';

export {TileBuildings, recipeTilesEnabled};
export {wantedTiles, coverUnion, pandOfFace, RefCache} from './runtime.ts';

/** Where the published data lives (window.__canalRecallRecipeTilesBase overrides; tests point it at staging). */
export function recipeTilesBase(): string {
  const g = globalThis as any;
  return new URL(g.__canalRecallRecipeTilesBase ?? './recipe-tiles/', g.location.href).href;
}

export async function mountRecipeTiles(vm: any): Promise<TileBuildings> {
  const api = (globalThis as any).CanalRecallThree, THREE = api?.THREE;
  const frame = vm._sharedFrame ?? vm._ensureSharedFrame?.();
  if (!THREE || !frame) throw Error('recipe tiles need the shared frame (?sharedFrame=1 is implied by ?recipeTiles=1)');
  const loader = new api.GLTFLoader();
  if (api.MeshoptDecoder) loader.setMeshoptDecoder(api.MeshoptDecoder);
  let replaced = new Set<string>();
  const wrap = () => {
    // The landmark loader withholds the specs the near tier draws (its frame participant asks canShowModel per frame).
    const sl = vm._signatureLandmarks;
    if (!sl || sl.__recipeTilesWrapped) return;
    const previous = sl.canShowModel.bind(sl);
    sl.canShowModel = (spec: any) => !replaced.has(spec.id) && previous(spec);
    sl.__recipeTilesWrapped = true;
  };
  const host: TileBuildingsHost = {
    THREE, frame, baseUrl: recipeTilesBase(), lit: true,
    cityLook: getCityLook(THREE, {anisotropy: (globalThis as any).matchMedia?.('(pointer: coarse)').matches ? 1 : 4}),
    loadGltf: url => loader.loadAsync(url),
    getCentre: () => vm.map?.getCenter?.(),
    setHidden: ids => {
      const facades = vm._threeBuildings;
      if (!facades?.setHidden) return false;
      facades.setHidden('recipe-tiles', ids);
      vm._pyramidalRoofs?.setHiddenReason?.('recipe-tiles', ids);
      return true;
    },
    setReplacedSpecs: ids => { wrap(); replaced = ids; vm.map?.triggerRepaint?.(); },
    repaint: () => vm.map?.triggerRepaint?.(),
  };
  const tiles = new TileBuildings(host);
  (globalThis as any).__canalRecallTileBuildings = tiles;
  await tiles.start();
  return tiles;
}
