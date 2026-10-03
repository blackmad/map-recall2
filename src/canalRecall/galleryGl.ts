// One shared WebGL context for the gallery pages, drawing with the game's own facade shader
// (VERTEX / FRAGMENT from threeBuildingsBrowser.ts) and its texture arrays. The game draws these
// chunks inside MapLibre's GL context; here the same chunks go into plain three.js scenes.
// Differences from the game: no MapLibre base map under them (a flat ground colour), no street
// graph in the landmark gallery (doors on any outer wall), chunks built on the main thread.

import { VERTEX, FRAGMENT, buildLookTextures } from './threeBuildingsBrowser.js';
import { cellSetOf, type BuildingLook } from './threeBuildingFeatures.js';
import type { Chunk } from './threeBuildingMesh.js';
import { orbitPosition, type Orbit } from './galleryOrbit.js';

export const LOOKS: readonly BuildingLook[] = ['photo', 'storybook', 'cartoon', 'procedural', 'untextured'];
export const LOOK_LABEL: Record<BuildingLook, string> = { photo: 'Photo', storybook: 'Storybook', cartoon: 'Cartoon', procedural: 'Painted', untextured: 'Untextured' };

export const getThree = (): any => (window as any).CanalRecallThree.THREE;

export { kitLayersFor } from './galleryLayers.js';

/** A chunk's typed arrays as a BufferGeometry in the layout the game's shader reads. */
export function chunkGeometry(THREE: any, chunk: Chunk): any {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(chunk.uvs, 2));
  g.setAttribute('layer', new THREE.BufferAttribute(chunk.layers, 1, false));
  g.setAttribute('tint', new THREE.BufferAttribute(chunk.tints, 4, true));
  g.setAttribute('accent', new THREE.BufferAttribute(chunk.accents, 4, true));
  g.setAttribute('hidden', new THREE.BufferAttribute(new Uint8Array(chunk.vertexCount), 1, false));
  g.setIndex(new THREE.BufferAttribute(chunk.indices, 1));
  g.computeBoundingSphere();
  return g;
}

export class GalleryGL {
  readonly THREE = getThree();
  readonly renderer: any;
  private sets = new Map<string, Promise<{ colour: any; mask: any }>>();
  private materials = new Map<string, any>();

  constructor(readonly background = '#e9e4d4') {
    const THREE = this.THREE;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setClearColor(new THREE.Color(background), 1);
  }

  private texturesFor(set: 'procedural' | 'photo' | 'storybook' | 'cartoon') {
    let hit = this.sets.get(set);
    if (!hit) this.sets.set(set, hit = buildLookTextures(this.THREE, set, this.renderer.capabilities.getMaxAnisotropy()));
    return hit;
  }

  /** The game's facade material for a look; `flat` draws vertex colour only (grey context blocks). */
  async material(look: BuildingLook, flat = false): Promise<any> {
    const key = `${flat ? 'flat:' : ''}${look}`;
    let hit = this.materials.get(key);
    if (!hit) {
      const THREE = this.THREE, set = await this.texturesFor(flat ? 'procedural' : cellSetOf(look));
      hit = this.materials.get(key);
      if (!hit) {
        hit = new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.FrontSide,
          uniforms: { cells: { value: set.colour }, masks: { value: set.mask }, bands: { value: !flat && look === 'cartoon' ? 3 : 0 }, flatColour: { value: flat || look === 'untextured' ? 1 : 0 } },
        });
        this.materials.set(key, hit);
      }
    }
    return hit;
  }

  mesh(chunk: Chunk | null, material: any, group: any): any {
    if (!chunk || !chunk.vertexCount) return null;
    const mesh = new this.THREE.Mesh(chunkGeometry(this.THREE, chunk), material);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  }

  /** Render a scene from an orbit into a 2D canvas (the one WebGL context serves every card). */
  draw(scene: any, orbit: Orbit, target: HTMLCanvasElement, fov = 35): void {
    const THREE = this.THREE, dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(16, Math.round(target.clientWidth * dpr)), h = Math.max(16, Math.round(target.clientHeight * dpr));
    if (target.width !== w || target.height !== h) { target.width = w; target.height = h; }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    const camera = new THREE.PerspectiveCamera(fov, w / h, 0.5, 4000);
    camera.up.set(0, 0, 1);
    const [px, py, pz] = orbitPosition(orbit);
    camera.position.set(px, py, pz);
    camera.lookAt(orbit.target[0], orbit.target[1], orbit.target[2]);
    camera.updateMatrixWorld();
    this.renderer.render(scene, camera);
    const ctx = target.getContext('2d')!;
    ctx.drawImage(this.renderer.domElement, 0, 0, w, h);
  }

  camera(orbit: Orbit, aspect: number, fov = 35): any {
    const THREE = this.THREE, camera = new THREE.PerspectiveCamera(fov, aspect, 0.5, 4000);
    camera.up.set(0, 0, 1);
    const [px, py, pz] = orbitPosition(orbit);
    camera.position.set(px, py, pz); camera.lookAt(orbit.target[0], orbit.target[1], orbit.target[2]); camera.updateMatrixWorld();
    return camera;
  }
}

/** Free a built group's GPU buffers (materials and textures are shared and stay). */
export function disposeGroup(group: any): void {
  group.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); });
  group.clear();
}
