// Container stacks and rail ballast for the yards the city draws as bare ground (src/canalRecall/yardFill.ts,
// scripts/build-yard-fill.ts). Opt-in: `?yardFill=1`, off by default until the user has looked at it.
// Data: <extract>/yard-fill/{container-stacks,rail-sidings}.json (integrator copies scripts/data/yard-fill/ there).
// Registers one object with the shared frame like street-furniture-source.js; local frame = metres east/north of ORIGIN.
import { project } from '../yardFill';

const W = () => globalThis as any;
export const yardFillFlag = (search: string = (globalThis as any).location?.search ?? ''): boolean => new URLSearchParams(search).get('yardFill') === '1';
const ORIGIN: [number, number] = [4.9, 52.37];
const MIN_ZOOM = 15;

export interface YardBoxRow { 0: number; 1: number; 2: number; 3: number; 4: string }
/** Instance placement from a staged row [lng, lat, headingDeg(compass), heightM, colour]. */
export function boxPlacement(row: readonly [number, number, number, number, string], sizeM: readonly [number, number], base = 0) {
  const [x, y] = project([row[0], row[1]], ORIGIN);
  return { x, y, z: base + row[3] / 2, rotZ: (90 - row[2]) * Math.PI / 180, sx: sizeM[0], sy: sizeM[1], sz: row[3], colour: row[4] };
}
/** Flat ribbon (triangle list, z up) of `widthM` along a lng/lat line. */
export function ribbon(line: readonly [number, number][], widthM: number, z = 0.05): number[] {
  const pts = line.map(p => project(p, ORIGIN)), out: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l * widthM / 2, ny = (bx - ax) / l * widthM / 2;
    out.push(ax + nx, ay + ny, z, ax - nx, ay - ny, z, bx + nx, by + ny, z, ax - nx, ay - ny, z, bx - nx, by - ny, z, bx + nx, by + ny, z);
  }
  return out;
}

export class YardFillLayer {
  private scene: any; private transform: any; private unregister: (() => void) | null = null; private ready = false; private groundBase: ((p: [number, number]) => number) | null = null;
  private data: { stacks: any; sidings: any } | null = null; private meshes: any[] = []; private suspended = false;
  constructor(private readonly cameraMap: any, mercator: any, opts: { sharedFrame?: any } = {}) {
    const { THREE } = W().CanalRecallThree;
    this.scene = new THREE.Group(); this.scene.name = 'yard-fill';
    const origin = mercator.MercatorCoordinate.fromLngLat(ORIGIN, 0), s = origin.meterInMercatorCoordinateUnits();
    this.transform = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z).scale(new THREE.Vector3(s, -s, s));
    this.unregister = opts.sharedFrame?.register('yard-fill', {
      root: this.scene, mercatorFromLocal: () => this.transform.elements,
      beforeRender: (ctx: { zoom: number }) => this.ready && !this.suspended && ctx.zoom >= MIN_ZOOM && this.meshes.length > 0,
    }, { order: 31 }) ?? null;
  }
  async load(extractPath: string): Promise<void> {
    if (!extractPath.endsWith('/amsterdam')) return;
    try {
      const [a, b] = await Promise.all(['container-stacks', 'rail-sidings'].map(n => fetch(new URL(`${extractPath}/yard-fill/${n}.json`, location.href))));
      if (!a.ok || !b.ok) return;
      this.data = { stacks: await a.json(), sidings: await b.json() };
      this.build();
    } catch (error) { console.warn('Yard fill unavailable.', error); }
  }
  setGroundBase(fn: ((p: [number, number]) => number) | null): void { this.groundBase = fn; if (this.data) this.build(); }
  refreshGroundBases(): void { if (this.data) this.build(); }
  setSuspended(v: boolean): void { this.suspended = v; }
  remove(): void { this.unregister?.(); this.unregister = null; this.clear(); }
  private clear(): void { for (const m of this.meshes) { this.scene.remove(m); m.geometry.dispose?.(); m.material.dispose?.(); m.dispose?.(); } this.meshes = []; }
  private build(): void {
    const { THREE } = W().CanalRecallThree; this.clear();
    const boxes: any[] = (this.data!.stacks.yards as any[]).flatMap(y => y.boxes), size = this.data!.stacks.boxSizeM as [number, number];
    if (boxes.length) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 }), boxes.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
      boxes.forEach((row, i) => {
        const p = boxPlacement(row, size, this.groundBase?.([row[0], row[1]]) ?? 0);
        m.compose(pos.set(p.x, p.y, p.z), q.setFromAxisAngle(zAxis, p.rotZ), scl.set(p.sx, p.sy, p.sz)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, col.set(p.colour));
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
      this.scene.add(mesh); this.meshes.push(mesh);
    }
    const tri: number[] = [];
    for (const a of this.data!.sidings.anchors as any[]) for (const line of a.lines) tri.push(...ribbon(line, this.data!.sidings.ballastWidthM, (this.groundBase?.(line[0]) ?? 0) + 0.06));
    if (tri.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3)); g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6f6a62', roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, side: THREE.DoubleSide }));
      mesh.frustumCulled = false; this.scene.add(mesh); this.meshes.push(mesh);
    }
    this.ready = true; this.cameraMap.triggerRepaint?.();
  }
}
