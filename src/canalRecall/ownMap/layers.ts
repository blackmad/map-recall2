// three.js meshes for the flat overview: polygon fills (water, parks), lines
// with MapLibre-like pixel widths (streets by class, route), coarse building
// footprints (the existing z12 raster pyramid) and simple extruded footprints
// from the z14 building tiles. Everything flat lives at z ≈ 0 and does not
// write depth, so the 3D near field and buildings draw over it naturally.
//
// Opacity is screen-door dithered (opaque pixels, no sorting), which is also
// how the near-field handover hides the overview inside the rider's radius.

import * as THREE from 'three';
import earcut from 'earcut';
import { footprintArrays, type FootprintArrays, type FootprintFeature } from './footprints';
import type { Vec2 } from './frame';
import { fromLocal } from './frame';

const DITHER = /* glsl */`
float bayer4(vec2 p){ int x=int(mod(p.x,4.)), y=int(mod(p.y,4.)); int i=x+y*4;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for(int k=0;k<16;k++){ if(k==i) return (m[k]+.5)/16.; } return .5; }
uniform vec2 uRider; uniform float uNearR; uniform float uNear;
float nearKeep(vec2 w){ if(uNear<=0.) return 1.; float d=distance(w,uRider); return mix(1., smoothstep(uNearR*0.8, uNearR, d), uNear); }
`;

export interface FlatUniforms {
  uColor: { value: THREE.Color };
  uOpacity: { value: number };
  uZ: { value: number };
  uHalf: { value: number };
  uRider: { value: THREE.Vector2 };
  uNearR: { value: number };
  uNear: { value: number };
}

/** Shared near-field handover uniforms: every flat material points at these. */
export const handover = { uRider: { value: new THREE.Vector2() }, uNearR: { value: 600 }, uNear: { value: 0 } };

// These ShaderMaterials write gl_FragColor without three's output colour-space
// conversion, so the colour is passed through untouched (declared "linear").
const raw = (color: string) => new THREE.Color().setStyle(color, THREE.LinearSRGBColorSpace);

// Scene fog (look/depthFalloff.ts, `?depthFalloff=1`): the flat layers take three's fog chunks, which compile to
// nothing while the scene has no fog. The fog colour arrives in the output colour space, like these raw colours.
const fogUniforms = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog) as Record<string, THREE.IUniform>;
const FOG_VERT_PARS = '\n#include <fog_pars_vertex>\n';
const FOG_FRAG_PARS = '\n#include <fog_pars_fragment>\n';
const FOG_VERTEX = '\n#include <fog_vertex>\n';
const FOG_FRAGMENT = '\n#include <fog_fragment>\n';

function flatUniforms(color: string, z: number): FlatUniforms {
  return { uColor: { value: raw(color) }, uOpacity: { value: 1 }, uZ: { value: z }, uHalf: { value: 1 }, ...handover };
}

const FRAG = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; varying vec2 vWorld;
${DITHER}
${FOG_FRAG_PARS}
void main(){ float a=uOpacity*nearKeep(vWorld); if(a<bayer4(gl_FragCoord.xy)) discard; gl_FragColor=vec4(uColor,1.);${FOG_FRAGMENT}}`;

export function fillMaterial(color: string, z: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...flatUniforms(color, z), ...fogUniforms() } as unknown as Record<string, THREE.IUniform>,
    fog: true,
    vertexShader: /* glsl */`${FOG_VERT_PARS}uniform float uZ; varying vec2 vWorld; void main(){ vWorld=position.xy; vec4 mvPosition=modelViewMatrix*vec4(position.xy,uZ,1.); gl_Position=projectionMatrix*mvPosition;${FOG_VERTEX} }`,
    fragmentShader: FRAG,
    // In three's transparent list (ordered by renderOrder, after the opaque 3D),
    // so the flat layers keep their cartographic order among themselves.
    transparent: true,
    depthWrite: false,
  });
}

export function lineMaterial(color: string, z: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...flatUniforms(color, z), ...fogUniforms() } as unknown as Record<string, THREE.IUniform>,
    fog: true,
    vertexShader: /* glsl */`${FOG_VERT_PARS}
      uniform float uZ; uniform float uHalf; attribute vec2 aDir; attribute vec2 aCorner; varying vec2 vWorld;
      void main(){ vec2 n=vec2(-aDir.y,aDir.x); vec2 p=position.xy+(n*aCorner.x+aDir*aCorner.y)*uHalf; vWorld=p;
        vec4 mvPosition=modelViewMatrix*vec4(p,uZ,1.); gl_Position=projectionMatrix*mvPosition;${FOG_VERTEX} }`,
    fragmentShader: FRAG,
    // In three's transparent list (ordered by renderOrder, after the opaque 3D),
    // so the flat layers keep their cartographic order among themselves.
    transparent: true,
    depthWrite: false,
  });
}

/** The CSS viewport every rail line material reads (railLineMaterial), set once per frame by the overview layer. */
export const railViewport = { uViewport: { value: new THREE.Vector2(1280, 800) } };

/**
 * lineMaterial with a screen-space floor (lane R3-C #232): each vertex projects its centreline point and a metre
 * across the line, and widens the half-width to at least `uMinHalfPx` CSS px there, so a rail line never thins
 * below its floor with depth in a pitched view (lineMaterial's `uHalf` is metres at the view centre). Behind the eye
 * (w <= 0) the styled width stands. Its own program: the street lines keep lineMaterial's.
 */
/**
 * The floor's reach, metres of half-width: toward the horizon a metre across a line seen edge-on is a sliver of a
 * pixel, and an unclamped floor would extrude the far lines hundreds of metres along the ground (toward the eye too).
 * Measured at the S4 and Zuidas rail spots (desktop, DPR 2, 2026-11-06), hiding both overview rail meshes changes
 * GPU ms by under 0.1 ms; the clamp bounds the worst case.
 */
export const RAIL_FLOOR_MAX_HALF_M = 30;

export function railLineMaterial(color: string, z: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...flatUniforms(color, z), uMinHalfPx: { value: 0 }, ...railViewport, ...fogUniforms() } as unknown as Record<string, THREE.IUniform>,
    fog: true,
    vertexShader: /* glsl */`${FOG_VERT_PARS}
      uniform float uZ; uniform float uHalf; uniform float uMinHalfPx; uniform vec2 uViewport; attribute vec2 aDir; attribute vec2 aCorner; varying vec2 vWorld;
      void main(){ vec2 n=vec2(-aDir.y,aDir.x);
        vec4 c0=projectionMatrix*modelViewMatrix*vec4(position.xy,uZ,1.), c1=projectionMatrix*modelViewMatrix*vec4(position.xy+n,uZ,1.);
        float half_=uHalf;
        const float RAIL_FLOOR_MAX_HALF_M=${RAIL_FLOOR_MAX_HALF_M.toFixed(1)};
        if(c0.w>0. && c1.w>0.){ float pxPerM=length((c1.xy/c1.w-c0.xy/c0.w)*0.5*uViewport); half_=max(uHalf, min(uMinHalfPx/max(pxPerM,1e-4), RAIL_FLOOR_MAX_HALF_M)); }
        vec2 p=position.xy+(n*aCorner.x+aDir*aCorner.y)*half_; vWorld=p;
        vec4 mvPosition=modelViewMatrix*vec4(p,uZ,1.); gl_Position=projectionMatrix*mvPosition;${FOG_VERTEX} }`,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });
}

/** Triangulated polygons (ring 0 outer, rest holes) as one geometry. */
export function polygonGeometry(polygons: readonly (readonly (readonly Vec2[])[])[]): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (const poly of polygons) {
    const flat: number[] = [], holes: number[] = [];
    poly.forEach((ring, i) => { if (i) holes.push(flat.length / 2); for (const [x, y] of ring) flat.push(x, y); });
    const base = pos.length / 3;
    for (let i = 0; i < flat.length; i += 2) pos.push(flat[i], flat[i + 1], 0);
    for (const t of earcut(flat, holes, 2)) idx.push(base + t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Lines as one quad per segment, extruded in the vertex shader by `uHalf`
 * (world metres, set each frame from the class's pixel width × metres per
 * pixel, which gives MapLibre's perspective-thinning for free). Each quad
 * reaches half a width past its ends, so joins and ends are square-capped.
 */
export function lineGeometry(lines: readonly (readonly Vec2[])[]): THREE.BufferGeometry {
  let segs = 0;
  for (const l of lines) segs += Math.max(0, l.length - 1);
  const pos = new Float32Array(segs * 12), dir = new Float32Array(segs * 8), corner = new Float32Array(segs * 8);
  const idx = new Uint32Array(segs * 6);
  let s = 0;
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const [ax, ay] = l[i - 1], [bx, by] = l[i];
    const len = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / len, dy = (by - ay) / len;
    const v = s * 4;
    // Written in place (no per-vertex arrays: the overview's ~400k segments made this a boot hot spot, #130).
    for (let k = 0; k < 4; k++) {
      const p = (v + k) * 3, q = (v + k) * 2, far = k >= 2;
      pos[p] = far ? bx : ax; pos[p + 1] = far ? by : ay; pos[p + 2] = 0;
      dir[q] = dx; dir[q + 1] = dy;
      corner[q] = k % 2 === 0 ? 1 : -1; corner[q + 1] = far ? 1 : -1;
    }
    const o = s * 6;
    idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v + 1; idx[o + 4] = v + 3; idx[o + 5] = v + 2;
    s++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 2));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// --- Coarse buildings: the z12 footprint raster (building-overview/) --------

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const tileLat = (y: number, z: number) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };
const tileLng = (x: number, z: number) => x / 2 ** z * 360 - 180;

/** A slippy tile as a plane in local metres, rows spaced in Mercator so image rows land on the right latitude. */
export function tileQuadGeometry(z: number, x: number, y: number, toLocal: (lng: number, lat: number) => Vec2, rows = 16): THREE.BufferGeometry {
  const w = tileLng(x, z), e = tileLng(x + 1, z), n = tileLat(y, z), s = tileLat(y + 1, z);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const m0 = mercY(n), m1 = mercY(s);
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const lat = (2 * Math.atan(Math.exp(m0 + (m1 - m0) * v)) - Math.PI / 2) * 180 / Math.PI;
    for (const [u, lng] of [[0, w], [1, e]] as const) { const [lx, ly] = toLocal(lng, lat); pos.push(lx, ly, 0); uv.push(u, 1 - v); }
    if (r) { const b = (r - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function rasterMaterial(texture: THREE.Texture, color: string, z: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, ...flatUniforms(color, z), ...fogUniforms() } as unknown as Record<string, THREE.IUniform>,
    fog: true,
    vertexShader: /* glsl */`${FOG_VERT_PARS}uniform float uZ; varying vec2 vUv; varying vec2 vWorld; void main(){ vUv=uv; vWorld=position.xy; vec4 mvPosition=modelViewMatrix*vec4(position.xy,uZ,1.); gl_Position=projectionMatrix*mvPosition;${FOG_VERTEX} }`,
    fragmentShader: /* glsl */`uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying vec2 vWorld; ${DITHER}
      ${FOG_FRAG_PARS}
      void main(){ vec4 t=texture2D(map,vUv); float a=t.a*uOpacity*nearKeep(vWorld); if(a<0.01) discard; gl_FragColor=vec4(uColor*0.9,a);${FOG_FRAGMENT}}`,
    // Real blending here: raster tiles never overlap, and dithering a soft
    // (anti-aliased) footprint edge stippled the whole city.
    transparent: true,
    depthWrite: false,
  });
}

// --- Footprints from the z14 building tiles, extruded --------------------------
// Arrays come from footprints.ts (built in footprintWorker.ts on the page).

export type { FootprintFeature } from './footprints';

/** A geometry from footprint arrays (worker output, or footprintArrays on the main thread). */
export function footprintGeometryFromArrays(a: FootprintArrays): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(a.color, 3));
  geo.setIndex(new THREE.BufferAttribute(a.index, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Main-thread fallback (no worker). */
export function footprintGeometry(features: readonly FootprintFeature[], toLocal: (lng: number, lat: number) => Vec2, top: string, wall: string): THREE.BufferGeometry {
  return footprintGeometryFromArrays(footprintArrays(features, toLocal, top, wall));
}

/** z14 tile keys (x/y) covering a local box. */
export function z14TilesFor(box: [number, number, number, number]): string[] {
  const [w, s] = fromLocal(box[0], box[1]), [e, n] = fromLocal(box[2], box[3]);
  const tx = (lng: number) => Math.floor((lng + 180) / 360 * 2 ** 14);
  const ty = (lat: number) => Math.floor((1 - mercY(lat) / Math.PI) / 2 * 2 ** 14);
  const out: string[] = [];
  for (let x = tx(w); x <= tx(e); x++) for (let y = ty(n); y <= ty(s); y++) out.push(`${x}/${y}`);
  return out;
}
