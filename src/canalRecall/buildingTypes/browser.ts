/**
 * Browser entry for the opt-in building-types runtime (`?buildingTypes=1`). Bundle:
 *   esbuild src/canalRecall/buildingTypes/browser.ts --bundle --format=iife --global-name=CanalRecallBuildingTypes \
 *     --outfile=public/canal-drive/js/building-types.bundle.js --minify
 * three.js is injected by the landmark source (`createBuildingTypes({THREE, ...})`), so this bundle has no copy of it.
 */
export {areaAnchor, areaRadiusMetres, createBuildingTypes, groupByArea, suppressionIds, instanceMatrix, partitionByDistance, farMassing} from './runtime.ts';
