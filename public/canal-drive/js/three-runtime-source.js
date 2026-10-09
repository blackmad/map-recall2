// One copy of three.js for the whole page.
//
// `detailed-buildings.bundle.js` (698 KB) and `player-vehicles.bundle.js`
// (606 KB) each carried their own complete copy, because each was built as a
// self-contained IIFE. Every player downloaded three twice and the browser
// parsed and kept two unrelated copies of it in memory.
//
// This is the single shared build. The feature bundles read three off the
// global it publishes, so adding a third 3D feature costs only that feature.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export { THREE, GLTFLoader, MeshoptDecoder };

// The shared three.js frame (one renderer / scene / light rig for every 3D
// layer; `?sharedFrame=1`). Typed source in src/canalRecall/rendererShared/;
// it takes THREE as an argument, so it adds no second copy of three here.
export { SharedFrame } from '../../../src/canalRecall/rendererShared/sharedFrame.ts';
export { createLitFacadeMaterial, createFacadeDepthMaterial } from '../../../src/canalRecall/rendererShared/litFacadeMaterial.ts';
export { withinView } from '../../../src/canalRecall/rendererShared/residency.ts';
export { PARTICIPANT_ORDER } from '../../../src/canalRecall/rendererShared/layerRegistry.ts';
