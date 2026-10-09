// The game's facade chunks (threeBuildingMesh.ts) drawn with a lit three.js
// material instead of the unlit RawShaderMaterial the MapLibre layer uses, so
// they receive sun shadows, sky light, fog and tone mapping like everything else.
//
// Same attributes, same texture arrays (buildLookTextures): only the lighting
// model changes. The baked per-wall shade (tint.a) is dropped; real light does it.
import * as THREE from 'three';
import type { Chunk } from '../threeBuildingMesh.js';

export function chunkGeometry(chunk: Chunk): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(chunk.uvs, 2));
  g.setAttribute('layer', new THREE.BufferAttribute(chunk.layers, 1, false));
  g.setAttribute('tint', new THREE.BufferAttribute(chunk.tints, 4, true));
  g.setAttribute('accent', new THREE.BufferAttribute(chunk.accents, 4, true));
  g.setIndex(new THREE.BufferAttribute(chunk.indices, 1));
  // Chunk quads own their vertices, so smooth normals are face normals.
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function facadeMaterial(cells: THREE.Texture, masks: THREE.Texture): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.FrontSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.cells = { value: cells };
    shader.uniforms.masks = { value: masks };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float layer;
attribute vec4 tint;
attribute vec4 accent;
varying vec2 vFacUv;
flat varying float vLayer;
varying vec3 vTint;
varying vec3 vAccent;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vFacUv = uv; vLayer = layer; vTint = tint.rgb; vAccent = accent.rgb;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
precision highp sampler2DArray;
uniform sampler2DArray cells;
uniform sampler2DArray masks;
varying vec2 vFacUv;
flat varying float vLayer;
varying vec3 vTint;
varying vec3 vAccent;
float facadeLuma;`)
      .replace('#include <map_fragment>', `
vec3 fp = vec3(vFacUv, vLayer);
vec3 fc = texture(cells, fp).rgb;
vec2 fm = texture(masks, fp).rg;
fc *= mix(vec3(1.0), vTint, fm.r) * mix(vec3(1.0), vAccent, fm.g);
facadeLuma = dot(fc, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb *= pow(fc, vec3(2.2));`)
      // Dark glass reads as glass: glossy enough to pick up the sky.
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(0.28, 0.92, smoothstep(0.06, 0.2, facadeLuma));`);
  };
  material.customProgramCacheKey = () => 'facade-array-v1';
  return material;
}
