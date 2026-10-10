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
import type { Vec2 } from './frame';
import { fromLocal } from './frame';
import { footprintArrays, type FootprintArrays, type FootprintFeature } from './footprints';

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

function flatUniforms(color: string, z: number): FlatUniforms {
  return { uColor: { value: raw(color) }, uOpacity: { value: 1 }, uZ: { value: z }, uHalf: { value: 1 }, ...handover };
}

const FRAG = /* glsl */`
uniform vec3 uColor; uniform float uOpacity; varying vec2 vWorld;
${DITHER}
void main(){ float a=uOpacity*nearKeep(vWorld); if(a<bayer4(gl_FragCoord.xy)) discard; gl_FragColor=vec4(uColor,1.); }`;

export function fillMaterial(color: string, z: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: flatUniforms(color, z) as unknown as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */`uniform float uZ; varying vec2 vWorld; void main(){ vWorld=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position.xy,uZ,1.); }`,
    fragmentShader: FRAG,
    // In three's transparent list (ordered by renderOrder, after the opaque 3D),
    // so the flat layers keep their cartographic order among themselves.
    transparent: true,
    depthWrite: false,
  });
}

export interface LineMaterialOptions {
  /** Dashed: set `uDash` (dash, gap) in metres each frame. */
  dash?: boolean;
  /** Per-vertex colour from the geometry's `aColor` (lineGeometry `colors`). */
  vertexColor?: boolean;
  /** Real alpha blending instead of the screen-door dither: for translucent
   *  overlays (transit casings, dashed boundaries), where a dither stipples.
   *  Joins overlap, so a join is a little darker; fine at these opacities. */
  blend?: boolean;
}

export function lineMaterial(color: string, z: number, opts: LineMaterialOptions = {}): THREE.ShaderMaterial {
  const defines: Record<string, string> = {};
  if (opts.dash) defines.DASH = '';
  if (opts.vertexColor) defines.VCOLOR = '';
  if (opts.blend) defines.BLEND = '';
  return new THREE.ShaderMaterial({
    defines,
    uniforms: { ...flatUniforms(color, z), uDash: { value: new THREE.Vector2(0, 0) } } as unknown as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */`
      uniform float uZ; uniform float uHalf; attribute vec2 aDir; attribute vec2 aCorner; attribute float aDist; varying vec2 vWorld; varying float vDist;
      #ifdef VCOLOR
      attribute vec3 aColor; varying vec3 vColor;
      #endif
      void main(){ vec2 n=vec2(-aDir.y,aDir.x); vec2 p=position.xy+(n*aCorner.x+aDir*aCorner.y)*uHalf; vWorld=p; vDist=aDist+aCorner.y*uHalf;
        #ifdef VCOLOR
        vColor=aColor;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,uZ,1.); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; uniform vec2 uDash; varying vec2 vWorld; varying float vDist;
      #ifdef VCOLOR
      varying vec3 vColor;
      #endif
      ${DITHER}
      void main(){
        #ifdef DASH
        if(uDash.x>0. && mod(vDist, uDash.x+uDash.y) > uDash.x) discard;
        #endif
        float a=uOpacity*nearKeep(vWorld);
        #ifdef BLEND
        if(a<0.004) discard;
        #else
        if(a<bayer4(gl_FragCoord.xy)) discard; a=1.;
        #endif
        #ifdef VCOLOR
        gl_FragColor=vec4(vColor,a);
        #else
        gl_FragColor=vec4(uColor,a);
        #endif
      }`,
    // In three's transparent list (ordered by renderOrder, after the opaque 3D),
    // so the flat layers keep their cartographic order among themselves.
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
export function lineGeometry(lines: readonly (readonly Vec2[])[], colors?: readonly string[]): THREE.BufferGeometry {
  let segs = 0;
  for (const l of lines) segs += Math.max(0, l.length - 1);
  const pos = new Float32Array(segs * 12), dir = new Float32Array(segs * 8), corner = new Float32Array(segs * 8), dist = new Float32Array(segs * 4);
  const col = colors ? new Float32Array(segs * 12) : null;
  const idx = new Uint32Array(segs * 6);
  const c = new THREE.Color();
  let s = 0;
  lines.forEach((l, li) => {
    if (col) c.setStyle(colors![li] ?? '#ffffff', THREE.LinearSRGBColorSpace);
    // Arc length along the line, for dashes (continuous across vertices).
    let along = 0;
    for (let i = 1; i < l.length; i++) {
      const [ax, ay] = l[i - 1], [bx, by] = l[i];
      const len = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / len, dy = (by - ay) / len;
      const v = s * 4;
      const put = (k: number, x: number, y: number, side: number, ext: number, d: number) => {
        pos.set([x, y, 0], (v + k) * 3); dir.set([dx, dy], (v + k) * 2); corner.set([side, ext], (v + k) * 2); dist[v + k] = d;
        if (col) col.set([c.r, c.g, c.b], (v + k) * 3);
      };
      put(0, ax, ay, 1, -1, along); put(1, ax, ay, -1, -1, along); put(2, bx, by, 1, 1, along + len); put(3, bx, by, -1, 1, along + len);
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], s * 6);
      along += len;
      s++;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 2));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
  if (col) g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Text lying on the ground (the answered-street lettering): a CanvasTexture
 * quad of `heightM` metres, its top pointing along `bearing` (degrees
 * clockwise from north), so it reads from the saddle like road paint.
 */
export function groundTextMesh(text: string, opts: { heightM: number; bearing: number; at: Vec2; fill: string; halo: string; haloPx?: number; letterSpacingEm?: number; opacity?: number; z?: number }): THREE.Mesh {
  const px = 96, pad = 12;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `700 ${px}px "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font;
  const spacing = (opts.letterSpacingEm ?? 0) * px;
  const chars = [...text];
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const w = Math.ceil(widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1) + pad * 2);
  canvas.width = w; canvas.height = Math.ceil(px * 1.25 + pad * 2);
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  let x = pad;
  for (const pass of [0, 1]) {
    x = pad;
    chars.forEach((ch, i) => {
      if (pass === 0) { ctx.strokeStyle = opts.halo; ctx.lineWidth = (opts.haloPx ?? 1.4) * (px / 24) * 2; ctx.strokeText(ch, x, canvas.height / 2); }
      else { ctx.fillStyle = opts.fill; ctx.fillText(ch, x, canvas.height / 2); }
      x += widths[i] + spacing;
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const h = opts.heightM * canvas.height / px, wM = h * canvas.width / canvas.height;
  const geo = new THREE.PlaneGeometry(wM, h);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: opts.opacity ?? 1, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(opts.at[0], opts.at[1], opts.z ?? 0.4);
  // Plane faces +z; its +y (text up) turned from north to the bearing.
  mesh.rotation.z = -opts.bearing * Math.PI / 180;
  mesh.renderOrder = 45;
  return mesh;
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
    uniforms: { map: { value: texture }, ...flatUniforms(color, z) } as unknown as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */`uniform float uZ; varying vec2 vUv; varying vec2 vWorld; void main(){ vUv=uv; vWorld=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position.xy,uZ,1.); }`,
    fragmentShader: /* glsl */`uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying vec2 vWorld; ${DITHER}
      void main(){ vec4 t=texture2D(map,vUv); float a=t.a*uOpacity*nearKeep(vWorld); if(a<0.01) discard; gl_FragColor=vec4(uColor*0.9,a); }`,
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
